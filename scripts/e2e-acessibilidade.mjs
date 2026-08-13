// ─────────────────────────────────────────────────────────────────────────────
// A TELA QUE DÁ PARA USAR — varredura de acessibilidade em todas as rotas.
//
// Não é uma preocupação abstrata. Três coisas aqui são uso diário:
//
//   · A consultora apresenta pelo iPad com a tela espelhada num projetor ou
//     compartilhada no Meet, e o cliente lê de longe, em tela pequena, com a
//     idade que ele tem. Texto de baixo contraste some.
//   · Metade dos botões do sistema é só um ícone. Sem rótulo, quem usa leitor
//     de tela ouve "botão" — e quem passa o mouse não descobre o que é.
//   · Todo formulário aqui é longo. Campo sem rótulo associado quebra o
//     preenchimento por teclado e a leitura em voz alta.
//
// O que esta suíte cobra, rota por rota:
//   1. um <h1> por página, e a hierarquia de títulos sem buraco;
//   2. todo controle interativo com nome acessível;
//   3. todo campo de formulário com rótulo associado (<label for> ou aria);
//   4. toda imagem com alt (ou marcada como decorativa);
//   5. contraste de texto mínimo de 4,5:1 sobre o fundo real;
//   6. foco visível ao navegar por teclado;
//   7. nenhum `aria-*` apontando para id que não existe.
//
// Roda com `node scripts/e2e-acessibilidade.mjs` (e junto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { garantirServidor } from './e2e-servidor.mjs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:4173'

await garantirServidor()
const executablePath = process.env.CHROMIUM_PATH
  ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath })

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}

