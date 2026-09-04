export const brl = (v) =>
  (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))

// A escala é escolhida DEPOIS do arredondamento, não antes. Escolhendo antes,
// R$ 999.999 caía na faixa dos milhares, arredondava para 1.000 e saía como
// "R$ 1.000 mil" — quatro dígitos numa função que existe para caber em pouco
// espaço, e um número que ninguém lê como "um milhão".
export const brlCompacto = (v) => {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) {
    const milhares = Math.round(n / 1_000)
    // arredondou para o milhão: quem sobe de faixa é escrito na faixa nova
    if (Math.abs(milhares) >= 1_000) {
      return `R$ ${(milhares / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    }
    return `R$ ${milhares.toLocaleString('pt-BR')} mil`
  }
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

// "há X dias / hoje / ontem" — leitura humana de tempo decorrido.
//
// A MESMA VIRADA DE DIA QUE `hojeLocal` JÁ EVITAVA, DUAS FUNÇÕES ABAIXO.
// "2026-08-13" é lido pelo JavaScript como meia-noite em UTC. Comparado
// direto com `Date.now()`, a diferença passa de 24 h assim que dá 21h no
// Brasil (UTC-3) — e um contato feito HOJE de manhã aparecia como "ontem"
// para quem abrisse o sistema à noite. A consultora trabalha à noite: é o
// horário em que o cliente responde no WhatsApp, e é exatamente quando ela
// olha "há quantos dias falei com ele". A régua de relacionamento e a lista
// de retenção do pós-venda contam esses dias.
//
// A conta certa é entre DIAS DE CALENDÁRIO locais, não entre instantes: o
// que se quer saber é quantas viradas de meia-noite houve, e a hora do dia
// não entra nisso.
const meiaNoiteLocal = (d) => {
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return null
  // data pura ("AAAA-MM-DD") chega como meia-noite UTC: reancorada no dia
  // local que ela representa, e não no instante
  const iso = String(d).slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(d).trim().slice(0, 10)) && String(d).trim().length <= 10) {
    const [a, m, dia] = iso.split('-').map(Number)
    return new Date(a, m - 1, dia).getTime()
  }
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
}

// `agora` é parâmetro pelo mesmo motivo que `idadeEm` recebe `referencia`:
// uma função que lê o relógio por dentro não tem como ser conferida por um
// teste, e é justamente a virada de dia que precisa ser conferida.
export const tempoRelativo = (d, agora = new Date()) => {
  if (!d) return '—'
  const quando = meiaNoiteLocal(d)
  if (quando == null) return '—'
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const dias = Math.round((hoje - quando) / 86400000)
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
