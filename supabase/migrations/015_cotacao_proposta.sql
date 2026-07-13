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
