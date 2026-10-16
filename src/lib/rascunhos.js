// O conteúdo fica cifrado; a chave só permanece na sessão deste navegador.
// Isso não protege contra código malicioso na mesma origem. Não use em dispositivo compartilhado.
const PREFIXO = 'hub_rascunho_v1:'
const chaves = new Map()
const base64 = (b) => {
  let s = ''
  for (const n of new Uint8Array(b)) s += String.fromCharCode(n)
  return btoa(s)
}
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
async function chave(usuario) {
  if (!chaves.has(usuario))
    chaves.set(
      usuario,
      (async () => {
        const nome = PREFIXO + 'chave:' + usuario
        let raw = sessionStorage.getItem(nome)
        if (!raw) {
          raw = base64(crypto.getRandomValues(new Uint8Array(32)))
          sessionStorage.setItem(nome, raw)
        }
        return crypto.subtle.importKey('raw', bytes(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
      })(),
    )
  return chaves.get(usuario)
}
export async function guardarRascunho(usuario, cliente, valor) {
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await chave(usuario)
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(valor)),
  )
  localStorage.setItem(
    PREFIXO + usuario + ':' + cliente,
    JSON.stringify({ em: Date.now(), iv: base64(iv), dados: base64(cifrado) }),
  )
}
export async function lerRascunho(usuario, cliente) {
  const nome = PREFIXO + usuario + ':' + cliente,
    raw = localStorage.getItem(nome)
  if (!raw) return null
  try {
    const r = JSON.parse(raw)
    if (Date.now() - r.em > 86400000) throw Error('expirado')
    const valor = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(r.iv) },
      await chave(usuario),
      bytes(r.dados),
    )
    return JSON.parse(new TextDecoder().decode(valor))
  } catch {
    localStorage.removeItem(nome)
    return null
  }
}
export function apagarRascunhos() {
  for (const storage of [localStorage, sessionStorage]) {
    for (const k of Object.keys(storage)) if (k.startsWith(PREFIXO)) storage.removeItem(k)
  }
  chaves.clear()
}

export function apagarRascunho(usuario, cliente) {
  localStorage.removeItem(PREFIXO + usuario + ':' + cliente)
}
