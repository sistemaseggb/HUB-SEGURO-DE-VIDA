// Testes de CONFLITOS E ERROS DE USUÁRIO — os caminhos que quebram sistemas.
// Roda contra o modo demonstração (sem .env o demo liga sozinho):
//   npm run build && npm run test:e2e   ← roda esta suíte junto com a principal
// O servidor de preview sobe sozinho se não estiver no ar.
//
// Cobre: link de formulário inválido/já concluído, validação de obrigatórios,
// proposta sem planejamento, rota inexistente, criação de cliente + venda com
// comissão automática, popups de dossiê e DPS, pendências de classificação,
// busca global, exclusão com confirmação, celular (375px) e F5.
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { BASE, garantirServidor } from './e2e-servidor.mjs'
await garantirServidor()
const erros = []
const consoleErros = []
const executablePath = process.env.CHROMIUM_PATH
  ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => consoleErros.push('PAGEERROR: ' + String(e).slice(0, 250)))
async function passo(nome, fn) {
  try { await fn(); console.log('✓', nome) }
  catch (e) { erros.push(nome); console.log('✗', nome, '—', String(e).slice(0, 250)) }
}

// login
await page.goto(BASE)
await page.fill('input[type=email]', 'natalia@demo.com')
await page.fill('input[type=password]', 'x')
await page.click('button[type=submit]')
await page.waitForSelector('text=Demonstração', { timeout: 8000 })

await passo('1. Link de formulário INVÁLIDO mostra erro amigável (não trava)', async () => {
  const p = await ctx.newPage()
  await p.goto(BASE + '/f/token-que-nao-existe')
  await p.waitForSelector('text=/inválido|expirado|não encontrado|erro/i', { timeout: 6000 })
  await p.close()
})

await passo('1b. Link de proposta INVÁLIDO mostra erro amigável (não trava)', async () => {
  const p = await ctx.newPage()
  await p.goto(BASE + '/p/token-que-nao-existe')
  await p.waitForSelector('text=Proposta não encontrada', { timeout: 6000 })
  await p.close()
})

await passo('2. Formulário já CONCLUÍDO mostra estado concluído (não deixa reenviar)', async () => {
  const p = await ctx.newPage()
  await p.goto(BASE + '/f/demo-dps-token')
  await p.waitForSelector('text=/concluído|recebemos|obrigad/i', { timeout: 6000 })
  await p.close()
})

await passo('3. Wizard NÃO avança com obrigatórios vazios', async () => {
  const p = await ctx.newPage()
  await p.goto(BASE + '/f/demo-dps-aberta')
  await p.waitForTimeout(900)
  const comecar = p.locator('button', { hasText: /começar|iniciar|vamos/i }).first()
  if (await comecar.count()) await comecar.click()
  await p.waitForTimeout(400)
  const tituloAntes = await p.locator('h1, h2').first().innerText()
  await p.locator('button', { hasText: /avançar|próxim|continuar/i }).first().click()
  await p.waitForTimeout(500)
  const tituloDepois = await p.locator('h1, h2').first().innerText()
  if (tituloAntes !== tituloDepois) throw new Error('avançou sem preencher obrigatórios!')
  await p.close()
})

await passo('4. Proposta de cliente SEM planejamento orienta em vez de quebrar', async () => {
  await page.goto(BASE + '/clientes')
  await page.click('text=Ana Clara Boff')
  await page.waitForTimeout(600)
  const id = page.url().match(/clientes\/([a-f0-9-]+)/)?.[1]
  await page.goto(`${BASE}/proposta/${id}`)
  await page.waitForSelector('text=Preencha o planejamento', { timeout: 5000 })
})

await passo('5. Rota inexistente redireciona para o Dashboard', async () => {
  await page.goto(BASE + '/pagina-que-nao-existe')
  await page.waitForSelector('text=/Boa (tarde|noite)|Bom dia/i', { timeout: 6000 })
})

await passo('6. Novo cliente pela UI + aparece na lista', async () => {
  await page.goto(BASE + '/clientes')
  await page.click('button:has-text("Novo lead")')
  await page.waitForTimeout(400)
  await page.locator('form input').first().fill('Cliente Teste E2E')
  await page.locator('form select').first().selectOption({ index: 1 })
  await page.click('button:has-text("Cadastrar lead")')
  await page.waitForTimeout(800)
  await page.waitForSelector('main >> text=Cliente Teste E2E', { timeout: 5000 })
})

