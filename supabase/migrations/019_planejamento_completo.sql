-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 019: Planejamento completo
--
-- O planejamento deixa de ser "renda, custo de vida e patrimônio num número
-- só" e passa a ser uma CONSTRUÇÃO DE APÓLICE de verdade, com três frentes:
--
--   1. RAIO-X DO PATRIMÔNIO
--      O patrimônio é decomposto por classe (imóveis, investimentos, empresa,
--      veículos, outros) + previdência. Isso muda o estudo em dois pontos:
--        • Previdência (VGBL/PGBL) NÃO passa por inventário — vai direto ao
--          beneficiário, como o seguro. Não pode entrar na base do ITCMD.
--        • Só investimentos e previdência são LÍQUIDOS. Imóveis e empresa não
--          pagam o inventário: é aí que nasce o déficit de liquidez, o
--          argumento mais forte da consultoria de sucessão.
--
--   2. TIPO DE PLANEJAMENTO (PF, PJ ou os dois) + FOCOS
--      Um plano de sucessão não é o mesmo que um plano de renda familiar nem
--      que um acordo de sócios. Os focos escolhidos definem quais capítulos a
--      proposta apresenta e quais coberturas o estudo sugere.
--
--   3. PLANEJAMENTO EMPRESARIAL (PJ)
--      • Acordo de sócios (buy-sell): valuation × participação — dinheiro para
--        os sócios comprarem a quota da família, em vez de virar sócio da
--        viúva.
--      • Homem-chave: o lucro que a empresa perde enquanto se reorganiza.
--      • Dívidas avalizadas: o aval do sócio ALCANÇA o patrimônio pessoal —
--        morrer não cancela o aval, ele vira dívida do espólio.
--
-- E a apólice ganha as coberturas que faltavam (morte acidental, fraturas,
-- diária de internação hospitalar e assistência funeral individual/familiar),
-- além do PRÊMIO ANUAL — o cliente tem o direito de escolher entre pagar por
-- mês ou de uma vez com desconto.
--
-- Como usar: rode APÓS a 018, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- ── 1. Tipo de planejamento e focos ────────────────────────────────────────
  add column if not exists tipo_planejamento text default 'pf',
  add column if not exists focos             jsonb not null default '[]'::jsonb,

  -- ── 2. Composição do patrimônio ────────────────────────────────────────────
  add column if not exists patrimonio_imoveis        numeric(14,2),
  add column if not exists patrimonio_investimentos  numeric(14,2),
  add column if not exists patrimonio_empresa        numeric(14,2),
  add column if not exists patrimonio_veiculos       numeric(14,2),
  add column if not exists patrimonio_outros         numeric(14,2),
  add column if not exists previdencia_saldo         numeric(14,2),
  add column if not exists previdencia_tipo          text,
  add column if not exists previdencia_aporte_mensal numeric(12,2),
  add column if not exists regime_bens               text,
  add column if not exists tem_holding               boolean default false,
  add column if not exists tem_testamento            boolean default false,
  add column if not exists herdeiros_menores         boolean default false,

  -- ── 3. Planejamento empresarial (PJ) ───────────────────────────────────────
  add column if not exists pj_razao_social      text,
  add column if not exists pj_valuation         numeric(14,2),
  add column if not exists pj_participacao_pct  numeric(5,2),
  add column if not exists pj_num_socios        int,
  add column if not exists pj_faturamento_anual numeric(14,2),
  add column if not exists pj_lucro_anual       numeric(14,2),
  add column if not exists pj_divida_avalizada  numeric(14,2),
  add column if not exists capital_socios       numeric(14,2),
  add column if not exists capital_homem_chave  numeric(14,2),
  add column if not exists capital_aval         numeric(14,2),

  -- ── 4. Coberturas que faltavam na apólice ──────────────────────────────────
  add column if not exists capital_morte_acidental numeric(14,2),
  add column if not exists capital_fraturas        numeric(14,2),
  add column if not exists dih_diaria              numeric(12,2),
  add column if not exists dih_dias                int,
  add column if not exists dit_dias                int,
  add column if not exists dit_franquia_dias       int,
  add column if not exists funeral_individual      numeric(12,2),
  add column if not exists funeral_familiar        numeric(12,2),

  -- ── 5. Prêmio: mensal E anual (o cliente escolhe) ──────────────────────────
  add column if not exists premio_anual    numeric(12,2),
  add column if not exists forma_pagamento text default 'mensal';

comment on column public.planejamentos.tipo_planejamento is
  'pf | pj | pf_pj — define se o estudo cobre a pessoa física, a empresa ou as duas frentes';
comment on column public.planejamentos.focos is
  'Focos do planejamento: ["renda","educacao","dividas","sucessao","blindagem","empresarial","aposentadoria"]. Definem quais capítulos a proposta apresenta';

comment on column public.planejamentos.patrimonio_investimentos is
  'Aplicações financeiras — a única parte do patrimônio que paga o inventário sem vender bens';
