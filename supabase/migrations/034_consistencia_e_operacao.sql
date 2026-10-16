-- Escritas atômicas, detecção de concorrência e observabilidade. Após 033.
begin;
create or replace function public.fn_planejamento_salvar(p_cliente uuid,p_payload jsonb,p_versao timestamptz default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare atual planejamentos; novo planejamentos; colunas text;
begin
 select * into atual from planejamentos where id_cliente=p_cliente for update;
 if found then
  if atual.updated_at is distinct from p_versao then raise exception 'Este estudo foi alterado em outra sessão. Recarregue os dados antes de salvar; preserve seu rascunho.' using errcode='40001'; end if;
 else
  if p_versao is not null then raise exception 'Planejamento não encontrado'; end if;
  insert into planejamentos(id_cliente) values(p_cliente) returning * into atual;
 end if;
 novo:=jsonb_populate_record(atual,p_payload-array['id','id_cliente','created_at','updated_at','token_proposta','cotacao_referencia']);
 if novo.premio_estimado is distinct from atual.premio_estimado then novo.cotacao_referencia:=null; end if;
 select string_agg(quote_ident(column_name),',' order by ordinal_position) into colunas
 from information_schema.columns where table_schema='public' and table_name='planejamentos'
 and column_name not in ('id','id_cliente','created_at','updated_at','token_proposta','cotacao_referencia');
 execute format('update public.planejamentos set (%s)=(select %s from jsonb_populate_record(null::public.planejamentos,$1))  ,cotacao_referencia=$3 where id_cliente=$2 returning *',colunas,colunas)
 into atual using to_jsonb(novo),p_cliente,novo.cotacao_referencia;
 return to_jsonb(atual);
end $$;
revoke all on function public.fn_planejamento_salvar(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.fn_planejamento_salvar(uuid,jsonb,timestamptz) to authenticated;

create table if not exists public.importacoes_lotes (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),autor uuid default auth.uid(),
 quantidade integer not null, substituidos integer not null default 0, fontes jsonb not null default '[]'
);
alter table importacoes_lotes enable row level security;
drop policy if exists hub_lotes_leitura on importacoes_lotes;
create policy hub_lotes_leitura on importacoes_lotes for select to authenticated using(fn_hub_papel() is not null);
drop policy if exists hub_lotes_inserir on importacoes_lotes;
create policy hub_lotes_inserir on importacoes_lotes for insert to authenticated with check(fn_hub_pode_escrever());
drop policy if exists hub_lotes_update on importacoes_lotes;
create policy hub_lotes_update on importacoes_lotes for update to authenticated using(fn_hub_pode_escrever()) with check(fn_hub_pode_escrever());
grant select,insert,update on importacoes_lotes to authenticated;
alter table comissoes_importadas add column if not exists id_lote uuid references importacoes_lotes(id);
alter table comissoes_importadas add column if not exists id_apolice uuid references apolices(id);
create or replace function public.fn_importar_comissoes(p_linhas jsonb,p_id uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare n integer; apagados integer; fontes jsonb;
begin
 if jsonb_typeof(p_linhas)<>'array' or jsonb_array_length(p_linhas)=0 or jsonb_array_length(p_linhas)>25000 then raise exception 'Lote vazio ou maior que 25.000 linhas'; end if;
 -- Serializa substituições sobre os mesmos períodos, inclusive entre usuários.
 perform pg_advisory_xact_lock(687421);
 if exists(select 1 from importacoes_lotes where id=p_id) then return jsonb_build_object('ok',0,'substituidos',0,'repetido',true,'erros','[]'::jsonb); end if;
 select jsonb_agg(distinct x->>'origem') into fontes from jsonb_array_elements(p_linhas) x;
 insert into importacoes_lotes(id,quantidade,fontes) values(p_id,jsonb_array_length(p_linhas),coalesce(fontes,'[]'::jsonb));
 delete from comissoes_importadas c using (select distinct (x->>'competencia')::date as competencia,x->>'seguradora' as seguradora,coalesce(x->>'segmento','individual') as segmento from jsonb_array_elements(p_linhas) x) k
 where c.competencia=k.competencia and c.seguradora=k.seguradora and c.segmento=k.segmento;
 get diagnostics apagados=row_count;
 insert into comissoes_importadas(competencia,seguradora,segmento,tipo_receita,cliente_nome,codigo_cliente,id_cliente,codigo_assessor,id_assessor,producao,parcela,valor,origem,id_lote)
 select (x->>'competencia')::date,x->>'seguradora',coalesce(x->>'segmento','individual'),coalesce(x->>'tipo_receita','recorrente'),x->>'cliente_nome',x->>'codigo_cliente',(x->>'id_cliente')::uuid,x->>'codigo_assessor',(x->>'id_assessor')::uuid,x->>'producao',(x->>'parcela')::int,(x->>'valor')::numeric,coalesce(x->>'origem','importador'),p_id
 from jsonb_array_elements(p_linhas) x;
 get diagnostics n=row_count;
 update importacoes_lotes set substituidos=apagados where id=p_id;
 return jsonb_build_object('ok',n,'substituidos',apagados,'erros','[]'::jsonb,'lote',p_id);
end $$;
revoke all on function public.fn_importar_comissoes(jsonb,uuid) from public,anon;
grant execute on function public.fn_importar_comissoes(jsonb,uuid) to authenticated;

create table if not exists public.premissas_revisoes (
 assunto text primary key,fonte_url text, revisado_em date,responsavel text,observacao text,
 check(fonte_url is null or fonte_url like 'https://%')
);
insert into premissas_revisoes(assunto) values('Taxas e limites de emissão'),('Premissas tributárias e sucessórias'),('Condições e exclusões dos produtos') on conflict do nothing;
alter table premissas_revisoes enable row level security;
drop policy if exists hub_premissas_ler on premissas_revisoes;
create policy hub_premissas_ler on premissas_revisoes for select to authenticated using(fn_hub_papel() is not null);
drop policy if exists hub_premissas_alterar on premissas_revisoes;
create policy hub_premissas_alterar on premissas_revisoes for update to authenticated using(fn_hub_papel()='admin') with check(fn_hub_papel()='admin');
grant select,update on premissas_revisoes to authenticated;
create or replace function public.fn_hub_status_operacao() returns jsonb
language plpgsql security definer set search_path=public as $$
declare cfg jsonb; fila jsonb; ultima jsonb;
begin
 if fn_hub_papel() is null then raise exception 'Sem acesso'; end if;
 select jsonb_build_object('ativo',outlook_sync_ativo,'ultima_sync',outlook_ultima_sync) into cfg from configuracoes limit 1;
 select jsonb_build_object('ultima_geracao',max(created_at),'pendentes',count(*) filter(where status='pendente')) into fila from fila_mensagens;
 if to_regclass('cron.job_run_details') is not null then
  execute $q$ select jsonb_build_object('status',d.status,'inicio',d.start_time,'fim',d.end_time) from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='hub-fila-mensagens-diaria' order by d.start_time desc limit 1 $q$ into ultima;
 end if;
 return jsonb_build_object('verificado_em',now(),'outlook',cfg,'mensagens',fila,'rotina_diaria',ultima);
end $$;
revoke all on function public.fn_hub_status_operacao() from public,anon;
grant execute on function public.fn_hub_status_operacao() to authenticated;

-- RPCs de integração internas respeitam o perfil; cron e service_role mantêm execução sem sessão.
do $hardening$ declare f record; definicao text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('fn_gerar_fila_diaria','fn_vincular_evento','fn_sync_evento_outlook') loop
  definicao:=pg_get_functiondef(f.oid);
  if position('Perfil sem permissão' in definicao)=0 then
   definicao:=replace(definicao,E'begin\n',E'begin\n if auth.uid() is not null and not public.fn_hub_pode_escrever() then raise exception ''Perfil sem permissão''; end if;\n');
   execute definicao;
  end if;
 end loop;
end $hardening$;
revoke all on function public.fn_gerar_fila_diaria() from public,anon;
grant execute on function public.fn_gerar_fila_diaria() to authenticated,service_role;

commit;
