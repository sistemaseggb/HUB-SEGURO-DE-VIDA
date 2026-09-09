// Regressões com respostas de erro/rejeições de RPC, sem acessar dados reais.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { ETAPAS_FORM } from '../src/lib/formularioConfig.js'

const servidor = await createServer({ server: { port: 0, host: '127.0.0.1' } })
await servidor.listen()
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
  const ctx = await browser.newContext()
  await ctx.route('**/src/lib/supabase*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      export const MODO_DEMO = false;
      window.mock = { falha: null, chamadas: [], ativas: 0, maxAtivas: 0, etapa: 0 };
      export const supabase = {
        auth: {
          getSession: async () => { throw new Error('rede'); },
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          signInWithPassword: async () => { throw new Error('rede'); }
        },
        rpc: async (nome, args) => {
          const m = window.mock;
          if (nome.endsWith('carregar')) return { data: {
            primeiro_nome: 'Teste', respostas: {}, status: 'pendente', etapa_atual: args.p_token === 'final' ? ${ETAPAS_FORM.length - 1} : args.p_token === 'planejamento' ? 1 : m.etapa
          }, error: null };
          m.chamadas.push({ nome, args });
          m.ativas++; m.maxAtivas = Math.max(m.maxAtivas, m.ativas);
          try {
            if (m.demora) await new Promise(r => setTimeout(r, m.demora));
            if (m.falha === 'rejeicao') throw new Error('offline');
            if (m.falha === 'rpc') return { data: { erro: 'falha' }, error: null };
            if (m.falha === 'http') return { data: null, error: { message: 'indisponivel' } };
            if (m.falha === 'vazio') return { data: null, error: null };
            return { data: { ok: true }, error: null };
          } finally { m.ativas--; }
        }
      };
    `,
  }))
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', e => erros.push(e.message))
  const base = servidor.resolvedUrls.local[0].replace(/\/$/, '')

  await page.goto(base)
  await page.locator('input[type=email]').fill('teste@example.com')
  await page.locator('input[type=password]').fill('teste')
  await page.locator('button[type=submit]').click()
  await page.getByText('Não foi possível entrar.', { exact: false }).waitFor()
  assert.equal(await page.locator('button[type=submit]').isEnabled(), true)
  console.log('✓ Falha de sessão abre login; falha de login libera nova tentativa')

  await page.goto(base + '/f/teste')
  await page.getByRole('button', { name: 'Começar' }).waitFor()
  for (const falha of ['http', 'rpc', 'vazio', 'rejeicao']) {
    await page.evaluate(f => { window.mock.falha = f }, falha)
    await page.getByRole('button', { name: 'Começar' }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Começar' }).isEnabled(), true)
    console.log('✓ DPS não avança nem confirma gravação com falha: ' + falha)
  }
  await page.evaluate(() => { window.mock.falha = null })
  await page.getByRole('button', { name: 'Começar' }).click()
  await page.getByRole('heading', { name: ETAPAS_FORM[0].titulo }).waitFor()
  await page.locator('input').first().fill('Nome preservado')
  await page.getByText('alterações ainda não salvas').waitFor()
  assert.equal(await page.locator('input').first().inputValue(), 'Nome preservado')
  console.log('✓ Edição não aparece como salva antes da confirmação do banco')

  // Carrega diretamente a última etapa para verificar a confirmação final.
  await page.goto(base + '/f/final')
  await page.getByRole('button', { name: /Enviar tudo/ }).waitFor()
  await page.evaluate(() => { window.mock.falha = 'rejeicao' })
  await page.getByRole('button', { name: /Enviar tudo/ }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByText(/Recebemos seus dados/).count(), 0)
  await page.evaluate(() => { window.mock.falha = null })
  await page.getByRole('button', { name: /Enviar tudo/ }).click()
  await page.getByText(/Recebemos seus dados/).waitFor()
  console.log('✓ Conclusão só aparece após RPC confirmar; nova tentativa funciona')
  await page.goto(base + '/pl/planejamento')
  await page.getByRole('heading', { name: 'Você e sua família' }).waitFor()
  await page.evaluate(() => { window.mock.demora = 3000 })
  await page.locator('input').first().fill('Primeira resposta')
  await page.waitForFunction(() => window.mock.ativas === 1)
  await page.locator('input').first().fill('Resposta mais recente')
  await page.waitForFunction(() => window.mock.chamadas.length >= 2 && window.mock.ativas === 0, { timeout: 15000 })
  const gravacoes = await page.evaluate(() => window.mock)
  assert.equal(gravacoes.maxAtivas, 1)
  assert.equal(gravacoes.chamadas.at(-1).args.p_respostas.profissao, 'Resposta mais recente')
  console.log('✓ Autosaves lentos são serializados e preservam a resposta mais recente')
  assert.deepEqual(erros, [])
} finally {
  await browser?.close()
  await servidor.close()
}
