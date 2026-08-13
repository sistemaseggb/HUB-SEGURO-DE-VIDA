// ─────────────────────────────────────────────────────────────────────────────
// O VIGIA NÃO PODE ATRAPALHAR — teste do observador de consultas.
//
// Este arquivo defende algo desconfortável: o vigia fica no caminho de TODAS
// as 161 consultas do sistema. Se ele engolir um resultado, reordenar um
// retorno ou perder um encadeamento, não quebra uma tela — quebra o Hub
// inteiro, em produção, sem aviso.
//
// Então o teste cobra duas coisas em partes iguais:
//   1. que ele AVISE quando a consulta falha (o motivo de existir);
//   2. que ele seja INVISÍVEL no resto — mesmo dado, mesma ordem, mesmo
//      encadeamento, mesmo número de execuções.
//
// Roda contra o banco de demonstração de verdade, que é o mesmo construtor
// encadeável que as telas usam.
//
// Roda com `node scripts/teste-vigia.mjs` (e junto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import { vigiar, aoFalharConsulta, falhaEsperada, tipoDaFalha, MENSAGEM_FALHA } from '../src/lib/vigia.js'
import { criarSupabaseDemo } from '../src/lib/demoDb.js'

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}

// ── 1. O QUE É DEFEITO E O QUE É ROTINA ─────────────────────────────────────
console.log('\n── Nem toda falha é defeito ──')
{
  ok(falhaEsperada({ code: 'PGRST116' }),
    '`.single()` sem linha é pergunta de rotina, não alarme')
  ok(falhaEsperada({ code: '42703', message: 'column "anotacoes_proposta" does not exist' }),
    'coluna que ainda não existe é a detecção de migração funcionando')
  ok(falhaEsperada({ code: '42P01' }), 'tabela ausente idem')
  ok(falhaEsperada({ code: 'PGRST202' }), 'função RPC ausente idem')
  ok(falhaEsperada(null) && falhaEsperada(undefined), 'sem erro nenhum, nada a avisar')

  ok(!falhaEsperada({ code: '42501', message: 'permission denied for table apolices' }),
    'PERMISSÃO NEGADA é defeito — é a lista que aparece vazia sem motivo')
  ok(!falhaEsperada({ message: 'Failed to fetch' }),
    'rede caindo no meio da reunião é defeito')
  ok(!falhaEsperada({ code: '23503', message: 'violates foreign key constraint' }),
    'chave estrangeira barrando uma exclusão é defeito')
  ok(!falhaEsperada({ code: 'PGRST301', message: 'JWT expired' }),
    'sessão expirada é defeito')
}

