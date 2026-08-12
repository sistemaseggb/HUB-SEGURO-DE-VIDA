// ─────────────────────────────────────────────────────────────────────────────
// O COMPARADOR CONTRA CONTAS FEITAS À MÃO.
//
// Este é o teste mais importante do arquivo mais delicado do sistema: os
// números daqui vão para um gráfico que a consultora apresenta contra o
// assessor de investimentos do cliente. Um erro de tributação ou de
// interpolação não aparece como tela quebrada — aparece como uma afirmação
// falsa numa reunião.
//
// Por isso cada caso tem o RESULTADO ESPERADO CALCULADO À MÃO, escolhido para
// dar conta redonda (taxa zero, aportes exatos), e não uma expectativa colhida
// da própria implementação — teste que copia o código não prova nada.
//
// Roda com `node scripts/teste-comparador.mjs` (e junto do resto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import {
  compararSeguroComInvestimento, lerTabelaColada, normalizarResgates,
  resgateNoAno, aliquotaRegressiva, conferirComparador, DIMENSOES_COMPARACAO,
} from '../src/lib/comparador.js'

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}
const perto = (a, b, tol = 0.5) => Math.abs(a - b) <= tol

// ── 1. A TABELA COLADA DA COTAÇÃO ───────────────────────────────────────────
console.log('\n── Lendo a tabela como ela vem da cotação ──')
{
  const t = lerTabelaColada(`
Ano 5   R$ 12.500,00
10  41.200
15;78.900
20 — 124.000
30	215.000
`)
  ok(t.length === 5, 'cinco linhas em cinco pares', t.length)
  ok(t[0].ano === 5 && t[0].resgate === 12500, 'ano 5 = 12.500 (com R$ e milhar)', JSON.stringify(t[0]))
  ok(t[2].ano === 15 && t[2].resgate === 78900, 'ponto-e-vírgula também serve', JSON.stringify(t[2]))
  ok(t[3].resgate === 124000, 'travessão entre ano e valor', t[3].resgate)
  ok(t[4].resgate === 215000, 'tabulação colada do Excel', t[4].resgate)
}
{
  // cotações trazem colunas extras; o resgate nunca é o menor número da linha
  const t = lerTabelaColada('10   22.680   41.200')
  ok(t.length === 1 && t[0].resgate === 41200,
    'linha com prêmio pago e resgate: fica o maior', JSON.stringify(t))
}
{
  const t = lerTabelaColada('cabeçalho sem números\nAno  Resgate\n5  12.500')
  ok(t.length === 1 && t[0].ano === 5, 'cabeçalho da planilha é ignorado', JSON.stringify(t))
}
{
  const t = normalizarResgates([{ ano: 10, resgate: 5000 }, { ano: 5, resgate: 1000 }, { ano: 10, resgate: 6000 }])
  ok(t.length === 2 && t[0].ano === 5, 'ordena por ano', JSON.stringify(t))
  ok(t[1].resgate === 6000, 'ano repetido fica com o último valor digitado', t[1].resgate)
}

console.log('\n── Interpolação, carência e o depois do último ponto ──')
{
  const t = [{ ano: 5, resgate: 10000 }, { ano: 10, resgate: 20000 }]
  ok(resgateNoAno(t, 3) === 0, 'antes do primeiro ponto não há resgate (carência)', resgateNoAno(t, 3))
  ok(resgateNoAno(t, 5) === 10000, 'no ponto informado vale o ponto', resgateNoAno(t, 5))
  ok(resgateNoAno(t, 7) === 14000, 'ano 7 entre 5 e 10 = 14.000', resgateNoAno(t, 7))
  ok(resgateNoAno(t, 10) === 20000, 'no último ponto', resgateNoAno(t, 10))
  ok(resgateNoAno(t, 25) === 20000, 'depois do último ponto fica estável', resgateNoAno(t, 25))
  ok(resgateNoAno([], 10) === 0, 'sem tabela, resgate zero', resgateNoAno([], 10))
}

// ── 2. A TABELA REGRESSIVA DE IR ────────────────────────────────────────────
console.log('\n── A alíquota certa em cada faixa ──')
for (const [anos, esperado] of [
  [1, 0.35], [2, 0.35], [3, 0.30], [4, 0.30], [5, 0.25], [6, 0.25],
  [7, 0.20], [8, 0.20], [9, 0.15], [10, 0.15], [11, 0.10], [30, 0.10],
]) {
  const saiu = aliquotaRegressiva(anos)
  ok(saiu === esperado, `${anos} ano(s) → ${esperado * 100}%`, `${saiu * 100}%`)
}

