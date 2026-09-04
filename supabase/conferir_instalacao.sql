-- ============================================================================
-- HUB SEGURO DE VIDA — "ESTÁ 100% NO AR?"
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run. Ele NÃO
-- altera nada: só olha e responde.
--
-- Por que isto existe: as migrações são aplicadas à mão, uma de cada vez, e
-- quando falta uma o sistema NÃO quebra — ele encolhe. A cobertura de
-- cirurgias some do estudo, o link do planejamento não abre, o assessor da
-- apólice volta a ser o do cliente. Tudo continua parecendo funcionar, e a
-- consultora só descobre quando procura um botão que deveria estar ali.
--
-- Rodar as 29 migrações de novo "por garantia" funciona (elas são seguras de
-- repetir), mas leva tempo e não diz o que estava faltando. Esta conferência
-- diz exatamente qual arquivo rodar.
--
-- Como ler o resultado: a coluna SITUACAO. Se todas disserem "OK", está tudo
-- aplicado. Onde disser "FALTA", rode o arquivo indicado em ARQUIVO_A_RODAR
-- (pasta supabase/migrations/), na ordem em que aparecem.
-- ============================================================================

with conferencia(ordem, arquivo, o_que_traz, existe) as (values

  -- Cada linha procura um objeto que SÓ existe depois daquela migração. Usamos
  -- uma coluna ou função criada por ela — não um nome de tabela genérico, que
  -- poderia existir por outro motivo.

  (1, '001_schema_inicial.sql', 'As tabelas base (clientes, apólices, reuniões)',
   to_regclass('public.clientes') is not null),

  (2, '002_automacao_e_planejamento.sql', 'O motor de automações e o planejamento',
   to_regclass('public.planejamentos') is not null),

  (3, '003_metas_mensagens_relatorios.sql', 'Metas, mensagens do dia e relatórios',
   to_regclass('public.fila_mensagens') is not null),

  (4, '004_codigos_e_inteligencia.sql', 'Score de prioridade e próxima melhor ação',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'clientes' and column_name = 'codigo')),

  (5, '005_documentos.sql', 'Anexos do cliente (e o bucket de arquivos)',
   to_regclass('public.documentos') is not null),

  (6, '006_crm_interacoes_carteira.sql', 'Interações e a visão de carteira',
   to_regclass('public.interacoes') is not null),

  (7, '007_assessor_conversao_duplicados.sql', 'Conversão por assessor e alerta de duplicado',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'clientes' and column_name = 'id_assessor')),

  (8, '008_integracao_outlook.sql', 'Integração com a agenda do Outlook',
   to_regclass('public.agenda_externa') is not null),

  (9, '009_comissoes_importadas.sql', 'Importação das comissões da seguradora',
   to_regclass('public.comissoes_importadas') is not null),

  (10, '010_meta_comissao_recebida.sql', 'Meta de comissão recebida no mês',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'configuracoes' and column_name = 'meta_comissao_mensal')),

  (11, '011_fechamento_liquido.sql', 'O fechamento líquido (imposto antes da divisão)',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'configuracoes' and column_name = 'imposto_pct')),

  (12, '012_historico_apolices.sql', 'Motivo do cancelamento na apólice',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'apolices' and column_name = 'motivo_cancelamento')),

  (13, '013_tipo_produto_apolice.sql', 'Tipo de produto na apólice',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'apolices' and column_name = 'tipo_produto')),

  (14, '014_planejamento_detalhado.sql', 'Invalidez, doenças graves, DIT e verba sucessória',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'capital_invalidez')),

  (15, '015_cotacao_proposta.sql', 'A cotação dentro da proposta',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'premio_estimado')),

  (16, '016_filhos_custo_mensal.sql', 'O custo mensal de cada filho',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'dependentes')),

  (17, '017_proposta_publica.sql', 'O link da proposta para o cliente',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'token_proposta')),

  (18, '018_roteiro_reuniao.sql', 'O roteiro da reunião, bloco a bloco',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'roteiro')),

  (19, '019_planejamento_completo.sql', 'PF/PJ, focos, patrimônio por classe, acidentes e assistências',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'tipo_planejamento')),

  (20, '020_transcricoes_reuniao.sql', 'A transcrição da reunião',
   to_regclass('public.transcricoes') is not null),

  (21, '021_planejamento_inteligente.sql', 'Fumante, aposentadoria e as apólices que ele já tem',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'seguros_existentes')),

  (22, '022_comparador.sql', 'O comparador "investir ou proteger"',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'seguro_resgatavel')),

  (23, '023_apresentacao.sql', 'As anotações da apresentação',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'anotacoes_proposta')),

  (24, '024_estado_e_prazo_divida.sql', 'O estado (ITCMD certo) e o prazo da dívida',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'uf')),

  (25, '025_subscricao_e_beneficiarios.sql', 'Subscrição (peso, altura, atividades) e beneficiários',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'beneficiarios')),

  (26, '026_assessor_na_apolice.sql', 'O assessor na APÓLICE (decide o GB Awards)',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'apolices' and column_name = 'id_assessor')),

  (27, '027_cirurgias.sql', 'A cobertura de cirurgias',
   exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'planejamentos' and column_name = 'capital_cirurgias')),

  -- ESTA LINHA CONFERE UMA CAPACIDADE, NÃO UM ARQUIVO. A função
  -- `fn_proposta_carregar` é redefinida em quatro migrações (017, 021, 023 e
  -- 028), e a idade do cliente — que a proposta pública precisa para montar a
  -- escada de planos, o custo da espera e o capítulo de aposentadoria — já
  -- entra desde a 021. Procurar só pelo NOME da função daria "OK" para quem
  -- parou na 017, sem a idade. Por isso olhamos dentro do corpo dela.
  --
  -- Se aqui disser FALTA, rode a 028: é a definição mais recente e resolve,
  -- venha o atraso de onde vier. E o contrário também vale: esta linha pode
  -- dizer OK num banco que nunca rodou a 028, porque a 021 e a 023 já
  -- entregavam a idade. Conferido num Postgres com as migrações aplicadas só
  -- até a 026: a conferência aponta a 027 e a 029, e não esta — o que está
  -- certo, porque a proposta pública daquele banco já mostra os três
  -- capítulos. A 028 é, na prática, uma redefinição sem efeito para quem já
  -- passou da 023; rodá-la não faz mal nenhum.
  (28, '028_proposta_publica_idade.sql', 'A proposta pública devolve a idade (3 capítulos dependem dela)',
   exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'fn_proposta_carregar'
             and p.prosrc like '%cliente_idade%')),

  (29, '029_planejamento_por_link.sql', 'O planejamento preenchido pelo próprio cliente',
   exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'fn_plan_salvar'))
)

