-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 006: Interações, Retenção e Carteira
--
-- O que esta migração adiciona:
--   1. Registro de interações por cliente (linha do tempo de contatos)
--   2. "Último contato" e alerta de clientes ativos esquecidos (retenção)
--   3. Mensagens automáticas com TEXTOS EDITÁVEIS + lembrete de reunião amanhã
--   4. Follow-up automático quando a proposta é apresentada
--   5. Views de carteira para o pós-venda (receita recorrente, por seguradora)
--
-- Como usar: rode APÓS as migrações 001–005.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. INTERAÇÕES (linha do tempo de contatos do cliente)
-- ----------------------------------------------------------------------------

create table public.interacoes (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null default 'nota',   -- 'ligacao'|'whatsapp'|'email'|'reuniao'|'nota'
  descricao   text not null,
  data        timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_interacoes_cliente on public.interacoes (id_cliente, data desc);

alter table public.interacoes enable row level security;
create policy "acesso_total_autenticado" on public.interacoes
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 2. ÚLTIMO CONTATO + DIAS SEM CONTATO (por cliente)
--    Considera interações registradas E reuniões realizadas.
-- ----------------------------------------------------------------------------

create or replace view public.vw_clientes_contato as
select
  c.id,
  c.nome,
  c.codigo,
  c.telefone,
  c.status_funil,
  lc.ultimo_contato,
  case when lc.ultimo_contato is null then null
       else (current_date - lc.ultimo_contato::date) end as dias_sem_contato
from public.clientes c
left join lateral (
  select max(d) as ultimo_contato from (
    select data      as d from public.interacoes where id_cliente = c.id
    union all
    select data_hora as d from public.reunioes  where id_cliente = c.id and status = 'realizada'
  ) x
) lc on true;

-- Limite (em dias) para considerar um cliente ativo "esquecido"
alter table public.configuracoes
  add column dias_sem_contato_alerta int not null default 90;

-- Clientes com apólice ativa que não têm contato há mais que o limite.
create or replace view public.vw_clientes_sem_contato as
select
  cc.id,
  cc.nome,
  cc.codigo,
  cc.telefone,
  cc.ultimo_contato,
  cc.dias_sem_contato
from public.vw_clientes_contato cc
cross join public.configuracoes cfg
where exists (
  select 1 from public.apolices a where a.id_cliente = cc.id and a.status = 'ativa'
)
and (cc.dias_sem_contato is null or cc.dias_sem_contato >= cfg.dias_sem_contato_alerta)
order by cc.dias_sem_contato desc nulls first;

-- ----------------------------------------------------------------------------
-- 3. MENSAGENS AUTOMÁTICAS EDITÁVEIS
--    Os textos saem de configuracoes; use {nome} e {quando} como marcadores.
-- ----------------------------------------------------------------------------

alter table public.configuracoes
  add column msg_aniversario         text not null default 'Olá {nome}! 🎉 Passando para te desejar um feliz aniversário! Que seja um ano cheio de saúde e conquistas. Um abraço, Natália.',
  add column msg_aniversario_apolice text not null default 'Olá {nome}! Sua apólice está completando mais um ano 🎉 Que tal marcarmos uma conversa rápida para revisar se a proteção continua ideal para o seu momento? Abraço, Natália.',
  add column msg_lead_parado         text not null default 'Olá {nome}! Aqui é a Natália 😊 Estava organizando minha agenda e lembrei de você. Podemos retomar nossa conversa sobre a sua proteção? Tenho um horário livre esta semana.',
  add column msg_reuniao             text not null default 'Olá {nome}! Passando para confirmar nossa reunião de {quando}. Até lá! Abraço, Natália.';

-- Recria o gerador diário usando os textos editáveis + lembrete de reunião.
create or replace function public.fn_gerar_fila_diaria()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  criadas int := 0;
  inseriu int;
  cfg public.configuracoes%rowtype;
  r record;
begin
  select * into cfg from public.configuracoes where id = 1;

  -- Aniversários de clientes HOJE
  for r in
    select c.id, c.nome, c.telefone
      from public.clientes c
     where c.data_nascimento is not null
       and public.fn_proximo_aniversario(c.data_nascimento) = current_date
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'aniversario_cliente', r.telefone,
            replace(cfg.msg_aniversario, '{nome}', split_part(r.nome, ' ', 1)))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  -- Aniversários de apólice HOJE
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
            replace(cfg.msg_aniversario_apolice, '{nome}', split_part(r.nome, ' ', 1)))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  -- Leads parados além do alerta vermelho
  for r in
    select p.id, p.nome, p.telefone
      from public.vw_pipeline p
     where p.dias_na_etapa >= cfg.dias_alerta_vermelho
       and p.status_funil not in ('fechado', 'perdido')
       and not exists (
         select 1 from public.fila_mensagens f
          where f.id_cliente = p.id and f.tipo = 'lead_parado' and f.status = 'pendente'
       )
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'lead_parado', r.telefone,
            replace(cfg.msg_lead_parado, '{nome}', split_part(r.nome, ' ', 1)))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  -- Lembrete de reuniões marcadas para AMANHÃ (confirmação)
  for r in
    select distinct c.id, c.nome, c.telefone,
           min(re.data_hora) as quando
      from public.reunioes re
      join public.clientes c on c.id = re.id_cliente
     where re.status = 'agendada'
       and re.data_hora::date = current_date + 1
     group by c.id, c.nome, c.telefone
  loop
    insert into public.fila_mensagens (id_cliente, tipo, telefone, mensagem)
    values (r.id, 'reuniao_lembrete', r.telefone,
            replace(replace(cfg.msg_reuniao, '{nome}', split_part(r.nome, ' ', 1)),
                    '{quando}', to_char(r.quando, 'DD/MM "às" HH24:MI')))
    on conflict do nothing;
    get diagnostics inseriu = row_count; criadas := criadas + inseriu;
  end loop;

  return criadas;