comment on column public.planejamentos.patrimonio_empresa is
  'Valor das participações societárias (entra no inventário e é o ativo mais ilíquido de todos)';
comment on column public.planejamentos.previdencia_saldo is
  'Saldo de VGBL/PGBL. NÃO entra no inventário nem na base do ITCMD na maioria dos estados: vai direto ao beneficiário indicado, como o seguro de vida';
comment on column public.planejamentos.previdencia_tipo is
  'VGBL | PGBL | ambos';
comment on column public.planejamentos.regime_bens is
  'Regime de bens do casamento — muda quem herda o quê (meação vs herança)';
comment on column public.planejamentos.tem_holding is
  'Já possui holding familiar? Reduz custas do inventário, mas não elimina o ITCMD nem a necessidade de liquidez';
comment on column public.planejamentos.herdeiros_menores is
  'Herdeiros menores de idade: o inventário vira judicial obrigatoriamente (mais lento e mais caro)';

comment on column public.planejamentos.pj_valuation is
  'Valor de mercado da empresa — base do capital do acordo de sócios (buy-sell)';
comment on column public.planejamentos.pj_participacao_pct is
  'Participação do cliente no capital social (%)';
comment on column public.planejamentos.pj_divida_avalizada is
  'Dívidas da empresa avalizadas pelo sócio — o aval alcança o patrimônio pessoal e não morre com ele';
comment on column public.planejamentos.capital_socios is
  'Capital do acordo de sócios. Sugestão: valuation × participação — os sócios compram a quota da família à vista';
comment on column public.planejamentos.capital_homem_chave is
  'Capital homem-chave. Sugestão: 2× o lucro anual — o fôlego para a empresa se reorganizar';
comment on column public.planejamentos.capital_aval is
  'Capital para quitar as dívidas avalizadas antes que alcancem o patrimônio da família';

comment on column public.planejamentos.capital_morte_acidental is
  'Morte acidental (MA): indeniza ADICIONALMENTE ao capital de morte quando a causa é acidente. Sugestão: 100% do capital de morte';
comment on column public.planejamentos.capital_fraturas is
  'Capital de fraturas — indenização proporcional por fratura, conforme tabela da seguradora';
comment on column public.planejamentos.dih_diaria is
  'Diária por Internação Hospitalar (DIH) — valor por dia internado';
comment on column public.planejamentos.dih_dias is
  'Limite de diárias de internação por evento/ano (tipicamente 30 a 365)';
comment on column public.planejamentos.dit_dias is
  'Limite de diárias da DIT (incapacidade temporária), tipicamente 90 a 730';
comment on column public.planejamentos.dit_franquia_dias is
  'Franquia da DIT: dias de afastamento antes de a diária começar a contar (tipicamente 15 ou 30)';
comment on column public.planejamentos.funeral_individual is
  'Assistência funeral do titular — reembolso/serviço acionado em horas, sem esperar a indenização';
comment on column public.planejamentos.funeral_familiar is
  'Assistência funeral familiar — estende a cobertura a cônjuge, filhos e (em alguns produtos) pais';

comment on column public.planejamentos.premio_anual is
  'Prêmio à vista anual cotado. Normalmente traz desconto sobre 12× o mensal — o cliente escolhe a forma de pagamento';
comment on column public.planejamentos.forma_pagamento is
  'mensal | anual — a preferência do cliente, destacada na proposta';

-- ── 6. O capital de morte volta a ser do app ────────────────────────────────
-- A trigger fn_sugerir_capital preenchia capital_sugerido com a fórmula antiga
-- (custo de vida × 12 × anos + dívidas), que IGNORA a regra dos filhos até os
-- 24 anos. Resultado: o valor gravado brigava com o número calculado na tela e
-- na proposta — a origem dos erros de número que apareciam na apresentação.
--
-- A partir daqui, capital_sugerido guarda apenas o que a consultora DEFINIU.
-- Em branco = o estudo usa a própria sugestão, sempre coerente com os slides.
drop trigger if exists trg_planejamentos_capital on public.planejamentos;
drop function if exists public.fn_sugerir_capital();

-- Limpa só os valores que são exatamente o resultado da fórmula automática
-- (ou seja, foram preenchidos pela trigger e nunca digitados por alguém).
update public.planejamentos
   set capital_sugerido = null
 where capital_sugerido is not null
   and custo_vida_mensal is not null
   and capital_sugerido = custo_vida_mensal * 12 * anos_protecao + coalesce(dividas_total, 0);

-- ── 7. Retrocompatibilidade do patrimônio ──────────────────────────────────
-- Quem já tinha só o total continua funcionando: o estudo soma as classes
-- quando elas existem e cai no patrimonio_total quando não existem.
comment on column public.planejamentos.patrimonio_total is
  'Patrimônio bruto. Se as classes (imóveis, investimentos, empresa, veículos, outros) estiverem preenchidas, o estudo usa a soma delas e este campo vira o total consolidado';
