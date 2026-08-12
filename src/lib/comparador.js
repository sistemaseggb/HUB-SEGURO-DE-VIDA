// ─────────────────────────────────────────────────────────────────────────────
// O COMPARADOR — seguro resgatável contra previdência, ano a ano.
//
// "Não seria melhor investir esse dinheiro?" é a pergunta que decide a venda de
// um seguro resgatável. Até aqui o sistema respondia com um número só (quantos
// anos de aporte levariam até o capital). Aqui ele responde com a série.
//
// ── O PRINCÍPIO ──────────────────────────────────────────────────────────────
// A comparação precisa ser JUSTA, ou volta contra quem apresenta. Seguro e
// investimento não respondem à mesma pergunta:
//
//   · se acontecer amanhã, o seguro entrega o capital inteiro e o investimento
//     entrega o que foi depositado — a diferença é de ordem de grandeza;
//   · se não acontecer nada e o horizonte for longo, o investimento acumula
//     mais que o valor de resgate — e tem que ser dito, porque é verdade.
//
// Um comparador que esconde o segundo ponto é desmontado em trinta segundos
// pelo assessor de investimentos do cliente. É justamente por mostrar os dois
// lados que o argumento fica de pé. Por isso este arquivo:
//
//   · credita a dedução do PGBL (até 12% da renda tributável, todo ano);
//   · usa a tabela regressiva de IR de verdade, faixa por faixa;
//   · não inventa valor de resgate — usa a tabela que a consultora colou da
//     cotação e interpola só o meio;
//   · isola o custo real da proteção, que é o número que um profissional de
//     investimentos respeita.
//
// Tudo determinístico e sem rede. As premissas (taxa real, alíquota) aparecem
// escritas na tela: projeção sem premissa à vista é adivinhação.
// ─────────────────────────────────────────────────────────────────────────────

import { TAXA_REAL_ANUAL } from './estudo.js'

// ─── Blindagem da entrada ────────────────────────────────────────────────────
// Mesma disciplina do motor do estudo: o que entra errado vira zero e é
// sinalizado na conferência, nunca escondido dentro de uma conta.
const TETO_VALOR = 1e12
const HORIZONTE_MAXIMO = 40

const num = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const q = (v, teto = TETO_VALOR) => {
  const x = Number(v)
  if (!Number.isFinite(x) || x <= 0) return 0
  return Math.min(x, teto)
}

// ─── A TABELA REGRESSIVA DE IR ───────────────────────────────────────────────
// Previdência (VGBL e PGBL) no regime regressivo: a alíquota cai conforme o
// tempo do APORTE, não a idade do plano.
//
// O motor do estudo (estudo.js) usa 10% fixo, e está certo lá: o contexto é
// "o saldo que a família saca lá na frente", onde o longo prazo já venceu.
// Aqui o contexto é a CURVA — e nos primeiros anos, que é onde a comparação
// se decide, a diferença entre 35% e 10% muda tudo.
export const IR_REGRESSIVO = [
  { ateAnos: 2, aliquota: 0.35 },
  { ateAnos: 4, aliquota: 0.30 },
  { ateAnos: 6, aliquota: 0.25 },
  { ateAnos: 8, aliquota: 0.20 },
  { ateAnos: 10, aliquota: 0.15 },
  { ateAnos: Infinity, aliquota: 0.10 },
]

export function aliquotaRegressiva(anos) {
  const a = num(anos)
  return IR_REGRESSIVO.find((f) => a <= f.ateAnos)?.aliquota ?? 0.10
}

// Teto de dedução do PGBL: 12% da renda bruta tributável do ano.
export const TETO_DEDUCAO_PGBL = 0.12

// ─── A TABELA DE RESGATE ─────────────────────────────────────────────────────
// A consultora cola os pares ano/valor da cotação. O sistema NÃO inventa
// valor de resgate: interpola linearmente entre os pontos informados e mantém
// estável depois do último. Antes do primeiro ponto o resgate é zero — é como
// os produtos funcionam de verdade (carência).
export function normalizarResgates(bruto) {
  const lista = Array.isArray(bruto) ? bruto : []
  const limpos = lista
    .map((p) => ({ ano: Math.round(num(p?.ano)), resgate: q(p?.resgate) }))
    .filter((p) => p.ano > 0 && p.ano <= HORIZONTE_MAXIMO * 2 && p.resgate > 0)
  // Ano repetido: fica o último informado (a consultora corrigiu o valor)
  const porAno = new Map()
  for (const p of limpos) porAno.set(p.ano, p.resgate)
  return [...porAno.entries()]
    .map(([ano, resgate]) => ({ ano, resgate }))
    .sort((a, b) => a.ano - b.ano)
}

