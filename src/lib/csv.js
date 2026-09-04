// Parser de CSV tolerante: detecta o separador (; , ou tab), respeita aspas
// e devolve { cabecalho: [...], linhas: [[...], ...] }
export function parseCSV(texto) {
  // A PORTA DE ENTRADA DE TODA PLANILHA DO SISTEMA. O que chega aqui vem de
  // `FileReader`, de colagem no textarea e da leitura de .xlsx — três caminhos
  // que devolvem string quase sempre, e `null` quando a leitura falha. Quando
  // isso acontecia, a tela de Importar quebrava com "Cannot read properties of
  // null" em vez de dizer que o arquivo não deu para ler. Planilha vazia e
  // planilha ilegível são a mesma resposta para quem está importando: não veio
  // nada. `planilhaGeral.js`, que é o leitor irmão deste, já tratava assim.
  if (typeof texto !== 'string') return { cabecalho: [], linhas: [] }
  const limpo = texto.replace(/^﻿/, '').trim()
  if (!limpo) return { cabecalho: [], linhas: [] }

  const primeiraLinha = limpo.split(/\r?\n/, 1)[0]
  const sep = [';', ',', '\t']
    .map((s) => [s, (primeiraLinha.match(new RegExp(`\\${s}`, 'g')) ?? []).length])
    .sort((a, b) => b[1] - a[1])[0][0]

  const linhas = []
  let atual = []
  let campo = ''
  let dentroAspas = false
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]
    if (dentroAspas) {
      if (ch === '"' && limpo[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') dentroAspas = false
      else campo += ch
    } else if (ch === '"') {
      dentroAspas = true
    } else if (ch === sep) {
      atual.push(campo.trim()); campo = ''
    } else if (ch === '\n' || (ch === '\r' && limpo[i + 1] === '\n')) {
      if (ch === '\r') i++
      atual.push(campo.trim()); campo = ''
      if (atual.some((c) => c !== '')) linhas.push(atual)
      atual = []
    } else {
      campo += ch
    }
  }
  atual.push(campo.trim())
  if (atual.some((c) => c !== '')) linhas.push(atual)

  const [cabecalho, ...resto] = linhas
  return { cabecalho: cabecalho ?? [], linhas: resto }
}

// Normaliza um cabeçalho para casar com nomes esperados ("Data de Nascimento" → "datadenascimento")
export const normalizar = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// Acha o índice da coluna cujo cabeçalho contém um dos apelidos
export function acharColuna(cabecalho, apelidos) {
  // Cabeçalho ausente é "não achei a coluna", não uma exceção: quem chama já
  // trata o -1, e a planilha sem cabeçalho precisa cair na mensagem de coluna
  // faltando, que é a que explica o problema para quem está importando.
  if (!Array.isArray(cabecalho) || !Array.isArray(apelidos)) return -1
  const norm = cabecalho.map(normalizar)
  for (const apelido of apelidos) {
    const i = norm.findIndex((h) => h.includes(apelido))
    if (i >= 0) return i
  }
  return -1
}

// Converte datas comuns de planilha (dd/mm/aaaa, aaaa-mm-dd) para ISO ou null
export function paraDataISO(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

// Converte "R$ 1.234,56" / "1234,56" / "1234.56" para número ou null
export function paraNumero(v) {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.')
  const n = Number(s)
  return s && Number.isFinite(n) ? n : null
}

// Exporta linhas para download CSV (separador ; para Excel pt-BR)
export function baixarCSV(nomeArquivo, cabecalho, linhas) {
  const esc = (c) => {
    const s = String(c ?? '')
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const conteudo = [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\n')
  const blob = new Blob([`﻿${conteudo}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(a.href)
}
