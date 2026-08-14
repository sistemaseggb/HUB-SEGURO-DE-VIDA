-- ============================================================================
-- 026 — O ASSESSOR PASSA A MORAR NA APÓLICE
--
-- Até aqui o assessor morava no CLIENTE, e a apólice herdava o dele. Duas
-- coisas quebravam por causa disso, e as duas apareceram na planilha de
-- julho/2026:
--
--   1. REIMPORTAR NÃO MOVIA NINGUÉM. O importador só define o assessor quando
--      CRIA o cliente. Cliente que já existe ficava congelado no assessor da
--      primeira carga — então a consultora subia a planilha do mês, os prêmios
--      atualizavam, e o ranking dos GB Awards continuava igual. Parecia que o
--      sistema não estava lendo a planilha; ele estava, só não movia a
--      atribuição.
--
--   2. UM CLIENTE, DOIS ASSESSORES. A planilha traz o assessor por LINHA de
--      apólice, não por cliente — e 4 clientes têm apólices de assessores
--      diferentes (6 delas em 2026). Com um assessor só por cliente, um dos
--      dois sempre perdia a produção dele.
--
-- A coluna é opcional de propósito: quando está vazia, tudo continua caindo no
-- assessor do cliente, que é o comportamento antigo. Nenhuma tela quebra se
-- esta migração ainda não tiver rodado.
-- ============================================================================

alter table public.apolices
  add column if not exists id_assessor uuid references public.assessores(id) on delete set null;

create index if not exists idx_apolices_assessor on public.apolices (id_assessor);

comment on column public.apolices.id_assessor is
  'Assessor DESTA apólice (vem da coluna ASSESSOR da planilha geral, linha a linha). '
  'Quando nulo, vale o assessor do cliente — o comportamento anterior à migração 026.';

-- Preenche o histórico com o que se sabe hoje: o assessor do cliente. A partir
-- da próxima importação da planilha geral, cada apólice passa a carregar o
-- assessor da própria linha.
update public.apolices a
   set id_assessor = c.id_assessor
  from public.clientes c
 where c.id = a.id_cliente
   and a.id_assessor is null;
