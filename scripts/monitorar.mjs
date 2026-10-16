// Execute com Node 24 e NODE_USE_ENV_PROXY=1 quando o ambiente usar proxy.
// Não imprime chaves nem corpo de respostas de autenticação.
const site = process.env.HUB_SITE_URL || 'https://hub-seguro-de-vida.vercel.app'
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const resultados = []
async function verificar(nome, endereco, headers = {}) {
  const inicio = Date.now()
  try {
    const r = await fetch(endereco, {
      headers,
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    resultados.push({ nome, ok: true, ms: Date.now() - inicio })
  } catch (e) {
    resultados.push({
      nome,
      ok: false,
      erro: e.name === 'TimeoutError' ? 'Tempo limite excedido' : e.message,
    })
  }
}
await verificar('Site público', site)
if (url && key)
  await verificar('Autenticação', url.replace(/\/$/, '') + '/auth/v1/health', { apikey: key })
else
  resultados.push({
    nome: 'Autenticação',
    ok: false,
    erro: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para validar o backend',
  })
console.log(JSON.stringify({ verificado_em: new Date().toISOString(), resultados }, null, 2))
if (resultados.some((r) => !r.ok)) process.exitCode = 1
