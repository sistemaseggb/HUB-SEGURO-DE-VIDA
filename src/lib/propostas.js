// ─────────────────────────────────────────────────────────────────────────────
// O QUE FALTA PARA A APÓLICE SAIR
//
// Entre "o cliente disse sim" e "a apólice existe" há um vão de duas a oito
// semanas em que o negócio some do radar. A proposta entra na seguradora e o
// sistema, até aqui, só sabia dizer "Em Análise" — sem saber se falta um
// exame, se o cliente não respondeu a DPS, se já foi aprovada e falta emitir,
// ou se foi recusada há três semanas.
//
// É o pior lugar para perder um cliente. O trabalho já foi todo feito: as
// reuniões, o estudo, a apresentação, a objeção respondida, o sim. Perder aqui
// é perder depois de pagar o preço inteiro.
//
// ── A pergunta que este arquivo responde ────────────────────────────────────
//
// Não é "qual o status". É COM QUEM ESTÁ A BOLA e HÁ QUANTO TEMPO — porque a
// ação muda inteira conforme a resposta:
//
//   · com o CLIENTE     → ela cobra o cliente, e cada dia parado esfria o sim
//                         que ele já deu;
//   · com a SEGURADORA  → ela cobra a seguradora, e cobrar o cliente aqui só
//                         irrita quem já fez a parte dele;
//   · com ELA MESMA     → ninguém vai lembrar por ela.
//
// Uma lista de pendências sem dono é uma lista que não se resolve.
//
// ── O que este arquivo NÃO faz ──────────────────────────────────────────────
//
// Não dispara cobrança sozinho. Mostra o que está parado e há quantos dias;
// quem decide falar com o cliente é ela. Uma mensagem automática para quem
// está esperando o resultado de um exame de sangue é a pior coisa que este
// sistema poderia mandar.
// ─────────────────────────────────────────────────────────────────────────────

export const SITUACOES = [
  { id: 'enviada', rotulo: 'Enviada', tom: 'slate', aberta: true,
    ajuda: 'Protocolada na seguradora, ainda sem retorno.' },
  { id: 'em_analise', rotulo: 'Em análise', tom: 'blue', aberta: true,
    ajuda: 'A seguradora está avaliando risco e documentação.' },
  { id: 'exigencia', rotulo: 'Com exigência', tom: 'yellow', aberta: true,
    ajuda: 'Falta alguma coisa. É aqui que a proposta fica parada semanas.' },
  { id: 'aprovada', rotulo: 'Aprovada', tom: 'green', aberta: true,
    ajuda: 'Risco aceito. Falta emitir a apólice e registrar aqui.' },
  { id: 'emitida', rotulo: 'Apólice emitida', tom: 'green', aberta: false,
    ajuda: 'Fechou. A apólice existe e o ciclo terminou.' },
  { id: 'recusada', rotulo: 'Recusada', tom: 'red', aberta: false,
    ajuda: 'Negada pela seguradora — guarde o motivo para tentar em outra.' },
  { id: 'desistiu', rotulo: 'Cliente desistiu', tom: 'red', aberta: false,
    ajuda: 'O cliente voltou atrás antes de a apólice sair.' },
]

export const situacaoInfo = (id) => SITUACOES.find((s) => s.id === id) ?? SITUACOES[0]

export const DE_QUEM = [
  { id: 'cliente', rotulo: 'Do cliente', ajuda: 'Exame, documento, assinatura — depende dele' },
  { id: 'seguradora', rotulo: 'Da seguradora', ajuda: 'Parecer médico, análise, emissão' },
  { id: 'consultora', rotulo: 'Minha', ajuda: 'Formulário, envio, contato com a mesa' },
]

// ── Os prazos que decidem quando algo virou problema ────────────────────────
//
// Não são regra de seguradora: são o ponto a partir do qual, na prática, o
// negócio começa a escorrer. Ficam aqui, nomeados, para poderem ser discutidos
// e mudados — e não escondidos dentro de um `if` no meio da tela.
export const PRAZOS = {
  // Uma exigência com o cliente é o caso mais perigoso: ele já disse sim, e
  // cada semana em silêncio desfaz um pouco da decisão.
  exigenciaCliente: 5,
  // A seguradora tem o ritmo dela; cobrar antes disso é ruído.
  exigenciaSeguradora: 10,
  // O que depende dela mesma não devia passar de dois dias.
  exigenciaConsultora: 2,
  // Sem exigência nenhuma e sem retorno: a análise emperrou em algum lugar.
  semRetorno: 15,
  // Aprovada e não emitida é dinheiro parado em cima da mesa.
  aprovadaSemEmitir: 5,
}

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// Toda data vira MEIO-DIA local antes de qualquer conta. São dois motivos, e
// os dois já morderam este sistema:
//
//   · à meia-noite, a conversão de fuso joga a data para o dia anterior e a
//     contagem sai errada por um;
//   · ancorando as duas pontas no mesmo horário, a diferença é sempre um
//     número inteiro de dias — sem isso, "enviada 08:00, agora 09:00" daria
//     13,96 dias e o `floor` diria 13.
const aoMeioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)

