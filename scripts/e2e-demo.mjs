// Testes de ponta a ponta do Hub em MODO DEMONSTRAÇÃO.
//
// Como rodar:
//   1. npm run build && npm run preview   (sem .env → modo demo liga sozinho)
//   2. npm run test:e2e                    (noutro terminal)
//
// Cobre a visão da CONSULTORA (login, dashboard, pipeline, cliente 360 com
// planejamento por pilares, apólices, DPS, proposta, relatórios, pós-venda,
// agenda, mensagens, cadastros) e a visão do CLIENTE (formulário público de
// DPS pelo link, com validação e campo condicional). Capturas em e2e-shots/.
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const BASE = process.env.E2E_BASE ?? 'http://localhost:4173'
const erros = []
const consoleErros = []

// Caminho do Chromium: CHROMIUM_PATH no ambiente, ou o pré-instalado do
// container, ou o padrão do playwright (npx playwright install chromium).
const executablePath = process.env.CHROMIUM_PATH
  ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') consoleErros.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => consoleErros.push('PAGEERROR: ' + String(e).slice(0, 300)))

async function passo(nome, fn) {
  try { await fn(); console.log('✓', nome) }
  catch (e) { erros.push(`${nome}: ${String(e).slice(0, 300)}`); console.log('✗', nome, '—', String(e).slice(0, 200)) }
}
const shot = (n) => page.screenshot({ path: `e2e-shots/${n}.png`, fullPage: false })

// ── VISÃO DA CONSULTORA ──
await passo('Login em modo demo', async () => {
  await page.goto(BASE)
  await page.waitForSelector('text=Modo demonstração', { timeout: 8000 })
  await page.fill('input[type=email]', 'natalia@demo.com')
  await page.fill('input[type=password]', 'demo')
  await shot('01-login')
  await page.click('button[type=submit]')
  await page.waitForSelector('text=Demonstração', { timeout: 8000 })
})

await passo('Dashboard carrega com KPIs', async () => {
  await page.waitForTimeout(1200)
  await shot('02-dashboard')
  if (consoleErros.length) throw new Error('erros de console: ' + consoleErros.join(' | '))
})

await passo('Pipeline (Kanban)', async () => {
  await page.goto(BASE + '/pipeline'); await page.waitForTimeout(900); await shot('03-pipeline')
})

await passo('Clientes lista', async () => {
  await page.goto(BASE + '/clientes'); await page.waitForTimeout(900)
  await page.waitForSelector('text=Carlos Eduardo Menezes', { timeout: 5000 })
  await shot('04-clientes')
})

await passo('Cliente 360 → Planejamento por pilares', async () => {
  await page.click('text=Carlos Eduardo Menezes')
  await page.waitForSelector('text=Os 5 pilares da proteção', { timeout: 6000 })
  await page.waitForSelector('text=Resumo do estudo', { timeout: 3000 })
  await shot('05-planejamento')
})

await passo('Cliente 360 → Apólices com status', async () => {
  await page.click('button:has-text("Apólices")')
  await page.waitForSelector('text=Ativa', { timeout: 5000 })
  await shot('06-apolices')
})

await passo('Apólice cancelada com motivo (Fernanda)', async () => {
  await page.goto(BASE + '/clientes')
  await page.click('text=Fernanda Ribas Antunes')
  await page.click('button:has-text("Apólices")')
  await page.waitForSelector('text=Cancelada', { timeout: 5000 })
  await page.waitForSelector('text=Substituída por apólice maior', { timeout: 3000 })
  await page.goto(BASE + '/clientes')
  await page.click('text=Carlos Eduardo Menezes')
  await page.click('button:has-text("Formulário")')
  await page.waitForTimeout(500)
})

await passo('Cliente 360 → Formulário/DPS concluída', async () => {
  await page.click('text=Formulário')
  await page.waitForSelector('text=Imprimir DPS', { timeout: 5000 })
  await page.waitForSelector('text="sim" declarados', { timeout: 3000 })
  await shot('07-dps-respostas')
})

await passo('Proposta (slides) com estudo completo', async () => {
  const url = page.url()
  const idCliente = url.match(/clientes\/([a-f0-9-]+)/)?.[1]
  await page.goto(`${BASE}/proposta/${idCliente}`)
  await page.waitForSelector('text=/estudo de proteção e blindagem/i', { timeout: 6000 })
  await shot('08-proposta-capa')
  await page.waitForSelector('text=/inventário custa caro/i', { timeout: 3000 })
  await page.waitForSelector('text=/quatro passos simples/i', { timeout: 3000 })
})

await passo('Relatórios → fechamento com cascata', async () => {
  await page.goto(BASE + '/relatorios')
  await page.waitForSelector('text=Fechamento para o financeiro', { timeout: 8000 })
  await page.waitForSelector('text=Base líquida', { timeout: 5000 })
  await page.waitForSelector('text=Controle da Natália', { timeout: 3000 })
  await shot('09-relatorios')
})

