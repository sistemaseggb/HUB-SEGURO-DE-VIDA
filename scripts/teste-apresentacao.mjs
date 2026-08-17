// ─────────────────────────────────────────────────────────────────────────────
// O QUE A CANETA ESCREVE — teste do motor da apresentação.
//
// Este arquivo defende três coisas que só falham NA REUNIÃO, que é o pior
// lugar possível para falhar:
//
//   · o traço que ela desenhou é o traço que reaparece (ida e volta pelo
//     jsonb, com arredondamento, simplificação e tudo);
//   · nada que vier do banco derruba a proposta — jsonb é campo livre e um
//     dia vai chegar torto;
//   · a simulação ao vivo NUNCA encosta no planejamento. Se este teste
//     passar a falhar, é porque um número de hipótese começou a virar estudo.
//
// Cada caso tem o resultado esperado escrito à mão. Teste que copia o retorno
// da implementação não prova nada.
//
// Roda com `node scripts/teste-apresentacao.mjs` (e junto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import {
  ALAVANCAS, CALIBRES, ESPESSURAS, TINTAS, EPSILON_PADRAO, LIMITE_HISTORICO,
  agora, anotacoesIguais, apagarEm, aplicarSimulacao, comTraco, comTracos,
  contarTracos, descreverSimulacao, desfazerHist, larguraDoPonto, montarTraco,
  novoHistorico, podeDesfazer, podeRefazer, pontoRelativo, pontosDoTraco,
  pressaoDe, proximoCapitulo, refazerHist, registrar, sanitizarAnotacoes,
  simplificar, simulacaoAtiva, slidesAnotados, tracoAlcancado,
} from '../src/lib/apresentacao.js'
import { calcularEstudo, COBERTURAS_EM_VIDA } from '../src/lib/estudo.js'
import { diagnosticar } from '../src/lib/diagnostico.js'
import { responderObjecoes } from '../src/lib/objecoes.js'
import {
  ORDEM_BASE, PUBLICOS, montarRoteiro, ordemPara, protecaoEmVida, publicoPorId,
} from '../src/lib/roteiroApresentacao.js'

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol

const CAIXA = { left: 100, top: 50, width: 800, height: 400 }

// ── 1. ONDE A CANETA ENCOSTOU ───────────────────────────────────────────────
console.log('\n── Do dedo na tela para a fração do slide ──')
{
  const meio = pontoRelativo(500, 250, CAIXA)
  ok(perto(meio.x, 0.5) && perto(meio.y, 0.5), 'o centro do slide é (0,5 · 0,5)', JSON.stringify(meio))

  const canto = pontoRelativo(100, 50, CAIXA)
  ok(perto(canto.x, 0) && perto(canto.y, 0), 'o canto superior esquerdo é (0 · 0)', JSON.stringify(canto))

  // Riscar até a margem é gesto comum — o ponto é grampeado, não descartado,
  // senão o traço termina antes de onde a mão parou.
  const fora = pontoRelativo(2000, -300, CAIXA)
  ok(fora.x === 1 && fora.y === 0, 'fora da borda gruda na borda', JSON.stringify(fora))

  ok(pontoRelativo(10, 10, { left: 0, top: 0, width: 0, height: 0 }) === null,
    'caixa de tamanho zero não vira divisão por zero')
  ok(pontoRelativo(10, 10, null) === null, 'sem caixa, sem ponto')
}

// ── 2. PRESSÃO E ESPESSURA ──────────────────────────────────────────────────
console.log('\n── A pressão da Apple Pencil ──')
{
  ok(perto(pressaoDe(0.8, 'pen'), 0.8), 'a caneta manda a pressão de verdade')
  // alguns navegadores mandam 0 quando não sabem; 0 viraria espessura 0 e o
  // traço sumiria inteiro
  ok(pressaoDe(0, 'pen') === 0.5, 'caneta sem pressão informada vira meio-termo')
  ok(pressaoDe(0.5, 'mouse') === 0.5, 'mouse é sempre meio-termo')
  ok(pressaoDe(1, 'touch') === 0.5, 'dedo é sempre meio-termo (não tem sensor)')

  const leve = larguraDoPonto('caneta', 10, 0.1)
  const forte = larguraDoPonto('caneta', 10, 1)
  ok(forte > leve * 2, 'apertar mais engrossa bastante o traço', `${leve} → ${forte}`)
  ok(leve > 0, 'nem a pressão mais leve some da tela', leve)
  ok(larguraDoPonto('marcador', 10, 0.1) === larguraDoPonto('marcador', 10, 1),
    'o marcador é nib rígido: grifar não afina quando a mão alivia')
}

