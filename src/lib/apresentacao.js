// ─────────────────────────────────────────────────────────────────────────────
// O MOTOR DA APRESENTAÇÃO — o que a caneta escreve e o que a reunião simula.
//
// A consultora apresenta pelo iPad, compartilhando a tela na reunião. Antes
// disso a proposta era um deck: bonito, correto e mudo. Ela passava o slide, o
// cliente assistia, e a conversa acontecia apesar da tela.
//
// Este arquivo é a parte da apresentação que NÃO depende de navegador: o
// formato do traço, a simplificação, a borracha, a comparação que decide se há
// algo para guardar, e as alavancas da simulação ao vivo. Fica aqui porque é
// exatamente o que precisa de teste — o resto é pixel.
//
// ── Três decisões que valem o arquivo inteiro ────────────────────────────────
//
// 1. O TRAÇO É VETOR, NÃO IMAGEM.
//    Guardar um PNG por slide seria mais simples e estaria errado: uma imagem
//    de iPad em pé fica torta no computador, pesa centenas de KB por slide,
//    não deixa apagar UM traço, e não sobrevive a um slide que muda de altura.
//    O traço é uma lista de pontos, e cada ponto é uma fração do slide.
//
// 2. AS COORDENADAS SÃO RELATIVAS (0 a 1), NUNCA PIXELS.
//    O mesmo círculo feito no iPad deitado aparece no lugar certo no iPad em
//    pé, no computador dela e no celular do cliente que abre o link depois.
//    Pixel seria o desenho de um aparelho só.
//
// 3. A PRESSÃO ENTRA NO PONTO.
//    Um traço de espessura constante denuncia na hora que aquilo não é uma
//    caneta de verdade. A Apple Pencil manda pressão em cada evento; o ponto
//    guarda (x, y, pressão) e a espessura acompanha a mão.
//
// O laser NÃO passa por aqui: ele apaga sozinho em menos de um segundo e nunca
// vira traço. É gesto, não anotação.
// ─────────────────────────────────────────────────────────────────────────────

// ── As tintas ────────────────────────────────────────────────────────────────
// As quatro coloridas foram validadas no validador de paleta da skill dataviz
// (`#d96527,#1272a8,#0e9f6e,#a51e42`, modo claro, todos os pares): TODAS PASSAM
// — banda de luminosidade, croma, separação sob daltonismo (pior par ΔE 9.7
// deutan) e contraste ≥ 3:1 sobre o fundo claro dos slides.
//
// A tinta escura fica FORA da paleta categórica de propósito: ela não é uma
// série, é caneta de escrever. O critério dela é contraste de texto (≈ 14:1
// sobre branco), não distinção entre cores.
export const TINTAS = [
  { id: 'tinta', cor: '#1e293b', rotulo: 'Escrever' },
  { id: 'laranja', cor: '#d96527', rotulo: 'Destacar' },
  { id: 'vermelho', cor: '#a51e42', rotulo: 'O que sai' },
  { id: 'azul', cor: '#1272a8', rotulo: 'Marcar' },
  { id: 'verde', cor: '#0e9f6e', rotulo: 'O que fica' },
]

export const COR_LASER = '#e11d48'

// Espessura base, em fração da menor dimensão do slide. Relativa pelo mesmo
// motivo dos pontos: um traço de 3px no iPad vira um fio invisível numa TV.
export const CALIBRES = {
  caneta: 0.0032,
  seta: 0.0034,
  marcador: 0.020,
}

// Fino para escrever um número no meio do texto, grosso para circular um
// título de longe. Um calibre só serve mal aos dois — e trocar de espessura é
// o segundo pedido de quem desenha, logo depois de trocar de cor.
export const ESPESSURAS = [
  { id: 'fino', fator: 0.62, rotulo: 'Fino' },
  { id: 'medio', fator: 1, rotulo: 'Médio' },
  { id: 'grosso', fator: 1.75, rotulo: 'Grosso' },
]

