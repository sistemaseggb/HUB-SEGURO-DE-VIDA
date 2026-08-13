// ─────────────────────────────────────────────────────────────────────────────
// NAVEGAÇÃO — a consultora nunca pode ficar perdida.
//
// Cada teste aqui nasceu de uma forma concreta de a pessoa se perder:
//
//   · apertou F5 no meio da reunião e voltou para outra aba;
//   · apertou "voltar" e o sistema saiu do cliente inteiro;
//   · mandou o link de um cliente pelo WhatsApp e abriu na aba errada;
//   · não achou "Relatórios" porque não sabia que ele mora em "Gestão";
//   · no celular, precisou de dois toques e memória para trocar de tela;
//   · não sabia em qual das doze abas do cliente havia conteúdo.
//
// São falhas de navegação, e falha de navegação não aparece em log de erro:
// aparece como alguém desistindo do sistema no meio de uma reunião.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { garantirServidor } from './e2e-servidor.mjs'

await garantirServidor()
const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath: exe })
const B = 'http://localhost:4173'

const falhas = []
const erros = []
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) falhas.push(m) }

async function novaPagina(viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => erros.push('PAGEERROR: ' + String(e).slice(0, 200)))
  page.on('console', (msg) => { if (msg.type() === 'error') erros.push('CONSOLE: ' + msg.text().slice(0, 200)) })
  await page.goto(B)
  await page.waitForSelector('text=Modo demonstração')
  await page.fill('input[type=email]', 'natalia@demo.com')
  await page.fill('input[type=password]', 'demo')
  await page.click('button[type=submit]')
  await page.waitForSelector('text=Demonstração', { timeout: 15000 })
  return page
}

// Abre o Carlos (o cliente mais completo do demo) e devolve o id da URL
async function abrirCarlos(page) {
  await page.goto(B + '/clientes')
  await page.waitForTimeout(700)
  await page.click('text=Carlos Eduardo Menezes')
  await page.waitForTimeout(900)
  return page.url().match(/\/clientes\/([^/?]+)/)?.[1] ?? null
}

const page = await novaPagina({ width: 1440, height: 1000 })

// ── 1. A ABA MORA NA URL ─────────────────────────────────────────────────────
console.log('\n══ A aba sobrevive ao F5, ao voltar e ao link colado ══')

const id = await abrirCarlos(page)
ok(!!id, 'abrir um cliente pela lista leva a uma URL com id')

await page.click('button:has-text("Apólices")')
await page.waitForTimeout(700)
ok(page.url().includes('/apolices'),
  `clicar numa aba muda a URL (${page.url().split('/clientes/')[1] ?? page.url()})`)

// F5 é o gesto do desespero no meio de uma reunião: a tela travou, ela recarrega.
// Voltar para o Planejamento aqui significa perder o lugar sem aviso.
await page.reload()
await page.waitForTimeout(1400)
const textoDepoisDoF5 = await page.evaluate(() => document.body.innerText)
ok(page.url().includes('/apolices'), 'F5 mantém a URL da aba')
ok(/ap[óo]lice/i.test(textoDepoisDoF5), 'F5 recarrega NA aba Apólices, e não no Planejamento')

// O botão voltar precisa voltar UMA aba, não sair do cliente.
await page.click('button:has-text("Comissões")')
await page.waitForTimeout(700)
await page.goBack()
await page.waitForTimeout(900)
ok(page.url().includes('/clientes/' + id),
  'o botão voltar continua dentro do cliente (não pula para a lista)')

// Link direto, do jeito que ela mandaria pelo WhatsApp.
await page.goto(`${B}/clientes/${id}/transcricao`)
await page.waitForTimeout(1300)
const textoTranscricao = await page.evaluate(() => document.body.innerText)
ok(/transcri/i.test(textoTranscricao), 'link direto para uma aba abre exatamente nela')

// Slug que não existe (link antigo, erro de digitação) não pode dar tela branca.
await page.goto(`${B}/clientes/${id}/aba-que-nao-existe`)
await page.waitForTimeout(1300)
const textoSlugRuim = await page.evaluate(() => document.body.innerText)
ok(textoSlugRuim.length > 300 && !/NaN|undefined/.test(textoSlugRuim),
  'slug desconhecido cai numa aba válida em vez de tela em branco')

// ── 2. AS ABAS DIZEM ONDE TEM CONTEÚDO ───────────────────────────────────────
console.log('\n══ A tira de abas como mapa, não como labirinto ══')

