// ─────────────────────────────────────────────────────────────────────────────
// OS NÍVEIS DO PLANO — de "quer ou não quer?" para "qual dos três?".
//
// Até aqui a proposta apresentava UM desenho de apólice, e a reunião terminava
// numa pergunta fechada: aceita ou não aceita. Toda a literatura de venda
// consultiva diz o mesmo, e a prática confirma: a pergunta fechada transforma
// o preço no único assunto que sobra. Quando o cliente acha caro, não existe
// para onde ir — só desconto ou não.
//
// Com três níveis a conversa muda de eixo. O cliente para de escolher entre
// "sim" e "não" e passa a escolher entre "menos" e "mais", que é uma decisão
// que ele consegue tomar na hora. E o nível de baixo não é um plano pior: é o
// plano que resolve a exposição MAIOR dele, escolhida pelo risco e não pelo
// preço.
//
// ── Como cada nível é montado ────────────────────────────────────────────────
//
//   ESSENCIAL   — só o núcleo do perfil deste cliente. Responde à pergunta
//                 "se eu só puder fazer uma coisa, qual é?". Sai do estudo,
//                 não de um pacote pronto: para um empresário com aval o
//                 núcleo é outro que o de um pai de família.
//
//   RECOMENDADO — exatamente o que a consultora desenhou no planejamento. É o
//                 nível do meio de propósito: o meio é onde as pessoas olham
//                 primeiro, e é onde deve estar o plano que ela defende.
//
//   COMPLETO    — o estudo sem cortes: toda cobertura que o motor sugeriu,
//                 no valor cheio da sugestão. Existe para dar escala aos
//                 outros dois e para não deixar sumir da mesa o que ela
//                 decidiu tirar — o cliente vê o que existe e escolhe abrir mão.
//
// ── E o que NÃO tem em cada um ───────────────────────────────────────────────
// Todo nível carrega a lista do que ele deixa descoberto, com o risco por
// escrito. Um comparativo que só mostra o que cada coluna TEM é folheto de
// venda; o que torna a escolha honesta é a coluna do que falta.
//
// Nada aqui é gravado: os níveis são uma leitura do estudo, recalculada a cada
// tecla. O planejamento continua sendo a fonte única da verdade.
// ─────────────────────────────────────────────────────────────────────────────

import { COBERTURAS } from './estudo.js'
import { precoMensal, TABELA_TAXAS } from './premio.js'

// ─── A ORDEM DO RISCO ────────────────────────────────────────────────────────
// Quando o dinheiro é limitado, a ordem em que as coberturas entram não pode
// ser a ordem do catálogo nem a do preço. É frequência × severidade:
//
//   · a invalidez é MAIS PROVÁVEL que a morte antes dos 65 e financeiramente
//     pior (a renda para e ainda entra o custo do tratamento) — por isso vem
//     na frente em quase todo perfil;
//   · o aval é executado com o cliente vivo e não admite negociação;
//   · a dívida não morre com o devedor e come a herança antes de qualquer
//     herdeiro;
//   · as assistências são baratas e resolvem o pior dia da família em horas,
//     mas não substituem capital nenhum — entram por último e custam pouco.
//
// Perfis diferentes reordenam isso, e é o diagnóstico que sabe o perfil. Sem
// ele, esta é a ordem padrão.
export const ORDEM_RISCO_PADRAO = [
  'invalidez', 'morte', 'aval', 'doencas_graves', 'sucessao',
  'dit', 'socios', 'homem_chave', 'morte_acidental', 'dih',
  'funeral_individual', 'funeral_familiar', 'fraturas',
]

// Quantas coberturas formam o núcleo do plano essencial. Três é o número que
// cabe numa frase dita em voz alta — "invalidez, morte e o inventário" — e uma
// apólice que a consultora consegue enunciar de cabeça é uma apólice que o
// cliente entende.
const NUCLEO_ESSENCIAL = 3

const rotuloDe = (id) => COBERTURAS.find((c) => c.id === id)?.curto ?? id
const cobDe = (id) => COBERTURAS.find((c) => c.id === id)

