-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 024: a proposta dentro da seguradora
--
-- O funil sempre teve a etapa "Em Análise", e ela sempre foi uma CAIXA PRETA.
-- O cliente disse sim, a proposta foi enviada — e a partir daí o sistema só
-- sabia dizer "Retomar contato para fechar". Não sabia se a seguradora está
-- esperando um exame, se o cliente não respondeu a DPS, se a apólice já foi
-- aprovada e falta emitir, ou se a proposta foi recusada semanas atrás.
--
-- É exatamente onde o negócio morre. O cliente já decidiu, já disse sim, já
-- está convencido — e o processo trava numa pendência que ninguém cobrou. Sai
-- mais caro perder um cliente aqui do que na primeira reunião: aqui o trabalho
-- já foi todo feito.
--
-- ── O que esta migração guarda ──────────────────────────────────────────────
--
--   A PROPOSTA como um objeto próprio, com número, seguradora, data de envio,
--   capital, prêmio e situação. Ela não é uma apólice (ainda não existe) nem é
--   só um cliente numa coluna do Kanban.
--
--   AS EXIGÊNCIAS, que são o coração da coisa. Cada pendência guarda O QUE
--   falta, DE QUEM depende e QUANDO foi pedida. Sem o "de quem depende" a
--   lista vira um monte de tarefas sem dono — e a pendência que mata negócio é
--   sempre a que está com o cliente, esperando alguém lembrar de cobrar.
--
--   O MOTIVO DA RECUSA, em texto. Recusa por saúde, por valor, por profissão
--   e por sobreposição pedem conversas diferentes na hora de tentar de novo em
--   outra seguradora — e daqui a seis meses ninguém lembra qual foi.
--
-- ── O que NÃO entra ─────────────────────────────────────────────────────────
--
-- Nada de disparar cobrança sozinho. O sistema mostra o que está parado e há
-- quantos dias; quem decide cobrar o cliente é ela. Uma mensagem automática
-- para quem está esperando resultado de exame é a pior coisa que este sistema
-- poderia mandar.
--
-- Como usar: rode APÓS a 023, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create table if not exists public.propostas_seguradora (
  id                uuid primary key default gen_random_uuid(),
  id_cliente        uuid not null references public.clientes(id) on delete cascade,
  id_seguradora     uuid references public.seguradoras(id) on delete set null,

  numero_proposta   text,
  data_envio        date not null default current_date,
  capital           numeric(14,2),
  premio_mensal     numeric(12,2),

  -- O caminho real de uma proposta de vida. `exigencia` não é uma etapa
  -- separada no tempo: é o estado em que ela fica enquanto falta alguma coisa,
  -- e é o único que costuma durar semanas.
  situacao          text not null default 'enviada'
                    check (situacao in ('enviada', 'em_analise', 'exigencia',
                                        'aprovada', 'emitida', 'recusada', 'desistiu')),

  -- [ { o_que, de_quem: cliente|seguradora|consultora, pedida_em, resolvida_em } ]
  --   `de_quem` é o campo que faz a lista valer alguma coisa: sem ele não dá
  --   para separar "esperando o laboratório" de "o cliente não respondeu".
  exigencias        jsonb not null default '[]'::jsonb,

  motivo_recusa     text,
  observacoes       text,

  -- quando sai a apólice, a proposta aponta para ela e o ciclo fecha
  id_apolice        uuid references public.apolices(id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.propostas_seguradora is
  'A proposta enviada à seguradora e o que falta para a apólice sair. Cobre o vão entre "o cliente disse sim" e "a apólice existe".';
comment on column public.propostas_seguradora.exigencias is
  'Pendências: [{o_que, de_quem (cliente|seguradora|consultora), pedida_em, resolvida_em}]. O "de_quem" é o que separa cobrar do cliente de cobrar a seguradora.';

create index if not exists idx_propostas_cliente on public.propostas_seguradora (id_cliente);
create index if not exists idx_propostas_situacao on public.propostas_seguradora (situacao);

drop trigger if exists trg_propostas_touch on public.propostas_seguradora;
create trigger trg_propostas_touch
  before update on public.propostas_seguradora
  for each row execute function public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- Acesso: mesma política do resto do sistema (usuário autenticado = a equipe)
-- ----------------------------------------------------------------------------
alter table public.propostas_seguradora enable row level security;

drop policy if exists acesso_total_autenticado on public.propostas_seguradora;
create policy acesso_total_autenticado on public.propostas_seguradora
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- A visão que a tela inicial precisa: o que está aberto, há quantos dias, e
-- com quem está a bola. O cálculo de dias fica no BANCO porque a resposta tem
-- que ser a mesma no Dashboard, no cliente e em qualquer relatório futuro.
-- ----------------------------------------------------------------------------
create or replace view public.vw_propostas_abertas as
select
  p.id,
  p.id_cliente,
  c.nome                as cliente_nome,
  c.telefone            as cliente_telefone,
  s.nome                as seguradora_nome,
  p.numero_proposta,
  p.data_envio,
  p.capital,
  p.premio_mensal,
  p.situacao,
  p.exigencias,
  (current_date - p.data_envio)::int as dias_na_seguradora,
  -- pendências ainda abertas (sem `resolvida_em`)
  (
    select count(*)
      from jsonb_array_elements(p.exigencias) e
     where e->>'resolvida_em' is null
  )::int as exigencias_abertas,
  -- há quantos dias a pendência mais antiga está parada
  (
    select max((current_date - (e->>'pedida_em')::date))::int
      from jsonb_array_elements(p.exigencias) e
     where e->>'resolvida_em' is null
       and e->>'pedida_em' is not null
  ) as dias_exigencia_mais_antiga
from public.propostas_seguradora p
join public.clientes c on c.id = p.id_cliente
left join public.seguradoras s on s.id = p.id_seguradora
where p.situacao in ('enviada', 'em_analise', 'exigencia', 'aprovada');

comment on view public.vw_propostas_abertas is
  'Propostas que ainda não viraram apólice nem morreram — com dias parados e pendências abertas.';
