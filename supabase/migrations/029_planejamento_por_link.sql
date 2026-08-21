-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 029: O planejamento por link
--
-- Existe um cliente que compra e não vai a reunião. Ele responde no WhatsApp
-- às onze da noite, resolve tudo por link e some da agenda por três semanas se
-- a próxima etapa for "vamos marcar 40 minutos". Para ele, o Hub não tinha
-- caminho nenhum: o planejamento só existia dentro da aba da consultora,
-- preenchida AO VIVO. Sem reunião não havia estudo, e sem estudo não havia
-- proposta — a venda morria de agenda, não de preço.
--
-- Esta migração dá a esse cliente o mesmo tratamento que a DPS já tinha
-- (migração 002): um link com token, `/pl/<token>`, sem login, com progresso
-- salvo a cada etapa.
--
-- ── O QUE MUDA EM RELAÇÃO À DPS ─────────────────────────────────────────────
-- A DPS termina em si mesma: as respostas ficam no jsonb e a consultora as
-- transcreve para o portal da seguradora. O planejamento NÃO pode terminar
-- assim — ele precisa virar estudo, e o estudo lê colunas de `planejamentos`,
-- não um jsonb solto. Por isso a conclusão APLICA as respostas na tabela.
--
-- Três decisões sustentam essa aplicação:
--
--   1. O CLIENTE NUNCA ESCREVE NA TABELA. Ele é anônimo. Quem escreve é a
--      função `fn_plan_concluir`, security definer, que só age quando recebe o
--      token correto e só toca as colunas que o formulário coleta. Capital,
--      prêmio e coberturas continuam fora do alcance dele — esses números são
--      do motor e da cotação, não de quem está preenchendo.
--
--   2. BRANCO NÃO APAGA. Cada coluna entra como `coalesce(<respondido>, <atual>)`.
--      A consultora pode ter anotado a renda por telefone antes de mandar o
--      link; se o formulário gravasse nulo no que ficou em branco, apagaria o
--      trabalho dela em silêncio. O cliente só acrescenta.
--
--   3. NÚMERO DE FORA É SEMPRE SUSPEITO. Toda leitura passa por `fn_plan_num`
--      e companhia: texto que não é número vira nulo, negativo vira zero,
--      valor absurdo é aparado no teto, e cada campo com constraint (altura,
--      peso, idade de aposentadoria, prazo de dívida, participação) é aparado
--      DENTRO da faixa que o banco aceita. Um formulário público que estoura
--      uma constraint no último passo é um cliente que não volta.
--
-- E se a aplicação falhar mesmo assim, as respostas NÃO se perdem: elas já
-- estão gravadas no formulário, o erro fica registrado em `erro_aplicacao` e a
-- tarefa criada para a Natália avisa que o estudo precisa ser conferido à mão.
--
-- Como usar: rode APÓS a 028, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

-- ── TUDO OU NADA ────────────────────────────────────────────────────────────
-- Esta migração cria uma tabela E as funções que a fazem funcionar. Se ela
-- parar no meio — porque falta uma migração anterior, porque a conexão caiu,
-- porque alguém colou só metade — o estado que sobra é o PIOR de todos: a
-- tabela existe, as funções não, e o Hub passa a mostrar o painel do link para
-- a consultora enquanto o cliente que abre esse link recebe "inválido ou
-- expirado". Parece que funcionou, e não funcionou.
--
-- O `begin`/`commit` fecha essa porta: ou o banco termina com tudo, ou termina
-- exatamente como estava.
begin;

-- ── 0. Conferência de pré-requisitos ────────────────────────────────────────
-- As migrações são aplicadas à mão no SQL Editor, e pular uma é fácil. Este
-- formulário grava em colunas que nasceram da 014 à 027: sem elas, a função
-- abaixo nem compila. Melhor falhar aqui, com o nome do arquivo que falta, do
-- que na primeira vez que um cliente clicar em "enviar".
do $$
declare
  faltando text;
begin
  select string_agg(c.coluna || ' (migração ' || c.origem || ')', ', ')
    into faltando
    from (values
      ('capital_invalidez', '014'), ('premio_estimado', '015'),
      ('tipo_planejamento', '019'), ('fumante', '021'),
      ('uf', '024'), ('beneficiarios', '025'), ('capital_cirurgias', '027')
    ) as c(coluna, origem)
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'planejamentos'
        and column_name = c.coluna
   );

  if faltando is not null then
    raise exception 'Rode as migrações anteriores antes da 029. Faltam colunas: %', faltando;
  end if;