await page.goto(`${B}/clientes/${id}/planejamento`)
await page.waitForTimeout(1600)
const bolinhas = await page.evaluate(() =>
  document.querySelectorAll('[title="Esta aba já tem conteúdo"]').length)
ok(bolinhas >= 3,
  `as abas com conteúdo estão marcadas (${bolinhas} marcadas num cliente cheio)`)

const abasVisiveis = await page.evaluate(() =>
  [...document.querySelectorAll('[role="tab"]')].map((b) => b.textContent.trim()))
ok(abasVisiveis.length === 12, `as 12 abas estão na tira (${abasVisiveis.length})`)
ok(abasVisiveis[0].startsWith('Planejamento'),
  'a primeira aba é o Planejamento — o que se faz na reunião vem antes do pós-venda')

// ── 3. A PALETA ALCANÇA TUDO ─────────────────────────────────────────────────
console.log('\n══ Um campo que leva a qualquer lugar ══')

const abrirPaleta = async () => {
  await page.keyboard.press('Control+k')
  await page.waitForSelector('input[placeholder*="Buscar cliente"]', { timeout: 5000 })
}

// Sem digitar nada, a paleta já é útil: mostra os destinos e os recentes.
await abrirPaleta()
await page.waitForTimeout(400)
const paletaVazia = await page.evaluate(() => document.body.innerText)
// innerText devolve o texto JÁ transformado pelo CSS, e os títulos de grupo
// são uppercase — comparar sem ignorar a caixa daria falso negativo.
ok(/ir para/i.test(paletaVazia), 'a paleta abre já listando os destinos')
ok(/vistos recentemente/i.test(paletaVazia),
  'a paleta lembra dos clientes vistos recentemente')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// Achar uma TELA pelo sinônimo que a consultora usaria, não pelo nome técnico.
for (const [digitado, esperado] of [
  ['funil', '/pipeline'],
  ['whatsapp', '/mensagens'],
  ['planilha', '/importar'],
  ['seguradoras', '/cadastros'],
]) {
  await abrirPaleta()
  await page.fill('input[placeholder*="Buscar cliente"]', digitado)
  await page.waitForTimeout(350)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  ok(page.url().includes(esperado),
    `“${digitado}” leva a ${esperado} (foi para ${new URL(page.url()).pathname})`)
}

// Dentro de um cliente, a paleta oferece as abas DELE.
await page.goto(`${B}/clientes/${id}/planejamento`)
await page.waitForTimeout(1200)
await abrirPaleta()
await page.fill('input[placeholder*="Buscar cliente"]', 'dps')
await page.waitForTimeout(400)
const temAbaNoResultado = await page.evaluate(() => /neste cliente/i.test(document.body.innerText))
ok(temAbaNoResultado, '“dps” encontra a aba Formulário dentro do cliente aberto')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
ok(page.url().includes('/formulario'), 'e o Enter leva direto para ela')

// Navegar só com o teclado, sem tocar no mouse uma vez.
await abrirPaleta()
await page.fill('input[placeholder*="Buscar cliente"]', 'carlos')
await page.waitForTimeout(700)
await page.keyboard.press('ArrowDown')
await page.keyboard.press('ArrowUp')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
ok(page.url().includes('/clientes/'), 'setas + Enter navegam sem mouse nenhum')

// ── 4. ATALHOS ───────────────────────────────────────────────────────────────
console.log('\n══ Atalhos para quem usa o sistema o dia inteiro ══')

for (const [tecla, destino] of [['d', '/'], ['p', '/pipeline'], ['r', '/relatorios'], ['v', '/pos-venda']]) {
  await page.goto(B + '/clientes')
  await page.waitForTimeout(600)
  await page.keyboard.press('g')
  await page.keyboard.press(tecla)
  await page.waitForTimeout(800)
  const caminho = new URL(page.url()).pathname
  ok(caminho === destino, `"g ${tecla}" vai para ${destino} (foi para ${caminho})`)
}

// A tecla "g" sozinha não pode fazer nada: quem digita e desiste fica parado.
await page.goto(B + '/clientes')
await page.waitForTimeout(600)
await page.keyboard.press('g')
await page.waitForTimeout(1500)
await page.keyboard.press('d')
await page.waitForTimeout(600)
ok(new URL(page.url()).pathname === '/clientes',
  '"g" esquecido expira em vez de sequestrar a próxima tecla')

// "?" abre a lista de atalhos — é como alguém descobre que eles existem.
await page.keyboard.press('?')
await page.waitForTimeout(500)
const temAjuda = await page.evaluate(() => document.body.innerText.includes('Atalhos do teclado'))
ok(temAjuda, '"?" abre a lista de atalhos')
await page.keyboard.press('Escape')

