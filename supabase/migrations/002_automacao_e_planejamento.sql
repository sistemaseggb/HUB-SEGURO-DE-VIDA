-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 002: Automação, Planejamento e Onboarding
--
-- O que esta migração adiciona:
--   1. Comissão tripartida automática (Natália / Assessor / Escritório)
--   2. Planejamento financeiro do cliente (dados coletados na reunião)
--   3. Formulário de onboarding embutido (link público seguro por token)
--   4. Motor de automações: tarefas geradas sozinhas pelos triggers
--   5. Views novas para o dashboard robusto
--
-- Como usar: rode APÓS a 001, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONFIGURAÇÕES GLOBAIS (linha única — editável pelo administrador)
-- ----------------------------------------------------------------------------

create table public.configuracoes (
  id                            int primary key default 1 check (id = 1),
  -- Divisão da comissão gerada (precisa somar 100)
  split_natalia_pct             numeric(5,2) not null default 50,
  split_assessor_pct            numeric(5,2) not null default 30,
  split_escritorio_pct          numeric(5,2) not null default 20,
  -- Alertas do Kanban (dias parados na etapa)
  dias_alerta_amarelo           int not null default 5,
  dias_alerta_vermelho          int not null default 10,
  updated_at                    timestamptz not null default now(),
  constraint split_soma_100 check (
    split_natalia_pct + split_assessor_pct + split_escritorio_pct = 100
  )
);

insert into public.configuracoes (id) values (1);

create trigger trg_configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.fn_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. COMISSÃO TRIPARTIDA na apólice
--    O trigger da 001 já calcula comissao_gerada; agora ele também divide
--    entre Natália, assessor e escritório conforme a configuração vigente.
-- ----------------------------------------------------------------------------

alter table public.apolices
  add column comissao_natalia    numeric(12,2),
  add column comissao_assessor   numeric(12,2),
  add column comissao_escritorio numeric(12,2);

create or replace function public.fn_calcular_comissao()
returns trigger
language plpgsql
as $$
declare
  cfg public.configuracoes%rowtype;
begin
  -- Se o percentual não foi informado, herda o padrão da seguradora
  if new.percentual_comissao is null then
    select comissao_padrao_percentual
      into new.percentual_comissao
      from public.seguradoras
     where id = new.id_seguradora;
  end if;

  -- Comissão anualizada: prêmio mensal x 12 x %
  new.comissao_gerada := round(
    new.valor_premio_mensal * 12 * coalesce(new.percentual_comissao, 0) / 100, 2
  );

  -- Divisão automática entre as três partes
  select * into cfg from public.configuracoes where id = 1;
  new.comissao_natalia    := round(new.comissao_gerada * cfg.split_natalia_pct    / 100, 2);
  new.comissao_assessor   := round(new.comissao_gerada * cfg.split_assessor_pct   / 100, 2);
  new.comissao_escritorio := round(new.comissao_gerada * cfg.split_escritorio_pct / 100, 2);

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. PLANEJAMENTO FINANCEIRO (dados coletados na reunião)
--    Um por cliente. O capital sugerido é calculado automaticamente se não
--    for informado: (custo de vida mensal x 12 x anos de proteção) + dívidas.
-- ----------------------------------------------------------------------------