end $$;

-- ── 1. A tabela do formulário ───────────────────────────────────────────────
-- Mesmo desenho do formulário de onboarding: as respostas moram em jsonb, o
-- token é a chave de acesso e o progresso é salvo etapa a etapa. O cliente
-- pode parar no meio, fechar o navegador e voltar dois dias depois.
create table if not exists public.formularios_planejamento (
  id             uuid primary key default gen_random_uuid(),
  id_cliente     uuid not null references public.clientes(id) on delete cascade,
  token          uuid not null unique default gen_random_uuid(),
  status         public.status_formulario not null default 'pendente',
  etapa_atual    int not null default 0,
  respostas      jsonb not null default '{}'::jsonb,
  enviado_em     timestamptz not null default now(),
  iniciado_em    timestamptz,
  concluido_em   timestamptz,
  -- quando as respostas viraram planejamento de verdade (e o que impediu)
  aplicado_em    timestamptz,
  erro_aplicacao text,
  updated_at     timestamptz not null default now()
);

create index if not exists idx_form_planejamento_cliente
  on public.formularios_planejamento (id_cliente);

drop trigger if exists trg_form_planejamento_updated_at on public.formularios_planejamento;
create trigger trg_form_planejamento_updated_at
  before update on public.formularios_planejamento
  for each row execute function public.fn_touch_updated_at();

comment on table public.formularios_planejamento is
  'Planejamento preenchido pelo próprio cliente pelo link /pl/<token>. As respostas ficam em jsonb e são aplicadas em planejamentos na conclusão.';
comment on column public.formularios_planejamento.respostas is
  'Respostas do cliente. As chaves são os NOMES DAS COLUNAS de planejamentos (ver src/lib/planejamentoPublico.js).';
comment on column public.formularios_planejamento.erro_aplicacao is
  'Preenchido quando a conclusão não conseguiu gravar no planejamento. As respostas continuam aqui, intactas.';

alter table public.formularios_planejamento enable row level security;

drop policy if exists "acesso_total_autenticado" on public.formularios_planejamento;
create policy "acesso_total_autenticado" on public.formularios_planejamento
  for all to authenticated using (true) with check (true);

-- ============================================================================
-- 2. LEITORES SEGUROS DE JSONB
--
-- Tudo que chega aqui foi digitado por alguém sem login, num celular, sem
-- ninguém por perto para explicar mensagem de erro. A tela já valida — mas a
-- tela é do lado de fora, e do lado de fora nada é garantia. Estas funções são
-- a garantia: elas nunca levantam exceção e nunca devolvem lixo.
-- ============================================================================

-- Número: aceita 12000, "12000", "12000.5" e "12.000,50". Qualquer outra coisa
-- vira nulo. Negativo vira zero, e o teto corta o dedo escorregado na tecla.
create or replace function public.fn_plan_num(p jsonb, k text)
returns numeric
language plpgsql
immutable
as $$
declare
  t text;
  v numeric;
begin
  if p is null or p -> k is null then return null; end if;
  if jsonb_typeof(p -> k) not in ('number', 'string') then return null; end if;

  t := btrim(p ->> k);
  if t = '' then return null; end if;

  -- pontuação brasileira só quando há vírgula: "12000.5" já é o número pronto
  if position(',' in t) > 0 then
    t := replace(replace(t, '.', ''), ',', '.');
  end if;
  if t !~ '^-?[0-9]+(\.[0-9]+)?$' then return null; end if;

  v := t::numeric;
  if v < 0 then return 0; end if;
  -- R$ 1 trilhão: o mesmo teto que o motor do estudo usa
  if v > 1000000000000 then return 1000000000000; end if;
  return round(v, 2);
end;
$$;

-- Inteiro aparado DENTRO da faixa que a constraint da coluna aceita.
create or replace function public.fn_plan_int(p jsonb, k text, p_min int, p_max int)
returns int
language plpgsql
immutable
as $$
declare
  v numeric;
begin
  v := public.fn_plan_num(p, k);
  if v is null then return null; end if;
  return least(greatest(round(v), p_min), p_max)::int;
end;
$$;

