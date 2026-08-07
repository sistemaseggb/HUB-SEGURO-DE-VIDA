// ─────────────────────────────────────────────────────────────────────────────
// ANÁLISE DE TRANSCRIÇÃO DE REUNIÃO
//
// A consultora grava as reuniões com o Tactiq e sai de cada encontro com 40
// minutos de texto. Ninguém relê isso. Este motor transforma a transcrição em
// material de trabalho, sem depender de internet nem de chave de API:
//
//   1. PARSER      — entende os formatos que ela realmente usa (Tactiq com
//                    carimbo de tempo, VTT/SRT do Zoom, "Fulano: texto" e até
//                    texto corrido colado na mão).
//   2. FALANTES    — separa consultora e cliente e mede quem falou quanto.
//                    Em reunião consultiva, quem mais fala é o cliente.
//   3. EXTRAÇÃO    — pesca os números ditos em voz alta (renda, custo de vida,
//                    patrimônio, dívidas, previdência, prêmio) e a família
//                    (filhos, idades, estado civil), cada um com o trecho que
//                    serve de prova. Nada entra no planejamento sozinho: a
//                    consultora confere e aplica.
//   4. LEITURA     — objeções (com a resposta sugerida), sinais de compra,
//                    compromissos assumidos e momentos-chave para citar na
//                    proposta.
//   5. ROTEIRO     — quanto de cada bloco do roteiro consultivo foi coberto,
//                    e o que ficou de fora para a próxima conversa.
//
// Tudo é determinístico e roda no navegador em milissegundos. Quando a chave
// da Anthropic está configurada, a aba oferece um aprofundamento com o Claude
// por cima disso (ver supabase/functions/analisar-reuniao) — mas o valor
// principal existe sem nenhuma configuração.
// ─────────────────────────────────────────────────────────────────────────────

import { BLOCOS_ROTEIRO } from './roteiro.js'

// ─── Normalização ────────────────────────────────────────────────────────────
const semAcento = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// ─── Números falados por extenso ─────────────────────────────────────────────
// Ninguém fala "R$ 500,00" numa reunião: fala "quinhentos reais", "uns dois
// mil", "um milhão e meio". O extrator só enxergava dígito e perdia tudo isso.
// A saída é normalizar ANTES: trocamos a forma escrita pelo dígito e o resto
// do motor continua igual.
const NUMERAIS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  'três': 3, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800,
  novecentos: 900,
}
const CHAVES_NUMERAIS = Object.keys(NUMERAIS).join('|')
const RE_EXTENSO = new RegExp(
  `\\b(${CHAVES_NUMERAIS})(?:\\s+e\\s+(${CHAVES_NUMERAIS}))?\\b`, 'g')

// "dois mil e quinhentos" → "2500"; "quinhentos reais" → "500 reais";
// "um milhão e meio" → "1,5 milhão". Aplicado antes de qualquer extração.
export function normalizarNumeraisFalados(texto) {
  let t = String(texto ?? '')
  // "e meio" depois de milhão/mil vale meia unidade
  t = t.replace(/\b(\d+(?:[.,]\d+)?|um|uma|dois|duas|tres|tr[êe]s|quatro|cinco)\s+(milh[õo]es|milh[ãa]o|mil)\s+e\s+meio\b/gi,
    (bruto, n, unidade) => {
      const base = NUMERAIS[semAcento(n)] ?? Number(String(n).replace(',', '.'))
      if (!Number.isFinite(base)) return bruto
      return `${String(base + 0.5).replace('.', ',')} ${unidade}`
    })
  // numerais por extenso; o "e" liga dezena+unidade ("vinte e cinco") ou
  // centena+resto ("cento e vinte"), nunca o contrário
  t = t.replace(RE_EXTENSO, (bruto, a, b) => {
    const va = NUMERAIS[semAcento(a)]
    if (va == null) return bruto
    if (b == null) return String(va)
    const vb = NUMERAIS[semAcento(b)]
    if (vb == null || vb >= va) return bruto
    return String(va + vb)
  })
  return t
}

