// Testes de ponta a ponta do Hub em MODO DEMONSTRAÇÃO.
//
// Como rodar:
//   npm run build && npm run test:e2e
//
// A suíte sobe o `vite preview` sozinha se ele não estiver no ar (e reaproveita
// um que já esteja rodando), então não precisa de dois terminais.
//
// Cobre a visão da CONSULTORA (login, dashboard, pipeline, cliente 360 com o
// planejamento completo, transcrição da reunião, apólices, DPS, proposta,
// relatórios, pós-venda, agenda, mensagens, cadastros) e a visão do CLIENTE
// (formulário público de DPS pelo link, com validação e campo condicional).
// Capturas em e2e-shots/.
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as XLSX from 'xlsx'

import { BASE, garantirServidor } from './e2e-servidor.mjs'
await garantirServidor()
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

await passo('Cliente 360 → Planejamento com a apólice completa', async () => {
  await page.click('text=Carlos Eduardo Menezes')
  await page.waitForSelector('text=As coberturas da apólice', { timeout: 6000 })
  await page.waitForSelector('text=Resumo do estudo', { timeout: 3000 })
  // os grupos do catálogo de coberturas, incluindo as novas
  for (const t of ['Proteção essencial', 'Proteção em vida', 'Acidentes', 'Assistências']) {
    await page.waitForSelector(`text=${t}`, { timeout: 3000 })
  }
  for (const c of ['Morte acidental (MA)', 'Fraturas', 'Diária por internação hospitalar (DIH)',
    'Assistência funeral — individual', 'Assistência funeral — familiar']) {
    await page.waitForSelector(`text=${c}`, { timeout: 3000 })
  }
  await shot('05-planejamento')
})

await passo('Planejamento → raio-X do patrimônio e sucessão', async () => {
  await page.waitForSelector('text=Raio-X do patrimônio', { timeout: 5000 })
  await page.waitForSelector('text=Previdência (VGBL/PGBL)', { timeout: 3000 })
  await page.waitForSelector('text=Déficit de liquidez', { timeout: 3000 })
  // a barra do mapa patrimonial e a legenda do que trava no inventário
  await page.waitForSelector('text=/passa por inventário/i', { timeout: 3000 })
})

await passo('Planejamento → bloco da empresa (PJ) e prêmio anual', async () => {
  await page.waitForSelector('text=A empresa', { timeout: 5000 })
  // razão social é valor de input, não texto da página
  await page.waitForSelector('input[value="Cardiocare Serviços Médicos Ltda"]', { timeout: 3000 })
  await page.waitForSelector('text=Quota do cliente', { timeout: 3000 })
  await page.waitForSelector('text=Capital de homem-chave', { timeout: 3000 })
  await page.waitForSelector('text=Prêmio anual à vista', { timeout: 3000 })
  await page.waitForSelector('text=Economia no anual', { timeout: 3000 })
  await shot('05b-planejamento-pj')
})

await passo('Planejamento → filhos com gasto até os 24', async () => {
  await page.waitForSelector('text=o gasto que tem prazo para acabar', { timeout: 5000 })
  await page.waitForSelector('text=Gasto com filhos hoje', { timeout: 3000 })
})

await passo('Cliente 360 → Transcrição: análise da reunião do Tactiq', async () => {
  await page.click('button:has-text("Transcrição")')
  await page.waitForSelector('text=Como usar a transcrição', { timeout: 6000 })
  // abre a transcrição já salva no demo e confere a análise
  await page.click('text=Abrir e reanalisar')
  await page.waitForSelector('text=Como esta reunião foi conduzida', { timeout: 8000 })
  await page.waitForSelector('text=O que dá para aplicar no planejamento', { timeout: 4000 })
  for (const t of ['Renda mensal', 'Custo de vida mensal', 'Previdência', 'Filhos']) {
    await page.waitForSelector(`text=${t}`, { timeout: 3000 })
  }
  await page.waitForSelector('text=Objeções e como responder', { timeout: 3000 })
  await page.waitForSelector('text=Compromissos assumidos', { timeout: 3000 })
  await page.waitForSelector('text=Resumo executivo', { timeout: 3000 })
  await shot('05c-transcricao')
})

await passo('Transcrição → colar texto novo dispara a análise na hora', async () => {
  await page.click('text=Limpar')
  await page.fill('textarea', [
    'Natália Maschendorf: Qual a sua renda hoje?',
    'Cliente: Ganho R$ 18.000 por mês e gasto uns R$ 11 mil.',
    'Natália Maschendorf: Quem depende de você?',
    'Cliente: Meus filhos de 5 e 9 anos. Achei um pouco caro, vou pensar.',
    'Natália Maschendorf: Vou te mandar a proposta amanhã.',
  ].join('\n'))
  await page.waitForSelector('text=Como esta reunião foi conduzida', { timeout: 6000 })
  // os números falados viram campos aplicáveis ao planejamento.
  // \s no lugar do espaço: o formato de moeda usa espaço não separável.
  await page.waitForSelector('text=/R\\$\\s*18\\.000/', { timeout: 4000 })
  await page.waitForSelector('text=/R\\$\\s*11\\.000/', { timeout: 3000 })
  await page.waitForSelector('text=/filho\\(a\\) \\(5\\)/', { timeout: 3000 })
  await page.waitForSelector('text=Preço / cabe no orçamento', { timeout: 3000 })
  await page.click('button:has-text("Planejamento")')
  await page.waitForTimeout(400)
})

