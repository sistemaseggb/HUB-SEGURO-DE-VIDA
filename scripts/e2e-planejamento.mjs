// ─────────────────────────────────────────────────────────────────────────────
// A aba Planejamento usada como a consultora usa: com o cliente na frente,
// digitando durante a conversa. O teste cobre o que dói de verdade se quebrar —
// número inválido na tela, valor digitado que some ao trocar de aba, dado que
// não volta quando ela sai e retorna ao cliente, e a proposta saindo com
// número quebrado. Roda contra o modo demonstração (banco em memória).
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { garantirServidor } from './e2e-servidor.mjs'
await garantirServidor()
const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath: exe })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
const erros = []
page.on('pageerror', (e) => erros.push('PAGEERROR: ' + String(e).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') erros.push('CONSOLE: ' + m.text().slice(0, 200)) })
const B = 'http://localhost:4173'

async function login() {
  await page.goto(B); await page.waitForSelector('text=Modo demonstração')
  await page.fill('input[type=email]', 'natalia@demo.com'); await page.fill('input[type=password]', 'demo')
  await page.click('button[type=submit]'); await page.waitForSelector('text=Demonstração')
}
async function irPlanejamento(nome) {
  await page.goto(B + '/clientes'); await page.waitForTimeout(600)
  await page.click(`text=${nome}`); await page.waitForTimeout(700)
}
const falhas = []
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) falhas.push(m) }

await login()

// ── 1. Cliente NOVO, sem planejamento nenhum ──
await irPlanejamento('Ana Clara Boff')
await page.waitForSelector('text=Como montar o planejamento', { timeout: 8000 })
const t1 = await page.evaluate(() => document.body.innerText)
const t1l = t1.toLowerCase()
ok(!/NaN|Infinity|undefined/.test(t1), 'cliente novo: nenhum NaN/Infinity/undefined na tela')
ok(t1l.includes('prontidão da proposta') || t1l.includes('pronto para apresentar'), 'cliente novo: mostra prontidão')

// ── 2. Digitar valores hostis campo a campo ──
const hostis = ['-5000', '0', 'abc', '999999999999999999', '1,5', '  ']
const campos = await page.locator('input[inputmode], input[type=number]').count()
console.log(`· ${campos} campos numéricos na tela`)
for (const v of hostis) {
  const alvos = page.locator('input[inputmode], input[type=number]')
  const n = Math.min(await alvos.count(), 14)
  for (let i = 0; i < n; i++) { try { await alvos.nth(i).fill(v) } catch { /* readonly */ } }
  await page.waitForTimeout(250)
  const t = await page.evaluate(() => document.body.innerText)
  const ruim = t.match(/NaN|Infinity|R\$\s*-|undefined/g)
  ok(!ruim, `valor hostil "${v}" não gera número inválido${ruim ? ' → ' + [...new Set(ruim)].join(', ') : ''}`)
}

// ── 3. Preencher um estudo completo e salvar ──
await irPlanejamento('Ana Clara Boff')
await page.waitForSelector('text=Vida financeira')
const preencher = async (rotulo, valor) => {
  const campo = page.locator(`label:has-text("${rotulo}") input`).first()
  if (await campo.count()) await campo.fill(valor)
}
await preencher('Renda mensal', '20000')
await preencher('Custo de vida mensal', '12000')
await preencher('Dívidas totais', '80000')
await preencher('Imóveis', '600000')
await preencher('Investimentos', '150000')
await preencher('Previdência (VGBL/PGBL)', '90000')
await preencher('Prêmio mensal cotado', '650')
await page.waitForTimeout(500)
const t3 = (await page.evaluate(() => document.body.innerText)).toLowerCase()
ok(t3.includes('raio-x do patrimônio'), 'raio-X aparece ao detalhar o patrimônio')
ok(!/NaN|Infinity/.test(t3), 'estudo preenchido sem número inválido')
await page.click('button:has-text("Salvar planejamento")')
await page.waitForSelector('text=Planejamento salvo', { timeout: 6000 }).catch(() => {})
await page.waitForTimeout(800)

// ── 4. Sair do cliente, voltar e conferir que os dados voltaram ──
// (não usamos reload: no modo demonstração o banco vive na memória da aba e
// um recarregamento zeraria tudo — o que testaríamos seria o seed, não a
// gravação. Navegar dentro do app exercita exatamente o caminho real.)
await page.click('a[href="/clientes"]'); await page.waitForTimeout(700)
await page.click('text=Ana Clara Boff'); await page.waitForTimeout(1200)
const t4 = await page.evaluate(() => document.body.innerText)
const valores4 = await page.evaluate(() =>
  [...document.querySelectorAll('input')].map((i) => i.value).filter(Boolean).join('|'))