const dia = (v) => {
  if (!v) return null
  // Data pronta (o "hoje" que a tela passa) vem por aqui. Sem este caminho,
  // `String(new Date())` virava "Sat Aug 1" e a conta inteira desandava.
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : aoMeioDia(v)
  const s = String(v).slice(0, 10)
  const d = new Date(`${s}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : aoMeioDia(d)
}

export function diasEntre(de, ate) {
  const a = dia(de)
  const b = dia(ate ?? new Date())
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

// jsonb é campo livre: nada aqui confia na forma do que veio do banco.
export function normalizarExigencias(bruto) {
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter((e) => e && typeof e === 'object' && String(e.o_que ?? '').trim())
    .map((e, i) => ({
      id: e.id ?? `e${i}`,
      o_que: String(e.o_que).trim(),
      de_quem: DE_QUEM.some((d) => d.id === e.de_quem) ? e.de_quem : 'cliente',
      pedida_em: e.pedida_em ?? null,
      resolvida_em: e.resolvida_em ?? null,
    }))
}

function prazoDe(deQuem) {
  if (deQuem === 'seguradora') return PRAZOS.exigenciaSeguradora
  if (deQuem === 'consultora') return PRAZOS.exigenciaConsultora
  return PRAZOS.exigenciaCliente
}

// ── O diagnóstico de UMA proposta ───────────────────────────────────────────
export function diagnosticarProposta(p, hoje = new Date()) {
  if (!p) return null
  const info = situacaoInfo(p.situacao)
  const exigencias = normalizarExigencias(p.exigencias).map((e) => {
    const parada = e.resolvida_em ? null : diasEntre(e.pedida_em, hoje)
    const limite = prazoDe(e.de_quem)
    return {
      ...e,
      aberta: !e.resolvida_em,
      diasParada: parada,
      atrasada: !e.resolvida_em && parada != null && parada > limite,
      limite,
    }
  })
  const abertas = exigencias.filter((e) => e.aberta)
  const atrasadas = abertas.filter((e) => e.atrasada)
  const diasNaSeguradora = diasEntre(p.data_envio, hoje)

  // Com quem está a bola. Havendo mais de uma pendência aberta, vale a mais
  // antiga: é ela que está segurando tudo.
  const maisAntiga = abertas.length
    ? abertas.reduce((pior, e) => ((e.diasParada ?? 0) > (pior.diasParada ?? 0) ? e : pior))
    : null
  const comQuem = !info.aberta ? null
    : p.situacao === 'aprovada' ? 'consultora'
      : maisAntiga ? maisAntiga.de_quem
        : 'seguradora'

  // Está travada? Três motivos diferentes, e cada um pede uma frase diferente.
  const paradaSemRetorno = info.aberta && abertas.length === 0
    && ['enviada', 'em_analise'].includes(p.situacao)
    && diasNaSeguradora != null && diasNaSeguradora > PRAZOS.semRetorno
  const aprovadaParada = p.situacao === 'aprovada'
    && diasEntre(p.updated_at ?? p.data_envio, hoje) > PRAZOS.aprovadaSemEmitir

  const travada = atrasadas.length > 0 || paradaSemRetorno || aprovadaParada

  return {
    ...p,
    info,
    exigencias,
    abertas,
    atrasadas,
    diasNaSeguradora,
    comQuem,
    maisAntiga,
    travada,
    aberta: info.aberta,
    proximaAcao: proximaAcao({ p, info, abertas, atrasadas, maisAntiga, diasNaSeguradora, paradaSemRetorno, aprovadaParada }),
  }
}

// A frase que ela lê e sabe o que fazer. Sempre com o número na frase: "há 12
// dias" move mais do que "pendente".
function proximaAcao({ p, info, abertas, atrasadas, maisAntiga, diasNaSeguradora, paradaSemRetorno, aprovadaParada }) {
  if (p.situacao === 'emitida') return { texto: 'Apólice emitida — nada pendente.', tom: 'bom' }
  if (p.situacao === 'recusada') {
    return {
      texto: p.motivo_recusa
        ? `Recusada: ${p.motivo_recusa}. Vale tentar outra seguradora com esse histórico em mãos.`
        : 'Recusada. Registre o motivo — sem ele, a próxima tentativa começa do zero.',
      tom: 'ruim',
    }
  }
  if (p.situacao === 'desistiu') return { texto: 'Cliente desistiu antes de emitir.', tom: 'ruim' }

  if (p.situacao === 'aprovada') {
    return aprovadaParada
      ? { texto: 'Aprovada e ainda não emitida. É a única etapa que depende só de você.', tom: 'alerta' }
      : { texto: 'Aprovada. Assim que a apólice sair, registre-a aqui para fechar o ciclo.', tom: 'bom' }
  }

  if (atrasadas.length > 0) {
    const e = atrasadas.reduce((pior, x) => ((x.diasParada ?? 0) > (pior.diasParada ?? 0) ? x : pior))
    const quem = e.de_quem === 'cliente' ? 'com o cliente'
      : e.de_quem === 'seguradora' ? 'com a seguradora' : 'com você'
    return {
      texto: `"${e.o_que}" está ${quem} há ${e.diasParada} dias — passou do prazo de ${e.limite}.`
        + (e.de_quem === 'cliente' ? ' Ele já disse sim; cada semana calada desfaz um pouco disso.' : ''),
      tom: 'ruim',
    }
  }
  if (abertas.length > 0 && maisAntiga) {
    const quem = maisAntiga.de_quem === 'cliente' ? 'o cliente'
      : maisAntiga.de_quem === 'seguradora' ? 'a seguradora' : 'você'
    return {
      texto: `Esperando ${quem}: "${maisAntiga.o_que}"`
        + (maisAntiga.diasParada != null ? ` (há ${maisAntiga.diasParada} ${maisAntiga.diasParada === 1 ? 'dia' : 'dias'}).` : '.'),
      tom: 'alerta',
    }
  }
  if (paradaSemRetorno) {
    return {
      texto: `${diasNaSeguradora} dias na seguradora sem exigência nenhuma. Cobre um retorno da mesa.`,
      tom: 'alerta',
    }
  }
  return {
    texto: diasNaSeguradora != null && diasNaSeguradora > 0
      ? `${info.rotulo} há ${diasNaSeguradora} ${diasNaSeguradora === 1 ? 'dia' : 'dias'}. Dentro do prazo normal.`
      : `${info.rotulo}. Dentro do prazo normal.`,
    tom: 'neutro',
  }
}

// ── O painel: a carteira inteira em análise ─────────────────────────────────
export function resumoPropostas(lista, hoje = new Date()) {
  const ds = (lista ?? []).map((p) => diagnosticarProposta(p, hoje)).filter(Boolean)
  const abertas = ds.filter((d) => d.aberta)
  const travadas = abertas.filter((d) => d.travada)
  return {
    todas: ds,
    abertas,
    travadas,
    // O número que importa na tela inicial: quanto de prêmio está esperando
    // uma pendência ser resolvida. É a conta que faz ela abrir a lista.
    premioEmRisco: travadas.reduce((s, d) => s + n(d.premio_mensal), 0),
    premioEmAnalise: abertas.reduce((s, d) => s + n(d.premio_mensal), 0),
    capitalEmAnalise: abertas.reduce((s, d) => s + n(d.capital), 0),
    comCliente: abertas.filter((d) => d.comQuem === 'cliente').length,
    comSeguradora: abertas.filter((d) => d.comQuem === 'seguradora').length,
    comigo: abertas.filter((d) => d.comQuem === 'consultora').length,
    // ordenadas pela urgência real: travadas primeiro, mais paradas no topo
    fila: [...abertas].sort((a, b) => {
      if (a.travada !== b.travada) return a.travada ? -1 : 1
      const pa = a.maisAntiga?.diasParada ?? a.diasNaSeguradora ?? 0
      const pb = b.maisAntiga?.diasParada ?? b.diasNaSeguradora ?? 0
      return pb - pa
    }),
  }
}

// Conferências no padrão do resto do sistema: o que está registrado de um
// jeito que não fecha, e por quê.
export function conferirProposta(p) {
  const d = diagnosticarProposta(p)
  if (!d) return []
  const avisos = []
  if (d.situacao === 'exigencia' && d.abertas.length === 0) {
    avisos.push({ nivel: 'alerta', texto: 'Marcada como "com exigência" mas nenhuma pendência está aberta. Atualize a situação.' })
  }
  if (d.abertas.length > 0 && !['exigencia'].includes(d.situacao) && d.aberta) {
    avisos.push({ nivel: 'info', texto: `Há ${d.abertas.length} pendência(s) aberta(s) — a situação "${d.info.rotulo}" pode estar desatualizada.` })
  }
  if (d.situacao === 'recusada' && !String(p.motivo_recusa ?? '').trim()) {
    avisos.push({ nivel: 'alerta', texto: 'Recusa sem motivo registrado. Daqui a seis meses ninguém lembra qual foi — e é o que orienta a próxima tentativa.' })
  }
  if (d.situacao === 'emitida' && !p.id_apolice) {
    avisos.push({ nivel: 'info', texto: 'Emitida, mas sem apólice ligada. Cadastre a apólice para a comissão entrar no fechamento.' })
  }
  if (n(p.premio_mensal) <= 0 && d.aberta) {
    avisos.push({ nivel: 'info', texto: 'Sem prêmio registrado — esta proposta não entra na conta do que está em risco.' })
  }
  return avisos
}