await passo('Pós-venda', async () => {
  await page.goto(BASE + '/pos-venda'); await page.waitForTimeout(900); await shot('10-posvenda')
})

await passo('Agenda', async () => {
  await page.goto(BASE + '/agenda'); await page.waitForTimeout(900); await shot('11-agenda')
})

await passo('Mensagens', async () => {
  await page.goto(BASE + '/mensagens'); await page.waitForTimeout(900); await shot('12-mensagens')
})

await passo('Cadastros (divisão de comissão)', async () => {
  await page.goto(BASE + '/cadastros')
  await page.waitForSelector('text=Divisão de comissão', { timeout: 5000 })
  await shot('13-cadastros')
})

// ── VISÃO DO CLIENTE (formulário público/DPS) ──
await passo('Formulário público abre sem login', async () => {
  const p2 = await ctx.newPage()
  p2.on('pageerror', (e) => consoleErros.push('FORM PAGEERROR: ' + String(e).slice(0, 200)))
  await p2.goto(BASE + '/f/demo-dps-aberta')
  await p2.waitForTimeout(1200)
  await p2.screenshot({ path: 'e2e-shots/14-form-cliente-inicio.png' })
  // navega pelo wizard: tela de boas-vindas → começar
  const comecar = p2.locator('button', { hasText: /começar|iniciar|vamos/i }).first()
  if (await comecar.count()) await comecar.click()
  await p2.waitForTimeout(600)
  await p2.screenshot({ path: 'e2e-shots/15-form-etapa1.png' })
  globalThis.p2 = p2
})

await passo('Cliente preenche etapa 1 e avança', async () => {
  const p2 = globalThis.p2
  const inputs = p2.locator('input:visible')
  await p2.locator('input:visible').first().fill('Rodrigo Sartori')
  // preenche todos os inputs de texto obrigatórios visíveis com valores simples
  const n = await inputs.count()
  for (let i = 1; i < n; i++) {
    const el = inputs.nth(i)
    const tipo = await el.getAttribute('type')
    if (tipo === 'date') await el.fill('1982-07-25')
    else if ((await el.inputValue()) === '') await el.fill(tipo === 'email' ? 'rodrigo@exemplo.com' : '123.456.789-00')
  }
  for (const sel of await p2.locator('select:visible').all()) {
    await sel.selectOption({ index: 1 }).catch(() => {})
  }
  await p2.screenshot({ path: 'e2e-shots/16-form-etapa1-cheia.png' })
  await p2.locator('button', { hasText: /avançar|próxim|continuar/i }).first().click()
  await p2.waitForTimeout(600)
  await p2.screenshot({ path: 'e2e-shots/17-form-etapa2.png' })
})

await passo('DPS: pergunta sim/não abre campo de detalhe', async () => {
  const p2 = globalThis.p2
  // pula até achar uma etapa com botões Sim/Não (saúde)
  for (let tent = 0; tent < 8; tent++) {
    if (await p2.locator('button:visible', { hasText: /^sim$/i }).count() > 0) break
    const inputs = p2.locator('input:visible')
    const n = await inputs.count()
    for (let i = 0; i < n; i++) {
      const el = inputs.nth(i)
      const tipo = await el.getAttribute('type')
      if ((await el.inputValue()) !== '') continue
      if (tipo === 'date') await el.fill('1982-07-25')
      else if (tipo === 'number') await el.fill('80')
      else await el.fill(tipo === 'email' ? 'x@exemplo.com' : 'Teste demo')
    }
    for (const sel of await p2.locator('select:visible').all()) await sel.selectOption({ index: 1 }).catch(() => {})
    await p2.locator('button', { hasText: /avançar|próxim|continuar/i }).first().click()
    await p2.waitForTimeout(500)
  }
  const botoesSim = p2.locator('button:visible', { hasText: /^sim$/i })
  if (await botoesSim.count() === 0) throw new Error('não achei perguntas sim/não')
  const antes = await p2.locator('textarea:visible').count()
  await botoesSim.first().click()
  await p2.waitForTimeout(400)
  const depois = await p2.locator('textarea:visible').count()
  await p2.screenshot({ path: 'e2e-shots/18-form-dps-simnao.png' })
  if (depois <= antes) throw new Error(`campo de detalhe não abriu (antes=${antes}, depois=${depois})`)
})

console.log('\n── RESULTADO ──')
console.log('Falhas:', erros.length ? erros : 'nenhuma 🎉')
console.log('Erros de console:', consoleErros.length ? [...new Set(consoleErros)].slice(0, 10) : 'nenhum')
await browser.close()
process.exit(erros.length ? 1 : 0)
