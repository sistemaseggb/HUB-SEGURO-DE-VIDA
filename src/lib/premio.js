// ─────────────────────────────────────────────────────────────────────────────
// O ESTIMADOR DE PRÊMIO — quanto custa CADA PEDAÇO da apólice.
//
// A pergunta que aparece em toda reunião, logo depois do capital, é "quanto
// custa?". Até aqui o sistema não tinha resposta nenhuma: o prêmio só existia
// depois que a consultora cotava nas seguradoras e digitava o número. Entre a
// reunião e a cotação passavam dias — e é nesses dias que a venda esfria.
//
// Pior: sem saber o preço de cada cobertura, ninguém consegue responder à
// segunda pergunta, que é a que realmente decide: "e se tirar essa daqui,
// quanto cai?". A consultora tinha um total e nenhuma alavanca.
//
// ── O QUE ISTO É, E O QUE NÃO É ──────────────────────────────────────────────
// NÃO é cotação. Não substitui a seguradora, não conhece o histórico médico do
// cliente e não sabe do agravo que a análise vai aplicar. É um DIMENSIONADOR:
// serve para a conversa acontecer com uma ordem de grandeza na mesa em vez de
// um silêncio, e para o estudo saber comparar desenhos de apólice entre si.
//
// Três decisões que mantêm isso honesto:
//
//   1. SEMPRE FAIXA, NUNCA NÚMERO SECO. A saída é "entre R$ 480 e R$ 810 por
//      mês". Um número exato seria lido como cotação, e uma cotação errada dita
//      na reunião é uma promessa que a apólice não cumpre.
//
//   2. SEM IDADE, SEM ESTIMATIVA. O prêmio de risco é quase todo idade. Sem a
//      data de nascimento no cadastro, este módulo devolve `null` e a tela pede
//      o dado — em vez de chutar uma idade e produzir um número convincente e
//      falso.
//
//   3. A COTAÇÃO SEMPRE MANDA. Quando a consultora digita o prêmio cotado, é
//      ele que vale em todo o resto do sistema. A estimativa vira apenas uma
//      conferência: "a cotação veio 60% acima da faixa — houve agravo?".
//
// ── A TABELA ─────────────────────────────────────────────────────────────────
// Taxa mensal por R$ 1.000 de capital, na idade de referência de 35 anos, não
// fumante, vida individual do mercado brasileiro. É premissa declarada e mora
// toda aqui: quem discordar do preço discorda de um número que dá para apontar,
// e ajustar a carteira é editar esta tabela e mais nada.
// ─────────────────────────────────────────────────────────────────────────────

import { indicePremioIdade } from './estudo.js'

// Idade em que a tabela vale sem ajuste (o índice de prêmio é 1,00 aqui).
export const IDADE_REFERENCIA = 35

// `taxa`         — R$ por mês, por R$ 1.000 de capital (ou por R$ 1 de diária).
// `elasticidade` — o quanto o preço acompanha a curva de idade. Morte segue a
//                  mortalidade inteira (1,0). Acidente quase não varia com a
//                  idade (0,35) — o risco de bater o carro aos 30 e aos 55 é
//                  parecido. Doenças graves sobem MAIS rápido que a morte
//                  (1,15): o pico de incidência de câncer e infarto vem antes
//                  do pico de mortalidade.
// `base`         — 'capital' (por R$ 1.000) ou 'diaria' (por R$ 1 de diária).
export const TABELA_TAXAS = {
  morte: { taxa: 0.20, elasticidade: 1.0, base: 'capital' },
  invalidez: { taxa: 0.07, elasticidade: 0.85, base: 'capital' },
  doencas_graves: { taxa: 0.42, elasticidade: 1.15, base: 'capital' },
  morte_acidental: { taxa: 0.02, elasticidade: 0.35, base: 'capital' },
  fraturas: { taxa: 0.35, elasticidade: 0.30, base: 'capital' },
  funeral_individual: { taxa: 0.55, elasticidade: 0.70, base: 'capital' },
  funeral_familiar: { taxa: 1.10, elasticidade: 0.70, base: 'capital' },
  // Capitais de morte com outro nome: a seguradora cobra pelo mesmo risco.
  sucessao: { taxa: 0.20, elasticidade: 1.0, base: 'capital' },
  socios: { taxa: 0.20, elasticidade: 1.0, base: 'capital' },
  homem_chave: { taxa: 0.20, elasticidade: 1.0, base: 'capital' },
  aval: { taxa: 0.20, elasticidade: 1.0, base: 'capital' },
  // Diárias: por R$ 1 de diária, no desenho de referência de cada uma.
  dit: { taxa: 0.15, elasticidade: 0.60, base: 'diaria', diasReferencia: 90, franquiaReferencia: 15 },
  dih: { taxa: 0.06, elasticidade: 0.60, base: 'diaria', diasReferencia: 30 },
}

