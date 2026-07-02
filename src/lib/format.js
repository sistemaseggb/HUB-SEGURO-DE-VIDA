export const brl = (v) =>
  (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))

export const brlCompacto = (v) => {
  if (v == null) return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return brl(n)
}

export const dataBR = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

export const dataHoraBR = (d) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export const mesBR = (d) => {
  if (!d) return '—'
  const [y, m] = String(d).slice(0, 10).split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`
}

// Link direto para conversa no WhatsApp com mensagem pronta
export const whatsapp = (telefone, mensagem = '') => {
  const digitos = String(telefone ?? '').replace(/\D/g, '')
  if (!digitos) return null
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  return `https://wa.me/${numero}${texto}`
}

export const iniciais = (nome = '') =>
  nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
