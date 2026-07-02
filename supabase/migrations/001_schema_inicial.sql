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
