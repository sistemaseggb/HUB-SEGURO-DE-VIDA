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
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// Data de HOJE no fuso local (não em UTC) — evita o bug de virada de dia
// entre 21h e a meia-noite no Brasil (UTC-3), quando toISOString() já
// devolveria o dia seguinte. Formato ISO "AAAA-MM-DD".
export const hojeLocal = () => {
  const d = new Date()
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 10)
}

// Mês corrente no fuso local, "AAAA-MM". Mesmo motivo do hojeLocal: no último
// dia do mês, depois das 21h, o toISOString() já devolveria o mês seguinte — e
// o Dashboard leria a meta do mês errado bem na hora de fechar o mês.
export const mesLocal = () => hojeLocal().slice(0, 7)

// Converte um Date para "AAAA-MM-DD" no fuso local
export const diaLocal = (data) => {
  const d = new Date(data)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 10)
}

// "há X dias / hoje / ontem" — leitura humana de tempo decorrido
export const tempoRelativo = (d) => {
  if (!d) return '—'
  const dias = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  if (dias < 60) return 'há 1 mês'
  if (dias < 365) return `há ${Math.floor(dias / 30)} meses`
  return `há ${Math.floor(dias / 365)} ano(s)`
}

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
