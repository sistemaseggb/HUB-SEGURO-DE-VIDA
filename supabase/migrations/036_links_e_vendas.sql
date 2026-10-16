begin;
alter table apolices add column if not exists id_operacao uuid unique;
create or replace function public.fn_apolice_criar(p_operacao uuid,p_cliente uuid,p_dados jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare a apolices;
begin
 if p_operacao is null or not exists(select 1 from clientes where id=p_cliente) then raise exception 'Cliente ou operação inválidos'; end if;
 insert into apolices(id_operacao,id_cliente,id_seguradora,numero_apolice,valor_premio_mensal,capital_segurado,percentual_comissao,data_vigencia,status,motivo_cancelamento)
 values(p_operacao,p_cliente,(p_dados->>'id_seguradora')::uuid,nullif(p_dados->>'numero_apolice',''),(p_dados->>'valor_premio_mensal')::numeric,(p_dados->>'capital_segurado')::numeric,(p_dados->>'percentual_comissao')::numeric,(p_dados->>'data_vigencia')::date,(p_dados->>'status')::status_apolice,p_dados->>'motivo_cancelamento')
 on conflict(id_operacao) do nothing returning * into a;
 if not found then select * into a from apolices where id_operacao=p_operacao and id_cliente=p_cliente; end if;
 if a.id is null then raise exception 'Venda não confirmada'; end if;
 return jsonb_build_object('id',a.id);
end $$;
revoke all on function public.fn_apolice_criar(uuid,uuid,jsonb) from public,anon;
grant execute on function public.fn_apolice_criar(uuid,uuid,jsonb) to authenticated;

alter table formularios_onboarding add column if not exists validade timestamptz not null default (now()+interval '90 days');
alter table formularios_onboarding add column if not exists revogada_em timestamptz;
alter table formularios_planejamento add column if not exists validade timestamptz not null default (now()+interval '90 days');
alter table formularios_planejamento add column if not exists revogada_em timestamptz;
-- Mantém a lógica transacional testada da 030, agora atrás de validade e revogação.
do $wrap$ declare prefixo text; assinatura text; t text; def text; begin
 foreach prefixo in array array['form','plan'] loop
 t:=case prefixo when 'form' then 'formularios_onboarding' else 'formularios_planejamento' end;
 if to_regprocedure('public.fn_'||prefixo||'_carregar_base036(uuid)') is null then
  execute format('alter function public.fn_%s_carregar(uuid) rename to fn_%s_carregar_base036',prefixo,prefixo);
  execute format('alter function public.fn_%s_salvar(uuid,jsonb,int,boolean) rename to fn_%s_salvar_base036',prefixo,prefixo);
 end if;
 execute format($sql$create or replace function public.fn_%1$s_carregar(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $b$
 begin
  if not exists(select 1 from %2$I f join clientes c on c.id=f.id_cliente where f.token=p_token and f.revogada_em is null and f.validade>now() and c.arquivado_em is null) then return jsonb_build_object('erro','link_indisponivel'); end if;
  return public.fn_%1$s_carregar_base036(p_token);
 end $b$ $sql$,prefixo,t);
 execute format($sql$create or replace function public.fn_%1$s_salvar(p_token uuid,p_respostas jsonb,p_etapa int,p_concluido boolean default false) returns jsonb language plpgsql security definer set search_path=public as $b$
 begin
  if not exists(select 1 from %2$I f join clientes c on c.id=f.id_cliente where f.token=p_token and f.revogada_em is null and f.validade>now() and c.arquivado_em is null) then return jsonb_build_object('erro','link_indisponivel'); end if;
  return public.fn_%1$s_salvar_base036(p_token,p_respostas,p_etapa,p_concluido);
 end $b$ $sql$,prefixo,t);
 execute format('revoke all on function public.fn_%s_carregar_base036(uuid),public.fn_%s_salvar_base036(uuid,jsonb,int,boolean) from public,anon,authenticated',prefixo,prefixo);
 execute format('revoke all on function public.fn_%s_carregar(uuid),public.fn_%s_salvar(uuid,jsonb,int,boolean) from public',prefixo,prefixo);
 execute format('grant execute on function public.fn_%s_carregar(uuid),public.fn_%s_salvar(uuid,jsonb,int,boolean) to anon,authenticated',prefixo,prefixo);
 end loop;
end $wrap$;
create or replace function public.fn_form_revogar(p_id uuid,p_planejamento boolean default false) returns void
language plpgsql security invoker set search_path=public as $$
begin
 if p_planejamento then update formularios_planejamento set revogada_em=now() where id=p_id;
 else update formularios_onboarding set revogada_em=now() where id=p_id; end if;
 if not found then raise exception 'Formulário não encontrado'; end if;
end $$;
revoke all on function public.fn_form_revogar(uuid,boolean) from public,anon;
grant execute on function public.fn_form_revogar(uuid,boolean) to authenticated;

-- Arquivar revoga todos os tipos de link; restaurar não os reativa.
create or replace function public.fn_hub_arquivar_cliente(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not fn_hub_pode_escrever() then raise exception 'Sem permissão'; end if;
 update clientes set arquivado_em=now() where id=p_id and arquivado_em is null;
 if not found then raise exception 'Cliente não encontrado'; end if;
 update propostas_versoes set revogada_em=now() where id_cliente=p_id and revogada_em is null;
 update formularios_onboarding set revogada_em=now() where id_cliente=p_id and revogada_em is null;
 update formularios_planejamento set revogada_em=now() where id_cliente=p_id and revogada_em is null;
end $$;
-- Exclusão de arquivo tem duas fases, impedindo uma cotação de vincular o arquivo durante a remoção.
alter table documentos add column if not exists exclusao_pendente boolean not null default false;
create or replace function public.fn_documento_preparar_exclusao(p_id uuid) returns text
language plpgsql security invoker set search_path=public as $$
declare d documentos;
begin
 select * into d from documentos where id=p_id for update;
 if not found then raise exception 'Documento não encontrado'; end if;
 if exists(select 1 from cotacoes where id_documento=p_id) then raise exception 'Documento vinculado a uma cotação. Preserve o arquivo ou remova o vínculo antes'; end if;
 update documentos set exclusao_pendente=true where id=p_id;
 if not found then raise exception 'Sem permissão para excluir'; end if;
 return d.caminho;
end $$;
create or replace function public.fn_hub_validar_vinculo() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='cotacoes' then
  if new.id_documento is not null then
   perform 1 from documentos where id=new.id_documento and id_cliente=new.id_cliente and not exclusao_pendente for share;
   if not found then raise exception 'Documento de outro cliente ou em exclusão'; end if;
  end if;
 elsif new.id_apolice is not null and not exists(select 1 from apolices where id=new.id_apolice and id_cliente=new.id_cliente) then raise exception 'Apólice não pertence ao cliente deste lançamento'; end if;
 return new;
end $$;
revoke all on function public.fn_documento_preparar_exclusao(uuid) from public,anon;
grant execute on function public.fn_documento_preparar_exclusao(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
