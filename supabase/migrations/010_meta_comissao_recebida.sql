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
