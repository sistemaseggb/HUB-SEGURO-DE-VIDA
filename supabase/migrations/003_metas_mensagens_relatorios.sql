-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 003: Metas, Mensagens Automáticas e Relatórios
--
-- O que esta migração adiciona:
--   1. Metas mensais (prêmio, reuniões, apólices) com acompanhamento no dashboard
--   2. Fila de mensagens automáticas (aniversários, reativação de leads parados)
--      gerada todo dia pelo banco — com pg_cron, sem depender de ninguém clicar
--   3. Views de relatórios: comissão a pagar por assessor, motivos de perda,
--      tempo médio em cada etapa do funil, KPIs gerais e agenda de reuniões
--   4. Lista inicial de seguradoras (ajuste os percentuais em Cadastros!)
--
-- Como usar: rode APÓS a 001 e a 002, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. METAS MENSAIS (editáveis em Cadastros)
-- ----------------------------------------------------------------------------

alter table public.configuracoes
  add column meta_premio_mensal    numeric(12,2) not null default 0,
  add column meta_reunioes_mensal  int not null default 0,
  add column meta_apolices_mensal  int not null default 0;

-- ----------------------------------------------------------------------------
-- 2. FILA DE MENSAGENS AUTOMÁTICAS
--    O banco gera as mensagens prontas (texto incluído); a Central de Mensagens
--    do sistema mostra tudo com botão de WhatsApp de 1 clique. Com o pg_cron
--    ativo, a fila se abastece sozinha todos os dias às 8h.
-- ----------------------------------------------------------------------------

create type public.status_mensagem as enum ('pendente', 'enviada', 'descartada');

create table public.fila_mensagens (
  id           uuid primary key default gen_random_uuid(),
  id_cliente   uuid references public.clientes(id) on delete cascade,
  tipo         text not null,
    -- 'aniversario_cliente' | 'aniversario_apolice' | 'lead_parado' | 'manual'
  telefone     text,
  mensagem     text not null,
  data_alvo    date not null default current_date,
  status       public.status_mensagem not null default 'pendente',
  enviada_em   timestamptz,
  created_at   timestamptz not null default now()
);

create unique index idx_fila_sem_duplicata
  on public.fila_mensagens (id_cliente, tipo, data_alvo);
create index idx_fila_pendentes on public.fila_mensagens (status) where status = 'pendente';

alter table public.fila_mensagens enable row level security;
create policy "acesso_total_autenticado" on public.fila_mensagens
  for all to authenticated using (true) with check (true);

-- Gera as mensagens do dia. Retorna quantas foram criadas.
-- Idempotente: rodar duas vezes no mesmo dia não duplica nada.
create or replace function public.fn_gerar_fila_diaria()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  criadas int := 0;
  inseriu int;
  r record;
begin
  -- Aniversários de clientes HOJE
  for r in
    select c.id, c.nome, c.telefone
      from public.clientes c
     where c.data_nascimento is not null
       and public.fn_proximo_aniversario(c.data_nascimento) = current_date
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'aniversario_cliente', r.telefone,
      'Olá ' || split_part(r.nome, ' ', 1) ||
      '! 🎉 Passando para te desejar um feliz aniversário! Que seja um ano cheio de saúde e conquistas. Um abraço, Natália.')
    on conflict do nothing;
    get diagnostics inseriu = row_count;
    criadas := criadas + inseriu;
  end loop;

  -- Aniversários de apólice HOJE (momento ideal de revisão/upsell)
  for r in
    select distinct c.id, c.nome, c.telefone
      from public.apolices a
      join public.clientes c on c.id = a.id_cliente
     where a.status = 'ativa'
       and public.fn_proximo_aniversario(a.data_vigencia) = current_date
       and a.data_vigencia < current_date
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'aniversario_apolice', r.telefone,
      'Olá ' || split_part(r.nome, ' ', 1) ||
      '! Sua apólice está completando mais um ano 🎉 Que tal marcarmos uma conversa rápida para revisar se a proteção continua ideal para o seu momento? Abraço, Natália.')
    on conflict do nothing;
    get diagnostics inseriu = row_count;
    criadas := criadas + inseriu;
  end loop;

  -- Leads parados além do alerta vermelho (reativação — no máximo 1 pendente por cliente)
  for r in
    select p.id, p.nome, p.telefone
      from public.vw_pipeline p
      cross join public.configuracoes cfg
     where p.dias_na_etapa >= cfg.dias_alerta_vermelho
       and p.status_funil not in ('fechado', 'perdido')
       and not exists (
         select 1 from public.fila_mensagens f
          where f.id_cliente = p.id and f.tipo = 'lead_parado' and f.status = 'pendente'
       )
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'lead_parado', r.telefone,
      'Olá ' || split_part(r.nome, ' ', 1) ||
      '! Aqui é a Natália 😊 Estava organizando minha agenda e lembrei de você. Podemos retomar nossa conversa sobre a sua proteção? Tenho um horário livre esta semana.')
    on conflict do nothing;
    get diagnostics inseriu = row_count;
    criadas := criadas + inseriu;
  end loop;

  return criadas;