// Auditoria injetada na página. Fica aqui como texto porque roda no navegador.
const AUDITAR = () => {
  const visivel = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
      && Number(s.opacity) > 0.05
  }
  const nomeAcessivel = (el) => (
    el.getAttribute('aria-label')?.trim()
    || el.getAttribute('title')?.trim()
    || (el.getAttribute('aria-labelledby')
      && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent?.trim())
    || el.textContent?.trim()
    || (el.tagName === 'INPUT' && ['submit', 'button'].includes(el.type) ? el.value?.trim() : '')
    || el.querySelector('img[alt]')?.alt?.trim()
    || ''
  )
  const resumo = (el) => {
    const cls = String(el.className ?? '').slice(0, 40)
    return `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} class="${cls}">`
  }

  // ── contraste ──────────────────────────────────────────────────────────────
  const lum = (c) => {
    const f = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
  }
  // O Tailwind v4 emite as cores em `oklch(...)`, não em `rgb(...)`. Um leitor
  // que só entendesse rgb devolvia null para TODA cor da marca e caía no fundo
  // branco padrão — acusando contraste 1:1 em texto branco sobre botão verde,
  // que é justamente onde ele está certo.
  //
  // Em vez de reimplementar oklch → sRGB à mão, deixamos o navegador converter:
  // pinta um pixel com a cor e lê de volta. Funciona para qualquer formato que
  // o CSS aceite hoje ou venha a aceitar.
  const tela = document.createElement('canvas')
  tela.width = 1; tela.height = 1
  const pincel = tela.getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  const cor = (valor) => {
    const chave = String(valor)
    if (cache.has(chave)) return cache.get(chave)
    let r = null
    if (chave && chave !== 'none' && chave !== 'transparent') {
      pincel.clearRect(0, 0, 1, 1)
      pincel.fillStyle = '#000'
      pincel.fillStyle = chave
      // fillStyle inválido é ignorado e mantém o valor anterior
      if (pincel.fillStyle !== '#000' || /^#0{3,6}$|rgb\(0, ?0, ?0\)|black/i.test(chave)) {
        pincel.fillRect(0, 0, 1, 1)
        const d = pincel.getImageData(0, 0, 1, 1).data
        r = { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
      }
    }
    cache.set(chave, r)
    return r
  }
  // Devolve o fundo sólido de trás do elemento — ou null quando não dá para
  // saber. Gradiente e imagem de fundo NÃO têm uma cor única: chutar branco ali
  // acusava contraste 1:1 em todo texto branco sobre a capa e sobre os botões
  // coloridos, que é justamente onde o contraste está certo. Preferimos não
  // opinar a mentir.
  const fundoDe = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage && s.backgroundImage !== 'none') return null
      const c = cor(s.backgroundColor)
      if (c && c.a > 0.9) return c.rgb
      n = n.parentElement
    }
    return [255, 255, 255]
  }
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }

  const semNome = []
  const semRotulo = []
  const semAlt = []
  const baixoContraste = []
  const ariaQuebrado = []
  let semFundoConhecido = 0

  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    if (!visivel(el)) continue
    if (!nomeAcessivel(el)) semNome.push(resumo(el))
  }
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!visivel(el) || el.type === 'hidden') continue
    const temLabel = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`))
      || el.closest('label')
      || el.getAttribute('aria-label')
      || el.getAttribute('aria-labelledby')
      || el.getAttribute('title')
      || el.getAttribute('placeholder')
    if (!temLabel) semRotulo.push(resumo(el))
  }
  for (const el of document.querySelectorAll('img')) {
    if (!visivel(el)) continue
    if (el.getAttribute('alt') === null && el.getAttribute('role') !== 'presentation') semAlt.push(el.src.slice(-40))
  }
  for (const el of document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]')) {
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
      const id = el.getAttribute(attr)
      if (id && !document.getElementById(id)) ariaQuebrado.push(`${attr}="${id}"`)
    }
  }

  // Texto pequeno e cinza é onde o contraste quebra. Amostra os nós de texto
  // reais, não os contêineres.
  const vistos = new Set()
  for (const el of document.querySelectorAll('p, span, td, th, li, label, h1, h2, h3, h4, a, button, div')) {
    if (!visivel(el)) continue
    const proprio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!proprio) continue
    const s = getComputedStyle(el)
    const c = cor(s.color)
    if (!c || c.a < 0.5) continue
    const tam = parseFloat(s.fontSize)
    const negrito = Number(s.fontWeight) >= 700
    // WCAG AA: 3:1 para texto grande (≥24px, ou ≥18,66px em negrito), 4,5:1 no resto
    const minimo = tam >= 24 || (tam >= 18.66 && negrito) ? 3 : 4.5
    const fundo = fundoDe(el)
    if (!fundo) { semFundoConhecido += 1; continue }
    const razao = contraste(c.rgb, fundo)
    if (razao < minimo) {
      const chave = `${s.color}|${Math.round(tam)}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      baixoContraste.push({
        texto: el.textContent.trim().slice(0, 34),
        cor: s.color, tam: Math.round(tam),
        razao: Math.round(razao * 10) / 10, minimo,
      })
    }
  }

  const titulos = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter(visivel).map((h) => Number(h.tagName[1]))
  let buraco = null
  for (let i = 1; i < titulos.length; i++) {
    if (titulos[i] - titulos[i - 1] > 1) { buraco = `h${titulos[i - 1]} → h${titulos[i]}`; break }
  }

  return {
    semNome, semRotulo, semAlt, baixoContraste, ariaQuebrado, semFundoConhecido,
    h1: document.querySelectorAll('h1').length,
    buracoTitulos: buraco,
    idioma: document.documentElement.lang,
  }
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

await page.goto(BASE)
await page.waitForSelector('text=Modo demonstração', { timeout: 20000 })

// A tela de login é a única que o navegador vê antes de qualquer coisa.
console.log('\n══ Login ══')
{
  const r = await page.evaluate(AUDITAR)
  ok(r.idioma === 'pt-BR' || r.idioma === 'pt',
    'a página declara o idioma (o leitor de tela precisa saber que é português)', r.idioma || '(vazio)')
  ok(r.semRotulo.length === 0, 'todo campo tem rótulo', r.semRotulo.join(' '))
  ok(r.semNome.length === 0, 'todo botão tem nome', r.semNome.join(' '))
}

await page.fill('input[type=email]', 'natalia@demo.com')
await page.fill('input[type=password]', 'demo')
await page.click('button[type=submit]')
await page.waitForSelector('text=Demonstração', { timeout: 20000 })

const ROTAS = [
  ['/', 'Dashboard'], ['/pipeline', 'Pipeline'], ['/agenda', 'Agenda'],
  ['/clientes', 'Clientes'], ['/pos-venda', 'Pós-Venda'], ['/mensagens', 'Mensagens'],
  ['/relatorios', 'Relatórios'], ['/importar', 'Importar'], ['/cadastros', 'Cadastros'],
  ['/guia', 'Guia'],
]