// ── 2. INVISÍVEL NO CAMINHO FELIZ ───────────────────────────────────────────
console.log('\n── O mesmo resultado de sempre ──')
{
  const cru = criarSupabaseDemo()
  const visto = vigiar(criarSupabaseDemo())

  const a = await cru.from('clientes').select('*').order('nome')
  const b = await visto.from('clientes').select('*').order('nome')
  ok(a.error === null && b.error === null, 'nenhum erro nos dois')
  ok(a.data.length === b.data.length && a.data.length > 0,
    'mesma quantidade de clientes', `${a.data.length} × ${b.data.length}`)
  ok(a.data.map((x) => x.nome).join('|') === b.data.map((x) => x.nome).join('|'),
    'MESMA ORDEM — um vigia que embaralhasse a lista seria pior que o defeito')

  // encadeamento longo, do jeito que as telas escrevem
  const c = await visto.from('clientes').select('id, nome').eq('etapa', 'lead').order('nome').limit(2)
  ok(Array.isArray(c.data) && c.data.length <= 2, 'filtro + ordem + limite atravessam o vigia', c.data?.length)

  // `.single()` e `.maybeSingle()` continuam devolvendo objeto, não lista
  const um = await visto.from('configuracoes').select('*').single()
  ok(um.data && !Array.isArray(um.data), '`.single()` continua devolvendo UM registro')
  const nenhum = await visto.from('clientes').select('*').eq('id', 'não-existe').maybeSingle()
  ok(nenhum.data === null, '`.maybeSingle()` sem achar continua devolvendo nulo')

  // escrita: insert/update/delete precisam realmente escrever
  const novo = await visto.from('clientes').insert({ nome: 'Teste Vigia', etapa: 'lead' }).select().single()
  ok(novo.data?.nome === 'Teste Vigia', 'insert atravessa e devolve a linha criada', novo.error?.message)
  const dep = await visto.from('clientes').select('*').eq('id', novo.data.id).maybeSingle()
  ok(dep.data?.nome === 'Teste Vigia', 'e a linha ficou MESMO no banco')
  await visto.from('clientes').update({ nome: 'Teste Vigia 2' }).eq('id', novo.data.id)
  const dep2 = await visto.from('clientes').select('nome').eq('id', novo.data.id).maybeSingle()
  ok(dep2.data?.nome === 'Teste Vigia 2', 'update atravessa', dep2.data?.nome)
  await visto.from('clientes').delete().eq('id', novo.data.id)
  const dep3 = await visto.from('clientes').select('nome').eq('id', novo.data.id).maybeSingle()
  ok(dep3.data === null, 'delete atravessa')

  // rpc
  const plano = await visto.from('planejamentos').select('token_proposta').limit(1)
  if (plano.data?.[0]?.token_proposta) {
    const r = await visto.rpc('fn_proposta_carregar', { p_token: plano.data[0].token_proposta })
    ok(r.data && !r.data.erro, 'rpc atravessa o vigia', JSON.stringify(r.error ?? r.data?.erro))
  }
}

// ── 3. EXECUTA UMA VEZ SÓ ───────────────────────────────────────────────────
console.log('\n── Uma consulta é uma consulta ──')
{
  // Um vigia que chamasse `then` duas vezes dobraria TODA consulta do sistema:
  // o dobro de rede, o dobro de conta no Supabase, e inserts duplicados.
  let execucoes = 0
  const construtorFalso = {
    eq() { return this },
    select() { return this },
    then(aoOk) { execucoes += 1; return Promise.resolve({ data: [1, 2], error: null }).then(aoOk) },
  }
  const clienteFalso = { from: () => construtorFalso }
  const r = await vigiar(clienteFalso).from('x').select('*').eq('a', 1)
  ok(execucoes === 1, 'a consulta rodou EXATAMENTE uma vez', execucoes)
  ok(r.data.join(',') === '1,2', 'e o dado chegou inteiro', JSON.stringify(r.data))
}

// ── 4. AVISA QUANDO FALHA ───────────────────────────────────────────────────
console.log('\n── O motivo de existir ──')
{
  const avisos = []
  const parar = aoFalharConsulta((a) => avisos.push(a))

  const construtor = (erro) => ({
    select() { return this }, eq() { return this },
    then: (aoOk) => Promise.resolve({ data: null, error: erro }).then(aoOk),
  })
  const erroCliente = (erro) => ({ from: () => construtor(erro), rpc: () => construtor(erro) })

  const r = await vigiar(erroCliente({ code: '42501', message: 'permission denied for table apolices' }))
    .from('apolices').select('*').eq('id_cliente', 'x')
  ok(avisos.length === 1, 'permissão negada gerou UM aviso', avisos.length)
  ok(avisos[0].contexto === 'apolices', 'o aviso diz qual tabela falhou', avisos[0].contexto)
  ok(r.data === null && r.error?.code === '42501',
    'e o resultado original chega intacto a quem chamou — o vigia não engole')

  avisos.length = 0
  await vigiar(erroCliente({ code: 'PGRST116', message: 'no rows' })).from('configuracoes').select('*')
  ok(avisos.length === 0, 'falha de rotina NÃO vira aviso na tela')

  avisos.length = 0
  await vigiar(erroCliente({ message: 'Failed to fetch' })).rpc('fn_proposta_carregar', {})
  ok(avisos.length === 1 && /fn_proposta_carregar/.test(avisos[0].contexto),
    'a rpc também é vigiada, com o nome da função no aviso', avisos[0]?.contexto)

  // um ouvinte com defeito não pode derrubar a consulta de quem chamou
  const pararTorto = aoFalharConsulta(() => { throw new Error('ouvinte quebrado') })
  avisos.length = 0
  let explodiu = false
  try {
    const x = await vigiar(erroCliente({ code: '42501' })).from('t').select('*')
    ok(x.error?.code === '42501', 'a consulta segue mesmo com ouvinte quebrado')
  } catch { explodiu = true }
  ok(!explodiu, 'UM OUVINTE TORTO NÃO DERRUBA O SISTEMA')
  ok(avisos.length === 1, 'e os outros ouvintes continuam recebendo', avisos.length)
  pararTorto()

  parar()
  avisos.length = 0
  await vigiar(erroCliente({ code: '42501' })).from('t').select('*')
  ok(avisos.length === 0, 'cancelar a inscrição para mesmo de avisar')
}

