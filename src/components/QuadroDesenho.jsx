import { useCallback, useEffect, useRef } from 'react'
import {
  CALIBRES, COR_LASER, ESPESSURAS, OPACIDADE_MARCADOR,
  apagarEm, larguraDoPonto, montarTraco, pontoRelativo, pontosDoTraco, pressaoDe,
} from '../lib/apresentacao'

// ─────────────────────────────────────────────────────────────────────────────
// O QUADRO — a camada onde a Apple Pencil escreve por cima do slide.
//
// A consultora está com o iPad na mão, compartilhando a tela na reunião. Ela
// circula o número que importa, risca o que não importa e escreve o valor que
// o cliente acabou de dizer. Tudo isso precisa acontecer DENTRO da página,
// senão não vai junto no compartilhamento de tela.
//
// ── Como o desenho fica bom ──────────────────────────────────────────────────
//
// DOIS CANVAS, NÃO UM. O de baixo guarda o que já foi desenhado e só é
// redesenhado quando a lista de traços muda. O de cima carrega o traço que
// está saindo agora e o laser. Com um canvas só, cada movimento da caneta
// redesenharia o slide inteiro — e a caneta ficaria arrastada, que é o defeito
// que faz alguém desistir da ferramenta em dez segundos.
//
// EVENTOS AGRUPADOS. A Pencil amostra bem mais rápido que a tela desenha; o
// navegador junta os eventos e entrega o pacote em `getCoalescedEvents()`.
// Lendo só o último ponto de cada quadro, uma curva rápida vira uma sequência
// de retas — o traço fica "poligonal" justamente quando ela desenha rápido.
//
// PRESSÃO. A espessura acompanha a mão. É a diferença entre um traço de caneta
// e um traço de mouse, e o olho percebe na primeira curva.
//
// ── Palma da mão ─────────────────────────────────────────────────────────────
// No iPad, apoiar a mão para escrever gera toques de dedo. Se o quadro
// aceitasse toque, cada palavra escrita viria com um borrão do punho junto.
// Regra: assim que uma caneta encosta neste aparelho UMA vez, o quadro passa a
// ignorar dedo — e lembra disso entre sessões. Quem nunca usou caneta continua
// desenhando com o dedo normalmente, que é o caso do computador com tela
// sensível e o do cliente abrindo no celular.
// ─────────────────────────────────────────────────────────────────────────────

const CHAVE_CANETA_VISTA = 'hub:canetaVista'
const RAIO_BORRACHA = 0.018 // fração do slide — encostar por perto já apaga
const VIDA_LASER = 650      // ms até o rastro sumir por completo

// Calibre final = calibre do instrumento × fator da espessura escolhida.
const calibreDe = (tipo, espessura) => {
  const base = CALIBRES[tipo] ?? CALIBRES.caneta
  const f = ESPESSURAS.find((e) => e.id === espessura)?.fator ?? 1
  return base * f
}

function lerCanetaVista() {
  try { return localStorage.getItem(CHAVE_CANETA_VISTA) === '1' } catch { return false }
}
function gravarCanetaVista() {
  try { localStorage.setItem(CHAVE_CANETA_VISTA, '1') } catch { /* modo anônimo */ }
}

