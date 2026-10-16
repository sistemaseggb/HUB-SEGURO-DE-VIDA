// Erros nunca devem ser confundidos com uma resposta vazia.
export function conferir(...resultados) {
  for (const r of resultados) {
    if (r?.error) throw new Error(r.error.message || 'Não foi possível concluir a operação.')
  }
  return resultados[0]?.data
}
export const mensagemErro = (erro) => erro?.message || 'Verifique a conexão e tente novamente.'
export async function paginasCompletas(buscar, tamanho = 1000) {
  const todas = []
  for (let inicio = 0; ; inicio += tamanho) {
    const r = await buscar(inicio, inicio + tamanho - 1)
    conferir(r)
    if (!r.data?.length) return todas
    todas.push(...r.data)
    if (r.data.length < tamanho) return todas
  }
}
