-- ============================================================================
-- HUB SEGURO DE VIDA — Limpar dados de TESTE antes da entrega
--
-- Depois de testar o sistema, rode este script para deixar o banco limpo para
-- a Natália começar do zero. Ele APAGA de verdade — use só num banco de teste,
-- antes de entregar. Rode no Supabase → SQL Editor.
--
-- Escolha UMA das opções abaixo (descomente as linhas da opção desejada).
-- ============================================================================

-- ── OPÇÃO A (recomendada) — apaga clientes e tudo ligado a eles, mas MANTÉM
--    seus cadastros de seguradoras, assessores e as configurações/metas.
truncate table
  public.documentos,
  public.tarefas,
  public.interacoes,
  public.reunioes,
  public.planejamentos,
  public.apolices,
  public.formularios_onboarding,
  public.fila_mensagens,
  public.historico_funil,
  public.agenda_externa,
  public.comissoes_importadas,
  public.clientes
restart identity cascade;

-- ── OPÇÃO B — recomeçar do ZERO absoluto (também apaga seguradoras e
--    assessores criados nos testes; mantém apenas as configurações).
--    Para usar, apague a OPÇÃO A acima e descomente as 3 linhas abaixo:
-- truncate table
--   public.documentos, public.tarefas, public.interacoes, public.reunioes,
--   public.planejamentos, public.apolices, public.formularios_onboarding,
--   public.fila_mensagens, public.historico_funil, public.agenda_externa,
--   public.comissoes_importadas, public.clientes, public.assessores, public.seguradoras
-- restart identity cascade;

-- Pronto. Confira em Table Editor → clientes que a tabela está vazia.
-- Os arquivos enviados em Documentos ficam no Storage; se quiser zerar também,
-- vá em Storage → bucket "documentos" e apague as pastas manualmente.
