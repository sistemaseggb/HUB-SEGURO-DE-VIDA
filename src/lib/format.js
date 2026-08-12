// Todo dinheiro do sistema passa por aqui — inclusive o que aparece na
// PROPOSTA, na frente do cliente. Um valor que não é número (texto de um campo
// mal preenchido, coluna que veio nula de uma migração pela metade, conta que
// dividiu por zero) virava "R$ NaN" na tela da reunião. Travessão é feio;
// "R$ NaN" é constrangedor.
const numeroOuNada = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const brl = (v) => {
  const n = numeroOuNada(v)
  return n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const brlCompacto = (v) => {
  const n = numeroOuNada(v)
  if (n === null) return '—'
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

// ─────────────────────────────────────────────────────────────────────────────
// DO CAMPO <input type="datetime-local"> PARA O BANCO
//
// O navegador entrega "2026-08-15T14:30" — a hora que ela digitou, SEM fuso
// nenhum grudado. Mandando essa string direto para uma coluna `timestamptz`,
// quem decide o fuso é o servidor, e o Supabase roda em UTC. Resultado: a
// reunião marcada para as 14:30 era gravada como 14:30 UTC, ou seja
//
//     11:30 no Brasil.
//
// Três horas mais cedo na Agenda, três horas mais cedo no lembrete, e a
// mensagem de confirmação no WhatsApp chegava ao cliente com a hora errada.
// Num sistema de agenda, não há defeito pior.
//
// `new Date('2026-08-15T14:30')` (sem o Z no fim) é interpretado pelo
// navegador no fuso DELA, que é o que ela quis dizer. O `toISOString()`
// converte esse instante para UTC de forma explícita, e aí não sobra
// ambiguidade para ninguém interpretar errado.
export const localParaISO = (valor) => {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// O caminho de volta, para preencher o campo ao editar: instante do banco →
// "AAAA-MM-DDTHH:MM" na hora local, que é o único formato que o campo aceita.
export const isoParaLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const off = d.getTimezoneOffset() * 60000
  return new Date(d - off).toISOString().slice(0, 16)
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
  // Um número brasileiro tem DDD + 8 ou 9 dígitos. Abaixo disso é campo pela
  // metade, e o link montado assim mesmo abre o WhatsApp num número que não
  // existe — ela descobre o erro só depois de tentar falar com o cliente.
  if (digitos.length < 10) return null
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  return `https://wa.me/${numero}${texto}`
}

// Primeira e ÚLTIMA palavra, não as duas primeiras. Numa carteira brasileira,
// "Carlos Eduardo Menezes" e "Carlos Eduardo Silva" davam o mesmo "CE" — dois
// clientes diferentes com a mesma bolinha na lista. Com o sobrenome viram
// "CM" e "CS", que é para isso que a inicial serve.
export const iniciais = (nome = '') => {
  const partes = String(nome ?? '').split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
}