// ── 5. A TRILHA RESPONDE "ONDE EU ESTOU" ─────────────────────────────────────
console.log('\n══ Onde eu estou ══')

await page.goto(`${B}/clientes/${id}/comissoes`)
await page.waitForTimeout(1300)
const trilha = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Trilha"]')
  return nav ? nav.innerText.replace(/\s+/g, ' ').trim() : null
})
ok(trilha && /Clientes/.test(trilha) && /Comiss/.test(trilha),
  `a trilha mostra o caminho completo (“${trilha}”)`)

await page.goto(B + '/relatorios')
await page.waitForTimeout(900)
const trilhaRelatorios = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Trilha"]')
  return nav ? nav.innerText.replace(/\s+/g, ' ').trim() : null
})
ok(trilhaRelatorios && /Gest/.test(trilhaRelatorios) && /Relat/.test(trilhaRelatorios),
  `a trilha nomeia a seção do menu (“${trilhaRelatorios}”)`)

// ── 6. CELULAR ───────────────────────────────────────────────────────────────
console.log('\n══ Celular (375px): tudo na altura do polegar ══')

const cel = await novaPagina({ width: 375, height: 780 })
await cel.waitForTimeout(600)

const barra = await cel.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Navegação rápida"]')
  if (!nav) return null
  const r = nav.getBoundingClientRect()
  return { itens: nav.children.length, embaixo: r.bottom >= window.innerHeight - 2, visivel: r.height > 30 }
})
ok(barra && barra.visivel && barra.embaixo, 'a barra inferior existe e está colada embaixo')
ok(barra && barra.itens === 5, `a barra tem 5 alvos, não doze (${barra?.itens})`)

// Um toque só, sem abrir menu nenhum.
await cel.click('nav[aria-label="Navegação rápida"] >> text=Pipeline')
await cel.waitForTimeout(900)
ok(new URL(cel.url()).pathname === '/pipeline', 'um toque na barra troca de tela')

// A busca também está lá — no celular é o caminho mais curto para um cliente.
await cel.click('nav[aria-label="Navegação rápida"] >> text=Buscar')
await cel.waitForTimeout(600)
const paletaNoCelular = await cel.evaluate(() =>
  !!document.querySelector('input[placeholder*="Buscar cliente"]'))
ok(paletaNoCelular, 'a busca abre pela barra inferior')
await cel.keyboard.press('Escape')

// O selo de demonstração não pode sumir no celular: ele avisa que nada é salvo.
await cel.waitForTimeout(400)
const seloVisivel = await cel.evaluate(() => {
  const alvo = [...document.querySelectorAll('span')].find((s) => s.textContent.includes('Demonstração'))
  if (!alvo) return false
  const r = alvo.getBoundingClientRect()
  return r.width > 0 && r.height > 0
})
ok(seloVisivel, 'o selo "Demonstração" continua visível a 375px')

// A barra de baixo não pode tapar o conteúdo da página.
await cel.goto(B + '/clientes')
await cel.waitForTimeout(900)
const semSobreposicao = await cel.evaluate(() => {
  const main = document.getElementById('conteudo')
  const nav = document.querySelector('nav[aria-label="Navegação rápida"]')
  if (!main || !nav) return false
  const folga = Number.parseFloat(getComputedStyle(main).paddingBottom)
  return folga >= nav.getBoundingClientRect().height
})
ok(semSobreposicao, 'a página reserva espaço para a barra (o último botão não fica escondido)')

const semRolagemLateral = await cel.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth + 2)
ok(semRolagemLateral, 'sem rolagem horizontal a 375px')

await cel.screenshot({ path: 'e2e-shots/navegacao-celular.png' })
await page.screenshot({ path: 'e2e-shots/navegacao-computador.png' })

// ── 7. ACESSIBILIDADE MÍNIMA DE TECLADO ──────────────────────────────────────
console.log('\n══ Teclado ══')

await page.goto(B + '/')
await page.waitForTimeout(800)
await page.keyboard.press('Tab')
const primeiroFoco = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
ok(/Pular para o conte/i.test(primeiroFoco),
  'o primeiro Tab oferece pular o menu e ir ao conteúdo')

console.log('\nErros de console/página:', erros.length ? erros.slice(0, 5) : 'nenhum')
console.log('\n── RESULTADO (navegação) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
await browser.close()
process.exit(falhas.length || erros.length ? 1 : 0)