// ── 5. REJEIÇÃO DE VERDADE ──────────────────────────────────────────────────
// ── 5. CADA CAUSA PEDE UM CONSERTO DIFERENTE ────────────────────────────────
console.log('\n── Mandar a mensagem errada faz caçar o problema errado ──')
{
  ok(tipoDaFalha({ code: 'PGRST301', message: 'JWT expired' }) === 'sessao',
    'sessão expirada é reconhecida', tipoDaFalha({ code: 'PGRST301' }))
  ok(tipoDaFalha({ message: 'JWSError: token is expired' }) === 'sessao',
    'e também pela mensagem, sem o código')
  ok(tipoDaFalha({ code: '42501', message: 'permission denied for table apolices' }) === 'permissao',
    'permissão negada é outra coisa')
  ok(tipoDaFalha({ message: 'new row violates row-level security policy' }) === 'permissao',
    'RLS barrando escrita também')
  ok(tipoDaFalha({ message: 'TypeError: Failed to fetch' }) === 'rede', 'rede caindo é rede')
  ok(tipoDaFalha({ message: 'Load failed' }) === 'rede', 'e o jeito que o Safari escreve isso também')
  ok(tipoDaFalha({ code: '22P02', message: 'invalid input syntax' }) === 'banco',
    'o resto cai em "banco"')

  ok(MENSAGEM_FALHA.sessao !== MENSAGEM_FALHA.rede,
    'a mensagem de sessão NÃO é a de rede — mandar "verifique a conexão" para quem só precisa entrar de novo é pior que não dizer nada')
  ok(/entre de novo|entrar de novo/i.test(MENSAGEM_FALHA.sessao),
    'a de sessão diz o que fazer', MENSAGEM_FALHA.sessao)
  ok(Object.values(MENSAGEM_FALHA).every((m) => m.length > 20 && !/erro|falha técnica/i.test(m.slice(0, 8))),
    'nenhuma mensagem começa com "Erro" — ela precisa saber o que fazer, não que houve erro')

  // o aviso que chega ao ouvinte já vem classificado e pronto para a tela
  const recebidos = []
  const parar2 = aoFalharConsulta((a) => recebidos.push(a))
  const cli = {
    from: () => ({ select() { return this },
      then: (aoOk) => Promise.resolve({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } }).then(aoOk) }),
  }
  await vigiar(cli).from('clientes').select('*')
  ok(recebidos[0]?.tipo === 'sessao' && recebidos[0]?.mensagem === MENSAGEM_FALHA.sessao,
    'o ouvinte recebe o tipo e a mensagem prontos', JSON.stringify(recebidos[0]?.tipo))
  parar2()
}

console.log('\n── Quando a promessa rejeita em vez de devolver erro ──')
{
  const clienteQueExplode = {
    from: () => ({ select() { return this }, then: () => Promise.reject(new Error('rede caiu')) }),
  }
  let mensagem = null
  try {
    await vigiar(clienteQueExplode).from('x').select('*')
  } catch (e) { mensagem = e.message }
  ok(mensagem === 'rede caiu',
    'a rejeição chega a quem chamou sem o vigia trocar a mensagem', mensagem)
}

console.log('\n── RESULTADO (vigia) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