// ── 3. A CONTA, COM TAXA ZERO PARA DAR NÚMERO REDONDO ───────────────────────
console.log('\n── VGBL: o IR morde só o rendimento ──')
{
  // taxa 0% → não há rendimento → não há IR. Aporte 1.000/mês por 5 anos = 60.000.
  const c = compararSeguroComInvestimento({
    capital: 60_000, premioMensal: 1000, taxaReal: 0, alternativa: 'vgbl', anos: 10,
  })
  const a5 = c.serie[4]
  ok(a5.aportado === 60_000, 'ano 5: aportou 60.000', a5.aportado)
  ok(perto(a5.investidoBruto, 60_000), 'ano 5: sem juros, o bruto é o aportado', a5.investidoBruto)
  ok(perto(a5.ir, 0), 'ano 5: sem rendimento, IR zero no VGBL', a5.ir)
  ok(perto(a5.investidoLiquido, 60_000), 'ano 5: líquido = 60.000', a5.investidoLiquido)
  ok(c.anoDoCruzamento === 5, 'cruza o capital de 60.000 exatamente no ano 5', c.anoDoCruzamento)
  ok(perto(c.serie[0].descoberto, 48_000), 'ano 1: faltam 48.000 para a família', c.serie[0].descoberto)
  ok(perto(a5.descoberto, 0), 'ano 5: buraco fechado', a5.descoberto)
}

console.log('\n── PGBL: o IR morde tudo, e a dedução volta ──')
{
  // taxa 0%, aporte 1.000/mês = 12.000/ano. Renda 100.000/mês → teto de dedução
  // 144.000/ano, bem acima do aporte, então deduz o aporte inteiro.
  // Ano 1: saldo 12.000 · IR 35% sobre TUDO = 4.200 · dedução 12.000 × 27,5% = 3.300
  //        líquido = 12.000 − 4.200 + 3.300 = 11.100
  const c = compararSeguroComInvestimento({
    capital: 500_000, premioMensal: 1000, taxaReal: 0, alternativa: 'pgbl',
    aliquotaIR: 0.275, rendaMensal: 100_000, anos: 10,
  })
  const a1 = c.serie[0]
  ok(perto(a1.ir, 4200), 'ano 1: IR de 35% sobre o total = 4.200', a1.ir)
  ok(perto(c.premissas.deducaoAnual, 3300), 'dedução anual = 12.000 × 27,5% = 3.300', c.premissas.deducaoAnual)
  ok(perto(a1.deducaoAcumulada, 3300), 'ano 1: dedução acumulada = 3.300', a1.deducaoAcumulada)
  ok(perto(a1.investidoLiquido, 11_100), 'ano 1: líquido = 11.100', a1.investidoLiquido)

  // o mesmo caso sem informar a alíquota: a dedução não pode aparecer do nada
  const semIR = compararSeguroComInvestimento({
    capital: 500_000, premioMensal: 1000, taxaReal: 0, alternativa: 'pgbl',
    aliquotaIR: 0, rendaMensal: 100_000, anos: 10,
  })
  ok(semIR.serie[0].deducaoAcumulada === 0, 'sem alíquota informada, nenhuma dedução é creditada',
    semIR.serie[0].deducaoAcumulada)
  ok(semIR.serie[0].investidoLiquido < c.serie[0].investidoLiquido,
    'creditar a dedução melhora o lado do PGBL — como tem que ser')
}

console.log('\n── O teto de 12% da renda tributável ──')
{
  // renda 5.000/mês → teto 7.200/ano. Aporte 12.000/ano passa do teto:
  // deduz só 7.200 × 27,5% = 1.980, não 12.000 × 27,5%.
  const c = compararSeguroComInvestimento({
    capital: 500_000, premioMensal: 1000, taxaReal: 0, alternativa: 'pgbl',
    aliquotaIR: 0.275, rendaMensal: 5000, anos: 5,
  })
  ok(perto(c.premissas.tetoDeducaoAnual, 7200), 'teto = 5.000 × 12 × 12% = 7.200', c.premissas.tetoDeducaoAnual)
  ok(perto(c.premissas.deducaoAnual, 1980), 'deduz só até o teto: 1.980', c.premissas.deducaoAnual)
}

