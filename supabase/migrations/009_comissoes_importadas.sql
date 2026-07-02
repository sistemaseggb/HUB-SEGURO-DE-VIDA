-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 009: Comissões importadas das seguradoras
--
-- O que esta migração adiciona:
--   1. Tabela comissoes_importadas: cada linha de comissão vinda das planilhas
--      mensais das seguradoras (Azos, Icatu, MAG, Omint...), já normalizada
--      pelo importador — valores, competência, produção (Nati/Bruno), assessor
--      e tipo de receita (recorrente × venda nova × campanha).
--   2. View vw_comissoes_importadas_resumo: fechamento por competência,
--      seguradora e produção, pronta para os Relatórios.
--
-- Regra de negócio: as planilhas chegam com a produção da Natália E do Bruno
-- juntas. Nada é excluído — a coluna "producao" separa. Estornos entram com
-- valor negativo e já saem abatidos dos totais.
--
-- Como usar: rode APÓS a 008, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create table public.comissoes_importadas (
  id               uuid primary key default gen_random_uuid(),
  competencia      date not null,            -- sempre dia 1º do mês (2026-05-01)
  seguradora       text not null,            -- nome normalizado (Azos, Icatu, MAG...)
  segmento         text not null default 'individual',
    -- 'individual' | 'empresarial' | 'campanha'
  tipo_receita     text not null default 'recorrente',
    -- 'recorrente' | 'venda_nova' | 'campanha'
  cliente_nome     text not null,
  codigo_cliente   text,
  id_cliente       uuid references public.clientes(id) on delete set null,
  codigo_assessor  text,
  id_assessor      uuid references public.assessores(id) on delete set null,
  producao         text,                     -- 'Nati' | 'Bruno' | null (a classificar)
  parcela          int,
  valor            numeric(12,2) not null,   -- negativo = estorno
  origem           text not null default 'planilha',  -- arquivo/planilha de origem
  criado_em        timestamptz not null default now()
);

create index idx_comissoes_importadas_competencia
  on public.comissoes_importadas (competencia, seguradora);
create index idx_comissoes_importadas_assessor
  on public.comissoes_importadas (id_assessor);

alter table public.comissoes_importadas enable row level security;
create policy "acesso_total_autenticado" on public.comissoes_importadas
  for all to authenticated using (true) with check (true);

-- Fechamento mensal: uma linha por competência × seguradora × produção × receita
create or replace view public.vw_comissoes_importadas_resumo as
select
  competencia,
  seguradora,
  coalesce(producao, 'A classificar') as producao,
  tipo_receita,
  count(*)                            as lancamentos,
  count(distinct cliente_nome)        as clientes,
  sum(valor)                          as total
from public.comissoes_importadas
group by competencia, seguradora, coalesce(producao, 'A classificar'), tipo_receita;
