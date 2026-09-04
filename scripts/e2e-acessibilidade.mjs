// ─────────────────────────────────────────────────────────────────────────────
// ACESSIBILIDADE — o sistema continua utilizável sem enxergar a tela.
//
// O Hub é usado com pressa, no meio de uma reunião, às vezes com o teclado e
// sem o mouse. A navegação já foi desenhada para isso (paleta de comandos,
// atalhos, o primeiro Tab oferecendo pular o menu). O que faltava era cobrar
// que a tela continue dizendo o que faz quando o CONTEÚDO some — que é a
// situação de quem usa leitor de tela e, no fundo, o mesmo teste de se cada
// controle sabe se apresentar sozinho.
//
// Três coisas são cobradas em cada tela, e as três são objetivas:
//
//   · TODO CONTROLE TEM NOME. Um botão que é só um ícone é anunciado como
//     "botão" e mais nada. Não é acessório: é o botão que ela não sabe o que
//     faz quando o ícone não carrega, e o link que o buscador não entende.
//
//   · TODO CAMPO TEM RÓTULO. Um `select` de filtro sem rótulo é anunciado
//     apenas pelo valor atual ("Agendada"), sem dizer de quê. Numa lista com
//     dez linhas iguais, o rótulo precisa dizer de QUAL linha ele é — por isso
//     os desta tela carregam o nome do cliente ou o assunto da reunião.
//
//   · TODA IMAGEM TEM ALT, E CADA TELA TEM UM h1. É como o leitor de tela
//     responde "onde eu estou", que é a mesma pergunta que a trilha do topo
//     responde para quem enxerga.
//
// A régua é ZERO, não "poucos": um controle sem nome não incomoda um pouco,
// ele simplesmente não é utilizável. E zero é a única régua que não afrouxa
// sozinha com o tempo.
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

// A auditoria roda DENTRO da página: é o DOM de verdade, depois do React
// montar, e não uma leitura do JSX. Um `aria-label` que a build derrubou não
// passaria despercebido aqui.
const AUDITAR = () => {
  const visivel = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  // O nome acessível, na ordem em que o navegador o resolve.
  const nomeDe = (el) => {
    const aria = el.getAttribute('aria-label')
    if (aria?.trim()) return aria.trim()
    const por = el.getAttribute('aria-labelledby')
    if (por) {
      const t = por.split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText ?? '').join(' ').trim()
      if (t) return t
    }
    if (el.getAttribute('title')?.trim()) return el.getAttribute('title').trim()
    if ((el.innerText ?? '').trim()) return el.innerText.trim()
    const img = el.querySelector('img[alt]')
    if (img?.getAttribute('alt')?.trim()) return img.getAttribute('alt').trim()
    return ''
  }
  const resumo = (el) => (el.outerHTML ?? '').slice(0, 110).replace(/\s+/g, ' ')

  const semNome = []
  for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
    if (visivel(el) && !nomeDe(el)) semNome.push(resumo(el))
  }

  const semRotulo = []
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!visivel(el) || el.type === 'hidden') continue
    const id = el.getAttribute('id')
    const rotulado = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
      || el.closest('label')
      || el.getAttribute('aria-label')
      || el.getAttribute('aria-labelledby')
    if (!rotulado) semRotulo.push(resumo(el))
  }

  const semAlt = [...document.querySelectorAll('img')]
    .filter((i) => visivel(i) && i.getAttribute('alt') == null)
    .map((i) => i.getAttribute('src'))

  return { semNome, semRotulo, semAlt, h1: document.querySelectorAll('h1').length }
}

async function revistar(page, rotulo, { exigirH1 = true } = {}) {
  await page.waitForTimeout(600)
  const r = await page.evaluate(AUDITAR)
  ok(r.semNome.length === 0, `${rotulo}: todo controle tem nome acessível`,
    r.semNome.slice(0, 3).join(' | '))
  ok(r.semRotulo.length === 0, `${rotulo}: todo campo tem rótulo`,
    r.semRotulo.slice(0, 3).join(' | '))
  ok(r.semAlt.length === 0, `${rotulo}: toda imagem tem alt`, r.semAlt.slice(0, 3).join(' | '))
  if (exigirH1) ok(r.h1 === 1, `${rotulo}: exatamente um h1`, `h1=${r.h1}`)
}

async function entrar(viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.waitForSelector('text=Modo demonstração', { timeout: 20000 })
  await page.fill('input[type=email]', 'natalia@demo.com')
  await page.fill('input[type=password]', 'demo')
  await page.click('button[type=submit]')
  await page.waitForSelector('text=Demonstração', { timeout: 20000 })
  return page
}

const ROTAS = [
  ['/', 'Dashboard'], ['/clientes', 'Clientes'], ['/pipeline', 'Pipeline'],
  ['/agenda', 'Agenda'], ['/relatorios', 'Relatórios'], ['/pos-venda', 'Pós-Venda'],
  ['/mensagens', 'Mensagens'], ['/cadastros', 'Cadastros'], ['/gb-awards', 'GB Awards'],
  ['/importar', 'Importar'], ['/guia', 'Guia'],
]

// As abas do cliente concentram a maior parte dos controles do sistema — e são
// justamente as que mais mudam. É onde uma regressão apareceria primeiro.
const ABAS = ['Dossiê', 'Planejamento', 'Comparador', 'Roteiro', 'Transcrição',
  'Interações', 'Reuniões', 'Apólices', 'Comissões', 'Documentos', 'Formulário',
  'Tarefas', 'Histórico']

console.log('\n══ Computador (1440px) ══')
{
  const page = await entrar({ width: 1440, height: 1000 })
  for (const [rota, rotulo] of ROTAS) {
    await page.goto(BASE + rota)
    await revistar(page, rotulo)
  }

  await page.goto(BASE + '/clientes')
  await page.waitForTimeout(700)
  const link = page.locator('text=Carlos Eduardo Menezes').first()
  if (await link.count() > 0) {
    await link.click()
    await page.waitForTimeout(1000)
    console.log('\n· Carlos Eduardo Menezes — as abas do cliente')
    for (const aba of ABAS) {
      const b = page.locator(`button:has-text("${aba}")`).first()
      if (await b.count() === 0) continue
      await b.click()
      // as abas do cliente vivem sob o h1 da página do cliente
      await revistar(page, `  ${aba}`, { exigirH1: false })
    }
  } else {
    console.log('· cliente de demonstração não está no seed — abas não revistadas')
  }
  await page.context().close()
}

// No celular a barra inferior e a busca aparecem, e o menu lateral some: são
// controles diferentes, então precisam ser revistados de novo.
console.log('\n══ Celular (390px) ══')
{
  const page = await entrar({ width: 390, height: 780 })
  for (const [rota, rotulo] of ROTAS) {
    await page.goto(BASE + rota)
    await revistar(page, rotulo)
  }
  await page.context().close()
}

await browser.close()
console.log('\n── RESULTADO (acessibilidade) ──')
console.log(falhas.length === 0 ? 'Falhas: nenhuma 🎉' : `Falhas: ${falhas.length}`)
for (const f of falhas) console.log(`  ${f}`)
process.exit(falhas.length ? 1 : 0)
