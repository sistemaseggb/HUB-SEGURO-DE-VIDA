begin;
create table if not exists public.conciliacoes_mensais (
 id uuid primary key default gen_random_uuid(),id_apolice uuid not null references apolices(id),
 competencia date not null check(extract(day from competencia)=1),previsto numeric(14,2) not null check(previsto>=0),
 repassado numeric(14,2) not null default 0 check(repassado>=0),observacao text,updated_at timestamptz not null default now(),
 unique(id_apolice,competencia)
);
alter table conciliacoes_mensais enable row level security;
drop policy if exists hub_conciliacao_leitura on conciliacoes_mensais;
create policy hub_conciliacao_leitura on conciliacoes_mensais for select to authenticated using(fn_hub_papel() is not null);
drop policy if exists hub_conciliacao_escrita on conciliacoes_mensais;
create policy hub_conciliacao_escrita on conciliacoes_mensais for all to authenticated using(fn_hub_pode_escrever()) with check(fn_hub_pode_escrever());
grant select,insert,update on conciliacoes_mensais to authenticated;
alter table clientes add column if not exists mesclado_em uuid references clientes(id);
create or replace function public.fn_hub_mesclar_clientes(p_origem uuid,p_destino uuid) returns void
language plpgsql security definer set search_path=public as $$
declare t text; origem clientes; destino clientes; deslocamento integer;
begin
 if fn_hub_papel() is distinct from 'admin' then raise exception 'Somente administração pode consolidar cadastros'; end if;
 if p_origem=p_destino then raise exception 'Selecione dois clientes diferentes'; end if;
 perform 1 from clientes where id in (p_origem,p_destino) order by id for update;
 select * into origem from clientes where id=p_origem and arquivado_em is null;
 if not found then raise exception 'Origem não disponível'; end if;
 select * into destino from clientes where id=p_destino and arquivado_em is null;
 if not found then raise exception 'Destino não disponível'; end if;
 if exists(select 1 from planejamentos where id_cliente=p_origem) and exists(select 1 from planejamentos where id_cliente=p_destino) then
 raise exception 'Ambos têm planejamento. Compare os estudos antes de consolidar com apoio da administração'; end if;
 if exists(select 1 from acompanhamentos where id_cliente=p_origem) and exists(select 1 from acompanhamentos where id_cliente=p_destino) then
 raise exception 'Ambos têm jornada. Confira os acompanhamentos antes de consolidar'; end if;
 update clientes set telefone=coalesce(destino.telefone,origem.telefone),email=coalesce(destino.email,origem.email),data_nascimento=coalesce(destino.data_nascimento,origem.data_nascimento) where id=p_destino;
 -- Mantém o cadastro e assessor escolhidos como destino; não soma capitais nem apaga estudos.
 if exists(select 1 from propostas_versoes where id_cliente=p_origem) and exists(select 1 from propostas_versoes where id_cliente=p_destino) then raise exception 'Ambos têm propostas publicadas. Preserve as versões e solicite revisão administrativa'; end if;
 update propostas_versoes set id_cliente=p_destino where id_cliente=p_origem;
 foreach t in array array['planejamentos','reunioes','apolices','documentos','interacoes','tarefas','historico_funil','formularios_onboarding','formularios_planejamento','transcricoes','cotacoes','acompanhamentos','atendimentos_registros','comissoes_importadas','fila_mensagens'] loop
  execute format('update public.%I set id_cliente=$1 where id_cliente=$2',t) using p_destino,p_origem;
 end loop;
 update clientes set arquivado_em=now(),mesclado_em=p_destino where id=p_origem;
end $$;
create or replace function public.fn_hub_restaurar_cliente(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if fn_hub_papel() is distinct from 'admin' then raise exception 'Somente administração'; end if;
 if exists(select 1 from clientes where id=p_id and mesclado_em is not null) then raise exception 'Cadastro consolidado: consulte a auditoria antes de desfazer'; end if;
 update clientes set arquivado_em=null where id=p_id and arquivado_em is not null;
 if not found then raise exception 'Cliente arquivado não encontrado'; end if;
end $$;
revoke all on function public.fn_hub_mesclar_clientes(uuid,uuid) from public,anon;
grant execute on function public.fn_hub_mesclar_clientes(uuid,uuid) to authenticated;
-- Impede vínculos cruzados entre documento/cotação e comissão/apólice.
create or replace function public.fn_hub_validar_vinculo() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='cotacoes' then
  if new.id_documento is not null and not exists(select 1 from documentos where id=new.id_documento and id_cliente=new.id_cliente) then raise exception 'Documento de outro cliente'; end if;
 elsif new.id_apolice is not null and not exists(select 1 from apolices where id=new.id_apolice and id_cliente=new.id_cliente) then raise exception 'Apólice não pertence ao cliente deste lançamento'; end if;
 return new;
end $$;
drop trigger if exists hub_cotacao_vinculo on cotacoes;
create trigger hub_cotacao_vinculo before insert or update on cotacoes for each row execute function fn_hub_validar_vinculo();
drop trigger if exists hub_comissao_vinculo on comissoes_importadas;
create trigger hub_comissao_vinculo before insert or update on comissoes_importadas for each row execute function fn_hub_validar_vinculo();

-- Administração de perfis sem permitir remover o último administrador.
create or replace function public.fn_hub_atribuir_perfil(p_usuario uuid,p_papel text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if fn_hub_papel() is distinct from 'admin' then raise exception 'Somente administração'; end if;
 if p_papel not in ('admin','consultora','leitura') then raise exception 'Perfil inválido'; end if;
 perform pg_advisory_xact_lock(687422);
 if p_papel<>'admin' and exists(select 1 from hub_perfis where user_id=p_usuario and papel='admin') and (select count(*) from hub_perfis where papel='admin')<=1 then raise exception 'Mantenha pelo menos um administrador'; end if;
 insert into hub_perfis(user_id,papel) values(p_usuario,p_papel) on conflict(user_id) do update set papel=excluded.papel;
end $$;
revoke all on function public.fn_hub_atribuir_perfil(uuid,text) from public,anon;
grant execute on function public.fn_hub_atribuir_perfil(uuid,text) to authenticated;
-- Modificações de perfis passam exclusivamente pela RPC.
revoke insert,update,delete on hub_perfis from authenticated;

commit;
