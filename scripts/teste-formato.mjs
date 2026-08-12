// ─────────────────────────────────────────────────────────────────────────────
// HORA, DATA E DINHEIRO — o teste do arquivo que ninguém desconfia.
//
// `format.js` parece inofensivo: formatar moeda, formatar data. Mas é onde
// mora a conversão entre a hora que a consultora DIGITA e o instante que o
// banco GUARDA — e é ali que aconteceu o defeito mais caro que este sistema
// já teve:
//
//     ela marcava a reunião para as 14:30 e o sistema guardava 11:30.
//
// O campo `<input type="datetime-local">` entrega "2026-08-15T14:30", sem
// fuso. Mandando essa string direto para uma coluna `timestamptz`, quem decide
// o fuso é o servidor — e o Supabase roda em UTC. A reunião nascia três horas
// mais cedo, o lembrete disparava três horas mais cedo, e a confirmação no
// WhatsApp chegava ao cliente com a hora errada.
//
// Este arquivo roda com TZ=America/Sao_Paulo forçado, porque um teste de fuso
// que roda no fuso do servidor não testa fuso nenhum.
//
// Roda com `node scripts/teste-formato.mjs` (e junto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
process.env.TZ = 'America/Sao_Paulo'

const {
  brl, brlCompacto, dataBR, hojeLocal, mesLocal, diaLocal,
  localParaISO, isoParaLocal, tempoRelativo, whatsapp, iniciais,
} = await import('../src/lib/format.js')

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}

ok(new Date().getTimezoneOffset() === 180,
  'o teste está mesmo rodando no fuso do Brasil (UTC-3)', new Date().getTimezoneOffset())

