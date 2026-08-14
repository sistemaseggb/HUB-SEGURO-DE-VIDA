// ─────────────────────────────────────────────────────────────────────────────
// Leitor da PLANILHA GERAL (Seguros Fechados) — o registro-mestre do escritório.
//
// É a planilha que a consultora sobe todo mês para atualizar os números. Tem
// várias abas; a que interessa é a das apólices vigentes ("Propostas fechadas"
// / "Seguros fechados"). Este módulo lê o .xlsx direto (sem converter para CSV),
// mapeia as colunas reais, arruma as sujeiras (datas em número do Excel,
// comissão em fração, grafias diferentes da mesma seguradora) e devolve uma
// lista limpa de registros — pronta para o importador criar/atualizar.
// ─────────────────────────────────────────────────────────────────────────────
// A biblioteca de xlsx é o maior pacote do sistema (perto de 400 KB
// minificados) e serve a UMA tela: a de importar planilhas, usada uma vez por
// mês. Importada aqui de forma estática, ela viajava dentro do pacote
// principal — a consultora baixava o leitor de Excel inteiro para abrir o
// dashboard no celular, no meio da rua, antes de uma reunião.
//
// `planilhasComissao.js` já a carregava sob demanda, mas o import estático
// daqui anulava aquilo: basta um arquivo do pacote principal apontar para o
// módulo e ele volta para dentro dele. O próprio build avisava disso a cada
// compilação (INEFFECTIVE_DYNAMIC_IMPORT) e o aviso passou despercebido.
//
// Agora as duas portas são dinâmicas, e o Excel só desce quando alguém de
// fato vai subir uma planilha.
let XLSX = null
async function carregarXLSX() {
  if (!XLSX) XLSX = await import('xlsx')
  return XLSX
}

// Consolida grafias diferentes da MESMA seguradora (evita cadastro duplicado)
const CANONICO_SEGURADORA = {
  'metlife': 'MetLife', 'met life': 'MetLife',
  'mag': 'MAG', 'mag seguros': 'MAG',
  'omint': 'Omint', 'omint (seg. viagem)': 'Omint', 'omint seg viagem': 'Omint',
  'azos': 'Azos', 'icatu': 'Icatu', 'prudential': 'Prudential',
  'pottencial': 'Pottencial', 'potencial': 'Pottencial',
  'akad (rc)': 'Akad', 'akad': 'Akad',
  'axa (empresarial)': 'AXA', 'axa': 'AXA',
}

export function canonSeguradora(nome) {
  const bruto = String(nome ?? '').trim()
  if (!bruto) return ''
  const chave = bruto.toLowerCase().replace(/\s+/g, ' ')
  return CANONICO_SEGURADORA[chave] || bruto
}