-- Numérico aparado na faixa (usado no peso, que tem casa decimal).
create or replace function public.fn_plan_faixa(p jsonb, k text, p_min numeric, p_max numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  v numeric;
begin
  v := public.fn_plan_num(p, k);
  if v is null then return null; end if;
  return least(greatest(v, p_min), p_max);
end;
$$;

-- Texto: só string de verdade, sem espaços nas pontas, sem vazio e com teto de
-- tamanho — campo livre de formulário público é porta de entrada de despejo.
create or replace function public.fn_plan_txt(p jsonb, k text, p_max int default 500)
returns text
language plpgsql
immutable
as $$
declare
  t text;
begin
  if p is null or p -> k is null then return null; end if;
  if jsonb_typeof(p -> k) <> 'string' then return null; end if;
  t := btrim(p ->> k);
  if t = '' then return null; end if;
  return left(t, p_max);
end;
$$;

-- Texto de lista fechada: fora da lista, nulo. Nenhum valor estranho entra.
create or replace function public.fn_plan_opcao(p jsonb, k text, p_validos text[])
returns text
language plpgsql
immutable
as $$
declare
  t text;
begin
  t := public.fn_plan_txt(p, k);
  if t is null or not (t = any(p_validos)) then return null; end if;
  return t;
end;
$$;

-- Booleano: só true/false explícitos. "não respondeu" continua sendo nulo, e
-- nulo não sobrescreve o que a consultora já tinha marcado.
create or replace function public.fn_plan_bool(p jsonb, k text)
returns boolean
language plpgsql
immutable
as $$
begin
  if p is null or p -> k is null then return null; end if;
  if jsonb_typeof(p -> k) <> 'boolean' then return null; end if;
  return (p ->> k)::boolean;
end;
$$;

-- Lista de ids de uma lista fechada (focos, atividades de risco), sem repetido
-- e sem nada que o sistema não conheça. Devolve nulo quando a chave não é uma
-- lista: nulo = "não respondeu"; `[]` = "respondeu que não tem nenhum".
create or replace function public.fn_plan_ids(p jsonb, k text, p_validos text[])
returns jsonb
language plpgsql
immutable
as $$
declare
  r jsonb;
begin
  if p is null or p -> k is null or jsonb_typeof(p -> k) <> 'array' then return null; end if;
  select coalesce(jsonb_agg(distinct x), '[]'::jsonb) into r
    from jsonb_array_elements_text(p -> k) as x
   where x = any(p_validos);
  return coalesce(r, '[]'::jsonb);
end;
$$;

-- Filhos: [{nome, idade, custo_mensal}] — o mesmo formato que a aba da
-- consultora grava. Linha em branco (o cliente clicou em "adicionar" e
-- desistiu) não entra: viraria um filho sem nome puxando o cálculo.
create or replace function public.fn_plan_filhos(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  r jsonb;
begin
  if p is null or p -> 'dependentes' is null
     or jsonb_typeof(p -> 'dependentes') <> 'array' then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nome',         coalesce(public.fn_plan_txt(e, 'nome', 120), ''),
           'idade',        public.fn_plan_int(e, 'idade', 0, 60),
           'custo_mensal', public.fn_plan_num(e, 'custo_mensal')
         )), '[]'::jsonb) into r
    from jsonb_array_elements(p -> 'dependentes') as e
   where jsonb_typeof(e) = 'object'
     and (public.fn_plan_txt(e, 'nome', 120) is not null
          or public.fn_plan_num(e, 'idade') is not null
          or coalesce(public.fn_plan_num(e, 'custo_mensal'), 0) > 0);

  return coalesce(r, '[]'::jsonb);
end;
$$;

-- Seguros que o cliente já tem: [{origem, descricao, capital, custeio}].
-- Origem e custeio são listas fechadas porque `analisarCoberturaExistente()`
-- decide por elas o que sobrevive a uma demissão e o que é cheque do banco.
create or replace function public.fn_plan_seguros(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  r jsonb;
begin
  if p is null or p -> 'seguros_existentes' is null
     or jsonb_typeof(p -> 'seguros_existentes') <> 'array' then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'origem', coalesce(public.fn_plan_opcao(e, 'origem',
                       array['individual', 'empresa', 'banco', 'consignado', 'outro']), 'individual'),
           'descricao', coalesce(public.fn_plan_txt(e, 'descricao', 200), ''),
           'capital', public.fn_plan_num(e, 'capital'),
           'custeio', case when public.fn_plan_txt(e, 'custeio') = 'empresa'
                           then 'empresa' else 'proprio' end
         )), '[]'::jsonb) into r
    from jsonb_array_elements(p -> 'seguros_existentes') as e
   where jsonb_typeof(e) = 'object'
     and (public.fn_plan_txt(e, 'descricao', 200) is not null
          or coalesce(public.fn_plan_num(e, 'capital'), 0) > 0);

  return coalesce(r, '[]'::jsonb);