// ─── 1. PARSER ───────────────────────────────────────────────────────────────
// Formatos aceitos, do mais específico ao mais solto:
//   00:12:34 Fulano: texto        (Tactiq)
//   [00:12] Fulano: texto         (variações de export)
//   00:00:12.000 --> 00:00:15.000 (WebVTT/SRT do Zoom, fala na linha seguinte)
//   Fulano: texto                 (Meet e colagem manual)
//   texto corrido                 (sem falantes — ainda assim analisável)
const RE_TEMPO_INICIO = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\]?\s*[-–—]?\s*/
const RE_FALANTE = /^([^:]{2,60}?):\s*/
const RE_VTT = /^\s*(?:\d+\s*$)|^\s*\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/
const RE_CABECALHO = /^\s*(#|https?:\/\/|WEBVTT|Transcri(pt|ção)\b|Date\b|Data\b|Participants?\b|Participantes\b)/i

function segundos(hms) {
  if (!hms) return null
  const p = hms.split(':').map(Number)
  if (p.some((x) => !Number.isFinite(x))) return null
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
}

export function separarFalas(texto) {
  const linhas = String(texto ?? '').split(/\r?\n/)
  const falas = []
  let tempoPendente = null

  for (const bruta of linhas) {
    const linha = bruta.trim()
    if (!linha) continue

    // bloco de tempo do VTT/SRT: guarda o tempo e usa na próxima linha de fala
    const vtt = linha.match(/^(\d{2}:\d{2}:\d{2})[.,]\d{3}\s*-->/)
    if (vtt) { tempoPendente = segundos(vtt[1]); continue }
    if (RE_VTT.test(linha)) continue
    if (RE_CABECALHO.test(linha)) continue

    let resto = linha
    let t = tempoPendente
    tempoPendente = null

    const comTempo = resto.match(RE_TEMPO_INICIO)
    if (comTempo) { t = segundos(comTempo[1]); resto = resto.slice(comTempo[0].length) }

    let quem = null
    const comFalante = resto.match(RE_FALANTE)
    // "Fulano:" só vale como falante se não parecer uma frase inteira
    if (comFalante && comFalante[1].split(/\s+/).length <= 5 && !/[.!?]$/.test(comFalante[1])) {
      quem = comFalante[1].trim()
      resto = resto.slice(comFalante[0].length)
    }

    resto = resto.trim()
    if (!resto) continue

    // linhas seguidas do mesmo falante viram uma fala só
    const ultima = falas[falas.length - 1]
    if (ultima && (quem === null || quem === ultima.quem)) {
      ultima.texto += ' ' + resto
      if (ultima.t == null) ultima.t = t
    } else {
      falas.push({ t, quem, texto: resto })
    }
  }
  return falas
}

// ─── 2. FALANTES ─────────────────────────────────────────────────────────────
// Descobrir quem é quem sem pedir para a consultora marcar: comparamos os
// nomes que aparecem na transcrição com o nome do cliente e o da consultora.
const primeiroNome = (s) => semAcento(s).trim().split(/\s+/)[0] ?? ''

function classificarFalantes(falas, { nomeCliente = '', nomeConsultora = '' } = {}) {
  const nomes = [...new Set(falas.map((f) => f.quem).filter(Boolean))]
  const alvoCliente = primeiroNome(nomeCliente)
  const alvoConsultora = primeiroNome(nomeConsultora)

  const papel = {}
  for (const nome of nomes) {
    const n = semAcento(nome)
    if (alvoCliente && (n.includes(alvoCliente) || alvoCliente.includes(primeiroNome(nome)))) papel[nome] = 'cliente'
    else if (alvoConsultora && (n.includes(alvoConsultora) || alvoConsultora.includes(primeiroNome(nome)))) papel[nome] = 'consultora'
    else papel[nome] = null
  }

  // Sobrou exatamente um sem papel e o outro já está definido? O que sobrou é o oposto.
  const indefinidos = nomes.filter((x) => !papel[x])
  const temCliente = nomes.some((x) => papel[x] === 'cliente')
  const temConsultora = nomes.some((x) => papel[x] === 'consultora')
  if (indefinidos.length === 1 && temCliente !== temConsultora) {
    papel[indefinidos[0]] = temCliente ? 'consultora' : 'cliente'
  } else if (indefinidos.length === 2 && !temCliente && !temConsultora) {
    // Sem pistas de nome: quem faz mais perguntas conduz a reunião.
    const perguntas = Object.fromEntries(indefinidos.map((x) => [x, 0]))
    for (const f of falas) if (f.quem in perguntas) perguntas[f.quem] += (f.texto.match(/\?/g) ?? []).length
    const [a, b] = indefinidos
    const condutor = perguntas[a] >= perguntas[b] ? a : b
    papel[condutor] = 'consultora'
    papel[condutor === a ? b : a] = 'cliente'
  }
  return papel
}

const palavras = (s) => (String(s).match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length

// ─── 3. EXTRAÇÃO DE NÚMEROS ──────────────────────────────────────────────────
// Só contamos como dinheiro o que tem "R$", um multiplicador ("mil", "milhão")
// ou a palavra "reais" por perto. Sem esse filtro, idade e horário viravam
// patrimônio.
// Atenção à ORDEM dos multiplicadores: alternância de regex é gulosa da
// esquerda para a direita, então "mil" antes de "milhões" casava só o começo
// da palavra e transformava "2,3 milhões" em R$ 2.300. Os mais longos vêm
// primeiro, e a fronteira \b impede que "mi" engula "minha".
const RE_VALOR = /(R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(milhões|milhoes|milhão|milhao|mil|mi|k)?\b\s*(reais|conto?s)?/gi

function valorNumerico(bruto, multiplicador) {
  let n
  if (/^\d{1,3}(\.\d{3})+/.test(bruto)) n = Number(bruto.replace(/\./g, '').replace(',', '.'))
  else n = Number(bruto.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const m = semAcento(multiplicador ?? '')
  if (m === 'mil' || m === 'k') n *= 1000
  else if (m === 'milhao' || m === 'milhoes' || m === 'mi') n *= 1_000_000
  return n
}

// O assunto de cada número é decidido pela pista MAIS PRÓXIMA dele na frase,
// não pela primeira da lista. Numa frase como "os imóveis somam 2,3 milhões,
// tenho 700 mil investido e o carro dá 200 mil", os três valores precisam cair
// em três campos diferentes.
const PISTAS_VALOR = [
  { campo: 'premio_anual', rotulo: 'Prêmio anual',
    termos: ['a vista no ano', 'a vista', 'premio anual', 'anual', 'no anual'] },
  { campo: 'premio_estimado', rotulo: 'Prêmio do seguro',
    termos: ['premio', 'mensalidade do seguro', 'parcela do seguro', 'custa o seguro', 'pagaria por mes', 'investimento mensal'] },
  { campo: 'previdencia_saldo', rotulo: 'Previdência',
    termos: ['previdencia', 'vgbl', 'pgbl'] },
  { campo: 'dividas_total', rotulo: 'Dívidas',
    termos: ['divida', 'dividas', 'financiamento', 'financiado', 'emprestimo', 'consignado', 'devo', 'devendo', 'parcelas do carro', 'saldo devedor'] },
  { campo: 'custo_vida_mensal', rotulo: 'Custo de vida',
    termos: ['custo de vida', 'gasto por mes', 'gasto mensal', 'gastamos', 'gasto', 'despesa', 'despesas', 'sai por mes', 'custa por mes', 'para manter a casa'] },
  { campo: 'renda_mensal', rotulo: 'Renda mensal',
    termos: ['renda', 'ganho', 'ganha', 'recebo', 'salario', 'faturo por mes', 'pro-labore', 'pro labore', 'tiro por mes', 'entra por mes'] },
  { campo: 'patrimonio_investimentos', rotulo: 'Investimentos',
    termos: ['investido', 'investimento', 'investimentos', 'aplicado', 'aplicacao', 'reserva', 'poupanca', 'cdb', 'tesouro', 'acoes', 'fundo'] },
  { campo: 'patrimonio_imoveis', rotulo: 'Imóveis',
    termos: ['imovel', 'imoveis', 'apartamento', 'casa vale', 'casa esta', 'terreno', 'sala comercial', 'chacara', 'sitio'] },
  { campo: 'patrimonio_veiculos', rotulo: 'Veículos',
    termos: ['carro', 'caminhonete', 'moto', 'veiculo', 'caminhao'] },
  { campo: 'pj_faturamento_anual', rotulo: 'Faturamento da empresa',
    termos: ['faturamento', 'fatura por ano', 'fatura uns', 'fatura cerca', 'a empresa fatura', 'faturamos', 'faturei no ano', 'fatura'] },
  { campo: 'pj_valuation', rotulo: 'Valor da empresa',
    termos: ['vale a empresa', 'valuation', 'avaliaram a empresa', 'a empresa vale'] },
  { campo: 'patrimonio_total', rotulo: 'Patrimônio',
    termos: ['patrimonio', 'no total tenho', 'somando tudo'] },
]

// Valores por classe do patrimônio precisam somar; renda e custo de vida são
// um número só. `unico` diz qual comportamento aplicar.
const CAMPO_UNICO = new Set([
  'renda_mensal', 'custo_vida_mensal', 'patrimonio_total', 'premio_estimado',
  'premio_anual', 'pj_faturamento_anual', 'pj_valuation', 'previdencia_saldo',
])

// Valores plausíveis por campo — barra o "R$ 5" solto e o "R$ 900 milhões".
const FAIXA = {
  renda_mensal: [800, 2_000_000],
  custo_vida_mensal: [500, 2_000_000],
  premio_estimado: [30, 200_000],
  premio_anual: [300, 2_400_000],
  dividas_total: [500, 500_000_000],
  previdencia_saldo: [1000, 500_000_000],
  patrimonio_total: [5000, 5_000_000_000],
  patrimonio_imoveis: [5000, 5_000_000_000],
  patrimonio_investimentos: [1000, 5_000_000_000],
  patrimonio_veiculos: [3000, 50_000_000],
  pj_faturamento_anual: [10_000, 50_000_000_000],
  pj_valuation: [10_000, 50_000_000_000],
}

// Distância máxima, em caracteres, entre o número e a palavra que o explica.
// Além disso a relação vira chute.
const ALCANCE_PISTA = 90

// Onde cada pista aparece na frase — calculado uma vez por frase e reusado
// por todos os números dela.
function mapearPistas(chave) {
  const marcas = []
  for (const pista of PISTAS_VALOR) {
    for (const termo of pista.termos) {
      let de = chave.indexOf(termo)
      while (de !== -1) {
        marcas.push({ pista, inicio: de, fim: de + termo.length })
        de = chave.indexOf(termo, de + 1)
      }
    }
  }
  return marcas
}

function extrairValores(falas) {
  const achados = []
  for (let idx = 0; idx < falas.length; idx++) {
    const fala = falas[idx]
    // Reunião é pergunta e resposta: "E o custo de vida?" — "Uns R$ 9 mil".
    // O número vem numa fala e o assunto na anterior, então a pergunta de quem
    // conduz entra como contexto de reserva.
    const anterior = idx > 0 ? falas[idx - 1] : null
    const pergunta = anterior && anterior.quem !== fala.quem && /\?/.test(anterior.texto)
      ? mapearPistas(semAcento(anterior.texto)) : []
    const doContexto = pergunta.length > 0
      ? pergunta.reduce((a, b) => (b.inicio > a.inicio ? b : a)).pista : null

    // Numerais falados viram dígito ANTES da extração: "uns quinhentos reais"
    // e "um milhão e meio" passavam batido porque o regex exige dígito.
    const frases = normalizarNumeraisFalados(fala.texto).split(/(?<=[.!?])\s+/)
    for (const frase of frases) {
      // semAcento preserva o comprimento (acento vira base + combinante, e o
      // combinante some), então os índices valem para as duas versões.
      const chave = semAcento(frase)
      const marcas = mapearPistas(chave)
      if (marcas.length === 0 && !doContexto) continue

      RE_VALOR.lastIndex = 0
      let m
      while ((m = RE_VALOR.exec(frase)) !== null) {
        const [bruto, cifrao, numero, mult, sufixo] = m
        if (!cifrao && !mult && !sufixo) continue
        const valor = valorNumerico(numero, mult)
        if (valor == null || valor <= 0) continue

        // a pista mais próxima do número ganha — é ela que o explica
        const inicio = m.index
        const fim = m.index + bruto.length
        let melhor = null
        for (const marca of marcas) {
          const d = marca.fim <= inicio ? inicio - marca.fim
            : marca.inicio >= fim ? marca.inicio - fim : 0
          if (d <= ALCANCE_PISTA && (!melhor || d < melhor.d)) melhor = { ...marca, d }
        }
        // sem pista na própria frase, vale o assunto da pergunta anterior
        const pista = melhor ? melhor.pista : doContexto
        if (!pista) continue
        const [min, max] = FAIXA[pista.campo] ?? [0, Infinity]
        if (valor < min || valor > max) continue

        achados.push({
          campo: pista.campo,
          rotulo: pista.rotulo,
          valor,
          quem: fala.quem,
          trecho: frase.trim().slice(0, 220),
          // dito pelo próprio cliente e com cifrão explícito = mais confiável
          confianca: (cifrao ? 2 : 1) + (fala.papel === 'cliente' ? 1 : 0),
          menciona: bruto.trim(),
        })
      }
    }
  }

  // Um campo único fica com o achado mais confiável (empate: o último dito,
  // porque a conversa costuma corrigir o número no meio do caminho).
  const porCampo = new Map()
  for (const a of achados) {
    if (CAMPO_UNICO.has(a.campo)) {
      const atual = porCampo.get(a.campo)
      if (!atual || a.confianca >= atual.confianca) porCampo.set(a.campo, a)
    } else {
      const atual = porCampo.get(a.campo)
      if (!atual) porCampo.set(a.campo, { ...a, somados: 1 })
      else if (atual.valor !== a.valor) {
        porCampo.set(a.campo, {
          ...atual,
          valor: atual.valor + a.valor,
          somados: (atual.somados ?? 1) + 1,
          trecho: `${atual.trecho} · ${a.trecho}`.slice(0, 300),
        })
      }
    }
  }
  return [...porCampo.values()]
}

// ─── Família ─────────────────────────────────────────────────────────────────
const RE_FILHO_IDADE = /\b(?:meu |minha |o |a )?(filh[oa]s?|men[io]n[ao]s?|crian[çc]as?|garot[oa]s?)\b[^.!?]{0,60}?\b(\d{1,2})\s*(?:anos?)?/gi
const RE_NOME_IDADE = /\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]{2,15})\s+(?:tem|com|de|fez)\s+(\d{1,2})\s*anos?/g
// Palavras que começam frase com maiúscula e não são nome de gente
const NAO_E_NOME = new Set([
  'tenho', 'temos', 'tem', 'sao', 'somos', 'ele', 'ela', 'eles', 'elas',
  'meu', 'minha', 'meus', 'minhas', 'filho', 'filha', 'filhos', 'filhas',
  'crianca', 'criancas', 'menino', 'menina', 'esposa', 'marido', 'hoje',
  'entao', 'agora', 'ja', 'sim', 'nao', 'bom', 'olha', 'acho', 'certo',
  'esse', 'essa', 'este', 'esta', 'isso', 'aqui', 'la', 'com', 'sobre',
])
const RE_LISTA_IDADES = /\bfilh[oa]s?\b[^.!?]{0,40}?\bde\s+(\d{1,2})(?:\s*,\s*(\d{1,2}))?\s*e\s+(\d{1,2})\s*anos?/gi

function extrairFamilia(falas) {
  const texto = falas.map((f) => f.texto).join(' ')
  const chave = semAcento(texto)
  const filhos = new Map()

  const guardar = (nome, idade) => {
    const i = Number(idade)
    if (!Number.isFinite(i) || i < 0 || i > 30) return
    const k = nome ? semAcento(nome) : `idade-${i}`
    if (!filhos.has(k)) filhos.set(k, { nome: nome ?? '', idade: i })
    else if (nome && !filhos.get(k).nome) filhos.get(k).nome = nome
  }

  let m
  RE_LISTA_IDADES.lastIndex = 0
  while ((m = RE_LISTA_IDADES.exec(texto)) !== null) {
    for (const i of [m[1], m[2], m[3]]) if (i) guardar(null, i)
  }
  RE_NOME_IDADE.lastIndex = 0
  while ((m = RE_NOME_IDADE.exec(texto)) !== null) {
    // evita "Natália tem 40 anos de experiência" e nomes de meses
    if (!/(experi[êe]ncia|mercado|empresa|carreira)/i.test(texto.slice(m.index, m.index + 80))) {
      guardar(m[1], m[2])
    }
  }
  RE_FILHO_IDADE.lastIndex = 0
  while ((m = RE_FILHO_IDADE.exec(texto)) !== null) guardar(null, m[2])

  // "a Alice tem 6 e o Lucas 9" — ninguém repete "anos" na segunda criança, e
  // sem essa passagem o Lucas sumia e a Alice virava um filho anônimo de 6.
  // O gatilho é a frase falar de filhos: fora desse contexto, "Alice tem 3"
  // pode ser qualquer coisa.
  for (const frase of texto.split(/(?<=[.!?])\s+/)) {
    if (!/\b(filh[oa]s?|crian[çc]as?|men[io]n[ao]s?|garot[oa]s?)\b/i.test(semAcento(frase))) continue
    const re = /\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]{2,15})\s+(?:tem\s+|com\s+|de\s+|fez\s+)?(\d{1,2})\b(?!\s*(?:mil|reais|anos de (?:experi|casa|empresa)))/g
    let x
    while ((x = re.exec(frase)) !== null) {
      // "Tenho 2 filhos" começa a frase com maiúscula e casaria como nome —
      // verbo e pronome não são nome de criança
      if (NAO_E_NOME.has(semAcento(x[1]))) continue
      guardar(x[1], x[2])
    }
  }

  const estadoCivil = [
    ['Casado(a)', ['sou casad', 'somos casad', 'minha esposa', 'meu marido', 'minha mulher', 'meu esposo']],
    ['União estável', ['uniao estavel', 'moro junto', 'minha companheira', 'meu companheiro']],
    ['Divorciado(a)', ['sou divorciad', 'me divorciei', 'sou separad']],
    ['Viúvo(a)', ['sou viuv', 'fiquei viuv']],
    ['Solteiro(a)', ['sou solteir']],
  ].find(([, termos]) => termos.some((t) => chave.includes(t)))?.[0] ?? null

  const conjuge = texto.match(
    /\b(?:minha (?:esposa|mulher|companheira)|meu (?:marido|esposo|companheiro))(?:,)?\s+(?:se chama\s+|é a\s+|é o\s+|a\s+|o\s+)?([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]{2,15})/)?.[1] ?? null

  // "sou casado", "sou solteiro" e "sou fumante" casavam como profissão
  const NAO_E_PROFISSAO = /^(casad|solteir|divorciad|viuv|separad|fumante|pai|mae|filho|socio|cliente|amigo|meio|bem|muito|uma|obrigad)/i
  const profissao = (() => {
    const re = /\b(?:sou|trabalho como|atuo como)\s+(?:um |uma )?([a-záàâãéêíóôõúç]{4,20}(?:\s+[a-záàâãéêíóôõúç]{3,20})?)/gi
    let m
    while ((m = re.exec(texto)) !== null) {
      if (!NAO_E_PROFISSAO.test(semAcento(m[1]))) return m[1]
    }
    return null
  })()

  // "tenho 40% do capital social" / "sou dono de 30% da empresa"
  const participacao = texto.match(
    /(\d{1,3})(?:,\d)?\s*%\s*(?:d[oa]s?\s+)?(?:capital(?:\s+social)?|empresa|quotas?|sociedade|neg[óo]cio)/i)?.[1]
    ?? texto.match(
      /(?:capital(?:\s+social)?|empresa|quotas?|sociedade)[^.!?]{0,25}?(\d{1,3})(?:,\d)?\s*%/i)?.[1]
    ?? null

  // "Tenho dois filhos, a Alice tem 6" casa nas duas regras e criava um filho
  // anônimo de 6 anos ao lado da Alice. Quem tem nome vence: o anônimo de
  // mesma idade é a mesma criança.
  const todos = [...filhos.values()]
  const idadesComNome = new Set(todos.filter((f) => f.nome).map((f) => f.idade))
  const semDuplicata = todos.filter((f) => f.nome || !idadesComNome.has(f.idade))

  return {
    filhos: semDuplicata.sort((a, b) => a.idade - b.idade),
    estadoCivil,
    conjuge,
    profissao: profissao ? profissao.trim() : null,
    participacaoPJ: participacao != null && Number(participacao) > 0 && Number(participacao) <= 100
      ? Number(participacao) : null,
  }
}