// O marcador é grifa-texto: nib largo, translúcido e em `multiply`, para o
// texto continuar legível por baixo. Se fosse opaco, grifar seria apagar.
export const OPACIDADE_MARCADOR = 0.32

// A seta guarda só as duas pontas: ela nasce reta e continua reta em qualquer
// tela. Desenhar uma seta à mão livre no iPad sai torta e a ponta nunca fecha
// — e "daqui vai para cá" é meia conversa de reunião.
export const TIPOS_TRACO = ['caneta', 'marcador', 'seta']

// ── Geometria ────────────────────────────────────────────────────────────────

const trava = (v, min, max) => (v < min ? min : v > max ? max : v)
const arred = (v, casas) => Math.round(v * 10 ** casas) / 10 ** casas

// Fração do slide em que o dedo/caneta está. Fora da borda é grampeado em vez
// de descartado: quem risca até a margem quer o traço até a margem.
export function pontoRelativo(clienteX, clienteY, retangulo) {
  const { left = 0, top = 0, width = 0, height = 0 } = retangulo ?? {}
  if (!(width > 0) || !(height > 0)) return null
  return {
    x: trava((clienteX - left) / width, 0, 1),
    y: trava((clienteY - top) / height, 0, 1),
  }
}

// A Apple Pencil manda pressão real (0..1). Mouse e dedo mandam 0.5 fixo — ou
// 0, que é o que alguns navegadores enviam quando não sabem. Um 0 virando
// espessura 0 sumiria com o traço inteiro, então vira meio-termo.
export function pressaoDe(pressao, tipoPonteiro) {
  if (tipoPonteiro === 'pen' && pressao > 0) return trava(pressao, 0.05, 1)
  return 0.5
}

// Espessura do ponto. A caneta responde à pressão (de 45% a 145% do calibre);
// o marcador é nib rígido — grifa-texto não afina quando a mão alivia.
export function larguraDoPonto(tipo, calibre, pressao) {
  if (tipo === 'marcador') return calibre
  return calibre * (0.45 + pressao)
}

// ── Simplificação (Ramer–Douglas–Peucker) ────────────────────────────────────
// Um traço de dois segundos chega com 300+ pontos, e 90% deles estão em cima
// da reta que os vizinhos já descrevem. Sem simplificar, um slide anotado vira
// dezenas de KB de JSON que atravessam a rede a cada abertura da proposta.
// O epsilon é relativo ao slide: 0,0012 é meio pixel numa tela de 400px de
// altura — a olho nu, o traço simplificado é o mesmo traço.
export const EPSILON_PADRAO = 0.0012