// O risco que fica na mesa quando uma cobertura não entra. Não é o texto de
// venda dela: é o que acontece de concreto sem ela.
const RISCO_SEM = {
  morte: 'A família fica sem capital para manter o padrão de vida e sem o que quitar as dívidas.',
  invalidez: 'O cenário mais provável antes dos 65 fica descoberto: a renda para e ele continua aqui, custando tratamento.',
  doencas_graves: 'No diagnóstico não entra um real: o tratamento sai do patrimônio da família.',
  dit: 'Cada dia parado é um dia sem receber, sem nenhuma reposição.',
  dih: 'A internação corre por conta dele — o que o plano de saúde não cobre não tem de onde sair.',
  morte_acidental: 'No cenário mais súbito a indenização não dobra: a família recebe só o capital de morte.',
  fraturas: 'O custo imediato de um acidente sai da reserva.',
  sucessao: 'O inventário continua sem liquidez: os bens travam até alguém pôr o imposto em dinheiro.',
  socios: 'Sem capital para o buy-sell, os sócios viram sócios da família dele.',
  homem_chave: 'A empresa perde quem a fazia girar e não tem fôlego para se reorganizar.',
  aval: 'O aval sobrevive ao avalista e alcança o patrimônio pessoal da família.',
  funeral_individual: 'A família decide e paga tudo sozinha, no pior dia.',
  funeral_familiar: 'A assistência não alcança cônjuge e filhos.',
}

// Preço de um conjunto de coberturas, somado item a item.
function precificar(itens, ctx) {
  const comPreco = itens.map((i) => ({
    ...i,
    mensal: precoMensal(i.id, i.valor, { ...ctx, dias: i.dias, franquia: i.franquia }),
  }))
  const mensal = comPreco.reduce((s, i) => s + i.mensal, 0)
  return { itens: comPreco, mensal: Math.round(mensal) }
}

// A apólice cheia: tudo que o motor sugeriu, no valor da sugestão, respeitando
// o que este estudo pode oferecer (migrações aplicadas, tipo PF/PJ). É o
// universo de onde os três níveis são recortados.
function universo(estudo) {
  const ativas = estudo.ativas ?? []
  const disponiveis = new Map()

  // tudo que já está na apólice, no valor que a consultora definiu
  for (const c of ativas) {
    if (!TABELA_TAXAS[c.id]) continue
    disponiveis.set(c.id, {
      id: c.id, rotulo: c.curto ?? c.rotulo, grupo: c.grupo,
      valor: c.valor, dias: c.dias, franquia: c.franquia, noEstudo: true,
    })
  }

  // e o que o motor sugeriu e não entrou — o "completo" precisa dele
  for (const c of COBERTURAS) {
    if (!TABELA_TAXAS[c.id]) continue
    const sugestao = estudo.sugestoes?.[c.id] ?? 0
    if (!(sugestao > 0)) continue
    // uma cobertura empresarial não entra num estudo sem PJ, e uma cobertura
    // que a migração não liberou não pode ser prometida
    if (c.pj && !estudo.temPJ) continue
    if (c.requer === '014' && !estudo.tem014) continue
    if (c.requer === '019' && !estudo.tem019) continue
    if (estudo.tipo === 'pj' && !c.pj && c.id !== 'invalidez') continue

    const atual = disponiveis.get(c.id)
    const d = estudo.diariaPorId?.[c.id]
    if (!atual) {
      disponiveis.set(c.id, {
        id: c.id, rotulo: c.curto ?? c.rotulo, grupo: c.grupo,
        valor: sugestao, dias: d?.dias, franquia: d?.franquia, noEstudo: false,
      })
    } else if (sugestao > atual.valor) {
      // a consultora reduziu abaixo da sugestão: o completo mostra o cheio
      disponiveis.set(c.id, { ...atual, valorCheio: sugestao })
    }
  }
  return disponiveis
}

// Ordem de entrada das coberturas para ESTE cliente.
function ordemPara(perfil) {
  if (!perfil?.prioridade?.length) return ORDEM_RISCO_PADRAO
  const daFrente = perfil.prioridade.filter((id) => TABELA_TAXAS[id])
  return [...daFrente, ...ORDEM_RISCO_PADRAO.filter((id) => !daFrente.includes(id))]
}

