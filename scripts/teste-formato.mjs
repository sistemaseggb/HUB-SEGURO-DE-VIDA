// ─────────────────────────────────────────────────────────────────────────────
// AS FUNÇÕES DE FORMATO — as menores do sistema, e as mais vistas.
//
// `format.js` não calcula nada: só decide como cada número e cada data
// APARECEM. Por isso nunca teve teste, e por isso os dois defeitos abaixo
// sobreviveram tanto tempo — nenhum deles quebra uma tela, os dois só dizem a
// coisa errada com a maior naturalidade do mundo.
//
// O que se cobra aqui é diferente do que se cobra do motor:
//
//   · TEMPO É DIA DE CALENDÁRIO, NÃO INTERVALO. "há quantos dias falei com
//     ele" precisa dar a mesma resposta às nove da manhã e às onze da noite.
//     O arquivo já tinha corrigido essa virada duas vezes (`hojeLocal`,
//     `mesLocal`) e deixado passar na terceira.
//
//   · A ESCALA VEM DEPOIS DO ARREDONDAMENTO. R$ 999.999 não é "R$ 1.000 mil".
//
//   · NADA QUEBRA COM LIXO. Data inválida, nulo e texto viram travessão, não
//     "NaN" nem "Invalid Date" na frente do cliente.
//
// Roda com `npm run test:formato` (e junto de `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
// ── O FUSO É PARTE DO TESTE, NÃO DO AMBIENTE ────────────────────────────────
// O defeito que este arquivo guarda é o de UTC-3: "2026-08-13" é meia-noite em
// UTC, e às 21h de Brasília a diferença já passou de 24 horas. Rodando em UTC
// (como roda a CI) o caso simplesmente não existe, e o teste passaria sem
// provar nada. Fixar o fuso aqui — antes do primeiro `Date` — faz a máquina de
// quem roda deixar de importar: o que se confere é o fuso de quem USA o
// sistema. Precisa vir antes de qualquer import que construa uma data.
process.env.TZ = 'America/Sao_Paulo'

const { brl, brlCompacto, dataBR, mesBR, tempoRelativo, hojeLocal, mesLocal,
  diaLocal, whatsapp, iniciais } = await import('../src/lib/format.js')

const fusoOk = new Date('2026-08-13T12:00:00Z').getHours() === 9

