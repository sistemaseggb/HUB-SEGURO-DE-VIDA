import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
const admin = '10000000-0000-4000-8000-000000000001'
const leitura = '10000000-0000-4000-8000-000000000002'
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    insert into auth.users(id,created_at) values('${admin}','2026-01-01'),('${leitura}','2026-01-02');`)
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    try {
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
    } catch (e) {
      console.error('Migração:', file)
      throw e
    }
  }
  await db.exec(readFileSync('supabase/atualizacao_consultoria.sql','utf8'))
  console.log('✓ Pacote transacional de atualização executado e reaplicável')
  console.log('✓ Todas as migrações aplicadas em PostgreSQL isolado')
  for (const f of readdirSync('supabase/migrations')
    .filter((f) => /^(032|033|034|035|036)/.test(f))
    .sort())
    await db.exec(readFileSync('supabase/migrations/' + f, 'utf8'))
  console.log('✓ Migrações novas reaplicáveis')
  await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false);
    update hub_perfis set papel='leitura' where user_id='${leitura}';`)
  const a = (await db.query("insert into assessores(nome) values('Assessor teste') returning id"))
    .rows[0].id
  const c = (
    await db.query(
      "insert into clientes(nome,id_assessor,data_nascimento) values('Cliente teste',$1,'1980-01-01') returning id",
      [a],
    )
  ).rows[0].id
  await db.query(
    "insert into planejamentos(id_cliente,renda_mensal,objetivos,observacoes_reuniao,condicoes_declaradas) values($1,10000,'Proteção','NOTA_INTERNA','DADO_SAUDE')",
    [c],
  )
  const v = (await db.query('select fn_proposta_publicar($1,30) as v', [c])).rows[0].v
  const pub = () => db.query('select fn_proposta_carregar($1) as p', [v.token])
  const antes = (await pub()).rows[0].p
  assert.equal(antes.plano.renda_mensal, 10000)
  assert.equal(antes.plano.observacoes_reuniao, undefined)
  assert.equal(antes.plano.condicoes_declaradas, undefined)
  assert.equal(antes.plano.comissao_natalia, undefined)
  await db.query('update planejamentos set renda_mensal=20000 where id_cliente=$1', [c])
  assert.equal((await pub()).rows[0].p.plano.renda_mensal, 10000)
  console.log('✓ Snapshot público imutável e sem notas internas, saúde ou comissão')
  await db.exec('set role anon')
  assert.equal((await pub()).rows[0].p.cliente_nome, 'Cliente teste')
  await assert.rejects(() => db.query('select fn_proposta_publicar($1,30)', [c]))
  await db.exec('reset role')
  await db.query('select fn_proposta_revogar($1)', [v.id])
  assert.ok((await pub()).rows[0].p.erro)
  const exp = (await db.query('select fn_proposta_publicar($1,1) as v', [c])).rows[0].v
  await db.query("update propostas_versoes set validade=now()-interval '1 second' where id=$1", [
    exp.id,
  ])
  assert.ok((await db.query('select fn_proposta_carregar($1) as p', [exp.token])).rows[0].p.erro)
  console.log('✓ Anônimo não publica; links revogados e vencidos não retornam dados')
  await db.exec(
    `grant select,insert,update,delete on all tables in schema public to authenticated; revoke insert,update,delete on propostas_versoes,eventos_auditoria from authenticated; set role authenticated; select set_config('request.jwt.claim.sub','${leitura}',false);`,
  )
  assert.equal(
    (await db.query("update clientes set nome='Não pode' where id=$1 returning id", [c])).rows
      .length,
    0,
  )
  await assert.rejects(() => db.query('select fn_gerar_fila_diaria()'))
  await assert.rejects(() => db.query('select fn_proposta_publicar($1,30)', [c]))
  assert.equal((await db.query('select count(*)::int as n from eventos_auditoria')).rows[0].n, 0)
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${admin}',false); set role authenticated;`,
  )
  const id = '20000000-0000-4000-8000-000000000001'
  await db.query(
    "select fn_registrar_atendimento($1,$2,'whatsapp','Conversei','Enviar estudo',current_date)",
    [id, c],
  )
  await db.query(
    "select fn_registrar_atendimento($1,$2,'whatsapp','Conversei','Enviar estudo',current_date)",
    [id, c],
  )
  assert.equal(
    (await db.query('select count(*)::int as n from interacoes where id_cliente=$1', [c])).rows[0]
      .n,
    1,
  )
  await assert.rejects(() =>
    db.query('select fn_hub_salvar_acompanhamento($1)', [
      JSON.stringify({
        id_cliente: c,
        fase: 'emissao',
        emissao: 'vigente',
        pagamento_confirmado: false,
        updated_at: new Date().toISOString(),
      }),
    ]),
  )
  const ac = {
    id_cliente: c,
    fase: 'revisao',
    emissao: 'nao_iniciada',
    pagamento_confirmado: false,
    revisao_em: '2027-01-01',
    updated_at: new Date().toISOString(),
  }
  await db.query('select fn_hub_salvar_acompanhamento($1)', [JSON.stringify(ac)])
  await db.query('select fn_hub_salvar_acompanhamento($1)', [JSON.stringify(ac)])
  assert.equal(
    (
      await db.query('select count(*)::int as n from tarefas where origem_chave=$1', [
        'revisao:' + c,
      ])
    ).rows[0].n,
    1,
  )
  console.log(
    '✓ Perfil leitura bloqueado; atendimento idempotente; revisão sem tarefa duplicada; vigência exige confirmação',
  )
  // Concurrency: a stale study must never overwrite a newer edit.
  const plano = (await db.query('select * from planejamentos where id_cliente=$1', [c])).rows[0]
  const salvo = (
    await db.query('select fn_planejamento_salvar($1,$2,$3) as p', [
      c,
      JSON.stringify({ renda_mensal: 21000 }),
      plano.updated_at,
    ])
  ).rows[0].p
  await assert.rejects(() =>
    db.query('select fn_planejamento_salvar($1,$2,$3)', [
      c,
      JSON.stringify({ renda_mensal: 1 }),
      plano.updated_at,
    ]),
  )
  assert.equal(
    (await db.query('select renda_mensal from planejamentos where id_cliente=$1', [c])).rows[0]
      .renda_mensal,
    '21000.00',
  )
  assert.ok(salvo.updated_at)
  console.log('✓ Estudo desatualizado não sobrescreve a edição mais recente')
  const lote = '30000000-0000-4000-8000-000000000001'
  const linhas = [
    {
      competencia: '2026-10-01',
      seguradora: 'Teste',
      segmento: 'individual',
      cliente_nome: 'Cliente teste',
      valor: 200,
      id_cliente: c,
      origem: 'extrato.xlsx',
    },
  ]
  await db.query('select fn_importar_comissoes($1,$2)', [JSON.stringify(linhas), lote])
  await assert.rejects(() =>
    db.query('select fn_importar_comissoes($1,$2)', [
      JSON.stringify([{ ...linhas[0], valor: 'invalido' }]),
      '30000000-0000-4000-8000-000000000002',
    ]),
  )
  assert.equal(
    (await db.query("select sum(valor) as n from comissoes_importadas where seguradora='Teste'"))
      .rows[0].n,
    '200.00',
  )
  assert.equal((await db.query('select count(*)::int as n from importacoes_lotes')).rows[0].n, 1)
  await db.query('select fn_importar_comissoes($1,$2)', [JSON.stringify(linhas), lote])
  assert.equal(
    (await db.query("select count(*)::int as n from comissoes_importadas where seguradora='Teste'"))
      .rows[0].n,
    1,
  )
  console.log('✓ Importação inválida desfaz exclusão e lote; repetição não duplica lançamentos')
  // Inserts specify columns so database defaults (UUID/author/date) are actually exercised.
  const q = (
    await db.query(
      "insert into cotacoes(id_cliente,seguradora,produto,premio,capital,coberturas,exclusoes,carencias,franquias,reajuste,validade,data_cotacao) values($1,'Teste','Vida',500,100000,'Morte','Condições','Contrato','Nenhuma','Anual','2020-01-02','2020-01-01') returning id",
      [c],
    )
  ).rows[0]
  await assert.rejects(() => db.query('select fn_cotacao_aplicar($1)', [q.id]))
  console.log('✓ Cotação vencida não substitui o prêmio do estudo')
  const seg = (await db.query('select id from seguradoras limit 1')).rows[0].id
  const op = '40000000-0000-4000-8000-000000000001'
  const venda = {
    id_seguradora: seg,
    numero_apolice: 'TESTE',
    valor_premio_mensal: 500,
    capital_segurado: 100000,
    percentual_comissao: 0,
    data_vigencia: '2026-10-15',
    status: 'ativa',
  }
  const chamarVenda = () =>
    db.query('select fn_apolice_criar($1,$2,$3)', [op, c, JSON.stringify(venda)])
  await chamarVenda()
  await chamarVenda()
  assert.equal(
    (await db.query('select count(*)::int as n from apolices where id_operacao=$1', [op])).rows[0]
      .n,
    1,
  )
  assert.equal(
    (await db.query('select percentual_comissao from apolices where id_operacao=$1', [op])).rows[0]
      .percentual_comissao,
    '0.00',
  )
  console.log('✓ Retentativa de venda não duplica apólice e preserva comissão zero')
  const formulario = (
    await db.query(
      'insert into formularios_planejamento(id_cliente) values($1) returning id,token',
      [c],
    )
  ).rows[0]
  await db.query('select fn_form_revogar($1,true)', [formulario.id])
  await db.exec('set role anon')
  assert.ok((await db.query('select fn_plan_carregar($1) as p', [formulario.token])).rows[0].p.erro)
  await assert.rejects(() => db.query('select fn_plan_carregar_base036($1)', [formulario.token]))
  await db.exec('reset role; set role authenticated')
  console.log('✓ Formulário revogado indisponível; função interna não contorna a revogação')
  await assert.rejects(() => db.query('select fn_hub_atribuir_perfil($1,$2)', [admin, 'leitura']))
  console.log('✓ O último administrador não pode perder seu perfil')
  const doc=(await db.query("insert into documentos(id_cliente,nome,categoria,caminho) values($1,'cotacao.pdf','proposta','teste/cotacao.pdf') returning id",[c])).rows[0]
  await db.query('update cotacoes set id_documento=$1 where id=$2',[doc.id,q.id])
  await assert.rejects(()=>db.query('select fn_documento_preparar_exclusao($1)',[doc.id]))
  await db.query('update cotacoes set id_documento=null where id=$1',[q.id])
  assert.equal((await db.query('select fn_documento_preparar_exclusao($1) as caminho',[doc.id])).rows[0].caminho,'teste/cotacao.pdf')
  await assert.rejects(()=>db.query('update cotacoes set id_documento=$1 where id=$2',[doc.id,q.id]))
  console.log('✓ Documento usado por cotação é preservado; arquivo em exclusão não recebe novo vínculo')
  const origem=(await db.query("insert into clientes(nome,id_assessor) values('Cadastro duplicado',$1) returning id",[a])).rows[0].id
  await db.query("insert into interacoes(id_cliente,tipo,descricao) values($1,'nota','Histórico preservado')",[origem])
  await db.query('select fn_hub_mesclar_clientes($1,$2)',[origem,c])
  assert.equal((await db.query("select count(*)::int as n from interacoes where id_cliente=$1 and descricao='Histórico preservado'",[c])).rows[0].n,1)
  assert.equal((await db.query('select count(*)::int as n from clientes where id=$1',[origem])).rows[0].n,0)
  await assert.rejects(()=>db.query('select fn_hub_restaurar_cliente($1)',[origem]))
  console.log('✓ Consolidação transfere histórico e não desfaz vínculos por restauração simples')
  await db.query('select fn_hub_arquivar_cliente($1)', [c])
  assert.equal(
    (await db.query('select count(*)::int as n from clientes where id=$1', [c])).rows[0].n,
    0,
  )
  await db.query('select fn_hub_restaurar_cliente($1)', [c])
  assert.equal(
    (await db.query('select count(*)::int as n from clientes where id=$1', [c])).rows[0].n,
    1,
  )
  await db.exec('reset role')
  assert.ok(
    (await db.query("select count(*)::int as n from eventos_auditoria where tabela='clientes'"))
      .rows[0].n > 0,
  )
  console.log('✓ Arquivamento recuperável e trilha de auditoria preservados')
} finally {
  await db.close()
}
