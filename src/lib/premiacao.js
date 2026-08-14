// ─────────────────────────────────────────────────────────────────────────────
// GB AWARDS — a apuração dos dois prêmios do ano.
//
// Todo ano o escritório premia os assessores, e dois desses prêmios saem da
// área de seguros:
//
//   · MAIOR EMISSOR — quem emitiu mais apólices no ano (quantidade);
//   · MAIOR PRÊMIO  — quem somou o maior volume de prêmio no ano (dinheiro).
//
// São dois prêmios porque são duas virtudes diferentes: um assessor pode
// emitir muitas apólices pequenas e outro poucas apólices grandes. Ranquear
// os dois no mesmo número esconderia justamente a diferença que a premiação
// existe para reconhecer — por isso aqui há dois rankings, calculados sobre a
// mesma base e apresentados lado a lado.
//
// ── DE ONDE VÊM OS NÚMEROS ───────────────────────────────────────────────────
// Da planilha geral (Seguros Fechados) que sobe todo mês em Importar. Ela
// vira a tabela de apólices, e cada apólice pertence a um cliente, que
// pertence a um assessor. Nada aqui é digitado à mão: subiu a planilha do mês,
// o ranking se move sozinho.
//
// ── AS QUATRO DECISÕES QUE MANTÊM A APURAÇÃO HONESTA ─────────────────────────
//
//   1. A DATA QUE VALE É A DA EMISSÃO (vigência da apólice), não a do dia em
//      que a linha entrou no sistema. Importar a planilha atrasada não muda o
//      ranking, e reimportar não conta nada duas vezes.
//
//   2. A JANELA TERMINA EM NOVEMBRO. A premiação acontece em novembro, então
//      só entra o que foi emitido de 1º de janeiro até 30 de novembro. O mês
//      de fechamento é parâmetro: se a regra do ano mudar, muda-se aqui e em
//      um seletor na tela — não no meio do cálculo.
//
//   3. APÓLICE CANCELADA NÃO PREMIA, por padrão. Prêmio de produção que conta
//      apólice que não ficou em pé premiaria o cancelamento. Fica disponível
//      como opção (`incluirCanceladas`) porque o critério é do escritório, não
//      deste arquivo — mas o padrão é o que resiste a uma auditoria.
//
//   4. APÓLICE SEM ASSESSOR NÃO ENTRA NO RANKING, e também não some: volta
//      separada em `semAssessor`, para a consultora corrigir o cadastro antes
//      da apuração final. Distribuí-la por engano mudaria quem ganha.
//
// O módulo é puro: recebe listas, devolve números. Quem busca no banco é a
// tela; quem confere os números é o teste (scripts/teste-premiacao.mjs).
// ─────────────────────────────────────────────────────────────────────────────

// Novembro: o mês da premiação, e por isso o último que conta.
export const MES_FECHAMENTO_PADRAO = 11

export const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Nome do assessor de reserva que o importador cria quando a planilha traz a
// apólice sem assessor. Ele não é uma pessoa — não pode disputar prêmio.
const ASSESSOR_RESERVA = /^\(sem assessor\)$/i

const dataISO = (v) => String(v ?? '').slice(0, 10)

const paraISO = (v) => {
  if (v instanceof Date) {
    const off = v.getTimezoneOffset() * 60000
    return new Date(v - off).toISOString().slice(0, 10)
  }
  return dataISO(v)
}

const numero = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Quantos dias tem o mês (fim da janela precisa incluir o mês inteiro)
export const ultimoDiaDoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()

const diasEntre = (a, b) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)

// A janela do ano: de 1º de janeiro ao último dia do mês de fechamento.
export function janelaApuracao(ano, mesFechamento = MES_FECHAMENTO_PADRAO) {
  const m = Math.min(Math.max(Math.trunc(Number(mesFechamento)) || MES_FECHAMENTO_PADRAO, 1), 12)
  const a = Math.trunc(Number(ano))
  return {
    inicio: `${a}-01-01`,
    fim: `${a}-${String(m).padStart(2, '0')}-${String(ultimoDiaDoMes(a, m)).padStart(2, '0')}`,
    mesFechamento: m,
  }
}

// Ranking de competição (1, 2, 2, 4): quem empata divide a mesma posição, e a
// posição seguinte pula. É como toda premiação anuncia empate — e empate no
// topo aqui significa dois assessores subindo no palco, não um desempate
// inventado pelo sistema.
function posicionar(lista, valorDe) {
  let posicao = 0
  let anterior = null
  return lista.map((linha, i) => {
    const v = valorDe(linha)
    if (anterior === null || v !== anterior) { posicao = i + 1; anterior = v }
    return { linha, posicao }
  })
}

// Projeção linear até o fim da janela: o ritmo de hoje mantido até novembro.
// Serve para a conversa "no ritmo atual você fecha em X" — nunca é promessa,
// e por isso a tela sempre mostra junto quantos dias faltam.
function projetar(valor, diasCorridos, diasTotais) {
  if (diasCorridos <= 0 || diasCorridos >= diasTotais) return null
  return valor * (diasTotais / diasCorridos)
}