console.log('\n── PGBL tributa mais que VGBL, com tudo igual ──')
{
  const comum = { capital: 500_000, premioMensal: 1000, taxaReal: 0.04, anos: 20, aliquotaIR: 0, rendaMensal: 20_000 }
  const vgbl = compararSeguroComInvestimento({ ...comum, alternativa: 'vgbl' })
  const pgbl = compararSeguroComInvestimento({ ...comum, alternativa: 'pgbl' })
  ok(pgbl.serie[19].ir > vgbl.serie[19].ir, 'no ano 20 o PGBL paga mais imposto',
    `${Math.round(pgbl.serie[19].ir)} vs ${Math.round(vgbl.serie[19].ir)}`)
  ok(pgbl.investidoNoFim < vgbl.investidoNoFim,
    'sem a dedução creditada, o PGBL entrega menos — é o efeito real da tributação')
}

// ── 4. O CUSTO DA PROTEÇÃO ──────────────────────────────────────────────────
console.log('\n── O custo real de ter carregado a cobertura ──')
{
  // taxa 0%: em 10 anos aporta 120.000. Resgate no ano 10 = 40.000.
  // custo da proteção = 120.000 − 40.000 = 80.000 → 8.000/ano
  // sobre 1.000.000 de capital → R$ 8,00 por mil por ano
  const c = compararSeguroComInvestimento({
    capital: 1_000_000, premioMensal: 1000, taxaReal: 0, alternativa: 'vgbl', anos: 10,
    resgates: [{ ano: 5, resgate: 15_000 }, { ano: 10, resgate: 40_000 }],
  })
  ok(perto(c.custoRealDaProtecao, 80_000), 'custo da proteção em 10 anos = 80.000', c.custoRealDaProtecao)
  ok(perto(c.custoPorMilPorAno, 8), 'custo por mil por ano = R$ 8,00', c.custoPorMilPorAno)
  ok(c.alavancagemInicial === 1000, 'cada R$ 1 de prêmio protege R$ 1.000', c.alavancagemInicial)
  ok(c.investimentoGanhaNoFim === true,
    'e o sistema ADMITE que o investimento acumulou mais — é o que sustenta o resto')
}

// ── 5. INVARIANTES ──────────────────────────────────────────────────────────
console.log('\n── O que precisa valer sempre ──')
{
  const c = compararSeguroComInvestimento({
    capital: 2_000_000, premioMensal: 1500, taxaReal: 0.05, alternativa: 'pgbl',
    aliquotaIR: 0.275, rendaMensal: 30_000, anos: 30,
    resgates: [{ ano: 3, resgate: 8000 }, { ano: 10, resgate: 60_000 }, { ano: 25, resgate: 240_000 }],
  })
  ok(c.serie.length === 30, 'um ponto por ano do horizonte', c.serie.length)
  ok(c.serie.every((p) => p.seguroMorte === 2_000_000), 'o capital é o mesmo desde o ano 1')
  ok(c.serie.every((p) => p.descoberto >= 0), 'o descoberto nunca é negativo')
  ok(c.serie.every((p, k) => k === 0 || p.investidoBruto > c.serie[k - 1].investidoBruto),
    'o investido bruto só sobe')
  ok(c.serie.every((p, k) => k === 0 || p.seguroResgate >= c.serie[k - 1].seguroResgate),
    'o resgate nunca diminui')
  ok(c.serie.every((p) => Number.isFinite(p.investidoLiquido) && Number.isFinite(p.descoberto)),
    'nenhum número da série é NaN ou Infinity')
  const antesDoCruzamento = c.anoDoCruzamento == null ? c.serie : c.serie.slice(0, c.anoDoCruzamento - 1)
  ok(antesDoCruzamento.every((p) => p.descoberto > 0),
    'antes do cruzamento existe buraco em todos os anos')
}

