// ─────────────────────────────────────────────────────────────────────────────
// TESTE DA APURAÇÃO DOS GB AWARDS.
//
// Este é um número que decide quem sobe no palco em novembro. Se a apuração
// errar, alguém recebe um troféu que não é dele — e o erro só aparece quando
// já não dá para desfazer.
//
// Cada bloco responde a uma pergunta que a apuração precisa saber responder:
//
//   · a janela do ano é mesmo de 1º de janeiro a 30 de novembro?
//   · o que ficou fora do ano (ou depois do fechamento) fica fora mesmo?
//   · apólice cancelada premia? (não — a menos que o escritório mande)
//   · os dois prêmios sabem ter donos diferentes?
//   · empate no topo vira dois primeiros, ou o sistema escolhe um por conta?
//   · apólice sem assessor some ou volta separada para ser corrigida?
//   · a soma das partes é o total? (a conta que uma auditoria refaz na mão)
// ─────────────────────────────────────────────────────────────────────────────

import {
  apurarPremiacao, janelaApuracao, vantagemDoLider, anosComEmissao,
  MES_FECHAMENTO_PADRAO,
} from '../src/lib/premiacao.js'

let falhas = 0
let feitos = 0
const ok = (cond, nome, detalhe = '') => {
  feitos += 1
  if (cond) { console.log(`✓ ${nome}`); return true }
  falhas += 1
  console.log(`✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  return false
}

// ── Um escritório de mentira, com o desenho que a premiação precisa provar ──
// Ana emite MUITAS apólices pequenas; Bruno emite POUCAS e grandes. É o caso
// que justifica existirem dois prêmios em vez de um.
const assessores = [
  { id: 'ana', nome: 'Ana Prado', codigo: 'A100', ativo: true },
  { id: 'bru', nome: 'Bruno Lisboa', codigo: 'A200', ativo: true },
  { id: 'caio', nome: 'Caio Vieira', codigo: 'A300', ativo: true },
  { id: 'reserva', nome: '(sem assessor)', codigo: null, ativo: true },
]
const seguradoras = [{ id: 's1', nome: 'MAG' }, { id: 's2', nome: 'Azos' }]

let seqCliente = 0
const clientes = []
const cliente = (idAssessor) => {
  const c = { id: `c${++seqCliente}`, nome: `Cliente ${seqCliente}`, id_assessor: idAssessor }
  clientes.push(c)
  return c.id
}

let seqApolice = 0
const apolice = (idAssessor, premio, vigencia, extras = {}) => ({
  id: `a${++seqApolice}`,
  id_cliente: extras.idCliente ?? cliente(idAssessor),
  id_seguradora: extras.seguradora ?? 's1',
  valor_premio_mensal: premio,
  data_vigencia: vigencia,
  status: extras.status ?? 'ativa',
})

const apolices = [
  // Ana: 5 apólices de R$ 200 → 5 apólices, R$ 1.000/mês
  apolice('ana', 200, '2026-02-10'),
  apolice('ana', 200, '2026-03-11'),
  apolice('ana', 200, '2026-05-02'),
  apolice('ana', 200, '2026-08-19'),
  apolice('ana', 200, '2026-11-30'), // último dia da janela: entra
  // Bruno: 2 apólices grandes → 2 apólices, R$ 1.500/mês
  apolice('bru', 900, '2026-04-01', { seguradora: 's2' }),
  apolice('bru', 600, '2026-09-15'),
  // Caio: 1 apólice
  apolice('caio', 350, '2026-06-06'),
  // fora da janela: dezembro (depois do fechamento) e ano anterior
  apolice('ana', 5000, '2026-12-01'),
  apolice('ana', 5000, '2025-12-31'),
  // cancelada no meio do ano
  apolice('bru', 400, '2026-07-07', { status: 'cancelada' }),
  // apólice sem assessor identificado (o reserva do importador)
  apolice('reserva', 777, '2026-10-10'),
]

const base = { apolices, clientes, assessores, seguradoras }
const apurar = (op = {}) => apurarPremiacao(base, { ano: 2026, hoje: '2026-08-14', ...op })

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A janela do ano ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const j = janelaApuracao(2026)
  ok(j.inicio === '2026-01-01' && j.fim === '2026-11-30',
    `a janela padrão vai de 01/01 a 30/11 (${j.inicio} → ${j.fim})`)
  ok(MES_FECHAMENTO_PADRAO === 11, 'o mês de fechamento padrão é novembro')

  ok(janelaApuracao(2026, 12).fim === '2026-12-31', 'fechando em dezembro, a janela vai até 31/12')
  ok(janelaApuracao(2024, 2).fim === '2024-02-29', 'ano bissexto: fevereiro termina em 29')
  ok(janelaApuracao(2026, 2).fim === '2026-02-28', 'ano comum: fevereiro termina em 28')
  ok(janelaApuracao(2026, 99).fim === '2026-12-31', 'mês inválido não estoura a janela')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O que está fora do ano fica fora ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = apurar()
  const ana = r.linhas.find((l) => l.id === 'ana')

  ok(ana.apolices === 5, `dezembro e o ano passado não entram (Ana: ${ana.apolices} apólices)`)
  ok(ana.premioMensal === 1000, `nem no prêmio (R$ ${ana.premioMensal}/mês)`)
  ok(r.foraDaJanela === 2, `as duas apólices fora da janela foram contadas como fora (${r.foraDaJanela})`)

  // 30/11 é dia de apuração, não de véspera: a apólice do último dia conta.
  ok(ana.ultimaEmissao === '2026-11-30', 'a apólice emitida no último dia da janela entra')

  const emDezembro = apurar({ mesFechamento: 12 })
  ok(emDezembro.linhas.find((l) => l.id === 'ana').apolices === 6,
    'mudando o fechamento para dezembro, a apólice de dezembro passa a contar')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Apólice cancelada não premia (a menos que mandem) ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const padrao = apurar()
  const bruPadrao = padrao.linhas.find((l) => l.id === 'bru')
  ok(bruPadrao.apolices === 2, `por padrão a cancelada fica de fora (Bruno: ${bruPadrao.apolices})`)
  ok(padrao.canceladasIgnoradas === 1, 'e a tela sabe quantas ficaram de fora')

  const comCanceladas = apurar({ incluirCanceladas: true })
  const bruTudo = comCanceladas.linhas.find((l) => l.id === 'bru')
  ok(bruTudo.apolices === 3 && bruTudo.premioMensal === 1900,
    `com a opção ligada, ela conta (${bruTudo.apolices} apólices, R$ ${bruTudo.premioMensal})`)
  ok(comCanceladas.canceladasIgnoradas === 0, 'e nada mais é ignorado por status')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Os dois prêmios sabem ter donos diferentes ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = apurar()
  ok(r.liderQuantidade?.id === 'ana',
    `maior emissor é quem emitiu mais (${r.liderQuantidade?.nome}, ${r.liderQuantidade?.apolices})`)
  ok(r.liderPremio?.id === 'bru',
    `maior prêmio é quem somou mais dinheiro (${r.liderPremio?.nome}, R$ ${r.liderPremio?.premioMensal})`)
  ok(r.duploLider === false, 'com donos diferentes, não existe duplo líder')

  const ana = r.linhas.find((l) => l.id === 'ana')
  const bru = r.linhas.find((l) => l.id === 'bru')
  ok(ana.posQuantidade === 1 && ana.posPremio === 2, 'Ana: 1ª em quantidade, 2ª em prêmio')
  ok(bru.posQuantidade === 2 && bru.posPremio === 1, 'Bruno: 2º em quantidade, 1º em prêmio')

  // a distância que cabe numa mensagem de WhatsApp
  ok(bru.faltamApolices === 3, `faltam 3 apólices para o Bruno alcançar a Ana (${bru.faltamApolices})`)
  ok(ana.faltamPremioMensal === 500, `faltam R$ 500/mês para a Ana alcançar o Bruno (${ana.faltamPremioMensal})`)
  ok(ana.faltamPremioAnual === 6000, 'e a mesma distância anualizada são R$ 6.000')
  ok(r.liderQuantidade.faltamApolices === 0 && r.liderPremio.faltamPremioMensal === 0,
    'para quem lidera, não falta nada')

  const v = vantagemDoLider(r, 'quantidade')
  ok(v.lider.id === 'ana' && v.diferenca === 3 && v.empatados === 1,
    `a vantagem do líder em quantidade é 3 apólices sobre o 2º (${v.diferenca})`)
  const vp = vantagemDoLider(r, 'premio')
  ok(vp.lider.id === 'bru' && vp.diferenca === 500, `e R$ 500/mês no prêmio (${vp.diferenca})`)
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Empate no topo é empate, não sorteio ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const empate = {
    assessores,
    seguradoras,
    clientes: [
      { id: 'x1', nome: 'X1', id_assessor: 'ana' },
      { id: 'x2', nome: 'X2', id_assessor: 'bru' },
      { id: 'x3', nome: 'X3', id_assessor: 'caio' },
    ],
    apolices: [
      { id: 'p1', id_cliente: 'x1', id_seguradora: 's1', valor_premio_mensal: 300, data_vigencia: '2026-03-01', status: 'ativa' },
      { id: 'p2', id_cliente: 'x1', id_seguradora: 's1', valor_premio_mensal: 300, data_vigencia: '2026-04-01', status: 'ativa' },
      { id: 'p3', id_cliente: 'x2', id_seguradora: 's1', valor_premio_mensal: 300, data_vigencia: '2026-03-02', status: 'ativa' },
      { id: 'p4', id_cliente: 'x2', id_seguradora: 's1', valor_premio_mensal: 300, data_vigencia: '2026-04-02', status: 'ativa' },
      { id: 'p5', id_cliente: 'x3', id_seguradora: 's1', valor_premio_mensal: 100, data_vigencia: '2026-05-02', status: 'ativa' },
    ],
  }
  const r = apurarPremiacao(empate, { ano: 2026, hoje: '2026-08-14' })
  const pos = Object.fromEntries(r.linhas.map((l) => [l.id, l.posQuantidade]))
  ok(pos.ana === 1 && pos.bru === 1, 'os dois empatados dividem o 1º lugar')
  ok(pos.caio === 3, 'e o próximo é o 3º, não o 2º (ranking de competição)')
  ok(r.lideresQuantidade.length === 2, 'a tela recebe os DOIS líderes, para anunciar o empate')
  ok(r.duploLider === false, 'empate no topo não vira "duplo líder" por acidente')
  ok(vantagemDoLider(r, 'quantidade').diferenca === 1,
    'a vantagem é medida sobre o primeiro colocado com número MENOR, não sobre o empatado')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Apólice sem assessor não some e não premia ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = apurar()
  ok(r.semAssessor.apolices === 1 && r.semAssessor.premioMensal === 777,
    `a apólice do assessor de reserva volta separada (${r.semAssessor.apolices} · R$ ${r.semAssessor.premioMensal})`)
  ok(!r.linhas.some((l) => /sem assessor/i.test(l.nome)),
    'o "(sem assessor)" não aparece no ranking disputando prêmio')

  // cliente que não existe mais / apólice órfã: mesmo tratamento, nunca some
  const orfa = apurarPremiacao(
    { ...base, apolices: [...apolices, { id: 'zz', id_cliente: 'nao-existe', id_seguradora: 's1', valor_premio_mensal: 100, data_vigencia: '2026-05-05', status: 'ativa' }] },
    { ano: 2026, hoje: '2026-08-14' },
  )
  ok(orfa.semAssessor.apolices === 2, 'apólice de cliente inexistente também cai no balde do "sem assessor"')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A conta que a auditoria refaz na mão ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = apurar()
  const somaLinhas = r.linhas.reduce((s, l) => s + l.apolices, 0)
  const consideradas = apolices.length - r.foraDaJanela - r.canceladasIgnoradas
  ok(somaLinhas + r.semAssessor.apolices === consideradas,
    `ranking + sem assessor = tudo que entrou na janela (${somaLinhas} + ${r.semAssessor.apolices} = ${consideradas})`)
  ok(r.totais.apolices === somaLinhas, 'o total do escritório é a soma das linhas')
  ok(r.totais.premioAnual === r.totais.premioMensal * 12, 'o prêmio anual é o mensal × 12')

  for (const l of r.linhas) {
    ok(l.premioAnual === l.premioMensal * 12, `${l.nome}: prêmio anual = mensal × 12`)
    ok(Math.abs(l.ticketMedio * l.apolices - l.premioMensal) < 0.005, `${l.nome}: ticket médio × apólices = prêmio`)
  }

  const porMes = r.porMes.reduce((s, m) => s + m.apolices, 0)
  ok(porMes === r.totais.apolices, `a série mês a mês soma o total do ano (${porMes})`)
  ok(r.porMes.length === 11, 'a série tem 11 meses — a janela termina em novembro')
  ok(r.porMes[10].apolices === 1, 'a apólice de 30/11 aparece em novembro')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O prazo e o ritmo ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = apurar({ hoje: '2026-08-14' })
  ok(r.prazo.diasTotais === 334, `a janela tem 334 dias (${r.prazo.diasTotais})`)
  ok(r.prazo.diasRestantes === 108, `faltam 108 dias em 14/08 (${r.prazo.diasRestantes})`)
  ok(r.prazo.encerrada === false && r.prazo.mesCorrente === 8, 'a apuração está aberta, em agosto')

  const ana = r.linhas.find((l) => l.id === 'ana')
  ok(ana.projecaoApolices > ana.apolices, 'no ritmo atual a projeção é maior que o realizado')

  const depois = apurar({ hoje: '2026-12-20' })
  ok(depois.prazo.encerrada && depois.prazo.diasRestantes === 0, 'passado 30/11, a apuração está encerrada')
  ok(depois.linhas.every((l) => l.projecaoApolices === null),
    'apuração encerrada não projeta nada — o número final já é o número')

  const antes = apurarPremiacao(base, { ano: 2027, hoje: '2026-08-14' })
  ok(antes.prazo.naoComecou && antes.totais.apolices === 0,
    'um ano que ainda não começou aparece zerado, sem quebrar')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Lixo na entrada não vira lixo na tela ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const sujo = apurarPremiacao({
    assessores,
    seguradoras,
    clientes: [{ id: 'y1', nome: 'Y1', id_assessor: 'ana' }],
    apolices: [
      { id: 'q1', id_cliente: 'y1', id_seguradora: 's1', valor_premio_mensal: null, data_vigencia: '2026-03-01', status: 'ativa' },
      { id: 'q2', id_cliente: 'y1', id_seguradora: 's1', valor_premio_mensal: 'R$ 300', data_vigencia: '2026-03-02', status: 'ativa' },
      { id: 'q3', id_cliente: 'y1', id_seguradora: 's1', valor_premio_mensal: 250, data_vigencia: null, status: 'ativa' },
      { id: 'q4', id_cliente: 'y1', id_seguradora: 's1', valor_premio_mensal: 250, data_vigencia: '', status: 'ativa' },
    ],
  }, { ano: 2026, hoje: '2026-08-14' })
  const ana = sujo.linhas.find((l) => l.id === 'ana')
  ok(ana.apolices === 2, 'apólice sem data não entra (não dá para saber o ano dela)')
  ok(Number.isFinite(ana.premioMensal) && ana.premioMensal === 0,
    `prêmio nulo ou não numérico vira zero, nunca NaN (R$ ${ana.premioMensal})`)
  ok(Number.isFinite(ana.ticketMedio), 'o ticket médio continua um número')

  const vazio = apurarPremiacao({}, { ano: 2026, hoje: '2026-08-14' })
  ok(vazio.linhas.length === 0 && vazio.liderQuantidade === null && vazio.liderPremio === null,
    'escritório sem nenhuma apólice: ranking vazio, sem líder e sem erro')
  ok(vantagemDoLider(vazio, 'quantidade') === null, 'e sem vantagem para anunciar')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O seletor de anos ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const anos = anosComEmissao(apolices, '2026-08-14')
  ok(anos[0] === 2026 && anos.includes(2025), `os anos vêm do mais novo para o mais velho (${anos.join(', ')})`)
  ok(anosComEmissao([], '2026-08-14').length === 1,
    'sem apólice nenhuma, o ano corrente ainda aparece no seletor')
}

console.log('\n── RESULTADO (GB Awards) ──')
console.log(`${feitos} verificações · ${falhas ? `${falhas} FALHA(S)` : 'nenhuma falha 🎉'}`)
process.exit(falhas ? 1 : 0)
