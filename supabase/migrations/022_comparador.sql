-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 022: O comparador
--
-- "Não seria melhor investir esse dinheiro?" é a objeção que mais derruba
-- proposta de seguro resgatável, e até aqui o sistema respondia com UM número:
-- quantos anos de aporte levariam até o capital do estudo. É um bom argumento
-- e é insuficiente — não mostra a curva, não trata o valor de resgate, e não
-- sobrevive a um cliente que chega com o assessor de investimentos do lado.
--
-- O comparador monta a série ano a ano dos dois lados, com a tributação certa
-- de cada um, e mostra o ponto exato em que uma curva cruza a outra.
--
-- O PRINCÍPIO: a comparação precisa ser JUSTA, ou volta contra quem apresenta.
-- Seguro e investimento não respondem à mesma pergunta. Um comparador que
-- esconde onde o investimento ganha é um comparador que o cliente desmonta em
-- trinta segundos. Por isso o sistema credita a dedução do PGBL, usa a tabela
-- regressiva de IR de verdade e diz, em voz alta, que num horizonte longo e
-- sem sinistro o investimento acumula mais. É justamente por mostrar isso que
-- o resto do argumento fica de pé.
--
-- O que entra no banco:
--
--   1. A TABELA DE RESGATE DA COTAÇÃO
--      Valor de resgate varia por produto e seguradora (Prudential, MetLife,
--      Icatu) e o sistema não tem como saber sozinho. A consultora cola os
--      pares ano/valor da cotação e o motor interpola o meio. Número exato,
--      defensável na frente do cliente — não é estimativa.
--
--   2. CONTRA O QUE COMPARAR
--      VGBL (IR só sobre o rendimento) ou PGBL (IR sobre o total resgatado,
--      mas com dedução de até 12% da renda tributável todo ano).
--
--   3. AS PREMISSAS, POR CLIENTE
--      A taxa real de juros e a alíquota de IR dele. Projeção sem premissa à
--      vista é adivinhação, e premissa que não dá para ajustar é dogma.
--
--   4. O SEGURO TEMPORÁRIO, SE ELA COTOU
--      Isolar o custo da proteção e comparar com um temporário do mesmo
--      capital é a comparação mais justa que existe neste assunto.
--
-- Nenhum trigger recalcula valor nesta migração: foi exatamente o que causou
-- os erros de número corrigidos na 019.
--
-- Como usar: rode APÓS a 021, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- ── 1. A tabela de resgate, colada da cotação ──────────────────────────────
  -- [{ ano: int, resgate: numeric }] — os pontos que a seguradora informou.
  -- O motor interpola entre eles e mantém estável depois do último.
  add column if not exists seguro_resgatavel jsonb not null default '[]'::jsonb,

  -- ── 2. Contra o que comparar ───────────────────────────────────────────────
  add column if not exists comparador_alternativa text,

  -- ── 3. Premissas do cliente ────────────────────────────────────────────────
  -- Taxa real (acima da inflação) ao ano, em %. Em branco = o padrão do
  -- estudo (4%). Fica editável porque é a premissa que um assessor questiona.
  add column if not exists comparador_taxa_real numeric(6,3),
  -- Alíquota de IR dele, em %. Sem ela a dedução do PGBL não pode ser
  -- creditada — e sem creditar, a comparação é um espantalho.
  add column if not exists aliquota_ir_cliente numeric(5,2),

  -- ── 4. O temporário do mesmo capital, se houver cotação ────────────────────
  add column if not exists premio_temporario_mensal numeric(14,2);

comment on column public.planejamentos.seguro_resgatavel is
  'Tabela de resgate da cotação: [{ano, resgate}]. O motor interpola entre os pontos informados.';
comment on column public.planejamentos.comparador_alternativa is
  'Contra o que comparar o seguro resgatável: vgbl ou pgbl.';
comment on column public.planejamentos.comparador_taxa_real is
  'Taxa de juros real ao ano (%) usada na projeção. Em branco usa o padrão do estudo (4%).';
comment on column public.planejamentos.aliquota_ir_cliente is
  'Alíquota de IR do cliente (%), para creditar a dedução do PGBL na comparação.';
comment on column public.planejamentos.premio_temporario_mensal is
  'Prêmio mensal de um seguro TEMPORÁRIO do mesmo capital, se cotado. Isola o custo da proteção.';

-- A alternativa só aceita o que o comparador sabe calcular: um valor digitado
-- errado viraria uma coluna vazia no gráfico, sem ninguém perceber.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_comparador_alternativa_valida'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_comparador_alternativa_valida
      check (comparador_alternativa is null or comparador_alternativa in ('vgbl', 'pgbl'));
  end if;
end $$;

-- Faixas plausíveis. Uma taxa real de 40% ao ano ou uma alíquota de 300%
-- produzem um gráfico bonito e uma conversa impossível de sustentar.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_comparador_taxa_real_faixa'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_comparador_taxa_real_faixa
      check (comparador_taxa_real is null or comparador_taxa_real between -5 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_aliquota_ir_faixa'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_aliquota_ir_faixa
      check (aliquota_ir_cliente is null or aliquota_ir_cliente between 0 and 50);
  end if;
end $$;
