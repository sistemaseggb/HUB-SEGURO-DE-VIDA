-- ─────────────────────────────────────────────────────────────────────────────
-- 025 — A SUBSCRIÇÃO E QUEM RECEBE
--
-- O sistema sabia dimensionar a apólice e, desde a 024, estimar o preço dela.
-- Duas perguntas continuavam sem dono, e as duas derrubam venda JÁ FEITA:
--
--   1. "ISSO SAI?" — o estudo prometia capital sem saber nada sobre o que a
--      seguradora vai exigir para emitir. Capital alto pede exame, perfil
--      financeiro e, acima do limite de retenção, resseguro facultativo: são
--      semanas, às vezes meses. Motociclista, piloto e quem trabalha em altura
--      recebem agravo ou têm cobertura de acidente restrita. Prometer "sai em
--      uma semana" e entregar 60 dias com agravo é como uma venda ganha morre
--      — e ela morre depois da comemoração, que é a pior hora.
--
--   2. "QUEM RECEBE?" — o capital segurado NÃO é herança (CC art. 794): não
--      entra em inventário, não paga ITCMD e não responde por dívida do
--      segurado. É o alicerce do capítulo de sucessão da proposta, e o sistema
--      nunca guardou uma linha sobre a indicação de beneficiário — que é
--      justamente onde o dinheiro trava na prática. Beneficiário MENOR é o caso
--      clássico: a seguradora paga, mas o uso do dinheiro costuma depender de
--      alvará judicial, e a família espera meses pelo capital que existia
--      exatamente para não esperar.
--
-- Tudo aqui é opcional. Sem preencher nada, o estudo continua igual — só sem
-- os dois capítulos novos. As telas detectam a coluna antes de mostrar o bloco,
-- como no resto do sistema.
-- ─────────────────────────────────────────────────────────────────────────────

alter table planejamentos
  -- ── Subscrição ─────────────────────────────────────────────────────────────
  -- Atividades que mudam a análise de risco. Lista de ids fechada, tratada em
  -- src/lib/subscricao.js: ['moto','aviacao','mergulho','altura','escalada',
  -- 'paraquedismo','automobilismo','artes_marciais','caca_submarina']
  add column if not exists atividades_risco jsonb not null default '[]'::jsonb,

  -- Altura e peso: o IMC é um dos poucos números que a seguradora calcula
  -- sozinha a partir da DPS e que muda o prêmio sem o cliente perceber.
  add column if not exists altura_cm integer,
  add column if not exists peso_kg   numeric(5,1),

  -- O que ele declarou de saúde, em texto livre. Não é diagnóstico e não vira
  -- conta: serve para a consultora antecipar o que a análise vai pedir.
  add column if not exists condicoes_declaradas text,

  -- ── Beneficiários ──────────────────────────────────────────────────────────
  -- [{ nome, parentesco, pct, nascimento }]
  -- O percentual é do capital de MORTE. `nascimento` existe para o sistema
  -- saber sozinho quem ainda é menor — e continuar sabendo no ano que vem.
  add column if not exists beneficiarios jsonb not null default '[]'::jsonb;

comment on column planejamentos.atividades_risco is
  'Atividades de risco declaradas (ids fechados, ver src/lib/subscricao.js). '
  'Mudam agravo, exigências e restrições de cobertura de acidente.';
comment on column planejamentos.altura_cm is
  'Altura em cm. Com o peso, forma o IMC — que a seguradora calcula na DPS.';
comment on column planejamentos.peso_kg is
  'Peso em kg. Com a altura, forma o IMC.';
comment on column planejamentos.condicoes_declaradas is
  'Condições de saúde declaradas, em texto livre. Antecipa o que a análise vai pedir; '
  'não é diagnóstico e não entra em nenhum cálculo.';
comment on column planejamentos.beneficiarios is
  'Indicação de beneficiários do capital de morte: [{nome, parentesco, pct, nascimento}]. '
  'CC art. 794: o capital não é herança. Sem indicação válida, CC art. 792 manda metade '
  'ao cônjuge e o resto aos herdeiros legais.';

-- Faixas plausíveis. Sem elas, um "180" digitado no campo de peso vira um IMC
-- de obesidade mórbida e o sistema passa a avisar de um agravo que não existe.
alter table planejamentos
  drop constraint if exists planejamentos_altura_valida;
alter table planejamentos
  add constraint planejamentos_altura_valida
  check (altura_cm is null or (altura_cm between 100 and 250));

alter table planejamentos
  drop constraint if exists planejamentos_peso_valido;
alter table planejamentos
  add constraint planejamentos_peso_valido
  check (peso_kg is null or (peso_kg between 20 and 400));

-- As duas colunas jsonb precisam ser LISTA. Um objeto solto gravado por engano
-- quebraria o `.map()` de quem lê — e quem lê é a tela do meio da reunião.
alter table planejamentos
  drop constraint if exists planejamentos_atividades_lista;
alter table planejamentos
  add constraint planejamentos_atividades_lista
  check (jsonb_typeof(atividades_risco) = 'array');

alter table planejamentos
  drop constraint if exists planejamentos_beneficiarios_lista;
alter table planejamentos
  add constraint planejamentos_beneficiarios_lista
  check (jsonb_typeof(beneficiarios) = 'array');
