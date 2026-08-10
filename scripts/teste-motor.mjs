// ─────────────────────────────────────────────────────────────────────────────
// O motor do estudo sob fogo cruzado.
//
// calcularEstudo() é a única fonte dos números do planejamento E da proposta:
// se ele erra, a consultora apresenta o erro para o cliente. Este teste joga
// milhares de combinações de entrada — inclusive as que ninguém deveria
// digitar (negativo, texto, vazio, 10^18) — e cobra invariantes que precisam
// valer SEMPRE, não só no caminho feliz:
//
//   · nenhum número exibível pode ser NaN, Infinity ou negativo;
//   · o patrimônio bruto é a soma das classes mais a previdência;
//   · o que trava no inventário nunca passa do patrimônio bruto;
//   · o custo do inventário nunca passa do que trava;
//   · o maior evento indenizável nunca passa da soma das importâncias;
//   · a completude fica entre 0 e o total, e as porcentagens entre 0 e 100.
//
// Roda com `npm run test:motor` (e junto do e2e em `npm run test`).
// ─────────────────────────────────────────────────────────────────────────────
import { calcularEstudo, CLASSES_PATRIMONIO, porqueCobertura } from '../src/lib/estudo.js'
import { compararSeguroComInvestimento, normalizarResgates } from '../src/lib/comparador.js'
import { analisarTranscricao } from '../src/lib/transcricao.js'

const CASOS = Number(process.env.CASOS ?? 4000)
const problemas = []
const registrar = (caso, msg) => {
  if (problemas.length < 40) problemas.push({ caso, msg })
}

// Um gerador previsível: a mesma semente dá a mesma bateria de casos, então
// uma falha é sempre reproduzível (CASOS=… SEMENTE=… node scripts/teste-motor.mjs).
let semente = Number(process.env.SEMENTE ?? 20260807)
const rnd = () => {
  semente = (semente * 1103515245 + 12345) % 2147483648
  return semente / 2147483648
}
const escolher = (lista) => lista[Math.floor(rnd() * lista.length)]

// Valores hostis de propósito: é o que aparece quando alguém cola de uma
// planilha, digita com o teclado do celular ou deixa o campo pela metade.
const VALORES = [
  '', null, undefined, 0, -1, -5000, 'abc', '1,5', '  ', true, false, NaN, Infinity,
  1, 999, 12000, 250000, 3_500_000, 1e12, 1e18, '48000', '0,01', 0.004,
]
const PCTS = ['', null, 0, -3, 4, 6, 8, 100, 150, 'abc', 12.5]
const TEXTOS = ['', null, 'Médico', 'x'.repeat(500)]