create table public.planejamentos (
  id                    uuid primary key default gen_random_uuid(),
  id_cliente            uuid not null unique references public.clientes(id) on delete cascade,
  profissao             text,
  estado_civil          text,
  renda_mensal          numeric(12,2),
  custo_vida_mensal     numeric(12,2),
  patrimonio_total      numeric(14,2),
  dividas_total         numeric(14,2) default 0,
  num_dependentes       int default 0,
  dependentes           jsonb not null default '[]',  -- [{nome, idade, relacao}]
  anos_protecao         int not null default 10,
  capital_sugerido      numeric(14,2),
  objetivos             text,
  observacoes_reuniao   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_planejamentos_updated_at
  before update on public.planejamentos
  for each row execute function public.fn_touch_updated_at();

create or replace function public.fn_sugerir_capital()
returns trigger
language plpgsql
as $$
begin
  if new.capital_sugerido is null and new.custo_vida_mensal is not null then
    new.capital_sugerido :=
      new.custo_vida_mensal * 12 * new.anos_protecao + coalesce(new.dividas_total, 0);
  end if;
  return new;
end;
$$;

create trigger trg_planejamentos_capital
  before insert or update on public.planejamentos
  for each row execute function public.fn_sugerir_capital();

-- ----------------------------------------------------------------------------
-- 4. TAREFAS (o motor de automação alimenta esta tabela)
-- ----------------------------------------------------------------------------

create table public.tarefas (
  id                uuid primary key default gen_random_uuid(),
  id_cliente        uuid references public.clientes(id) on delete cascade,
  titulo            text not null,
  descricao         text,
  tipo              text not null default 'geral',
    -- 'contato' | 'agendamento' | 'planejamento' | 'formulario'
    -- | 'pos_venda' | 'revisao' | 'geral'
  data_vencimento   date not null default current_date,
  concluida         boolean not null default false,
  concluida_em      timestamptz,
  automatica        boolean not null default false,
  created_at        timestamptz not null default now()
);

create index idx_tarefas_vencimento on public.tarefas (data_vencimento) where not concluida;
create index idx_tarefas_cliente    on public.tarefas (id_cliente);

-- ----------------------------------------------------------------------------
-- 5. FORMULÁRIO DE ONBOARDING (pós-venda, preenchido pelo próprio cliente)
--    O cliente acessa por um link com token único — sem login. O acesso
--    anônimo só funciona pelas funções RPC abaixo (security definer), que
--    exigem o token correto. As respostas ficam em JSONB para o formulário
--    poder evoluir sem migração.
-- ----------------------------------------------------------------------------

create type public.status_formulario as enum ('pendente', 'em_andamento', 'concluido');

create table public.formularios_onboarding (
  id            uuid primary key default gen_random_uuid(),
  id_cliente    uuid not null references public.clientes(id) on delete cascade,
  token         uuid not null unique default gen_random_uuid(),
  status        public.status_formulario not null default 'pendente',
  etapa_atual   int not null default 0,
  respostas     jsonb not null default '{}',
  enviado_em    timestamptz not null default now(),
  iniciado_em   timestamptz,
  concluido_em  timestamptz,
  updated_at    timestamptz not null default now()
);

create index idx_formularios_cliente on public.formularios_onboarding (id_cliente);

create trigger trg_formularios_updated_at
  before update on public.formularios_onboarding
  for each row execute function public.fn_touch_updated_at();

-- RPC pública: carrega o formulário pelo token (o cliente só vê o dele)
create or replace function public.fn_form_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  select fo.id, fo.status, fo.etapa_atual, fo.respostas,
         split_part(c.nome, ' ', 1) as primeiro_nome
    into f
    from public.formularios_onboarding fo
    join public.clientes c on c.id = fo.id_cliente
   where fo.token = p_token;

  if not found then
    return jsonb_build_object('erro', 'formulario_nao_encontrado');
  end if;

  if f.status = 'pendente' then
    update public.formularios_onboarding
       set status = 'em_andamento', iniciado_em = now()
     where token = p_token;
  end if;

  return jsonb_build_object(
    'status', f.status,
    'etapa_atual', f.etapa_atual,
    'respostas', f.respostas,
    'primeiro_nome', f.primeiro_nome
  );
end;
$$;

-- RPC pública: salva o progresso (autosave a cada etapa — o cliente nunca
-- perde o que já preencheu, mesmo fechando o navegador)
create or replace function public.fn_form_salvar(
  p_token uuid,
  p_respostas jsonb,
  p_etapa int,
  p_concluido boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cliente uuid;
begin
  select id, id_cliente into v_id, v_cliente
    from public.formularios_onboarding
   where token = p_token and status <> 'concluido';

  if not found then
    return jsonb_build_object('erro', 'formulario_nao_encontrado_ou_concluido');
  end if;

  update public.formularios_onboarding
     set respostas   = p_respostas,
         etapa_atual = p_etapa,
         status      = case when p_concluido then 'concluido'::public.status_formulario
                            else 'em_andamento'::public.status_formulario end,
         concluido_em = case when p_concluido then now() else null end
   where id = v_id;

  -- Automação: formulário concluído gera tarefa de conferência para a Natália
  if p_concluido then
    insert into public.tarefas (id_cliente, titulo, tipo, automatica)
    values (v_cliente,
            'Conferir formulário preenchido e emitir apólice na seguradora',
            'formulario', true);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Apenas as RPCs ficam expostas ao público anônimo — a tabela em si, não.
revoke all on function public.fn_form_carregar(uuid) from public;
revoke all on function public.fn_form_salvar(uuid, jsonb, int, boolean) from public;
grant execute on function public.fn_form_carregar(uuid) to anon, authenticated;
grant execute on function public.fn_form_salvar(uuid, jsonb, int, boolean) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. MOTOR DE AUTOMAÇÕES (triggers que tiram trabalho manual da Natália)
-- ----------------------------------------------------------------------------

-- Ordem das etapas do funil (para saber o que é "avançar")
create or replace function public.fn_ordem_etapa(e public.status_funil)
returns int
language sql
immutable
as $$
  select case e
    when 'lead_recebido'        then 1
    when 'agendamento'          then 2
    when 'reuniao_realizada'    then 3
    when 'estudo_em_andamento'  then 4
    when 'proposta_apresentada' then 5
    when 'em_analise'           then 6
    when 'fechado'              then 7
    when 'perdido'              then 8
  end;
$$;

-- 6.1 Novo lead cadastrado → tarefa de primeiro contato no dia seguinte
create or replace function public.fn_auto_novo_lead()
returns trigger
language plpgsql
as $$
begin
  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id, 'Fazer primeiro contato com ' || new.nome,
          'contato', current_date + 1, true);
  return new;
end;
$$;

create trigger trg_auto_novo_lead
  after insert on public.clientes
  for each row execute function public.fn_auto_novo_lead();

-- 6.2 Reunião agendada → cliente avança sozinho para "Agendamento"
create or replace function public.fn_auto_reuniao_agendada()
returns trigger
language plpgsql
as $$
begin
  update public.clientes
     set status_funil = 'agendamento'
   where id = new.id_cliente
     and public.fn_ordem_etapa(status_funil) < public.fn_ordem_etapa('agendamento');
  return new;
end;
$$;

create trigger trg_auto_reuniao_agendada
  after insert on public.reunioes
  for each row
  when (new.status = 'agendada')
  execute function public.fn_auto_reuniao_agendada();

-- 6.3 Reunião marcada como realizada → cliente avança para "Reunião Realizada"
--     + tarefa de montar o estudo em até 2 dias
create or replace function public.fn_auto_reuniao_realizada()
returns trigger
language plpgsql
as $$
begin
  update public.clientes
     set status_funil = 'reuniao_realizada'
   where id = new.id_cliente
     and public.fn_ordem_etapa(status_funil) < public.fn_ordem_etapa('reuniao_realizada');

  insert into public.tarefas (id_cliente, titulo, tipo, data_vencimento, automatica)
  values (new.id_cliente,
          'Montar estudo/planejamento com os dados coletados na reunião',
          'planejamento', current_date + 2, true);
  return new;
end;
$$;

create trigger trg_auto_reuniao_realizada
  after update on public.reunioes
  for each row
  when (old.status is distinct from new.status and new.status = 'realizada')
  execute function public.fn_auto_reuniao_realizada();

-- 6.4 Apólice cadastrada (VENDA!) → tudo acontece sozinho:
--     cliente vira "Fechado", formulário de onboarding é criado,
--     e as tarefas de pós-venda entram na régua.
create or replace function public.fn_auto_venda_fechada()
returns trigger
language plpgsql
as $$
begin
  update public.clientes
     set status_funil = 'fechado'
   where id = new.id_cliente
     and status_funil <> 'fechado';

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

create trigger trg_auto_venda_fechada
  after insert on public.apolices
  for each row execute function public.fn_auto_venda_fechada();

-- ----------------------------------------------------------------------------
-- 7. VIEWS NOVAS PARA O DASHBOARD ROBUSTO
-- ----------------------------------------------------------------------------

-- 7.1 Comissões mensais já divididas entre as três partes
create or replace view public.vw_comissoes_mensal as
select
  date_trunc('month', created_at)::date as mes,
  count(*)                        as apolices,
  sum(valor_premio_mensal)        as premio_mensal_total,
  sum(comissao_gerada)            as comissao_total,
  sum(comissao_natalia)           as comissao_natalia,
  sum(comissao_assessor)          as comissao_assessor,
  sum(comissao_escritorio)        as comissao_escritorio
from public.apolices
group by 1
order by 1 desc;

-- 7.2 Contagem do funil (visão macro do pipeline)
create or replace view public.vw_funil_contagem as
select
  status_funil,
  public.fn_ordem_etapa(status_funil) as ordem,
  count(*) as total
from public.clientes
group by status_funil
order by ordem;

-- 7.3 Central do Dia: tudo que precisa de ação AGORA, num lugar só.
--     Tarefas pendentes/atrasadas + aniversários próximos (7 dias)
--     + leads estagnados além do limite configurado.
create or replace view public.vw_central_dia as
(
  select
    'tarefa'::text                        as tipo,
    t.id                                  as id_item,
    t.id_cliente,
    c.nome                                as nome_cliente,
    c.telefone,
    t.titulo,
    t.data_vencimento                     as data_ref,
    (t.data_vencimento < current_date)    as atrasado
  from public.tarefas t
  left join public.clientes c on c.id = t.id_cliente
  where not t.concluida
    and t.data_vencimento <= current_date + 3
)
union all
(
  select
    'aniversario',
    r.id_cliente,
    r.id_cliente,
    r.nome_cliente,
    r.telefone,
    case r.tipo_evento
      when 'aniversario_cliente' then 'Aniversário de ' || r.nome_cliente || ' 🎂'
      else 'Aniversário da apólice de ' || r.nome_cliente
    end,
    r.data_evento,
    false
  from public.vw_regua_relacionamento r
  where r.dias_restantes <= 7
)
union all
(
  select
    'lead_parado',
    p.id,
    p.id,
    p.nome,
    p.telefone,
    p.nome || ' está há ' || p.dias_na_etapa || ' dias parado em "' || p.status_funil || '"',
    current_date,
    true
  from public.vw_pipeline p
  cross join public.configuracoes cfg
  where p.dias_na_etapa >= cfg.dias_alerta_vermelho
    and p.status_funil not in ('fechado', 'perdido')
)
order by atrasado desc, data_ref;

-- ----------------------------------------------------------------------------
-- 8. RLS DAS NOVAS TABELAS
-- ----------------------------------------------------------------------------

alter table public.configuracoes           enable row level security;
alter table public.planejamentos           enable row level security;
alter table public.tarefas                 enable row level security;
alter table public.formularios_onboarding  enable row level security;

create policy "acesso_total_autenticado" on public.configuracoes
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.planejamentos
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.tarefas
  for all to authenticated using (true) with check (true);

create policy "acesso_total_autenticado" on public.formularios_onboarding
  for all to authenticated using (true) with check (true);
