-- Atualização para instalação existente com migrações 001–031.
-- Faça backup e teste em staging antes. Execute o arquivo inteiro de uma vez.
-- O lote é atômico: qualquer erro desfaz todas as mudanças deste arquivo.
begin;
do $preflight$ begin
 if to_regprocedure('public.fn_plan_aplicar(uuid,jsonb)') is null
 or to_regclass('public.transcricoes') is null
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='planejamentos' and column_name='condicoes_declaradas') then
 raise exception 'Esta instalação precisa concluir as migrações 001–031 antes desta atualização'; end if;
 if not exists(select 1 from auth.users) then raise exception 'Crie a conta administrativa no Supabase antes da atualização'; end if;
end $preflight$;

-- 032_jornada_e_propostas.sql
-- 032: propostas versionadas, operações do atendimento e indicadores coerentes.
-- Aplicar depois de 031. Reaplicável; nenhum registro de negócio é apagado.

do $init$ begin
 if to_regprocedure('public.fn_hub_pode_escrever()') is null then
 execute $fn$create function public.fn_hub_pode_escrever() returns boolean language sql stable security definer set search_path=public as $$ select auth.uid() is not null $$ $fn$;
 end if;
end $init$;
revoke all on function public.fn_hub_pode_escrever() from public,anon;
grant execute on function public.fn_hub_pode_escrever() to authenticated;
create or replace function public.fn_hub_plano_publico(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
 select coalesce(jsonb_object_agg(e.key,case when e.key in ('dependentes','seguros_existentes','seguro_resgatavel') then
  (select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(c.key,c.value),'{}'::jsonb) from jsonb_each(case when jsonb_typeof(item)='object' then item else '{}'::jsonb end) c
    where c.key=any(case e.key when 'dependentes' then array['nome','idade','custo_mensal'] when 'seguros_existentes' then array['origem','descricao','capital','custeio'] else array['ano','resgate'] end))),'[]'::jsonb)
   from jsonb_array_elements(case when jsonb_typeof(e.value)='array' then e.value else '[]'::jsonb end) item)
  else e.value end), '{}'::jsonb)
 from jsonb_each(p) e where e.key = any(array['aliquota_ir_cliente','anos_protecao','capital_aval','capital_cirurgias','capital_doencas_graves','capital_fraturas','capital_homem_chave','capital_invalidez','capital_morte_acidental','capital_socios','capital_sugerido','cobertura_atual','comparador_alternativa','comparador_taxa_real','conjuge_nome','custas_pct','custo_vida_mensal','dependentes','dih_diaria','dih_dias','dit_diaria','dit_dias','dit_franquia_dias','dividas_prazo_anos','dividas_total','estado_civil','filhos_idades','focos','forma_pagamento','fumante','funeral_familiar','funeral_individual','herdeiros_menores','idade_aposentadoria','itcmd_pct','num_dependentes','objetivos','patrimonio_empresa','patrimonio_imoveis','patrimonio_investimentos','patrimonio_outros','patrimonio_total','patrimonio_veiculos','pj_divida_avalizada','pj_faturamento_anual','pj_lucro_anual','pj_num_socios','pj_participacao_pct','pj_razao_social','pj_valuation','premio_anual','premio_estimado','premio_temporario_mensal','previdencia_aporte_mensal','previdencia_saldo','previdencia_tipo','profissao','regime_bens','renda_desejada_aposentadoria','renda_mensal','seguro_resgatavel','seguros_existentes','tem_holding','tem_testamento','tipo_planejamento','uf','verba_sucessoria']::text[])
$$;
revoke all on function public.fn_hub_plano_publico(jsonb) from public, anon;
grant execute on function public.fn_hub_plano_publico(jsonb) to authenticated;

create table if not exists public.propostas_versoes (
 id uuid primary key default gen_random_uuid(), id_cliente uuid not null references public.clientes(id),
 versao integer not null, token uuid not null unique default gen_random_uuid(),
 cliente_nome text not null, cliente_idade integer, plano jsonb not null,
 validade timestamptz not null, revogada_em timestamptz, aprovado_por uuid,
 decisao text check(decisao in ('quero_conversar','revisar','seguir')), decisao_em timestamptz,
 created_at timestamptz not null default now(), unique(id_cliente,versao)
);
create index if not exists idx_propostas_cliente on public.propostas_versoes(id_cliente);
alter table public.propostas_versoes enable row level security;
drop policy if exists hub_propostas_leitura on public.propostas_versoes;
create policy hub_propostas_leitura on public.propostas_versoes for select to authenticated using(true);
-- Não se concede INSERT/UPDATE direto: o snapshot só nasce por RPC e permanece imutável.
grant select on public.propostas_versoes to authenticated;
revoke insert, update, delete on public.propostas_versoes from authenticated, anon;