await passo('7. Registrar venda calcula comissão sozinho (40/30/30)', async () => {
  await page.click('main >> text=Cliente Teste E2E')
  await page.click('button:has-text("Apólices")')
  await page.click('button:has-text("Registrar venda")')
  await page.waitForTimeout(400)
  await page.locator('form select').first().selectOption({ index: 1 })
  // campos de dinheiro usam InputMoeda (texto com pontuação pt-BR)
  const nums = page.locator('form input[inputmode=decimal]')
  await nums.nth(0).fill('500')   // prêmio
  await nums.nth(1).fill('800000') // capital
  await page.fill('form input[type=date]', '2026-07-01')
  await page.click('button:has-text("Confirmar venda")')
  await page.waitForTimeout(800)
  const corpo = await page.locator('table').first().innerText()
  if (!/R\$\s?2\.400,00/.test(corpo)) throw new Error('comissão anualizada não apareceu: ' + corpo.slice(0, 200))
})

await passo('8. Dossiê abre popup com o retrato do cliente', async () => {
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 6000 }),
    page.click('button:has-text("Dossiê")'),
  ])
  await popup.waitForTimeout(700)
  const txt = await popup.locator('body').innerText()
  if (!/Dossiê — Cliente Teste E2E/.test(txt)) throw new Error('conteúdo do dossiê errado')
  if (!/apólices \(1\)/i.test(txt)) throw new Error('apólice recém-criada não está no dossiê')
  await popup.close()
})

await passo('9. Imprimir DPS abre popup com as respostas e IMC', async () => {
  await page.goto(BASE + '/clientes')
  await page.click('text=Carlos Eduardo Menezes')
  await page.click('button:has-text("Formulário")')
  await page.waitForSelector('button:has-text("Imprimir DPS")', { timeout: 5000 })
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 6000 }),
    page.click('button:has-text("Imprimir DPS")'),
  ])
  await popup.waitForTimeout(600)
  const txt = await popup.locator('body').innerText()
  if (!/IMC 26/.test(txt)) throw new Error('IMC não calculado')
  if (!/Hipertensão leve/.test(txt)) throw new Error('detalhe do SIM não veio')
  await popup.close()
})

await passo('10. Pendência de classificação: "É da Nati" resolve na hora', async () => {
  await page.goto(BASE + '/relatorios')
  await page.waitForSelector('text=Vera Lúcia Camargo', { timeout: 8000 })
  await page.click('button:has-text("É da Nati")')
  await page.waitForTimeout(900)
  const pendencia = await page.locator('text=Produção não identificada').count()
  if (pendencia > 0) throw new Error('pendência de produção não sumiu')
})

await passo('11. Busca global acha cliente por nome parcial', async () => {
  await page.fill('input[placeholder*="Buscar"]', 'fernanda')
  await page.waitForSelector('text=Fernanda Ribas Antunes', { timeout: 5000 })
  await page.keyboard.press('Escape')
})

await passo('12. Excluir cliente pede CONFIRMAÇÃO (cancelar preserva)', async () => {
  await page.goto(BASE + '/clientes')
  await page.click('main >> text=Helena Struck')
  await page.waitForTimeout(600)
  let confirmou = false
  page.once('dialog', (d) => { confirmou = true; d.dismiss() })
  // botão de excluir fica no modal de edição
  await page.click('[title="Editar cliente"]')
  await page.waitForTimeout(400)
  const excluir = page.locator('button:has-text("Excluir")')
  if (await excluir.count()) {
    await excluir.first().click()
    await page.waitForTimeout(400)
    if (!confirmou) throw new Error('excluiu sem pedir confirmação!')
  }
})

await passo('13. Celular (375px): menu hambúrguer abre e navega', async () => {
  const movel = await browser.newContext({ viewport: { width: 375, height: 720 } })
  const pm = await movel.newPage()
  pm.on('pageerror', (e) => consoleErros.push('MOBILE: ' + String(e).slice(0, 150)))
  await pm.goto(BASE)
  await pm.fill('input[type=email]', 'natalia@demo.com')
  await pm.fill('input[type=password]', 'x')
  await pm.click('button[type=submit]')
  await pm.waitForTimeout(1200)
  await pm.locator('header button').first().click() // hambúrguer
  await pm.waitForTimeout(400)
  await pm.click('text=Relatórios')
  await pm.waitForSelector('text=Fechamento para o financeiro', { timeout: 6000 })
  await pm.screenshot({ path: 'e2e-shots/19-mobile-relatorios.png' })
  await movel.close()
})

await passo('14. Sessão demo sobrevive ao F5 (fica logada)', async () => {
  await page.goto(BASE + '/relatorios')
  await page.reload()
  await page.waitForSelector('text=Demonstração', { timeout: 6000 })
})

console.log('\n── RESULTADO ──')
console.log('Falhas:', erros.length ? erros : 'nenhuma 🎉')
console.log('Erros de página:', consoleErros.length ? [...new Set(consoleErros)].slice(0, 8) : 'nenhum')
await browser.close()
process.exit(erros.length ? 1 : 0)
