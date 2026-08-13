-- ============================================================================
-- HUB SEGURO DE VIDA — SETUP COMPLETO (arquivo único)
--
-- Este arquivo junta TODAS as 25 migrações na ordem certa. Rode UMA vez, num
-- projeto Supabase NOVO (vazio), colando tudo no SQL Editor e clicando em Run.
-- Cria todas as tabelas, o cálculo de comissão, o bucket de documentos e tudo
-- mais que o Hub precisa para funcionar.
--
-- Gerado automaticamente a partir de supabase/migrations/*.sql
-- ============================================================================


-- ############################################################################
-- ### 001_schema_inicial.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Schema Inicial
-- Cliente: Natália Maschendorf (Consultoria de Seguro de Vida)
--
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Ele é idempotente onde possível, mas foi pensado para rodar em banco vazio.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TIPOS ENUM
--    Usar ENUM (em vez de texto livre) impede erros de digitação no funil e
--    garante que o Kanban sempre tenha colunas consistentes.
-- ----------------------------------------------------------------------------

create type public.status_funil as enum (
  'lead_recebido',
  'agendamento',
  'reuniao_realizada',
  'estudo_em_andamento',
  'proposta_apresentada',
  'em_analise',
  'fechado',
  'perdido'
);

create type public.status_reuniao as enum (
  'agendada',
  'realizada',
  'cancelada',
  'remarcada'
);

create type public.status_apolice as enum (
  'ativa',
  'suspensa',
  'cancelada'
);

-- ----------------------------------------------------------------------------
-- 2. FUNÇÃO UTILITÁRIA: updated_at automático
-- ----------------------------------------------------------------------------

create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. TABELAS
-- ----------------------------------------------------------------------------

-- 3.1 ASSESSORES (quem traz o lead e divide comissão)
create table public.assessores (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  telefone    text,
  email       text unique,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_assessores_updated_at
  before update on public.assessores
  for each row execute function public.fn_touch_updated_at();

-- 3.2 SEGURADORAS
create table public.seguradoras (
  id                          uuid primary key default gen_random_uuid(),
  nome                        text not null unique,
  comissao_padrao_percentual  numeric(5,2) not null default 0
                                check (comissao_padrao_percentual between 0 and 100),
  ativo                       boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger trg_seguradoras_updated_at
  before update on public.seguradoras
  for each row execute function public.fn_touch_updated_at();

-- 3.3 CLIENTES (LEADS)
--     data_entrada_etapa: atualizada por trigger sempre que o status muda.
--       É ela que alimenta o "dias parados na etapa" do Kanban.
--     data_nascimento: essencial para os alertas de aniversário (Módulo 3).
create table public.clientes (
  id                  uuid primary key default gen_random_uuid(),
  id_assessor         uuid not null references public.assessores(id) on delete restrict,
  nome                text not null,
  telefone            text,
  email               text,
  data_nascimento     date,
  status_funil        public.status_funil not null default 'lead_recebido',
  perfil_necessidade  text,
  motivo_perda        text,          -- preenchido apenas quando status = 'perdido'
  data_entrada_etapa  timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_clientes_assessor on public.clientes (id_assessor);
create index idx_clientes_status   on public.clientes (status_funil);

create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.fn_touch_updated_at();

-- Sempre que o cliente muda de etapa no funil, zera o contador de "dias parados"
-- e registra o histórico (para futuras análises de tempo médio por etapa).
create table public.historico_funil (
  id              uuid primary key default gen_random_uuid(),
  id_cliente      uuid not null references public.clientes(id) on delete cascade,
  etapa_anterior  public.status_funil,
  etapa_nova      public.status_funil not null,
  mudou_em        timestamptz not null default now()
);

create index idx_historico_funil_cliente on public.historico_funil (id_cliente);

create or replace function public.fn_registrar_mudanca_etapa()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status_funil is distinct from old.status_funil then
    new.data_entrada_etapa := now();
    insert into public.historico_funil (id_cliente, etapa_anterior, etapa_nova)
    values (new.id, old.status_funil, new.status_funil);
  elsif tg_op = 'INSERT' then
    insert into public.historico_funil (id_cliente, etapa_anterior, etapa_nova)
    values (new.id, null, new.status_funil);
  end if;
  return new;
end;
$$;

create trigger trg_clientes_mudanca_etapa_update
  before update on public.clientes
  for each row execute function public.fn_registrar_mudanca_etapa();

create trigger trg_clientes_mudanca_etapa_insert
  after insert on public.clientes
  for each row execute function public.fn_registrar_mudanca_etapa();

-- 3.4 REUNIÕES
create table public.reunioes (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  data_hora   timestamptz not null,
  notas       text,
  status      public.status_reuniao not null default 'agendada',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_reunioes_cliente   on public.reunioes (id_cliente);
create index idx_reunioes_data_hora on public.reunioes (data_hora);

create trigger trg_reunioes_updated_at
  before update on public.reunioes
  for each row execute function public.fn_touch_updated_at();

-- 3.5 APÓLICES (VENDAS)
--     comissao_gerada é calculada automaticamente por trigger:
--       prêmio mensal x 12 x percentual da apólice.
--     O percentual vem preenchido da seguradora, mas pode ser sobrescrito
--     apólice a apólice (negociações caso a caso).
create table public.apolices (
  id                   uuid primary key default gen_random_uuid(),
  id_cliente           uuid not null references public.clientes(id) on delete restrict,
  id_seguradora        uuid not null references public.seguradoras(id) on delete restrict,
  numero_apolice       text,
  valor_premio_mensal  numeric(12,2) not null check (valor_premio_mensal >= 0),
  capital_segurado     numeric(14,2) not null check (capital_segurado >= 0),
  percentual_comissao  numeric(5,2) check (percentual_comissao between 0 and 100),
  comissao_gerada      numeric(12,2),
  data_vigencia        date not null,
  status               public.status_apolice not null default 'ativa',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_apolices_cliente    on public.apolices (id_cliente);
create index idx_apolices_seguradora on public.apolices (id_seguradora);
create index idx_apolices_vigencia   on public.apolices (data_vigencia);

create trigger trg_apolices_updated_at
  before update on public.apolices
  for each row execute function public.fn_touch_updated_at();

create or replace function public.fn_calcular_comissao()
returns trigger
language plpgsql
as $$
begin
  -- Se o percentual não foi informado, herda o padrão da seguradora
  if new.percentual_comissao is null then
    select comissao_padrao_percentual
      into new.percentual_comissao
      from public.seguradoras
     where id = new.id_seguradora;
  end if;

  -- Comissão anualizada: prêmio mensal x 12 x %
  new.comissao_gerada := round(
    new.valor_premio_mensal * 12 * coalesce(new.percentual_comissao, 0) / 100, 2
  );

  return new;
end;
$$;

create trigger trg_apolices_comissao
  before insert or update of valor_premio_mensal, percentual_comissao, id_seguradora
  on public.apolices
  for each row execute function public.fn_calcular_comissao();

-- ----------------------------------------------------------------------------
-- 4. VIEWS PRONTAS PARA O FRONTEND
--    O frontend consome essas views direto, sem lógica de cálculo no React.
-- ----------------------------------------------------------------------------

-- 4.1 Kanban com dias parados na etapa
create or replace view public.vw_pipeline as
select
  c.id,
  c.nome,
  c.telefone,
  c.status_funil,
  c.perfil_necessidade,
  c.data_entrada_etapa,
  extract(day from now() - c.data_entrada_etapa)::int as dias_na_etapa,
  a.id   as id_assessor,
  a.nome as nome_assessor
from public.clientes c
join public.assessores a on a.id = c.id_assessor;

-- 4.2 Próximo aniversário (função auxiliar, trata 29/fev automaticamente)
create or replace function public.fn_proximo_aniversario(d date)
returns date
language sql
stable
as $$
  select case
    when (d + make_interval(years => extract(year from age(current_date, d))::int))::date >= current_date
      then (d + make_interval(years => extract(year from age(current_date, d))::int))::date
      else (d + make_interval(years => extract(year from age(current_date, d))::int + 1))::date
  end;
$$;

-- 4.3 Régua de Relacionamento: aniversários de cliente e de apólice nos
--     próximos 30 dias, já ordenados por urgência.
create or replace view public.vw_regua_relacionamento as
(
  select
    'aniversario_cliente'::text          as tipo_evento,
    c.id                                 as id_cliente,
    c.nome                               as nome_cliente,
    c.telefone,
    public.fn_proximo_aniversario(c.data_nascimento) as data_evento,
    (public.fn_proximo_aniversario(c.data_nascimento) - current_date) as dias_restantes
  from public.clientes c
  where c.data_nascimento is not null
)
union all
(
  select
    'aniversario_apolice',
    c.id,
    c.nome,
    c.telefone,
    public.fn_proximo_aniversario(ap.data_vigencia),
    (public.fn_proximo_aniversario(ap.data_vigencia) - current_date)
  from public.apolices ap
  join public.clientes c on c.id = ap.id_cliente
  where ap.status = 'ativa'
)
order by dias_restantes;

-- 4.4 Ranking de assessores (Top 5 é só um .limit(5) no frontend)
create or replace view public.vw_ranking_assessores as
select
  a.id,
  a.nome,
  count(ap.id)                            as total_vendas,
  coalesce(sum(ap.valor_premio_mensal),0) as premio_mensal_total,
  coalesce(sum(ap.comissao_gerada),0)     as comissao_total,
  count(distinct c.id)                    as total_leads,
  case when count(distinct c.id) > 0
    then round(count(ap.id)::numeric / count(distinct c.id) * 100, 1)
    else 0
  end                                     as taxa_conversao_pct
from public.assessores a
left join public.clientes c  on c.id_assessor = a.id
left join public.apolices ap on ap.id_cliente = c.id
group by a.id, a.nome
order by total_vendas desc, premio_mensal_total desc;

-- 4.5 Resumo mensal do dashboard (reuniões realizadas + prêmios vendidos)
create or replace view public.vw_dashboard_mensal as
select
  meses.mes,
  coalesce(r.reunioes_realizadas, 0)   as reunioes_realizadas,
  coalesce(v.apolices_vendidas, 0)     as apolices_vendidas,
  coalesce(v.premio_mensal_vendido, 0) as premio_mensal_vendido,
  coalesce(v.comissao_gerada, 0)       as comissao_gerada
from (
  select distinct date_trunc('month', data_hora)::date as mes from public.reunioes
  union
  select distinct date_trunc('month', created_at)::date from public.apolices
) meses
left join (
  select date_trunc('month', data_hora)::date as mes,
         count(*) as reunioes_realizadas
  from public.reunioes
  where status = 'realizada'
  group by 1
) r on r.mes = meses.mes
left join (
  select date_trunc('month', created_at)::date as mes,
         count(*)                 as apolices_vendidas,
         sum(valor_premio_mensal) as premio_mensal_vendido,
         sum(comissao_gerada)     as comissao_gerada
  from public.apolices
  group by 1
) v on v.mes = meses.mes
order by meses.mes desc;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
--    O sistema é de uso interno da Natália: qualquer usuário AUTENTICADO tem
--    acesso total; usuários anônimos não leem nada. Quando o login estiver
--    implementado no frontend, essas policies já funcionam sem alteração.
-- ----------------------------------------------------------------------------

alter table public.assessores       enable row level security;
alter table public.seguradoras      enable row level security;
alter table public.clientes         enable row level security;
alter table public.historico_funil  enable row level security;
alter table public.reunioes         enable row level security;
alter table public.apolices         enable row level security;

create policy "acesso_total_autenticado" on public.assessores
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.seguradoras
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.clientes
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.historico_funil
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.reunioes
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.apolices
  for all to authenticated using (true) with check (true);

-- ⚠️ FASE DE DESENVOLVIMENTO (opcional):
-- Enquanto o login não estiver implementado, o frontend usa a chave anon e as
-- policies acima vão bloquear tudo. Se quiser testar sem login, descomente o
-- bloco abaixo — e REMOVA antes de colocar em produção:
--
-- create policy "dev_acesso_anon" on public.assessores      for all to anon using (true) with check (true);
-- create policy "dev_acesso_anon" on public.seguradoras     for all to anon using (true) with check (true);
-- create policy "dev_acesso_anon" on public.clientes        for all to anon using (true) with check (true);
-- create policy "dev_acesso_anon" on public.historico_funil for all to anon using (true) with check (true);
-- create policy "dev_acesso_anon" on public.reunioes        for all to anon using (true) with check (true);
-- create policy "dev_acesso_anon" on public.apolices        for all to anon using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 6. DADOS DE EXEMPLO (opcional — descomente para popular o ambiente de teste)
-- ----------------------------------------------------------------------------
-- insert into public.seguradoras (nome, comissao_padrao_percentual) values
--   ('Prudential', 40.00),
--   ('MetLife', 35.00),
--   ('Icatu', 38.00),
--   ('Mongeral Aegon', 36.00);
--
-- insert into public.assessores (nome, telefone, email) values
--   ('Assessor Exemplo', '(41) 99999-0000', 'exemplo@escritorio.com.br');


-- ############################################################################
-- ### 002_automacao_e_planejamento.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 002: Automação, Planejamento e Onboarding
--
-- O que esta migração adiciona:
--   1. Comissão tripartida automática (Natália / Assessor / Escritório)
--   2. Planejamento financeiro do cliente (dados coletados na reunião)
--   3. Formulário de onboarding embutido (link público seguro por token)
--   4. Motor de automações: tarefas geradas sozinhas pelos triggers
--   5. Views novas para o dashboard robusto
--
-- Como usar: rode APÓS a 001, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONFIGURAÇÕES GLOBAIS (linha única — editável pelo administrador)
-- ----------------------------------------------------------------------------

create table public.configuracoes (
  id                            int primary key default 1 check (id = 1),
  -- Divisão da comissão gerada (precisa somar 100)
  split_natalia_pct             numeric(5,2) not null default 50,
  split_assessor_pct            numeric(5,2) not null default 30,
  split_escritorio_pct          numeric(5,2) not null default 20,
  -- Alertas do Kanban (dias parados na etapa)
  dias_alerta_amarelo           int not null default 5,
  dias_alerta_vermelho          int not null default 10,
  updated_at                    timestamptz not null default now(),
  constraint split_soma_100 check (
    split_natalia_pct + split_assessor_pct + split_escritorio_pct = 100
  )
);

insert into public.configuracoes (id) values (1);

create trigger trg_configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. COMISSÃO TRIPARTIDA na apólice
--    O trigger da 001 já calcula comissao_gerada; agora ele também divide
--    entre Natália, assessor e escritório conforme a configuração vigente.
-- ----------------------------------------------------------------------------

alter table public.apolices
  add column comissao_natalia    numeric(12,2),
  add column comissao_assessor   numeric(12,2),
  add column comissao_escritorio numeric(12,2);

create or replace function public.fn_calcular_comissao()
returns trigger
language plpgsql
as $$
declare
  cfg public.configuracoes%rowtype;
begin
  -- Se o percentual não foi informado, herda o padrão da seguradora
  if new.percentual_comissao is null then
    select comissao_padrao_percentual
      into new.percentual_comissao
      from public.seguradoras
     where id = new.id_seguradora;
  end if;

  -- Comissão anualizada: prêmio mensal x 12 x %
  new.comissao_gerada := round(
    new.valor_premio_mensal * 12 * coalesce(new.percentual_comissao, 0) / 100, 2
  );

  -- Divisão automática entre as três partes
  select * into cfg from public.configuracoes where id = 1;
  new.comissao_natalia    := round(new.comissao_gerada * cfg.split_natalia_pct    / 100, 2);
  new.comissao_assessor   := round(new.comissao_gerada * cfg.split_assessor_pct   / 100, 2);
  new.comissao_escritorio := round(new.comissao_gerada * cfg.split_escritorio_pct / 100, 2);

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. PLANEJAMENTO FINANCEIRO (dados coletados na reunião)
--    Um por cliente. O capital sugerido é calculado automaticamente se não
--    for informado: (custo de vida mensal x 12 x anos de proteção) + dívidas.
-- ----------------------------------------------------------------------------

create table public.planejamentos (
  id                    uuid primary key default gen_random_uuid(),
  id_cliente            uuid not null unique references public.clientes(id) on delete cascade,
  profissao             text,
  estado_civil          text,
  renda_mensal          numeric(12,2),
  custo_vida_mensal     numeric(12,2),
  patrimonio_total      numeric(14,2),
  dividas_total         numeric(14,2) default 0,
  num_dependentes       int default 0,
  dependentes           jsonb not null default '[]',  -- [{nome, idade, relacao}]
  anos_protecao         int not null default 10,
  capital_sugerido      numeric(14,2),
  objetivos             text,
  observacoes_reuniao   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_planejamentos_updated_at
  before update on public.planejamentos
  for each row execute function public.fn_touch_updated_at();

create or replace function public.fn_sugerir_capital()
returns trigger
language plpgsql
as $$
begin
  if new.capital_sugerido is null and new.custo_vida_mensal is not null then
    new.capital_sugerido :=
      new.custo_vida_mensal * 12 * new.anos_protecao + coalesce(new.dividas_total, 0);
  end if;
  return new;
end;
$$;

create trigger trg_planejamentos_capital
  before insert or update on public.planejamentos
  for each row execute function public.fn_sugerir_capital();

-- ----------------------------------------------------------------------------
-- 4. TAREFAS (o motor de automação alimenta esta tabela)
-- ----------------------------------------------------------------------------

create table public.tarefas (
  id                uuid primary key default gen_random_uuid(),
  id_cliente        uuid references public.clientes(id) on delete cascade,
  titulo            text not null,
  descricao         text,
  tipo              text not null default 'geral',
    -- 'contato' | 'agendamento' | 'planejamento' | 'formulario'
    -- | 'pos_venda' | 'revisao' | 'geral'
  data_vencimento   date not null default current_date,
  concluida         boolean not null default false,
  concluida_em      timestamptz,
  automatica        boolean not null default false,
  created_at        timestamptz not null default now()
);

create index idx_tarefas_vencimento on public.tarefas (data_vencimento) where not concluida;
create index idx_tarefas_cliente    on public.tarefas (id_cliente);

-- ----------------------------------------------------------------------------
-- 5. FORMULÁRIO DE ONBOARDING (pós-venda, preenchido pelo próprio cliente)
--    O cliente acessa por um link com token único — sem login. O acesso
--    anônimo só funciona pelas funções RPC abaixo (security definer), que
--    exigem o token correto. As respostas ficam em JSONB para o formulário
--    poder evoluir sem migração.
-- ----------------------------------------------------------------------------

create type public.status_formulario as enum ('pendente', 'em_andamento', 'concluido');

create table public.formularios_onboarding (
  id            uuid primary key default gen_random_uuid(),
  id_cliente    uuid not null references public.clientes(id) on delete cascade,
  token         uuid not null unique default gen_random_uuid(),
  status        public.status_formulario not null default 'pendente',
  etapa_atual   int not null default 0,
  respostas     jsonb not null default '{}',
  enviado_em    timestamptz not null default now(),
  iniciado_em   timestamptz,
  concluido_em  timestamptz,
  updated_at    timestamptz not null default now()
);

create index idx_formularios_cliente on public.formularios_onboarding (id_cliente);

create trigger trg_formularios_updated_at
  before update on public.formularios_onboarding
  for each row execute function public.fn_touch_updated_at();

-- RPC pública: carrega o formulário pelo token (o cliente só vê o dele)
create or replace function public.fn_form_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  select fo.id, fo.status, fo.etapa_atual, fo.respostas,
         split_part(c.nome, ' ', 1) as primeiro_nome
    into f
    from public.formularios_onboarding fo
    join public.clientes c on c.id = fo.id_cliente
   where fo.token = p_token;

  if not found then
    return jsonb_build_object('erro', 'formulario_nao_encontrado');
  end if;

  if f.status = 'pendente' then
    update public.formularios_onboarding
       set status = 'em_andamento', iniciado_em = now()
     where token = p_token;
  end if;

  return jsonb_build_object(
    'status', f.status,
    'etapa_atual', f.etapa_atual,
    'respostas', f.respostas,
    'primeiro_nome', f.primeiro_nome
  );
end;
$$;

-- RPC pública: salva o progresso (autosave a cada etapa — o cliente nunca
-- perde o que já preencheu, mesmo fechando o navegador)
create or replace function public.fn_form_salvar(
  p_token uuid,
  p_respostas jsonb,
  p_etapa int,
  p_concluido boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cliente uuid;
begin
  select id, id_cliente into v_id, v_cliente
    from public.formularios_onboarding
   where token = p_token and status <> 'concluido';

  if not found then
    return jsonb_build_object('erro', 'formulario_nao_encontrado_ou_concluido');
  end if;

  update public.formularios_onboarding
     set respostas   = p_respostas,
         etapa_atual = p_etapa,
         status      = case when p_concluido then 'concluido'::public.status_formulario
                            else 'em_andamento'::public.status_formulario end,
         concluido_em = case when p_concluido then now() else null end
   where id = v_id;

  -- Automação: formulário concluído gera tarefa de conferência para a Natália
  if p_concluido then
    insert into public.tarefas (id_cliente, titulo, tipo, automatica)
    values (v_cliente,
            'Conferir formulário preenchido e emitir apólice na seguradora',
            'formulario', true);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Apenas as RPCs ficam expostas ao público anônimo — a tabela em si, não.
revoke all on function public.fn_form_carregar(uuid) from public;
revoke all on function public.fn_form_salvar(uuid, jsonb, int, boolean) from public;
grant execute on function public.fn_form_carregar(uuid) to anon, authenticated;
grant execute on function public.fn_form_salvar(uuid, jsonb, int, boolean) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. MOTOR DE AUTOMAÇÕES (triggers que tiram trabalho manual da Natália)
-- ----------------------------------------------------------------------------

-- Ordem das etapas do funil (para saber o que é "avançar")
create or replace function public.fn_ordem_etapa(e public.status_funil)
returns int
language sql
immutable
as $$
  select case e
    when 'lead_recebido'        then 1
    when 'agendamento'          then 2
    when 'reuniao_realizada'    then 3
    when 'estudo_em_andamento'  then 4
    when 'proposta_apresentada' then 5
    when 'em_analise'           then 6
    when 'fechado'              then 7
    when 'perdido'              then 8
  end;
$$;

-- 6.1 Novo lead cadastrado → tarefa de primeiro contato no dia seguinte
create or replace function public.fn_auto_novo_lead()
returns trigger
language plpgsql
as $$
begin
  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id, 'Fazer primeiro contato com ' || new.nome,
          'contato', current_date + 1, true);
  return new;
end;
$$;

create trigger trg_auto_novo_lead
  after insert on public.clientes
  for each row execute function public.fn_auto_novo_lead();

-- 6.2 Reunião agendada → cliente avança sozinho para "Agendamento"
create or replace function public.fn_auto_reuniao_agendada()
returns trigger
language plpgsql
as $$
begin
  update public.clientes
     set status_funil = 'agendamento'
   where id = new.id_cliente
     and public.fn_ordem_etapa(status_funil) < public.fn_ordem_etapa('agendamento');
  return new;
end;
$$;

create trigger trg_auto_reuniao_agendada
  after insert on public.reunioes
  for each row
  when (new.status = 'agendada')
  execute function public.fn_auto_reuniao_agendada();

-- 6.3 Reunião marcada como realizada → cliente avança para "Reunião Realizada"
--     + tarefa de montar o estudo em até 2 dias
create or replace function public.fn_auto_reuniao_realizada()
returns trigger
language plpgsql
as $$
begin
  update public.clientes
     set status_funil = 'reuniao_realizada'
   where id = new.id_cliente
     and public.fn_ordem_etapa(status_funil) < public.fn_ordem_etapa('reuniao_realizada');

  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id_cliente,
          'Montar estudo/planejamento com os dados coletados na reunião',
          'planejamento', current_date + 2, true);
  return new;
end;
$$;

create trigger trg_auto_reuniao_realizada
  after update on public.reunioes
  for each row
  when (old.status is distinct from new.status and new.status = 'realizada')
  execute function public.fn_auto_reuniao_realizada();

-- 6.4 Apólice cadastrada (VENDA!) → tudo acontece sozinho:
--     cliente vira "Fechado", formulário de onboarding é criado,
--     e as tarefas de pós-venda entram na régua.
create or replace function public.fn_auto_venda_fechada()
returns trigger
language plpgsql
as $$
begin
  update public.clientes
     set status_funil = 'fechado'
   where id = new.id_cliente
     and status_funil <> 'fechado';

  insert into public.formularios_onboarding (id_cliente) values (new.id_cliente);

  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica) values
    (new.id_cliente, 'Enviar link do formulário de onboarding ao cliente',
     'formulario', current_date, true),
    (new.id_cliente, 'Mensagem de boas-vindas + confirmar recebimento da apólice',
     'pos_venda', current_date + 7, true),
    (new.id_cliente, 'Revisão anual da apólice (reajuste/novas necessidades)',
     'revisao', new.data_vigencia + interval '11 months', true);

  return new;
end;
$$;

create trigger trg_auto_venda_fechada
  after insert on public.apolices
  for each row execute function public.fn_auto_venda_fechada();

-- ----------------------------------------------------------------------------
-- 7. VIEWS NOVAS PARA O DASHBOARD ROBUSTO
-- ----------------------------------------------------------------------------

-- 7.1 Comissões mensais já divididas entre as três partes
create or replace view public.vw_comissoes_mensal as
select
  date_trunc('month', created_at)::date as mes,
  count(*)                        as apolices,
  sum(valor_premio_mensal)        as premio_mensal_total,
  sum(comissao_gerada)            as comissao_total,
  sum(comissao_natalia)           as comissao_natalia,
  sum(comissao_assessor)          as comissao_assessor,
  sum(comissao_escritorio)        as comissao_escritorio
from public.apolices
group by 1
order by 1 desc;

-- 7.2 Contagem do funil (visão macro do pipeline)
create or replace view public.vw_funil_contagem as
select
  status_funil,
  public.fn_ordem_etapa(status_funil) as ordem,
  count(*) as total
from public.clientes
group by status_funil
order by ordem;

-- 7.3 Central do Dia: tudo que precisa de ação AGORA, num lugar só.
--     Tarefas pendentes/atrasadas + aniversários próximos (7 dias)
--     + leads estagnados além do limite configurado.
create or replace view public.vw_central_dia as
(
  select
    'tarefa'::text                        as tipo,
    t.id                                  as id_item,
    t.id_cliente,
    c.nome                                as nome_cliente,
    c.telefone,
    t.titulo,
    t.data_vencimento                     as data_ref,
    (t.data_vencimento < current_date)    as atrasado
  from public.tarefas t
  left join public.clientes c on c.id = t.id_cliente
  where not t.concluida
    and t.data_vencimento <= current_date + 3
)
union all
(
  select
    'aniversario',
    r.id_cliente,
    r.id_cliente,
    r.nome_cliente,
    r.telefone,
    case r.tipo_evento
      when 'aniversario_cliente' then 'Aniversário de ' || r.nome_cliente || ' 🎂'
      else 'Aniversário da apólice de ' || r.nome_cliente
    end,
    r.data_evento,
    false
  from public.vw_regua_relacionamento r
  where r.dias_restantes <= 7
)
union all
(
  select
    'lead_parado',
    p.id,
    p.id,
    p.nome,
    p.telefone,
    p.nome || ' está há ' || p.dias_na_etapa || ' dias parado em "' || p.status_funil || '"',
    current_date,
    true
  from public.vw_pipeline p
  cross join public.configuracoes cfg
  where p.dias_na_etapa >= cfg.dias_alerta_vermelho
    and p.status_funil not in ('fechado', 'perdido')
)
order by atrasado desc, data_ref;

-- ----------------------------------------------------------------------------
-- 8. RLS DAS NOVAS TABELAS
-- ----------------------------------------------------------------------------

alter table public.configuracoes           enable row level security;
alter table public.planejamentos           enable row level security;
alter table public.tarefas                 enable row level security;
alter table public.formularios_onboarding  enable row level security;

create policy "acesso_total_autenticado" on public.configuracoes
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.planejamentos
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.tarefas
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.formularios_onboarding
  for all to authenticated using (true) with check (true);


-- ############################################################################
-- ### 003_metas_mensagens_relatorios.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 003: Metas, Mensagens Automáticas e Relatórios
--
-- O que esta migração adiciona:
--   1. Metas mensais (prêmio, reuniões, apólices) com acompanhamento no dashboard
--   2. Fila de mensagens automáticas (aniversários, reativação de leads parados)
--      gerada todo dia pelo banco — com pg_cron, sem depender de ninguém clicar
--   3. Views de relatórios: comissão a pagar por assessor, motivos de perda,
--      tempo médio em cada etapa do funil, KPIs gerais e agenda de reuniões
--   4. Lista inicial de seguradoras (ajuste os percentuais em Cadastros!)
--
-- Como usar: rode APÓS a 001 e a 002, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. METAS MENSAIS (editáveis em Cadastros)
-- ----------------------------------------------------------------------------

alter table public.configuracoes
  add column meta_premio_mensal    numeric(12,2) not null default 0,
  add column meta_reunioes_mensal  int not null default 0,
  add column meta_apolices_mensal  int not null default 0;

-- ----------------------------------------------------------------------------
-- 2. FILA DE MENSAGENS AUTOMÁTICAS
--    O banco gera as mensagens prontas (texto incluído); a Central de Mensagens
--    do sistema mostra tudo com botão de WhatsApp de 1 clique. Com o pg_cron
--    ativo, a fila se abastece sozinha todos os dias às 8h.
-- ----------------------------------------------------------------------------

create type public.status_mensagem as enum ('pendente', 'enviada', 'descartada');

create table public.fila_mensagens (
  id           uuid primary key default gen_random_uuid(),
  id_cliente   uuid references public.clientes(id) on delete cascade,
  tipo         text not null,
    -- 'aniversario_cliente' | 'aniversario_apolice' | 'lead_parado' | 'manual'
  telefone     text,
  mensagem     text not null,
  data_alvo    date not null default current_date,
  status       public.status_mensagem not null default 'pendente',
  enviada_em   timestamptz,
  created_at   timestamptz not null default now()
);

create unique index idx_fila_sem_duplicata
  on public.fila_mensagens (id_cliente, tipo, data_alvo);
create index idx_fila_pendentes on public.fila_mensagens (status) where status = 'pendente';

alter table public.fila_mensagens enable row level security;
create policy "acesso_total_autenticado" on public.fila_mensagens
  for all to authenticated using (true) with check (true);

-- Gera as mensagens do dia. Retorna quantas foram criadas.
-- Idempotente: rodar duas vezes no mesmo dia não duplica nada.
create or replace function public.fn_gerar_fila_diaria()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  criadas int := 0;
  inseriu int;
  r record;
begin
  -- Aniversários de clientes HOJE
  for r in
    select c.id, c.nome, c.telefone
      from public.clientes c
     where c.data_nascimento is not null
       and public.fn_proximo_aniversario(c.data_nascimento) = current_date
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'aniversario_cliente', r.telefone,
      'Olá ' || split_part(r.nome, ' ', 1) ||
      '! 🎉 Passando para te desejar um feliz aniversário! Que seja um ano cheio de saúde e conquistas. Um abraço, Natália.')
    on conflict do nothing;
    get diagnostics inseriu = row_count;
    criadas := criadas + inseriu;
  end loop;

  -- Aniversários de apólice HOJE (momento ideal de revisão/upsell)
  for r in
    select distinct c.id, c.nome, c.telefone
      from public.apolices a
      join public.clientes c on c.id = a.id_cliente
     where a.status = 'ativa'
       and public.fn_proximo_aniversario(a.data_vigencia) = current_date
       and a.data_vigencia < current_date
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'aniversario_apolice', r.telefone,
      'Olá ' || split_part(r.nome, ' ', 1) ||
      '! Sua apólice está completando mais um ano 🎉 Que tal marcarmos uma conversa rápida para revisar se a proteção continua ideal para o seu momento? Abraço, Natália.')
    on conflict do nothing;
    get diagnostics inseriu = row_count;
    criadas := criadas + inseriu;
  end loop;

  -- Leads parados além do alerta vermelho (reativação — no máximo 1 pendente por cliente)
  for r in
    select p.id, p.nome, p.telefone
      from public.vw_pipeline p
      cross join public.configuracoes cfg
     where p.dias_na_etapa >= cfg.dias_alerta_vermelho
       and p.status_funil not in ('fechado', 'perdido')
       and not exists (
         select 1 from public.fila_mensagens f
          where f.id_cliente = p.id and f.tipo = 'lead_parado' and f.status = 'pendente'
       )
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'lead_parado', r.telefone,
      'Olá ' || split_part(r.nome, ' ', 1) ||
      '! Aqui é a Natália 😊 Estava organizando minha agenda e lembrei de você. Podemos retomar nossa conversa sobre a sua proteção? Tenho um horário livre esta semana.')
    on conflict do nothing;
    get diagnostics inseriu = row_count;
    criadas := criadas + inseriu;
  end loop;

  return criadas;
end;
$$;

revoke all on function public.fn_gerar_fila_diaria() from public;
grant execute on function public.fn_gerar_fila_diaria() to authenticated;

-- Agendamento diário automático às 08:00 (extensão pg_cron).
-- No Supabase: Database → Extensions → habilite "pg_cron" antes de rodar.
-- Se a extensão não estiver disponível, esta parte apenas avisa e segue —
-- o botão "Gerar mensagens de hoje" na Central de Mensagens faz o mesmo papel.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'hub-fila-mensagens-diaria',
    '0 8 * * *',
    $cron$ select public.fn_gerar_fila_diaria(); $cron$
  );
  raise notice 'pg_cron agendado: fila de mensagens gerada todo dia às 08:00.';
exception when others then
  raise notice 'pg_cron indisponível (%). Use o botão "Gerar mensagens de hoje" na Central de Mensagens.', sqlerrm;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. VIEWS DE RELATÓRIOS GERENCIAIS
-- ----------------------------------------------------------------------------

-- 3.1 Comissão a pagar por assessor, mês a mês (relatório de fechamento)
create or replace view public.vw_comissoes_assessor_mensal as
select
  date_trunc('month', ap.created_at)::date as mes,
  a.id   as id_assessor,
  a.nome as nome_assessor,
  count(ap.id)                     as vendas,
  sum(ap.valor_premio_mensal)      as premio_mensal_total,
  sum(ap.comissao_assessor)        as comissao_a_pagar
from public.apolices ap
join public.clientes c  on c.id = ap.id_cliente
join public.assessores a on a.id = c.id_assessor
group by 1, a.id, a.nome
order by 1 desc, comissao_a_pagar desc;

-- 3.2 Motivos de perda (onde o funil está vazando)
create or replace view public.vw_motivos_perda as
select
  coalesce(nullif(trim(motivo_perda), ''), '(sem motivo registrado)') as motivo,
  count(*) as total
from public.clientes
where status_funil = 'perdido'
group by 1
order by total desc;

-- 3.3 Tempo médio em cada etapa (do histórico automático do funil)
create or replace view public.vw_tempo_medio_etapa as
with duracoes as (
  select
    h.etapa_nova as etapa,
    extract(epoch from (
      lead(h.mudou_em) over (partition by h.id_cliente order by h.mudou_em) - h.mudou_em
    )) / 86400.0 as dias
  from public.historico_funil h
)
select
  etapa,
  public.fn_ordem_etapa(etapa) as ordem,
  round(avg(dias)::numeric, 1) as dias_medios,
  count(*)                     as passagens
from duracoes
where dias is not null
group by etapa
order by ordem;

-- 3.4 KPIs gerais (linha única para o dashboard)
create or replace view public.vw_kpis_gerais as
select
  (select count(*) from public.clientes)                                          as total_clientes,
  (select count(*) from public.clientes where status_funil = 'fechado')           as total_fechados,
  (select count(*) from public.clientes where status_funil = 'perdido')           as total_perdidos,
  case when (select count(*) from public.clientes where status_funil in ('fechado','perdido')) > 0
    then round(
      (select count(*) from public.clientes where status_funil = 'fechado')::numeric
      / (select count(*) from public.clientes where status_funil in ('fechado','perdido')) * 100, 1)
    else 0 end                                                                    as taxa_conversao_pct,
  (select round(avg(valor_premio_mensal), 2) from public.apolices)                as ticket_medio_premio,
  (select round(avg(extract(epoch from (h.mudou_em - c.created_at)) / 86400.0)::numeric, 1)
     from public.historico_funil h
     join public.clientes c on c.id = h.id_cliente
    where h.etapa_nova = 'fechado')                                               as dias_medios_ate_fechar,
  (select coalesce(sum(capital_segurado), 0) from public.apolices
    where status = 'ativa')                                                       as capital_total_carteira;

-- 3.5 Agenda de reuniões (com dados do cliente prontos)
create or replace view public.vw_agenda_reunioes as
select
  r.id,
  r.data_hora,
  r.status,
  r.notas,
  c.id       as id_cliente,
  c.nome     as nome_cliente,
  c.telefone,
  c.status_funil,
  a.nome     as nome_assessor
from public.reunioes r
join public.clientes c   on c.id = r.id_cliente
join public.assessores a on a.id = c.id_assessor;

-- ----------------------------------------------------------------------------
-- 4. LISTA INICIAL DE SEGURADORAS
--    ⚠️ Percentuais são valores de mercado APROXIMADOS apenas para começar —
--    AJUSTE cada um no módulo Cadastros antes de registrar vendas!
-- ----------------------------------------------------------------------------

insert into public.seguradoras (nome, comissao_padrao_percentual) values
  ('Prudential do Brasil', 40.00),
  ('MAG Seguros (Mongeral Aegon)', 40.00),
  ('Icatu Seguros', 35.00),
  ('MetLife', 35.00),
  ('Omint Seguros', 30.00),
  ('SulAmérica', 30.00),
  ('Bradesco Vida e Previdência', 30.00),
  ('Porto Seguro Vida', 30.00),
  ('Azos', 30.00),
  ('Unimed Seguros', 30.00)
on conflict (nome) do nothing;

-- ----------------------------------------------------------------------------
-- 5. SUPORTE À IMPORTAÇÃO DE DADOS HISTÓRICOS (planilhas)
--    Registros marcados como importados NÃO disparam as automações de novo
--    lead / nova venda — evita gerar tarefas e formulários para dados antigos.
-- ----------------------------------------------------------------------------

alter table public.clientes add column importado boolean not null default false;
alter table public.apolices add column importada boolean not null default false;

create or replace function public.fn_auto_novo_lead()
returns trigger
language plpgsql
as $$
begin
  if new.importado then
    return new;  -- dado histórico: sem tarefa de primeiro contato
  end if;
  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id, 'Fazer primeiro contato com ' || new.nome,
          'contato', current_date + 1, true);
  return new;
end;
$$;

create or replace function public.fn_auto_venda_fechada()
returns trigger
language plpgsql
as $$
begin
  -- Mesmo importada, a apólice fecha o cliente no funil (estado verdadeiro)
  update public.clientes
     set status_funil = 'fechado'
   where id = new.id_cliente
     and status_funil <> 'fechado';

  if new.importada then
    return new;  -- dado histórico: sem formulário nem régua de boas-vindas
  end if;

  insert into public.formularios_onboarding (id_cliente) values (new.id_cliente);

  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica) values
    (new.id_cliente, 'Enviar link do formulário de onboarding ao cliente',
     'formulario', current_date, true),
    (new.id_cliente, 'Mensagem de boas-vindas + confirmar recebimento da apólice',
     'pos_venda', current_date + 7, true),
    (new.id_cliente, 'Revisão anual da apólice (reajuste/novas necessidades)',
     'revisao', new.data_vigencia + interval '11 months', true);

  return new;
end;
$$;


-- ############################################################################
-- ### 004_codigos_e_inteligencia.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 004: Códigos e Priorização Inteligente
--
-- O que esta migração adiciona:
--   1. Código do escritório em clientes e assessores (identificador externo)
--   2. Motor de priorização (lead scoring) + "Próxima Melhor Ação" por cliente:
--      o sistema calcula sozinho quais leads estão quentes e o que fazer em cada
--   3. View de busca global (clientes + assessores por nome/código/telefone)
--
-- Como usar: rode APÓS as migrações 001, 002 e 003.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CÓDIGOS DO ESCRITÓRIO
--    Opcionais (dados históricos podem não ter), mas únicos quando preenchidos.
-- ----------------------------------------------------------------------------

alter table public.assessores add column codigo text;
alter table public.clientes   add column codigo text;

create unique index idx_assessores_codigo on public.assessores (codigo) where codigo is not null;
create unique index idx_clientes_codigo   on public.clientes (codigo)   where codigo is not null;

-- ----------------------------------------------------------------------------
-- 2. MOTOR DE PRIORIZAÇÃO INTELIGENTE + PRÓXIMA MELHOR AÇÃO
--    Para cada lead ativo, o sistema decide sozinho:
--      - qual a próxima ação concreta (baseado na etapa e no que já existe)
--      - uma nota de prioridade (score) combinando urgência, valor e momento
--      - uma classificação: quente / morno / frio
--    Assim a Natália sempre sabe por quem começar o dia.
-- ----------------------------------------------------------------------------

create or replace view public.vw_prioridades as
select
  c.id,
  c.nome,
  c.codigo,
  c.telefone,
  c.status_funil,
  a.nome                as nome_assessor,
  p.dias_na_etapa,
  pl.capital_sugerido,
  prox.data_hora        as proxima_reuniao,

  -- Próxima Melhor Ação (Next Best Action)
  case
    when c.status_funil = 'lead_recebido'
      then 'Fazer 1º contato e agendar reunião'
    when c.status_funil = 'agendamento' and prox.data_hora is not null
      then 'Reunião marcada — confirmar presença'
    when c.status_funil = 'agendamento'
      then 'Agendar a reunião'
    when c.status_funil = 'reuniao_realizada'
      then 'Montar o estudo/planejamento'
    when c.status_funil = 'estudo_em_andamento' and pl.id is not null
      then 'Gerar e apresentar a proposta'
    when c.status_funil = 'estudo_em_andamento'
      then 'Preencher o planejamento da reunião'
    when c.status_funil = 'proposta_apresentada'
      then 'Fazer follow-up da proposta'
    when c.status_funil = 'em_analise'
      then 'Retomar contato para fechar'
    else 'Acompanhar'
  end as proxima_acao,

  -- Score de prioridade: etapa (quanto mais perto de fechar, mais quente)
  -- + urgência (dias parado) + valor potencial (capital) + momento (reunião marcada)
  round(
    public.fn_ordem_etapa(c.status_funil) * 8
    + least(p.dias_na_etapa, 30)
    + least(coalesce(pl.capital_sugerido, 0) / 100000.0, 25)
    + case when prox.data_hora is not null then 10 else 0 end
  , 1) as score

from public.clientes c
join public.vw_pipeline p on p.id = c.id
join public.assessores a  on a.id = c.id_assessor
left join public.planejamentos pl on pl.id_cliente = c.id
left join lateral (
  select min(r.data_hora) as data_hora
    from public.reunioes r
   where r.id_cliente = c.id
     and r.status = 'agendada'
     and r.data_hora >= now()
) prox on true
where c.status_funil not in ('fechado', 'perdido')
order by score desc;

-- Classificação quente/morno/frio: uma view fina em cima da anterior,
-- para o frontend só ler o rótulo pronto.
create or replace view public.vw_prioridades_classificadas as
select
  *,
  case
    when score >= 55 then 'quente'
    when score >= 32 then 'morno'
    else 'frio'
  end as temperatura
from public.vw_prioridades;

-- ----------------------------------------------------------------------------
-- 3. BUSCA GLOBAL (clientes + assessores num só lugar)
--    Alimenta a barra de busca do topo do sistema.
-- ----------------------------------------------------------------------------

create or replace view public.vw_busca_global as
(
  select
    'cliente'::text as tipo,
    c.id,
    c.nome,
    c.codigo,
    c.telefone,
    c.status_funil::text as detalhe
  from public.clientes c
)
union all
(
  select
    'assessor'::text,
    a.id,
    a.nome,
    a.codigo,
    a.telefone,
    case when a.ativo then 'ativo' else 'inativo' end
  from public.assessores a
);


-- ############################################################################
-- ### 005_documentos.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 005: Documentos e Anexos
--
-- Guarda arquivos por cliente (apólice em PDF, documentos, propostas...).
-- Os arquivos ficam no Storage do Supabase (bucket privado "documentos");
-- esta tabela guarda os metadados e o vínculo com o cliente.
--
-- Como usar: rode APÓS as migrações 001–004.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELA DE METADADOS DOS DOCUMENTOS
-- ----------------------------------------------------------------------------

create table public.documentos (
  id             uuid primary key default gen_random_uuid(),
  id_cliente     uuid not null references public.clientes(id) on delete cascade,
  nome           text not null,                    -- nome original do arquivo
  categoria      text not null default 'geral',    -- 'apolice' | 'documento' | 'proposta' | 'geral'
  caminho        text not null,                    -- caminho do arquivo no Storage
  tamanho_bytes  bigint,
  tipo_mime      text,
  created_at     timestamptz not null default now()
);

create index idx_documentos_cliente on public.documentos (id_cliente);

alter table public.documentos enable row level security;
create policy "acesso_total_autenticado" on public.documentos
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 2. BUCKET DE STORAGE + POLÍTICAS (específico do Supabase)
--    Envolvido em bloco protegido: se o schema "storage" não existir (ex.: ao
--    testar em Postgres puro) ou as políticas já existirem, apenas avisa.
-- ----------------------------------------------------------------------------

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('documentos', 'documentos', false)
  on conflict (id) do nothing;

  execute $p$ create policy "hub_docs_select" on storage.objects
             for select to authenticated using (bucket_id = 'documentos') $p$;
  execute $p$ create policy "hub_docs_insert" on storage.objects
             for insert to authenticated with check (bucket_id = 'documentos') $p$;
  execute $p$ create policy "hub_docs_delete" on storage.objects
             for delete to authenticated using (bucket_id = 'documentos') $p$;

  raise notice 'Bucket "documentos" e políticas de acesso criados.';
exception
  when duplicate_object then
    raise notice 'Políticas de storage já existiam — ok.';
  when others then
    raise notice 'Storage indisponível aqui (%). No Supabase real isso funciona; se precisar, crie o bucket privado "documentos" pelo painel Storage.', sqlerrm;
end $$;


-- ############################################################################
-- ### 006_crm_interacoes_carteira.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 006: Interações, Retenção e Carteira
--
-- O que esta migração adiciona:
--   1. Registro de interações por cliente (linha do tempo de contatos)
--   2. "Último contato" e alerta de clientes ativos esquecidos (retenção)
--   3. Mensagens automáticas com TEXTOS EDITÁVEIS + lembrete de reunião amanhã
--   4. Follow-up automático quando a proposta é apresentada
--   5. Views de carteira para o pós-venda (receita recorrente, por seguradora)
--
-- Como usar: rode APÓS as migrações 001–005.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. INTERAÇÕES (linha do tempo de contatos do cliente)
-- ----------------------------------------------------------------------------

create table public.interacoes (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null default 'nota',   -- 'ligacao'|'whatsapp'|'email'|'reuniao'|'nota'
  descricao   text not null,
  data        timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_interacoes_cliente on public.interacoes (id_cliente, data desc);

alter table public.interacoes enable row level security;
create policy "acesso_total_autenticado" on public.interacoes
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 2. ÚLTIMO CONTATO + DIAS SEM CONTATO (por cliente)
--    Considera interações registradas E reuniões realizadas.
-- ----------------------------------------------------------------------------

create or replace view public.vw_clientes_contato as
select
  c.id,
  c.nome,
  c.codigo,
  c.telefone,
  c.status_funil,
  lc.ultimo_contato,
  case when lc.ultimo_contato is null then null
       else (current_date - lc.ultimo_contato::date) end as dias_sem_contato
from public.clientes c
left join lateral (
  select max(d) as ultimo_contato from (
    select data      as d from public.interacoes where id_cliente = c.id
    union all
    select data_hora as d from public.reunioes  where id_cliente = c.id and status = 'realizada'
  ) x
) lc on true;

-- Limite (em dias) para considerar um cliente ativo "esquecido"
alter table public.configuracoes
  add column dias_sem_contato_alerta int not null default 90;

-- Clientes com apólice ativa que não têm contato há mais que o limite.
create or replace view public.vw_clientes_sem_contato as
select
  cc.id,
  cc.nome,
  cc.codigo,
  cc.telefone,
  cc.ultimo_contato,
  cc.dias_sem_contato
from public.vw_clientes_contato cc
cross join public.configuracoes cfg
where exists (
  select 1 from public.apolices a where a.id_cliente = cc.id and a.status = 'ativa'
)
and (cc.dias_sem_contato is null or cc.dias_sem_contato >= cfg.dias_sem_contato_alerta)
order by cc.dias_sem_contato desc nulls first;

-- ----------------------------------------------------------------------------
-- 3. MENSAGENS AUTOMÁTICAS EDITÁVEIS
--    Os textos saem de configuracoes; use {nome} e {quando} como marcadores.
-- ----------------------------------------------------------------------------

alter table public.configuracoes
  add column msg_aniversario         text not null default 'Olá {nome}! 🎉 Passando para te desejar um feliz aniversário! Que seja um ano cheio de saúde e conquistas. Um abraço, Natália.',
  add column msg_aniversario_apolice text not null default 'Olá {nome}! Sua apólice está completando mais um ano 🎉 Que tal marcarmos uma conversa rápida para revisar se a proteção continua ideal para o seu momento? Abraço, Natália.',
  add column msg_lead_parado         text not null default 'Olá {nome}! Aqui é a Natália 😊 Estava organizando minha agenda e lembrei de você. Podemos retomar nossa conversa sobre a sua proteção? Tenho um horário livre esta semana.',
  add column msg_reuniao             text not null default 'Olá {nome}! Passando para confirmar nossa reunião de {quando}. Até lá! Abraço, Natália.';

-- Recria o gerador diário usando os textos editáveis + lembrete de reunião.
create or replace function public.fn_gerar_fila_diaria()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  criadas int := 0;
  inseriu int;
  cfg public.configuracoes%rowtype;
  r record;
begin
  select * into cfg from public.configuracoes where id = 1;

  -- Aniversários de clientes HOJE
  for r in
    select c.id, c.nome, c.telefone
      from public.clientes c
     where c.data_nascimento is not null
       and public.fn_proximo_aniversario(c.data_nascimento) = current_date
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'aniversario_cliente', r.telefone,
            replace(cfg.msg_aniversario, '{nome}', split_part(r.nome, ' ', 1)))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  -- Aniversários de apólice HOJE
  for r in
    select distinct c.id, c.nome, c.telefone
      from public.apolices a
      join public.clientes c on c.id = a.id_cliente
     where a.status = 'ativa'
       and public.fn_proximo_aniversario(a.data_vigencia) = current_date
       and a.data_vigencia < current_date
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'aniversario_apolice', r.telefone,
            replace(cfg.msg_aniversario_apolice, '{nome}', split_part(r.nome, ' ', 1)))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  -- Leads parados além do alerta vermelho
  for r in
    select p.id, p.nome, p.telefone
      from public.vw_pipeline p
     where p.dias_na_etapa >= cfg.dias_alerta_vermelho
       and p.status_funil not in ('fechado', 'perdido')
       and not exists (
         select 1 from public.fila_mensagens f
          where f.id_cliente = p.id and f.tipo = 'lead_parado' and f.status = 'pendente'
       )
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'lead_parado', r.telefone,
            replace(cfg.msg_lead_parado, '{nome}', split_part(r.nome, ' ', 1)))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  -- Lembrete de reuniões marcadas para AMANHÃ (confirmação)
  for r in
    select distinct c.id, c.nome, c.telefone,
           min(re.data_hora) as quando
      from public.reunioes re
      join public.clientes c on c.id = re.id_cliente
     where re.status = 'agendada'
       and re.data_hora::date = current_date + 1
     group by c.id, c.nome, c.telefone
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'reuniao_lembrete', r.telefone,
            replace(replace(cfg.msg_reuniao, '{nome}', split_part(r.nome, ' ', 1)),
                    '{quando}', to_char(r.quando, 'DD/MM "às" HH24:MI')))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  return criadas;
end;
$$;

revoke all on function public.fn_gerar_fila_diaria() from public;
grant execute on function public.fn_gerar_fila_diaria() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. FOLLOW-UP AUTOMÁTICO DA PROPOSTA
--    Ao entrar em "Proposta Apresentada", cria tarefa de retorno em 3 dias.
-- ----------------------------------------------------------------------------

create or replace function public.fn_auto_proposta()
returns trigger
language plpgsql
as $$
begin
  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id, 'Follow-up da proposta com ' || new.nome,
          'pos_venda', current_date + 3, true);
  return new;
end;
$$;

create trigger trg_auto_proposta
  after update on public.clientes
  for each row
  when (old.status_funil is distinct from new.status_funil
        and new.status_funil = 'proposta_apresentada')
  execute function public.fn_auto_proposta();

-- ----------------------------------------------------------------------------
-- 5. VIEWS DE CARTEIRA (pós-venda)
-- ----------------------------------------------------------------------------

create or replace view public.vw_carteira as
select
  count(*)                                   as apolices_ativas,
  coalesce(sum(valor_premio_mensal), 0)      as receita_mensal_recorrente,
  coalesce(sum(valor_premio_mensal) * 12, 0) as receita_anualizada,
  coalesce(sum(capital_segurado), 0)         as capital_total,
  coalesce(sum(comissao_natalia), 0)         as comissao_natalia_carteira,
  coalesce(round(avg(valor_premio_mensal), 2), 0) as ticket_medio
from public.apolices
where status = 'ativa';

create or replace view public.vw_carteira_seguradora as
select
  s.nome,
  count(a.id)                            as apolices,
  coalesce(sum(a.valor_premio_mensal),0) as premio_mensal,
  coalesce(sum(a.capital_segurado),0)    as capital_total
from public.apolices a
join public.seguradoras s on s.id = a.id_seguradora
where a.status = 'ativa'
group by s.nome
order by premio_mensal desc;


-- ############################################################################
-- ### 007_assessor_conversao_duplicados.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 007: Assessor 360, Conversão e Duplicados
--
--   1. Resumo por assessor (leads, conversão, apólices, comissão a receber)
--   2. Conversão mês a mês (leads criados x fechados) para gráfico de tendência
--   3. Detector de clientes possivelmente duplicados (por telefone)
--
-- Como usar: rode APÓS as migrações 001–006.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RESUMO POR ASSESSOR (base da página Assessor 360)
-- ----------------------------------------------------------------------------

create or replace view public.vw_assessor_resumo as
select
  a.id,
  a.nome,
  a.codigo,
  a.telefone,
  a.email,
  a.ativo,
  count(distinct c.id)                                                         as total_leads,
  count(distinct c.id) filter (where c.status_funil = 'fechado')              as fechados,
  count(distinct c.id) filter (where c.status_funil = 'perdido')              as perdidos,
  count(distinct c.id) filter (where c.status_funil not in ('fechado','perdido')) as em_andamento,
  case when count(distinct c.id) filter (where c.status_funil in ('fechado','perdido')) > 0
    then round(
      count(distinct c.id) filter (where c.status_funil = 'fechado')::numeric
      / count(distinct c.id) filter (where c.status_funil in ('fechado','perdido')) * 100, 1)
    else 0 end                                                                 as taxa_conversao_pct,
  count(ap.id)                                                                 as apolices,
  coalesce(sum(ap.valor_premio_mensal), 0)                                     as premio_mensal_total,
  coalesce(sum(ap.comissao_assessor), 0)                                       as comissao_assessor_total
from public.assessores a
left join public.clientes c  on c.id_assessor = a.id
left join public.apolices ap on ap.id_cliente = c.id
group by a.id, a.nome, a.codigo, a.telefone, a.email, a.ativo;

-- ----------------------------------------------------------------------------
-- 2. CONVERSÃO MÊS A MÊS (leads criados x fechados)
-- ----------------------------------------------------------------------------

create or replace view public.vw_conversao_mensal as
with base as (
  select date_trunc('month', created_at)::date as mes, count(*) as leads_criados
  from public.clientes group by 1
),
fech as (
  select date_trunc('month', mudou_em)::date as mes, count(*) as fechados
  from public.historico_funil where etapa_nova = 'fechado' group by 1
)
select
  coalesce(b.mes, f.mes)          as mes,
  coalesce(b.leads_criados, 0)    as leads_criados,
  coalesce(f.fechados, 0)         as fechados
from base b
full outer join fech f on b.mes = f.mes
order by mes desc;

-- ----------------------------------------------------------------------------
-- 3. CLIENTES POSSIVELMENTE DUPLICADOS (mesmo telefone)
--    Útil antes de importar planilhas — evita cadastro repetido.
-- ----------------------------------------------------------------------------

create or replace view public.vw_possiveis_duplicados as
select
  regexp_replace(coalesce(telefone, ''), '\D', '', 'g') as fone,
  count(*)                as qtd,
  string_agg(nome, ' | ' order by nome) as clientes
from public.clientes
where length(regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) >= 8
group by 1
having count(*) > 1;


-- ############################################################################
-- ### 008_integracao_outlook.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 008: Integração com a Agenda do Outlook
--
-- Traz as reuniões da agenda da Natália (Microsoft 365) para o Hub, mão única.
-- A "ponte" (Edge Function) lê o Outlook via Microsoft Graph e, para cada
-- evento, chama fn_sync_evento_outlook aqui. A lógica de casar o evento com o
-- cliente certo mora no banco:
--   - Se algum PARTICIPANTE do evento tem e-mail igual ao de um cliente →
--     cria/atualiza a reunião automaticamente (e o funil avança sozinho).
--   - Se não casar → o evento fica numa CAIXA DE ENTRADA para a Natália
--     vincular ao cliente com 1 clique (ou ignorar, se não for de cliente).
--
-- Como usar: rode APÓS as migrações 001–007.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONFIGURAÇÃO DA INTEGRAÇÃO
-- ----------------------------------------------------------------------------

alter table public.configuracoes
  add column outlook_email       text,                    -- caixa de e-mail da Natália (UPN)
  add column outlook_sync_ativo  boolean not null default false,
  add column outlook_ultima_sync timestamptz;

-- Marca a origem das reuniões (manual x importada do Outlook)
alter table public.reunioes
  add column origem text not null default 'manual';       -- 'manual' | 'outlook'

-- ----------------------------------------------------------------------------
-- 2. EVENTOS VINDOS DO OUTLOOK (staging + caixa de entrada)
-- ----------------------------------------------------------------------------

create table public.agenda_externa (
  id             uuid primary key default gen_random_uuid(),
  outlook_id     text not null unique,       -- id do evento no Outlook (evita duplicar)
  assunto        text,
  inicio         timestamptz not null,
  fim            timestamptz,
  organizador    text,
  participantes  jsonb not null default '[]',
  id_cliente     uuid references public.clientes(id) on delete set null,
  id_reuniao     uuid references public.reunioes(id) on delete set null,
  status         text not null default 'nova',  -- 'nova' | 'vinculada' | 'ignorada'
  sincronizado_em timestamptz not null default now()
);

create index idx_agenda_externa_status on public.agenda_externa (status);

alter table public.agenda_externa enable row level security;
create policy "acesso_total_autenticado" on public.agenda_externa
  for all to authenticated using (true) with check (true);

-- Caixa de entrada: eventos ainda não vinculados a um cliente
create or replace view public.vw_agenda_externa_pendentes as
select id, outlook_id, assunto, inicio, fim, organizador, participantes, sincronizado_em
from public.agenda_externa
where status = 'nova'
order by inicio;

-- ----------------------------------------------------------------------------
-- 3. FUNÇÃO CHAMADA PELA PONTE (Edge Function) A CADA EVENTO
--    Faz upsert do evento e tenta casar com um cliente pelo e-mail.
-- ----------------------------------------------------------------------------

create or replace function public.fn_sync_evento_outlook(
  p_outlook_id    text,
  p_assunto       text,
  p_inicio        timestamptz,
  p_fim           timestamptz,
  p_organizador   text,
  p_emails        text[]        -- e-mails dos participantes
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente public.agenda_externa%rowtype;
  v_id_cliente uuid;
  v_id_reuniao uuid;
begin
  -- tenta casar por e-mail de participante = e-mail de cliente
  select id into v_id_cliente
    from public.clientes
   where email is not null
     and lower(email) = any (select lower(x) from unnest(p_emails) as x)
   limit 1;

  select * into v_existente from public.agenda_externa where outlook_id = p_outlook_id;

  -- JÁ EXISTE: atualiza dados; se estava vinculada, reflete no horário da reunião
  if found then
    update public.agenda_externa
       set assunto = p_assunto, inicio = p_inicio, fim = p_fim,
           organizador = p_organizador, participantes = to_jsonb(p_emails),
           sincronizado_em = now()
     where outlook_id = p_outlook_id;

    if v_existente.status = 'vinculada' and v_existente.id_reuniao is not null then
      update public.reunioes set data_hora = p_inicio, notas = p_assunto
       where id = v_existente.id_reuniao;
    end if;
    return v_existente.status;
  end if;

  -- NOVO evento
  if v_id_cliente is not null then
    -- casou com cliente → cria a reunião (o gatateway do funil avança sozinho)
    insert into public.reunioes (id_cliente, data_hora, notas, origem)
    values (v_id_cliente, p_inicio, p_assunto, 'outlook')
    returning id into v_id_reuniao;

    insert into public.agenda_externa
      (outlook_id, assunto, inicio, fim, organizador, participantes, id_cliente, id_reuniao, status)
    values
      (p_outlook_id, p_assunto, p_inicio, p_fim, p_organizador, to_jsonb(p_emails), v_id_cliente, v_id_reuniao, 'vinculada');
    return 'vinculada';
  else
    -- não casou → caixa de entrada
    insert into public.agenda_externa
      (outlook_id, assunto, inicio, fim, organizador, participantes, status)
    values
      (p_outlook_id, p_assunto, p_inicio, p_fim, p_organizador, to_jsonb(p_emails), 'nova');
    return 'nova';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. VINCULAR MANUALMENTE um evento da caixa de entrada a um cliente
-- ----------------------------------------------------------------------------

create or replace function public.fn_vincular_evento(
  p_evento_id  uuid,
  p_cliente_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev public.agenda_externa%rowtype;
  v_id_reuniao uuid;
begin
  select * into v_ev from public.agenda_externa where id = p_evento_id;
  if not found then raise exception 'evento não encontrado'; end if;

  insert into public.reunioes (id_cliente, data_hora, notas, origem)
  values (p_cliente_id, v_ev.inicio, v_ev.assunto, 'outlook')
  returning id into v_id_reuniao;

  update public.agenda_externa
     set id_cliente = p_cliente_id, id_reuniao = v_id_reuniao, status = 'vinculada'
   where id = p_evento_id;
end;
$$;

grant execute on function public.fn_sync_evento_outlook(text, text, timestamptz, timestamptz, text, text[]) to authenticated, service_role;
grant execute on function public.fn_vincular_evento(uuid, uuid) to authenticated;


-- ############################################################################
-- ### 009_comissoes_importadas.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 009: Comissões importadas das seguradoras
--
-- O que esta migração adiciona:
--   1. Tabela comissoes_importadas: cada linha de comissão vinda das planilhas
--      mensais das seguradoras (Azos, Icatu, MAG, Omint...), já normalizada
--      pelo importador — valores, competência, produção (Nati/Bruno), assessor
--      e tipo de receita (recorrente × venda nova × campanha).
--   2. View vw_comissoes_importadas_resumo: fechamento por competência,
--      seguradora e produção, pronta para os Relatórios.
--
-- Regra de negócio: as planilhas chegam com a produção da Natália E do Bruno
-- juntas. Nada é excluído — a coluna "producao" separa. Estornos entram com
-- valor negativo e já saem abatidos dos totais.
--
-- Como usar: rode APÓS a 008, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create table public.comissoes_importadas (
  id               uuid primary key default gen_random_uuid(),
  competencia      date not null,            -- sempre dia 1º do mês (2026-05-01)
  seguradora       text not null,            -- nome normalizado (Azos, Icatu, MAG...)
  segmento         text not null default 'individual',
    -- 'individual' | 'empresarial' | 'campanha'
  tipo_receita     text not null default 'recorrente',
    -- 'recorrente' | 'venda_nova' | 'campanha'
  cliente_nome     text not null,
  codigo_cliente   text,
  id_cliente       uuid references public.clientes(id) on delete set null,
  codigo_assessor  text,
  id_assessor      uuid references public.assessores(id) on delete set null,
  producao         text,                     -- 'Nati' | 'Bruno' | null (a classificar)
  parcela          int,
  valor            numeric(12,2) not null,   -- negativo = estorno
  origem           text not null default 'planilha',  -- arquivo/planilha de origem
  criado_em        timestamptz not null default now()
);

create index idx_comissoes_importadas_competencia
  on public.comissoes_importadas (competencia, seguradora);
create index idx_comissoes_importadas_assessor
  on public.comissoes_importadas (id_assessor);

alter table public.comissoes_importadas enable row level security;
create policy "acesso_total_autenticado" on public.comissoes_importadas
  for all to authenticated using (true) with check (true);

-- Fechamento mensal: uma linha por competência × seguradora × produção × receita
create or replace view public.vw_comissoes_importadas_resumo as
select
  competencia,
  seguradora,
  coalesce(producao, 'A classificar') as producao,
  tipo_receita,
  count(*)                            as lancamentos,
  count(distinct cliente_nome)        as clientes,
  sum(valor)                          as total
from public.comissoes_importadas
group by competencia, seguradora, coalesce(producao, 'A classificar'), tipo_receita;


-- ############################################################################
-- ### 010_meta_comissao_recebida.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 010: Meta de comissão recebida
--
-- Adiciona a meta mensal de comissão RECEBIDA das seguradoras (o que de fato
-- entra, medido pelas planilhas importadas) — as metas anteriores eram de
-- prêmio vendido/reuniões/apólices. Editável em Cadastros; acompanhada no
-- card "Metas do mês" do Dashboard.
--
-- Como usar: rode APÓS a 009, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.configuracoes
  add column meta_comissao_mensal numeric(12,2) not null default 0;


-- ############################################################################
-- ### 011_fechamento_liquido.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 011: Fechamento líquido por assessor × seguradora
--
-- Regra de negócio definida pela usuária (jul/2026):
--   1. As planilhas das seguradoras chegam com a comissão BRUTA.
--   2. Sobre a bruta sai o imposto do escritório: 20%.
--   3. O líquido é dividido: 40% especialista (Natália na produção dela,
--      Bruno na dele), 30% escritório e 30% assessor que indicou.
--   4. O financeiro recebe o bruto; o Hub mostra o líquido para a Natália
--      ter o controle do que ela de fato ganha em cada mês.
--   5. A própria Natália também atua como assessora: código CS8868 —
--      nas vendas indicadas por ela, os 30% do assessor também são dela.
--
-- O que esta migração faz:
--   1. configuracoes: adiciona imposto_pct (20) e codigo_natalia (CS8868)
--      e ajusta a divisão para 40/30/30 (antes 50/30/20).
--   2. View vw_fechamento_assessor_seguradora: o fechamento do financeiro
--      direto do banco — competência × assessor × seguradora com bruto,
--      imposto, líquido e as três partes já calculadas.
--
-- Como usar: rode APÓS a 010, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.configuracoes
  add column if not exists imposto_pct    numeric(5,2) not null default 20,
  add column if not exists codigo_natalia text not null default 'CS8868';

-- Divisão oficial do escritório sobre o LÍQUIDO (pós-imposto): 40/30/30
update public.configuracoes
   set split_natalia_pct    = 40,
       split_assessor_pct   = 30,
       split_escritorio_pct = 30,
       imposto_pct          = 20,
       codigo_natalia       = 'CS8868'
 where id = 1;

-- ----------------------------------------------------------------------------
-- Fechamento por assessor × seguradora, com a cascata bruto → imposto →
-- líquido → divisão. "Especialista" = 40% de quem produziu (Nati ou Bruno,
-- conforme a coluna producao das linhas agregadas).
-- ----------------------------------------------------------------------------
create or replace view public.vw_fechamento_assessor_seguradora as
select
  c.competencia,
  coalesce(c.codigo_assessor, '(sem código)')                            as codigo_assessor,
  c.seguradora,
  string_agg(distinct c.producao, '/' order by c.producao)               as producao,
  count(*)                                                               as lancamentos,
  count(distinct c.cliente_nome)                                         as clientes,
  coalesce(sum(c.valor) filter (where c.valor < 0), 0)                   as estornos,
  sum(c.valor) filter (where c.tipo_receita = 'recorrente')              as bruto_recorrente,
  sum(c.valor) filter (where c.tipo_receita = 'venda_nova')              as bruto_venda_nova,
  sum(c.valor) filter (where c.tipo_receita = 'campanha')                as bruto_campanha,
  round(sum(c.valor), 2)                                                 as comissao_bruta,
  round(sum(c.valor) * cfg.imposto_pct / 100, 2)                         as imposto,
  round(sum(c.valor) * (100 - cfg.imposto_pct) / 100, 2)                 as base_liquida,
  round(sum(c.valor) * (100 - cfg.imposto_pct) / 100
        * cfg.split_natalia_pct / 100, 2)                                as parte_especialista,
  round(sum(c.valor) * (100 - cfg.imposto_pct) / 100
        * cfg.split_escritorio_pct / 100, 2)                             as parte_escritorio,
  round(sum(c.valor) * (100 - cfg.imposto_pct) / 100
        * cfg.split_assessor_pct / 100, 2)                               as parte_assessor
from public.comissoes_importadas c
cross join public.configuracoes cfg
where cfg.id = 1
group by c.competencia, coalesce(c.codigo_assessor, '(sem código)'), c.seguradora,
         cfg.imposto_pct, cfg.split_natalia_pct, cfg.split_escritorio_pct, cfg.split_assessor_pct;


-- ############################################################################
-- ### 012_historico_apolices.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 012: Histórico completo de apólices
--
-- Contexto: a planilha geral do escritório (registro-mestre desde 2023) traz
-- apólices INATIVAS com o motivo do cancelamento. Para o Hub servir de
-- histórico de atendimento — e ajudar o pós-venda a entender por que um
-- cliente saiu — o cadastro precisa guardar esse motivo.
--
-- As automações de pós-venda (aniversário de apólice, revisão, mensagens)
-- já filtram status = 'ativa', então apólices canceladas importadas ficam
-- só como memória: nada dispara para elas.
--
-- Como usar: rode APÓS a 011, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.apolices
  add column if not exists motivo_cancelamento text;

comment on column public.apolices.motivo_cancelamento is
  'Preenchido quando status = cancelada — vem da planilha geral (histórico) ou da edição manual';


-- ############################################################################
-- ### 013_tipo_produto_apolice.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 013: Tipo de produto da apólice
--
-- Contexto: a planilha geral classifica cada apólice por produto
-- (Seguro Temporário, Vitalício, Resgatável, RC, D&O, VG, AP, Empresarial...).
-- Guardar isso no cadastro dá o histórico completo do que cada cliente tem —
-- essencial para o pós-venda e a renovação (um temporário vence, um vitalício
-- não; um RC é empresarial).
--
-- Como usar: rode APÓS a 012, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.apolices
  add column if not exists tipo_produto text;

comment on column public.apolices.tipo_produto is
  'Produto da apólice (Seguro Temporário, Vitalício, Resgatável, RC, D&O...) — vem da planilha geral ou do cadastro manual';


-- ############################################################################
-- ### 014_planejamento_detalhado.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 014: Planejamento detalhado (5 pilares)
--
-- O estudo de proteção deixa de ser um número único e passa a cobrir os
-- cinco pilares clássicos da consultoria de vida + o cálculo de sucessão:
--
--   1. Morte (renda familiar + dívidas)  → capital_sugerido (já existia)
--   2. Invalidez permanente (IPTA)       → capital_invalidez
--   3. Doenças graves                    → capital_doencas_graves
--   4. Incapacidade temporária (DIT)     → dit_diaria (R$/dia)
--   5. Sucessão / blindagem patrimonial  → verba_sucessoria
--      (custo de inventário: patrimônio × (ITCMD % + custas/honorários %))
--
-- Também guarda o que o cliente JÁ tem de cobertura (cobertura_atual) para
-- o estudo mostrar o GAP — argumento central da apresentação.
--
-- Como usar: rode APÓS a 013, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  add column if not exists capital_invalidez      numeric(14,2),
  add column if not exists capital_doencas_graves numeric(14,2),
  add column if not exists dit_diaria             numeric(12,2),
  add column if not exists verba_sucessoria       numeric(14,2),
  add column if not exists cobertura_atual        numeric(14,2) default 0,
  add column if not exists itcmd_pct              numeric(5,2) default 4,
  add column if not exists custas_pct             numeric(5,2) default 8,
  add column if not exists conjuge_nome           text,
  add column if not exists filhos_idades          text;  -- ex.: "3, 7 e 12 anos"

comment on column public.planejamentos.capital_invalidez is
  'Pilar invalidez (IPTA). Sugestão do sistema: mesmo capital da morte';
comment on column public.planejamentos.capital_doencas_graves is
  'Pilar doenças graves. Sugestão: 24× renda mensal (2 anos de tratamento)';
comment on column public.planejamentos.dit_diaria is
  'Diária por incapacidade temporária (R$/dia). Sugestão: renda ÷ 30 — essencial para autônomos e liberais';
comment on column public.planejamentos.verba_sucessoria is
  'Liquidez para inventário. Sugestão: patrimônio × (ITCMD + custas)';
comment on column public.planejamentos.cobertura_atual is
  'Seguro de vida que o cliente já possui — o estudo mostra o gap';
comment on column public.planejamentos.itcmd_pct is
  'Alíquota de ITCMD do estado (RS 6, PR 4, SC 8 progressivo... padrão 4)';
comment on column public.planejamentos.custas_pct is
  'Custas judiciais + honorários do inventário (tipicamente 6–12%)';


-- ############################################################################
-- ### 015_cotacao_proposta.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 015: Cotação no planejamento
--
-- A proposta que fecha negócio termina falando de INVESTIMENTO, não de
-- capital. Esta migração guarda o prêmio cotado pela consultora junto às
-- seguradoras — com ele, a apresentação ganha o slide "O investimento":
-- valor por mês, por dia, % da renda e quanto cada R$ 1 protege.
--
-- Como usar: rode APÓS a 014, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  add column if not exists premio_estimado numeric(12,2);

comment on column public.planejamentos.premio_estimado is
  'Prêmio mensal cotado nas seguradoras para o plano completo — alimenta o slide "O investimento" da proposta';


-- ############################################################################
-- ### 016_filhos_custo_mensal.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 016: Filhos com gasto mensal (até os 24)
--
-- O planejamento agora detalha CADA filho: nome, idade e quanto ele custa
-- por mês hoje (escola, saúde, atividades...). A regra do estudo:
--
--   • O gasto com o filho SÓ existe até ele completar 24 anos (fim da
--     faculdade). O capital de proteção reserva exatamente
--     custo_mensal × 12 × (24 − idade) por filho — nem um real a mais.
--   • O custo de vida informado JÁ inclui os filhos; o cálculo separa o
--     gasto deles para não projetá-lo pelo horizonte inteiro do estudo.
--
-- Nenhuma coluna nova: usa a coluna jsonb `dependentes` que existe desde a
-- migração 002 (estava sem uso). Formato de cada item:
--   { "nome": "Lucas", "idade": 9, "custo_mensal": 3500 }
--
-- Esta migração só documenta o formato e garante o default. É segura de
-- rodar a qualquer momento (idempotente).
-- ============================================================================

alter table public.planejamentos
  alter column dependentes set default '[]'::jsonb;

comment on column public.planejamentos.dependentes is
  'Filhos do cliente: [{nome, idade, custo_mensal}]. O estudo garante o custo_mensal de cada um apenas até os 24 anos — depois disso o valor sai do capital de proteção';


-- ############################################################################
-- ### 017_proposta_publica.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 017: Proposta por link público
--
-- A proposta deixa de ser só uma apresentação de reunião: cada planejamento
-- ganha um token e a rota pública /p/<token> mostra os slides para o CLIENTE,
-- sem login — a consultora copia o link (ou manda direto pelo WhatsApp) e o
-- cliente revê o estudo em casa, no celular, na hora de decidir.
--
-- Segurança no mesmo padrão do formulário público (migração 002):
--   • o acesso anônimo NÃO lê a tabela — só a função RPC security definer;
--   • o token é um uuid aleatório: sem ele, nada aparece;
--   • a função expõe apenas o planejamento e o primeiro nome do cliente
--     (nenhum telefone, e-mail ou dado de outros clientes).
--
-- Como usar: rode APÓS a 016, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  add column if not exists token_proposta uuid not null default gen_random_uuid();

create unique index if not exists idx_planejamentos_token_proposta
  on public.planejamentos (token_proposta);

comment on column public.planejamentos.token_proposta is
  'Token do link público da proposta (/p/<token>) — o cliente vê os slides sem login';

create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*, c.nome as cliente_nome
    into r
    from public.planejamentos p
    join public.clientes c on c.id = p.id_cliente
   where p.token_proposta = p_token;

  if not found then
    return jsonb_build_object('erro', 'proposta_nao_encontrada');
  end if;

  return jsonb_build_object(
    'cliente_nome', r.cliente_nome,
    -- o plano inteiro, menos os identificadores internos
    'plano', to_jsonb(r) - 'cliente_nome' - 'id' - 'id_cliente' - 'token_proposta'
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;


-- ############################################################################
-- ### 018_roteiro_reuniao.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 018: Roteiro de reunião (script guiado)
--
-- A consultora conduz a reunião DENTRO da plataforma: um roteiro consultivo
-- por blocos (abertura → descoberta → dores → educação → solução → fechamento),
-- cada um com pontos de fala sugeridos, um "feito" e um campo de anotação.
-- Fica salvo no planejamento do cliente, junto do estudo — assim o histórico
-- da conversa vive ao lado dos números.
--
-- Formato da coluna jsonb `roteiro`:
--   {
--     "blocos": { "abertura": { "feito": true, "nota": "..." }, ... },
--     "atualizado_em": "2026-08-04T14:00:00Z"
--   }
--
-- Como usar: rode APÓS a 017, colando o arquivo inteiro no SQL Editor.
-- Segura de rodar a qualquer momento (idempotente).
-- ============================================================================

alter table public.planejamentos
  add column if not exists roteiro jsonb not null default '{}'::jsonb;

comment on column public.planejamentos.roteiro is
  'Roteiro consultivo da reunião: {blocos: {id: {feito, nota}}} — o script que a consultora segue e anota durante o encontro';


-- ############################################################################
-- ### 019_planejamento_completo.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 019: Planejamento completo
--
-- O planejamento deixa de ser "renda, custo de vida e patrimônio num número
-- só" e passa a ser uma CONSTRUÇÃO DE APÓLICE de verdade, com três frentes:
--
--   1. RAIO-X DO PATRIMÔNIO
--      O patrimônio é decomposto por classe (imóveis, investimentos, empresa,
--      veículos, outros) + previdência. Isso muda o estudo em dois pontos:
--        • Previdência (VGBL/PGBL) NÃO passa por inventário — vai direto ao
--          beneficiário, como o seguro. Não pode entrar na base do ITCMD.
--        • Só investimentos e previdência são LÍQUIDOS. Imóveis e empresa não
--          pagam o inventário: é aí que nasce o déficit de liquidez, o
--          argumento mais forte da consultoria de sucessão.
--
--   2. TIPO DE PLANEJAMENTO (PF, PJ ou os dois) + FOCOS
--      Um plano de sucessão não é o mesmo que um plano de renda familiar nem
--      que um acordo de sócios. Os focos escolhidos definem quais capítulos a
--      proposta apresenta e quais coberturas o estudo sugere.
--
--   3. PLANEJAMENTO EMPRESARIAL (PJ)
--      • Acordo de sócios (buy-sell): valuation × participação — dinheiro para
--        os sócios comprarem a quota da família, em vez de virar sócio da
--        viúva.
--      • Homem-chave: o lucro que a empresa perde enquanto se reorganiza.
--      • Dívidas avalizadas: o aval do sócio ALCANÇA o patrimônio pessoal —
--        morrer não cancela o aval, ele vira dívida do espólio.
--
-- E a apólice ganha as coberturas que faltavam (morte acidental, fraturas,
-- diária de internação hospitalar e assistência funeral individual/familiar),
-- além do PRÊMIO ANUAL — o cliente tem o direito de escolher entre pagar por
-- mês ou de uma vez com desconto.
--
-- Como usar: rode APÓS a 018, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- ── 1. Tipo de planejamento e focos ────────────────────────────────────────
  add column if not exists tipo_planejamento text default 'pf',
  add column if not exists focos             jsonb not null default '[]'::jsonb,

  -- ── 2. Composição do patrimônio ────────────────────────────────────────────
  add column if not exists patrimonio_imoveis        numeric(14,2),
  add column if not exists patrimonio_investimentos  numeric(14,2),
  add column if not exists patrimonio_empresa        numeric(14,2),
  add column if not exists patrimonio_veiculos       numeric(14,2),
  add column if not exists patrimonio_outros         numeric(14,2),
  add column if not exists previdencia_saldo         numeric(14,2),
  add column if not exists previdencia_tipo          text,
  add column if not exists previdencia_aporte_mensal numeric(12,2),
  add column if not exists regime_bens               text,
  add column if not exists tem_holding               boolean default false,
  add column if not exists tem_testamento            boolean default false,
  add column if not exists herdeiros_menores         boolean default false,

  -- ── 3. Planejamento empresarial (PJ) ───────────────────────────────────────
  add column if not exists pj_razao_social      text,
  add column if not exists pj_valuation         numeric(14,2),
  add column if not exists pj_participacao_pct  numeric(5,2),
  add column if not exists pj_num_socios        int,
  add column if not exists pj_faturamento_anual numeric(14,2),
  add column if not exists pj_lucro_anual       numeric(14,2),
  add column if not exists pj_divida_avalizada  numeric(14,2),
  add column if not exists capital_socios       numeric(14,2),
  add column if not exists capital_homem_chave  numeric(14,2),
  add column if not exists capital_aval         numeric(14,2),

  -- ── 4. Coberturas que faltavam na apólice ──────────────────────────────────
  add column if not exists capital_morte_acidental numeric(14,2),
  add column if not exists capital_fraturas        numeric(14,2),
  add column if not exists dih_diaria              numeric(12,2),
  add column if not exists dih_dias                int,
  add column if not exists dit_dias                int,
  add column if not exists dit_franquia_dias       int,
  add column if not exists funeral_individual      numeric(12,2),
  add column if not exists funeral_familiar        numeric(12,2),

  -- ── 5. Prêmio: mensal E anual (o cliente escolhe) ──────────────────────────
  add column if not exists premio_anual    numeric(12,2),
  add column if not exists forma_pagamento text default 'mensal';

comment on column public.planejamentos.tipo_planejamento is
  'pf | pj | pf_pj — define se o estudo cobre a pessoa física, a empresa ou as duas frentes';
comment on column public.planejamentos.focos is
  'Focos do planejamento: ["renda","educacao","dividas","sucessao","blindagem","empresarial","aposentadoria"]. Definem quais capítulos a proposta apresenta';

comment on column public.planejamentos.patrimonio_investimentos is
  'Aplicações financeiras — a única parte do patrimônio que paga o inventário sem vender bens';
comment on column public.planejamentos.patrimonio_empresa is
  'Valor das participações societárias (entra no inventário e é o ativo mais ilíquido de todos)';
comment on column public.planejamentos.previdencia_saldo is
  'Saldo de VGBL/PGBL. NÃO entra no inventário nem na base do ITCMD na maioria dos estados: vai direto ao beneficiário indicado, como o seguro de vida';
comment on column public.planejamentos.previdencia_tipo is
  'VGBL | PGBL | ambos';
comment on column public.planejamentos.regime_bens is
  'Regime de bens do casamento — muda quem herda o quê (meação vs herança)';
comment on column public.planejamentos.tem_holding is
  'Já possui holding familiar? Reduz custas do inventário, mas não elimina o ITCMD nem a necessidade de liquidez';
comment on column public.planejamentos.herdeiros_menores is
  'Herdeiros menores de idade: o inventário vira judicial obrigatoriamente (mais lento e mais caro)';

comment on column public.planejamentos.pj_valuation is
  'Valor de mercado da empresa — base do capital do acordo de sócios (buy-sell)';
comment on column public.planejamentos.pj_participacao_pct is
  'Participação do cliente no capital social (%)';
comment on column public.planejamentos.pj_divida_avalizada is
  'Dívidas da empresa avalizadas pelo sócio — o aval alcança o patrimônio pessoal e não morre com ele';
comment on column public.planejamentos.capital_socios is
  'Capital do acordo de sócios. Sugestão: valuation × participação — os sócios compram a quota da família à vista';
comment on column public.planejamentos.capital_homem_chave is
  'Capital homem-chave. Sugestão: 2× o lucro anual — o fôlego para a empresa se reorganizar';
comment on column public.planejamentos.capital_aval is
  'Capital para quitar as dívidas avalizadas antes que alcancem o patrimônio da família';

comment on column public.planejamentos.capital_morte_acidental is
  'Morte acidental (MA): indeniza ADICIONALMENTE ao capital de morte quando a causa é acidente. Sugestão: 100% do capital de morte';
comment on column public.planejamentos.capital_fraturas is
  'Capital de fraturas — indenização proporcional por fratura, conforme tabela da seguradora';
comment on column public.planejamentos.dih_diaria is
  'Diária por Internação Hospitalar (DIH) — valor por dia internado';
comment on column public.planejamentos.dih_dias is
  'Limite de diárias de internação por evento/ano (tipicamente 30 a 365)';
comment on column public.planejamentos.dit_dias is
  'Limite de diárias da DIT (incapacidade temporária), tipicamente 90 a 730';
comment on column public.planejamentos.dit_franquia_dias is
  'Franquia da DIT: dias de afastamento antes de a diária começar a contar (tipicamente 15 ou 30)';
comment on column public.planejamentos.funeral_individual is
  'Assistência funeral do titular — reembolso/serviço acionado em horas, sem esperar a indenização';
comment on column public.planejamentos.funeral_familiar is
  'Assistência funeral familiar — estende a cobertura a cônjuge, filhos e (em alguns produtos) pais';

comment on column public.planejamentos.premio_anual is
  'Prêmio à vista anual cotado. Normalmente traz desconto sobre 12× o mensal — o cliente escolhe a forma de pagamento';
comment on column public.planejamentos.forma_pagamento is
  'mensal | anual — a preferência do cliente, destacada na proposta';

-- ── 6. O capital de morte volta a ser do app ────────────────────────────────
-- A trigger fn_sugerir_capital preenchia capital_sugerido com a fórmula antiga
-- (custo de vida × 12 × anos + dívidas), que IGNORA a regra dos filhos até os
-- 24 anos. Resultado: o valor gravado brigava com o número calculado na tela e
-- na proposta — a origem dos erros de número que apareciam na apresentação.
--
-- A partir daqui, capital_sugerido guarda apenas o que a consultora DEFINIU.
-- Em branco = o estudo usa a própria sugestão, sempre coerente com os slides.
drop trigger if exists trg_planejamentos_capital on public.planejamentos;
drop function if exists public.fn_sugerir_capital();

-- Limpa só os valores que são exatamente o resultado da fórmula automática
-- (ou seja, foram preenchidos pela trigger e nunca digitados por alguém).
update public.planejamentos
   set capital_sugerido = null
 where capital_sugerido is not null
   and custo_vida_mensal is not null
   and capital_sugerido = custo_vida_mensal * 12 * anos_protecao + coalesce(dividas_total, 0);

-- ── 7. Retrocompatibilidade do patrimônio ──────────────────────────────────
-- Quem já tinha só o total continua funcionando: o estudo soma as classes
-- quando elas existem e cai no patrimonio_total quando não existem.
comment on column public.planejamentos.patrimonio_total is
  'Patrimônio bruto. Se as classes (imóveis, investimentos, empresa, veículos, outros) estiverem preenchidas, o estudo usa a soma delas e este campo vira o total consolidado';


-- ############################################################################
-- ### 020_transcricoes_reuniao.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 020: Transcrições de reunião
--
-- A consultora grava as reuniões com o Tactiq (extensão do Meet/Zoom) e sai de
-- cada encontro com uma transcrição inteira. Até aqui isso morria num arquivo
-- de texto: ninguém relê 40 minutos de conversa antes da próxima reunião.
--
-- Esta tabela guarda a transcrição junto do cliente e, ao lado dela, a ANÁLISE
-- já processada (coluna `analise`, jsonb). A análise é o que dá valor:
--
--   • resumo executivo e os momentos que decidiram a conversa;
--   • quanto a consultora falou e quanto o cliente falou (numa reunião
--     consultiva, quem mais fala é o cliente);
--   • os números que o cliente disse em voz alta — renda, custo de vida,
--     patrimônio, dívidas, idade dos filhos — prontos para aplicar no
--     planejamento sem redigitar nada;
--   • objeções levantadas, com a resposta sugerida para cada uma;
--   • sinais de compra e o nível de temperatura da oportunidade;
--   • quais blocos do roteiro foram cobertos e quais ficaram de fora;
--   • os compromissos assumidos, que viram tarefas com um clique.
--
-- O texto original fica guardado: a análise pode ser refeita a qualquer
-- momento quando o motor melhorar, sem pedir o arquivo de novo.
--
-- Como usar: rode APÓS a 019, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create table if not exists public.transcricoes (
  id           uuid primary key default gen_random_uuid(),
  id_cliente   uuid not null references public.clientes(id) on delete cascade,
  id_reuniao   uuid references public.reunioes(id) on delete set null,
  titulo       text,
  data_reuniao date not null default current_date,
  origem       text not null default 'tactiq',
  texto        text not null,
  analise      jsonb not null default '{}'::jsonb,
  resumo       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_transcricoes_cliente on public.transcricoes (id_cliente);
create index if not exists idx_transcricoes_data    on public.transcricoes (data_reuniao desc);

comment on table public.transcricoes is
  'Transcrições de reunião (Tactiq, Meet, Zoom ou colagem manual) com a análise já processada';
comment on column public.transcricoes.origem is
  'tactiq | meet | zoom | manual — de onde veio o texto';
comment on column public.transcricoes.texto is
  'Transcrição original, preservada para reprocessar a análise quando o motor melhorar';
comment on column public.transcricoes.analise is
  'Análise estruturada: falantes e tempo de fala, dados financeiros e de família extraídos, objeções, sinais de compra, cobertura do roteiro, compromissos e pontuação da reunião';
comment on column public.transcricoes.resumo is
  'Resumo executivo em texto, pronto para colar nas notas da reunião ou enviar ao cliente';

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_transcricoes_updated_at'
  ) then
    create trigger trg_transcricoes_updated_at
      before update on public.transcricoes
      for each row execute function public.fn_touch_updated_at();
  end if;
end $$;

alter table public.transcricoes enable row level security;

drop policy if exists "acesso_total_autenticado" on public.transcricoes;
create policy "acesso_total_autenticado" on public.transcricoes
  for all to authenticated using (true) with check (true);


-- ############################################################################
-- ### 021_planejamento_inteligente.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 021: Planejamento inteligente
--
-- O estudo passou a usar a IDADE do cliente (que já estava em clientes.
-- data_nascimento e nunca tinha sido lida) para calcular a janela real de
-- proteção e o preço de deixar a decisão para depois. Esta migração completa
-- o que faltava no banco para as três frentes novas:
--
--   1. FUMANTE
--      Muda o prêmio de risco de forma relevante (o mercado trabalha entre
--      +50% e +100%) e entra na estimativa do custo da espera. É a diferença
--      entre "esperar te custa 34% a mais" e um número que não bate com a
--      cotação que vai chegar.
--
--   2. APOSENTADORIA E ACÚMULO
--      O foco "aposentadoria e acúmulo" já existia na lista do planejamento
--      e não tinha UMA LINHA de cálculo por trás. Com a renda desejada e a
--      idade-alvo, o estudo passa a mostrar a meta de acúmulo, o que a
--      previdência atual entrega LÍQUIDA DE IR e a lacuna mensal — e o elo
--      que ninguém faz: sem invalidez coberta, o plano de aposentadoria para
--      junto com a renda.
--
--   3. OS SEGUROS QUE ELE JÁ TEM, UM A UM
--      "Já tenho seguro" é a objeção que mais derruba proposta, e o estudo só
--      tinha um número solto (cobertura_atual). Guardando origem e custeio de
--      cada apólice, a consultora mostra o que realmente sobra: seguro de
--      empresa acaba junto com o emprego e o do banco costuma cobrir só o
--      saldo devedor do financiamento — nenhum dos dois protege a família.
--
--   4. QUEM DECIDE E QUANDO
--      Preenchidos automaticamente pela análise da transcrição da reunião.
--      Proposta sem data de retorno esfria em 72 horas.
--
-- A RPC da proposta pública passa a devolver a IDADE do cliente (não a data
-- de nascimento — o cliente não precisa ver menos nem mais do que o cálculo
-- exige). Sem isso, a apresentação aberta pelo link do cliente perderia os
-- capítulos que dependem da idade e ficaria diferente da que foi apresentada
-- na reunião.
--
-- Nenhum trigger recalcula valor nesta migração: foi exatamente o que causou
-- os erros de número corrigidos na 019.
--
-- Como usar: rode APÓS a 020, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- ── 1. Perfil de risco ─────────────────────────────────────────────────────
  add column if not exists fumante boolean not null default false,

  -- ── 2. Aposentadoria e acúmulo ─────────────────────────────────────────────
  -- Quanto ele quer receber por mês quando parar, em valores de hoje.
  add column if not exists renda_desejada_aposentadoria numeric(14,2),
  -- Idade-alvo. 65 é o padrão do estudo quando fica em branco.
  add column if not exists idade_aposentadoria integer,

  -- ── 3. Seguros que já existem ──────────────────────────────────────────────
  -- [{ origem: 'empresa'|'banco'|'individual'|'consignado'|'outro',
  --    descricao: text, capital: number, custeio: 'empresa'|'proprio' }]
  -- O total continua em cobertura_atual: esta coluna é o detalhe que sustenta
  -- a conversa, não uma segunda fonte de verdade.
  add column if not exists seguros_existentes jsonb not null default '[]'::jsonb,

  -- ── 4. Decisão ─────────────────────────────────────────────────────────────
  add column if not exists quem_decide   text,
  add column if not exists prazo_decisao text;

comment on column public.planejamentos.fumante is
  'Fumante nos últimos 12 meses. Agrava o prêmio de risco e entra na estimativa do custo da espera.';
comment on column public.planejamentos.renda_desejada_aposentadoria is
  'Renda mensal desejada na aposentadoria, em valores de hoje.';
comment on column public.planejamentos.idade_aposentadoria is
  'Idade-alvo para parar de trabalhar. Padrão do estudo: 65.';
comment on column public.planejamentos.seguros_existentes is
  'Detalhe das apólices atuais: [{origem, descricao, capital, custeio}]. O total fica em cobertura_atual.';
comment on column public.planejamentos.quem_decide is
  'Quem decide a contratação (ele, o casal, os sócios). Preenchido pela análise da transcrição.';
comment on column public.planejamentos.prazo_decisao is
  'Prazo que o cliente sinalizou para decidir. Preenchido pela análise da transcrição.';

-- Faixa plausível para a idade-alvo: fora disso é digitação errada, e um
-- estudo com aposentadoria aos 3 anos não ajuda ninguém.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_idade_aposentadoria_faixa'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_idade_aposentadoria_faixa
      check (idade_aposentadoria is null or idade_aposentadoria between 40 and 90);
  end if;
end $$;

-- ── A proposta pública precisa saber a idade ────────────────────────────────
-- Devolvemos a idade calculada, não a data de nascimento: é o suficiente para
-- o cálculo e expõe o mínimo no link aberto.
create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*,
         c.nome as cliente_nome,
         case
           when c.data_nascimento is null then null
           else extract(year from age(current_date, c.data_nascimento))::int
         end as cliente_idade
    into r
    from public.planejamentos p
    join public.clientes c on c.id = p.id_cliente
   where p.token_proposta = p_token;

  if not found then
    return jsonb_build_object('erro', 'proposta_nao_encontrada');
  end if;

  return jsonb_build_object(
    'cliente_nome', r.cliente_nome,
    'cliente_idade', r.cliente_idade,
    -- o plano inteiro, menos os identificadores internos
    'plano', to_jsonb(r) - 'cliente_nome' - 'cliente_idade'
             - 'id' - 'id_cliente' - 'token_proposta'
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;


-- ############################################################################
-- ### 022_comparador.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 022: O comparador
--
-- "Não seria melhor investir esse dinheiro?" é a objeção que mais derruba
-- proposta de seguro resgatável, e até aqui o sistema respondia com UM número:
-- quantos anos de aporte levariam até o capital do estudo. É um bom argumento
-- e é insuficiente — não mostra a curva, não trata o valor de resgate, e não
-- sobrevive a um cliente que chega com o assessor de investimentos do lado.
--
-- O comparador monta a série ano a ano dos dois lados, com a tributação certa
-- de cada um, e mostra o ponto exato em que uma curva cruza a outra.
--
-- O PRINCÍPIO: a comparação precisa ser JUSTA, ou volta contra quem apresenta.
-- Seguro e investimento não respondem à mesma pergunta. Um comparador que
-- esconde onde o investimento ganha é um comparador que o cliente desmonta em
-- trinta segundos. Por isso o sistema credita a dedução do PGBL, usa a tabela
-- regressiva de IR de verdade e diz, em voz alta, que num horizonte longo e
-- sem sinistro o investimento acumula mais. É justamente por mostrar isso que
-- o resto do argumento fica de pé.
--
-- O que entra no banco:
--
--   1. A TABELA DE RESGATE DA COTAÇÃO
--      Valor de resgate varia por produto e seguradora (Prudential, MetLife,
--      Icatu) e o sistema não tem como saber sozinho. A consultora cola os
--      pares ano/valor da cotação e o motor interpola o meio. Número exato,
--      defensável na frente do cliente — não é estimativa.
--
--   2. CONTRA O QUE COMPARAR
--      VGBL (IR só sobre o rendimento) ou PGBL (IR sobre o total resgatado,
--      mas com dedução de até 12% da renda tributável todo ano).
--
--   3. AS PREMISSAS, POR CLIENTE
--      A taxa real de juros e a alíquota de IR dele. Projeção sem premissa à
--      vista é adivinhação, e premissa que não dá para ajustar é dogma.
--
--   4. O SEGURO TEMPORÁRIO, SE ELA COTOU
--      Isolar o custo da proteção e comparar com um temporário do mesmo
--      capital é a comparação mais justa que existe neste assunto.
--
-- Nenhum trigger recalcula valor nesta migração: foi exatamente o que causou
-- os erros de número corrigidos na 019.
--
-- Como usar: rode APÓS a 021, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- ── 1. A tabela de resgate, colada da cotação ──────────────────────────────
  -- [{ ano: int, resgate: numeric }] — os pontos que a seguradora informou.
  -- O motor interpola entre eles e mantém estável depois do último.
  add column if not exists seguro_resgatavel jsonb not null default '[]'::jsonb,

  -- ── 2. Contra o que comparar ───────────────────────────────────────────────
  add column if not exists comparador_alternativa text,

  -- ── 3. Premissas do cliente ────────────────────────────────────────────────
  -- Taxa real (acima da inflação) ao ano, em %. Em branco = o padrão do
  -- estudo (4%). Fica editável porque é a premissa que um assessor questiona.
  add column if not exists comparador_taxa_real numeric(6,3),
  -- Alíquota de IR dele, em %. Sem ela a dedução do PGBL não pode ser
  -- creditada — e sem creditar, a comparação é um espantalho.
  add column if not exists aliquota_ir_cliente numeric(5,2),

  -- ── 4. O temporário do mesmo capital, se houver cotação ────────────────────
  add column if not exists premio_temporario_mensal numeric(14,2);

comment on column public.planejamentos.seguro_resgatavel is
  'Tabela de resgate da cotação: [{ano, resgate}]. O motor interpola entre os pontos informados.';
comment on column public.planejamentos.comparador_alternativa is
  'Contra o que comparar o seguro resgatável: vgbl ou pgbl.';
comment on column public.planejamentos.comparador_taxa_real is
  'Taxa de juros real ao ano (%) usada na projeção. Em branco usa o padrão do estudo (4%).';
comment on column public.planejamentos.aliquota_ir_cliente is
  'Alíquota de IR do cliente (%), para creditar a dedução do PGBL na comparação.';
comment on column public.planejamentos.premio_temporario_mensal is
  'Prêmio mensal de um seguro TEMPORÁRIO do mesmo capital, se cotado. Isola o custo da proteção.';

-- A alternativa só aceita o que o comparador sabe calcular: um valor digitado
-- errado viraria uma coluna vazia no gráfico, sem ninguém perceber.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_comparador_alternativa_valida'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_comparador_alternativa_valida
      check (comparador_alternativa is null or comparador_alternativa in ('vgbl', 'pgbl'));
  end if;
end $$;

-- Faixas plausíveis. Uma taxa real de 40% ao ano ou uma alíquota de 300%
-- produzem um gráfico bonito e uma conversa impossível de sustentar.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_comparador_taxa_real_faixa'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_comparador_taxa_real_faixa
      check (comparador_taxa_real is null or comparador_taxa_real between -5 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_aliquota_ir_faixa'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_aliquota_ir_faixa
      check (aliquota_ir_cliente is null or aliquota_ir_cliente between 0 and 50);
  end if;
end $$;


-- ############################################################################
-- ### 023_apresentacao.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 023: A apresentação que interage
--
-- A consultora apresenta pelo iPad, compartilhando a tela na reunião. Até aqui
-- a proposta era um deck: bonito, correto e MUDO. Ela passava slide, o cliente
-- assistia, e a conversa acontecia apesar da tela, não por causa dela.
--
-- Uma reunião de seguro de vida não é uma palestra. É um cliente perguntando
-- "e se fosse mil e duzentos?", é a consultora circulando um número com a
-- canetinha e dizendo "é ESTE aqui que muda tudo", é riscar o que não importa
-- para sobrar o que importa. Nada disso cabe num deck.
--
-- O que esta migração guarda:
--
--   ANOTAÇÕES POR SLIDE
--   O que ela desenha por cima de cada capítulo, guardado por cliente. Ela
--   reabre a proposta uma semana depois e o círculo que fez em volta do
--   déficit de liquidez ainda está lá — junto com a conversa que ele sustentou.
--
--   Os traços são gravados em coordenadas RELATIVAS (0 a 1) ao slide, não em
--   pixels: o mesmo desenho feito no iPad em pé aparece certo no iPad deitado,
--   no computador da consultora e no celular do cliente. Guardar pixel seria
--   guardar o desenho de um aparelho só.
--
--   A chave é o NOME do slide ('sucessao', 'cruzamento'), não a posição. Um
--   cliente que ganha o capítulo da empresa empurraria todos os índices para
--   frente, e as anotações apareceriam no capítulo errado — que é pior do que
--   não ter anotação nenhuma.
--
-- O que NÃO entra no banco: as simulações que ela faz durante a conversa
-- ("e se fosse R$ 1.200?"). Elas são de propósito temporárias — o planejamento
-- continua sendo a fonte da verdade, e um número mexido no calor da reunião
-- não pode virar o estudo sem ela decidir isso na aba Planejamento.
--
-- Como usar: rode APÓS a 022, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- { "sucessao": [ {t, c, l, p:[x,y,pr, x,y,pr, …]}, … ], "cruzamento": [ … ] }
  --   t  = tipo do traço (caneta | marcador)
  --   c  = cor  ·  l = calibre (fração da menor dimensão do slide)
  --   p  = pontos em trincas: x, y em coordenadas relativas 0..1 e a pressão
  --        da Apple Pencil naquele ponto (0..1), que dá a espessura viva do
  --        traço. Sem a pressão, o desenho denuncia na hora que não saiu de
  --        uma caneta de verdade.
  add column if not exists anotacoes_proposta jsonb not null default '{}'::jsonb;

comment on column public.planejamentos.anotacoes_proposta is
  'Desenhos da consultora sobre os slides, por nome de slide. Pontos em coordenadas relativas 0..1 para funcionar em qualquer tela.';

-- A proposta pública precisa mostrar as anotações: se o cliente abre o link
-- depois da reunião e vê um slide limpo, ele perde exatamente a parte que foi
-- explicada para ele.
create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*,
         c.nome as cliente_nome,
         case
           when c.data_nascimento is null then null
           else extract(year from age(current_date, c.data_nascimento))::int
         end as cliente_idade
    into r
    from public.planejamentos p
    join public.clientes c on c.id = p.id_cliente
   where p.token_proposta = p_token;

  if not found then
    return jsonb_build_object('erro', 'proposta_nao_encontrada');
  end if;

  return jsonb_build_object(
    'cliente_nome', r.cliente_nome,
    'cliente_idade', r.cliente_idade,
    -- o plano inteiro, menos os identificadores internos
    'plano', to_jsonb(r) - 'cliente_nome' - 'cliente_idade'
             - 'id' - 'id_cliente' - 'token_proposta'
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;


-- ############################################################################
-- ### 024_propostas_em_analise.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 024: a proposta dentro da seguradora
--
-- O funil sempre teve a etapa "Em Análise", e ela sempre foi uma CAIXA PRETA.
-- O cliente disse sim, a proposta foi enviada — e a partir daí o sistema só
-- sabia dizer "Retomar contato para fechar". Não sabia se a seguradora está
-- esperando um exame, se o cliente não respondeu a DPS, se a apólice já foi
-- aprovada e falta emitir, ou se a proposta foi recusada semanas atrás.
--
-- É exatamente onde o negócio morre. O cliente já decidiu, já disse sim, já
-- está convencido — e o processo trava numa pendência que ninguém cobrou. Sai
-- mais caro perder um cliente aqui do que na primeira reunião: aqui o trabalho
-- já foi todo feito.
--
-- ── O que esta migração guarda ──────────────────────────────────────────────
--
--   A PROPOSTA como um objeto próprio, com número, seguradora, data de envio,
--   capital, prêmio e situação. Ela não é uma apólice (ainda não existe) nem é
--   só um cliente numa coluna do Kanban.
--
--   AS EXIGÊNCIAS, que são o coração da coisa. Cada pendência guarda O QUE
--   falta, DE QUEM depende e QUANDO foi pedida. Sem o "de quem depende" a
--   lista vira um monte de tarefas sem dono — e a pendência que mata negócio é
--   sempre a que está com o cliente, esperando alguém lembrar de cobrar.
--
--   O MOTIVO DA RECUSA, em texto. Recusa por saúde, por valor, por profissão
--   e por sobreposição pedem conversas diferentes na hora de tentar de novo em
--   outra seguradora — e daqui a seis meses ninguém lembra qual foi.
--
-- ── O que NÃO entra ─────────────────────────────────────────────────────────
--
-- Nada de disparar cobrança sozinho. O sistema mostra o que está parado e há
-- quantos dias; quem decide cobrar o cliente é ela. Uma mensagem automática
-- para quem está esperando resultado de exame é a pior coisa que este sistema
-- poderia mandar.
--
-- Como usar: rode APÓS a 023, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create table if not exists public.propostas_seguradora (
  id                uuid primary key default gen_random_uuid(),
  id_cliente        uuid not null references public.clientes(id) on delete cascade,
  id_seguradora     uuid references public.seguradoras(id) on delete set null,

  numero_proposta   text,
  data_envio        date not null default current_date,
  capital           numeric(14,2),
  premio_mensal     numeric(12,2),

  -- O caminho real de uma proposta de vida. `exigencia` não é uma etapa
  -- separada no tempo: é o estado em que ela fica enquanto falta alguma coisa,
  -- e é o único que costuma durar semanas.
  situacao          text not null default 'enviada'
                    check (situacao in ('enviada', 'em_analise', 'exigencia',
                                        'aprovada', 'emitida', 'recusada', 'desistiu')),

  -- [ { o_que, de_quem: cliente|seguradora|consultora, pedida_em, resolvida_em } ]
  --   `de_quem` é o campo que faz a lista valer alguma coisa: sem ele não dá
  --   para separar "esperando o laboratório" de "o cliente não respondeu".
  exigencias        jsonb not null default '[]'::jsonb,

  motivo_recusa     text,
  observacoes       text,

  -- quando sai a apólice, a proposta aponta para ela e o ciclo fecha
  id_apolice        uuid references public.apolices(id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.propostas_seguradora is
  'A proposta enviada à seguradora e o que falta para a apólice sair. Cobre o vão entre "o cliente disse sim" e "a apólice existe".';
comment on column public.propostas_seguradora.exigencias is
  'Pendências: [{o_que, de_quem (cliente|seguradora|consultora), pedida_em, resolvida_em}]. O "de_quem" é o que separa cobrar do cliente de cobrar a seguradora.';

create index if not exists idx_propostas_cliente on public.propostas_seguradora (id_cliente);
create index if not exists idx_propostas_situacao on public.propostas_seguradora (situacao);

drop trigger if exists trg_propostas_touch on public.propostas_seguradora;
create trigger trg_propostas_touch
  before update on public.propostas_seguradora
  for each row execute function public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- Acesso: mesma política do resto do sistema (usuário autenticado = a equipe)
-- ----------------------------------------------------------------------------
alter table public.propostas_seguradora enable row level security;

drop policy if exists acesso_total_autenticado on public.propostas_seguradora;
create policy acesso_total_autenticado on public.propostas_seguradora
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- A visão que a tela inicial precisa: o que está aberto, há quantos dias, e
-- com quem está a bola. O cálculo de dias fica no BANCO porque a resposta tem
-- que ser a mesma no Dashboard, no cliente e em qualquer relatório futuro.
-- ----------------------------------------------------------------------------
create or replace view public.vw_propostas_abertas as
select
  p.id,
  p.id_cliente,
  c.nome                as cliente_nome,
  c.telefone            as cliente_telefone,
  s.nome                as seguradora_nome,
  p.numero_proposta,
  p.data_envio,
  p.capital,
  p.premio_mensal,
  p.situacao,
  p.exigencias,
  (current_date - p.data_envio)::int as dias_na_seguradora,
  -- pendências ainda abertas (sem `resolvida_em`)
  (
    select count(*)
      from jsonb_array_elements(p.exigencias) e
     where e->>'resolvida_em' is null
  )::int as exigencias_abertas,
  -- há quantos dias a pendência mais antiga está parada
  (
    select max((current_date - (e->>'pedida_em')::date))::int
      from jsonb_array_elements(p.exigencias) e
     where e->>'resolvida_em' is null
       and e->>'pedida_em' is not null
  ) as dias_exigencia_mais_antiga
from public.propostas_seguradora p
join public.clientes c on c.id = p.id_cliente
left join public.seguradoras s on s.id = p.id_seguradora
where p.situacao in ('enviada', 'em_analise', 'exigencia', 'aprovada');

comment on view public.vw_propostas_abertas is
  'Propostas que ainda não viraram apólice nem morreram — com dias parados e pendências abertas.';


-- ############################################################################
-- ### 025_proposta_publica_sem_notas.sql
-- ####################################################################################

-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 025: o cliente não pode ler as anotações dela
--
-- ── O vazamento ─────────────────────────────────────────────────────────────
--
-- A proposta pública (`/p/<token>`) carrega pela RPC `fn_proposta_carregar`,
-- que devolvia o planejamento INTEIRO menos três identificadores:
--
--     'plano', to_jsonb(r) - 'id' - 'id_cliente' - 'token_proposta'
--
-- Junto iam quatro campos que são a consultora falando consigo mesma:
--
--   observacoes_reuniao  "Preocupado com sucessão da clínica. Esposa não
--                         trabalha fora. Quer revisar previdência no 2º sem."
--   roteiro              as notas por bloco da reunião — "Muito receptivo",
--                         "Esposa não trabalha fora"
--   quem_decide          a leitura dela sobre quem manda na decisão
--   prazo_decisao        "Quer decidir até o fim do mês"
--
-- A tela nunca mostrou nada disso. Mas o dado ia inteiro para o navegador do
-- cliente, e qualquer um que abrisse o inspetor lia tudo.
--
-- O `prazo_decisao` é o pior: é a urgência dele nas palavras dela — uma
-- posição de negociação entregue para o outro lado da mesa.
--
-- ── A correção, e por que ela é feita assim ─────────────────────────────────
--
-- A lista de campos que NÃO saem fica explícita e nomeada. É uma lista de
-- exclusão, não de inclusão, por um motivo prático: das 74 colunas do
-- planejamento, 65 são dados do próprio cliente que a proposta precisa
-- mostrar, e várias são lidas dinamicamente pelo catálogo de coberturas. Uma
-- lista de inclusão teria que ser atualizada a cada cobertura nova, e quando
-- alguém esquecesse, o slide simplesmente sumiria — em silêncio.
--
-- O que protege contra o esquecimento não é a forma da lista: é o teste
-- `scripts/teste-proposta-publica.mjs`, que FIXA o conjunto exato de chaves
-- que a proposta pública devolve. Qualquer coluna nova quebra o teste e
-- obriga uma decisão consciente sobre de que lado ela fica.
--
-- REGRA para quem mexer aqui depois: se a coluna guarda o que a CONSULTORA
-- pensa (nota, leitura, avaliação, estratégia), ela entra nesta lista. Se
-- guarda o que o CLIENTE tem ou quer, ela sai na proposta.
--
-- Como usar: rode APÓS a 024, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*,
         c.nome as cliente_nome,
         case
           when c.data_nascimento is null then null
           else extract(year from age(current_date, c.data_nascimento))::int
         end as cliente_idade
    into r
    from public.planejamentos p
    join public.clientes c on c.id = p.id_cliente
   where p.token_proposta = p_token;

  if not found then
    return jsonb_build_object('erro', 'proposta_nao_encontrada');
  end if;

  return jsonb_build_object(
    'cliente_nome', r.cliente_nome,
    'cliente_idade', r.cliente_idade,
    'plano', to_jsonb(r)
             -- identificadores internos
             - 'cliente_nome' - 'cliente_idade'
             - 'id' - 'id_cliente' - 'token_proposta'
             - 'created_at' - 'updated_at'
             -- ── O QUE A CONSULTORA ANOTOU PARA SI ─────────────────────────
             -- Nada aqui pode chegar ao navegador do cliente.
             - 'observacoes_reuniao'   -- notas dela sobre a reunião
             - 'roteiro'               -- o roteiro com as notas de cada bloco
             - 'quem_decide'           -- a leitura dela sobre quem decide
             - 'prazo_decisao'         -- a urgência dele, nas palavras dela
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;

comment on function public.fn_proposta_carregar(uuid) is
  'Proposta pública por token. NÃO devolve observacoes_reuniao, roteiro, quem_decide nem prazo_decisao — são anotações da consultora, não do cliente.';

