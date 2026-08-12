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
  ALAVANCAS, CALIBRES, TINTAS, EPSILON_PADRAO,
  anotacoesIguais, apagarEm, aplicarSimulacao, comTraco, comTracos, contarTracos,
  descreverSimulacao, larguraDoPonto, montarTraco, pontoRelativo, pontosDoTraco,
  pressaoDe, sanitizarAnotacoes, simplificar, simulacaoAtiva, slidesAnotados,
  tracoAlcancado,
} from '../src/lib/apresentacao.js'

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
}

// ── 11. FUZZ: a mão dela não desenha bonito ─────────────────────────────────
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

console.log('\n── RESULTADO (apresentação) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