// ─── Perfil: o que decide a venda e não é número ─────────────────────────────
// Uma reunião de seguro de vida carrega muito mais do que renda e patrimônio.
// Idade e tabagismo mudam o prêmio; o seguro que ele já tem muda o argumento;
// quem decide e em quanto tempo muda o follow-up. Nada disso estava sendo
// pescado — a consultora relia a transcrição atrás dessas frases.
//
// Cada achado vem com o trecho que serve de prova: a tela mostra a frase, e a
// consultora confirma antes de qualquer coisa ir para o planejamento.
const ORIGENS_SEGURO = [
  { origem: 'empresa', termos: ['pela empresa', 'da empresa', 'seguro da firma', 'vida em grupo', 'plano da empresa', 'o trabalho paga'],
    alerta: 'Seguro de empresa acaba junto com o emprego — e não acompanha quem sai, se aposenta ou é demitido.' },
  { origem: 'banco', termos: ['pelo banco', 'do banco', 'o gerente vendeu', 'junto com a conta', 'seguro do banco'],
    alerta: 'Seguro de banco costuma ter capital baixo e ser desenhado para o banco, não para a família.' },
  { origem: 'consignado', termos: ['prestamista', 'do financiamento', 'do consignado', 'junto com o emprestimo', 'seguro do imovel'],
    alerta: 'Prestamista cobre o saldo devedor e paga ao CREDOR, não à família — quita a dívida e acaba ali.' },
  { origem: 'individual', termos: ['seguro individual', 'contratei um seguro', 'tenho uma apolice', 'ja tenho um seguro'],
    alerta: null },
]