// Desenha um traço já pronto (ou o que está saindo) num contexto 2D.
// `escala` é a menor dimensão: o calibre é relativo para o mesmo traço ficar
// proporcional no iPad e numa TV.
function desenharTraco(ctx, traco, L, A) {
  const pts = traco.pontos ?? pontosDoTraco(traco)
  if (pts.length === 0) return
  const menor = Math.min(L, A)
  const calibre = (traco.l ?? CALIBRES.caneta) * menor
  const px = (p) => [p.x * L, p.y * A]

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = traco.c

  if (traco.t === 'seta') {
    // Da primeira à última ponta, reta, com a cabeça proporcional ao calibre
    // e limitada pelo comprimento: numa seta curta, uma cabeça de tamanho fixo
    // engole a seta inteira e vira um borrão.
    const [a, b] = [pts[0], pts[pts.length - 1]]
    const [ax, ay] = px(a)
    const [bx, by] = px(b)
    const comprimento = Math.hypot(bx - ax, by - ay)
    const cabeca = Math.min(calibre * 7, comprimento * 0.42)
    const ang = Math.atan2(by - ay, bx - ax)
    ctx.lineWidth = calibre * 1.15
    ctx.beginPath()
    // a haste para antes da ponta para a cabeça fechar sem "orelhas"
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx - Math.cos(ang) * cabeca * 0.55, by - Math.sin(ang) * cabeca * 0.55)
    ctx.stroke()
    ctx.fillStyle = traco.c
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx - Math.cos(ang - 0.42) * cabeca, by - Math.sin(ang - 0.42) * cabeca)
    ctx.lineTo(bx - Math.cos(ang + 0.42) * cabeca, by - Math.sin(ang + 0.42) * cabeca)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    return
  }

  if (traco.t === 'marcador') {
    // O marcador é UM caminho só, de propósito: com transparência, desenhar
    // segmento a segmento escureceria cada emenda e o grifo sairia manchado.
    ctx.globalAlpha = OPACIDADE_MARCADOR
    ctx.globalCompositeOperation = 'multiply'
    ctx.lineWidth = calibre
    ctx.beginPath()
    ctx.moveTo(...px(pts[0]))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(...px(pts[i]))
    if (pts.length === 1) ctx.lineTo(...px(pts[0]))
    ctx.stroke()
    ctx.restore()
    return
  }

  // Caneta: segmento a segmento, cada um com a espessura da pressão daquele
  // trecho. As pontas redondas costuram os segmentos sem deixar degrau.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    ctx.lineWidth = (larguraDoPonto('caneta', calibre, a.pressao)
      + larguraDoPonto('caneta', calibre, b.pressao)) / 2
    ctx.beginPath()
    ctx.moveTo(...px(a))
    ctx.lineTo(...px(b))
    ctx.stroke()
  }
  if (pts.length === 1) {
    const [x, y] = px(pts[0])
    ctx.fillStyle = traco.c
    ctx.beginPath()
    ctx.arc(x, y, larguraDoPonto('caneta', calibre, pts[0].pressao) / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export default function QuadroDesenho({
  slide, tracos, aoMudarTracos, ferramenta, ativo = false, className = '',
}) {
  const caixaRef = useRef(null)
  const fundoRef = useRef(null)
  const vivoRef = useRef(null)
  const tamanhoRef = useRef({ L: 0, A: 0 })
  const desenhando = useRef(null)   // { pontos, tipo, cor, calibre, id }
  const laser = useRef([])
  const quadro = useRef(0)
  const canetaVista = useRef(lerCanetaVista())
  const ferramentaRef = useRef(ferramenta)
  ferramentaRef.current = ferramenta
  const tracosRef = useRef(tracos)
  tracosRef.current = tracos

  // ── Tamanho físico dos dois canvas ────────────────────────────────────────
  const ajustarTamanho = useCallback(() => {
    const caixa = caixaRef.current
    if (!caixa) return
    const r = caixa.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    if (!(r.width > 0) || !(r.height > 0)) return
    tamanhoRef.current = { L: r.width, A: r.height }
    for (const ref of [fundoRef, vivoRef]) {
      const c = ref.current
      if (!c) continue
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
      c.style.width = `${r.width}px`
      c.style.height = `${r.height}px`
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }, [])

  const redesenharFundo = useCallback(() => {
    const c = fundoRef.current
    if (!c) return
    const { L, A } = tamanhoRef.current
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, L, A)
    for (const t of tracosRef.current ?? []) desenharTraco(ctx, t, L, A)
  }, [])

  useEffect(() => {
    ajustarTamanho()
    redesenharFundo()
    const ro = new ResizeObserver(() => { ajustarTamanho(); redesenharFundo() })
    if (caixaRef.current) ro.observe(caixaRef.current)
    // girar o iPad muda a caixa sem necessariamente disparar o observer a tempo
    window.addEventListener('orientationchange', ajustarTamanho)
    return () => { ro.disconnect(); window.removeEventListener('orientationchange', ajustarTamanho) }
  }, [ajustarTamanho, redesenharFundo])

  useEffect(() => { redesenharFundo() }, [tracos, slide, redesenharFundo])

  // ── A camada de cima: traço em andamento + laser ──────────────────────────
  const pintarVivo = useCallback(() => {
    const c = vivoRef.current
    if (!c) return
    const { L, A } = tamanhoRef.current
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, L, A)

    const atual = desenhando.current
    if (atual && atual.tipo !== 'borracha' && atual.tipo !== 'laser') {
      desenharTraco(ctx, { t: atual.tipo, c: atual.cor, l: atual.calibre, pontos: atual.pontos }, L, A)
    }

    const agora = performance.now()
    const rastro = laser.current.filter((p) => agora - p.t < VIDA_LASER)
    laser.current = rastro
    if (rastro.length > 0) {
      const menor = Math.min(L, A)
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = COR_LASER
      // o rastro apaga de trás para frente: onde a caneta esteve há meio
      // segundo já quase não existe, e a ponta é um ponto vivo
      for (let i = 1; i < rastro.length; i++) {
        const idade = (agora - rastro[i].t) / VIDA_LASER
        ctx.globalAlpha = Math.max(0, 1 - idade) * 0.85
        ctx.lineWidth = menor * 0.006 * (1 - idade * 0.6)
        ctx.beginPath()
        ctx.moveTo(rastro[i - 1].x * L, rastro[i - 1].y * A)
        ctx.lineTo(rastro[i].x * L, rastro[i].y * A)
        ctx.stroke()
      }
      const ponta = rastro[rastro.length - 1]
      ctx.globalAlpha = 0.9
      ctx.fillStyle = COR_LASER
      ctx.shadowColor = COR_LASER
      ctx.shadowBlur = menor * 0.02
      ctx.beginPath()
      ctx.arc(ponta.x * L, ponta.y * A, menor * 0.0075, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // o laço só continua enquanto há o que animar — laser aceso ou traço vivo
    if (rastro.length > 0 || desenhando.current) {
      quadro.current = requestAnimationFrame(pintarVivo)
    } else {
      quadro.current = 0
      ctx.clearRect(0, 0, L, A)
    }
  }, [])

  const acordar = useCallback(() => {
    if (!quadro.current) quadro.current = requestAnimationFrame(pintarVivo)
  }, [pintarVivo])

  useEffect(() => () => { if (quadro.current) cancelAnimationFrame(quadro.current) }, [])

  // ── Ponteiro ──────────────────────────────────────────────────────────────
  function aceitar(ev) {
    if (!ativo) return false
    if (ev.pointerType === 'pen') {
      if (!canetaVista.current) { canetaVista.current = true; gravarCanetaVista() }
      return true
    }
    // dedo apoiado é palma, não intenção — mas só depois que uma caneta
    // apareceu neste aparelho
    if (ev.pointerType === 'touch' && canetaVista.current) return false
    return true
  }

  function relativo(ev) {
    const caixa = caixaRef.current
    return caixa ? pontoRelativo(ev.clientX, ev.clientY, caixa.getBoundingClientRect()) : null
  }

  function onDown(ev) {
    if (!aceitar(ev)) return
    if (ev.button > 0 && ev.button !== 5) return
    const p = relativo(ev)
    if (!p) return
    ev.preventDefault()
    try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* sem captura, segue */ }

    const f = ferramentaRef.current
    // caneta virada (bit 32 de `buttons`): apaga enquanto estiver assim, sem
    // ela precisar trocar de ferramenta na barra
    const tipo = (ev.buttons & 32) ? 'borracha' : f.tipo

    if (tipo === 'borracha') {
      // `apagou` marca se este arrasto já criou um passo de desfazer: um
      // arrasto de borracha é UM passo, não um por traço alcançado
      desenhando.current = { id: ev.pointerId, tipo: 'borracha', apagou: false }
      const restantes = apagarEm(tracosRef.current ?? [], p.x, p.y, RAIO_BORRACHA)
      if (restantes !== (tracosRef.current ?? [])) {
        desenhando.current.apagou = true
        aoMudarTracos(restantes)
      }
      return
    }
    if (tipo === 'laser') {
      desenhando.current = { id: ev.pointerId, tipo: 'laser' }
      laser.current = [{ ...p, t: performance.now() }]
      acordar()
      return
    }
    desenhando.current = {
      id: ev.pointerId, tipo, cor: f.cor, calibre: calibreDe(tipo, f.espessura),
      pontos: [{ ...p, pressao: pressaoDe(ev.pressure, ev.pointerType) }],
    }
    acordar()
  }

  function onMove(ev) {
    const atual = desenhando.current
    if (!atual || atual.id !== ev.pointerId) return
    ev.preventDefault()
    const caixa = caixaRef.current?.getBoundingClientRect()
    if (!caixa) return

    // o pacote de eventos que o navegador segurou desde o último quadro
    const eventos = typeof ev.getCoalescedEvents === 'function'
      ? ev.getCoalescedEvents() : [ev]
    const lista = eventos.length > 0 ? eventos : [ev]

    if (atual.tipo === 'borracha') {
      const base = tracosRef.current ?? []
      let restantes = base
      for (const e of lista) {
        const p = pontoRelativo(e.clientX, e.clientY, caixa)
        if (p) restantes = apagarEm(restantes, p.x, p.y, RAIO_BORRACHA)
      }
      // `apagarEm` devolve o MESMO array quando não alcançou nada: sem essa
      // comparação, arrastar a borracha no vazio remontaria o estado a cada
      // quadro e o React redesenharia o slide inteiro sem motivo
      if (restantes !== base) {
        aoMudarTracos(restantes, { continuando: atual.apagou })
        atual.apagou = true
      }
      return
    }
    if (atual.tipo === 'laser') {
      const agora = performance.now()
      for (const e of lista) {
        const p = pontoRelativo(e.clientX, e.clientY, caixa)
        if (p) laser.current.push({ ...p, t: agora })
      }
      acordar()
      return
    }
    for (const e of lista) {
      const p = pontoRelativo(e.clientX, e.clientY, caixa)
      if (p) atual.pontos.push({ ...p, pressao: pressaoDe(e.pressure, e.pointerType ?? ev.pointerType) })
    }
    acordar()
  }

  function onUp(ev) {
    const atual = desenhando.current
    if (!atual || atual.id !== ev.pointerId) return
    desenhando.current = null
    try { ev.currentTarget.releasePointerCapture(ev.pointerId) } catch { /* já solta */ }
    if (atual.tipo === 'borracha' || atual.tipo === 'laser') { acordar(); return }
    const traco = montarTraco({
      tipo: atual.tipo, cor: atual.cor, calibre: atual.calibre, pontos: atual.pontos,
    })
    if (traco) aoMudarTracos([...(tracosRef.current ?? []), traco])
    acordar()
  }

  // Sai do caminho quando a ponteira solta: o pointerup pode acontecer fora do
  // quadro, e com a captura ativa ele volta para cá do mesmo jeito.
  function onLeave(ev) {
    if (ev.currentTarget.hasPointerCapture?.(ev.pointerId)) return
    onUp(ev)
  }

  return (
    // O envelope e a camada de baixo NÃO recebem ponteiro: os traços têm que
    // aparecer por cima do slide sem roubar o clique dos botões dele.
    <div ref={caixaRef} className={`pointer-events-none absolute inset-0 ${className}`}>
      {/* Quem abre a proposta com leitor de tela precisa ao menos saber que
          existe marcação da consultora aqui — o desenho em si não tem texto. */}
      <canvas ref={fundoRef} className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={(tracos?.length ?? 0) > 0
          ? `Anotações feitas à mão pela consultora sobre este capítulo (${tracos.length} ${tracos.length === 1 ? 'traço' : 'traços'}).`
          : 'Espaço para anotações à mão sobre este capítulo.'} />
      <canvas
        ref={vivoRef}
        className="absolute inset-0 h-full w-full"
        // Sem `touch-action: none` o iPad rola a página embaixo da caneta e o
        // traço sai cortado pela metade.
        style={{ touchAction: ativo ? 'none' : 'auto', pointerEvents: ativo ? 'auto' : 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onLeave}
      />
    </div>
  )
}
