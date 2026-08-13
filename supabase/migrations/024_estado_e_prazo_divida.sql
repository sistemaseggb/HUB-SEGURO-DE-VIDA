-- ─────────────────────────────────────────────────────────────────────────────
-- 024 — O ESTADO DO CLIENTE E O PRAZO DA DÍVIDA
--
-- Dois campos pequenos que corrigem dois erros grandes, encontrados na
-- auditoria de 10.000 planejamentos (scripts/auditoria-planejamento.mjs):
--
--   1. ITCMD assumido em 4% para todo mundo. O imposto é ESTADUAL: 4% em SP,
--      mas 8% no RJ, BA, GO, CE, PE, SC, MT e TO. Sem a UF, o estudo errava a
--      verba sucessória em até o dobro — e errava para MENOS, que é o lado
--      ruim: a família só descobre o buraco no cartório.
--
--   2. Financiamento de 30 anos coberto por um seguro de 10. Sem saber o prazo
--      que ainda falta da dívida, não havia como avisar que a proteção termina
--      antes dela — o erro clássico do seguro temporário curto demais.
--
-- Ambos são opcionais: o estudo continua funcionando sem eles, só que avisando
-- que a premissa foi assumida.
-- ─────────────────────────────────────────────────────────────────────────────

alter table planejamentos
  add column if not exists uf text,
  add column if not exists dividas_prazo_anos integer;

comment on column planejamentos.uf is
  'UF onde estão os bens — define a alíquota de ITCMD usada no estudo. '
  'Vazio: o estudo usa 4% e avisa que assumiu a premissa.';

comment on column planejamentos.dividas_prazo_anos is
  'Anos que ainda faltam da dívida (financiamento imobiliário, normalmente). '
  'Serve para avisar quando os anos de proteção terminam antes do financiamento.';

-- Sigla de estado tem duas letras. A restrição impede que um "São Paulo"
-- digitado por extenso passe e faça a tabela de alíquotas cair no padrão sem
-- ninguém perceber.
alter table planejamentos
  drop constraint if exists planejamentos_uf_valida;
alter table planejamentos
  add constraint planejamentos_uf_valida
  check (uf is null or uf ~ '^[A-Z]{2}$');

alter table planejamentos
  drop constraint if exists planejamentos_prazo_divida_valido;
alter table planejamentos
  add constraint planejamentos_prazo_divida_valido
  check (dividas_prazo_anos is null or (dividas_prazo_anos >= 0 and dividas_prazo_anos <= 60));
