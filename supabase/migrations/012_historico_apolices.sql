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
