// ─────────────────────────────────────────────────────────────────────────────
// A REUNIÃO, DO JEITO QUE ELA ACONTECE — apresentação de ponta a ponta.
//
// O teste unitário prova que o traço está certo. Este prova que a REUNIÃO
// funciona: ela abre a proposta, entra em tela cheia, pega a caneta, desenha
// em cima do slide, mexe num número na frente do cliente e sai — e o
// planejamento continua exatamente como estava.
//
// O desenho é disparado com PointerEvent sintético de `pointerType: 'pen'` e
// pressão, porque é o único jeito de exercitar de verdade o caminho da Apple
// Pencil num navegador de teste. O caminho do dedo depois da caneta também é
// exercitado — é a rejeição de palma, e se ela falhar cada palavra escrita no
// iPad vem com um borrão do punho junto.
//
// Roda com `node scripts/e2e-apresentacao.mjs` (e junto em `npm test`).
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

// iPad deitado — o aparelho que ela usa de verdade na reunião
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } })
const page = await ctx.newPage()
const erros = []
page.on('pageerror', (e) => erros.push('PAGEERROR: ' + String(e).slice(0, 200)))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (/favicon|ERR_INTERNET_DISCONNECTED/.test(t)) return
  erros.push('CONSOLE: ' + t.slice(0, 200))
})

// Traça um risco no slide que estiver ativo. `tipo` é o pointerType: 'pen' é a
// Apple Pencil, 'touch' é o dedo (ou a palma apoiada).
async function riscar(page, pontos, tipo = 'pen') {
  return page.evaluate(({ pontos, tipo }) => {
    // a camada de cima é a que recebe ponteiro; a de baixo guarda o que já foi
    const telas = [...document.querySelectorAll('.proposta section canvas')]
    const alvo = telas.reverse().find((c) => getComputedStyle(c).pointerEvents !== 'none')
    if (!alvo) return 'nenhum quadro ativo na tela'
    const r = alvo.getBoundingClientRect()
    const disparar = (nome, p, extra = {}) => alvo.dispatchEvent(new PointerEvent(nome, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 7, pointerType: tipo, isPrimary: true,
      pressure: 0.65, buttons: 1, button: 0,
      clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height, ...extra,
    }))
    disparar('pointerdown', pontos[0])
    for (const p of pontos.slice(1)) disparar('pointermove', p)
    disparar('pointerup', pontos.at(-1), { buttons: 0, button: 0 })
    return null
  }, { pontos, tipo })
}

const RISCO = [[0.3, 0.4], [0.4, 0.45], [0.5, 0.52], [0.6, 0.5], [0.7, 0.44]]
const temGuardar = () => page.locator('button[title*="Guardar os desenhos"]').count()

// ── Chegar na proposta do Carlos ────────────────────────────────────────────
console.log('\n══ Abrindo a proposta como a consultora abre ══')
await page.goto(BASE)
await page.waitForSelector('text=Modo demonstração', { timeout: 20000 })
await page.fill('input[type=email]', 'natalia@demo.com')
await page.fill('input[type=password]', 'demo')
await page.click('button[type=submit]')
await page.waitForSelector('text=Demonstração', { timeout: 20000 })
await page.goto(BASE + '/clientes')
await page.waitForTimeout(700)
await page.locator('text=Carlos Eduardo Menezes').first().click()
await page.waitForTimeout(900)
// pelo app, nunca por page.goto: recarregar zera o banco de demonstração e a
// proposta apareceria vazia, fazendo todo o resto passar sem testar nada
await page.locator('a[href^="/proposta/"]').first().click()
await page.waitForTimeout(1800)
ok(await page.locator('.proposta section').count() > 15,
  'a proposta abriu com os capítulos do Carlos', await page.locator('.proposta section').count())

// ── As anotações que já estavam guardadas ───────────────────────────────────
console.log('\n══ O que ela desenhou na reunião passada ══')
{
  const quadros = await page.locator('.proposta section[data-slide="sucessao"] canvas').count()
  ok(quadros === 2, 'o capítulo da sucessão traz o desenho guardado (duas camadas)', quadros)
  const tinta = await page.evaluate(() => {
    const c = document.querySelector('.proposta section[data-slide="sucessao"] canvas')
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) return true
    return false
  })
  ok(tinta, 'e o desenho está PINTADO na tela, não só guardado no objeto')
}

// ── Entrar na apresentação ──────────────────────────────────────────────────
console.log('\n══ Modo apresentação ══')
await page.locator('button:has-text("Apresentar")').first().click()
await page.waitForTimeout(600)
ok(await page.evaluate(() => document.documentElement.classList.contains('apresentando')),
  'a rolagem passa a encaixar um slide por vez (classe no <html>)')
ok(await page.locator('button[title*="Próximo slide"]').isVisible(),
  'a barra da apresentadora está na tela')