select
  ordem                                             as "#",
  case when existe then '✅ OK' else '❌ FALTA' end  as "SITUACAO",
  case when existe then '—' else arquivo end        as "ARQUIVO_A_RODAR",
  o_que_traz                                        as "O QUE ESTA MIGRACAO TRAZ"
from conferencia
order by ordem;

-- ============================================================================
-- AS TRÊS COISAS QUE NÃO SÃO MIGRAÇÃO E TAMBÉM PRECISAM ESTAR DE PÉ
-- ============================================================================
-- Rode este segundo bloco junto: ele confere o bucket de arquivos, o usuário
-- de acesso e o agendamento das mensagens diárias. Faltar qualquer um dos três
-- não quebra tela nenhuma — só some uma parte do sistema, em silêncio.

select 'Bucket de documentos (anexos do cliente)' as "ITEM",
       case when exists (select 1 from storage.buckets where id = 'documentos')
            then '✅ OK'
            else '❌ FALTA — crie em Storage → New bucket, nome "documentos", SEM marcar Public'
       end as "SITUACAO"
union all
select 'Usuário de acesso da consultora',
       case when (select count(*) from auth.users) > 0
            then '✅ OK — ' || (select count(*) from auth.users)::text || ' usuário(s)'
            else '❌ FALTA — crie em Authentication → Users → Add user'
       end
union all
select 'Mensagens automáticas às 8h (pg_cron)',
       case when exists (select 1 from pg_extension where extname = 'pg_cron')
            then '✅ OK'
            else '⚠️ OPCIONAL — sem isso tudo funciona, só que a consultora clica '
                 || 'em "Gerar mensagens de hoje" na Central de Mensagens'
       end;
