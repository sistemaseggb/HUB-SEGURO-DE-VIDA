// ─────────────────────────────────────────────────────────────────────────────
// O VÃO ONDE O NEGÓCIO MORRE — teste do acompanhamento da proposta.
//
// Este motor decide uma coisa só, e ela é a que importa: COM QUEM ESTÁ A BOLA
// e há quanto tempo. Se ele errar o dono da pendência, a consultora cobra a
// pessoa errada — irrita o cliente que já fez a parte dele, ou fica esperando
// uma seguradora que está esperando por ele.
//
// Cada caso tem a data montada à mão a partir de "hoje", e o resultado
// esperado escrito por extenso.
//
// Roda com `node scripts/teste-propostas.mjs` (e junto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import {
  PRAZOS, SITUACOES, DE_QUEM, conferirProposta, diagnosticarProposta, diasEntre,
  normalizarExigencias, resumoPropostas, situacaoInfo,
} from '../src/lib/propostas.js'

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}

const HOJE = new Date('2026-08-15T12:00:00')
const diasAtras = (n) => new Date(HOJE.getTime() - n * 86400000).toISOString().slice(0, 10)

// ── 1. CONTAGEM DE DIAS ─────────────────────────────────────────────────────
console.log('\n── Contar dias sem errar por um ──')
{
  ok(diasEntre(diasAtras(18), HOJE) === 18, '18 dias atrás são 18 dias', diasEntre(diasAtras(18), HOJE))
  ok(diasEntre(diasAtras(0), HOJE) === 0, 'hoje é zero dia')
  ok(diasEntre(null, HOJE) === null, 'sem data, sem contagem')
  // Datas puras lidas à meia-noite escorregam um dia conforme o fuso — o
  // motor lê ao meio-dia justamente para isso não acontecer.
  ok(diasEntre('2026-08-01', HOJE) === 14, 'data pura não escorrega por causa de fuso', diasEntre('2026-08-01', HOJE))
  ok(diasEntre('2026-08-01T23:50:00.000Z', HOJE) === 14, 'instante perto da meia-noite também não')
}

// ── 2. O QUE VEM DO BANCO ───────────────────────────────────────────────────
console.log('\n── jsonb é campo livre ──')
{
  for (const lixo of [null, undefined, 42, 'texto', {}, [null, 3, 'x'], [{}], [{ o_que: '   ' }]]) {
    const r = normalizarExigencias(lixo)
    ok(Array.isArray(r) && r.length === 0, `${JSON.stringify(lixo)} vira lista vazia`, JSON.stringify(r))
  }
  const r = normalizarExigencias([{ o_que: 'Exame', de_quem: 'marciano' }])
  ok(r.length === 1 && r[0].de_quem === 'cliente',
    'dono desconhecido cai para "cliente" — o caso que exige cobrança', r[0]?.de_quem)
}

// ── 3. COM QUEM ESTÁ A BOLA ─────────────────────────────────────────────────
console.log('\n── A pergunta que decide a ação ──')
{
  const base = { data_envio: diasAtras(10), situacao: 'exigencia', premio_mensal: 800 }

  const comCliente = diagnosticarProposta({
    ...base, exigencias: [{ o_que: 'Exame de sangue', de_quem: 'cliente', pedida_em: diasAtras(3) }],
  }, HOJE)
  ok(comCliente.comQuem === 'cliente', 'pendência do cliente → a bola é dele', comCliente.comQuem)
  ok(!comCliente.travada, '3 dias ainda está no prazo (limite 5)')
  ok(/Esperando o cliente/.test(comCliente.proximaAcao.texto),
    'e a frase diz de quem ela está esperando', comCliente.proximaAcao.texto)

  const atrasadaCliente = diagnosticarProposta({
    ...base, exigencias: [{ o_que: 'Exame de sangue', de_quem: 'cliente', pedida_em: diasAtras(12) }],
  }, HOJE)
  ok(atrasadaCliente.travada, '12 dias com o cliente é atraso')
  ok(/12 dias/.test(atrasadaCliente.proximaAcao.texto),
    'a frase traz o número de dias, que é o que move', atrasadaCliente.proximaAcao.texto)
  ok(/já disse sim/.test(atrasadaCliente.proximaAcao.texto),
    'e lembra o que está em jogo quando a pendência é do cliente')

  // O MESMO atraso na seguradora NÃO é atraso: o prazo dela é outro.
  const mesmosDiasSeguradora = diagnosticarProposta({
    ...base, exigencias: [{ o_que: 'Parecer médico', de_quem: 'seguradora', pedida_em: diasAtras(8) }],
  }, HOJE)
  ok(mesmosDiasSeguradora.comQuem === 'seguradora', 'pendência da seguradora → a bola é dela')
  ok(!mesmosDiasSeguradora.travada,
    '8 dias na seguradora ainda é ritmo normal — cobrar antes é ruído')
  ok(diagnosticarProposta({
    ...base, exigencias: [{ o_que: 'Parecer', de_quem: 'seguradora', pedida_em: diasAtras(14) }],
  }, HOJE).travada, 'mas 14 dias já passou do limite de 10')

  // O que depende dela mesma tem o prazo mais curto de todos.
  ok(diagnosticarProposta({
    ...base, exigencias: [{ o_que: 'Enviar formulário', de_quem: 'consultora', pedida_em: diasAtras(4) }],
  }, HOJE).travada, '4 dias numa pendência dela já é atraso (limite 2)')

  // Duas pendências abertas: manda a MAIS ANTIGA, que é a que segura tudo.
  const duas = diagnosticarProposta({
    ...base,
    exigencias: [
      { o_que: 'Parecer médico', de_quem: 'seguradora', pedida_em: diasAtras(2) },
      { o_que: 'Exame de sangue', de_quem: 'cliente', pedida_em: diasAtras(11) },
    ],
  }, HOJE)
  ok(duas.comQuem === 'cliente', 'a mais antiga define de quem é a bola', duas.comQuem)
  ok(duas.maisAntiga.o_que === 'Exame de sangue', 'e é ela que aparece na frase', duas.maisAntiga.o_que)
  ok(duas.abertas.length === 2 && duas.atrasadas.length === 1,
    'duas abertas, uma atrasada', `${duas.abertas.length}/${duas.atrasadas.length}`)

  // Resolvida sai da conta.
  const resolvida = diagnosticarProposta({
    ...base,
    exigencias: [
      { o_que: 'DPS', de_quem: 'cliente', pedida_em: diasAtras(20), resolvida_em: diasAtras(1) },
    ],
  }, HOJE)
  ok(resolvida.abertas.length === 0, 'pendência resolvida não conta mais')
  ok(!resolvida.travada, 'e não trava a proposta')
}