-- Preserva os links já emitidos, agora com snapshot sanitizado e prazo de 30 dias.
insert into public.propostas_versoes(id_cliente,versao,token,cliente_nome,cliente_idade,plano,validade)
 select p.id_cliente,1,p.token_proposta,c.nome,
 extract(year from age(current_date,c.data_nascimento))::int,
 public.fn_hub_plano_publico(to_jsonb(p)), now()+interval '30 days'
 from public.planejamentos p join public.clientes c on c.id=p.id_cliente
 where not exists(select 1 from public.propostas_versoes v where v.id_cliente=p.id_cliente)
 on conflict do nothing;

create or replace function public.fn_proposta_publicar(p_cliente uuid, p_dias integer default 30,p_versao timestamptz default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c record; p record; v public.propostas_versoes;
begin
 if not public.fn_hub_pode_escrever() then raise exception 'Perfil sem permissão para alterar'; end if;
 if p_dias not between 1 and 90 then raise exception 'Validade deve ser de 1 a 90 dias'; end if;
 select * into c from clientes where id=p_cliente for update;
 if not found then raise exception 'Cliente não encontrado'; end if;
 select * into p from planejamentos where id_cliente=p_cliente;
 if not found then raise exception 'Salve o planejamento antes de publicar'; end if;
 if p_versao is not null and p.updated_at is distinct from p_versao then raise exception 'O estudo mudou desde a abertura da proposta. Reabra e confira antes de publicar'; end if;
 if exists(select 1 from cotacoes where id=(to_jsonb(p)->>'cotacao_referencia')::uuid and validade<current_date) then raise exception 'A cotação vinculada venceu. Atualize antes de publicar'; end if;
 insert into propostas_versoes(id_cliente,versao,cliente_nome,cliente_idade,plano,validade,aprovado_por)
 values(p_cliente,(select coalesce(max(versao),0)+1 from propostas_versoes where id_cliente=p_cliente),c.nome,
 extract(year from age(current_date,c.data_nascimento))::int,fn_hub_plano_publico(to_jsonb(p)) || jsonb_build_object('cotacao_publica',(select jsonb_build_object('seguradora',q.seguradora,'produto',q.produto,'data',q.data_cotacao,'validade',q.validade,'premio',q.premio,'capital',q.capital,'coberturas',q.coberturas,'exclusoes',q.exclusoes,'carencias',q.carencias,'franquias',q.franquias,'reajuste',q.reajuste) from cotacoes q where q.id=(to_jsonb(p)->>'cotacao_referencia')::uuid)),now()+make_interval(days=>p_dias),auth.uid()) returning * into v;
 return jsonb_build_object('id',v.id,'token',v.token,'versao',v.versao,'validade',v.validade);
end $$;
create or replace function public.fn_proposta_revogar(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.fn_hub_pode_escrever() then raise exception 'Perfil sem permissão para alterar'; end if;
 update propostas_versoes set revogada_em=now() where id=p_id and revogada_em is null;
 if not found then raise exception 'Proposta não encontrada ou já revogada'; end if;
end $$;
create or replace function public.fn_proposta_carregar(p_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v propostas_versoes;
begin
 select * into v from propostas_versoes where token=p_token and revogada_em is null and validade>now();
 if not found then return jsonb_build_object('erro','proposta_nao_encontrada'); end if;
 return jsonb_build_object('cliente_nome',v.cliente_nome,'cliente_idade',v.cliente_idade,'plano',v.plano,'versao',v.versao,'validade',v.validade,'decisao',v.decisao);
end $$;
create or replace function public.fn_proposta_responder(p_token uuid,p_decisao text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if p_decisao not in ('quero_conversar','revisar','seguir') then raise exception 'Escolha inválida'; end if;
 update propostas_versoes set decisao=p_decisao,decisao_em=now()
 where token=p_token and revogada_em is null and validade>now() and decisao_em is null;
 if not found then raise exception 'Resposta já registrada ou link indisponível'; end if;
 insert into tarefas(id_cliente,titulo,tipo,data_vencimento,automatica)
 select id_cliente,'Cliente respondeu à proposta: '||p_decisao,'contato',current_date,true from propostas_versoes where token=p_token;
end $$;
revoke all on function public.fn_proposta_publicar(uuid,integer,timestamptz), public.fn_proposta_revogar(uuid),public.fn_proposta_carregar(uuid),public.fn_proposta_responder(uuid,text) from public, anon;
grant execute on function public.fn_proposta_publicar(uuid,integer,timestamptz), public.fn_proposta_revogar(uuid) to authenticated;
grant execute on function public.fn_proposta_carregar(uuid),public.fn_proposta_responder(uuid,text) to anon,authenticated;

create table if not exists public.cotacoes (
 id uuid primary key default gen_random_uuid(), id_cliente uuid not null references public.clientes(id),
 seguradora text not null, produto text not null, premio numeric(14,2) not null check(premio>0),
 capital numeric(14,2) not null check(capital>0), coberturas text not null,
 exclusoes text not null, carencias text not null, franquias text not null, reajuste text not null,
 validade date not null, data_cotacao date not null default current_date,
 id_documento uuid references public.documentos(id), recomendacao text,
 created_at timestamptz not null default now(), criado_por uuid default auth.uid(),
 check(validade>=data_cotacao)
);
create table if not exists public.acompanhamentos (
 id_cliente uuid primary key references public.clientes(id),
 fase text not null default 'diagnostico' check(fase in ('preparacao','diagnostico','estudo','proposta','acompanhamento','emissao','revisao')),
 emissao text not null default 'nao_iniciada' check(emissao in ('nao_iniciada','documentacao','dps','analise','pendencia','emitida','vigente')),
 pendencia text, responsavel text, prazo date, revisao_em date,
 motivo_revisao text, renda_revisada boolean default false, familia_revisada boolean default false,
 beneficiarios_revisados boolean default false, coberturas_revisadas boolean default false,
 pagamento_confirmado boolean not null default false, id_apolice uuid references public.apolices(id),
 updated_at timestamptz not null default now(),
 check(emissao<>'vigente' or (pagamento_confirmado and id_apolice is not null)),
 check(emissao<>'pendencia' or length(trim(pendencia))>0)
);
create table if not exists public.atendimentos_registros (
 id uuid primary key, id_cliente uuid not null references public.clientes(id),
 criado_por uuid not null, created_at timestamptz not null default now()
);
create or replace function public.fn_registrar_atendimento(p_id uuid,p_cliente uuid,p_tipo text,p_resultado text,p_acao text,p_data date) returns void
language plpgsql security invoker set search_path=public as $$
begin
 if not public.fn_hub_pode_escrever() then raise exception 'Perfil sem permissão para alterar'; end if;
 if length(trim(p_resultado))=0 or length(trim(p_acao))=0 or p_data is null then raise exception 'Informe resultado, próxima ação e data'; end if;
 if p_tipo not in ('ligacao','whatsapp','email','reuniao','nota') then raise exception 'Canal inválido'; end if;
 insert into atendimentos_registros(id,id_cliente,criado_por) values(p_id,p_cliente,auth.uid()) on conflict do nothing;
 if not found then return; end if;
 insert into interacoes(id_cliente,tipo,descricao) values(p_cliente,p_tipo,p_resultado);
 insert into tarefas(id_cliente,titulo,tipo,data_vencimento,automatica) values(p_cliente,p_acao,'contato',p_data,false);
end $$;
revoke all on function public.fn_registrar_atendimento(uuid,uuid,text,text,text,date) from public,anon;
grant execute on function public.fn_registrar_atendimento(uuid,uuid,text,text,text,date) to authenticated;

do $$ declare t text; begin
 foreach t in array array['cotacoes','acompanhamentos','atendimentos_registros'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('drop policy if exists hub_operacao on public.%I',t);
 execute format('create policy hub_operacao on public.%I for all to authenticated using(true) with check(true)',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
-- Mesmo denominador do resumo por assessor: clientes fechados / decisões concluídas.
create or replace view public.vw_ranking_assessores as
select a.id,a.nome,count(ap.id) as total_vendas,
 coalesce(sum(ap.valor_premio_mensal),0) as premio_mensal_total,
 coalesce(sum(ap.comissao_gerada),0) as comissao_total,
 count(distinct c.id) as total_leads,
 case when count(distinct c.id) filter(where c.status_funil in ('fechado','perdido'))>0 then
 round(count(distinct c.id) filter(where c.status_funil='fechado')::numeric /
 count(distinct c.id) filter(where c.status_funil in ('fechado','perdido'))*100,1) else 0 end as taxa_conversao_pct
from assessores a left join clientes c on c.id_assessor=a.id left join apolices ap on ap.id_cliente=c.id
group by a.id,a.nome order by total_vendas desc,premio_mensal_total desc;

create or replace function public.fn_hub_validar_perda() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status_funil='perdido' and new.status_funil is distinct from old.status_funil and nullif(trim(new.motivo_perda),'') is null then
 raise exception 'Informe o motivo da perda'; end if;
 return new;
end $$;
drop trigger if exists hub_validar_perda on public.clientes;
create trigger hub_validar_perda before update on public.clientes for each row execute function public.fn_hub_validar_perda();

alter table public.tarefas add column if not exists origem_chave text unique;
alter table public.planejamentos add column if not exists cotacao_referencia uuid references public.cotacoes(id);
create or replace function public.fn_cotacao_aplicar(p_id uuid) returns void
language plpgsql security invoker set search_path=public as $$
declare c cotacoes;
begin
 select * into c from cotacoes where id=p_id;
 if not found or c.validade<current_date then raise exception 'Cotação não encontrada ou vencida'; end if;
 update planejamentos set premio_estimado=c.premio,premio_anual=c.premio*12,cotacao_referencia=c.id where id_cliente=c.id_cliente;
 if not found then raise exception 'Salve o planejamento antes de vincular a cotação'; end if;
end $$;
create or replace function public.fn_hub_salvar_acompanhamento(p_dados jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare a acompanhamentos;
begin
 a:=jsonb_populate_record(null::acompanhamentos,p_dados);
 if a.id_apolice is not null and not exists(select 1 from apolices where id=a.id_apolice and id_cliente=a.id_cliente and status='ativa') then
 raise exception 'Vincule uma apólice ativa deste cliente'; end if;
 insert into acompanhamentos select a.* on conflict(id_cliente) do update set
 fase=excluded.fase,emissao=excluded.emissao,pendencia=excluded.pendencia,responsavel=excluded.responsavel,prazo=excluded.prazo,
 revisao_em=excluded.revisao_em,motivo_revisao=excluded.motivo_revisao,renda_revisada=excluded.renda_revisada,familia_revisada=excluded.familia_revisada,
 beneficiarios_revisados=excluded.beneficiarios_revisados,coberturas_revisadas=excluded.coberturas_revisadas,pagamento_confirmado=excluded.pagamento_confirmado,id_apolice=excluded.id_apolice,updated_at=now();
 if a.revisao_em is not null then
 insert into tarefas(id_cliente,titulo,tipo,data_vencimento,automatica,origem_chave)
 values(a.id_cliente,'Revisar proteção: '||coalesce(a.motivo_revisao,'revisão periódica'),'contato',a.revisao_em,true,'revisao:'||a.id_cliente)
 on conflict(origem_chave) do update set titulo=excluded.titulo,data_vencimento=excluded.data_vencimento,concluida=false,concluida_em=null;
 else delete from tarefas where origem_chave='revisao:'||a.id_cliente and not concluida; end if;
 if a.prazo is not null then
 insert into tarefas(id_cliente,titulo,tipo,data_vencimento,automatica,origem_chave)
 values(a.id_cliente,'Retorno da emissão: '||coalesce(a.pendencia,'conferir situação'),'contato',a.prazo,true,'emissao:'||a.id_cliente)
 on conflict(origem_chave) do update set titulo=excluded.titulo,data_vencimento=excluded.data_vencimento,concluida=false,concluida_em=null;
 else delete from tarefas where origem_chave='emissao:'||a.id_cliente and not concluida; end if;
end $$;
revoke all on function public.fn_cotacao_aplicar(uuid), public.fn_hub_salvar_acompanhamento(jsonb) from public,anon;
grant execute on function public.fn_cotacao_aplicar(uuid), public.fn_hub_salvar_acompanhamento(jsonb) to authenticated;

-- 033_perfis_auditoria.sql
-- Aplicar após 032, com conta administradora do banco. Faça backup antes.

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

-- 034_consistencia_e_operacao.sql
-- Escritas atômicas, detecção de concorrência e observabilidade. Após 033.

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

-- 035_conciliacao_e_cadastros.sql
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

-- 036_links_e_vendas.sql
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
