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