// ── 4. TRAVADA SEM EXIGÊNCIA NENHUMA ────────────────────────────────────────
console.log('\n── O silêncio também é sintoma ──')
{
  const quieta = diagnosticarProposta(
    { data_envio: diasAtras(22), situacao: 'em_analise', exigencias: [] }, HOJE)
  ok(quieta.travada, '22 dias sem exigência e sem retorno é proposta emperrada')
  ok(/22 dias na seguradora/.test(quieta.proximaAcao.texto),
    'e a frase manda cobrar a mesa', quieta.proximaAcao.texto)

  const recente = diagnosticarProposta(
    { data_envio: diasAtras(6), situacao: 'em_analise', exigencias: [] }, HOJE)
  ok(!recente.travada, '6 dias é ritmo normal de análise')
  ok(/Dentro do prazo normal/.test(recente.proximaAcao.texto),
    'e a tela diz isso, em vez de alarmar à toa', recente.proximaAcao.texto)
}

// ── 5. APROVADA E NÃO EMITIDA ───────────────────────────────────────────────
console.log('\n── Dinheiro parado em cima da mesa ──')
{
  const parada = diagnosticarProposta(
    { data_envio: diasAtras(30), updated_at: diasAtras(9), situacao: 'aprovada', exigencias: [] }, HOJE)
  ok(parada.travada, 'aprovada há 9 dias e não emitida está travada')
  ok(parada.comQuem === 'consultora', 'e a bola é dela — ninguém vai lembrar por ela', parada.comQuem)

  const nova = diagnosticarProposta(
    { data_envio: diasAtras(30), updated_at: diasAtras(1), situacao: 'aprovada', exigencias: [] }, HOJE)
  ok(!nova.travada, 'aprovada ontem ainda não é problema')
}

// ── 6. AS SITUAÇÕES FECHADAS ────────────────────────────────────────────────
console.log('\n── Quando o ciclo termina ──')
{
  for (const s of ['emitida', 'recusada', 'desistiu']) {
    const d = diagnosticarProposta({ data_envio: diasAtras(60), situacao: s, exigencias: [] }, HOJE)
    ok(!d.aberta, `"${s}" não conta como proposta aberta`)
    ok(!d.travada, `"${s}" não aparece como travada`)
    ok(d.comQuem === null, `"${s}" não tem bola com ninguém`)
  }
  const comMotivo = diagnosticarProposta(
    { data_envio: diasAtras(40), situacao: 'recusada', motivo_recusa: 'histórico cardíaco', exigencias: [] }, HOJE)
  ok(/histórico cardíaco/.test(comMotivo.proximaAcao.texto),
    'a recusa com motivo devolve o motivo na frase', comMotivo.proximaAcao.texto)
  ok(/outra seguradora/.test(comMotivo.proximaAcao.texto), 'e aponta o próximo passo')
}