// ─────────────────────────────────────────────────────────────────────────────
// OS TRÊS NÍVEIS
//
// `perfil` é o do diagnóstico (opcional): ele muda a ordem do risco e, com
// isso, o que entra no essencial. Sem perfil, a ordem padrão resolve.
// ─────────────────────────────────────────────────────────────────────────────
export function montarNiveis(estudo, { perfil = null } = {}) {
  if (!estudo || estudo.idade == null) return null
  const ctx = { idade: estudo.idade, fumante: estudo.fumante }
  const disponiveis = universo(estudo)
  if (disponiveis.size === 0) return null

  const ordem = ordemPara(perfil)
  const porOrdem = (a, b) => {
    const ia = ordem.indexOf(a.id)
    const ib = ordem.indexOf(b.id)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  }

  // ── COMPLETO: tudo, no valor cheio ────────────────────────────────────────
  const completoItens = [...disponiveis.values()]
    .map((i) => ({ ...i, valor: i.valorCheio ?? i.valor }))
    .sort(porOrdem)

  // ── RECOMENDADO: o que a consultora desenhou ──────────────────────────────
  const recomendadoItens = [...disponiveis.values()]
    .filter((i) => i.noEstudo)
    .sort(porOrdem)

  // ── ESSENCIAL: o núcleo do risco deste cliente ────────────────────────────
  // Sai do que já está no estudo (o essencial nunca inventa cobertura que a
  // consultora não pôs), pelas primeiras posições da ordem de risco.
  const nucleo = recomendadoItens.slice(0, NUCLEO_ESSENCIAL)
  // Duas exceções que não são opinião, são consequência jurídica: dívida
  // avalizada e dívida pessoal não somem se o plano encolher. Um "essencial"
  // que deixa a família devendo não é essencial, é incompleto.
  const obrigatorias = recomendadoItens.filter((i) => (
    (i.id === 'aval' && i.valor > 0)
    || (i.id === 'morte' && estudo.dividas > 0)
  ))
  const essencialItens = [...new Map(
    [...nucleo, ...obrigatorias].map((i) => [i.id, i]),
  ).values()].sort(porOrdem)

  const montar = (id, rotulo, tese, itens) => {
    const preco = precificar(itens, ctx)
    const dentro = new Set(itens.map((i) => i.id))
    const descoberto = completoItens
      .filter((i) => !dentro.has(i.id))
      .map((i) => ({ id: i.id, rotulo: rotuloDe(i.id), risco: RISCO_SEM[i.id] ?? null }))
    // capital de indenização única, mesma régua do estudo (diárias e
    // assistências ficam de fora para o total não inflar)
    const capital = itens
      .filter((i) => cobDe(i.id)?.soma)
      .reduce((s, i) => s + i.valor, 0)
    return {
      id, rotulo, tese,
      itens: preco.itens.sort(porOrdem),
      capital,
      mensal: preco.mensal,
      descoberto,
      estimativa: true,
    }
  }

  const essencial = montar('essencial', 'Essencial',
    'O que resolve a exposição maior deste cliente. Se só der para fazer uma coisa, é esta.',
    essencialItens)
  const recomendado = montar('recomendado', 'Recomendado',
    'O plano que o estudo desenhou: cobre as frentes que a reunião levantou, no tamanho certo.',
    recomendadoItens)
  const completo = montar('completo', 'Completo',
    'O estudo sem cortes, com toda cobertura que o motor sugeriu no valor cheio.',
    completoItens)

  // Um nível que custa o mesmo que o de cima não é uma escolha, é ruído na
  // tela. Só apresentamos a escada quando os degraus existem de verdade.
  const niveis = [essencial, recomendado, completo]
    .filter((n, i, todos) => i === 0 || n.mensal > todos[i - 1].mensal + 1)

  if (niveis.length < 2) return null

  return {
    estimativa: true,
    idade: estudo.idade,
    niveis,
    // qual deles a consultora defende — o do meio quando os três existem
    recomendadoId: niveis.some((n) => n.id === 'recomendado') ? 'recomendado' : niveis[0].id,
    ordem,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANCORAR OS NÍVEIS NA COTAÇÃO DE VERDADE
//
// Dentro do sistema, a estimativa por idade é ótima: dimensiona a conversa,
// permite comparar desenhos e some quando a cotação chega. Na PROPOSTA que o
// cliente vê, ela seria outra coisa — um preço estimado impresso ao lado do
// nome dele é lido como preço, e um preço que a apólice não cumpre é a pior
// forma de começar uma relação de vinte anos.
//
// A saída é usar a estimativa só para o que ela faz bem: a PROPORÇÃO entre os
// níveis. O valor absoluto vem da cotação que a consultora recebeu da
// seguradora. Se o recomendado foi cotado em R$ 1.890 e a estimativa diz que o
// essencial custa 62% dele, o essencial aparece por R$ 1.172 — um número
// ancorado num preço real, e não numa tábua genérica.
//
// Sem cotação, devolve `null`: a proposta simplesmente não ganha o capítulo.
// ─────────────────────────────────────────────────────────────────────────────
export function ancorarNaCotacao(niveis, estudo) {
  const cotado = estudo?.investimento?.mensal ?? 0
  if (!niveis || !(cotado > 0)) return null
  const referencia = niveis.niveis.find((n) => n.id === niveis.recomendadoId)
  if (!referencia || !(referencia.mensal > 0)) return null
  const escala = cotado / referencia.mensal

  return {
    ...niveis,
    ancorado: true,
    estimativa: false,
    cotado,
    niveis: niveis.niveis.map((n) => ({
      ...n,
      // o nível cotado sai exato; os outros, proporcionais a ele
      mensal: n.id === niveis.recomendadoId ? Math.round(cotado) : Math.round(n.mensal * escala),
      proporcional: n.id !== niveis.recomendadoId,
      estimativa: n.id !== niveis.recomendadoId,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// O PLANO QUE CABE NO ORÇAMENTO
//
// O estudo já sabia dizer "o prêmio não cabe na sobra do cliente". Dizer isso
// e parar é deixar a consultora no pior lugar possível: ela sabe que o plano
// vai cancelar e não sabe o que tirar. Cortar no chute costuma cortar errado —
// a primeira cobertura que sai é sempre a invalidez, que é a mais provável de
// todas, porque é a que o cliente entende menos.
//
// Aqui o corte é feito pelo risco: as coberturas entram na ordem de exposição
// deste cliente enquanto couberem no teto. O que não coube sai listado com o
// que custaria para entrar — muitas vezes a diferença são vinte reais e o
// cliente decide na hora.
// ─────────────────────────────────────────────────────────────────────────────
export function planoQueCabe(estudo, tetoMensal, { perfil = null } = {}) {
  if (!estudo || estudo.idade == null || !(tetoMensal > 0)) return null
  const ctx = { idade: estudo.idade, fumante: estudo.fumante }
  const disponiveis = [...universo(estudo).values()]
  if (disponiveis.length === 0) return null

  const ordem = ordemPara(perfil)
  const candidatos = disponiveis
    .map((i) => ({
      ...i,
      valor: i.valor,
      mensal: precoMensal(i.id, i.valor, { ...ctx, dias: i.dias, franquia: i.franquia }),
    }))
    .filter((i) => i.mensal > 0)
    .sort((a, b) => {
      const ia = ordem.indexOf(a.id)
      const ib = ordem.indexOf(b.id)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

  const dentro = []
  const fora = []
  let total = 0
  for (const c of candidatos) {
    // Não paramos no primeiro que não coube: uma assistência de R$ 8 pode
    // entrar depois de uma cobertura de R$ 400 ter ficado de fora, e é
    // exatamente o tipo de sobra que o cliente gosta de ver aproveitada.
    if (total + c.mensal <= tetoMensal) {
      dentro.push(c)
      total += c.mensal
    } else {
      fora.push({ ...c, risco: RISCO_SEM[c.id] ?? null })
    }
  }

  // "Quanto faltaria para entrar" só faz sentido contra o total FINAL. Medido
  // durante a varredura, o número mudaria conforme itens mais baratos fossem
  // entrando depois — e a consultora leria na tela uma diferença que já não
  // existe mais.
  for (const f of fora) f.faltam = Math.round(Math.max(total + f.mensal - tetoMensal, 1))

  const capital = dentro
    .filter((i) => cobDe(i.id)?.soma)
    .reduce((s, i) => s + i.valor, 0)

  return {
    estimativa: true,
    teto: Math.round(tetoMensal),
    dentro,
    fora,
    mensal: Math.round(total),
    sobra: Math.round(tetoMensal - total),
    capital,
    // nada coube: o teto está abaixo até da cobertura mais barata do estudo
    vazio: dentro.length === 0,
    // coube tudo: não há corte a fazer, e a tela diz isso em vez de fingir
    completo: fora.length === 0,
  }
}
