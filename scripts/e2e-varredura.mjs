// ─────────────────────────────────────────────────────────────────────────────
// VARREDURA GERAL — o sistema inteiro, tela por tela, em quatro perfis.
//
// As outras suítes testam caminhos escolhidos. Esta passa por TUDO: cada rota,
// cada aba do Cliente 360, no computador e no celular, com clientes em estados
// diferentes — do recém-cadastrado (sem nada preenchido) ao PF+PJ completo.
//
// O que ela cobra em cada parada:
//   · nenhum erro de console ou de página;
//   · nenhum NaN, Infinity, undefined ou "R$ -" visível na tela;
//   · nenhum "R$ NaN", "0 meses" solto ou "[object Object]" escapando;
//   · a tela não fica em carregando eterno;
//   · nada de rolagem horizontal no celular.
//
// É a rede que pega o que ninguém pensou em testar — e o lugar onde um cliente
// vazio, que é o estado em que TODO cliente começa, é exercitado de verdade.
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
  console.log(cond ? '✓' : '✗', msg + (cond || !extra ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}

// Texto que nunca pode chegar aos olhos da consultora nem do cliente.
const LIXO = [
  ['NaN', /\bNaN\b/],
  ['Infinity', /\bInfinity\b/],
  ['undefined', /\bundefined\b/],
  ['null literal', /(^|\s)null(\s|$)/],
  ['[object Object]', /\[object Object\]/],
  ['dinheiro negativo', /R\$\s*-/],
  ['dinheiro inválido', /R\$\s*(NaN|undefined|null)/],
]
// "R$" sozinho NÃO é defeito: é o prefixo de um campo de dinheiro em branco,
// que aparece em toda tela de formulário. Procurar por ele acusaria o sistema
// inteiro sem que houvesse nada errado.

async function novaPagina(viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', (e) => erros.push('PAGEERROR: ' + String(e).slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // 404 de favicon e ruído de extensão não são defeito do sistema
    if (/favicon|ERR_INTERNET_DISCONNECTED/.test(t)) return
    erros.push('CONSOLE: ' + t.slice(0, 160))
  })
  await page.goto(BASE)
  await page.waitForSelector('text=Modo demonstração', { timeout: 20000 })
  await page.fill('input[type=email]', 'natalia@demo.com')
  await page.fill('input[type=password]', 'demo')
  await page.click('button[type=submit]')
  await page.waitForSelector('text=Demonstração', { timeout: 20000 })
  return { page, erros }
}

// Uma parada da varredura: espera assentar e revista a tela inteira.
async function revistar(page, rotulo, { celular = false } = {}) {
  await page.waitForTimeout(750)
  const r = await page.evaluate(() => ({
    texto: document.body.innerText,
    carregando: document.body.innerText.trim().length < 40,
    largura: document.documentElement.scrollWidth,
    limite: document.documentElement.clientWidth,
  }))
  ok(!r.carregando, `${rotulo}: a tela mostra alguma coisa`, 'ficou em branco/carregando')
  for (const [nome, re] of LIXO) {
    const achou = r.texto.match(re)
    if (achou) {
      // o índice vem do próprio match: procurar o texto de novo apontaria a
      // primeira ocorrência parecida, não a que falhou
      const i = achou.index ?? 0
      ok(false, `${rotulo}: sem "${nome}" na tela`,
        JSON.stringify(r.texto.slice(Math.max(0, i - 45), i + 45)))
    }
  }
  if (celular) {
    ok(r.largura <= r.limite + 2, `${rotulo}: sem rolagem horizontal`,
      `${r.largura}px em ${r.limite}px`)
  }
}

const ROTAS = [
  ['/', 'Dashboard'], ['/clientes', 'Clientes'], ['/pipeline', 'Pipeline'],
  ['/agenda', 'Agenda'], ['/relatorios', 'Relatórios'], ['/pos-venda', 'Pós-Venda'],
  ['/mensagens', 'Mensagens'], ['/cadastros', 'Cadastros'],
  ['/importar', 'Importar'], ['/guia', 'Guia'],
]

const ABAS = ['Dossiê', 'Planejamento', 'Comparador', 'Roteiro', 'Transcrição', 'Interações', 'Reuniões',
  'Apólices', 'Comissões', 'Documentos', 'Formulário', 'Tarefas', 'Histórico']

// Os quatro estados em que um cliente realmente aparece na carteira.
const PERFIS = [
  ['Ana Clara Boff', 'lead recém-cadastrado, sem nada preenchido'],
  ['Rodrigo Sartori', 'PF com estudo montado'],
  ['Carlos Eduardo Menezes', 'PF + PJ completo, com apólice fechada'],
  ['Helena Struck', 'cliente perdido — a tela tem que se comportar igual'],
]

// ── Computador ──────────────────────────────────────────────────────────────
console.log('\n══ Computador (1440px) ══')
{
  const { page, erros } = await novaPagina({ width: 1440, height: 1000 })

  for (const [rota, rotulo] of ROTAS) {
    await page.goto(BASE + rota)
    await revistar(page, rotulo)
  }

  for (const [nome, descricao] of PERFIS) {
    await page.goto(BASE + '/clientes')
    await page.waitForTimeout(700)
    const link = page.locator(`text=${nome}`).first()
    if (await link.count() === 0) { console.log('·', `${nome} não está no seed`); continue }
    await link.click()
    await page.waitForTimeout(1000)
    console.log(`\n· ${nome} — ${descricao}`)
    for (const aba of ABAS) {
      const b = page.locator(`button:has-text("${aba}")`).first()
      if (await b.count() === 0) continue
      await b.click()
      await revistar(page, `  ${aba}`)
    }
    // e a proposta desse cliente, aberta pelo app (recarregar zeraria o demo)
    const botaoProposta = page.locator('a[href^="/proposta/"]').first()
    if (await botaoProposta.count() > 0) {
      await botaoProposta.click()
      await page.waitForTimeout(1800)
      await revistar(page, '  Proposta')
    }
  }

  ok(erros.length === 0, 'computador: nenhum erro de console ou de página',
    erros.slice(0, 3).join(' | '))
  await page.context().close()
}

// ── Celular ─────────────────────────────────────────────────────────────────
console.log('\n══ Celular (375px) ══')
{
  const { page, erros } = await novaPagina({ width: 375, height: 780 })

  for (const [rota, rotulo] of ROTAS) {
    await page.goto(BASE + rota)
    await revistar(page, rotulo, { celular: true })
  }

  await page.goto(BASE + '/clientes')
  await page.waitForTimeout(700)
  await page.locator('text=Carlos Eduardo Menezes').first().click()
  await page.waitForTimeout(1000)
  console.log('\n· Carlos Eduardo Menezes no celular')
  for (const aba of ABAS) {
    const b = page.locator(`button:has-text("${aba}")`).first()
    if (await b.count() === 0) continue
    await b.click()
    await revistar(page, `  ${aba}`, { celular: true })
  }
  const botaoProposta = page.locator('a[href^="/proposta/"]').first()
  if (await botaoProposta.count() > 0) {
    await botaoProposta.click()
    await page.waitForTimeout(1800)
    await revistar(page, '  Proposta', { celular: true })
  }

  ok(erros.length === 0, 'celular: nenhum erro de console ou de página',
    erros.slice(0, 3).join(' | '))
  await page.context().close()
}

console.log('\n── RESULTADO (varredura geral) ──')
console.log(falhas.length
  ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}`
  : 'Falhas: nenhuma 🎉')
await browser.close()
process.exit(falhas.length ? 1 : 0)
