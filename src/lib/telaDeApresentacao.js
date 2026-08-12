// ─────────────────────────────────────────────────────────────────────────────
// TELA CHEIA E TELA ACORDADA — a parte da apresentação que depende do aparelho.
//
// Vive fora de `apresentacao.js` de propósito: aquele arquivo é lógica pura e
// roda no teste sem navegador. Aqui é tudo o que só existe com uma tela na
// frente, e é justamente onde o Safari do iPad cobra atenção.
//
// ── O que o Safari do iPad faz de diferente ─────────────────────────────────
//
// 1. Não implementa `requestFullscreen` padrão em elemento — só o prefixado
//    `webkitRequestFullscreen`, e em algumas versões nem isso.
// 2. Exige que o pedido saia de um gesto do usuário. Chamar depois de um
//    `await` ou dentro de um `setTimeout` faz o navegador recusar em silêncio.
// 3. Sai da tela cheia sozinho ao girar o aparelho ou ao trocar de app — o
//    estado precisa ser LIDO do navegador, nunca lembrado numa variável.
//
// Por isso nada aqui promete tela cheia. A apresentação funciona inteira sem
// ela: o modo esconde as barras do sistema, prende a rolagem e ocupa a altura
// toda. A tela cheia é um bônus quando o aparelho deixa — se falhasse e
// levasse a apresentação junto, seria um defeito na frente do cliente.
// ─────────────────────────────────────────────────────────────────────────────

export function suportaTelaCheia(el) {
  const alvo = el ?? document.documentElement
  return !!(alvo?.requestFullscreen || alvo?.webkitRequestFullscreen
    || document.documentElement?.webkitRequestFullscreen)
}

export function emTelaCheia() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement)
}

// Chame DIRETO do clique. Devolve true se o pedido saiu — não se ele foi
// aceito, que só o navegador sabe depois.
export function entrarTelaCheia(el) {
  const alvo = el ?? document.documentElement
  const pedir = alvo.requestFullscreen ?? alvo.webkitRequestFullscreen
  if (!pedir) return false
  try {
    // Alguns navegadores devolvem Promise, outros não. O catch cobre a rejeição
    // silenciosa ("permissions check failed") sem derrubar a apresentação.
    const r = pedir.call(alvo, { navigationUI: 'hide' })
    if (r && typeof r.catch === 'function') r.catch(() => {})
    return true
  } catch { return false }
}

export function sairTelaCheia() {
  if (!emTelaCheia()) return
  const sair = document.exitFullscreen ?? document.webkitExitFullscreen
  try {
    const r = sair?.call(document)
    if (r && typeof r.catch === 'function') r.catch(() => {})
  } catch { /* já saiu */ }
}

// ── Tela acordada ────────────────────────────────────────────────────────────
// Uma reunião de seguro passa da meia hora e a consultora fica minutos sem
// tocar na tela enquanto o cliente fala. O iPad apaga no meio do argumento e
// derruba o compartilhamento. O Wake Lock evita isso — e o navegador o solta
// sozinho quando a aba sai de foco, então ele precisa ser retomado na volta.
export function manterAcordado() {
  if (!('wakeLock' in navigator)) return () => {}
  let trava = null
  let vivo = true

  const pedir = async () => {
    if (!vivo || document.visibilityState !== 'visible') return
    try { trava = await navigator.wakeLock.request('screen') } catch { trava = null }
  }
  const aoVoltar = () => { if (!trava) pedir() }

  pedir()
  document.addEventListener('visibilitychange', aoVoltar)

  return () => {
    vivo = false
    document.removeEventListener('visibilitychange', aoVoltar)
    try { trava?.release() } catch { /* já solta */ }
    trava = null
  }
}