function extrairPerfil(falas) {
  const doCliente = falas.filter((f) => f.papel === 'cliente')
  const alvo = doCliente.length > 0 ? doCliente : falas
  const bruto = alvo.map((f) => f.texto).join(' ')
  const texto = normalizarNumeraisFalados(bruto)
  const chave = semAcento(texto)

  // devolve a frase em que o termo apareceu, para servir de prova na tela
  const provaDe = (termo) => {
    for (const f of alvo) {
      for (const frase of f.texto.split(/(?<=[.!?])\s+/)) {
        if (semAcento(normalizarNumeraisFalados(frase)).includes(termo)) return frase.trim().slice(0, 220)
      }
    }
    return null
  }
  const achar = (lista) => {
    for (const termo of lista) if (chave.includes(termo)) return { termo, trecho: provaDe(termo) }
    return null
  }

  // ── idade: "tenho 41 anos", "vou fazer 42" ──
  let idade = null
  const mIdade = chave.match(/\b(?:tenho|fiz|faco|completei|estou com)\s+(\d{2})\s*anos?\b/)
    ?? chave.match(/\b(\d{2})\s*anos\s+de\s+idade\b/)
  if (mIdade) {
    const n = Number(mIdade[1])
    if (n >= 18 && n <= 90) idade = { valor: n, trecho: provaDe(mIdade[0]) }
  }

  // ── tabagismo: muda o prêmio de forma relevante ──
  const naoFuma = achar(['nao fumo', 'nunca fumei', 'parei de fumar', 'sou nao fumante'])
  const fuma = naoFuma ? null : achar(['eu fumo', 'sou fumante', 'fumo desde', 'fumo um maco', 'fumo cigarro'])
  const fumante = fuma ? { valor: true, trecho: fuma.trecho }
    : naoFuma ? { valor: false, trecho: naoFuma.trecho } : null

  // ── saúde: o que a seguradora vai perguntar na DPS ──
  const saude = achar([
    'tenho diabetes', 'sou diabetico', 'pressao alta', 'hipertens', 'colesterol alto',
    'ja tive cancer', 'fiz cirurgia', 'tenho depressao', 'faco tratamento', 'tomo remedio',
    'tive um infarto', 'problema no coracao', 'tenho asma', 'ja fui internado',
  ])

  // ── seguros que ele já tem, com a origem ──
  const seguros = []
  for (const o of ORIGENS_SEGURO) {
    const achou = achar(o.termos)
    if (achou) seguros.push({ origem: o.origem, alerta: o.alerta, trecho: achou.trecho })
  }

  // ── quem decide ──
  const decideCasal = achar(['com minha esposa', 'com meu marido', 'a gente decide junto',
    'decidir junto', 'decidimos junto', 'decidimos juntos', 'resolvemos junto', 'falar com minha esposa', 'falar com meu marido', 'nos dois decidimos'])
  const decideSocios = achar(['com meus socios', 'com meu socio', 'levar para a sociedade', 'o conselho decide'])
  const decideSozinho = achar(['quem decide sou eu', 'eu que decido', 'a decisao e minha'])
  const quemDecide = decideSocios ? { valor: 'Ele e os sócios', trecho: decideSocios.trecho }
    : decideCasal ? { valor: 'Ele e o cônjuge, juntos', trecho: decideCasal.trecho }
      : decideSozinho ? { valor: 'Ele sozinho', trecho: decideSozinho.trecho } : null

  // ── prazo de decisão ──
  const prazos = [
    ['Ainda esta semana', ['essa semana', 'ate sexta', 'nos proximos dias', 'ate o fim da semana']],
    ['Até o fim do mês', ['ate o fim do mes', 'esse mes', 'ate o dia 30', 'ainda esse mes']],
    ['Sem prazo definido', ['nao tenho pressa', 'mais pra frente', 'ano que vem', 'depois eu vejo', 'daqui uns meses']],
  ]
  let prazoDecisao = null
  for (const [rotulo, termos] of prazos) {
    const achou = achar(termos)
    if (achou) { prazoDecisao = { valor: rotulo, trecho: achou.trecho }; break }
  }

  // ── orçamento que ele mesmo declarou ──
  let orcamento = null
  const mOrc = texto.match(/\b(?:posso|consigo|daria para|cabe|caberia|penso em|pretendo)\s+(?:pagar|investir|gastar|destinar|separar)\s+(?:uns?\s+|cerca de\s+|ate\s+)?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(mil)?/i)
  if (mOrc) {
    let v = Number(String(mOrc[1]).replace(/\./g, '').replace(',', '.'))
    if (mOrc[2]) v *= 1000
    if (Number.isFinite(v) && v >= 30 && v <= 200_000) orcamento = { valor: v, trecho: provaDe(semAcento(mOrc[0])) }
  }

  // ── por que ele aceitou a conversa ──
  const motivo = achar([
    'meu pai morreu', 'minha mae morreu', 'perdi meu pai', 'perdi minha mae', 'perdi um amigo',
    'um colega faleceu', 'passei por um susto', 'fiquei doente', 'nasceu meu filho',
    'vou ser pai', 'vou ser mae', 'comprei um imovel', 'abri a empresa', 'me separei',
    'inventario do meu pai', 'inventario da minha mae',
  ])

  // ── pais ou irmãos que dependem dele ──
  const outrosDependentes = achar(['ajudo meus pais', 'sustento minha mae', 'sustento meu pai',
    'meus pais dependem', 'cuido da minha mae', 'cuido do meu pai', 'ajudo meu irmao'])

  // ── nº de sócios ──
  let numSocios = null
  const mSocios = chave.match(/\bsomos\s+(\d{1,2})\s+socios?\b/) ?? chave.match(/\b(\d{1,2})\s+socios?\b/)
  if (mSocios) {
    const n = Number(mSocios[1])
    if (n >= 1 && n <= 50) numSocios = { valor: n, trecho: provaDe(mSocios[0]) }
  }

  return {
    idade, fumante, saude, seguros, quemDecide, prazoDecisao,
    orcamento, motivo, outrosDependentes, numSocios,
  }
}