end;
$$;

revoke all on function public.fn_gerar_fila_diaria() from public;
grant execute on function public.fn_gerar_fila_diaria() to authenticated;

-- Agendamento diário automático às 08:00 (extensão pg_cron).
-- No Supabase: Database → Extensions → habilite "pg_cron" antes de rodar.
-- Se a extensão não estiver disponível, esta parte apenas avisa e segue —
-- o botão "Gerar mensagens de hoje" na Central de Mensagens faz o mesmo papel.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'hub-fila-mensagens-diaria',
    '0 8 * * *',
    $cron$ select public.fn_gerar_fila_diaria(); $cron$
  );
  raise notice 'pg_cron agendado: fila de mensagens gerada todo dia às 08:00.';
exception when others then
  raise notice 'pg_cron indisponível (%). Use o botão "Gerar mensagens de hoje" na Central de Mensagens.', sqlerrm;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. VIEWS DE RELATÓRIOS GERENCIAIS
-- ----------------------------------------------------------------------------

-- 3.1 Comissão a pagar por assessor, mês a mês (relatório de fechamento)
create or replace view public.vw_comissoes_assessor_mensal as
select
  date_trunc('month', ap.created_at)::date as mes,
  a.id   as id_assessor,
  a.nome as nome_assessor,
  count(ap.id)                     as vendas,
  sum(ap.valor_premio_mensal)      as premio_mensal_total,
  sum(ap.comissao_assessor)        as comissao_a_pagar
from public.apolices ap
join public.clientes c  on c.id = ap.id_cliente
join public.assessores a on a.id = c.id_assessor
group by 1, a.id, a.nome
order by 1 desc, comissao_a_pagar desc;

-- 3.2 Motivos de perda (onde o funil está vazando)
create or replace view public.vw_motivos_perda as
select
  coalesce(nullif(trim(motivo_perda), ''), '(sem motivo registrado)') as motivo,
  count(*) as total
from public.clientes
where status_funil = 'perdido'
group by 1
order by total desc;

-- 3.3 Tempo médio em cada etapa (do histórico automático do funil)
create or replace view public.vw_tempo_medio_etapa as
with duracoes as (
  select
    h.etapa_nova as etapa,
    extract(epoch from (
      lead(h.mudou_em) over (partition by h.id_cliente order by h.mudou_em) - h.mudou_em
    )) / 86400.0 as dias
  from public.historico_funil h
)
select
  etapa,
  public.fn_ordem_etapa(etapa) as ordem,
  round(avg(dias)::numeric, 1) as dias_medios,
  count(*)                     as passagens
from duracoes
where dias is not null
group by etapa
order by ordem;