let falhas = 0
let feitos = 0
const ok = (cond, nome, detalhe = '') => {
  feitos += 1
  if (cond) { console.log(`✓ ${nome}`); return true }
  falhas += 1
  console.log(`✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  return false
}
// `toLocaleString` com moeda separa "R$" do número com um espaço NÃO-QUEBRÁVEL
// (U+00A0), que é o certo para a tela e invisível num diff. Comparar com o
// espaço comum daria uma falha impossível de entender ("esperava R$ 999,00,
// veio R$ 999,00"), então os dois lados são normalizados antes.
const semNbsp = (v) => (typeof v === 'string' ? v.replace(/\u00a0/g, ' ') : v)
const eq = (obtido, esperado, nome) =>
  ok(semNbsp(obtido) === semNbsp(esperado), nome,
    `esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`)

ok(fusoOk, 'o teste está rodando no fuso de Brasília (UTC-3), que é o do defeito')

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── "há quantos dias" não pode mudar de resposta às 21h ──')
// ─────────────────────────────────────────────────────────────────────────────
// O sistema é usado à noite: é o horário em que o cliente responde no
// WhatsApp. Um contato feito hoje de manhã aparecia como "ontem" para quem
// abrisse a tela depois das 21h, porque "2026-08-13" é meia-noite em UTC e a
// conta era feita entre INSTANTES, não entre dias.
{
  const dia = '2026-08-13'
  // do primeiro ao último minuto do mesmo dia, no fuso de Brasília
  const horas = ['00:01', '06:00', '09:00', '12:00', '17:00', '20:59', '21:00', '23:59']
  let estavel = true
  const respostas = new Set()
  for (const h of horas) {
    const agora = new Date(`${dia}T${h}:00-03:00`)
    const r = tempoRelativo(dia, agora)
    respostas.add(r)
    if (r !== 'hoje') { estavel = false; console.log(`   ✗ às ${h} disse "${r}"`) }
  }
  ok(estavel && respostas.size === 1,
    'um contato de hoje é "hoje" a qualquer hora do dia', [...respostas].join(' / '))

  // e a véspera é "ontem" o dia inteiro, pelo mesmo motivo
  let ontemEstavel = true
  for (const h of horas) {
    const agora = new Date(`${dia}T${h}:00-03:00`)
    if (tempoRelativo('2026-08-12', agora) !== 'ontem') ontemEstavel = false
  }
  ok(ontemEstavel, 'e a véspera é "ontem" a qualquer hora do dia')
}

{
  const agora = new Date('2026-08-13T22:30:00-03:00')
  eq(tempoRelativo('2026-08-08', agora), 'há 5 dias', 'cinco dias atrás são cinco dias, mesmo às 22h30')
  eq(tempoRelativo('2026-07-13', agora), 'há 1 mês', 'um mês vira "há 1 mês"')
  eq(tempoRelativo('2026-02-13', agora), 'há 6 meses', 'seis meses viram "há 6 meses"')
  eq(tempoRelativo('2024-08-13', agora), 'há 2 ano(s)', 'dois anos viram anos')
  // data futura (reunião marcada) não vira número negativo na tela
  eq(tempoRelativo('2026-08-20', agora), 'hoje', 'data no futuro não vira "há -7 dias"')
}

{
  // A virada de horário de verão não existe mais no Brasil, mas o navegador
  // pode estar em qualquer fuso: o que se cobra é que a resposta dependa do
  // dia local, e não do deslocamento.
  const meiaNoiteEmPonto = new Date('2026-08-13T00:00:00-03:00')
  eq(tempoRelativo('2026-08-13', meiaNoiteEmPonto), 'hoje', 'à meia-noite em ponto ainda é hoje')
  eq(tempoRelativo('2026-08-12', meiaNoiteEmPonto), 'ontem', 'e a véspera acabou de virar ontem')
}

{
  let semQuebrar = true
  for (const lixo of [null, undefined, '', '   ', 'abc', '2026-13-45', 0, false, {}, []]) {
    let r
    try { r = tempoRelativo(lixo, new Date('2026-08-13T10:00:00-03:00')) } catch { semQuebrar = false; continue }
    if (typeof r !== 'string' || /NaN|Invalid/i.test(r)) {
      semQuebrar = false
      console.log(`   ✗ ${JSON.stringify(lixo)} → ${JSON.stringify(r)}`)
    }
  }
  ok(semQuebrar, 'lixo no lugar da data vira travessão, nunca "NaN" nem "Invalid Date"')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O número compacto escolhe a escala DEPOIS de arredondar ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  eq(brlCompacto(999_999), 'R$ 1 mi', 'R$ 999.999 é "R$ 1 mi", não "R$ 1.000 mil"')
  eq(brlCompacto(999_500), 'R$ 1 mi', 'e R$ 999.500 também')
  eq(brlCompacto(999_499), 'R$ 999 mil', 'logo abaixo da virada continua em milhares')
  eq(brlCompacto(1_500_000), 'R$ 1,5 mi', 'milhões ganham uma casa decimal')
  eq(brlCompacto(45_000), 'R$ 45 mil', 'milhares saem redondos')
  eq(brlCompacto(999), 'R$ 999,00', 'abaixo de mil sai a moeda inteira')
  eq(brlCompacto(null), '—', 'nulo vira travessão')

  // nenhuma saída pode carregar quatro dígitos antes da unidade: a função
  // existe para caber em pouco espaço
  let compacto = true
  for (let v = 1_000; v <= 2_000_000; v += 977) {
    const s = brlCompacto(v)
    if (/\d{1,3}\.\d{3}\s(mil|mi)/.test(s)) { compacto = false; console.log(`   ✗ ${v} → ${s}`); break }
  }
  ok(compacto, 'nenhum valor sai com quatro dígitos antes de "mil" ou "mi"')

  let semNaN = true
  for (const lixo of [undefined, 'abc', NaN, Infinity, -Infinity]) {
    const s = brlCompacto(lixo)
    if (/NaN|Infinity/.test(s)) { semNaN = false; console.log(`   ✗ ${String(lixo)} → ${s}`) }
  }
  ok(semNaN, 'lixo no lugar do valor não vira "NaN" nem "Infinity" na tela')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O resto do formato, que já estava certo e precisa continuar ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  eq(dataBR('2026-08-13'), '13/08/2026', 'data ISO vira data brasileira')
  eq(dataBR('2026-08-13T22:00:00Z'), '13/08/2026', 'e o horário não empurra o dia')
  eq(dataBR(null), '—', 'data vazia vira travessão')
  eq(mesBR('2026-08-13'), 'ago/26', 'mês sai abreviado')
  eq(mesBR(null), '—', 'mês vazio vira travessão')

  ok(/^\d{4}-\d{2}-\d{2}$/.test(hojeLocal()), 'hojeLocal devolve AAAA-MM-DD')
  ok(mesLocal() === hojeLocal().slice(0, 7), 'mesLocal é o prefixo de hojeLocal')
  eq(diaLocal(new Date('2026-08-13T12:00:00-03:00')), '2026-08-13', 'diaLocal ancora no dia local')

  eq(whatsapp('41999998888'), 'https://wa.me/5541999998888', 'telefone brasileiro ganha o 55')
  eq(whatsapp('5541999998888'), 'https://wa.me/5541999998888', 'e quem já tem o 55 não ganha outro')
  eq(whatsapp(''), null, 'telefone vazio não vira link quebrado')
  ok(whatsapp('41999998888', 'Oi, tudo bem?').includes('text=Oi%2C%20tudo%20bem%3F'),
    'a mensagem pronta vai codificada na URL')

  eq(iniciais('Natália Maschendorf'), 'NM', 'duas iniciais')
  eq(iniciais('Carlos'), 'C', 'nome único dá uma inicial')
  eq(iniciais(''), '', 'nome vazio não quebra')
  eq(brl(null), '—', 'valor nulo vira travessão')
}

console.log('\n── RESULTADO (formato) ──')
console.log(falhas === 0 ? `Falhas: nenhuma 🎉  (${feitos} conferências)` : `Falhas: ${falhas} de ${feitos}`)
process.exit(falhas ? 1 : 0)
