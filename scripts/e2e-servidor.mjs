// Sobe o `vite preview` sozinho quando ele não está no ar.
//
// Antes, `npm run test:e2e` só funcionava se alguém tivesse deixado
// `npm run preview` rodando noutro terminal. Esquecer disso derrubava as 40
// checagens de uma vez com ERR_CONNECTION_REFUSED — o que parece um sistema
// quebrado quando é só o servidor ausente. Agora a suíte se vira sozinha:
// reaproveita um preview que já esteja rodando e, se não houver, sobe um e o
// derruba no fim.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

export const BASE = process.env.E2E_BASE ?? 'http://localhost:4173'

async function respondendo(url, timeoutMs = 1500) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    // sem proxy: o preview é local e o proxy do ambiente recusaria a conexão
    const r = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    return r.ok
  } catch { return false }
}

export async function garantirServidor() {
  if (await respondendo(BASE)) return () => {}

  if (!existsSync('dist/index.html')) {
    console.error('✗ dist/ não existe — rode `npm run build` antes dos testes.')
    process.exit(1)
  }

  console.log('· preview não estava no ar; subindo um para os testes')
  const porta = new URL(BASE).port || '4173'
  const filho = spawn('npx', ['vite', 'preview', '--port', porta], {
    stdio: 'ignore', detached: false,
  })
  filho.on('error', (e) => {
    console.error('✗ não consegui subir o preview:', e.message)
    process.exit(1)
  })

  for (let i = 0; i < 60; i++) {
    if (await respondendo(BASE)) {
      const parar = () => { try { filho.kill('SIGTERM') } catch { /* já morreu */ } }
      process.on('exit', parar)
      return parar
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  filho.kill('SIGTERM')
  console.error(`✗ o preview não respondeu em ${BASE} depois de 30s.`)
  process.exit(1)
}