function distanciaDaReta(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const norma = dx * dx + dy * dy
  if (norma === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = trava(((p.x - a.x) * dx + (p.y - a.y) * dy) / norma, 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function simplificar(pontos, epsilon = EPSILON_PADRAO) {
  if (!Array.isArray(pontos) || pontos.length <= 2) return pontos ?? []
  // Pilha explícita em vez de recursão: um traço longo demais estourava a
  // pilha do navegador justamente na frente do cliente.
  const manter = new Uint8Array(pontos.length)
  manter[0] = 1
  manter[pontos.length - 1] = 1
  const pilha = [[0, pontos.length - 1]]
  while (pilha.length) {
    const [ini, fim] = pilha.pop()
    let pior = -1
    let piorD = epsilon
    for (let i = ini + 1; i < fim; i++) {
      const d = distanciaDaReta(pontos[i], pontos[ini], pontos[fim])
      if (d > piorD) { piorD = d; pior = i }
    }
    if (pior > 0) {
      manter[pior] = 1
      pilha.push([ini, pior], [pior, fim])
    }
  }
  return pontos.filter((_, i) => manter[i])
}

// ── O traço guardado ─────────────────────────────────────────────────────────
// Formato compacto e explícito, o mesmo que a migração 023 documenta:
//   { t: tipo, c: cor, l: calibre, p: [x, y, pressão, x, y, pressão, …] }
// Nomes de uma letra porque isto viaja no jsonb e é lido por máquina; quem lê
// no banco tem o comentário da coluna e este arquivo.

export function montarTraco({ tipo, cor, calibre, pontos }) {
  // A seta descarta o meio do gesto de propósito: vale onde começou e onde
  // terminou. Guardar o caminho da mão faria uma seta tremida.
  if (tipo === 'seta') {
    if (!Array.isArray(pontos) || pontos.length === 0) return null
    const a = pontos[0]
    const b = pontos[pontos.length - 1]
    // uma seta de comprimento zero é um toque acidental, não um gesto
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.01) return null
    return {
      t: 'seta', c: cor, l: calibre,
      p: [arred(a.x, 4), arred(a.y, 4), 0.5, arred(b.x, 4), arred(b.y, 4), 0.5],
    }
  }
  const simples = simplificar(pontos)
  if (simples.length === 0) return null
  // Um toque sem arrasto é um ponto só: vira um pinguinho de tinta, que é o
  // que a caneta faz de verdade. Duplicar o ponto dá ao desenhista um segmento
  // degenerado que o traçado sabe arredondar.
  const usados = simples.length === 1 ? [simples[0], simples[0]] : simples
  const p = []
  for (const pt of usados) {
    p.push(arred(pt.x, 4), arred(pt.y, 4), arred(pt.pressao ?? 0.5, 2))
  }
  return { t: TIPOS_TRACO.includes(tipo) ? tipo : 'caneta', c: cor, l: calibre, p }
}

// Percorre os pontos de um traço guardado sem alocar objeto por ponto — isto
// roda a cada quadro do desenho ao vivo.
export function pontosDoTraco(traco) {
  const p = traco?.p
  if (!Array.isArray(p)) return []
  const out = []
  for (let i = 0; i + 1 < p.length; i += 3) {
    out.push({ x: p[i], y: p[i + 1], pressao: p[i + 2] ?? 0.5 })
  }
  return out
}

// ── A borracha ───────────────────────────────────────────────────────────────
// Apaga o TRAÇO inteiro que ela encostou, não os pixels por baixo. Num quadro
// branco de reunião é o que se quer: ela riscou o número errado, encosta e o
// risco some — sem deixar meio risco na tela nem exigir mira de cirurgião.
export function tracoAlcancado(traco, x, y, raio) {
  const pts = pontosDoTraco(traco)
  if (pts.length === 0) return false
  const alvo = { x, y }
  if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].y - y) <= raio
  for (let i = 1; i < pts.length; i++) {
    if (distanciaDaReta(alvo, pts[i - 1], pts[i]) <= raio) return true
  }
  return false
}

export function apagarEm(tracos, x, y, raio) {
  if (!Array.isArray(tracos) || tracos.length === 0) return tracos ?? []
  // De trás para frente: apaga primeiro o que está por cima, que é o que ela
  // enxerga no lugar em que encostou.
  for (let i = tracos.length - 1; i >= 0; i--) {
    if (tracoAlcancado(tracos[i], x, y, raio)) {
      return [...tracos.slice(0, i), ...tracos.slice(i + 1)]
    }
  }
  return tracos
}

// ── O mapa de anotações ──────────────────────────────────────────────────────
// { 'sucessao': [traço, traço], 'cruzamento': [traço] }
// A chave é o NOME do slide, nunca a posição: um cliente que ganha o capítulo
// da empresa empurraria todos os índices, e o círculo do déficit apareceria no
// capítulo errado — pior do que não ter anotação nenhuma.

// O que vem do banco é jsonb: pode ser qualquer coisa, inclusive o resultado
// de uma versão futura do formato. Nada aqui confia na forma — um traço torto
// não pode derrubar a proposta na frente do cliente.
export function sanitizarAnotacoes(bruto) {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {}
  const limpo = {}
  for (const [slide, tracos] of Object.entries(bruto)) {
    if (!Array.isArray(tracos)) continue
    const bons = tracos.filter((t) => (
      t && typeof t === 'object'
      && Array.isArray(t.p) && t.p.length >= 6 && t.p.length % 3 === 0
      && t.p.every((v) => Number.isFinite(v))
      && typeof t.c === 'string'
    )).map((t) => ({
      t: TIPOS_TRACO.includes(t.t) ? t.t : 'caneta',
      c: t.c,
      l: Number.isFinite(t.l) && t.l > 0 ? t.l : CALIBRES.caneta,
      p: t.p,
    }))
    if (bons.length > 0) limpo[slide] = bons
  }
  return limpo
}

