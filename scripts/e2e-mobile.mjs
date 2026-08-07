// ─────────────────────────────────────────────────────────────────────────────
// Guarda de celular: nenhuma tela pode rolar para o lado a 375px.
//
// Rolagem horizontal é o defeito mais fácil de introduzir sem perceber (um
// texto sem quebra dentro de um flex, uma tabela escondida com sr-only) e o
// mais irritante de usar: a consultora abre o sistema no celular na frente do
// cliente e a tela "escorrega". Este teste percorre as telas principais e
// todas as abas do Cliente 360 e falha apontando o elemento culpado.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { garantirServidor } from './e2e-servidor.mjs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:4173'
const LARGURA = 375

await garantirServidor()
const executablePath = process.env.CHROMIUM_PATH
  ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath })
const ctx = await browser.newContext({ viewport: { width: LARGURA, height: 780 } })
const page = await ctx.newPage()
const erros = []
page.on('pageerror', (e) => erros.push(String(e).slice(0, 160)))

const falhas = []
const ok = (cond, msg) => { console.log(cond ? '✓' : '✗', msg); if (!cond) falhas.push(msg) }

// Devolve a largura rolável e quem está causando o estouro, ignorando quem
// vive dentro de um contêiner que rola de propósito (a régua de abas, por ex.).
async function medir() {
  return page.evaluate(() => {
    const limite = document.documentElement.clientWidth
    const rolaDeProposito = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true
      }
      return false
    }
    const culpados = []
    for (const el of document.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (b.width === 0 || rolaDeProposito(el)) continue
      if (b.right > limite + 1) {
        culpados.push(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}"> `
          + `até ${Math.round(b.right)}px :: ${(el.textContent || '').trim().slice(0, 40)}`)
      }
    }
    return { largura: document.documentElement.scrollWidth, limite, culpados: culpados.slice(0, 3) }
  })
}

async function conferir(rotulo) {
  await page.waitForTimeout(700)
  const { largura, limite, culpados } = await medir()
  const cabe = largura <= limite + 2
  ok(cabe, `${rotulo}: sem rolagem horizontal${cabe ? '' : ` (${largura}px em ${limite}px)`}`)
  if (!cabe && culpados.length) for (const c of culpados) console.log('    ↳', c)
}

// ── login ──
await page.goto(BASE)
await page.waitForSelector('text=Modo demonstração', { timeout: 15000 })
await page.fill('input[type=email]', 'natalia@demo.com')
await page.fill('input[type=password]', 'demo')
await page.click('button[type=submit]')
await page.waitForSelector('text=Demonstração', { timeout: 15000 })

for (const [rota, rotulo] of [
  ['/', 'Dashboard'], ['/clientes', 'Clientes'], ['/pipeline', 'Pipeline'],
  ['/agenda', 'Agenda'], ['/comissoes', 'Comissões'], ['/tarefas', 'Tarefas'],
]) {
  await page.goto(BASE + rota)
  await conferir(rotulo)
}

// ── Cliente 360: todas as abas ──
await page.goto(BASE + '/clientes')
await page.waitForTimeout(700)
await page.click('text=Carlos Eduardo Menezes')
await page.waitForTimeout(1000)
const id = page.url().match(/clientes\/([a-f0-9-]+)/)?.[1]

const abas = ['Dossiê', 'Planejamento', 'Roteiro', 'Transcrição', 'Interações', 'Reuniões',
  'Apólices', 'Comissões', 'Documentos', 'Formulário', 'Tarefas', 'Histórico']
for (const aba of abas) {
  const b = page.locator(`button:has-text("${aba}")`).first()
  if (await b.count() === 0) { console.log('·', `aba ${aba} não existe`); continue }
  await b.click()
  await conferir(`aba ${aba}`)
}

// ── proposta (é apresentada em tela cheia, mas precisa abrir no celular) ──
if (id) {
  await page.goto(`${BASE}/proposta/${id}`)
  await conferir('Proposta')
}

ok(erros.length === 0, `sem erros de página${erros.length ? ': ' + erros[0] : ''}`)

console.log('\n── RESULTADO (celular 375px) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
await browser.close()
process.exit(falhas.length ? 1 : 0)