function planoAleatorio() {
  const v = () => escolher(VALORES)
  const plano = {
    profissao: escolher(TEXTOS), estado_civil: escolher(TEXTOS), conjuge_nome: escolher(TEXTOS),
    renda_mensal: v(), custo_vida_mensal: v(), patrimonio_total: v(), dividas_total: v(),
    capital_sugerido: v(), anos_protecao: escolher(['', null, 0, -5, 1, 10, 40, 200, 'abc']),
    num_dependentes: escolher(['', null, 0, 3, -2, 'x']),
    cobertura_atual: v(), itcmd_pct: escolher(PCTS), custas_pct: escolher(PCTS),
    capital_invalidez: v(), capital_doencas_graves: v(), dit_diaria: v(), verba_sucessoria: v(),
    premio_estimado: v(), premio_anual: v(),
    forma_pagamento: escolher(['mensal', 'anual', '', null, 'x']),
    tipo_planejamento: escolher(['pf', 'pj', 'pf_pj', '', null, 'x']),
    focos: escolher([[], null, ['renda'], ['sucessao', 'empresa'], 'x', [null, 'renda']]),
    previdencia_saldo: v(), previdencia_tipo: escolher(['VGBL', 'PGBL', '', null]),
    previdencia_aporte_mensal: v(),
    pj_valuation: v(), pj_participacao_pct: escolher(PCTS), pj_num_socios: escolher(['', 0, 1, 4, -1]),
    pj_faturamento_anual: v(), pj_lucro_anual: v(), pj_divida_avalizada: v(),
    capital_socios: v(), capital_homem_chave: v(), capital_aval: v(),
    capital_morte_acidental: v(), capital_fraturas: v(),
    dih_diaria: v(), dih_dias: escolher(['', 0, 30, 365, 5000, -4]),
    dit_dias: escolher(['', 0, 30, 720, 9999, -4]), dit_franquia_dias: escolher(['', 0, 15, 400, -2]),
    funeral_individual: v(), funeral_familiar: v(),
  }
  plano.regime_bens = escolher(['', null, 'Comunhão parcial', 'Comunhão universal',
    'Separação total', 'Separação obrigatória', 'Participação final nos aquestos', 'inventado'])
  plano.tem_holding = escolher([true, false, null, 'x'])
  plano.tem_testamento = escolher([true, false, null])
  plano.herdeiros_menores = escolher([true, false, null])
  plano.previdencia_tipo = escolher(['VGBL', 'PGBL', 'Ambos', '', null, 'x'])
  plano.fumante = escolher([true, false, null, 'sim'])
  plano.idade_aposentadoria = escolher(['', null, 55, 65, 90, 200, -3, 'abc'])
  // tabelas de resgate como elas chegam de verdade — e como chegam erradas
  plano.seguro_resgatavel = escolher([
    [], null, 'x',
    [{ ano: 5, resgate: 12_000 }, { ano: 10, resgate: 40_000 }],
    [{ ano: 10, resgate: 40_000 }, { ano: 5, resgate: 12_000 }],   // fora de ordem
    [{ ano: 5, resgate: 40_000 }, { ano: 10, resgate: 12_000 }],   // decrescente
    [{ ano: 0, resgate: 1000 }, { ano: -3, resgate: 500 }],        // ano inválido
    [{ ano: 5, resgate: 1e15 }],                                    // acima do capital
    [{ ano: 'x', resgate: 'y' }, null, undefined],
    [{ ano: 3, resgate: 900 }],                                     // um ponto só
  ])
  plano.comparador_alternativa = escolher(['vgbl', 'pgbl', '', null, 'cripto'])
  plano.comparador_taxa_real = escolher(['', null, 4, 0, -3, 40, 'abc'])
  plano.aliquota_ir_cliente = escolher(['', null, 27.5, 0, -5, 200, 'x'])
  for (const c of CLASSES_PATRIMONIO) plano[c.campo] = v()
  // filhos: da lista vazia à lista com lixo dentro
  plano.dependentes = escolher([
    [], null, 'x',
    [{ nome: 'Alice', idade: 6, custo_mensal: 3200 }],
    [{ nome: '', idade: '', custo_mensal: '' }, { nome: 'Lucas', idade: -3, custo_mensal: -50 }],
    [{ nome: 'A', idade: 200, custo_mensal: 1e15 }, { nome: 'B', idade: 'abc', custo_mensal: 'x' }],
    Array.from({ length: 12 }, (_, i) => ({ nome: `F${i}`, idade: i * 3, custo_mensal: 500 })),
  ])
  return plano
}

// Percorre o resultado inteiro procurando número impossível de exibir.
function numerosImpossiveis(no, caminho = '') {
  const achados = []
  const visitar = (v, c) => {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) achados.push(`${c} = ${v}`)
      // Alguns números negativos são a informação: patrimônio líquido negativo
      // é dívida maior que o bem, e poupança mensal negativa é família gastando
      // mais do que ganha — a tela mostra os dois em vermelho, de propósito.
      else if (v < 0 && !/(^|\.)(patrimonioLiquido|poupancaMensal|taxaReal|economia|gap|saldo|diferenca)/i.test(c)) {
        achados.push(`${c} = ${v} (negativo)`)
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => visitar(x, `${c}[${i}]`))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visitar(x, c ? `${c}.${k}` : k)
  }
  visitar(no, caminho)
  return achados
}

