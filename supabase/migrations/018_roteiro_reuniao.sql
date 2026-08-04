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