export function comTraco(anotacoes, slide, traco) {
  if (!traco) return anotacoes
  return { ...anotacoes, [slide]: [...(anotacoes[slide] ?? []), traco] }
}

export function semUltimoTraco(anotacoes, slide) {
  const atuais = anotacoes[slide] ?? []
  if (atuais.length === 0) return anotacoes
  const restantes = atuais.slice(0, -1)
  return comTracos(anotacoes, slide, restantes)
}

export function comTracos(anotacoes, slide, tracos) {
  const copia = { ...anotacoes }
  if (!tracos || tracos.length === 0) delete copia[slide]
  else copia[slide] = tracos
  return copia
}

export function contarTracos(anotacoes) {
  if (!anotacoes) return 0
  return Object.values(anotacoes).reduce((s, t) => s + (Array.isArray(t) ? t.length : 0), 0)
}

export function slidesAnotados(anotacoes) {
  if (!anotacoes) return []
  return Object.keys(anotacoes).filter((k) => (anotacoes[k] ?? []).length > 0)
}

// Serve à pergunta do fim da reunião: "guardar ou descartar?". Ela só é feita
// quando há de fato diferença entre o que está na tela e o que está no banco —
// perguntar sem motivo treina a consultora a responder no automático.
export function anotacoesIguais(a, b) {
  const ka = slidesAnotados(a).sort()
  const kb = slidesAnotados(b).sort()
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false
  return ka.every((k) => {
    const ta = a[k]
    const tb = b[k]
    if (ta.length !== tb.length) return false
    return ta.every((t, i) => t.t === tb[i].t && t.c === tb[i].c
      && t.p.length === tb[i].p.length && t.p.every((v, j) => v === tb[i].p[j]))
  })
}

// ── Desfazer e refazer ───────────────────────────────────────────────────────
// A primeira versão desfazia tirando o último traço do capítulo. Parecia
// suficiente e não era: a BORRACHA não tinha volta. Ela encostava sem querer
// num traço que sustentava o argumento e ele ia embora para sempre, no meio da
// reunião. Um histórico de estados desfaz qualquer coisa — traço, borracha,
// "limpar o capítulo" — e ainda deixa refazer.
//
// Guarda o mapa inteiro a cada passo. São objetos pequenos (um traço
// simplificado tem poucas dezenas de números) e a clareza vale muito mais do
// que a memória economizada por um histórico de operações invertíveis.
export const LIMITE_HISTORICO = 60

export function novoHistorico(inicial = {}) {
  return { pilha: [inicial], pos: 0 }
}

export function agora(h) {
  return h?.pilha?.[h.pos] ?? {}
}

// `substituir` existe para a borracha: arrastá-la apaga vários traços em
// sequência, e cada um viraria um passo de desfazer. Um arrasto é UM passo.
export function registrar(h, anotacoes, { substituir = false } = {}) {
  if (substituir && h.pos >= 0) {
    const pilha = h.pilha.slice(0, h.pos + 1)
    pilha[h.pos] = anotacoes
    return { pilha, pos: h.pos }
  }
  // qualquer passo novo descarta o que estava adiante — é o que todo editor faz
  const pilha = [...h.pilha.slice(0, h.pos + 1), anotacoes]
  if (pilha.length > LIMITE_HISTORICO) {
    return { pilha: pilha.slice(pilha.length - LIMITE_HISTORICO), pos: LIMITE_HISTORICO - 1 }
  }
  return { pilha, pos: pilha.length - 1 }
}

export function podeDesfazer(h) { return (h?.pos ?? 0) > 0 }
export function podeRefazer(h) { return (h?.pos ?? 0) < (h?.pilha?.length ?? 1) - 1 }
export function desfazerHist(h) { return podeDesfazer(h) ? { ...h, pos: h.pos - 1 } : h }
export function refazerHist(h) { return podeRefazer(h) ? { ...h, pos: h.pos + 1 } : h }