-- 3.4 KPIs gerais (linha única para o dashboard)
create or replace view public.vw_kpis_gerais as
select
  (select count(*) from public.clientes)                                          as total_clientes,
  (select count(*) from public.clientes where status_funil = 'fechado')           as total_fechados,
  (select count(*) from public.clientes where status_funil = 'perdido')           as total_perdidos,
  case when (select count(*) from public.clientes where status_funil in ('fechado','perdido')) > 0
    then round(
      (select count(*) from public.clientes where status_funil = 'fechado')::numeric
      / (select count(*) from public.clientes where status_funil in ('fechado','perdido')) * 100, 1)
    else 0 end                                                                    as taxa_conversao_pct,
  (select round(avg(valor_premio_mensal), 2) from public.apolices)                as ticket_medio_premio,
  (select round(avg(extract(epoch from (h.mudou_em - c.created_at)) / 86400.0)::numeric, 1)
     from public.historico_funil h
     join public.clientes c on c.id = h.id_cliente
    where h.etapa_nova = 'fechado')                                               as dias_medios_ate_fechar,
  (select coalesce(sum(capital_segurado), 0) from public.apolices
    where status = 'ativa')                                                       as capital_total_carteira;

-- 3.5 Agenda de reuniões (com dados do cliente prontos)
create or replace view public.vw_agenda_reunioes as
select
  r.id,
  r.data_hora,
  r.status,
  r.notas,
  c.id       as id_cliente,
  c.nome     as nome_cliente,
  c.telefone,
  c.status_funil,
  a.nome     as nome_assessor
from public.reunioes r
join public.clientes c   on c.id = r.id_cliente
join public.assessores a on a.id = c.id_assessor;

-- ----------------------------------------------------------------------------
-- 4. LISTA INICIAL DE SEGURADORAS
--    ⚠️ Percentuais são valores de mercado APROXIMADOS apenas para começar —
--    AJUSTE cada um no módulo Cadastros antes de registrar vendas!
-- ----------------------------------------------------------------------------

insert into public.seguradoras (nome, comissao_padrao_percentual) values
  ('Prudential do Brasil', 40.00),
  ('MAG Seguros (Mongeral Aegon)', 40.00),
  ('Icatu Seguros', 35.00),
  ('MetLife', 35.00),
  ('Omint Seguros', 30.00),
  ('SulAmérica', 30.00),
  ('Bradesco Vida e Previdência', 30.00),
  ('Porto Seguro Vida', 30.00),
  ('Azos', 30.00),
  ('Unimed Seguros', 30.00)
on conflict (nome) do nothing;

-- ----------------------------------------------------------------------------
-- 5. SUPORTE À IMPORTAÇÃO DE DADOS HISTÓRICOS (planilhas)
--    Registros marcados como importados NÃO disparam as automações de novo
--    lead / nova venda — evita gerar tarefas e formulários para dados antigos.
-- ----------------------------------------------------------------------------

alter table public.clientes add column importado boolean not null default false;
alter table public.apolices add column importada boolean not null default false;

create or replace function public.fn_auto_novo_lead()
returns trigger
language plpgsql
as $$
begin
  if new.importado then
    return new;  -- dado histórico: sem tarefa de primeiro contato
  end if;
  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id, 'Fazer primeiro contato com ' || new.nome,
          'contato', current_date + 1, true);
  return new;
end;
$$;

create or replace function public.fn_auto_venda_fechada()
returns trigger
language plpgsql
as $$
begin
  -- Mesmo importada, a apólice fecha o cliente no funil (estado verdadeiro)
  update public.clientes
     set status_funil = 'fechado'
   where id = new.id_cliente
     and status_funil <> 'fechado';

  if new.importada then
    return new;  -- dado histórico: sem formulário nem régua de boas-vindas
  end if;

  insert into public.formularios_onboarding (id_cliente) values (new.id_cliente);

  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica) values
    (new.id_cliente, 'Enviar link do formulário de onboarding ao cliente',
     'formulario', current_date, true),
    (new.id_cliente, 'Mensagem de boas-vindas + confirmar recebimento da apólice',
     'pos_venda', current_date + 7, true),
    (new.id_cliente, 'Revisão anual da apólice (reajuste/novas necessidades)',
     'revisao', new.data_vigencia + interval '11 months', true);

  return new;
end;
$$;
