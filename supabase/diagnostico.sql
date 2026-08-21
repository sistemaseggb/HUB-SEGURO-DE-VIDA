-- ============================================================================
-- HUB SEGURO DE VIDA — DIAGNÓSTICO DO BANCO
--
-- "Rodei tudo, mas tem coisa que não funciona." Este arquivo responde por quê,
-- sem alterar NADA: ele só olha e conta o que encontrou.
--
-- Cole no SQL Editor do Supabase e clique em Run. A resposta vem em uma linha
-- por migração, dizendo quais já estão no banco e qual falta rodar.
--
-- É seguro rodar quantas vezes quiser, a qualquer hora, inclusive em produção.
-- ============================================================================

with esperado(ordem, migracao, arquivo, prova, tipo) as (values
  ( 1, '001', '001_schema_inicial.sql',            'clientes',              'tabela'),
  ( 2, '002', '002_automacao_e_planejamento.sql',  'formularios_onboarding','tabela'),
  ( 3, '003', '003_metas_mensagens_relatorios.sql','fila_mensagens',        'tabela'),
  ( 4, '004', '004_codigos_e_inteligencia.sql',    'clientes.codigo',       'coluna'),
  ( 5, '005', '005_documentos.sql',                'documentos',            'tabela'),
  ( 6, '006', '006_crm_interacoes_carteira.sql',   'interacoes',            'tabela'),
  ( 7, '007', '007_assessor_conversao_duplicados.sql','clientes.motivo_perda','coluna'),
  ( 8, '008', '008_integracao_outlook.sql',        'agenda_externa',        'tabela'),
  ( 9, '009', '009_comissoes_importadas.sql',      'comissoes_importadas',  'tabela'),
  (10, '010', '010_meta_comissao_recebida.sql',    'configuracoes.meta_comissao_mensal','coluna'),
  (11, '011', '011_fechamento_liquido.sql',        'configuracoes.imposto_pct','coluna'),
  (12, '012', '012_historico_apolices.sql',        'apolices.importada',    'coluna'),
  (13, '013', '013_tipo_produto_apolice.sql',      'apolices.tipo_produto', 'coluna'),
  (14, '014', '014_planejamento_detalhado.sql',    'planejamentos.capital_invalidez','coluna'),
  (15, '015', '015_cotacao_proposta.sql',          'planejamentos.premio_estimado','coluna'),
  (16, '016', '016_filhos_custo_mensal.sql',       'planejamentos.dependentes','coluna'),
  (17, '017', '017_proposta_publica.sql',          'planejamentos.token_proposta','coluna'),
  (18, '018', '018_roteiro_reuniao.sql',           'planejamentos.roteiro', 'coluna'),
  (19, '019', '019_planejamento_completo.sql',     'planejamentos.tipo_planejamento','coluna'),
  (20, '020', '020_transcricoes_reuniao.sql',      'transcricoes',          'tabela'),
  (21, '021', '021_planejamento_inteligente.sql',  'planejamentos.fumante', 'coluna'),
  (22, '022', '022_comparador.sql',                'planejamentos.seguro_resgatavel','coluna'),
  (23, '023', '023_apresentacao.sql',              'planejamentos.anotacoes_proposta','coluna'),
  (24, '024', '024_estado_e_prazo_divida.sql',     'planejamentos.uf',      'coluna'),
  (25, '025', '025_subscricao_e_beneficiarios.sql','planejamentos.beneficiarios','coluna'),
  (26, '026', '026_assessor_na_apolice.sql',       'apolices.id_assessor',  'coluna'),
  (27, '027', '027_cirurgias.sql',                 'planejamentos.capital_cirurgias','coluna'),
  (28, '028', '028_proposta_publica_idade.sql',    'nao_verificavel',       'especial'),
  (29, '029', '029_planejamento_por_link.sql',     'fn_plan_salvar',        'funcao')
),
achado as (
  select e.*,
    case e.tipo
      when 'tabela' then exists (
        select 1 from information_schema.tables
         where table_schema = 'public' and table_name = e.prova)
      when 'coluna' then exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name  = split_part(e.prova, '.', 1)
           and column_name = split_part(e.prova, '.', 2))
      when 'funcao' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = e.prova)
      -- a 028 não cria coluna nem tabela: ela só reescreve uma função que a
      -- 021 já entregava com o mesmo campo. Não existe prova honesta de que
      -- ela rodou, e inventar uma seria pior do que dizer que não sei.
      when 'especial' then null
    end as aplicada
  from esperado e
)
select
  migracao,
  case when aplicada then '✅ aplicada'
       when aplicada is null then '·  não dá para verificar (só troca uma função)'
       else '❌ FALTA RODAR' end as situacao,
  arquivo
from achado
order by ordem;

-- ── A 029 em detalhe: a tabela sozinha não basta ────────────────────────────
-- Uma migração interrompida no meio pode deixar a tabela criada e as funções
-- não. Nesse estado o painel aparece para a consultora e o link do cliente
-- responde "inválido ou expirado" — o pior dos dois mundos, porque parece que
-- funcionou. As sete peças abaixo têm que estar TODAS presentes.
select
  peca,
  case when presente then '✅' else '❌ FALTA' end as situacao
from (
  select 'tabela formularios_planejamento' as peca, exists (
    select 1 from information_schema.tables
     where table_schema='public' and table_name='formularios_planejamento') as presente
  union all select 'RPC fn_plan_carregar (o cliente abre o link)', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='fn_plan_carregar')
  union all select 'RPC fn_plan_salvar (o cliente envia)', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='fn_plan_salvar')
  union all select 'fn_plan_aplicar (as respostas viram estudo)', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='fn_plan_aplicar')
  union all select 'leitores de jsonb (fn_plan_num e cia — 10 funções)', (
    select count(*) = 10 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname in ('fn_plan_num','fn_plan_int','fn_plan_faixa',
       'fn_plan_txt','fn_plan_opcao','fn_plan_bool','fn_plan_ids','fn_plan_filhos',
       'fn_plan_seguros','fn_plan_beneficiarios'))
  union all select 'permissão do cliente anônimo (fn_plan_carregar)', coalesce((
    select has_function_privilege('anon', p.oid, 'execute')
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='fn_plan_carregar'), false)
  union all select 'permissão do cliente anônimo (fn_plan_salvar)', coalesce((
    select has_function_privilege('anon', p.oid, 'execute')
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='fn_plan_salvar'), false)
) t;