// ── Capítulos pulados ────────────────────────────────────────────────────────
// Nem todo cliente merece o deck inteiro. Um solteiro sem filhos não precisa
// do capítulo de sucessão, e passar por ele "só porque está no roteiro" é
// exatamente o que torna a apresentação chata. Ela desliga o capítulo no
// índice e a navegação passa por cima — sem apagar nada do estudo.
export function proximoCapitulo(indice, direcao, total, pulados) {
  if (total <= 0) return 0
  let i = indice + direcao
  while (i > 0 && i < total - 1 && pulados?.has(i)) i += direcao
  return trava(i, 0, total - 1)
}

// ── A simulação ao vivo ──────────────────────────────────────────────────────
// O cliente pergunta "e se fosse mil e duzentos?" e hoje a resposta é "eu te
// mando depois". Com as alavancas, ela mexe no número na frente dele e a
// proposta inteira se recalcula — capital, gráfico, comparador, tudo.
//
// E NADA DISSO É GRAVADO, de propósito. O planejamento continua sendo a fonte
// da verdade: um número mexido no calor da conversa não pode virar o estudo
// sem ela decidir isso na aba Planejamento, com calma. A simulação é uma
// pergunta em voz alta, não uma edição.
export const ALAVANCAS = [
  {
    campo: 'premio_estimado', rotulo: 'Prêmio mensal', curto: 'Prêmio', prefixo: 'R$',
    passo: 50, min: 0, max: 100000,
    ajuda: 'A pergunta mais comum da reunião: "e se fosse um pouco menos?"',
  },
  {
    campo: 'renda_mensal', rotulo: 'Renda mensal', curto: 'Renda', prefixo: 'R$',
    passo: 1000, min: 0, max: 1000000,
    ajuda: 'Muda o capital recomendado inteiro — é a base de quase toda conta.',
  },
  {
    campo: 'custo_vida_mensal', rotulo: 'Custo de vida da família', curto: 'Custo de vida', prefixo: 'R$',
    passo: 500, min: 0, max: 1000000,
    ajuda: 'Quanto a casa precisa por mês para seguir de pé sem a renda dele.',
  },
  {
    campo: 'anos_protecao', rotulo: 'Anos de proteção', curto: 'Proteção', sufixo: 'anos',
    passo: 1, min: 1, max: 60,
    ajuda: 'Por quantos anos a família precisa desse padrão garantido.',
  },
]

const CAMPOS_ALAVANCA = new Set(ALAVANCAS.map((a) => a.campo))

export function simulacaoAtiva(simulacao) {
  return !!simulacao && Object.keys(simulacao).length > 0
}

// O plano simulado nunca é salvo: ele existe só entre a alavanca e o cálculo.
export function aplicarSimulacao(plano, simulacao) {
  if (!plano || !simulacaoAtiva(simulacao)) return plano
  const simulado = { ...plano }
  for (const [campo, valor] of Object.entries(simulacao)) {
    if (!CAMPOS_ALAVANCA.has(campo)) continue
    if (!Number.isFinite(Number(valor))) continue
    simulado[campo] = Number(valor)
  }
  return simulado
}

// Para a etiqueta que fica na tela enquanto a simulação está ligada — o
// cliente precisa saber que aquele número é hipótese, e ela precisa lembrar de
// voltar antes de fechar. Um número simulado passando por definitivo seria o
// pior defeito possível nesta tela.
export function descreverSimulacao(simulacao, plano) {
  if (!simulacaoAtiva(simulacao)) return []
  return ALAVANCAS
    .filter((a) => simulacao[a.campo] != null)
    .map((a) => ({
      campo: a.campo,
      rotulo: a.rotulo,
      de: Number(plano?.[a.campo] ?? 0),
      para: Number(simulacao[a.campo]),
      sufixo: a.sufixo ?? null,
    }))
}
