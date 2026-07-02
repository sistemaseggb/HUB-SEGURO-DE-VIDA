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
