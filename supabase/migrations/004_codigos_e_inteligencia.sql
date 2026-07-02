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