// ── 1. A HORA QUE ELA DIGITA É A HORA QUE FICA ──────────────────────────────
console.log('\n── 14:30 tem que continuar 14:30 ──')
{
  const digitado = '2026-08-15T14:30'
  const guardado = localParaISO(digitado)
  ok(guardado === '2026-08-15T17:30:00.000Z',
    'a hora local vira instante em UTC, explicitamente', guardado)

  const naTela = new Date(guardado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  ok(naTela === '14:30', 'E VOLTA 14:30 NA TELA — o defeito que este teste existe para travar', naTela)
  ok(isoParaLocal(guardado) === digitado,
    'e volta idêntico ao campo, para editar sem estragar', isoParaLocal(guardado))

  // o defeito antigo, escrito por extenso para nunca mais voltar disfarçado
  const comoEraAntes = new Date(`${digitado}Z`).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  ok(comoEraAntes === '11:30' && naTela !== comoEraAntes,
    'mandar a string crua daria 11:30 — três horas antes', comoEraAntes)
}
{
  // meia-noite é o pior caso: erra a hora E o dia
  const guardado = localParaISO('2026-03-10T00:15')
  const d = new Date(guardado)
  ok(d.toLocaleDateString('pt-BR') === '10/03/2026' && d.getHours() === 0 && d.getMinutes() === 15,
    'reunião de madrugada não escorrega para o dia anterior',
    d.toLocaleString('pt-BR'))
}
{
  // horário de verão do hemisfério norte não pode contaminar a conta
  for (const v of ['2026-01-15T09:00', '2026-07-15T09:00', '2026-11-02T09:00']) {
    const volta = new Date(localParaISO(v)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    ok(volta === '09:00', `${v.slice(0, 10)} continua 09:00`, volta)
  }
}
{
  ok(localParaISO('') === null && localParaISO(null) === null,
    'campo em branco vira nulo, não "Invalid Date"')
  ok(localParaISO('não é data') === null, 'texto inválido vira nulo em vez de gravar lixo')
  ok(isoParaLocal(null) === '' && isoParaLocal('xxx') === '',
    'e o caminho de volta também aguenta lixo')
}

// ── 2. O DIA DE HOJE, NO FUSO DELA ──────────────────────────────────────────
console.log('\n── 22h de terça ainda é terça ──')
{
  // Este é o outro lado do mesmo defeito: entre 21h e a meia-noite, o
  // `toISOString()` já está no dia seguinte em UTC.
  const hoje = hojeLocal()
  ok(/^\d{4}-\d{2}-\d{2}$/.test(hoje), 'hojeLocal devolve AAAA-MM-DD', hoje)
  const esperado = new Date().toLocaleDateString('en-CA') // en-CA já é AAAA-MM-DD
  ok(hoje === esperado, 'e é o dia de hoje no fuso do Brasil', `${hoje} × ${esperado}`)
  ok(mesLocal() === hoje.slice(0, 7), 'mesLocal é o mês desse mesmo dia', mesLocal())

  ok(diaLocal('2026-08-15T23:30:00.000Z') === '2026-08-15',
    'um instante às 20:30 no Brasil continua no dia 15', diaLocal('2026-08-15T23:30:00.000Z'))
  ok(diaLocal('2026-08-16T02:00:00.000Z') === '2026-08-15',
    'e 02:00 UTC ainda é o dia 15 aqui — 23h', diaLocal('2026-08-16T02:00:00.000Z'))
}

// ── 3. DINHEIRO ─────────────────────────────────────────────────────────────
console.log('\n── Dinheiro na tela do cliente ──')
{
  ok(brl(1890).replace(/ /g, ' ') === 'R$ 1.890,00', 'moeda em português', brl(1890))
  ok(brl(0).includes('0,00'), 'zero é zero, não vazio', brl(0))
  // Nada aqui pode virar "R$ NaN" na frente do cliente.
  for (const v of [null, undefined, '', 'abc', NaN, Infinity, -Infinity]) {
    const s = brl(v)
    ok(!/NaN|Infinity|undefined|null/.test(s), `brl(${JSON.stringify(v)}) não vaza lixo`, s)
  }
  for (const v of [null, undefined, NaN, Infinity, 'abc']) {
    const s = brlCompacto(v)
    ok(!/NaN|Infinity|undefined|null/.test(s), `brlCompacto(${JSON.stringify(v)}) não vaza lixo`, s)
  }
  ok(/1,9\s*mi|1,89\s*mi/.test(brlCompacto(1_890_000)), 'milhão vira "mi"', brlCompacto(1_890_000))
  ok(/mil/.test(brlCompacto(456_000)), 'centena de milhar vira "mil"', brlCompacto(456_000))
  ok(brlCompacto(0) === brlCompacto(0), 'compacto é estável')
}

// ── 4. DATA E TEMPO EM TEXTO ────────────────────────────────────────────────
console.log('\n── O resto do arquivo ──')
{
  ok(dataBR(null) === '—' && dataBR('') === '—', 'data vazia vira travessão, não "Invalid Date"')
  ok(dataBR('2026-08-15') === '15/08/2026',
    'data pura NÃO escorrega um dia para trás', dataBR('2026-08-15'))
  ok(tempoRelativo(null) === '—', 'tempo relativo sem data')
  ok(tempoRelativo(new Date().toISOString()) === 'hoje', 'agora é hoje')
  ok(tempoRelativo(new Date(Date.now() - 86400000).toISOString()) === 'ontem', 'ontem é ontem')

  ok(whatsapp('(51) 99999-8888').includes('5551999998888'),
    'telefone brasileiro vira link com DDI', whatsapp('(51) 99999-8888'))
  ok(whatsapp('') === null && whatsapp(null) === null, 'sem telefone, sem link')
  ok(whatsapp('123') === null, 'telefone curto demais não vira link falso', whatsapp('123'))
  const comTexto = whatsapp('51999998888', 'Olá & tudo bem?')
  ok(comTexto.includes('%26') || comTexto.includes('%20'),
    'a mensagem vai codificada para a URL', comTexto.slice(-40))

  ok(iniciais('Carlos Eduardo Menezes') === 'CM', 'iniciais pegam primeiro e último',
    iniciais('Carlos Eduardo Menezes'))
  ok(iniciais('') === '' || iniciais('').length <= 2, 'nome vazio não quebra', JSON.stringify(iniciais('')))
  ok(iniciais('Ana') === 'A', 'nome único devolve uma letra', iniciais('Ana'))
}

console.log('\n── RESULTADO (formato) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