// Lê um par ano/valor de cada linha colada da cotação. Aceita as formas que
// aparecem de verdade: "5  12.500", "10 R$ 41.200,00", "Ano 15 — 78.900",
// "20;120000" e a tabulação que vem do Excel.
export function lerTabelaColada(texto) {
  const linhas = String(texto ?? '').split(/\r?\n/)
  const pares = []
  for (const bruta of linhas) {
    const linha = bruta.trim()
    if (!linha) continue
    // dois números por linha: o primeiro é o ano, o segundo é o dinheiro
    const achados = linha.match(/\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g)
    if (!achados || achados.length < 2) continue
    const ano = Math.round(Number(String(achados[0]).replace(/\./g, '').replace(',', '.')))
    // o valor é o MAIOR número da linha: algumas cotações trazem colunas
    // extras (prêmio pago, capital) e o resgate nunca é o menor deles
    const numeros = achados.slice(1).map((s) => {
      const temMilhar = /^\d{1,3}(\.\d{3})+/.test(s)
      return Number(temMilhar ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.'))
    }).filter((x) => Number.isFinite(x))
    if (numeros.length === 0) continue
    const resgate = Math.max(...numeros)
    if (ano > 0 && ano <= 80 && resgate > 0) pares.push({ ano, resgate })
  }
  return normalizarResgates(pares)
}

// Valor de resgate num ano qualquer, a partir dos pontos informados.
export function resgateNoAno(resgates, ano) {
  if (!resgates || resgates.length === 0) return 0
  const a = num(ano)
  const primeiro = resgates[0]
  const ultimo = resgates[resgates.length - 1]
  // carência: antes do primeiro ponto informado não há resgate
  if (a < primeiro.ano) return 0
  if (a >= ultimo.ano) return ultimo.resgate
  for (let i = 0; i < resgates.length - 1; i++) {
    const p = resgates[i]
    const s = resgates[i + 1]
    if (a >= p.ano && a <= s.ano) {
      if (s.ano === p.ano) return s.resgate
      const t = (a - p.ano) / (s.ano - p.ano)
      return p.resgate + t * (s.resgate - p.resgate)
    }
  }
  return ultimo.resgate
}

// ─── AS DIMENSÕES QUE NÃO SÃO DINHEIRO ───────────────────────────────────────
// O gráfico responde "quanto". Este quadro responde "o quê" — e é onde o
// seguro ganha por motivos que nenhuma taxa de juros alcança.
//
// Cada afirmação jurídica traz a referência. O que varia por estado entra como
// "confirme", nunca como afirmação: uma tabela que afirma demais é a coisa
// mais fácil de derrubar numa reunião.
export const DIMENSOES_COMPARACAO = [
  {
    id: 'evento_cedo',
    pergunta: 'Se acontecer no primeiro ano, quanto a família recebe?',
    seguro: 'O capital inteiro',
    vgbl: 'Só o que foi aportado',
    pgbl: 'Só o que foi aportado',
    vencedor: 'seguro',
    nota: 'É a diferença de ordem de grandeza que justifica o seguro existir.',
  },
  {
    id: 'ir_entrega',
    pergunta: 'Imposto de renda no que a família recebe',
    seguro: 'Isento',
    vgbl: 'Só sobre o rendimento',
    pgbl: 'Sobre o valor total',
    vencedor: 'seguro',
    nota: 'Lei 7.713/88, art. 6º, XIII — o capital pago por morte do segurado é isento.',
  },
  {
    id: 'inventario',
    pergunta: 'Passa por inventário?',
    seguro: 'Não',
    vgbl: 'Não',
    pgbl: 'Não',
    vencedor: 'empate',
    nota: 'Código Civil, art. 794 — o capital do seguro não é herança nem responde por dívidas.',
  },
  {
    id: 'prazo',
    pergunta: 'Prazo até a família ter o dinheiro na mão',
    seguro: 'Dias',
    vgbl: 'Dias',
    pgbl: 'Dias',
    vencedor: 'empate',
    nota: 'Os dois vão direto ao beneficiário indicado, sem alvará judicial.',
  },
  {
    id: 'penhora',
    pergunta: 'Fica protegido de credores?',
    seguro: 'Impenhorável',
    vgbl: 'Discutido nos tribunais',
    pgbl: 'Discutido nos tribunais',
    vencedor: 'seguro',
    nota: 'CPC, art. 833, VI. Para previdência a jurisprudência varia conforme o caso.',
  },
  {
    id: 'deducao',
    pergunta: 'Abate imposto de renda todo ano?',
    seguro: 'Não',
    vgbl: 'Não',
    pgbl: 'Sim, até 12% da renda tributável',
    vencedor: 'pgbl',
    nota: 'É a maior vantagem do PGBL e entra na conta deste comparador.',
  },
  {
    id: 'acumulo',
    pergunta: 'Acumula mais em 20 ou 30 anos, sem sinistro?',
    seguro: 'Não',
    vgbl: 'Sim',
    pgbl: 'Sim',
    vencedor: 'investimento',
    nota: 'Parte do prêmio paga a proteção — e é exatamente por isso que ele protege.',
  },
  {
    id: 'liquidez',
    pergunta: 'Dá para tirar dinheiro em vida?',
    seguro: 'Sim, pelo resgate (com carência)',
    vgbl: 'Sim, a qualquer momento',
    pgbl: 'Sim, a qualquer momento',
    vencedor: 'investimento',
    nota: 'No seguro o resgate reduz ou encerra a cobertura — não é a mesma liquidez.',
  },
]

// ─── A SÉRIE ─────────────────────────────────────────────────────────────────
// Um ponto por ano. É daqui que saem o gráfico, os números derivados e a
// tabela para leitores de tela.
export function compararSeguroComInvestimento({
  capital,
  premioMensal,
  resgates = [],
  alternativa = 'vgbl',
  taxaReal = TAXA_REAL_ANUAL,
  aliquotaIR = 0,
  rendaMensal = 0,
  anos = 30,
  premioTemporarioMensal = 0,
} = {}) {
  const cap = q(capital)
  const premio = q(premioMensal, 1e7)
  if (!(cap > 0) || !(premio > 0)) return null

  const tabela = normalizarResgates(resgates)
  const regime = alternativa === 'pgbl' ? 'pgbl' : 'vgbl'
  // taxa real fora de -5%..20% é digitação errada, não cenário
  const taxa = Math.min(Math.max(Number.isFinite(Number(taxaReal)) ? Number(taxaReal) : TAXA_REAL_ANUAL, -0.05), 0.20)
  const irCliente = Math.min(Math.max(num(aliquotaIR), 0), 0.50)
  const horizonte = Math.min(Math.max(Math.round(num(anos)) || 30, 1), HORIZONTE_MAXIMO)
  const i = (1 + taxa) ** (1 / 12) - 1

  // A dedução do PGBL só existe até 12% da renda tributável do ano. Aportar
  // mais que isso não devolve imposto nenhum — e fingir que devolve seria
  // inflar o lado do concorrente, o que também é comparação errada.
  const aporteAnual = premio * 12
  const tetoDeducao = q(rendaMensal) * 12 * TETO_DEDUCAO_PGBL
  const deducaoAnual = regime === 'pgbl' && irCliente > 0
    ? Math.min(aporteAnual, tetoDeducao) * irCliente
    : 0

  const serie = []
  let saldo = 0
  let deducaoAcumulada = 0
  for (let ano = 1; ano <= horizonte; ano++) {
    // doze aportes mensais capitalizados dentro do ano
    for (let m = 0; m < 12; m++) saldo = saldo * (1 + i) + premio
    const aportado = aporteAnual * ano
    const rendimento = Math.max(saldo - aportado, 0)
    const aliquota = aliquotaRegressiva(ano)
    // VGBL tributa o ganho; PGBL tributa tudo que sai
    const ir = regime === 'pgbl' ? saldo * aliquota : rendimento * aliquota
    // a dedução volta para ele todo ano e também rende
    deducaoAcumulada = deducaoAcumulada * (1 + taxa) + deducaoAnual
    const investidoLiquido = saldo - ir + deducaoAcumulada
    const seguroResgate = resgateNoAno(tabela, ano)

    serie.push({
      ano,
      // o seguro paga o capital inteiro desde o primeiro mês
      seguroMorte: cap,
      seguroResgate,
      aportado,
      investidoBruto: saldo,
      aliquota,
      ir,
      deducaoAcumulada,
      investidoLiquido,
      // o buraco daquele ano: o que faltaria à família se acontecesse ali
      descoberto: Math.max(cap - investidoLiquido, 0),
    })
  }

  const ultimo = serie[serie.length - 1]
  const cruzamento = serie.find((p) => p.investidoLiquido >= cap) ?? null
  const pior = serie.reduce((a, p) => (p.descoberto > a.descoberto ? p : a), serie[0])

  // O custo real da proteção: o que o investimento teria acumulado, menos o
  // que o seguro devolve de resgate. É o preço de ter carregado a cobertura —
  // e é o número que resiste a um assessor de investimentos na sala.
  const custoRealDaProtecao = Math.max(ultimo.investidoLiquido - ultimo.seguroResgate, 0)
  const custoPorMilPorAno = cap > 0 && horizonte > 0
    ? (custoRealDaProtecao / horizonte) / (cap / 1000)
    : null
  // Se ela cotou um temporário do mesmo capital, essa é a comparação mais
  // justa que existe: proteção contra proteção, sem o componente de poupança.
  const temporario = q(premioTemporarioMensal, 1e7)
  const custoTemporarioNoPeriodo = temporario > 0 ? temporario * 12 * horizonte : null

  return {
    // premissas, sempre visíveis
    premissas: {
      capital: cap,
      premioMensal: premio,
      alternativa: regime,
      taxaReal: taxa,
      aliquotaIR: irCliente,
      anos: horizonte,
      temTabelaResgate: tabela.length > 0,
      pontosInformados: tabela.length,
      deducaoAnual,
      tetoDeducaoAnual: tetoDeducao,
    },
    serie,
    // o número central: quando o investimento alcança o capital do seguro
    anoDoCruzamento: cruzamento ? cruzamento.ano : null,
    // o pior momento e o tamanho do buraco
    descobertoMaximo: pior.descoberto,
    anoDoPiorDescoberto: pior.ano,
    // no fim do horizonte
    investidoNoFim: ultimo.investidoLiquido,
    resgateNoFim: ultimo.seguroResgate,
    aportadoNoFim: ultimo.aportado,
    custoRealDaProtecao,
    custoPorMilPorAno,
    custoTemporarioNoPeriodo,
    // quanto cada R$ 1 de prêmio protege — cai à medida que o outro lado sobe
    alavancagemInicial: Math.round(cap / premio),
    // a honestidade que sustenta o resto do argumento
    investimentoGanhaNoFim: ultimo.investidoLiquido > ultimo.seguroResgate,
  }
}

// ─── CONFERÊNCIAS ────────────────────────────────────────────────────────────
// No mesmo espírito das `inconsistencias` do estudo: o que impede a
// apresentação de mostrar um número que não fecha na frente do cliente.
export function conferirComparador(plano, comp) {
  const avisos = []
  const tabela = normalizarResgates(plano?.seguro_resgatavel)
  const capital = q(plano?.capital_sugerido) || q(comp?.premissas?.capital)
  const premio = q(plano?.premio_estimado, 1e7)

  if (tabela.length === 0 && premio > 0) {
    avisos.push({
      grave: false,
      texto: 'Sem a tabela de resgate da cotação o comparador mostra só o lado do investimento. Cole os pares ano/valor que a seguradora informou.',
    })
  }
  if (tabela.length === 1) {
    avisos.push({
      grave: false,
      texto: 'A tabela tem um ponto só — o comparador mantém esse valor constante daí em diante. Com dois ou mais pontos a curva fica real.',
    })
  }
  for (let k = 1; k < tabela.length; k++) {
    if (tabela[k].resgate < tabela[k - 1].resgate) {
      avisos.push({
        grave: true,
        texto: `O resgate do ano ${tabela[k].ano} é menor que o do ano ${tabela[k - 1].ano}. Valor de resgate não diminui — confira a digitação.`,
      })
      break
    }
  }
  const acimaDoCapital = tabela.find((p) => capital > 0 && p.resgate > capital)
  if (acimaDoCapital) {
    avisos.push({
      grave: true,
      texto: `O resgate do ano ${acimaDoCapital.ano} passou do capital segurado. Um dos dois está errado — normalmente é a coluna copiada da cotação.`,
    })
  }
  if (premio <= 0) {
    avisos.push({
      grave: true,
      texto: 'Sem o prêmio mensal cotado não há o que comparar: é ele que vira o aporte do outro lado.',
    })
  }
  if (comp?.premissas?.alternativa === 'pgbl' && !(comp.premissas.aliquotaIR > 0)) {
    avisos.push({
      grave: false,
      texto: 'Comparando com PGBL sem a alíquota de IR do cliente: a dedução de até 12% da renda não está sendo creditada, e a comparação fica injusta com o PGBL.',
    })
  }
  if (comp?.premissas?.alternativa === 'pgbl' && comp.premissas.deducaoAnual > 0
    && comp.premissas.tetoDeducaoAnual > 0
    && comp.premissas.premioMensal * 12 > comp.premissas.tetoDeducaoAnual) {
    avisos.push({
      grave: false,
      texto: 'O aporte anual passa dos 12% da renda tributável: a parte acima do teto não deduz imposto nenhum, e o comparador já considera isso.',
    })
  }
  return avisos
}