// ── ATÉ QUE IDADE O MERCADO EMITE ────────────────────────────────────────────
// Uma taxa calculada não é uma apólice disponível. Doenças graves raramente é
// emitida individualmente depois dos 65, DIT depende de comprovação de renda
// ativa e some perto da aposentadoria, e a partir dos 70 a maior parte das
// carteiras de vida individual fecha para propostas novas.
//
// O estimador NÃO esconde o número nesses casos — esconder seria pior, porque a
// consultora seguiria montando um plano que a cotação vai recusar inteiro. Ele
// calcula e avisa: acima da idade de emissão o preço vira uma indicação de
// ordem de grandeza para um produto que talvez nem exista para esse cliente, e
// isso precisa estar escrito antes de a proposta ser montada.
export const IDADE_MAXIMA_EMISSAO = {
  doencas_graves: 65,
  dit: 65,
  dih: 70,
  fraturas: 70,
  invalidez: 70,
  morte: 75,
  morte_acidental: 75,
  sucessao: 75,
  socios: 75,
  homem_chave: 75,
  aval: 75,
}

// ── O desenho da diária muda o preço ─────────────────────────────────────────
// Dobrar o limite de diárias não dobra o prêmio: os afastamentos longos são
// muito mais raros que os curtos, e a curva satura. O expoente 0,6 é a forma
// usual dessa saturação nas tabelas de mercado.
const EXPOENTE_DIAS = 0.6
// A franquia é o desconto mais barato que existe numa apólice: quase todo
// sinistro de DIT é curto, então cada dia de carência a mais corta uma fatia
// grande do prêmio. A constante 12 amortece a curva perto de zero, onde uma
// razão pura explodiria.
const AMORTECIMENTO_FRANQUIA = 12

// ── A largura da faixa ───────────────────────────────────────────────────────
// De onde vem a incerteza: cada seguradora tem a sua tábua, o desconto por
// capital alto varia, e a análise médica pode aplicar agravo. A banda é
// assimétrica de propósito — agravo só empurra para CIMA, nunca para baixo.
const BANDA_BASE = 0.28
const BANDA_MAXIMA = 0.50
const ASSIMETRIA_SUPERIOR = 1.3

function bandaDe(idade, fumante) {
  let b = BANDA_BASE
  // Acima dos 50 a dispersão entre seguradoras cresce (é onde as tábuas
  // divergem e onde a análise médica passa a mexer no preço de verdade).
  if (idade > 50) b += (idade - 50) * 0.006
  // Fumante não é só mais caro: é mais IMPREVISÍVEL, porque cada seguradora
  // trata o agravo do seu jeito.
  if (fumante) b += 0.06
  return Math.min(b, BANDA_MAXIMA)
}

const arred = (v) => Math.round(v * 100) / 100

// Fator de idade de uma cobertura: o índice de prêmio elevado à elasticidade
// dela. Na idade de referência o índice é 1,00 e o fator também, qualquer que
// seja a elasticidade — a tabela vale como está escrita.
export function fatorIdade(cobId, idade, fumante = false) {
  const t = TABELA_TAXAS[cobId]
  if (!t || !Number.isFinite(idade)) return null
  const indice = indicePremioIdade(idade, { fumante })
  const referencia = indicePremioIdade(IDADE_REFERENCIA, { fumante: false })
  if (!(indice > 0) || !(referencia > 0)) return null
  return (indice / referencia) ** t.elasticidade
}

// Prêmio mensal central de UMA cobertura, para um valor qualquer. É a função
// que o resto do sistema usa para precificar desenhos de apólice que ainda não
// existem (os níveis do plano, o plano que cabe no orçamento).
export function precoMensal(cobId, valor, { idade, fumante = false, dias, franquia } = {}) {
  const t = TABELA_TAXAS[cobId]
  if (!t || !(valor > 0)) return 0
  const fator = fatorIdade(cobId, idade, fumante)
  if (fator == null) return 0

  if (t.base === 'diaria') {
    const d = Number.isFinite(dias) && dias > 0 ? dias : t.diasReferencia
    const escalaDias = (d / t.diasReferencia) ** EXPOENTE_DIAS
    let escalaFranquia = 1
    if (t.franquiaReferencia != null) {
      const f = Number.isFinite(franquia) && franquia >= 0 ? franquia : t.franquiaReferencia
      escalaFranquia = (t.franquiaReferencia + AMORTECIMENTO_FRANQUIA) / (f + AMORTECIMENTO_FRANQUIA)
    }
    return arred(valor * t.taxa * fator * escalaDias * escalaFranquia)
  }
  return arred((valor / 1000) * t.taxa * fator)
}