ok(valores4.includes('20.000') || valores4.includes('20000'), 'renda persistiu ao sair e voltar no cliente')
ok(valores4.includes('600.000') || valores4.includes('600000'), 'imóveis persistiram ao sair e voltar no cliente')
ok(!/NaN|Infinity/.test(t4), 'ao voltar, nenhum número inválido')

// ── 5. Trocar de aba com alterações não salvas ──
await preencher('Renda mensal', '99000')
await page.waitForTimeout(200)
await page.click('button:has-text("Apólices")')
await page.waitForTimeout(400)
await page.click('button:has-text("Planejamento")')
await page.waitForTimeout(900)
const perdido = await page.evaluate(() =>
  [...document.querySelectorAll('input')].some((i) => i.value.includes('99.000') || i.value.includes('99000')))
ok(perdido, 'alteração NÃO salva sobrevive à troca de aba (senão a consultora perde o trabalho)')

// ── 5b. O roteiro leva ao bloco certo ──
{
  const chip = page.locator('button:has-text("Coberturas")').first()
  const antes = await page.evaluate(() => window.scrollY)
  await chip.click()
  await page.waitForTimeout(900)
  const visivel = await page.evaluate(() => {
    const el = document.getElementById('sec-coberturas')
    if (!el) return false
    const b = el.getBoundingClientRect()
    return b.top > -10 && b.top < window.innerHeight
  })
  ok(visivel, `roteiro: clicar em "Coberturas" leva ao bloco (rolagem saiu de ${antes}px)`)
}

// ── 5c. A ponte: o número da tela é o número do slide ──
// Este é o erro que mais custa caro — a consultora confere na tela, apresenta
// no slide e os dois discordam. Tela e proposta chamam o MESMO calcularEstudo,
// e o teste cobra que continue assim.
const daTela = await page.evaluate(() => {
  const achar = (rotulo) => {
    for (const el of document.querySelectorAll('p, span')) {
      if (el.textContent.trim().toLowerCase() === rotulo) {
        const irmao = el.nextElementSibling ?? el.parentElement?.nextElementSibling
        return irmao?.textContent.trim() ?? null
      }
    }
    return null
  }
  return { capital: achar('importância segurada total') }
})

// ── 6. Proposta com o estudo preenchido ──
// Pelo botão, não por page.goto: no modo demonstração o banco vive na memória
// da aba, e um carregamento cheio apagaria o estudo que acabamos de preencher
// — as conferências abaixo passariam olhando para uma tela vazia.
await page.click('a[href^="/proposta/"]')
await page.waitForSelector('text=Importância segurada total', { timeout: 15000 })
await page.waitForTimeout(800)
const t6 = await page.evaluate(() => document.body.innerText)
ok(!/NaN|Infinity|R\$\s*-|undefined/.test(t6), 'proposta sem número inválido')
ok(!/\b0 meses\b/.test(t6) || t6.includes('vitalícia'), 'proposta sem "0 meses" solto')

const daProposta = await page.evaluate(() => {
  for (const el of document.querySelectorAll('p')) {
    if (el.textContent.trim().toLowerCase() === 'importância segurada total') {
      return el.nextElementSibling?.textContent.trim() ?? null
    }
  }
  return null
})
const normaliza = (v) => (v ?? '').replace(/\s+/g, ' ').trim()
ok(daTela.capital != null && daProposta != null && normaliza(daTela.capital) === normaliza(daProposta),
  `ponte: importância segurada igual na tela e no slide (tela ${normaliza(daTela.capital) || '—'} · slide ${normaliza(daProposta) || '—'})`)

// ── 7. Celular 375px ──
const mob = await (await browser.newContext({ viewport: { width: 375, height: 780 } })).newPage()
const errosMob = []
mob.on('pageerror', (e) => errosMob.push(String(e).slice(0, 150)))
await mob.goto(B); await mob.fill('input[type=email]', 'natalia@demo.com')
await mob.fill('input[type=password]', 'demo'); await mob.click('button[type=submit]')
await mob.waitForSelector('text=Demonstração', { timeout: 8000 })
await mob.goto(B + '/clientes'); await mob.waitForTimeout(700)
await mob.click('text=Carlos Eduardo Menezes'); await mob.waitForTimeout(1200)
await mob.click('button:has-text("Planejamento")'); await mob.waitForTimeout(1200)
const larguraOk = await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
ok(larguraOk, 'celular 375px: sem rolagem horizontal na aba Planejamento')
ok(errosMob.length === 0, `celular sem erros de página${errosMob.length ? ': ' + errosMob[0] : ''}`)
await mob.screenshot({ path: 'e2e-shots/planejamento-celular.png' })

console.log('\nErros de console/página:', erros.length ? erros.slice(0, 5) : 'nenhum')
console.log('\n── RESULTADO (planejamento) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
await browser.close()
process.exit(falhas.length || erros.length ? 1 : 0)