// ── 3. SIMPLIFICAÇÃO ────────────────────────────────────────────────────────
console.log('\n── Jogando fora o que o olho não vê ──')
{
  const reta = Array.from({ length: 60 }, (_, i) => ({ x: i / 59, y: 0.5, pressao: 0.5 }))
  const s = simplificar(reta)
  ok(s.length === 2, 'uma reta de 60 pontos vira 2 — o resto está em cima da reta', s.length)
  ok(s[0].x === 0 && s[1].x === 1, 'as pontas nunca são descartadas')

  // um "L": o vértice tem que sobreviver, senão a quina vira diagonal
  const ele = [
    ...Array.from({ length: 20 }, (_, i) => ({ x: i / 40, y: 0.2 })),
    ...Array.from({ length: 20 }, (_, i) => ({ x: 0.5, y: 0.2 + i / 40 })),
  ]
  const sl = simplificar(ele)
  ok(sl.length === 3, 'um "L" guarda exatamente as duas pontas e a quina', sl.length)
  ok(perto(sl[1].x, 0.5, 0.03) && perto(sl[1].y, 0.2, 0.03), 'a quina ficou no lugar certo',
    JSON.stringify(sl[1]))

  ok(simplificar([{ x: 0, y: 0 }]).length === 1, 'um ponto só continua um ponto só')
  ok(simplificar([]).length === 0 && simplificar(null).length === 0, 'lista vazia ou nula não quebra')

  // Um traço longo demais derrubava a versão recursiva com estouro de pilha —
  // e derrubaria na frente do cliente, no meio de um risco comprido.
  const enorme = Array.from({ length: 60_000 }, (_, i) => ({ x: i / 59_999, y: (i % 7) / 700 }))
  let estourou = false
  try { simplificar(enorme) } catch { estourou = true }
  ok(!estourou, '60 mil pontos não estouram a pilha do navegador')

  // Nunca inventa ponto e nunca inverte a ordem: uma simplificação que
  // reordenasse desenharia outra coisa.
  const bagunca = Array.from({ length: 400 }, (_, i) => ({ x: Math.sin(i) / 2 + 0.5, y: Math.cos(i * 1.7) / 2 + 0.5 }))
  const sb = simplificar(bagunca)
  ok(sb.length <= bagunca.length, 'simplificar nunca aumenta o número de pontos')
  let emOrdem = true
  let j = 0
  for (const p of sb) { while (j < bagunca.length && bagunca[j] !== p) j++; if (j >= bagunca.length) emOrdem = false }
  ok(emOrdem, 'os pontos que sobram estão na ordem original')

  const grosso = simplificar(bagunca, EPSILON_PADRAO * 50)
  ok(grosso.length <= sb.length, 'epsilon maior descarta mais pontos', `${sb.length} → ${grosso.length}`)
}

// ── 4. O TRAÇO GUARDADO ─────────────────────────────────────────────────────
console.log('\n── O formato que vai para o banco e volta ──')
{
  const t = montarTraco({
    tipo: 'caneta', cor: '#d96527', calibre: CALIBRES.caneta,
    pontos: [
      { x: 0.123456789, y: 0.5, pressao: 0.87654 },
      { x: 0.4, y: 0.12, pressao: 0.3 },
      { x: 0.9, y: 0.87, pressao: 0.6 },
    ],
  })
  ok(t.p.length % 3 === 0, 'os pontos vão em trincas x, y, pressão', t.p.length)
  ok(t.p[0] === 0.1235, 'a posição é arredondada em 4 casas (fração de pixel)', t.p[0])
  ok(t.p[2] === 0.88, 'a pressão é arredondada em 2 casas', t.p[2])
  ok(t.t === 'caneta' && t.c === '#d96527', 'tipo e cor viajam junto')

  const volta = pontosDoTraco(t)
  ok(volta.length === t.p.length / 3, 'a leitura devolve o mesmo número de pontos', volta.length)
  ok(perto(volta[0].x, 0.1235) && perto(volta[0].pressao, 0.88), 'ida e volta bate',
    JSON.stringify(volta[0]))

  const toque = montarTraco({ tipo: 'caneta', cor: '#000', calibre: 0.003, pontos: [{ x: 0.5, y: 0.5, pressao: 0.9 }] })
  ok(toque.p.length === 6, 'um toque sem arrasto vira um pinguinho, não um traço vazio', toque.p.length)

  const chute = montarTraco({ tipo: 'pincel-atômico', cor: '#000', calibre: 0.003, pontos: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
  ok(chute.t === 'caneta', 'tipo desconhecido cai para caneta em vez de quebrar')
  ok(montarTraco({ tipo: 'caneta', cor: '#000', calibre: 0.003, pontos: [] }) === null,
    'traço sem ponto nenhum não é guardado')

  // O que sai daqui atravessa o jsonb; se não sobreviver ao JSON, não existe.
  const ida = JSON.parse(JSON.stringify({ sucessao: [t] }))
  ok(anotacoesIguais(sanitizarAnotacoes(ida), { sucessao: [t] }),
    'o traço sobrevive à viagem pelo JSON sem mudar')
}

// ── 5. A BORRACHA ───────────────────────────────────────────────────────────
console.log('\n── Encostar e o traço some inteiro ──')
{
  const risco = montarTraco({ tipo: 'caneta', cor: '#a51e42', calibre: 0.003,
    pontos: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }] })
  const circulo = montarTraco({ tipo: 'caneta', cor: '#d96527', calibre: 0.003,
    pontos: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.15, y: 0.2 }] })

  ok(tracoAlcancado(risco, 0.5, 0.505, 0.02), 'encostar perto do meio do risco alcança')
  ok(!tracoAlcancado(risco, 0.5, 0.9, 0.02), 'encostar longe não alcança')

  const depois = apagarEm([circulo, risco], 0.5, 0.5, 0.02)
  ok(depois.length === 1 && depois[0] === circulo, 'some o risco e fica o círculo', depois.length)

  const intacto = [circulo, risco]
  ok(apagarEm(intacto, 0.95, 0.95, 0.02) === intacto,
    'borracha no vazio devolve o MESMO array — senão o React redesenha o slide a cada quadro')

  // apaga primeiro o que está por cima: é o que ela enxerga onde encostou
  const a = montarTraco({ tipo: 'caneta', cor: '#111', calibre: 0.003, pontos: [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }] })
  const b = montarTraco({ tipo: 'caneta', cor: '#222', calibre: 0.003, pontos: [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }] })
  const r = apagarEm([a, b], 0.5, 0.5, 0.02)
  ok(r.length === 1 && r[0] === a, 'apaga o de cima primeiro')
}