// ─── 4. OBJEÇÕES, SINAIS E COMPROMISSOS ──────────────────────────────────────
// Cada objeção vem com a resposta consultiva — é o que a consultora leva para
// o follow-up, não uma etiqueta solta.
export const OBJECOES = [
  {
    id: 'preco', rotulo: 'Preço / cabe no orçamento', peso: 3,
    termos: ['esta caro', 'ta caro', 'muito caro', 'caro demais', 'pouco caro', 'achei caro', 'e caro',
      'fora do orcamento', 'nao cabe no bolso', 'apertado', 'pesado pro meu bolso', 'valor alto', 'salgado'],
    responder: 'Não discuta o preço: reduza o escopo. Mostre o mesmo plano com o capital menor e o quanto isso custa por dia. Depois pergunte o que ele deixaria de fazer para garantir a faculdade dos filhos.',
  },
  {
    id: 'pensar', rotulo: 'Vou pensar', peso: 3,
    termos: ['vou pensar', 'preciso pensar', 'deixa eu pensar', 'vou analisar', 'me da um tempo', 'depois eu vejo'],
    responder: '"Vou pensar" quase sempre esconde uma dúvida específica. Pergunte: "o que exatamente você quer pensar melhor — o valor, a cobertura ou a seguradora?" e trate só aquilo.',
  },
  {
    id: 'conjuge', rotulo: 'Preciso falar com cônjuge/sócio', peso: 2,
    termos: ['falar com minha esposa', 'falar com meu marido', 'conversar com minha esposa', 'conversar com meu marido', 'falar com meu socio', 'falar com meus socios', 'decidir junto'],
    responder: 'Ótimo sinal — mas não deixe ele levar a conversa sozinho. Ofereça uma call de 15 minutos com os dois, ou mande a proposta pelo link para ele apresentar com o material na tela.',
  },
  {
    id: 'ja_tem', rotulo: 'Já tenho seguro', peso: 2,
    termos: ['ja tenho seguro', 'ja tenho um seguro', 'tenho pela empresa', 'tenho pelo banco', 'seguro do consignado', 'ja sou segurado'],
    responder: 'Peça a apólice atual e faça o comparativo no estudo (campo "Cobertura que já possui"). Seguro de empresa acaba junto com o emprego, e o do banco costuma cobrir só o saldo devedor.',
  },
  {
    id: 'investir', rotulo: 'Prefiro investir', peso: 2,
    termos: ['prefiro investir', 'melhor investir', 'rende mais', 'deixar no cdi', 'no tesouro rende', 'dinheiro parado'],
    responder: 'Concorde: investimento e seguro não competem. Pergunte em quantos anos a aplicação chega no capital do estudo — o seguro entrega esse valor amanhã de manhã, e é justamente o que protege o investimento de ser consumido.',
  },
  {
    id: 'desconfianca', rotulo: 'Desconfiança da seguradora', peso: 3,
    termos: ['seguro nao paga', 'nunca paga', 'dificil receber', 'nao confio', 'e furada', 'sempre tem letra miuda', 'golpe'],
    responder: 'Traga o concreto: DPS preenchida com honestidade, prazo de pagamento em contrato e SUSEP. Se tiver um caso real de sinistro pago na carteira, conte — histórico vale mais que argumento.',
  },
  {
    id: 'sem_urgencia', rotulo: 'Não é prioridade agora', peso: 2,
    termos: ['sou jovem', 'sou saudavel', 'nao preciso agora', 'mais pra frente', 'ano que vem', 'depois eu contrato', 'nao tenho pressa'],
    responder: 'Use o preço da espera: o prêmio sobe com a idade e a saúde de hoje é o melhor ativo dele na análise. Mostre quanto custaria a mesma apólice daqui a cinco anos.',
  },
  {
    id: 'adiar', rotulo: 'Manda por e-mail que eu vejo', peso: 2,
    termos: ['manda por email', 'manda no whatsapp que eu vejo', 'me envia que eu olho', 'depois eu te retorno', 'eu te aviso'],
    responder: 'Mande — pelo link da proposta, que ele abre no celular — mas saia da reunião com data e hora marcadas para o retorno. Sem próximo passo agendado, a proposta esfria.',
  },
]

export const SINAIS_COMPRA = [
  { id: 'como_contrata', rotulo: 'Perguntou como contratar', termos: ['como faco para contratar', 'como funciona a contratacao', 'como e que assina', 'o que preciso fazer', 'quais documentos'] },
  { id: 'quando_vale', rotulo: 'Perguntou quando passa a valer', termos: ['quando comeca a valer', 'a partir de quando', 'quando entra em vigor', 'ja vale', 'tem carencia'] },
  { id: 'forma_pagto', rotulo: 'Perguntou sobre pagamento', termos: ['posso pagar no cartao', 'debito em conta', 'pago anual', 'tem desconto a vista', 'como pago', 'vence dia'] },
  { id: 'exames', rotulo: 'Perguntou sobre exames/DPS', termos: ['preciso fazer exame', 'tem exame', 'declaracao de saude', 'dps'] },
  { id: 'beneficiarios', rotulo: 'Falou de beneficiários', termos: ['quem recebe', 'beneficiario', 'coloco minha esposa', 'coloco meus filhos', 'dividir entre'] },
  { id: 'ajuste', rotulo: 'Quis ajustar o plano', termos: ['e se eu aumentar', 'da pra diminuir', 'e se colocar', 'posso incluir', 'tem como aumentar depois'] },
  { id: 'decisao', rotulo: 'Sinalizou decisão', termos: ['vamos fechar', 'pode fazer', 'topo', 'vou fazer', 'quero contratar', 'me manda o contrato', 'bora'] },
]