// ── 7. O PAINEL DA CARTEIRA ─────────────────────────────────────────────────
console.log('\n── O que está em risco, somado ──')
{
  const lista = [
    // travada: exigência do cliente há 14 dias
    { id: 1, data_envio: diasAtras(20), situacao: 'exigencia', premio_mensal: 1000, capital: 500_000,
      exigencias: [{ o_que: 'Exame', de_quem: 'cliente', pedida_em: diasAtras(14) }] },
    // no prazo
    { id: 2, data_envio: diasAtras(4), situacao: 'em_analise', premio_mensal: 500, capital: 300_000, exigencias: [] },
    // travada: seguradora há 12 dias
    { id: 3, data_envio: diasAtras(25), situacao: 'exigencia', premio_mensal: 300, capital: 200_000,
      exigencias: [{ o_que: 'Parecer', de_quem: 'seguradora', pedida_em: diasAtras(12) }] },
    // fechada: não entra em conta nenhuma
    { id: 4, data_envio: diasAtras(90), situacao: 'emitida', premio_mensal: 9999, capital: 9_000_000, exigencias: [] },
  ]
  const r = resumoPropostas(lista, HOJE)
  ok(r.abertas.length === 3, 'três propostas abertas (a emitida sai)', r.abertas.length)
  ok(r.travadas.length === 2, 'duas travadas', r.travadas.length)
  ok(r.premioEmRisco === 1300, 'prêmio travado = 1000 + 300', r.premioEmRisco)
  ok(r.premioEmAnalise === 1800, 'prêmio em análise = 1000 + 500 + 300', r.premioEmAnalise)
  ok(r.capitalEmAnalise === 1_000_000, 'capital em análise soma só as abertas', r.capitalEmAnalise)
  ok(r.comCliente === 1 && r.comSeguradora === 2,
    'a bola está com o cliente em uma e com a seguradora em duas',
    `${r.comCliente}/${r.comSeguradora}`)

  ok(r.fila[0].id === 1 && r.fila[1].id === 3,
    'A FILA vem pela urgência real: travadas primeiro, mais parada no topo',
    r.fila.map((x) => x.id).join(','))
  ok(r.fila[2].id === 2, 'e a que está no prazo fica por último')

  const vazio = resumoPropostas([], HOJE)
  ok(vazio.abertas.length === 0 && vazio.premioEmRisco === 0, 'carteira vazia não quebra')
  ok(resumoPropostas(null, HOJE).fila.length === 0, 'lista nula também não')
}

// ── 8. CONFERÊNCIAS ─────────────────────────────────────────────────────────
console.log('\n── O que está registrado de um jeito que não fecha ──')
{
  const semPendencia = conferirProposta({ data_envio: diasAtras(5), situacao: 'exigencia', exigencias: [] })
  ok(semPendencia.some((a) => /nenhuma pendência/.test(a.texto)),
    '"com exigência" sem exigência aberta é apontado')

  const recusaMuda = conferirProposta({ data_envio: diasAtras(5), situacao: 'recusada', exigencias: [] })
  ok(recusaMuda.some((a) => /motivo/.test(a.texto)),
    'recusa sem motivo é apontada — é o que orienta a próxima tentativa')

  const emitidaSolta = conferirProposta({ data_envio: diasAtras(5), situacao: 'emitida', exigencias: [] })
  ok(emitidaSolta.some((a) => /apólice/i.test(a.texto)),
    'emitida sem apólice ligada é apontada — a comissão não entra no fechamento')

  const ok1 = conferirProposta({
    data_envio: diasAtras(3), situacao: 'exigencia', premio_mensal: 900,
    exigencias: [{ o_que: 'Exame', de_quem: 'cliente', pedida_em: diasAtras(1) }],
  })
  ok(ok1.length === 0, 'uma proposta bem registrada não recebe aviso nenhum', JSON.stringify(ok1))
}

// ── 9. O CATÁLOGO ───────────────────────────────────────────────────────────
console.log('\n── As situações e os prazos ──')
{
  ok(SITUACOES.length === 7, 'sete situações cobrem o caminho real', SITUACOES.length)
  ok(SITUACOES.every((s) => s.rotulo && s.ajuda && s.tom),
    'toda situação tem rótulo, tom e uma frase explicando o que ela significa')
  ok(SITUACOES.filter((s) => s.aberta).length === 4,
    'quatro contam como proposta viva', SITUACOES.filter((s) => s.aberta).length)
  ok(situacaoInfo('inventada').id === 'enviada', 'situação desconhecida cai na primeira, sem quebrar')
  ok(DE_QUEM.length === 3 && DE_QUEM.every((d) => d.ajuda), 'os três donos possíveis, cada um explicado')
  ok(PRAZOS.exigenciaConsultora < PRAZOS.exigenciaCliente
    && PRAZOS.exigenciaCliente < PRAZOS.exigenciaSeguradora,
  'os prazos crescem de quem ela controla para quem ela não controla',
  JSON.stringify(PRAZOS))
}

console.log('\n── RESULTADO (propostas em análise) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