// ── 6. O QUE VEM DO BANCO ───────────────────────────────────────────────────
console.log('\n── jsonb é campo livre: nada aqui pode derrubar a proposta ──')
{
  const lixo = [
    null, undefined, 42, 'texto', [], [1, 2, 3],
    { sucessao: 'não é lista' },
    { sucessao: [null, 7, 'x'] },
    { sucessao: [{ p: [0.1, 0.2] }] },                          // trinca incompleta
    { sucessao: [{ c: '#000', p: [0.1, 0.2, 0.5, 0.3] }] },     // não múltiplo de 3
    { sucessao: [{ c: '#000', p: [0.1, 0.2, 0.5, NaN, 1, 1] }] }, // NaN vindo do banco
    { sucessao: [{ c: 123, p: [0, 0, 0.5, 1, 1, 0.5] }] },       // cor que não é texto
  ]
  let quebrou = null
  for (const l of lixo) {
    try {
      const r = sanitizarAnotacoes(l)
      if (typeof r !== 'object' || Array.isArray(r)) quebrou = JSON.stringify(l)
      if (contarTracos(r) !== 0) quebrou = `passou lixo: ${JSON.stringify(l)}`
    } catch (err) { quebrou = `${JSON.stringify(l)} → ${err.message}` }
  }
  ok(!quebrou, 'todo formato torto vira mapa vazio, sem exceção', quebrou)

  const bom = { sucessao: [{ t: 'marcador', c: '#d96527', l: 0.02, p: [0, 0, 0.5, 1, 1, 0.5] }] }
  const limpo = sanitizarAnotacoes(bom)
  ok(contarTracos(limpo) === 1 && limpo.sucessao[0].t === 'marcador', 'o traço bom passa inteiro')

  const semCalibre = sanitizarAnotacoes({ x: [{ c: '#000', p: [0, 0, 0.5, 1, 1, 0.5] }] })
  ok(semCalibre.x[0].l === CALIBRES.caneta, 'traço sem calibre ganha o calibre padrão',
    semCalibre.x[0].l)
  const tipoTorto = sanitizarAnotacoes({ x: [{ t: 'spray', c: '#000', p: [0, 0, 0.5, 1, 1, 0.5] }] })
  ok(tipoTorto.x[0].t === 'caneta', 'tipo desconhecido do banco cai para caneta')
}