// Número do Excel (ex.: 45030) ou texto → ISO "AAAA-MM-DD" (ou null).
// Conversão manual do serial do Excel (serial 25569 = 1970-01-01), em UTC
// para não sofrer com fuso — não depende de XLSX.SSF.
function paraISO(v) {
  if (typeof v === 'number' && isFinite(v) && v > 60) {
    const d = new Date(Math.round((v - 25569) * 86400000))
    if (Number.isNaN(d.getTime())) return null
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

// Aceita número puro (xlsx) ou texto "R$ 1.234,56" / "1234.56"
function paraNumero(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null
  let s = String(v ?? '').replace(/[R$\s]/g, '')
  if (s === '') return null
  // se tem vírgula, ela é o decimal (pt-BR) e ponto é milhar
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return isFinite(n) ? n : null
}

// Normaliza um cabeçalho: "PRÊMIO MES" → "premiomes"
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// Acha o valor de uma linha por apelidos de cabeçalho (o primeiro que casar)
function campo(linhaNorm, ...apelidos) {
  for (const ap of apelidos) {
    for (const [k, v] of linhaNorm) if (k.includes(ap)) return v
  }
  return ''
}

// ─── Qual coluna de prêmio manda: a ANUAL ────────────────────────────────────
// A planilha traz PRÊMIO ANUAL e PRÊMIO MES, e por muito tempo o Hub leu a
// mensal primeiro — parecia o dado mais fino. Não é: a mensal é uma coluna
// CALCULADA, e o cálculo dela quebrou.
//
// Na planilha de julho/2026, das 342 linhas que têm os dois valores, 65 têm as
// duas colunas em desacordo por mais de 1%, e 43 delas por mais de 50%. Três
// defeitos distintos convivem ali:
//
//   · a fórmula aponta para OUTRA linha (a célula K2 é `$I9/12`, o prêmio de um
//     cliente que não é o dela) — 20 linhas, herança de uma reordenação;
//   · alguém colou o valor anual dentro da coluna mensal — 20 linhas, que assim
//     entram valendo 12 vezes o que valem;
//   · sobraram 7 células `#REF!`.
//
// A coluna ANUAL é digitada — é o valor do contrato. Então ela passa a mandar,
// e a mensal vira o que sempre deveria ter sido: um cálculo (anual ÷ 12), usado
// como fonte só quando não existe anual nenhum.
//
// Sem isso o ranking dos GB Awards somava R$ 2,36 mi de prêmio em 2026 onde há
// R$ 436 mil — e trocava o 3º e o 4º lugar do prêmio por dois assessores que
// não estavam lá. Números de premiação não podem depender de uma fórmula que
// alguém arrastou errado.
//
// O que diverge NÃO é escondido: cada registro carrega o que a planilha dizia
// nas duas colunas, e a tela de importação mostra a lista antes de importar.
export const TOLERANCIA_PREMIO = 0.01 // 1% — muito acima do arredondamento de ÷12

// Um código de assessor do escritório é letra(s) + dígitos (A65587, CS8868).
// Qualquer outra coisa ali é anotação humana ("não é cliente") e não serve
// para identificar ninguém.
const CODIGO_VALIDO = /^[A-Za-z]{1,3}\s*\d{3,6}$/

// Escolhe a aba das apólices vigentes
export function acharAbaApolices(nomes) {
  return nomes.find((n) => /proposta.*fechad|seguro.*fechad|fechad|apolic|vigent/i.test(n))
    ?? nomes.find((n) => /proposta|apolic|seguro/i.test(n))
    ?? nomes[0]
}

// Lê o arquivo (ArrayBuffer) e devolve os registros de apólice limpos.
// Assíncrona porque o leitor de Excel é carregado sob demanda — quem chama já
// estava num `await file.arrayBuffer()`, então nada muda para a tela.
export async function lerPlanilhaGeral(arrayBuffer) {
  const xlsx = await carregarXLSX()
  const wb = xlsx.read(arrayBuffer, { type: 'array', cellDates: false })
  const aba = acharAbaApolices(wb.SheetNames)
  const ws = wb.Sheets[aba]
  if (!ws) return { aba: null, abas: wb.SheetNames, registros: [], ignoradas: 0 }

  const linhas = xlsx.utils.sheet_to_json(ws, { defval: '', raw: true })
  const registros = []
  let ignoradas = 0

  for (const linha of linhas) {
    // pares [cabecalho-normalizado, valor], ignorando colunas vazias/__EMPTY
    const linhaNorm = Object.entries(linha)
      .filter(([k]) => !/^__EMPTY/.test(k))
      .map(([k, v]) => [norm(k), v])

    const cliente = String(campo(linhaNorm, 'nomerazaosocial', 'nomecliente', 'razaosocial', 'nome', 'segurado', 'cliente')).trim()
    const seguradora = canonSeguradora(campo(linhaNorm, 'seguradora', 'cia', 'companhia'))
    const premioMes = paraNumero(campo(linhaNorm, 'premiomes', 'premiomensal', 'mensal'))
    const premioAnual = paraNumero(campo(linhaNorm, 'premioanual', 'anual'))
    const dataISO = paraISO(campo(linhaNorm, 'data', 'vigencia', 'inicio', 'emissao'))

    // linha só é apólice se tem cliente + seguradora + um prêmio
    if (!cliente || !seguradora || (premioMes == null && premioAnual == null)) {
      if (cliente || seguradora) ignoradas += 1
      continue
    }

    const comissaoBruta = paraNumero(campo(linhaNorm, 'comissao', 'percentual', '%'))
    // 0.4 → 40% ; 40 → 40% ; vazio → null (herda o padrão da seguradora)
    const percentual = comissaoBruta == null ? null
      : comissaoBruta > 0 && comissaoBruta <= 1 ? Math.round(comissaoBruta * 1000) / 10
        : comissaoBruta

    const statusBruto = String(campo(linhaNorm, 'status', 'situacao')).toLowerCase()
    const status = /cancel|inativ/.test(statusBruto) ? 'cancelada'
      : /suspens/.test(statusBruto) ? 'suspensa' : 'ativa'

    // O anual manda; a mensal só entra quando não há anual (ver o bloco
    // TOLERANCIA_PREMIO acima para o porquê).
    const premioAnualFinal = premioAnual ?? (premioMes != null ? Math.round(premioMes * 12 * 100) / 100 : null)
    const premioMensalFinal = premioAnual != null
      ? Math.round((premioAnual / 12) * 100) / 100
      : premioMes
    const divergencia = premioAnual != null && premioMes != null && premioAnual > 0 && premioMes > 0
      ? Math.abs(premioAnual - premioMes * 12) / premioAnual
      : 0

    registros.push({
      linha: registros.length + ignoradas + 2, // +2: cabeçalho e base 1 do Excel
      cliente,
      codCliente: String(campo(linhaNorm, 'codcliente', 'codigocliente', 'codigo') ?? '').trim() || null,
      assessor: String(campo(linhaNorm, 'assessor', 'consultor') ?? '').trim() || null,
      codAssessor: String(campo(linhaNorm, 'codai', 'codassessor', 'codigoassessor', 'aai') ?? '').trim() || null,
      especialista: String(campo(linhaNorm, 'especialista') ?? '').trim() || null,
      numeroApolice: String(campo(linhaNorm, 'apolice', 'contrato', 'numero') ?? '').trim() || null,
      seguradora,
      premioMensal: premioMensalFinal,
      premioAnual: premioAnualFinal,
      // o que a planilha dizia, para a tela poder mostrar a divergência
      premioMesPlanilha: premioMes,
      premioAnualPlanilha: premioAnual,
      premioIncoerente: divergencia > TOLERANCIA_PREMIO,
      percentual,
      vigencia: dataISO,
      tipoProduto: String(campo(linhaNorm, 'tipo', 'produto') ?? '').trim() || null,
      status,
      motivoCancelamento: String(campo(linhaNorm, 'motivocancelamento', 'motivo') ?? '').trim() || null,
    })
  }

  return { aba, abas: wb.SheetNames, registros, ignoradas, conferencia: conferir(registros) }
}

// ─── A conferência da planilha ───────────────────────────────────────────────
// Roda antes de importar e devolve o que, se passar batido, produz um ranking
// errado com cara de certo. Não conserta nada sozinha: o que ela encontra são
// decisões humanas (de quem é a apólice, qual valor vale) — o papel dela é não
// deixar a decisão passar despercebida.
export function conferir(registros = []) {
  const premioIncoerente = registros.filter((r) => r.premioIncoerente)
  const semPremioAnual = registros.filter((r) => r.premioAnualPlanilha == null && r.premioMesPlanilha != null)
  const semAssessor = registros.filter((r) => !r.assessor && !r.codAssessor)
  const semVigencia = registros.filter((r) => !r.vigencia)

  // O mesmo código em duas pessoas é o defeito mais caro: o Hub resolve o
  // assessor pelo CÓDIGO primeiro, então a apólice de uma vai para a outra
  // sem deixar rastro nenhum depois de importada.
  const nomesPorCodigo = new Map()
  const codigosPorNome = new Map()
  const codigoSuspeito = new Map()
  for (const r of registros) {
    const nome = (r.assessor ?? '').trim()
    const cod = (r.codAssessor ?? '').trim()
    if (cod && !CODIGO_VALIDO.test(cod)) {
      if (!codigoSuspeito.has(cod)) codigoSuspeito.set(cod, [])
      codigoSuspeito.get(cod).push(r)
    }
    if (cod && nome) {
      const kc = cod.toUpperCase()
      if (!nomesPorCodigo.has(kc)) nomesPorCodigo.set(kc, new Set())
      nomesPorCodigo.get(kc).add(nome)
    }
    if (nome) {
      const kn = nome.toUpperCase()
      if (!codigosPorNome.has(kn)) codigosPorNome.set(kn, new Set())
      codigosPorNome.get(kn).add(cod ? cod.toUpperCase() : '(sem código)')
    }
  }
  // "Romário" e "Romário Almeida" são a mesma pessoa; "Ikaro" e "Carine" não.
  // Sem essa distinção o alerta acusaria metade do escritório e ninguém leria
  // o que importa — que é o código de uma pessoa aparecendo na apólice de
  // outra.
  const chaveNome = (n) => n.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
  const mesmaPessoa = (a, b) => {
    const [x, y] = [chaveNome(a), chaveNome(b)]
    return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)
  }
  // Agrupa as grafias em pessoas: sobra mais de um grupo = duas pessoas mesmo.
  const pessoasDistintas = (nomes) => {
    const grupos = []
    for (const n of nomes) {
      const g = grupos.find((grupo) => grupo.some((m) => mesmaPessoa(m, n)))
      if (g) g.push(n); else grupos.push([n])
    }
    return grupos
  }

  return {
    premioIncoerente,
    semPremioAnual,
    semAssessor,
    semVigencia,
    // duas PESSOAS diferentes com o mesmo código — o defeito que entrega a
    // apólice de uma para a outra sem deixar rastro
    codigoCompartilhado: [...nomesPorCodigo.entries()]
      .map(([codigo, nomes]) => ({ codigo, grupos: pessoasDistintas([...nomes]) }))
      .filter((x) => x.grupos.length > 1)
      .map((x) => ({ codigo: x.codigo, nomes: x.grupos.map((g) => g[0]) })),
    // a mesma pessoa aparecendo com códigos diferentes (ou às vezes sem
    // nenhum) — divide a produção dela em dois no ranking
    nomeComVariosCodigos: [...codigosPorNome.entries()]
      .filter(([, cods]) => cods.size > 1)
      .map(([nome, cods]) => ({ nome, codigos: [...cods] })),
    codigoSuspeito: [...codigoSuspeito.entries()].map(([codigo, linhas]) => ({ codigo, linhas: linhas.length })),
  }
}
