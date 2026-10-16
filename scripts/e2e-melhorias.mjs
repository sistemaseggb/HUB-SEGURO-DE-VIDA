import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
const server = await createServer({ server: { port: 0, host: '127.0.0.1' } })
await server.listen()
const base = server.resolvedUrls.local[0]
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.route('**/src/lib/supabase*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
 import {criarSupabaseDemo} from '/src/lib/demoDb.js';
 export const MODO_DEMO=true;export const supabase=criarSupabaseDemo();
 const from=supabase.from.bind(supabase);
 supabase.from=t=>{
  const q=from(t),insert=q.insert.bind(q);
  q.insert=p=>{insert(p);if(t==='apolices'&&window.falharVenda)q.then=(r,j)=>Promise.resolve({data:null,error:{message:'Gravação recusada no teste'}}).then(r,j);return q};
  if(t==='clientes'&&window.falharLeitura)q.then=(r,j)=>Promise.resolve({data:null,error:{message:'Consulta recusada no teste'}}).then(r,j);
  return q;
 };const rpc=supabase.rpc.bind(supabase);supabase.rpc=(fn,args)=>fn==='fn_apolice_criar'&&window.falharVenda?Promise.resolve({data:null,error:{message:'Gravação recusada no teste'}}):rpc(fn,args);window.hubTeste=supabase;
 `,
    }),
  )
  const page = await ctx.newPage()
  page.setDefaultTimeout(12000)
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.goto(base)
  await page.locator('input[type=email]').fill('teste@example.com')
  await page.locator('input[type=password]').fill('demo')
  await page.locator('button[type=submit]').click()
  await page.getByRole('heading', { name: /Natália/ }).waitFor()
  assert.ok(
    (await page.getByRole('heading', { name: 'Central do Dia', exact: true }).boundingBox()).y <
      844,
  )
  console.log('✓ Central do Dia visível na primeira tela do celular')
  await page.getByRole('button', { name: 'Registrar contato', exact: true }).first().click()
  const contato = page.getByRole('dialog')
  await contato.getByLabel('Resultado da conversa').fill('Cliente pediu a comparação')
  await contato.getByLabel('Próxima ação', { exact: false }).first().fill('Enviar comparação')
  await contato.getByRole('button', { name: 'Registrar contato e próximo passo' }).click()
  await page.getByText('Contato registrado e próxima ação agendada.', { exact: true }).waitFor()
  const follow = await page.evaluate(async () => {
    const r = await window.hubTeste.from('tarefas').select('*')
    return r.data.some((t) => t.titulo === 'Enviar comparação')
  })
  assert.ok(follow)
  console.log('✓ Registro de contato cria próximo passo confirmado')
  await page.getByRole('link', { name: 'Clientes', exact: true }).first().click()
  await page.getByText('Carlos Eduardo Menezes', { exact: true }).first().click()
  await page.locator('button:has-text("Apólices")').click()
  await page.getByRole('button', { name: 'Registrar venda', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('select').first().selectOption({ index: 1 })
  await dialog.getByLabel('Prêmio mensal', { exact: false }).fill('500')
  await dialog.getByLabel('Capital segurado', { exact: false }).fill('100000')
  await dialog.locator('input[type=date]').fill('2026-10-15')
  await page.evaluate(() => (window.falharVenda = true))
  await dialog.getByRole('button', { name: 'Confirmar venda', exact: true }).click()
  await dialog.getByRole('alert').waitFor()
  assert.equal(await dialog.getByLabel('Prêmio mensal', { exact: false }).inputValue(), '500')
  assert.equal(await page.getByText(/Venda registrada!/).count(), 0)
  await page.evaluate(() => (window.falharVenda = false))
  await dialog.getByRole('button', { name: 'Confirmar venda', exact: true }).click()
  await page.getByText(/Venda registrada!/).waitFor()
  console.log('✓ Venda rejeitada mantém formulário e campos; nova tentativa confirma gravação')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator('a[href="/mensagens"]').first().click()
  await page.getByRole('heading', { name: 'Central de Mensagens' }).waitFor()
  await page.evaluate(() => {
    window.open = () => null
  })
  const antes = await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).count()
  await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).first().click()
  await page.waitForTimeout(200)
  assert.equal(
    await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).count(),
    antes,
  )
  await page.getByRole('button', { name: 'Já enviei', exact: true }).first().click()
  await page.getByText('Marcada como enviada.', { exact: true }).waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Enviar no WhatsApp', exact: true }).count(),
    antes - 1,
  )
  console.log('✓ Abrir WhatsApp não retira mensagem da fila; confirmação manual retira')
  await page.evaluate(() => (window.falharLeitura = true))
  await page.locator('a[href="/clientes"]').first().click()
  await page.getByText('Não foi possível carregar os dados', { exact: true }).waitFor()
  assert.equal(await page.getByText('Nenhum cliente ainda', { exact: true }).count(), 0)
  await page.evaluate(() => (window.falharLeitura = false))
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await page.getByText('Carlos Eduardo Menezes', { exact: true }).first().waitFor()
  console.log('✓ Falha de leitura é distinta de carteira vazia; tentativa recupera dados')
  await page.getByText('Carlos Eduardo Menezes', { exact: true }).first().click()
  await page.locator('summary').filter({ hasText: 'Jornada da consultoria' }).click()
  await page.getByLabel('Situação da emissão', { exact: false }).selectOption('vigente')
  assert.equal(
    await page.getByLabel('Apólice vinculada', { exact: false }).getAttribute('required'),
    '',
  )
  await page.getByLabel('Situação da emissão', { exact: false }).selectOption('nao_iniciada')
  await page.getByRole('link', { name: 'Gerar proposta', exact: true }).first().click()
  await page.getByRole('button', { name: 'Copiar link do cliente', exact: true }).click()
  const pub = page.getByRole('dialog')
  assert.equal(
    await pub.getByRole('button', { name: 'Aprovar e publicar versão' }).isEnabled(),
    false,
  )
  await pub.getByRole('checkbox').check()
  await pub.getByRole('button', { name: 'Aprovar e publicar versão' }).click()
  await page.getByText(/Versão \d+ publicada/).waitFor()
  const versao = await page.evaluate(async () => {
    const r = await window.hubTeste
      .from('propostas_versoes')
      .select('*')
      .order('versao', { ascending: false })
    return r.data[0]
  })
  assert.ok(versao.token)
  assert.equal(versao.plano.observacoes_reuniao, undefined)
  assert.equal(versao.plano.condicoes_declaradas, undefined)
  console.log('✓ Publicação exige aprovação e gera versão pública sanitizada')
  await page.goto(base+'operacao')
  await page.getByRole('heading',{name:'Operação e qualidade',exact:true}).waitFor()
  await page.getByRole('heading',{name:'Premissas e fontes',exact:true}).waitFor()
  assert.equal(await page.getByText('Não foi possível carregar os dados',{exact:true}).count(),0)
  console.log('✓ Tela de operação exibe integrações e premissas sem inventar validação')
  await page.goto(base+'relatorios')
  await page.locator('summary').filter({hasText:'Conciliação por apólice'}).click()
  const conciliacao=page.locator('form').filter({has:page.getByRole('button',{name:'Salvar conciliação',exact:true})})
  await conciliacao.locator('select').first().selectOption({index:1})
  await conciliacao.getByLabel('Comissão bruta prevista neste mês').fill('100')
  await conciliacao.getByLabel('Repasse confirmado neste mês').fill('30')
  await conciliacao.getByRole('button',{name:'Salvar conciliação',exact:true}).click()
  await page.getByText('Conciliação salva.',{exact:true}).waitFor()
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:'Exportar conciliação',exact:true}).click()
  assert.ok((await download).suggestedFilename().startsWith('conciliacao-'))
  console.log('✓ Conciliação mensal salva e exportada')
  assert.deepEqual(erros, [])
  console.log('✓ Nenhum erro de JavaScript nos novos fluxos')
} finally {
  await browser?.close()
  await server.close()
}
