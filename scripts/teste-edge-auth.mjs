import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transformWithOxc } from 'vite'

for (const nome of ['sync-outlook', 'analisar-reuniao']) {
  const fonte = readFileSync(`supabase/functions/${nome}/index.ts`, 'utf8')
    .replace(/^import .*$/gm, '')
  const { code } = await transformWithOxc(fonte, 'index.ts')
  let handler
  let consultas = 0
  const env = { SUPABASE_URL: 'https://teste.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'servico' }
  const createClient = () => ({
    auth: { getUser: async token => ({ data: { user: token === 'usuario' ? { id: 'teste' } : null }, error: null }) },
    from: () => { consultas++; return { select: () => ({ eq: () => ({ single: async () => ({ data: { outlook_sync_ativo: false } }) }) }) } },
  })
  new Function('Deno', 'createClient', 'Anthropic', code)(
    { env: { get: k => env[k] }, serve: fn => { handler = fn } }, createClient,
    class { constructor() { throw new Error('Não deve chamar o provedor neste teste') } },
  )
  const chamar = (method, token) => handler(new Request('https://teste.invalid', {
    method, headers: token ? { authorization: `Bearer ${token}` } : {},
  }))
  const options = await chamar('OPTIONS')
  assert.equal(options.status, 200)
  assert.equal(options.headers.get('Access-Control-Allow-Origin'), '*')
  assert.equal((await chamar('GET')).status, 405)
  assert.equal((await chamar('POST')).status, 401)
  assert.equal((await chamar('POST', 'anon')).status, 401)
  assert.equal((await chamar('POST', 'invalido')).status, 401)
  assert.equal(consultas, 0)
  assert.equal((await chamar('POST', 'usuario')).status, nome === 'sync-outlook' ? 200 : 501)
  if (nome === 'sync-outlook') assert.equal((await chamar('POST', 'servico')).status, 200)
  console.log(`✓ ${nome}: CORS, método, bloqueio anônimo, sessão válida${nome === 'sync-outlook' ? ' e agendador' : ''}`)
}
