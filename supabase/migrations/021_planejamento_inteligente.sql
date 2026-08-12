-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 021: Planejamento inteligente
--
-- O estudo passou a usar a IDADE do cliente (que já estava em clientes.
-- data_nascimento e nunca tinha sido lida) para calcular a janela real de
-- proteção e o preço de deixar a decisão para depois. Esta migração completa
-- o que faltava no banco para as três frentes novas:
--
--   1. FUMANTE
--      Muda o prêmio de risco de forma relevante (o mercado trabalha entre
--      +50% e +100%) e entra na estimativa do custo da espera. É a diferença
--      entre "esperar te custa 34% a mais" e um número que não bate com a
--      cotação que vai chegar.
--
--   2. APOSENTADORIA E ACÚMULO
--      O foco "aposentadoria e acúmulo" já existia na lista do planejamento
--      e não tinha UMA LINHA de cálculo por trás. Com a renda desejada e a
--      idade-alvo, o estudo passa a mostrar a meta de acúmulo, o que a
--      previdência atual entrega LÍQUIDA DE IR e a lacuna mensal — e o elo
--      que ninguém faz: sem invalidez coberta, o plano de aposentadoria para
--      junto com a renda.
--
--   3. OS SEGUROS QUE ELE JÁ TEM, UM A UM
--      "Já tenho seguro" é a objeção que mais derruba proposta, e o estudo só
--      tinha um número solto (cobertura_atual). Guardando origem e custeio de
--      cada apólice, a consultora mostra o que realmente sobra: seguro de
--      empresa acaba junto com o emprego e o do banco costuma cobrir só o
--      saldo devedor do financiamento — nenhum dos dois protege a família.
--
--   4. QUEM DECIDE E QUANDO
--      Preenchidos automaticamente pela análise da transcrição da reunião.
--      Proposta sem data de retorno esfria em 72 horas.
--
-- A RPC da proposta pública passa a devolver a IDADE do cliente (não a data
-- de nascimento — o cliente não precisa ver menos nem mais do que o cálculo
-- exige). Sem isso, a apresentação aberta pelo link do cliente perderia os
-- capítulos que dependem da idade e ficaria diferente da que foi apresentada
-- na reunião.
--
-- Nenhum trigger recalcula valor nesta migração: foi exatamente o que causou
-- os erros de número corrigidos na 019.
--
-- Como usar: rode APÓS a 020, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- ── 1. Perfil de risco ─────────────────────────────────────────────────────
  add column if not exists fumante boolean not null default false,

  -- ── 2. Aposentadoria e acúmulo ─────────────────────────────────────────────
  -- Quanto ele quer receber por mês quando parar, em valores de hoje.
  add column if not exists renda_desejada_aposentadoria numeric(14,2),
  -- Idade-alvo. 65 é o padrão do estudo quando fica em branco.
  add column if not exists idade_aposentadoria integer,

  -- ── 3. Seguros que já existem ──────────────────────────────────────────────
  -- [{ origem: 'empresa'|'banco'|'individual'|'consignado'|'outro',
  --    descricao: text, capital: number, custeio: 'empresa'|'proprio' }]
  -- O total continua em cobertura_atual: esta coluna é o detalhe que sustenta
  -- a conversa, não uma segunda fonte de verdade.
  add column if not exists seguros_existentes jsonb not null default '[]'::jsonb,

  -- ── 4. Decisão ─────────────────────────────────────────────────────────────
  add column if not exists quem_decide   text,
  add column if not exists prazo_decisao text;

comment on column public.planejamentos.fumante is
  'Fumante nos últimos 12 meses. Agrava o prêmio de risco e entra na estimativa do custo da espera.';
comment on column public.planejamentos.renda_desejada_aposentadoria is
  'Renda mensal desejada na aposentadoria, em valores de hoje.';
comment on column public.planejamentos.idade_aposentadoria is
  'Idade-alvo para parar de trabalhar. Padrão do estudo: 65.';
comment on column public.planejamentos.seguros_existentes is
  'Detalhe das apólices atuais: [{origem, descricao, capital, custeio}]. O total fica em cobertura_atual.';
comment on column public.planejamentos.quem_decide is
  'Quem decide a contratação (ele, o casal, os sócios). Preenchido pela análise da transcrição.';
comment on column public.planejamentos.prazo_decisao is
  'Prazo que o cliente sinalizou para decidir. Preenchido pela análise da transcrição.';

-- Faixa plausível para a idade-alvo: fora disso é digitação errada, e um
-- estudo com aposentadoria aos 3 anos não ajuda ninguém.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planejamentos_idade_aposentadoria_faixa'
  ) then
    alter table public.planejamentos
      add constraint planejamentos_idade_aposentadoria_faixa
      check (idade_aposentadoria is null or idade_aposentadoria between 40 and 90);
  end if;
end $$;

-- ── A proposta pública precisa saber a idade ────────────────────────────────
-- Devolvemos a idade calculada, não a data de nascimento: é o suficiente para
-- o cálculo e expõe o mínimo no link aberto.
create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*,
         c.nome as cliente_nome,
         case
           when c.data_nascimento is null then null
           else extract(year from age(current_date, c.data_nascimento))::int
         end as cliente_idade
    into r
    from public.planejamentos p
    join public.clientes c on c.id = p.id_cliente
   where p.token_proposta = p_token;

  if not found then
    return jsonb_build_object('erro', 'proposta_nao_encontrada');
  end if;

  return jsonb_build_object(
    'cliente_nome', r.cliente_nome,
    'cliente_idade', r.cliente_idade,
    -- o plano inteiro, menos os identificadores internos
    'plano', to_jsonb(r) - 'cliente_nome' - 'cliente_idade'
             - 'id' - 'id_cliente' - 'token_proposta'
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;