end;
$$;

-- Beneficiários: [{nome, parentesco, pct, nascimento}].
create or replace function public.fn_plan_beneficiarios(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  r jsonb;
begin
  if p is null or p -> 'beneficiarios' is null
     or jsonb_typeof(p -> 'beneficiarios') <> 'array' then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nome', coalesce(public.fn_plan_txt(e, 'nome', 120), ''),
           'parentesco', coalesce(public.fn_plan_opcao(e, 'parentesco',
                           array['Cônjuge', 'Companheiro(a)', 'Filho(a)', 'Pai', 'Mãe',
                                 'Irmão(ã)', 'Neto(a)', 'Outro', 'Herdeiros legais']), 'Outro'),
           'pct', coalesce(public.fn_plan_faixa(e, 'pct', 0, 100), 0),
           'nascimento', case when public.fn_plan_txt(e, 'nascimento') ~ '^\d{4}-\d{2}-\d{2}$'
                              then public.fn_plan_txt(e, 'nascimento') else null end
         )), '[]'::jsonb) into r
    from jsonb_array_elements(p -> 'beneficiarios') as e
   where jsonb_typeof(e) = 'object'
     and (public.fn_plan_txt(e, 'nome', 120) is not null
          or coalesce(public.fn_plan_num(e, 'pct'), 0) > 0);

  return coalesce(r, '[]'::jsonb);
end;
$$;