// Compromisso é promessa de AÇÃO com destinatário ou prazo. "Vou te fazer
// algumas perguntas" e "vamos falar das coberturas" são condução de reunião,
// não compromisso — por isso a ação precisa estar nesta lista.
const RE_ACAO = /\b(?:mand(?:o|ar|amos)|envi(?:o|ar|amos)|marc(?:o|ar|amos)|agend(?:o|ar|amos)|retorn(?:o|ar)|lig(?:o|ar)|preench(?:o|er)|assin(?:o|ar)|fech(?:o|ar)|contrat(?:o|ar)|cot(?:o|ar)|falar com|conversar com|passo|trago|confirm(?:o|ar))\b/i
const RE_COMPROMISSO = /\b(?:vou|vamos|voc[êe] vai|te |me |fico de|combinamos|marcamos|fica de)\b/i
const RE_PRAZO = /\b(hoje|amanh[ãa]|depois de amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|semana que vem|pr[óo]xima semana|at[ée] (?:sexta|segunda|o fim da semana|amanh[ãa])|dia \d{1,2}|\d{1,2}\/\d{1,2})\b/i

function acharTermos(falas, catalogo, papelAlvo = null) {
  // Numa colagem sem falantes ninguém tem papel. Nesse caso o filtro por papel
  // esconderia todas as objeções, então ele só vale quando há alguém marcado
  // como o falante procurado.
  const filtrar = papelAlvo != null && falas.some((f) => f.papel === papelAlvo)
  const achados = []
  for (const item of catalogo) {
    for (const fala of falas) {
      if (filtrar && fala.papel !== papelAlvo) continue
      const chave = semAcento(fala.texto)
      const termo = item.termos.find((t) => chave.includes(t))
      if (!termo) continue
      // devolve a frase exata em que apareceu, para servir de prova
      const frase = fala.texto.split(/(?<=[.!?])\s+/)
        .find((f) => semAcento(f).includes(termo)) ?? fala.texto
      achados.push({ ...item, trecho: frase.trim().slice(0, 220), quem: fala.quem })
      break
    }
  }
  return achados
}

function extrairCompromissos(falas) {
  const out = []
  for (const fala of falas) {
    for (const frase of fala.texto.split(/(?<=[.!?])\s+/)) {
      const f = frase.trim()
      if (f.length < 12 || f.length > 240) continue
      const chave = semAcento(f)
      if (!RE_COMPROMISSO.test(chave) || !RE_ACAO.test(chave)) continue
      const prazo = f.match(RE_PRAZO)?.[0] ?? null
      out.push({ texto: f, quem: fala.quem, papel: fala.papel, prazo })
    }
  }
  // as mesmas promessas se repetem na despedida
  const vistos = new Set()
  return out.filter((c) => {
    const k = semAcento(c.texto).slice(0, 60)
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  }).slice(0, 10)
}

// ─── Momentos-chave ──────────────────────────────────────────────────────────
// As frases do cliente que valem ser citadas na proposta ("lembra que você
// falou da faculdade da Alice?"). Pontuamos por carga emocional e financeira.
const PESO_MOMENTO = [
  [4, ['medo', 'preocupa', 'preocupado', 'me tira o sono', 'aflito', 'inseguro', 'nunca pensei', 'me assusta']],
  [4, ['faculdade', 'estudo dos meus filhos', 'futuro dos meus filhos', 'educacao dos meus filhos']],
  [3, ['se eu faltar', 'se eu morrer', 'se acontecer algo comigo', 'nao puder trabalhar', 'ficar doente']],
  [3, ['meu pai', 'minha mae', 'perdi', 'faleceu', 'inventario', 'quando ele morreu']],
  [3, ['sonho', 'quero deixar', 'quero garantir', 'meu objetivo', 'penso em']],
  [2, ['minha esposa', 'meu marido', 'meus filhos', 'minha familia', 'depende de mim']],
  [2, ['empresa', 'socio', 'socios', 'negocio']],
]

function momentosChave(falas) {
  const temCliente = falas.some((f) => f.papel === 'cliente')
  const pontuadas = []
  for (const fala of falas) {
    // sem papéis identificados, toda a conversa é candidata
    if (temCliente && fala.papel !== 'cliente') continue
    const frases = fala.texto.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
    for (let i = 0; i < frases.length; i++) {
      const chave = semAcento(frases[i])
      let peso = 0
      for (const [p, termos] of PESO_MOMENTO) if (termos.some((t) => chave.includes(t))) peso += p
      if (peso === 0) continue
      // "Sinceramente, me preocupa." sozinha não diz nada. Uma citação só serve
      // se der para ler na proposta, então frases curtas puxam a vizinha.
      let texto = frases[i]
      for (let j = i + 1; j < frases.length && texto.length < 60; j++) texto += ' ' + frases[j]
      if (texto.length < 40 && i > 0) texto = `${frases[i - 1]} ${texto}`
      if (texto.length < 30 || texto.length > 300) continue
      pontuadas.push({ texto: texto.slice(0, 300), peso, quem: fala.quem })
    }
  }
  // uma citação que engloba a outra não precisa aparecer duas vezes
  const escolhidas = []
  for (const p of pontuadas.sort((a, b) => b.peso - a.peso)) {
    if (escolhidas.some((e) => e.texto.includes(p.texto) || p.texto.includes(e.texto))) continue
    escolhidas.push(p)
    if (escolhidas.length === 5) break
  }
  return escolhidas
}

// ─── 5. COBERTURA DO ROTEIRO ─────────────────────────────────────────────────
// Cada bloco do roteiro consultivo tem marcas de que foi realmente percorrido.
const MARCAS_ROTEIRO = {
  abertura: ['bom dia', 'boa tarde', 'tudo bem', 'obrigad', 'me conta um pouco', 'como voce esta', 'prazer'],
  descoberta: ['renda', 'ganha', 'gasto', 'custo de vida', 'patrimonio', 'divida', 'filhos', 'esposa', 'marido', 'depende de voce', 'trabalha com'],
  dores: ['se a renda parasse', 'se voce nao puder', 'quanto tempo', 'padrao de vida', 'inventario', 'itcmd', 'travado', 'imposto', 'imagina que'],
  educacao: ['invalidez', 'doencas graves', 'doenca grave', 'dit', 'incapacidade', 'internacao', 'funeral', 'morte acidental', 'fratura', 'paga em vida', 'cobertura'],
  solucao: ['estudo', 'proposta', 'capital', 'apolice', 'plano', 'importancia segurada', 'te mostrar', 'slide'],
  fechamento: ['proximo passo', 'declaracao de saude', 'dps', 'contratar', 'assinar', 'comecar', 'te mando o link', 'marcar'],
}

function coberturaRoteiro(falas) {
  const chave = semAcento(falas.map((f) => f.texto).join(' '))
  return BLOCOS_ROTEIRO.map((b) => {
    const marcas = MARCAS_ROTEIRO[b.id] ?? []
    const achou = marcas.filter((t) => chave.includes(t))
    const pct = marcas.length ? Math.round((achou.length / marcas.length) * 100) : 0
    // 2 marcas já indicam que o assunto foi tocado; a régua não precisa ser dura
    const cobriu = achou.length >= 2
    return { id: b.id, titulo: b.titulo, objetivo: b.objetivo, pct: Math.min(pct * 2, 100), cobriu, achou }
  })
}

