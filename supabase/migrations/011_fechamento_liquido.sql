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
