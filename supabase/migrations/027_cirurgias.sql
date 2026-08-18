-- ─────────────────────────────────────────────────────────────────────────────
-- 027 — CIRURGIAS: a cobertura que faltava no catálogo
--
-- O estudo cobria bem os dois extremos do "pagar em vida": a doença grave, que
-- é o diagnóstico que muda a vida, e a diária, que repõe renda por dia parado.
-- Faltava exatamente o que acontece no MEIO e é o mais frequente dos três: a
-- cirurgia.
--
-- É a cobertura que resolve o buraco que o cliente conhece de perto — o plano
-- de saúde cobre o procedimento e não cobre o resto: coparticipação, material
-- fora do rol, o honorário do cirurgião de escolha dele, o acompanhante, o
-- deslocamento e as semanas de recuperação sem faturar. Ela indeniza por
-- procedimento, conforme a tabela cirúrgica da apólice, e paga com o segurado
-- vivo, em dias.
--
-- Sem ela, o capítulo "a maior parte paga em vida" da apresentação tinha três
-- linhas onde devia ter quatro — e a objeção "eu já tenho plano de saúde"
-- ficava sem a resposta mais concreta que existe.
--
-- Como no resto do sistema: a coluna é opcional e as telas detectam se ela
-- existe antes de oferecer a cobertura. Uma instalação que não aplicou esta
-- migração continua funcionando, só sem Cirurgias.
-- ─────────────────────────────────────────────────────────────────────────────

alter table planejamentos
  -- Capital da tabela cirúrgica: é o TETO da cobertura, não o valor de cada
  -- procedimento. A apólice paga um percentual dele por cirurgia, conforme o
  -- porte do procedimento — por isso o estudo sugere ~3× a renda mensal e
  -- respeita o teto de mercado (ver CIRURGIAS_TETO em src/lib/estudo.js).
  add column if not exists capital_cirurgias numeric(14,2);

comment on column planejamentos.capital_cirurgias is
  'Cirurgias: capital máximo da tabela cirúrgica. A apólice indeniza um percentual dele por procedimento. Vazio = usar a sugestão do estudo.';