// ── 7. O MAPA POR NOME DE CAPÍTULO ──────────────────────────────────────────
console.log('\n── As anotações são guardadas por NOME de slide, nunca por posição ──')
{
  const t1 = montarTraco({ tipo: 'caneta', cor: '#111', calibre: 0.003, pontos: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
  const t2 = montarTraco({ tipo: 'caneta', cor: '#222', calibre: 0.003, pontos: [{ x: 1, y: 0 }, { x: 0, y: 1 }] })

  let a = {}
  a = comTraco(a, 'sucessao', t1)
  a = comTraco(a, 'sucessao', t2)
  a = comTraco(a, 'cruzamento', t1)
  ok(contarTracos(a) === 3, 'três traços em dois capítulos', contarTracos(a))
  ok(slidesAnotados(a).join(',') === 'sucessao,cruzamento', 'os dois capítulos aparecem',
    slidesAnotados(a).join(','))

  const limpo = comTracos(a, 'sucessao', [])
  ok(!('sucessao' in limpo), 'limpar um capítulo TIRA a chave — mapa não guarda lista vazia')
  ok(contarTracos(a) === 3, 'o mapa original não foi mexido (nada muta por baixo do React)')

  ok(comTraco(a, 'x', null) === a, 'traço nulo não cria capítulo')
}

// ── 8. GUARDAR OU DESCARTAR ─────────────────────────────────────────────────
console.log('\n── A pergunta do fim só aparece quando há mesmo algo novo ──')
{
  const t1 = montarTraco({ tipo: 'caneta', cor: '#111', calibre: 0.003, pontos: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
  const t2 = montarTraco({ tipo: 'caneta', cor: '#222', calibre: 0.003, pontos: [{ x: 1, y: 0 }, { x: 0, y: 1 }] })

  ok(anotacoesIguais({}, {}), 'dois mapas vazios são iguais')
  ok(anotacoesIguais({}, { sucessao: [] }), 'capítulo com lista vazia não conta como anotação')
  ok(anotacoesIguais({ a: [t1], b: [t2] }, { b: [t2], a: [t1] }),
    'a ordem das chaves não inventa diferença')
  ok(!anotacoesIguais({ a: [t1] }, { a: [t1, t2] }), 'um traço a mais é diferença')
  ok(!anotacoesIguais({ a: [t1] }, { a: [t2] }), 'traço diferente no mesmo capítulo é diferença')
  ok(!anotacoesIguais({ a: [t1] }, { b: [t1] }), 'mesmo traço em outro capítulo é diferença')
  ok(anotacoesIguais({ a: [t1] }, JSON.parse(JSON.stringify({ a: [t1] }))),
    'a cópia que veio do banco é igual à que está na tela — senão ela seria perguntada à toa')
}

// ── 9. A SIMULAÇÃO AO VIVO ──────────────────────────────────────────────────
console.log('\n── "E se fosse mil e duzentos?" — sem encostar no planejamento ──')
{
  const plano = Object.freeze({
    premio_estimado: 1890, renda_mensal: 48000, custo_vida_mensal: 27000,
    anos_protecao: 20, patrimonio_total: 3_800_000, id_cliente: 'abc',
  })

  ok(!simulacaoAtiva({}) && !simulacaoAtiva(null), 'mapa vazio não é simulação')
  ok(aplicarSimulacao(plano, {}) === plano, 'sem simulação, é o mesmo objeto do banco')

  const sim = aplicarSimulacao(plano, { premio_estimado: 1200 })
  ok(sim.premio_estimado === 1200, 'a alavanca troca o valor', sim.premio_estimado)
  ok(sim !== plano && plano.premio_estimado === 1890,
    'O PLANO DO BANCO CONTINUA INTOCADO — é a regra que sustenta a funcionalidade inteira')
  ok(sim.patrimonio_total === 3_800_000 && sim.id_cliente === 'abc',
    'o resto do plano vem junto sem alteração')

  // só as alavancas declaradas passam: um campo qualquer entrando por aqui
  // viraria uma edição silenciosa do estudo
  const invasor = aplicarSimulacao(plano, { patrimonio_total: 1, id_cliente: 'outro', premio_estimado: 900 })
  ok(invasor.patrimonio_total === 3_800_000 && invasor.id_cliente === 'abc',
    'campo fora da lista de alavancas é ignorado')
  ok(invasor.premio_estimado === 900, 'a alavanca legítima da mesma chamada continua valendo')

  const sujo = aplicarSimulacao(plano, { premio_estimado: 'muito', renda_mensal: NaN })
  ok(sujo.premio_estimado === 1890 && sujo.renda_mensal === 48000,
    'valor que não é número não substitui nada')

  const desc = descreverSimulacao({ premio_estimado: 1200, anos_protecao: 25 }, plano)
  ok(desc.length === 2, 'a etiqueta descreve as duas alavancas mexidas', desc.length)
  const premio = desc.find((d) => d.campo === 'premio_estimado')
  ok(premio.de === 1890 && premio.para === 1200, 'a etiqueta mostra de onde veio e para onde foi',
    JSON.stringify(premio))
  const anos = desc.find((d) => d.campo === 'anos_protecao')
  ok(anos.sufixo === 'anos', 'alavanca que não é dinheiro leva o sufixo certo', anos.sufixo)
  ok(descreverSimulacao({}, plano).length === 0, 'sem simulação, sem etiqueta')

  ok(ALAVANCAS.every((a) => a.passo > 0 && a.max > a.min && a.ajuda),
    'toda alavanca tem passo, limites coerentes e uma frase explicando para que serve')
}

// ── 10. AS TINTAS ───────────────────────────────────────────────────────────
console.log('\n── A caixa de canetas ──')
{
  ok(TINTAS.length >= 4, 'há tinta suficiente para separar o que fica do que sai', TINTAS.length)
  ok(TINTAS.every((t) => /^#[0-9a-f]{6}$/i.test(t.cor)), 'toda tinta é um hex de 6 dígitos')
  ok(new Set(TINTAS.map((t) => t.cor)).size === TINTAS.length, 'nenhuma tinta repetida')
  ok(TINTAS.every((t) => t.rotulo && t.rotulo.length <= 12),
    'cada tinta tem um nome curto — a barra é de polegar, não de menu')
  // as quatro coloridas são a paleta validada; a escura é caneta de escrever
  const coloridas = TINTAS.filter((t) => t.id !== 'tinta').map((t) => t.cor).join(',')
  ok(coloridas === '#d96527,#a51e42,#1272a8,#0e9f6e',
    'as coloridas são exatamente a paleta que passou no validador', coloridas)
  ok(CALIBRES.marcador > CALIBRES.caneta * 3,
    'o marcador é bem mais largo que a caneta — grifo é faixa, não risco')
  ok(ESPESSURAS.length === 3 && ESPESSURAS.some((e) => e.fator === 1),
    'há fino, médio e grosso, e o médio é o calibre de fábrica')
  const fatores = ESPESSURAS.map((e) => e.fator)
  ok(fatores.every((f, i) => i === 0 || f > fatores[i - 1]),
    'os fatores crescem — a lista da barra sai na ordem que o olho espera')
  ok(fatores[fatores.length - 1] / fatores[0] > 2,
    'e o grosso é pelo menos o dobro do fino, senão a escolha não muda nada')
}

// ── 11. A SETA ──────────────────────────────────────────────────────────────
console.log('\n── "Daqui vai para cá" ──')
{
  const s = montarTraco({
    tipo: 'seta', cor: '#a51e42', calibre: CALIBRES.seta,
    // o meio do gesto é a mão tremendo; a seta vale pelas duas pontas
    pontos: [{ x: 0.2, y: 0.2 }, { x: 0.31, y: 0.42 }, { x: 0.28, y: 0.5 }, { x: 0.7, y: 0.6 }],
  })
  ok(s.t === 'seta' && s.p.length === 6, 'a seta guarda exatamente duas pontas', s.p.length)
  ok(s.p[0] === 0.2 && s.p[1] === 0.2 && s.p[3] === 0.7 && s.p[4] === 0.6,
    'começa onde a caneta encostou e termina onde ela soltou', JSON.stringify(s.p))

  ok(montarTraco({ tipo: 'seta', cor: '#000', calibre: 0.003,
    pontos: [{ x: 0.5, y: 0.5 }, { x: 0.503, y: 0.502 }] }) === null,
  'um toque parado não vira seta de tamanho zero')
  ok(montarTraco({ tipo: 'seta', cor: '#000', calibre: 0.003, pontos: [] }) === null,
    'seta sem ponto nenhum não é guardada')

  const volta = sanitizarAnotacoes(JSON.parse(JSON.stringify({ x: [s] })))
  ok(volta.x?.[0]?.t === 'seta', 'a seta sobrevive ao jsonb como seta, não vira caneta')
}

// ── 12. DESFAZER E REFAZER ──────────────────────────────────────────────────
console.log('\n── A borracha precisa ter volta ──')
{
  const t = (n) => montarTraco({ tipo: 'caneta', cor: '#111', calibre: 0.003,
    pontos: [{ x: 0, y: 0 }, { x: n / 10, y: 1 }] })

  let h = novoHistorico({})
  ok(!podeDesfazer(h) && !podeRefazer(h), 'histórico novo não desfaz nem refaz nada')
  ok(contarTracos(agora(h)) === 0, 'e começa vazio')

  h = registrar(h, { a: [t(1)] })
  h = registrar(h, { a: [t(1), t(2)] })
  ok(contarTracos(agora(h)) === 2, 'dois traços registrados', contarTracos(agora(h)))
  ok(podeDesfazer(h) && !podeRefazer(h), 'dá para desfazer, ainda não para refazer')

  h = desfazerHist(h)
  ok(contarTracos(agora(h)) === 1, 'desfazer volta um passo', contarTracos(agora(h)))
  ok(podeRefazer(h), 'e abre o refazer')
  h = desfazerHist(h)
  ok(contarTracos(agora(h)) === 0, 'desfazer de novo volta ao começo')
  ok(!podeDesfazer(h), 'e o começo é o fim da linha')
  ok(desfazerHist(h) === h, 'desfazer no começo devolve o mesmo histórico, sem erro')

  h = refazerHist(refazerHist(h))
  ok(contarTracos(agora(h)) === 2, 'refazer duas vezes traz os dois de volta')
  ok(refazerHist(h) === h, 'refazer no fim devolve o mesmo histórico')

  // desenhar depois de desfazer fecha o caminho de refazer, como em todo editor
  h = desfazerHist(h)
  h = registrar(h, { a: [t(1), t(9)] })
  ok(!podeRefazer(h), 'um passo novo descarta o que estava adiante')
  ok(contarTracos(agora(h)) === 2, 'e o passo novo vale', contarTracos(agora(h)))

  // Arrastar a borracha apaga vários traços em sequência: é UM passo, não um
  // por traço alcançado — senão desfazer devolveria um traço de cada vez.
  let g = novoHistorico({ a: [t(1), t(2), t(3)] })
  g = registrar(g, { a: [t(1), t(2)] })
  g = registrar(g, { a: [t(1)] }, { substituir: true })
  g = registrar(g, { a: [] }, { substituir: true })
  ok(g.pilha.length === 2, 'o arrasto inteiro da borracha é um passo só', g.pilha.length)
  ok(contarTracos(agora(desfazerHist(g))) === 3,
    'e desfazer devolve os TRÊS traços de uma vez', contarTracos(agora(desfazerHist(g))))

  // o histórico não pode crescer para sempre numa reunião longa
  let longo = novoHistorico({})
  for (let i = 0; i < LIMITE_HISTORICO + 40; i++) longo = registrar(longo, { a: [t(i % 9)] })
  ok(longo.pilha.length === LIMITE_HISTORICO, 'o histórico para de crescer no limite', longo.pilha.length)
  ok(longo.pos === LIMITE_HISTORICO - 1, 'e a posição continua no passo mais recente', longo.pos)
  ok(contarTracos(agora(longo)) === 1, 'com o estado certo no topo')
}

// ── 13. CAPÍTULOS PULADOS ───────────────────────────────────────────────────
console.log('\n── Nem todo cliente merece o deck inteiro ──')
{
  const nada = new Set()
  ok(proximoCapitulo(3, 1, 10, nada) === 4, 'sem nada pulado, avança um')
  ok(proximoCapitulo(3, -1, 10, nada) === 2, 'e volta um')
  ok(proximoCapitulo(0, -1, 10, nada) === 0, 'no primeiro capítulo, voltar não sai do lugar')
  ok(proximoCapitulo(9, 1, 10, nada) === 9, 'no último, avançar também não')

  const pulados = new Set([4, 5])
  ok(proximoCapitulo(3, 1, 10, pulados) === 6, 'avançar salta os dois desligados em sequência')
  ok(proximoCapitulo(6, -1, 10, pulados) === 3, 'e voltar salta os mesmos dois')

  // a capa e o fechamento nunca somem: são a abertura e o pedido de decisão
  ok(proximoCapitulo(1, -1, 10, new Set([0])) === 0, 'a capa continua alcançável mesmo desligada')
  ok(proximoCapitulo(8, 1, 10, new Set([9])) === 9, 'o fechamento também')
  ok(proximoCapitulo(0, 1, 0, nada) === 0, 'proposta sem capítulo nenhum não quebra')
}

// ── 14. FUZZ: a mão dela não desenha bonito ─────────────────────────────────
console.log('\n── Dez mil traços aleatórios, incluindo os malucos ──')
{
  let quebrou = null
  let semente = 20260812
  const aleatorio = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648 }

  for (let i = 0; i < 10_000 && !quebrou; i++) {
    const n = Math.floor(aleatorio() * 40)
    const pontos = Array.from({ length: n }, () => ({
      // inclui coordenadas fora da caixa e pressões nas pontas do intervalo
      x: aleatorio() * 1.4 - 0.2,
      y: aleatorio() * 1.4 - 0.2,
      pressao: aleatorio() < 0.1 ? 0 : aleatorio(),
    }))
    try {
      const t = montarTraco({
        tipo: aleatorio() < 0.5 ? 'caneta' : 'marcador',
        cor: TINTAS[Math.floor(aleatorio() * TINTAS.length)].cor,
        calibre: CALIBRES.caneta, pontos,
      })
      if (t === null) { if (n !== 0) quebrou = `traço de ${n} pontos virou nulo`; continue }
      if (t.p.length % 3 !== 0) { quebrou = `trinca quebrada com ${n} pontos`; break }
      if (t.p.some((v) => !Number.isFinite(v))) { quebrou = `valor não finito com ${n} pontos`; break }
      const roundtrip = sanitizarAnotacoes(JSON.parse(JSON.stringify({ s: [t] })))
      if (contarTracos(roundtrip) !== 1) { quebrou = `traço de ${n} pontos não sobreviveu ao JSON`; break }
      // a borracha varre o traço sem explodir, em qualquer lugar
      apagarEm([t], aleatorio(), aleatorio(), 0.02)
    } catch (err) { quebrou = `${n} pontos → ${err.message}` }
  }
  ok(!quebrou, 'nenhum traço aleatório quebra a montagem, o JSON ou a borracha', quebrou)
}

// ── 15. O ROTEIRO POR PÚBLICO ───────────────────────────────────────────────
// A apresentação passou a se adaptar a quem está do outro lado da mesa. O que
// estes casos defendem é justamente o que ninguém percebe se quebrar — a
// apresentação continua "funcionando", só que genérica de novo:
//
//   · o cliente de sucessão vê o inventário ANTES da autonomia da família;
//   · quem não tem dependentes NÃO ouve falar do padrão de vida da família;
//   · a ordem nunca perde nem duplica capítulo, em nenhum público;
//   · nenhuma fala é gerada sem o número que a sustenta.
//
// Os planos abaixo são escritos à mão, com o resultado esperado conferido a
// olho — teste que copia o retorno da implementação não prova nada.
console.log('\n── Para quem esta apresentação está sendo montada ──')

// Base comum: as chaves das migrações precisam existir, é por elas que o
// estudo sabe quais coberturas pode oferecer.
const PLANO_BASE = {
  capital_invalidez: null, capital_doencas_graves: null, dit_diaria: null,
  verba_sucessoria: null, cobertura_atual: 0, capital_cirurgias: null,
  tipo_planejamento: 'pf', focos: [], dih_diaria: null, capital_fraturas: null,
  funeral_individual: null, funeral_familiar: null, capital_morte_acidental: null,
  anos_protecao: 10, custas_pct: 8,
}

const estudoDe = (extra) => calcularEstudo({ ...PLANO_BASE, ...extra }, { idade: 42 })
const roteiroDe = (extra, cliente = { nome: 'Ana Paula Souza' }) => {
  const e = estudoDe(extra)
  const d = diagnosticar(e, { cliente })
  return montarRoteiro(e, {
    diagnostico: d, cliente, objecoes: responderObjecoes(e, { diagnostico: d, cliente }),
    objetivos: extra.objetivos ?? null,
  })
}

// O provedor: renda, casa, dois filhos pequenos.
const PROVEDOR = {
  renda_mensal: 18_000, custo_vida_mensal: 12_000, estado_civil: 'Casado(a)',
  dependentes: [{ nome: 'Bento', idade: 4, custo_mensal: 1800 }],
  focos: ['renda', 'educacao'], premio_estimado: 600,
}
// O patrimonial: patrimônio grande, ilíquido, e o inventário como assunto.
const PATRIMONIAL = {
  renda_mensal: 30_000, custo_vida_mensal: 18_000, estado_civil: 'Casado(a)',
  regime_bens: 'Separação total', uf: 'RJ',
  patrimonio_imoveis: 6_000_000, patrimonio_investimentos: 900_000,
  focos: ['sucessao', 'blindagem'], premio_estimado: 2_400,
}
// Sem dependentes: mora sozinho, sem filhos, sem cônjuge.
const SOZINHO = {
  renda_mensal: 14_000, custo_vida_mensal: 7_000, estado_civil: 'Solteiro(a)',
  dividas_total: 90_000, focos: [], premio_estimado: 320,
}

{
  const provedor = roteiroDe(PROVEDOR)
  const patrimonial = roteiroDe(PATRIMONIAL)
  const sozinho = roteiroDe(SOZINHO)

  ok(provedor.publico.id === 'provedor', 'pai de família com filho pequeno → público provedor',
    provedor.publico.id)
  ok(patrimonial.publico.id === 'patrimonial', 'patrimônio grande e foco em sucessão → público patrimonial',
    patrimonial.publico.id)
  ok(sozinho.publico.id === 'individual', 'sem cônjuge e sem filhos → público sem dependentes',
    sozinho.publico.id)

  // ── A ordem muda de verdade ───────────────────────────────────────────────
  const antes = (r, a, b) => r.ordemDe(a) < r.ordemDe(b)
  ok(antes(patrimonial, 'sucessao', 'autonomia'),
    'PARA QUEM VEIO POR SUCESSÃO, O INVENTÁRIO VEM ANTES DA AUTONOMIA DA FAMÍLIA')
  ok(antes(patrimonial, 'patrimonio', 'numero'),
    'e o raio-X do patrimônio vem antes do número')
  ok(antes(provedor, 'autonomia', 'sucessao'),
    'para o provedor, a autonomia da família continua abrindo a consciência')
  ok(antes(sozinho, 'em-vida', 'numero'),
    'para quem mora sozinho, o que paga EM VIDA vem antes do capital de morte')

  // O arco consultivo não muda com o público: preço depois do valor, sempre.
  for (const r of [provedor, patrimonial, sozinho]) {
    const nome = r.publico.id
    ok(r.ordemDe('capa') === 1, `${nome}: a capa continua sendo o primeiro capítulo`)
    ok(r.ordemDe('fechamento') === ORDEM_BASE.length, `${nome}: e o fechamento, o último`)
    ok(antes(r, 'plano', 'investimento'), `${nome}: o preço vem depois do plano completo`)
    ok(antes(r, 'diagnostico', 'numero'), `${nome}: o retrato vem antes da solução`)
    ok(antes(r, 'investimento', 'passos'), `${nome}: os próximos passos fecham a reunião`)
  }

  // ── Nada se perde e nada se duplica ───────────────────────────────────────
  for (const p of [...PUBLICOS, publicoPorId('inexistente')]) {
    const ordem = ordemPara(p)
    const unicos = new Set(ordem)
    ok(ordem.length === ORDEM_BASE.length && unicos.size === ORDEM_BASE.length,
      `${p.id}: a ordem tem todos os capítulos, sem repetir nenhum`, ordem.length)
    ok(ORDEM_BASE.every((s) => unicos.has(s)),
      `${p.id}: nenhum capítulo do deck desaparece da ordem`)
  }

  // ── O que sai da reunião ──────────────────────────────────────────────────
  ok(sozinho.estaFora('autonomia'),
    'SEM DEPENDENTES, O CAPÍTULO DO PADRÃO DE VIDA DA FAMÍLIA SAI DO CAMINHO')
  ok((sozinho.motivoFora('autonomia') ?? '').length > 20,
    'e sai com o motivo escrito, para ela decidir trazer de volta',
    sozinho.motivoFora('autonomia'))
  ok(!provedor.estaFora('autonomia'), 'para quem tem família, ele continua no roteiro')
  ok(!sozinho.estaFora('capa') && !sozinho.estaFora('fechamento') && !sozinho.estaFora('plano'),
    'a capa, o plano e o fechamento nunca saem, para nenhum público')

  // Quem não investe nada não recebe três capítulos debatendo investimento —
  // era a apresentação criando a objeção em vez de responder a ela.
  ok(provedor.estaFora('cruzamento') && provedor.estaFora('dimensoes'),
    'cliente que não investe não ganha o debate "investir ou proteger"')
  const investidor = roteiroDe({ ...PROVEDOR, previdencia_aporte_mensal: 1_500, previdencia_saldo: 90_000 })
  ok(!investidor.estaFora('cruzamento'),
    'e quem aporta em previdência ganha o capítulo de volta, sem ela precisar pedir')

  // ── Os cartões do reenquadramento ─────────────────────────────────────────
  ok(patrimonial.cartoes.includes('sucessao'),
    'o reenquadramento do cliente de sucessão fala de sucessão', patrimonial.cartoes.join(', '))
  ok(!sozinho.cartoes.includes('educacao'),
    'e o de quem não tem filhos não fala da educação deles', sozinho.cartoes.join(', '))
  for (const r of [provedor, patrimonial, sozinho]) {
    ok(r.cartoes.length === 3 && new Set(r.cartoes).size === 3,
      `${r.publico.id}: são três cartões, sem repetição`, r.cartoes.join(', '))
  }

  // ── Os textos da tela mudam com o público ─────────────────────────────────
  ok(/vida|renda e|saúde/i.test(patrimonial.textoDe('capa').etiqueta ?? '') === false
    && /sucess/i.test(patrimonial.textoDe('capa').etiqueta ?? ''),
    'a capa do cliente de sucessão anuncia um estudo de sucessão',
    patrimonial.textoDe('capa').etiqueta)
  ok(patrimonial.textoDe('reenquadramento').destaque !== provedor.textoDe('reenquadramento').destaque,
    'o reenquadramento não abre com a mesma frase para os dois')
  ok(/liquidez/i.test(patrimonial.textoDe('numero').etiqueta ?? ''),
    'para ele, o número recomendado é de LIQUIDEZ, não de reposição de renda',
    patrimonial.textoDe('numero').etiqueta)
  ok((sozinho.textoDe('numero').legenda ?? '').includes('dívida')
    || (sozinho.textoDe('numero').legenda ?? '').includes('conta aberta'),
    'e para quem não tem dependentes o número é explicado pelas contas que ficam',
    sozinho.textoDe('numero').legenda)
}

// ── 16. O QUE FALAR EM CADA MOMENTO ─────────────────────────────────────────
console.log('\n── A fala de cada capítulo, com os números deste cliente ──')
{
  const r = roteiroDe({ ...PROVEDOR, objetivos: 'Garantir a faculdade do Bento' })

  // Todo capítulo do deck tem fala: um slide sem nota é justamente onde a
  // consultora fica sozinha na frente do cliente.
  const semFala = ORDEM_BASE.filter((s) => !r.falaDe(s))
  ok(semFala.length === 0, 'TODOS OS CAPÍTULOS TÊM O QUE DIZER', semFala.join(', '))

  for (const slide of ORDEM_BASE) {
    const f = r.falaDe(slide)
    if (!f) continue
    if (!(f.objetivo && f.objetivo.length > 15)) { ok(false, `${slide}: objetivo em uma linha`); break }
    if (!(f.diga.length > 0)) { ok(false, `${slide}: pelo menos uma frase para dizer`); break }
    if (f.diga.some((x) => /undefined|NaN|R\$ NaN/.test(x))) {
      ok(false, `${slide}: fala com buraco no meio`, f.diga.join(' | ')); break
    }
    if (!f.pergunte) { ok(false, `${slide}: a pergunta que devolve a palavra ao cliente`); break }
    if (!f.momento) { ok(false, `${slide}: o momento da reunião a que ele pertence`); break }
  }
  ok(ORDEM_BASE.every((s) => {
    const f = r.falaDe(s)
    return f && f.objetivo && f.diga.length > 0 && f.pergunte && f.momento
      && !f.diga.some((x) => /undefined|NaN/.test(x))
  }), 'e nenhuma delas sai com objetivo, pergunta, momento ou número faltando')

  // A citação do cliente é dele, não inventada.
  ok(r.falaDe('fechamento').diga.some((x) => x.includes('faculdade do Bento')),
    'o fechamento cita a frase que o cliente disse na reunião')
  const semObjetivo = roteiroDe(PROVEDOR)
  ok(!semObjetivo.falaDe('fechamento').diga.some((x) => x.includes('"')),
    'e quando ele não disse nada, nada é citado')

  // A objeção chega no capítulo em que ela nasce, não no fim da reunião.
  ok(r.falaDe('investimento').objecao?.id === 'preco',
    'no capítulo do preço, a resposta pronta é a do "está caro"',
    r.falaDe('investimento').objecao?.id)
  // A do "já tenho seguro" só existe quando ele DE FATO tem alguma apólice —
  // a resposta se monta com a carteira dele, e sem carteira não há resposta.
  const comApolice = roteiroDe({
    ...PROVEDOR,
    cobertura_atual: 400_000,
    seguros_existentes: [{ origem: 'empresa', descricao: 'Vida em grupo', capital: 400_000, custeio: 'empresa' }],
  })
  ok(comApolice.falaDe('gap').objecao?.id === 'ja_tem',
    'no capítulo do que falta, a do "já tenho seguro"', comApolice.falaDe('gap').objecao?.id)
  ok(r.falaDe('gap').objecao === null,
    'e quem não tem apólice nenhuma não recebe resposta para uma objeção que não existe')
  ok((r.falaDe('investimento').objecao?.argumentos?.length ?? 0) > 0,
    'e ela vem com os argumentos já calculados para este cliente')

  // Um estudo vazio não pode derrubar a apresentação no meio da reunião.
  const vazio = montarRoteiro(calcularEstudo({}), { cliente: {} })
  ok(vazio && vazio.publico.id === 'geral',
    'estudo sem dados cai no público neutro em vez de quebrar', vazio?.publico?.id)
  ok(vazio.fora.size === 0, 'e sem perfil nenhum capítulo é tirado da reunião')
  ok(montarRoteiro(null) === null, 'sem estudo, sem roteiro')
}

// ── 17. A PROTEÇÃO EM VIDA (e a cobertura de cirurgias) ─────────────────────
console.log('\n── O capítulo que responde ao "só serve depois que eu morro" ──')
{
  const e = estudoDe(PROVEDOR)

  ok(e.valores.cirurgias > 0, 'o estudo passou a sugerir capital de cirurgias', e.valores.cirurgias)
  ok(e.valores.cirurgias === Math.min(18_000 * 3, 50_000),
    'três vezes a renda, respeitando o teto de mercado da tabela cirúrgica', e.valores.cirurgias)
  ok(e.ativas.some((c) => c.id === 'cirurgias' && c.grupo === 'vida'),
    'e ela entra no quadro da apólice, no grupo do que paga em vida')

  const emVida = protecaoEmVida(e)
  ok(emVida.itens.some((i) => i.id === 'cirurgias'), 'o capítulo da proteção em vida traz cirurgias',
    emVida.itens.map((i) => i.id).join(', '))
  ok(emVida.itens.every((i) => COBERTURAS_EM_VIDA.includes(i.id)),
    'e só traz cobertura que paga com o cliente aqui')
  ok(!emVida.itens.some((i) => ['morte', 'sucessao', 'funeral_individual'].includes(i.id)),
    'morte, sucessão e funeral ficam de fora — por definição')
  // A diária vale o LIMITE, não o valor de um dia: é o que a cobertura entrega
  // de verdade quando o afastamento acontece.
  const dit = emVida.itens.find((i) => i.id === 'dit')
  ok(!dit || dit.totalEmDinheiro === dit.valor * dit.dias,
    'a diária entra pelo total que ela pode pagar, não pelo valor de um dia')
  ok(emVida.maior <= emVida.total, 'a maior indenização única nunca passa da soma')

  // Sem a migração aplicada, a cobertura simplesmente não existe — e nada
  // quebra: é o mesmo contrato das migrações 014 e 019.
  const semColuna = { ...PROVEDOR, ...PLANO_BASE }
  delete semColuna.capital_cirurgias
  const antigo = calcularEstudo(semColuna, { idade: 42 })
  ok(antigo.tem027 === false, 'banco sem a migração 027 não oferece cirurgias', antigo.tem027)
  ok(!antigo.ativas.some((c) => c.id === 'cirurgias'),
    'e o capítulo não promete o que o banco não consegue gravar')
  ok(protecaoEmVida(antigo).itens.length > 0,
    'o capítulo da proteção em vida continua de pé sem ela')
}

console.log('\n── RESULTADO (apresentação) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