console.log('\n── Entradas que não podem quebrar ──')
for (const [rotulo, entrada] of [
  ['sem nada', {}],
  ['sem capital', { premioMensal: 1000 }],
  ['sem prêmio', { capital: 100000 }],
  ['capital negativo', { capital: -5000, premioMensal: 1000 }],
  ['prêmio texto', { capital: 100000, premioMensal: 'abc' }],
  ['taxa absurda', { capital: 100000, premioMensal: 1000, taxaReal: 500 }],
  ['taxa negativa forte', { capital: 100000, premioMensal: 1000, taxaReal: -9 }],
  ['anos zero', { capital: 100000, premioMensal: 1000, anos: 0 }],
  ['anos absurdos', { capital: 100000, premioMensal: 1000, anos: 5000 }],
  ['resgates lixo', { capital: 100000, premioMensal: 1000, resgates: 'x' }],
  ['resgates com null', { capital: 100000, premioMensal: 1000, resgates: [null, { ano: 'a', resgate: 'b' }] }],
  ['alternativa inventada', { capital: 100000, premioMensal: 1000, alternativa: 'cripto' }],
]) {
  let c, erro = null
  try { c = compararSeguroComInvestimento(entrada) } catch (e) { erro = e.message }
  ok(erro === null, `${rotulo}: não explode`, erro)
  if (c) {
    const numeros = c.serie.flatMap((p) => Object.values(p)).filter((v) => typeof v === 'number')
    ok(numeros.every(Number.isFinite), `${rotulo}: nenhum número inválido na série`)
    ok(c.serie.length >= 1 && c.serie.length <= 40, `${rotulo}: horizonte dentro do limite`, c.serie.length)
  }
}

// ── 6. AS CONFERÊNCIAS ──────────────────────────────────────────────────────
console.log('\n── Os avisos que impedem a apresentação errada ──')
{
  const base = { capital_sugerido: 1_000_000, premio_estimado: 1000 }
  const comp = compararSeguroComInvestimento({ capital: 1_000_000, premioMensal: 1000 })

  const decrescente = conferirComparador(
    { ...base, seguro_resgatavel: [{ ano: 5, resgate: 30_000 }, { ano: 10, resgate: 20_000 }] }, comp)
  ok(decrescente.some((a) => a.grave && /não diminui/.test(a.texto)),
    'resgate que diminui de um ano para o outro é avisado como grave',
    JSON.stringify(decrescente.map((a) => a.texto)))

  const acima = conferirComparador(
    { ...base, seguro_resgatavel: [{ ano: 10, resgate: 5_000_000 }] }, comp)
  ok(acima.some((a) => a.grave && /passou do capital/.test(a.texto)),
    'resgate maior que o capital é avisado como grave')

  const semTabela = conferirComparador({ ...base, seguro_resgatavel: [] }, comp)
  ok(semTabela.some((a) => /Cole os pares/.test(a.texto)), 'sem tabela, o sistema pede a tabela')

  const semPremio = conferirComparador({ capital_sugerido: 1_000_000, premio_estimado: 0 }, comp)
  ok(semPremio.some((a) => a.grave && /prêmio mensal/.test(a.texto)), 'sem prêmio, avisa que não há o que comparar')

  const pgblSemIR = compararSeguroComInvestimento({
    capital: 1_000_000, premioMensal: 1000, alternativa: 'pgbl', aliquotaIR: 0,
  })
  const avisoPgbl = conferirComparador({ ...base, seguro_resgatavel: [{ ano: 5, resgate: 1 }, { ano: 10, resgate: 2 }] }, pgblSemIR)
  ok(avisoPgbl.some((a) => /injusta com o PGBL/.test(a.texto)),
    'PGBL sem alíquota: o sistema avisa que a comparação está injusta com o concorrente')

  const limpo = conferirComparador(
    { ...base, seguro_resgatavel: [{ ano: 5, resgate: 12_000 }, { ano: 10, resgate: 40_000 }] }, comp)
  ok(limpo.length === 0, 'tabela correta não gera aviso nenhum', JSON.stringify(limpo.map((a) => a.texto)))
}

// ── 7. O QUADRO DAS DIMENSÕES ───────────────────────────────────────────────
console.log('\n── O quadro que responde "o quê", não "quanto" ──')
{
  ok(DIMENSOES_COMPARACAO.length >= 8, 'pelo menos oito dimensões', DIMENSOES_COMPARACAO.length)
  ok(DIMENSOES_COMPARACAO.every((d) => d.pergunta && d.seguro && d.vgbl && d.pgbl && d.nota),
    'toda dimensão tem pergunta, os três lados e a nota')
  ok(DIMENSOES_COMPARACAO.some((d) => d.vencedor === 'investimento'),
    'o quadro admite pelo menos uma dimensão em que o investimento ganha')
  ok(DIMENSOES_COMPARACAO.some((d) => d.vencedor === 'pgbl'),
    'o quadro credita a dedução do PGBL')
  ok(DIMENSOES_COMPARACAO.some((d) => /7\.713/.test(d.nota)) && DIMENSOES_COMPARACAO.some((d) => /794/.test(d.nota)),
    'as afirmações jurídicas trazem a referência')
}

console.log('\n── RESULTADO (comparador) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
