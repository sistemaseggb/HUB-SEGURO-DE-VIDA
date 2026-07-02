-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 008: Integração com a Agenda do Outlook
--
-- Traz as reuniões da agenda da Natália (Microsoft 365) para o Hub, mão única.
-- A "ponte" (Edge Function) lê o Outlook via Microsoft Graph e, para cada
-- evento, chama fn_sync_evento_outlook aqui. A lógica de casar o evento com o
-- cliente certo mora no banco:
--   - Se algum PARTICIPANTE do evento tem e-mail igual ao de um cliente →
--     cria/atualiza a reunião automaticamente (e o funil avança sozinho).
--   - Se não casar → o evento fica numa CAIXA DE ENTRADA para a Natália
--     vincular ao cliente com 1 clique (ou ignorar, se não for de cliente).
--
-- Como usar: rode APÓS as migrações 001–007.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONFIGURAÇÃO DA INTEGRAÇÃO
-- ----------------------------------------------------------------------------

alter table public.configuracoes
  add column outlook_email       text,                    -- caixa de e-mail da Natália (UPN)
  add column outlook_sync_ativo  boolean not null default false,
  add column outlook_ultima_sync timestamptz;

-- Marca a origem das reuniões (manual x importada do Outlook)
alter table public.reunioes
  add column origem text not null default 'manual';       -- 'manual' | 'outlook'

-- ----------------------------------------------------------------------------
-- 2. EVENTOS VINDOS DO OUTLOOK (staging + caixa de entrada)
-- ----------------------------------------------------------------------------

create table public.agenda_externa (
  id             uuid primary key default gen_random_uuid(),
  outlook_id     text not null unique,       -- id do evento no Outlook (evita duplicar)
  assunto        text,
  inicio         timestamptz not null,
  fim            timestamptz,
  organizador    text,
  participantes  jsonb not null default '[]',
  id_cliente     uuid references public.clientes(id) on delete set null,
  id_reuniao     uuid references public.reunioes(id) on delete set null,
  status         text not null default 'nova',  -- 'nova' | 'vinculada' | 'ignorada'
  sincronizado_em timestamptz not null default now()
);

create index idx_agenda_externa_status on public.agenda_externa (status);

alter table public.agenda_externa enable row level security;
create policy "acesso_total_autenticado" on public.agenda_externa
  for all to authenticated using (true) with check (true);

-- Caixa de entrada: eventos ainda não vinculados a um cliente
create or replace view public.vw_agenda_externa_pendentes as
select id, outlook_id, assunto, inicio, fim, organizador, participantes, sincronizado_em
from public.agenda_externa
where status = 'nova'
order by inicio;

-- ----------------------------------------------------------------------------
-- 3. FUNÇÃO CHAMADA PELA PONTE (Edge Function) A CADA EVENTO
--    Faz upsert do evento e tenta casar com um cliente pelo e-mail.
-- ----------------------------------------------------------------------------

create or replace function public.fn_sync_evento_outlook(
  p_outlook_id    text,
  p_assunto       text,
  p_inicio        timestamptz,
  p_fim           timestamptz,
  p_organizador   text,
  p_emails        text[]        -- e-mails dos participantes
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente public.agenda_externa%rowtype;
  v_id_cliente uuid;
  v_id_reuniao uuid;
begin
  -- tenta casar por e-mail de participante = e-mail de cliente
  select id into v_id_cliente
    from public.clientes
   where email is not null
     and lower(email) = any (select lower(x) from unnest(p_emails) as x)
   limit 1;

  select * into v_existente from public.agenda_externa where outlook_id = p_outlook_id;

  -- JÁ EXISTE: atualiza dados; se estava vinculada, reflete no horário da reunião
  if found then
    update public.agenda_externa
       set assunto = p_assunto, inicio = p_inicio, fim = p_fim,
           organizador = p_organizador, participantes = to_jsonb(p_emails),
           sincronizado_em = now()
     where outlook_id = p_outlook_id;

    if v_existente.status = 'vinculada' and v_existente.id_reuniao is not null then
      update public.reunioes set data_hora = p_inicio, notas = p_assunto
       where id = v_existente.id_reuniao;
    end if;
    return v_existente.status;
  end if;

  -- NOVO evento
  if v_id_cliente is not null then
    -- casou com cliente → cria a reunião (o gatateway do funil avança sozinho)
    insert into public.reunioes (id_cliente, data_hora, notas, origem)
    values (v_id_cliente, p_inicio, p_assunto, 'outlook')
    returning id into v_id_reuniao;

    insert into public.agenda_externa
      (outlook_id, assunto, inicio, fim, organizador, participantes, id_cliente, id_reuniao, status)
    values
      (p_outlook_id, p_assunto, p_inicio, p_fim, p_organizador, to_jsonb(p_emails), v_id_cliente, v_id_reuniao, 'vinculada');
    return 'vinculada';
  else
    -- não casou → caixa de entrada
    insert into public.agenda_externa
      (outlook_id, assunto, inicio, fim, organizador, participantes, status)
    values
      (p_outlook_id, p_assunto, p_inicio, p_fim, p_organizador, to_jsonb(p_emails), 'nova');
    return 'nova';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. VINCULAR MANUALMENTE um evento da caixa de entrada a um cliente
-- ----------------------------------------------------------------------------

create or replace function public.fn_vincular_evento(
  p_evento_id  uuid,
  p_cliente_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev public.agenda_externa%rowtype;
  v_id_reuniao uuid;
begin
  select * into v_ev from public.agenda_externa where id = p_evento_id;
  if not found then raise exception 'evento não encontrado'; end if;

  insert into public.reunioes (id_cliente, data_hora, notas, origem)
  values (p_cliente_id, v_ev.inicio, v_ev.assunto, 'outlook')
  returning id into v_id_reuniao;

  update public.agenda_externa
     set id_cliente = p_cliente_id, id_reuniao = v_id_reuniao, status = 'vinculada'
   where id = p_evento_id;
end;
$$;

grant execute on function public.fn_sync_evento_outlook(text, text, timestamptz, timestamptz, text, text[]) to authenticated, service_role;
grant execute on function public.fn_vincular_evento(uuid, uuid) to authenticated;
