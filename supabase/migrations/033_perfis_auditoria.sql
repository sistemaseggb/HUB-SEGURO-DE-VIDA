-- Aplicar após 032, com conta administradora do banco. Faça backup antes.
begin;
create table if not exists public.hub_perfis (
 user_id uuid primary key references auth.users(id), papel text not null check(papel in ('admin','consultora','leitura')),
 created_at timestamptz not null default now()
);
-- Somente contas já existentes são migradas. Novos usuários não recebem acesso automaticamente.
insert into hub_perfis(user_id,papel)
 select id,case when row_number() over(order by created_at,id)=1 then 'admin' else 'consultora' end from auth.users
 where not exists(select 1 from hub_perfis) on conflict do nothing;
create or replace function public.fn_hub_papel() returns text
language sql stable security definer set search_path=public as $$ select papel from hub_perfis where user_id=auth.uid() $$;
create or replace function public.fn_hub_pode_escrever() returns boolean
language sql stable security definer set search_path=public as $$ select coalesce(fn_hub_papel() in ('admin','consultora'),false) $$;
revoke all on function public.fn_hub_papel() from public,anon;
grant execute on function public.fn_hub_papel() to authenticated;
alter table hub_perfis enable row level security;
drop policy if exists hub_perfis_ler on hub_perfis;
create policy hub_perfis_ler on hub_perfis for select to authenticated using(user_id=auth.uid() or fn_hub_papel()='admin');
drop policy if exists hub_perfis_admin on hub_perfis;
create policy hub_perfis_admin on hub_perfis for all to authenticated using(fn_hub_papel()='admin') with check(fn_hub_papel()='admin');
grant select,insert,update,delete on hub_perfis to authenticated;

alter table clientes add column if not exists arquivado_em timestamptz;
create table if not exists public.eventos_auditoria (
 id uuid primary key default gen_random_uuid(), tabela text not null, registro uuid, acao text not null,
 autor uuid, anterior jsonb, posterior jsonb, created_at timestamptz not null default now()
);
alter table eventos_auditoria enable row level security;
drop policy if exists hub_auditoria_admin on eventos_auditoria;
create policy hub_auditoria_admin on eventos_auditoria for select to authenticated using(fn_hub_papel()='admin');
grant select on eventos_auditoria to authenticated;
revoke insert,update,delete on eventos_auditoria from authenticated,anon;
create or replace function public.fn_hub_auditar() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into eventos_auditoria(tabela,registro,acao,autor,anterior,posterior)
 values(tg_table_name,coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(old)->>'id')::uuid),tg_op,auth.uid(),case when tg_table_name='planejamentos' then jsonb_build_object('updated_at',to_jsonb(old)->'updated_at') else to_jsonb(old) end,case when tg_table_name='planejamentos' then jsonb_build_object('updated_at',to_jsonb(new)->'updated_at') else to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create or replace function public.fn_hub_impedir_exclusao_cliente() returns trigger language plpgsql as $$
begin raise exception 'Arquive o cliente para preservar os dados e permitir restauração'; end $$;
drop trigger if exists hub_preservar_cliente on clientes;
create trigger hub_preservar_cliente before delete on clientes for each row execute function fn_hub_impedir_exclusao_cliente();
create or replace function public.fn_hub_arquivar_cliente(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not fn_hub_pode_escrever() then raise exception 'Sem permissão'; end if;
 update clientes set arquivado_em=now() where id=p_id and arquivado_em is null;
 if not found then raise exception 'Cliente não encontrado'; end if;
 update propostas_versoes set revogada_em=now() where id_cliente=p_id and revogada_em is null;
end $$;
create or replace function public.fn_hub_arquivados() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'arquivado_em',arquivado_em)),'[]'::jsonb)
 from clientes where arquivado_em is not null and fn_hub_papel()='admin'
$$;
create or replace function public.fn_hub_restaurar_cliente(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if fn_hub_papel() is distinct from 'admin' then raise exception 'Somente administração'; end if;
 update clientes set arquivado_em=null where id=p_id and arquivado_em is not null;
 if not found then raise exception 'Cliente arquivado não encontrado'; end if;
 -- Links revogados continuam revogados; restaurar cadastro não republica informações.
end $$;
revoke all on function public.fn_hub_arquivar_cliente(uuid),public.fn_hub_arquivados(),public.fn_hub_restaurar_cliente(uuid) from public,anon;
grant execute on function public.fn_hub_arquivar_cliente(uuid),public.fn_hub_arquivados(),public.fn_hub_restaurar_cliente(uuid) to authenticated;

-- Substitui as políticas amplas de tabelas de negócio; views passam a respeitar RLS.
do $$ declare t record; p record; filtro text; escrita text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in ('hub_perfis','eventos_auditoria','premissas_revisoes','importacoes_lotes','conciliacoes_mensais') and rowsecurity loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t.tablename loop
   execute format('drop policy %I on public.%I',p.policyname,t.tablename);
  end loop;
  execute format('grant select on public.%I to authenticated',t.tablename);
  if t.tablename<>'propostas_versoes' then execute format('grant insert,update,delete on public.%I to authenticated',t.tablename); end if;
  filtro := 'public.fn_hub_papel() is not null';
  if t.tablename='clientes' then filtro := filtro || ' and arquivado_em is null'; end if;
  execute format('create policy hub_ler on public.%I for select to authenticated using (%s)',t.tablename,filtro);
  if t.tablename='propostas_versoes' then continue; end if;
  escrita := case when t.tablename in ('configuracoes','seguradoras','assessores') then 'public.fn_hub_papel() = ''admin''' else 'public.fn_hub_pode_escrever()' end;
  execute format('create policy hub_inserir on public.%I for insert to authenticated with check (%s)',t.tablename,escrita);
  execute format('create policy hub_alterar on public.%I for update to authenticated using (%s) with check (%s)',t.tablename,escrita,escrita);
  execute format('create policy hub_excluir on public.%I for delete to authenticated using (%s)',t.tablename,escrita);
 end loop;
 for t in select viewname from pg_views where schemaname='public' loop
  execute format('alter view public.%I set (security_invoker=true)',t.viewname);
 end loop;
 foreach filtro in array array['clientes','apolices','planejamentos','documentos','cotacoes','acompanhamentos','hub_perfis','propostas_versoes'] loop
  execute format('drop trigger if exists hub_auditar on public.%I',filtro);
  execute format('create trigger hub_auditar after insert or update or delete on public.%I for each row execute function public.fn_hub_auditar()',filtro);
 end loop;
end $$;
-- Storage: bucket privado, leitura por membro e escrita por operadores.
do $$ begin
 if to_regclass('storage.objects') is not null then
  drop policy if exists hub_docs_select on storage.objects;
  drop policy if exists hub_docs_insert on storage.objects;
  drop policy if exists hub_docs_delete on storage.objects;
  create policy hub_docs_select on storage.objects for select to authenticated using(bucket_id='documentos' and public.fn_hub_papel() is not null);
  create policy hub_docs_insert on storage.objects for insert to authenticated with check(bucket_id='documentos' and public.fn_hub_pode_escrever());
  create policy hub_docs_delete on storage.objects for delete to authenticated using(bucket_id='documentos' and public.fn_hub_pode_escrever());
 end if;
end $$;
commit;