await passo('Cliente 360 → Roteiro da reunião (script guiado)', async () => {
  await page.click('button:has-text("Roteiro")')
  await page.waitForSelector('text=Roteiro da reunião', { timeout: 5000 })
  await page.waitForSelector('text=Abertura e conexão', { timeout: 3000 })
  await page.waitForSelector('text=Como conduzir', { timeout: 3000 })
  // volta para o Planejamento para os próximos passos que esperam a aba de apólices
  await page.click('button:has-text("Apólices")')
  await page.waitForTimeout(300)
})

await passo('Cliente 360 → Apólices com status', async () => {
  await page.click('button:has-text("Apólices")')
  await page.waitForSelector('text=Ativa', { timeout: 5000 })
  await page.waitForSelector('text=registradas no Hub', { timeout: 3000 })
  await page.waitForSelector('text=pré-sistema', { timeout: 3000 })
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
  // Carlos é um estudo PF + PJ: a capa muda de acordo com o tipo
  await page.waitForSelector('text=/estudo de proteção pessoal e empresarial/i', { timeout: 6000 })
  await shot('08-proposta-capa')
  await page.waitForSelector('text=/não é sobre morrer/i', { timeout: 3000 })
  await page.waitForSelector('text=/cada filho protegido até os 24/i', { timeout: 3000 })
  await page.waitForSelector('text=/raio-x do patrimônio/i', { timeout: 3000 })
  await page.waitForSelector('text=/inventário custa caro/i', { timeout: 3000 })
  await page.waitForSelector('text=/a conta do primeiro mês/i', { timeout: 3000 })
  await page.waitForSelector('text=/não pode virar sócia de ninguém/i', { timeout: 3000 })
  await page.waitForSelector('text=/quatro passos simples/i', { timeout: 3000 })
  await page.waitForSelector('button:has-text("Copiar link do cliente")', { timeout: 3000 })
})

await passo('Proposta → quadro de coberturas e as duas formas de pagamento', async () => {
  // as coberturas novas aparecem no quadro da apólice
  for (const c of ['Morte acidental', 'Fraturas', 'Diária de internação',
    'Funeral individual', 'Funeral familiar']) {
    await page.waitForSelector(`text=${c}`, { timeout: 3000 })
  }
  // mensal e anual lado a lado, com a escolha do cliente destacada
  await page.waitForSelector('text=Anual à vista', { timeout: 3000 })
  await page.waitForSelector('text=sua escolha', { timeout: 3000 })
  await page.waitForSelector('text=/10% de desconto/', { timeout: 3000 })
  await page.waitForSelector('text=/economia de/i', { timeout: 3000 })
  await shot('08b-proposta-investimento')
})

await passo('Proposta pública pelo link (/p/<token>, sem login)', async () => {
  const anonima = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await anonima.goto(`${BASE}/p/demo-proposta-carlos`)
  await anonima.waitForSelector('text=Estudo preparado por', { timeout: 6000 })
  await anonima.waitForSelector('text=/estudo de proteção pessoal e empresarial/i', { timeout: 3000 })
  await anonima.screenshot({ path: 'e2e-shots/16-proposta-publica.png' })
  await anonima.context().close()
})

await passo('Guia passo a passo abre e mostra a jornada', async () => {
  await page.goto(BASE + '/guia')
  await page.waitForSelector('text=A jornada completa do cliente', { timeout: 6000 })
  await page.waitForSelector('text=Conduza a reunião com o roteiro', { timeout: 3000 })
  await shot('15-guia')
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

await passo('Importar → Planilha geral (Seguros Fechados) lê .xlsx e importa', async () => {
  // gera um mini-xlsx no formato da planilha real (aba "Propostas fechadas")
  const linhas = [
    ['NOME / RAZÃO SOCIAL', 'CÓD. CLIENTE', 'ESPECIALISTA', 'COMISSÃO', 'ASSESSOR', 'COD. AI', 'APÓLICE', 'SEGURADORA', 'PRÊMIO ANUAL', '', 'PRÊMIO MES', 'DATA', 'TIPO', '', 'STATUS', 'MOTIVO CANCELAMENTO'],
    ['Teste Importado Um', 900001, 'Nati', 0.4, 'Assessor Teste', 'AT01', 'AP-E2E-1', 'Prudential', 2400, '', 200, 45200, 'RESGATÁVEL', '', 'ATIVO', ''],
    ['Teste Importado Dois', 900002, 'Nati', 0.4, 'Assessor Teste', 'AT01', 'AP-E2E-2', 'MAG', 3600, '', 300, 45210, 'RESGATÁVEL', '', 'CANCELADO', 'inadimplência'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Propostas fechadas')
  const caminho = join(tmpdir(), 'e2e-planilha-geral.xlsx')
  XLSX.writeFile(wb, caminho)

  await page.goto(BASE + '/importar')
  await page.click('button:has-text("Planilha geral")')
  await page.setInputFiles('input[type=file]', caminho)
  await page.waitForSelector('text=Apólices na planilha', { timeout: 8000 })
  await page.waitForSelector('text=Teste Importado Um', { timeout: 3000 })
  await shot('14-planilha-geral')
  await page.click('button:has-text("Importar / atualizar")')
  await page.waitForSelector('text=/nova\\(s\\)/', { timeout: 10000 })
  const txt = await page.locator('p:has-text("nova(s)")').first().innerText()
  if (!/2 apólice/.test(txt)) throw new Error('esperava 2 apólices importadas: ' + txt.slice(0, 80))
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