-- ============================================================================
-- 3. AS RESPOSTAS VIRAM PLANEJAMENTO
--
-- Espelho exato de `aplicarAoPlano()` em src/lib/planejamentoPublico.js. As
-- duas listas de colunas são comparadas pelo teste
-- `scripts/teste-planejamento-publico.mjs`: coluna nova de um lado e esquecida
-- do outro é falha de teste, não dado perdido em silêncio.
-- ============================================================================
create or replace function public.fn_plan_aplicar(p_cliente uuid, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb := coalesce(p_respostas, '{}'::jsonb);
  v_uniao boolean;
  v_pj boolean;
  -- família
  v_tipo text; v_focos jsonb;
  v_profissao text; v_estado_civil text; v_conjuge text; v_regime text; v_uf text;
  -- filhos
  v_dependentes jsonb; v_num_dependentes int; v_filhos_idades text;
  -- financeira
  v_renda numeric; v_custo numeric; v_dividas numeric; v_dividas_prazo int;
  -- patrimônio
  v_imoveis numeric; v_investimentos numeric; v_empresa numeric;
  v_veiculos numeric; v_outros numeric; v_total numeric;
  v_prev_saldo numeric; v_prev_tipo text; v_prev_aporte numeric;
  -- sucessão
  v_menores boolean; v_holding boolean; v_testamento boolean;
  -- empresa
  v_pj_razao text; v_pj_valuation numeric; v_pj_part numeric; v_pj_socios int;
  v_pj_fat numeric; v_pj_lucro numeric; v_pj_aval numeric;
  -- aposentadoria
  v_renda_apos numeric; v_idade_apos int;
  -- seguros
  v_seguros jsonb; v_cobertura numeric;
  -- perfil
  v_altura int; v_peso numeric; v_fumante boolean; v_atividades jsonb; v_condicoes text;
  -- beneficiários e objetivos
  v_beneficiarios jsonb; v_objetivos text; v_chips text;
begin
  v_tipo := public.fn_plan_opcao(r, 'tipo_planejamento', array['pf', 'pj', 'pf_pj']);
  v_pj := v_tipo in ('pj', 'pf_pj');
  v_focos := public.fn_plan_ids(r, 'focos', array['renda', 'educacao', 'dividas', 'sucessao',
                                                  'blindagem', 'empresarial', 'aposentadoria']);
  -- lista vazia não é resposta: quem não marcou foco nenhum não apaga os focos
  -- que a consultora já tinha escolhido
  if v_focos = '[]'::jsonb then v_focos := null; end if;

  v_profissao    := public.fn_plan_txt(r, 'profissao', 120);
  v_estado_civil := public.fn_plan_opcao(r, 'estado_civil',
                      array['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)']);
  v_uniao := v_estado_civil in ('Casado(a)', 'União estável');
  v_conjuge := case when v_uniao then public.fn_plan_txt(r, 'conjuge_nome', 120) end;
  v_regime  := case when v_uniao then public.fn_plan_opcao(r, 'regime_bens',
                      array['Comunhão parcial', 'Comunhão universal', 'Separação total',
                            'Separação obrigatória', 'Participação final nos aquestos']) end;
  v_uf := upper(public.fn_plan_txt(r, 'uf', 2));
  if v_uf !~ '^[A-Z]{2}$' then v_uf := null; end if;

  -- ── Filhos: a lista manda; contagem e texto de idades são derivados ───────
  v_dependentes := public.fn_plan_filhos(r);
  if v_dependentes is not null then
    v_num_dependentes := jsonb_array_length(v_dependentes);
    select case when count(*) = 0 then null
                else string_agg(f.idade, ', ' order by f.ord) || ' anos' end
      into v_filhos_idades
      from (select (e ->> 'idade') as idade, ordinalidade as ord
              from jsonb_array_elements(v_dependentes) with ordinality as t(e, ordinalidade)
             where e ->> 'idade' is not null) as f;
  end if;

  v_renda         := public.fn_plan_num(r, 'renda_mensal');
  v_custo         := public.fn_plan_num(r, 'custo_vida_mensal');
  v_dividas       := public.fn_plan_num(r, 'dividas_total');
  v_dividas_prazo := public.fn_plan_int(r, 'dividas_prazo_anos', 0, 60);

  v_imoveis       := public.fn_plan_num(r, 'patrimonio_imoveis');
  v_investimentos := public.fn_plan_num(r, 'patrimonio_investimentos');
  v_empresa       := public.fn_plan_num(r, 'patrimonio_empresa');
  v_veiculos      := public.fn_plan_num(r, 'patrimonio_veiculos');
  v_outros        := public.fn_plan_num(r, 'patrimonio_outros');
  -- O total consolidado acompanha as classes (migração 019): telas que leem
  -- `patrimonio_total` ficariam com o número velho sem isto.
  if coalesce(v_imoveis, v_investimentos, v_empresa, v_veiculos, v_outros) is not null then
    v_total := coalesce(v_imoveis, 0) + coalesce(v_investimentos, 0) + coalesce(v_empresa, 0)
             + coalesce(v_veiculos, 0) + coalesce(v_outros, 0);
  end if;
  v_prev_saldo  := public.fn_plan_num(r, 'previdencia_saldo');
  v_prev_tipo   := public.fn_plan_opcao(r, 'previdencia_tipo', array['VGBL', 'PGBL', 'Ambos']);
  v_prev_aporte := public.fn_plan_num(r, 'previdencia_aporte_mensal');

  -- Filho menor declarado já responde a pergunta da sucessão: se o cliente
  -- pulou o sim/não, a lista de filhos decide — nunca o contrário.
  v_menores := public.fn_plan_bool(r, 'herdeiros_menores');
  if v_menores is null and v_dependentes is not null then
    select bool_or((e ->> 'idade')::int < 18) into v_menores
      from jsonb_array_elements(v_dependentes) as e
     where e ->> 'idade' is not null;
    if v_menores is not true then v_menores := null; end if;
  end if;
  v_holding    := public.fn_plan_bool(r, 'tem_holding');
  v_testamento := public.fn_plan_bool(r, 'tem_testamento');

  if v_pj then
    v_pj_razao     := public.fn_plan_txt(r, 'pj_razao_social', 200);
    v_pj_valuation := public.fn_plan_num(r, 'pj_valuation');
    v_pj_part      := public.fn_plan_faixa(r, 'pj_participacao_pct', 0, 100);
    v_pj_socios    := public.fn_plan_int(r, 'pj_num_socios', 1, 50);
    v_pj_fat       := public.fn_plan_num(r, 'pj_faturamento_anual');
    v_pj_lucro     := public.fn_plan_num(r, 'pj_lucro_anual');
    v_pj_aval      := public.fn_plan_num(r, 'pj_divida_avalizada');
  end if;

  v_renda_apos := public.fn_plan_num(r, 'renda_desejada_aposentadoria');
  v_idade_apos := public.fn_plan_int(r, 'idade_aposentadoria', 40, 90);

  -- O total das apólices declaradas é o que o estudo usa para mostrar o gap.
  v_seguros := public.fn_plan_seguros(r);
  if v_seguros is not null then
    select coalesce(sum(coalesce((e ->> 'capital')::numeric, 0)), 0) into v_cobertura
      from jsonb_array_elements(v_seguros) as e;
  end if;

  v_altura     := public.fn_plan_int(r, 'altura_cm', 100, 250);
  v_peso       := public.fn_plan_faixa(r, 'peso_kg', 20, 400);
  v_fumante    := public.fn_plan_bool(r, 'fumante');
  v_atividades := public.fn_plan_ids(r, 'atividades_risco',
                    array['moto', 'aviacao', 'mergulho', 'paraquedismo', 'automobilismo',
                          'altura', 'escalada', 'artes_marciais', 'caca_submarina']);
  v_condicoes  := public.fn_plan_txt(r, 'condicoes_declaradas', 2000);

  v_beneficiarios := public.fn_plan_beneficiarios(r);

  -- Objetivos: os chips marcados e o texto livre viram um parágrafo só, que é
  -- como a capa e o fechamento da proposta leem este campo.
  select string_agg(x, '; ') into v_chips
    from jsonb_array_elements_text(
           coalesce(public.fn_plan_ids(r, 'objetivos_chips', array[
             'Garantir a educação dos filhos',
             'Manter o padrão de vida da família',
             'Quitar dívidas e financiamentos',
             'Planejamento sucessório e blindagem patrimonial',
             'Proteger a renda de autônomo',
             'Proteger a sociedade e a continuidade da empresa',
             'Complementar a aposentadoria',
             'Deixar um legado']), '[]'::jsonb)) as x;
  v_objetivos := public.fn_plan_txt(r, 'objetivos', 2000);
  v_objetivos := nullif(btrim(concat_ws('. ', nullif(v_chips, ''), v_objetivos)), '');

  -- ── A gravação ────────────────────────────────────────────────────────────
  -- `coalesce(<respondido>, <atual>)` em cada coluna: branco não apaga nada.
  insert into public.planejamentos as pl (
    id_cliente, tipo_planejamento, focos,
    profissao, estado_civil, conjuge_nome, regime_bens, uf,
    dependentes, num_dependentes, filhos_idades,
    renda_mensal, custo_vida_mensal, dividas_total, dividas_prazo_anos,
    patrimonio_imoveis, patrimonio_investimentos, patrimonio_empresa,
    patrimonio_veiculos, patrimonio_outros, patrimonio_total,
    previdencia_saldo, previdencia_tipo, previdencia_aporte_mensal,
    herdeiros_menores, tem_holding, tem_testamento,
    pj_razao_social, pj_valuation, pj_participacao_pct, pj_num_socios,
    pj_faturamento_anual, pj_lucro_anual, pj_divida_avalizada,
    renda_desejada_aposentadoria, idade_aposentadoria,
    seguros_existentes, cobertura_atual,
    altura_cm, peso_kg, fumante, atividades_risco, condicoes_declaradas,
    beneficiarios, objetivos
  ) values (
    p_cliente, coalesce(v_tipo, 'pf'), coalesce(v_focos, '[]'::jsonb),
    v_profissao, v_estado_civil, v_conjuge, v_regime, v_uf,
    coalesce(v_dependentes, '[]'::jsonb), coalesce(v_num_dependentes, 0), v_filhos_idades,
    v_renda, v_custo, coalesce(v_dividas, 0), v_dividas_prazo,
    v_imoveis, v_investimentos, v_empresa, v_veiculos, v_outros, v_total,
    v_prev_saldo, v_prev_tipo, v_prev_aporte,
    coalesce(v_menores, false), coalesce(v_holding, false), coalesce(v_testamento, false),
    v_pj_razao, v_pj_valuation, v_pj_part, v_pj_socios,
    v_pj_fat, v_pj_lucro, v_pj_aval,
    v_renda_apos, v_idade_apos,
    coalesce(v_seguros, '[]'::jsonb), coalesce(v_cobertura, 0),
    v_altura, v_peso, coalesce(v_fumante, false),
    coalesce(v_atividades, '[]'::jsonb), v_condicoes,
    coalesce(v_beneficiarios, '[]'::jsonb), v_objetivos
  )
  on conflict (id_cliente) do update set
    tipo_planejamento            = coalesce(v_tipo, pl.tipo_planejamento),
    focos                        = coalesce(v_focos, pl.focos),
    profissao                    = coalesce(v_profissao, pl.profissao),
    estado_civil                 = coalesce(v_estado_civil, pl.estado_civil),
    conjuge_nome                 = coalesce(v_conjuge, pl.conjuge_nome),
    regime_bens                  = coalesce(v_regime, pl.regime_bens),
    uf                           = coalesce(v_uf, pl.uf),
    dependentes                  = coalesce(v_dependentes, pl.dependentes),
    num_dependentes              = coalesce(v_num_dependentes, pl.num_dependentes),
    filhos_idades                = coalesce(v_filhos_idades, pl.filhos_idades),
    renda_mensal                 = coalesce(v_renda, pl.renda_mensal),
    custo_vida_mensal            = coalesce(v_custo, pl.custo_vida_mensal),
    dividas_total                = coalesce(v_dividas, pl.dividas_total),
    dividas_prazo_anos           = coalesce(v_dividas_prazo, pl.dividas_prazo_anos),
    patrimonio_imoveis           = coalesce(v_imoveis, pl.patrimonio_imoveis),
    patrimonio_investimentos     = coalesce(v_investimentos, pl.patrimonio_investimentos),
    patrimonio_empresa           = coalesce(v_empresa, pl.patrimonio_empresa),
    patrimonio_veiculos          = coalesce(v_veiculos, pl.patrimonio_veiculos),
    patrimonio_outros            = coalesce(v_outros, pl.patrimonio_outros),
    patrimonio_total             = coalesce(v_total, pl.patrimonio_total),
    previdencia_saldo            = coalesce(v_prev_saldo, pl.previdencia_saldo),
    previdencia_tipo             = coalesce(v_prev_tipo, pl.previdencia_tipo),
    previdencia_aporte_mensal    = coalesce(v_prev_aporte, pl.previdencia_aporte_mensal),
    herdeiros_menores            = coalesce(v_menores, pl.herdeiros_menores),
    tem_holding                  = coalesce(v_holding, pl.tem_holding),
    tem_testamento               = coalesce(v_testamento, pl.tem_testamento),
    pj_razao_social              = coalesce(v_pj_razao, pl.pj_razao_social),
    pj_valuation                 = coalesce(v_pj_valuation, pl.pj_valuation),
    pj_participacao_pct          = coalesce(v_pj_part, pl.pj_participacao_pct),
    pj_num_socios                = coalesce(v_pj_socios, pl.pj_num_socios),
    pj_faturamento_anual         = coalesce(v_pj_fat, pl.pj_faturamento_anual),
    pj_lucro_anual               = coalesce(v_pj_lucro, pl.pj_lucro_anual),
    pj_divida_avalizada          = coalesce(v_pj_aval, pl.pj_divida_avalizada),
    renda_desejada_aposentadoria = coalesce(v_renda_apos, pl.renda_desejada_aposentadoria),
    idade_aposentadoria          = coalesce(v_idade_apos, pl.idade_aposentadoria),
    seguros_existentes           = coalesce(v_seguros, pl.seguros_existentes),
    cobertura_atual              = coalesce(v_cobertura, pl.cobertura_atual),
    altura_cm                    = coalesce(v_altura, pl.altura_cm),
    peso_kg                      = coalesce(v_peso, pl.peso_kg),
    fumante                      = coalesce(v_fumante, pl.fumante),
    atividades_risco             = coalesce(v_atividades, pl.atividades_risco),
    condicoes_declaradas         = coalesce(v_condicoes, pl.condicoes_declaradas),
    beneficiarios                = coalesce(v_beneficiarios, pl.beneficiarios),
    objetivos                    = coalesce(v_objetivos, pl.objetivos);
end;
$$;

-- A aplicação é chamada pela RPC pública (security definer). Ninguém mais
-- precisa dela — e anônimo nenhum a alcança direto.
revoke all on function public.fn_plan_aplicar(uuid, jsonb) from public;

-- ============================================================================
-- 4. AS DUAS RPCs PÚBLICAS
--
-- Mesmo contrato do formulário de onboarding: o anônimo não lê a tabela, só
-- chama estas funções, e sem o token nada aparece.
-- ============================================================================

create or replace function public.fn_plan_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  select fp.id, fp.status, fp.etapa_atual, fp.respostas,
         split_part(c.nome, ' ', 1) as primeiro_nome
    into f
    from public.formularios_planejamento fp
    join public.clientes c on c.id = fp.id_cliente
   where fp.token = p_token;

  if not found then
    return jsonb_build_object('erro', 'planejamento_nao_encontrado');
  end if;

  if f.status = 'pendente' then
    update public.formularios_planejamento
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

create or replace function public.fn_plan_salvar(
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
  v_erro text;
begin
  select id, id_cliente into v_id, v_cliente
    from public.formularios_planejamento
   where token = p_token and status <> 'concluido';

  if not found then
    return jsonb_build_object('erro', 'planejamento_nao_encontrado_ou_concluido');
  end if;

  -- Salva SEMPRE, e primeiro. O que o cliente digitou não pode depender de a
  -- aplicação no estudo dar certo.
  update public.formularios_planejamento
     set respostas    = coalesce(p_respostas, '{}'::jsonb),
         etapa_atual  = greatest(coalesce(p_etapa, 0), 0),
         status       = case when p_concluido then 'concluido'::public.status_formulario
                             else 'em_andamento'::public.status_formulario end,
         concluido_em = case when p_concluido then now() else null end
   where id = v_id;

  if not p_concluido then
    return jsonb_build_object('ok', true);
  end if;

  -- ── Conclusão: as respostas viram planejamento ───────────────────────────
  -- Se algo der errado aqui, o formulário continua salvo e concluído: só o
  -- estudo fica para ser conferido à mão, com o motivo registrado. Perder as
  -- respostas de um cliente que preencheu vinte minutos de formulário é o
  -- único desfecho inaceitável.
  begin
    perform public.fn_plan_aplicar(v_cliente, coalesce(p_respostas, '{}'::jsonb));
    update public.formularios_planejamento
       set aplicado_em = now(), erro_aplicacao = null
     where id = v_id;
  exception when others then
    v_erro := sqlerrm;
    update public.formularios_planejamento
       set aplicado_em = null, erro_aplicacao = left(v_erro, 500)
     where id = v_id;
  end;

  insert into public.tarefas (id_cliente, titulo, tipo, automatica)
  values (v_cliente,
          case when v_erro is null
               then 'Planejamento preenchido pelo cliente: conferir os números e montar a proposta'
               else 'Planejamento preenchido pelo cliente NÃO foi aplicado ao estudo — conferir à mão'
          end,
          'planejamento', true);

  return jsonb_build_object('ok', true, 'aplicado', v_erro is null);
end;
$$;

revoke all on function public.fn_plan_carregar(uuid) from public;
revoke all on function public.fn_plan_salvar(uuid, jsonb, int, boolean) from public;
grant execute on function public.fn_plan_carregar(uuid) to anon, authenticated;
grant execute on function public.fn_plan_salvar(uuid, jsonb, int, boolean) to anon, authenticated;

-- Os leitores de jsonb são detalhe interno da aplicação: nenhum anônimo
-- precisa chamá-los, e o que eles fazem só faz sentido dentro dela.
revoke all on function public.fn_plan_num(jsonb, text) from public;
revoke all on function public.fn_plan_int(jsonb, text, int, int) from public;
revoke all on function public.fn_plan_faixa(jsonb, text, numeric, numeric) from public;
revoke all on function public.fn_plan_txt(jsonb, text, int) from public;
revoke all on function public.fn_plan_opcao(jsonb, text, text[]) from public;
revoke all on function public.fn_plan_bool(jsonb, text) from public;
revoke all on function public.fn_plan_ids(jsonb, text, text[]) from public;
revoke all on function public.fn_plan_filhos(jsonb) from public;
revoke all on function public.fn_plan_seguros(jsonb) from public;
revoke all on function public.fn_plan_beneficiarios(jsonb) from public;

commit;