/**
 * Apura os dois prêmios do ano.
 *
 * @param {object} dados
 *   apolices   — [{ id, id_cliente, id_seguradora, valor_premio_mensal, data_vigencia, status }]
 *   clientes   — [{ id, nome, id_assessor }]
 *   assessores — [{ id, nome, codigo, ativo }]
 *   seguradoras— [{ id, nome }]
 * @param {object} opcoes
 *   ano, mesFechamento, incluirCanceladas, hoje ("AAAA-MM-DD" ou Date)
 */
export function apurarPremiacao(dados = {}, opcoes = {}) {
  const { apolices = [], clientes = [], assessores = [], seguradoras = [] } = dados
  const hoje = paraISO(opcoes.hoje ?? new Date())
  const ano = Math.trunc(Number(opcoes.ano)) || Number(hoje.slice(0, 4))
  const { inicio, fim, mesFechamento } = janelaApuracao(ano, opcoes.mesFechamento)
  const incluirCanceladas = Boolean(opcoes.incluirCanceladas)

  const clientePorId = new Map(clientes.map((c) => [c.id, c]))
  const assessorPorId = new Map(assessores.map((a) => [a.id, a]))
  const seguradoraPorId = new Map(seguradoras.map((s) => [s.id, s.nome]))

  const novaLinha = (id, assessor) => ({
    id,
    nome: assessor?.nome ?? 'Assessor não cadastrado',
    codigo: assessor?.codigo ?? null,
    ativo: assessor?.ativo !== false,
    apolices: 0,
    premioMensal: 0,
    porMes: Array.from({ length: mesFechamento }, () => ({ apolices: 0, premioMensal: 0 })),
    seguradoras: new Map(),
    clientes: new Set(),
    primeiraEmissao: null,
    ultimaEmissao: null,
  })

  const porAssessor = new Map()
  const semAssessor = { apolices: 0, premioMensal: 0, clientes: new Set() }
  let foraDaJanela = 0
  let canceladasIgnoradas = 0

  for (const ap of apolices) {
    const emissao = dataISO(ap.data_vigencia)
    if (!emissao || emissao < inicio || emissao > fim) { foraDaJanela += 1; continue }
    if (!incluirCanceladas && ap.status !== 'ativa') { canceladasIgnoradas += 1; continue }

    const cliente = clientePorId.get(ap.id_cliente)
    const assessor = cliente ? assessorPorId.get(cliente.id_assessor) : null
    const premio = numero(ap.valor_premio_mensal)

    if (!assessor || ASSESSOR_RESERVA.test(assessor.nome ?? '')) {
      semAssessor.apolices += 1
      semAssessor.premioMensal += premio
      if (cliente?.nome) semAssessor.clientes.add(cliente.nome)
      continue
    }

    if (!porAssessor.has(assessor.id)) porAssessor.set(assessor.id, novaLinha(assessor.id, assessor))
    const linha = porAssessor.get(assessor.id)
    const mes = Number(emissao.slice(5, 7))

    linha.apolices += 1
    linha.premioMensal += premio
    linha.porMes[mes - 1].apolices += 1
    linha.porMes[mes - 1].premioMensal += premio
    if (cliente?.nome) linha.clientes.add(cliente.nome)
    const seg = seguradoraPorId.get(ap.id_seguradora) ?? '(sem seguradora)'
    const acc = linha.seguradoras.get(seg) ?? { seguradora: seg, apolices: 0, premioMensal: 0 }
    acc.apolices += 1
    acc.premioMensal += premio
    linha.seguradoras.set(seg, acc)
    if (!linha.primeiraEmissao || emissao < linha.primeiraEmissao) linha.primeiraEmissao = emissao
    if (!linha.ultimaEmissao || emissao > linha.ultimaEmissao) linha.ultimaEmissao = emissao
  }

  // O prêmio anualizado (mensal × 12) é a moeda em que o mercado compara
  // produção — e é a coluna "PRÊMIO ANUAL" da própria planilha geral.
  const linhas = [...porAssessor.values()].map((l) => ({
    ...l,
    premioAnual: l.premioMensal * 12,
    ticketMedio: l.apolices > 0 ? l.premioMensal / l.apolices : 0,
    clientes: l.clientes.size,
    seguradoras: [...l.seguradoras.values()].sort((a, b) => b.premioMensal - a.premioMensal),
  }))

  // Ordem de exibição de cada ranking. O critério de desempate (o outro
  // prêmio, depois o nome) só decide a ORDEM na tela — a posição continua
  // sendo a mesma para quem empatou de fato.
  const porQuantidade = [...linhas].sort((a, b) =>
    b.apolices - a.apolices || b.premioMensal - a.premioMensal || a.nome.localeCompare(b.nome, 'pt-BR'))
  const porPremio = [...linhas].sort((a, b) =>
    b.premioMensal - a.premioMensal || b.apolices - a.apolices || a.nome.localeCompare(b.nome, 'pt-BR'))

  for (const { linha, posicao } of posicionar(porQuantidade, (l) => l.apolices)) linha.posQuantidade = posicao
  for (const { linha, posicao } of posicionar(porPremio, (l) => l.premioMensal)) linha.posPremio = posicao

  const lideresQuantidade = porQuantidade.filter((l) => l.posQuantidade === 1 && l.apolices > 0)
  const lideresPremio = porPremio.filter((l) => l.posPremio === 1 && l.premioMensal > 0)
  const liderQuantidade = lideresQuantidade[0] ?? null
  const liderPremio = lideresPremio[0] ?? null

  // A distância até o líder é o número que faz o assessor agir: "faltam 3
  // apólices" cabe numa mensagem de WhatsApp; "você está em 4º" não.
  for (const l of linhas) {
    l.faltamApolices = liderQuantidade ? Math.max(liderQuantidade.apolices - l.apolices, 0) : 0
    l.faltamPremioMensal = liderPremio ? Math.max(liderPremio.premioMensal - l.premioMensal, 0) : 0
    l.faltamPremioAnual = l.faltamPremioMensal * 12
  }

  const diasTotais = diasEntre(inicio, fim) + 1
  const diasCorridos = Math.min(Math.max(diasEntre(inicio, hoje) + 1, 0), diasTotais)
  const diasRestantes = diasTotais - diasCorridos
  const mesCorrente = hoje >= inicio && hoje <= fim ? Number(hoje.slice(5, 7)) : null

  for (const l of linhas) {
    l.projecaoApolices = projetar(l.apolices, diasCorridos, diasTotais)
    l.projecaoPremioMensal = projetar(l.premioMensal, diasCorridos, diasTotais)
  }

  const totais = {
    assessores: linhas.length,
    apolices: linhas.reduce((s, l) => s + l.apolices, 0),
    premioMensal: linhas.reduce((s, l) => s + l.premioMensal, 0),
  }
  totais.premioAnual = totais.premioMensal * 12

  // Total do escritório mês a mês — a "corrida do ano" que a tela desenha
  const porMes = Array.from({ length: mesFechamento }, (_, i) => ({
    mes: i + 1,
    rotulo: MESES_CURTO[i],
    apolices: linhas.reduce((s, l) => s + l.porMes[i].apolices, 0),
    premioMensal: linhas.reduce((s, l) => s + l.porMes[i].premioMensal, 0),
  }))

  return {
    ano,
    janela: { inicio, fim, mesFechamento },
    incluirCanceladas,
    linhas,
    porQuantidade,
    porPremio,
    liderQuantidade,
    lideresQuantidade,
    liderPremio,
    lideresPremio,
    // O caso que a premiação adora: o mesmo assessor levando os dois troféus
    duploLider: Boolean(liderQuantidade && liderPremio && liderQuantidade.id === liderPremio.id
      && lideresQuantidade.length === 1 && lideresPremio.length === 1),
    totais,
    porMes,
    semAssessor: { ...semAssessor, clientes: semAssessor.clientes.size },
    foraDaJanela,
    canceladasIgnoradas,
    prazo: {
      hoje, diasTotais, diasCorridos, diasRestantes, mesCorrente,
      encerrada: hoje > fim,
      naoComecou: hoje < inicio,
      progressoPct: Math.round((diasCorridos / diasTotais) * 100),
    },
  }
}