// ─── ANÁLISE COMPLETA ────────────────────────────────────────────────────────
export function analisarTranscricao(texto, opcoes = {}) {
  const cru = String(texto ?? '')
  const falasBrutas = separarFalas(cru)
  if (falasBrutas.length === 0) return null

  const papel = classificarFalantes(falasBrutas, opcoes)
  const falas = falasBrutas.map((f) => ({ ...f, papel: f.quem ? papel[f.quem] ?? null : null }))

  // ── quem falou quanto ──
  const porFalante = new Map()
  for (const f of falas) {
    const nome = f.quem ?? 'Sem identificação'
    const atual = porFalante.get(nome) ?? { nome, papel: f.papel, palavras: 0, falas: 0, perguntas: 0 }
    atual.palavras += palavras(f.texto)
    atual.falas += 1
    atual.perguntas += (f.texto.match(/\?/g) ?? []).length
    porFalante.set(nome, atual)
  }
  const totalPalavras = [...porFalante.values()].reduce((s, x) => s + x.palavras, 0) || 1
  const falantes = [...porFalante.values()]
    .map((x) => ({ ...x, pct: Math.round((x.palavras / totalPalavras) * 100) }))
    .sort((a, b) => b.palavras - a.palavras)

  const doCliente = falantes.filter((x) => x.papel === 'cliente')
  const daConsultora = falantes.filter((x) => x.papel === 'consultora')
  const pctCliente = doCliente.reduce((s, x) => s + x.pct, 0)
  const perguntasConsultora = daConsultora.reduce((s, x) => s + x.perguntas, 0)

  const tempos = falas.map((f) => f.t).filter((t) => t != null)
  const duracaoMin = tempos.length >= 2
    ? Math.max(Math.round((Math.max(...tempos) - Math.min(...tempos)) / 60), 0) : null

  // ── o que a conversa revelou ──
  const valores = extrairValores(falas)
  const familia = extrairFamilia(falas)
  const perfil = extrairPerfil(falas)
  const objecoes = acharTermos(falas, OBJECOES, 'cliente')
  const sinais = acharTermos(falas, SINAIS_COMPRA, 'cliente')
  const compromissos = extrairCompromissos(falas)
  const roteiro = coberturaRoteiro(falas)
  const momentos = momentosChave(falas)

  // ── nota da reunião ──
  // Quatro dimensões, cada uma valendo 25 pontos. É diagnóstico de condução,
  // não julgamento: cada nota baixa vem com o que fazer diferente.
  const blocosCobertos = roteiro.filter((r) => r.cobriu).length
  const notaRoteiro = Math.round((blocosCobertos / roteiro.length) * 25)
  // o alvo é o cliente falar entre 50% e 70% do tempo
  const notaEscuta = pctCliente >= 50 ? 25
    : pctCliente >= 40 ? 20 : pctCliente >= 30 ? 14 : pctCliente >= 20 ? 8 : 3
  const notaDescoberta = Math.min(valores.length * 5 + (familia.filhos.length > 0 ? 5 : 0), 25)
  // Avanço não é só o cliente perguntando sobre carência. Uma reunião que sai
  // com próximo passo assumido — e melhor ainda, com data — avançou, mesmo que
  // ele não tenha feito nenhuma pergunta de compra. Antes esse caso tirava 7
  // de 25 e punha uma reunião bem conduzida em nota baixa sem motivo.
  const temPrazoMarcado = compromissos.some((c) => c.prazo)
  const fechamentoCoberto = roteiro.some((r) => r.id === 'fechamento' && r.cobriu)
  const notaAvanco = Math.min(
    (compromissos.length > 0 ? 10 : 0)
    + (temPrazoMarcado ? 5 : 0)
    + (fechamentoCoberto ? 4 : 0)
    + sinais.length * 4, 25)
  const nota = notaRoteiro + notaEscuta + notaDescoberta + notaAvanco

  const pesoObjecoes = objecoes.reduce((s, o) => s + o.peso, 0)
  const temperatura = sinais.length >= 3 && pesoObjecoes <= 3 ? 'quente'
    : sinais.length >= 1 || pesoObjecoes <= 4 ? 'morna' : 'fria'

  // ── recomendações acionáveis ──
  const recomendacoes = []
  if (pctCliente < 40) {
    recomendacoes.push(`O cliente falou ${pctCliente}% do tempo. Numa reunião consultiva o alvo é 50–70%: troque afirmações por perguntas abertas e segure o silêncio depois de perguntar.`)
  }
  if (perguntasConsultora < 8) {
    recomendacoes.push(`Foram ${perguntasConsultora} perguntas na reunião inteira. As melhores descobertas vêm de 15 a 20 — use o bloco Descoberta do roteiro como lista de apoio.`)
  }
  for (const r of roteiro.filter((x) => !x.cobriu)) {
    recomendacoes.push(`Bloco "${r.titulo}" não apareceu na conversa. ${r.objetivo}`)
  }
  if (valores.length === 0) {
    recomendacoes.push('Nenhum número foi levantado. Sem renda, custo de vida e patrimônio o estudo não se sustenta — retome pelo bloco Descoberta.')
  }
  if (compromissos.length === 0) {
    recomendacoes.push('A reunião terminou sem próximo passo combinado. Ligue hoje e agende a data de retorno: proposta sem data marcada esfria em 72 horas.')
  }
  if (objecoes.length > 0) {
    recomendacoes.push(`${objecoes.length} objeção(ões) na mesa: ${objecoes.map((o) => o.rotulo).join(', ')}. As respostas sugeridas estão logo abaixo — leve-as para o follow-up.`)
  }

  return {
    versao: 2,
    geradoEm: new Date().toISOString(),
    falas: falas.length,
    palavras: totalPalavras,
    duracaoMin,
    falantes,
    pctCliente,
    perguntasConsultora,
    valores,
    familia,
    perfil,
    objecoes,
    sinais,
    compromissos,
    momentos,
    roteiro,
    nota,
    notas: { roteiro: notaRoteiro, escuta: notaEscuta, descoberta: notaDescoberta, avanco: notaAvanco },
    temperatura,
    recomendacoes,
  }
}

// ─── RESUMO EXECUTIVO ────────────────────────────────────────────────────────
// O texto que a consultora cola nas notas da reunião ou manda para o assessor.
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// O que o estudo precisa e a reunião não trouxe. É a ponte que faltava entre a
// transcrição e o planejamento: em vez de a consultora reler tudo procurando
// buracos, a lista de perguntas da próxima conversa já sai pronta.
export function perguntasQueFaltaram(a) {
  if (!a) return []
  const tem = (campo) => a.valores.some((v) => v.campo === campo)
  const p = a.perfil ?? {}
  const q = []

  if (!tem('renda_mensal')) q.push('Quanto entra por mês, no total? (renda é a base de quase todo o estudo)')
  if (!tem('custo_vida_mensal')) q.push('Quanto a família gasta por mês para manter o padrão de vida?')
  if (!tem('patrimonio_imoveis') && !tem('patrimonio_total')) {
    q.push('O que você já construiu de patrimônio — imóveis, aplicações, participação em empresa?')
  }
  if (!tem('dividas_total')) q.push('Existe financiamento, consignado ou dívida que a família herdaria?')
  if (!tem('previdencia_saldo')) q.push('Tem previdência privada? Se sim, VGBL ou PGBL — muda o imposto na entrega.')
  if (a.familia.filhos.length === 0) q.push('Quem depende dessa renda hoje? Filhos, e com que idades?')
  if (!a.familia.estadoCivil) q.push('Você é casado? Em que regime de bens? (a meação muda a base do ITCMD)')
  if (!p.idade) q.push('Quantos anos você tem? (o prêmio e o prazo do produto dependem disso)')
  if (!p.fumante) q.push('Você fuma, ou fumou nos últimos 12 meses? (muda o prêmio de forma relevante)')
  if (!p.seguros || p.seguros.length === 0) {
    q.push('Você já tem algum seguro? De quem é — empresa, banco, individual? (o da empresa acaba com o emprego)')
  }
  if (!p.quemDecide) q.push('Quem decide uma contratação dessas junto com você?')
  if (!p.prazoDecisao && a.compromissos.length === 0) q.push('Em quanto tempo você pretende decidir?')
  if (!p.motivo) q.push('O que fez você aceitar essa conversa agora? (a resposta vira o argumento da proposta)')

  return q.slice(0, 8)
}