ok(!(await page.locator('button:has-text("Apresentar")').first().isVisible()),
  'a barra de ações do sistema sai da frente do cliente')
{
  const alvos = await page.evaluate(() => [...document.querySelectorAll(
    '.fixed.inset-x-0.bottom-0 button')].map((b) => b.getBoundingClientRect().height))
  ok(alvos.length > 8 && alvos.every((h) => h >= 44),
    'todo botão da barra tem pelo menos 44px — ela está com o iPad na mão',
    `${alvos.length} botões, menor ${Math.min(...alvos)}px`)
}

// ── A caneta ────────────────────────────────────────────────────────────────
console.log('\n══ A Apple Pencil escrevendo por cima do slide ══')
ok(await temGuardar() === 0, 'antes de desenhar não há nada novo para guardar')
await page.locator('button[title*="Caneta"]').first().click()
await page.waitForTimeout(300)
{
  const erro = await riscar(page, RISCO)
  ok(!erro, 'a caneta encontrou o quadro do slide ativo', erro)
}
await page.waitForTimeout(400)
ok(await temGuardar() === 1, 'o traço entrou: aparece o botão de guardar')
{
  const pintou = await page.evaluate(() => {
    const telas = [...document.querySelectorAll('.proposta section canvas')]
    return telas.some((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      for (let i = 3; i < d.length; i += 4) if (d[i] > 20) return true
      return false
    })
  })
  ok(pintou, 'e o traço apareceu na tela')
}

console.log('\n══ Rejeição de palma ══')
await page.locator('button[title*="Desfazer"]').first().click()
await page.waitForTimeout(300)
ok(await temGuardar() === 0, 'desfazer volta ao estado guardado')
{
  await riscar(page, RISCO, 'touch')
  await page.waitForTimeout(400)
  ok(await temGuardar() === 0,
    'depois que uma caneta apareceu, o dedo/palma NÃO desenha mais')
}

console.log('\n══ Apontar e grifar ══')
{
  // O laser é gesto, não anotação: se ele virasse traço, cada vez que ela
  // apontasse um número sujaria o slide de vermelho para sempre.
  await page.locator('button[title*="Rastro que apaga sozinho"]').first().click()
  await page.waitForTimeout(200)
  await riscar(page, RISCO)
  await page.waitForTimeout(900)
  ok(await temGuardar() === 0, 'o laser NÃO vira traço guardado')

  await page.locator('button[title*="Grifa por cima"]').first().click()
  await page.waitForTimeout(200)
  await riscar(page, [[0.25, 0.35], [0.45, 0.35], [0.65, 0.35]])
  await page.waitForTimeout(400)
  ok(await temGuardar() === 1, 'o marcador grifa e o grifo fica')
  await page.locator('button[title*="Apagar tudo que foi desenhado"]').first().click()
  await page.waitForTimeout(300)
  ok(await temGuardar() === 0, '"limpar" apaga o capítulo inteiro de uma vez')
}

console.log('\n══ Borracha ══')
await page.locator('button[title*="Caneta"]').first().click()
await riscar(page, RISCO)
await page.waitForTimeout(300)
ok(await temGuardar() === 1, 'desenhou de novo')
await page.locator('button[title*="Encoste num traço"]').first().click()
await page.waitForTimeout(200)
await riscar(page, [[0.5, 0.52], [0.51, 0.52]])
await page.waitForTimeout(400)
ok(await temGuardar() === 0, 'a borracha encostou e o traço sumiu inteiro')

// ── A simulação ao vivo ─────────────────────────────────────────────────────
console.log('\n══ "E se fosse um pouco menos?" ══')
await page.locator('button[title*="Mexer nos números"]').first().click()
await page.waitForTimeout(400)
ok(await page.locator('text=Simulação ao vivo').isVisible(), 'o painel das alavancas abriu')
ok(await page.locator('text=Nada aqui é salvo').isVisible(),
  'e diz, em letras, que nada dali é salvo')
await page.locator('button[aria-label="Diminuir Prêmio mensal"]').click()
await page.locator('button[aria-label="Diminuir Prêmio mensal"]').click()
await page.waitForTimeout(500)
ok(await page.locator('text=Simulação — não salva').isVisible(),
  'a etiqueta amarela avisa que o número da tela é hipótese')
{
  const etiqueta = await page.locator('text=Prêmio mensal:').first().innerText()
  ok(/1\.890/.test(etiqueta) && /1\.790/.test(etiqueta),
    'a etiqueta mostra de onde veio e para onde foi', etiqueta.trim())
}
{
  // o slide do investimento tem que ter acompanhado o número novo
  const texto = await page.locator('.proposta section[data-slide="investimento"]').innerText()
  ok(/1\.790/.test(texto), 'o capítulo do investimento recalculou com o valor simulado')
}
await page.locator('button:has-text("Voltar ao planejamento")').click()
await page.waitForTimeout(500)
ok(await page.locator('text=Simulação — não salva').count() === 0, 'voltar limpa a simulação')
{
  const texto = await page.locator('.proposta section[data-slide="investimento"]').innerText()
  ok(/1\.890/.test(texto), 'e o capítulo volta ao valor do planejamento')
}
await page.locator('button[aria-label="Fechar a simulação"]').click()
await page.waitForTimeout(300)

