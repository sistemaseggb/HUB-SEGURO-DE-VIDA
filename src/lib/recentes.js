// Os clientes visitados recentemente, guardados no navegador.
//
// Numa terça-feira a consultora volta três, quatro vezes no mesmo cliente. A
// paleta de comandos abre já com eles à mão, e a digitação inteira some. Mora
// num arquivo próprio (e não junto do componente) para o hot reload da paleta
// continuar funcionando durante o desenvolvimento.
const CHAVE = 'hub_clientes_recentes'
const MAXIMO = 6

export function registrarVisita(cliente) {
  if (!cliente?.id) return
  try {
    const atuais = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    const novos = [
      { id: cliente.id, nome: cliente.nome, codigo: cliente.codigo ?? null },
      ...(Array.isArray(atuais) ? atuais : []).filter((c) => c?.id !== cliente.id),
    ].slice(0, MAXIMO)
    localStorage.setItem(CHAVE, JSON.stringify(novos))
  } catch { /* navegador sem storage: a paleta funciona igual, só sem recentes */ }
}

export function lerRecentes() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    return Array.isArray(v) ? v.filter((c) => c && c.id && c.nome) : []
  } catch { return [] }
}