// Versão curta e humana para MANDAR AO CLIENTE. O resumo executivo é interno —
// tem nota de condução, objeções e estratégia, e nada disso pode chegar nele.
// Este aqui é o "combinamos isso" que fecha a reunião por escrito.
export function resumoParaCliente(a, { nomeCliente = '', primeiroNome } = {}) {
  if (!a) return ''
  const nome = primeiroNome ?? String(nomeCliente).split(' ')[0] ?? ''
  const L = []
  L.push(`${nome ? `${nome}, ` : ''}obrigada pela conversa de hoje. Resumindo o que combinamos:`)
  L.push('')

  if (a.valores.length > 0) {
    L.push('O retrato que você me passou:')
    for (const v of a.valores.slice(0, 6)) L.push(`• ${v.rotulo}: ${brl(v.valor)}`)
    L.push('')
  }
  const f = a.familia
  if (f.filhos.length > 0) {
    L.push(`Família: ${f.filhos.map((x) => `${x.nome || 'filho(a)'} (${x.idade} anos)`).join(', ')}`
      + (f.conjuge ? ` · cônjuge ${f.conjuge}` : ''))
    L.push('')
  }
  const meus = a.compromissos.filter((c) => c.papel !== 'cliente')
  const dele = a.compromissos.filter((c) => c.papel === 'cliente')
  if (meus.length > 0) {
    L.push('Fico de:')
    for (const c of meus.slice(0, 4)) L.push(`• ${c.texto}${c.prazo ? ` (${c.prazo})` : ''}`)
    L.push('')
  }
  if (dele.length > 0) {
    L.push('Você ficou de:')
    for (const c of dele.slice(0, 4)) L.push(`• ${c.texto}${c.prazo ? ` (${c.prazo})` : ''}`)
    L.push('')
  }
  L.push('Qualquer dúvida antes disso, é só me chamar.')
  return L.join('\n')
}

export function resumoExecutivo(a, { nomeCliente = 'o cliente', data } = {}) {
  if (!a) return ''
  const L = []
  const quando = data ? new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')

  L.push(`RESUMO DA REUNIÃO — ${nomeCliente} · ${quando}`)
  L.push(`Nota de condução: ${a.nota}/100 · oportunidade ${a.temperatura}`
    + (a.duracaoMin ? ` · ${a.duracaoMin} min` : '')
    + ` · o cliente falou ${a.pctCliente}% do tempo`)

  if (a.momentos.length > 0) {
    L.push('', 'O QUE O CLIENTE DISSE (use na proposta)')
    for (const m of a.momentos) L.push(`  • "${m.texto}"`)
  }

  if (a.valores.length > 0) {
    L.push('', 'NÚMEROS LEVANTADOS')
    for (const v of a.valores) L.push(`  • ${v.rotulo}: ${brl(v.valor)}`)
  }

  const f = a.familia
  const pedacosFamilia = [
    f.estadoCivil,
    f.conjuge ? `cônjuge ${f.conjuge}` : null,
    f.profissao ? `profissão: ${f.profissao}` : null,
    f.filhos.length ? `filhos: ${f.filhos.map((x) => `${x.nome || 'filho(a)'} (${x.idade})`).join(', ')}` : null,
  ].filter(Boolean)
  if (pedacosFamilia.length) L.push('', `FAMÍLIA: ${pedacosFamilia.join(' · ')}`)

  const p = a.perfil ?? {}
  const pedacosPerfil = [
    p.idade ? `${p.idade.valor} anos` : null,
    p.fumante ? (p.fumante.valor ? 'FUMANTE' : 'não fumante') : null,
    p.saude ? `saúde: ${p.saude.termo} (confirmar na DPS)` : null,
    p.outrosDependentes ? 'ajuda os pais financeiramente' : null,
    p.numSocios ? `${p.numSocios.valor} sócios` : null,
  ].filter(Boolean)
  if (pedacosPerfil.length) L.push('', `PERFIL: ${pedacosPerfil.join(' · ')}`)

  if (p.motivo) L.push('', `POR QUE ELE ACEITOU A CONVERSA: "${p.motivo.trecho ?? p.motivo.termo}"`)

  if (p.seguros?.length) {
    L.push('', 'O QUE ELE JÁ TEM (e por que não basta)')
    for (const seg of p.seguros) {
      L.push(`  • ${seg.origem}: "${seg.trecho ?? ''}"`)
      if (seg.alerta) L.push(`    → ${seg.alerta}`)
    }
  }

  const decisao = [
    p.quemDecide ? `decide: ${p.quemDecide.valor}` : null,
    p.prazoDecisao ? `prazo: ${p.prazoDecisao.valor}` : null,
    p.orcamento ? `orçamento declarado: ${brl(p.orcamento.valor)}/mês` : null,
  ].filter(Boolean)
  if (decisao.length) L.push('', `DECISÃO: ${decisao.join(' · ')}`)

  if (a.objecoes.length > 0) {
    L.push('', 'OBJEÇÕES E COMO RESPONDER')
    for (const o of a.objecoes) {
      L.push(`  • ${o.rotulo} — "${o.trecho}"`)
      L.push(`    → ${o.responder}`)
    }
  }

  if (a.sinais.length > 0) {
    L.push('', `SINAIS DE COMPRA: ${a.sinais.map((s) => s.rotulo).join(' · ')}`)
  }

  if (a.compromissos.length > 0) {
    L.push('', 'COMPROMISSOS ASSUMIDOS')
    for (const c of a.compromissos) L.push(`  • ${c.texto}${c.prazo ? ` [${c.prazo}]` : ''}`)
  }

  const faltando = a.roteiro.filter((r) => !r.cobriu)
  if (faltando.length > 0) {
    L.push('', `NÃO FOI COBERTO: ${faltando.map((r) => r.titulo).join(' · ')}`)
  }

  // A ponte com o estudo: o que o planejamento ainda precisa e a reunião não
  // trouxe. É a lista de perguntas da próxima conversa, pronta.
  const perguntas = perguntasQueFaltaram(a)
  if (perguntas.length > 0) {
    L.push('', 'O QUE AINDA FALTA PERGUNTAR')
    for (const q of perguntas) L.push(`  • ${q}`)
  }

  if (a.recomendacoes.length > 0) {
    L.push('', 'PARA A PRÓXIMA CONVERSA')
    for (const r of a.recomendacoes) L.push(`  • ${r}`)
  }

  return L.join('\n')
}

// Campos que a análise consegue devolver para o planejamento, com o rótulo que
// aparece na tela de conferência.
export const CAMPOS_APLICAVEIS = Object.fromEntries(
  PISTAS_VALOR.map((p) => [p.campo, p.rotulo]))