end;
$$;

revoke all on function public.fn_gerar_fila_diaria() from public;
grant execute on function public.fn_gerar_fila_diaria() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. FOLLOW-UP AUTOMÁTICO DA PROPOSTA
--    Ao entrar em "Proposta Apresentada", cria tarefa de retorno em 3 dias.
-- ----------------------------------------------------------------------------

create or replace function public.fn_auto_proposta()
returns trigger
language plpgsql
as $$
begin
  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id, 'Follow-up da proposta com ' || new.nome,
          'pos_venda', current_date + 3, true);
  return new;
end;
$$;

create trigger trg_auto_proposta
  after update on public.clientes
  for each row
  when (old.status_funil is distinct from new.status_funil
        and new.status_funil = 'proposta_apresentada')
  execute function public.fn_auto_proposta();

-- ----------------------------------------------------------------------------
-- 5. VIEWS DE CARTEIRA (pós-venda)
-- ----------------------------------------------------------------------------

create or replace view public.vw_carteira as
select
  count(*)                                   as apolices_ativas,
  coalesce(sum(valor_premio_mensal), 0)      as receita_mensal_recorrente,
  coalesce(sum(valor_premio_mensal) * 12, 0) as receita_anualizada,
  coalesce(sum(capital_segurado), 0)         as capital_total,
  coalesce(sum(comissao_natalia), 0)         as comissao_natalia_carteira,
  coalesce(round(avg(valor_premio_mensal), 2), 0) as ticket_medio
from public.apolices
where status = 'ativa';

create or replace view public.vw_carteira_seguradora as
select
  s.nome,
  count(a.id)                            as apolices,
  coalesce(sum(a.valor_premio_mensal),0) as premio_mensal,
  coalesce(sum(a.capital_segurado),0)    as capital_total
from public.apolices a
join public.seguradoras s on s.id = a.id_seguradora
where a.status = 'ativa'
group by s.nome
order by premio_mensal desc;