for (const [rota, nome] of ROTAS) {
  await page.goto(BASE + rota)
  await page.waitForTimeout(900)
  const r = await page.evaluate(AUDITAR)
  console.log(`\n══ ${nome} ══`)
  ok(r.semNome.length === 0, `${nome}: todo controle tem nome acessível`, r.semNome.slice(0, 3).join(' '))
  ok(r.semRotulo.length === 0, `${nome}: todo campo tem rótulo`, r.semRotulo.slice(0, 3).join(' '))
  ok(r.semAlt.length === 0, `${nome}: toda imagem tem alt`, r.semAlt.slice(0, 2).join(' '))
  ok(r.ariaQuebrado.length === 0, `${nome}: nenhum aria-* aponta para id inexistente`,
    r.ariaQuebrado.slice(0, 3).join(' '))
  ok(r.h1 === 1, `${nome}: exatamente um <h1>`, r.h1)
  ok(r.baixoContraste.length === 0, `${nome}: todo texto passa no contraste mínimo`,
    r.baixoContraste.slice(0, 3).map((b) => `"${b.texto}" ${b.cor} ${b.razao}:1 (mín ${b.minimo})`).join(' · '))
}

// ── Cliente 360: as abas ────────────────────────────────────────────────────
console.log('\n══ Cliente 360 (todas as abas) ══')
await page.goto(BASE + '/clientes')
await page.waitForTimeout(700)
await page.locator('text=Carlos Eduardo Menezes').first().click()
await page.waitForTimeout(1100)
for (const aba of ['Planejamento', 'Comparador', 'Em análise', 'Roteiro', 'Apólices', 'Documentos']) {
  const b = page.locator(`button:has-text("${aba}")`).first()
  if (await b.count() === 0) continue
  await b.click()
  await page.waitForTimeout(800)
  const r = await page.evaluate(AUDITAR)
  ok(r.semNome.length === 0, `  ${aba}: todo controle tem nome`, r.semNome.slice(0, 3).join(' '))
  ok(r.semRotulo.length === 0, `  ${aba}: todo campo tem rótulo`, r.semRotulo.slice(0, 3).join(' '))
  ok(r.baixoContraste.length === 0, `  ${aba}: contraste`,
    r.baixoContraste.slice(0, 3).map((x) => `"${x.texto}" ${x.cor} ${x.razao}:1`).join(' · '))
}

// ── Proposta: é o que o CLIENTE lê ──────────────────────────────────────────
console.log('\n══ Proposta (a tela que o cliente lê) ══')
await page.locator('a[href^="/proposta/"]').first().click()
await page.waitForTimeout(1800)
{
  const r = await page.evaluate(AUDITAR)
  ok(r.semNome.length === 0, 'Proposta: todo controle tem nome', r.semNome.slice(0, 3).join(' '))
  ok(r.baixoContraste.length === 0, 'Proposta: todo texto passa no contraste',
    r.baixoContraste.slice(0, 4).map((x) => `"${x.texto}" ${x.cor} ${x.razao}:1 (mín ${x.minimo})`).join(' · '))
  ok(r.ariaQuebrado.length === 0, 'Proposta: aria coerente')
}

// ── Teclado: dá para chegar nos controles e ver onde se está ────────────────
console.log('\n══ Navegação por teclado ══')
await page.goto(BASE + '/clientes')
await page.waitForTimeout(900)
{
  // A pausa não é frescura: os itens do menu usam `transition-all`, que anima
  // TAMBÉM a espessura do contorno. Lendo o estilo no mesmo instante do Tab, a
  // medição pega o primeiro quadro da transição — contorno de 0px — e acusa
  // uma falha que não existe. Foi o que aconteceu quando esta suíte nasceu.
  let comAnel = 0
  let semAnel = null
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(260)
    const r = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const anel = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1)
        || (s.boxShadow !== 'none' && s.boxShadow !== '')
      return { tag: el.tagName, txt: (el.textContent ?? '').trim().slice(0, 20), anel }
    })
    if (r?.anel) comAnel += 1
    else if (r && !semAnel) semAnel = `${r.tag} "${r.txt}"`
  }
  ok(comAnel >= 10, 'o foco fica visível ao andar de Tab pela tela',
    `${comAnel}/12 com marca de foco · primeiro sem: ${semAnel}`)
}

console.log('\n── RESULTADO (acessibilidade) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
await browser.close()
process.exit(falhas.length ? 1 : 0)