// A vantagem do líder sobre o segundo colocado, na métrica pedida. É o dado
// que decide se a disputa ainda está aberta — e o que a consultora conta na
// mensagem do mês ("lidera por 2 apólices").
export function vantagemDoLider(apuracao, metrica = 'quantidade') {
  const lista = metrica === 'premio' ? apuracao.porPremio : apuracao.porQuantidade
  const valorDe = metrica === 'premio' ? (l) => l.premioMensal : (l) => l.apolices
  const lider = lista[0]
  if (!lider || valorDe(lider) <= 0) return null
  const empatados = lista.filter((l) => valorDe(l) === valorDe(lider))
  const segundo = lista.find((l) => valorDe(l) < valorDe(lider)) ?? null
  return {
    lider,
    empatados: empatados.length,
    segundo,
    diferenca: segundo ? valorDe(lider) - valorDe(segundo) : valorDe(lider),
    semAdversario: !segundo,
  }
}

// Anos que a tela oferece no seletor: os que têm apólice emitida, mais o ano
// corrente (que começa vazio e precisa aparecer mesmo assim).
export function anosComEmissao(apolices = [], hoje = new Date()) {
  const anos = new Set([Number(paraISO(hoje).slice(0, 4))])
  for (const ap of apolices) {
    const d = dataISO(ap.data_vigencia)
    if (/^\d{4}-/.test(d)) anos.add(Number(d.slice(0, 4)))
  }
  return [...anos].sort((a, b) => b - a)
}