console.log(`Motor do estudo: ${CASOS} combinações (semente ${process.env.SEMENTE ?? 20260807})`)
for (let i = 0; i < CASOS; i++) {
  const plano = planoAleatorio()
  const nascimento = escolher([
    null, '', '1985-03-18', '1960-12-01', '2005-07-09', '1948-01-31',
    '9999-99-99', 'não é data', '2030-01-01',
  ])
  let e
  try {
    e = calcularEstudo(plano, { dataNascimento: nascimento })
  } catch (err) {
    registrar(i, `explodiu: ${err.message}`)
    continue
  }

  for (const p of numerosImpossiveis(e)) registrar(i, p)

  const somaClasses = e.classes.reduce((s, c) => s + c.valor, 0)
  const eps = 0.01
  if (e.patrimonioBruto > 0 && Math.abs(e.patrimonioBruto - (somaClasses + (e.detalhado ? 0 : 0))) > eps
    && e.detalhado) {
    registrar(i, `patrimonioBruto ${e.patrimonioBruto} ≠ soma das classes ${somaClasses}`)
  }
  if (e.bensInventariaveis > e.patrimonioBruto + eps) {
    registrar(i, `bensInventariaveis ${e.bensInventariaveis} > patrimonioBruto ${e.patrimonioBruto}`)
  }
  if (e.custoInventario > e.bensInventariaveis + eps) {
    registrar(i, `custoInventario ${e.custoInventario} > bensInventariaveis ${e.bensInventariaveis}`)
  }
  if (e.capitalMaximoEvento > e.capitalTotal + eps) {
    registrar(i, `capitalMaximoEvento ${e.capitalMaximoEvento} > capitalTotal ${e.capitalTotal}`)
  }
  if (Math.abs(e.capitalPF + e.capitalPJ - e.capitalTotal) > eps) {
    registrar(i, `capitalPF+capitalPJ ${e.capitalPF + e.capitalPJ} ≠ capitalTotal ${e.capitalTotal}`)
  }
  if (e.completude.feitos < 0 || e.completude.feitos > e.completude.total) {
    registrar(i, `completude ${e.completude.feitos}/${e.completude.total} fora da faixa`)
  }
  if (e.pctIliquido != null && (e.pctIliquido < 0 || e.pctIliquido > 100)) {
    registrar(i, `pctIliquido ${e.pctIliquido} fora de 0..100`)
  }
  if (e.itcmd < 0 || e.itcmd > 100 || e.custas < 0 || e.custas > 100) {
    registrar(i, `alíquotas fora de 0..100: itcmd ${e.itcmd} custas ${e.custas}`)
  }
  if (e.investimento) {
    const inv = e.investimento
    if (inv.mensal <= 0 && inv.anual <= 0) registrar(i, 'investimento existe mas mensal e anual são 0')
    if (inv.descontoPct != null && (inv.descontoPct <= 0 || inv.descontoPct > 100)) {
      registrar(i, `descontoPct ${inv.descontoPct} fora de 0..100`)
    }
    if (inv.economiaAnual > 0 && !inv.temDescontoAnual) registrar(i, 'economia sem temDescontoAnual')
  }
  for (const c of e.ativas) {
    if (!(c.valor > 0)) registrar(i, `cobertura ativa ${c.id} com valor ${c.valor}`)
    // O porquê é texto que vai para a tela e para o slide: nunca pode sair
    // com NaN, undefined ou "R$ 0" — seria pior do que não ter porquê nenhum.
    let pq
    try {
      pq = porqueCobertura(c.id, e)
    } catch (err) {
      registrar(i, `porquê de ${c.id} explodiu: ${err.message}`)
      continue
    }
    if (pq != null) {
      if (typeof pq !== 'string' || pq.trim() === '') registrar(i, `porquê de ${c.id} vazio`)
      else if (/NaN|Infinity|undefined|null/.test(pq)) registrar(i, `porquê de ${c.id}: ${pq.slice(0, 80)}`)
      else if (/R\$ -/.test(pq)) registrar(i, `porquê de ${c.id} com valor negativo: ${pq.slice(0, 80)}`)
    }
  }
  // ── idade, sucessão e previdência ──
  if (e.idade != null && (e.idade < 0 || e.idade > 120)) {
    registrar(i, `idade ${e.idade} fora de 0..120`)
  }
  if (e.sucessao.baseInventario > e.bensInventariaveis + eps) {
    registrar(i, `base do inventário ${e.sucessao.baseInventario} > bens ${e.bensInventariaveis}`)
  }
  if (e.sucessao.meacao > 0 && e.sucessao.meacaoPotencial > 0) {
    registrar(i, 'meação certa e potencial ao mesmo tempo — são excludentes')
  }
  if (e.sucessao.custasEfetivas > e.custas + eps) {
    registrar(i, `custas efetivas ${e.sucessao.custasEfetivas} > custas informadas ${e.custas}`)
  }
  if (![6, 18].includes(e.sucessao.prazoInventarioMeses)) {
    registrar(i, `prazo de inventário ${e.sucessao.prazoInventarioMeses} fora do esperado`)
  }
  if (e.previdenciaLiquida > e.previdencia + eps) {
    registrar(i, `previdência líquida ${e.previdenciaLiquida} > bruta ${e.previdencia}`)
  }
  if (e.previdencia > 0 && e.previdenciaLiquida < e.previdencia * 0.85) {
    registrar(i, `IR da previdência mordeu demais: ${e.previdenciaLiquida} de ${e.previdencia}`)
  }
  if (e.janelaProtecao && (e.janelaProtecao.anos < 1 || e.janelaProtecao.anos > 60)) {
    registrar(i, `janela de proteção ${e.janelaProtecao.anos} fora de 1..60`)
  }
  if (e.custoDaEspera) {
    if (e.custoDaEspera.estimativa !== true) registrar(i, 'custo da espera sem a marca de estimativa')
    let anterior = e.custoDaEspera.mensalHoje
    for (const c of e.custoDaEspera.cenarios) {
      // esperar nunca pode sair mais barato, e a curva tem que ser monótona
      if (c.mensal < anterior - eps) {
        registrar(i, `custo da espera não é monótono: ${anterior} → ${c.mensal}`)
      }
      if (c.idadeNaEpoca > 80) registrar(i, `cenário de espera aos ${c.idadeNaEpoca} anos`)
      anterior = c.mensal
    }
  }
  // ── o comparador, com o que o estudo produziu ──
  let comp
  try {
    comp = compararSeguroComInvestimento({
      capital: e.valores.morte,
      premioMensal: e.investimento?.mensal ?? 0,
      resgates: plano.seguro_resgatavel,
      alternativa: plano.comparador_alternativa,
      taxaReal: plano.comparador_taxa_real === '' || plano.comparador_taxa_real == null
        ? undefined : Number(plano.comparador_taxa_real) / 100,
      aliquotaIR: Number(plano.aliquota_ir_cliente) / 100,
      rendaMensal: e.renda,
      anos: e.anos,
    })
  } catch (err) {
    registrar(i, `comparador explodiu: ${err.message}`)
  }
  if (comp) {
    for (const p of numerosImpossiveis(comp, 'comp')) registrar(i, p)
    if (comp.serie.length < 1 || comp.serie.length > 40) {
      registrar(i, `série do comparador com ${comp.serie.length} pontos`)
    }
    for (const ponto of comp.serie) {
      if (ponto.descoberto < 0) registrar(i, `descoberto negativo no ano ${ponto.ano}`)
      if (ponto.seguroMorte !== comp.premissas.capital) {
        registrar(i, `o capital mudou no ano ${ponto.ano}`)
      }
      if (ponto.aliquota < 0.1 || ponto.aliquota > 0.35) {
        registrar(i, `alíquota ${ponto.aliquota} fora da tabela regressiva`)
      }
    }
    // O resgate da série reflete a tabela colada. Só cobramos monotonia quando
    // a tabela é monótona: se ela digitou um valor caindo, o gráfico mostra o
    // que ela digitou e o aviso grave manda corrigir — "consertar" por dentro
    // esconderia o erro de digitação atrás de uma curva plausível.
    const tab = normalizarResgates(plano.seguro_resgatavel)
    const tabelaSobe = tab.every((p, k) => k === 0 || p.resgate >= tab[k - 1].resgate)
    for (let k = 1; k < comp.serie.length; k++) {
      if (tabelaSobe && comp.serie[k].seguroResgate < comp.serie[k - 1].seguroResgate - 0.01) {
        registrar(i, `resgate caiu do ano ${k} para o ${k + 1}`)
      }
      if (comp.serie[k].investidoBruto < comp.serie[k - 1].investidoBruto - 0.01
        && comp.premissas.taxaReal >= 0) {
        registrar(i, `investido bruto caiu do ano ${k} para o ${k + 1}`)
      }
    }
    if (comp.anoDoCruzamento != null
      && (comp.anoDoCruzamento < 1 || comp.anoDoCruzamento > comp.serie.length)) {
      registrar(i, `ano do cruzamento ${comp.anoDoCruzamento} fora da série`)
    }
  }

  for (const inc of e.inconsistencias) {
    if (typeof inc.texto !== 'string' || inc.texto.trim() === '') registrar(i, 'inconsistência sem texto')
    if (inc.corrigir != null && !Number.isFinite(inc.valor)) {
      registrar(i, `inconsistência "${inc.corrigir}" oferece corrigir para ${inc.valor}`)
    }
  }
}

