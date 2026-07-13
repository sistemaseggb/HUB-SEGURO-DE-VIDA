-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 016: Filhos com gasto mensal (até os 24)
--
-- O planejamento agora detalha CADA filho: nome, idade e quanto ele custa
-- por mês hoje (escola, saúde, atividades...). A regra do estudo:
--
--   • O gasto com o filho SÓ existe até ele completar 24 anos (fim da
--     faculdade). O capital de proteção reserva exatamente
--     custo_mensal × 12 × (24 − idade) por filho — nem um real a mais.
--   • O custo de vida informado JÁ inclui os filhos; o cálculo separa o
--     gasto deles para não projetá-lo pelo horizonte inteiro do estudo.
--
-- Nenhuma coluna nova: usa a coluna jsonb `dependentes` que existe desde a
-- migração 002 (estava sem uso). Formato de cada item:
--   { "nome": "Lucas", "idade": 9, "custo_mensal": 3500 }
--
-- Esta migração só documenta o formato e garante o default. É segura de
-- rodar a qualquer momento (idempotente).
-- ============================================================================

alter table public.planejamentos
  alter column dependentes set default '[]'::jsonb;

comment on column public.planejamentos.dependentes is
  'Filhos do cliente: [{nome, idade, custo_mensal}]. O estudo garante o custo_mensal de cada um apenas até os 24 anos — depois disso o valor sai do capital de proteção';
