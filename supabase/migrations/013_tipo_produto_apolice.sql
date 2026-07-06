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