// ── Transcrição: o texto colado pela consultora nunca pode derrubar a aba ──
const PEDACOS = [
  '00:00:12 Natália: Qual é a sua renda hoje?',
  '00:00:20 Carlos: Uns 48 mil por mês, e o custo de vida é 27 mil.',
  'Carlos: Tenho 2 filhos, Alice de 6 e Lucas de 9.',
  'WEBVTT', '00:00:01.000 --> 00:00:04.000', 'texto solto sem estrutura nenhuma',
  'A empresa fatura 2,3 milhões por ano.', 'Acho caro, preciso pensar.',
  'Vou te mandar os documentos até sexta.', '', '   ', '💥🙂', 'R$ ', '12', 'mil',
  'x'.repeat(3000),
]
console.log(`Transcrição: ${Math.floor(CASOS / 2)} textos montados ao acaso`)
for (let i = 0; i < Math.floor(CASOS / 2); i++) {
  const linhas = Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => escolher(PEDACOS))
  const texto = linhas.join(escolher(['\n', '\n\n', '\r\n']))
  try {
    const a = analisarTranscricao(texto)
    // texto sem nenhuma fala legível devolve null de propósito — a aba mostra
    // o estado vazio em vez de uma análise inventada
    if (a === null) continue
    for (const p of numerosImpossiveis(a)) registrar(`t${i}`, p)
    if (a.nota < 0 || a.nota > 100) registrar(`t${i}`, `nota ${a.nota} fora de 0..100`)
    for (const [k, v] of Object.entries(a.notas)) {
      if (v < 0 || v > 100) registrar(`t${i}`, `nota ${k} = ${v} fora de 0..100`)
    }
    if (a.pctCliente < 0 || a.pctCliente > 100) registrar(`t${i}`, `pctCliente ${a.pctCliente} fora de 0..100`)
  } catch (err) {
    registrar(`t${i}`, `transcrição explodiu: ${err.message}`)
  }
}

console.log('\n── RESULTADO (motor) ──')
if (problemas.length === 0) {
  console.log('Problemas: nenhum 🎉')
} else {
  console.log(`Problemas: ${problemas.length}${problemas.length >= 40 ? '+ (mostrando os 40 primeiros)' : ''}`)
  for (const p of problemas) console.log(`  caso ${p.caso}: ${p.msg}`)
}
process.exit(problemas.length ? 1 : 0)