// ─────────────────────────────────────────────────────────────────────────────
// A ESTIMATIVA DO ESTUDO INTEIRO
//
// Recebe o estudo já calculado e devolve o custo estimado de cada cobertura
// ativa, mais o total em faixa. Devolve `null` quando não há idade: sem ela
// qualquer número aqui seria invenção.
// ─────────────────────────────────────────────────────────────────────────────
export function estimarPremio(estudo) {
  if (!estudo) return null
  const { idade, fumante } = estudo
  if (idade == null) return null

  const itens = (estudo.ativas ?? [])
    .filter((c) => TABELA_TAXAS[c.id])
    .map((c) => {
      const mensal = precoMensal(c.id, c.valor, {
        idade, fumante, dias: c.dias, franquia: c.franquia,
      })
      return {
        id: c.id,
        rotulo: c.curto ?? c.rotulo ?? c.id,
        grupo: c.grupo,
        valor: c.valor,
        mensal,
      }
    })
    .filter((i) => i.mensal > 0)
    .sort((a, b) => b.mensal - a.mensal)

  const mensal = arred(itens.reduce((s, i) => s + i.mensal, 0))
  if (!(mensal > 0)) return null

  const banda = bandaDe(idade, fumante)
  // A fatia de cada cobertura no total é o número mais acionável da tela: é
  // por ele que a consultora sabe o que cortar quando o preço trava a conversa.
  const comFatia = itens.map((i) => ({
    ...i,
    pctDoTotal: Math.round((i.mensal / mensal) * 1000) / 10,
    foraDaIdadeDeEmissao: idade > (IDADE_MAXIMA_EMISSAO[i.id] ?? 999),
  }))

  // O que a consultora precisa saber ANTES de montar a proposta em cima destes
  // números — e não depois, quando a seguradora recusar o risco.
  const avisos = comFatia
    .filter((i) => i.foraDaIdadeDeEmissao)
    .map((i) => ({
      id: i.id,
      texto: `${i.rotulo}: aos ${idade} anos essa cobertura passa da idade em que o mercado costuma emitir (${IDADE_MAXIMA_EMISSAO[i.id]}). A estimativa de R$ ${Math.round(i.mensal).toLocaleString('pt-BR')}/mês é ordem de grandeza para um produto que pode nem estar disponível — confirme com a seguradora antes de incluir na proposta.`,
    }))

  return {
    avisos,
    estimativa: true,
    idade,
    fumante,
    itens: comFatia,
    mensal: Math.round(mensal),
    min: Math.round(mensal * (1 - banda)),
    max: Math.round(mensal * (1 + banda * ASSIMETRIA_SUPERIOR)),
    anual: Math.round(mensal * 12),
    banda: Math.round(banda * 100),
    pctRenda: estudo.renda > 0 ? Math.round((mensal / estudo.renda) * 1000) / 10 : null,
    // Cabe na sobra do cliente? A conta que decide se a apólice chega ao sexto
    // mês, feita ANTES de cotar em vez de depois.
    cabeNaSobra: estudo.poupancaMensal == null ? null : mensal <= estudo.poupancaMensal,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A CONFERÊNCIA DA COTAÇÃO
//
// Quando a cotação chega, ela vira a verdade — mas uma cotação muito fora da
// faixa é sinal de alguma coisa, e é melhor descobrir o que antes de apresentar
// do que na frente do cliente. Duas hipóteses cobrem quase todos os casos:
// faltou cobertura na cotação, ou entrou agravo que ninguém comentou.
// ─────────────────────────────────────────────────────────────────────────────
export function conferirCotacao(estudo, estimativa) {
  const cotado = estudo?.investimento?.mensal ?? 0
  if (!estimativa || !(cotado > 0)) return null

  if (cotado > estimativa.max) {
    const pct = Math.round(((cotado / estimativa.mensal) - 1) * 100)
    return {
      situacao: 'acima',
      pct,
      texto: `A cotação de R$ ${Math.round(cotado).toLocaleString('pt-BR')}/mês está ${pct}% acima da estimativa por idade (faixa de R$ ${estimativa.min.toLocaleString('pt-BR')} a R$ ${estimativa.max.toLocaleString('pt-BR')}). Costuma ser agravo da análise médica, capital acima do teto automático ou uma cobertura a mais do que o estudo lista. Vale confirmar o que entrou antes de apresentar — se houver agravo, ele é um argumento a favor de fechar agora.`,
    }
  }
  if (cotado < estimativa.min) {
    const pct = Math.round((1 - (cotado / estimativa.mensal)) * 100)
    return {
      situacao: 'abaixo',
      pct,
      texto: `A cotação de R$ ${Math.round(cotado).toLocaleString('pt-BR')}/mês está ${pct}% abaixo da estimativa por idade (faixa de R$ ${estimativa.min.toLocaleString('pt-BR')} a R$ ${estimativa.max.toLocaleString('pt-BR')}). Confira se todas as coberturas do estudo entraram na cotação: uma proposta apresentada com capital que a apólice não tem é a pior forma de descobrir isso.`,
    }
  }
  return {
    situacao: 'dentro',
    pct: 0,
    texto: `A cotação está dentro da faixa estimada para a idade — nada a conferir por aqui.`,
  }
}