// ── Tela preta ──────────────────────────────────────────────────────────────
console.log('\n══ Tela preta ══')
await page.keyboard.press('b')
await page.waitForTimeout(300)
ok(await page.locator('text=toque para voltar ao slide').isVisible(),
  'a tecla B apaga a tela e a atenção volta para a conversa')
await page.keyboard.press('b')
await page.waitForTimeout(300)
ok(await page.locator('text=toque para voltar ao slide').count() === 0, 'e a tecla B traz de volta')

// ── Guardar ou descartar ────────────────────────────────────────────────────
console.log('\n══ A liberdade de decidir no fim ══')
await page.locator('button[title*="Sair da apresentação"]').first().click()
await page.waitForTimeout(400)
ok(await page.locator('text=Guardar os desenhos desta reunião?').count() === 0,
  'sem desenho novo, ela sai direto — o sistema não pergunta à toa')
ok(!(await page.locator('button[title*="Próximo slide"]').isVisible()),
  'saiu da apresentação')

await page.locator('button:has-text("Apresentar")').first().click()
await page.waitForTimeout(500)
await page.locator('button[title*="Caneta"]').first().click()
await riscar(page, RISCO)
await page.waitForTimeout(400)
await page.locator('button[title*="Sair da apresentação"]').first().click()
await page.waitForTimeout(400)
ok(await page.locator('text=Guardar os desenhos desta reunião?').isVisible(),
  'com desenho novo, ela é PERGUNTADA — nem guarda sozinho, nem joga fora sozinho')
ok(await page.locator('button:has-text("Descartar")').isVisible()
  && await page.locator('button:has-text("Guardar os desenhos")').isVisible()
  && await page.locator('button:has-text("Voltar à apresentação")').isVisible(),
  'as três saídas estão à mão: guardar, descartar e voltar')

await page.locator('button:has-text("Voltar à apresentação")').click()
await page.waitForTimeout(300)
ok(await page.locator('button[title*="Próximo slide"]').isVisible(),
  '"voltar à apresentação" volta mesmo, com o desenho no lugar')
ok(await temGuardar() === 1, 'e o traço continua lá, esperando a decisão')

await page.locator('button[title*="Sair da apresentação"]').first().click()
await page.waitForTimeout(300)
await page.locator('button:has-text("Guardar os desenhos")').click()
await page.waitForTimeout(900)
ok(await page.locator('text=Guardar os desenhos desta reunião?').count() === 0,
  'guardou e saiu')

// ── O planejamento não foi tocado ───────────────────────────────────────────
console.log('\n══ O planejamento continua sendo a fonte da verdade ══')
await page.locator('a:has-text("Voltar ao cliente")').first().click()
await page.waitForTimeout(1200)
await page.locator('button:has-text("Planejamento")').first().click()
await page.waitForTimeout(1200)
{
  const premio = await page.evaluate(() => {
    const campos = [...document.querySelectorAll('input')]
    const alvo = campos.find((i) => /1\.?890|1890/.test(i.value ?? ''))
    return alvo ? alvo.value : null
  })
  ok(premio !== null,
    'o prêmio do planejamento continua o do banco, apesar da simulação na reunião', premio)
}

// ── Navegação por índice, no celular do cliente ─────────────────────────────
console.log('\n══ Índice de capítulos ══')
await page.locator('a[href^="/proposta/"]').first().click()
await page.waitForTimeout(1600)
await page.locator('button:has-text("Apresentar")').first().click()
await page.waitForTimeout(500)
await page.locator('button[title="Índice dos capítulos"]').click()
await page.waitForTimeout(400)
{
  const linhas = await page.locator('text=Cada coisa serve para uma coisa').count()
  ok(linhas > 0, 'o índice lista os capítulos pelo nome curto')
}
await page.locator('button:has-text("O cruzamento")').first().click()
await page.waitForTimeout(1400)
{
  const posicao = await page.evaluate(() => {
    const s = document.querySelector('.proposta section[data-slide="cruzamento"]')
    return Math.abs(s.getBoundingClientRect().top)
  })
  ok(posicao < 90, 'clicar no índice leva ao capítulo, encaixado no topo', `${Math.round(posicao)}px`)
}
await page.keyboard.press('Escape')

// ── Sem rolagem lateral em nenhum dos formatos do iPad ──────────────────────
console.log('\n══ iPad em pé e deitado ══')
for (const [L, A, nome] of [[1180, 820, 'deitado'], [820, 1180, 'em pé'], [1024, 768, 'iPad menor']]) {
  await page.setViewportSize({ width: L, height: A })
  await page.waitForTimeout(700)
  const r = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    limite: document.documentElement.clientWidth,
  }))
  ok(r.largura <= r.limite + 2, `${nome}: sem rolagem lateral`, `${r.largura}px em ${r.limite}px`)
}

ok(erros.length === 0, 'nenhum erro de console ou de página durante a reunião inteira',
  erros.slice(0, 3).join(' | '))

console.log('\n── RESULTADO (apresentação e2e) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
await browser.close()
process.exit(falhas.length ? 1 : 0)
