-- 032: propostas versionadas, operações do atendimento e indicadores coerentes.
-- Aplicar depois de 031. Reaplicável; nenhum registro de negócio é apagado.
begin;
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

commit;
