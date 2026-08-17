// ─────────────────────────────────────────────────────────────────────────────
// O ROTEIRO DA APRESENTAÇÃO — para QUEM se fala, em que ORDEM e o que DIZER.
//
// A proposta já sabia montar 22 capítulos corretos. O que ela não sabia era a
// única coisa que a consultora precisa saber quando o cliente senta na frente
// dela: por onde começar, o que deixar de fora e qual frase dizer em cada
// slide. O deck saía igual para todo mundo — o casal de trinta anos com filho
// pequeno via os mesmos capítulos, na mesma ordem, com os mesmos títulos que o
// empresário de sessenta que veio tratar do inventário da holding.
//
// Um estudo genérico é lido como material de venda. Um estudo que abre pelo
// assunto que o cliente veio resolver é lido como consultoria — e a diferença
// entre os dois não está nos números (que já estavam certos), está na ORDEM e
// no que se diz em voz alta em cada momento.
//
// ── AS TRÊS COISAS QUE ESTE ARQUIVO DECIDE ───────────────────────────────────
//
//   1. O PÚBLICO. Sai do perfil que o diagnóstico já classificava e ninguém
//      usava na apresentação. São cinco, e cada um tem um EIXO: o assunto que
//      carrega a reunião inteira. Quem vem por sucessão não é conduzido pelo
//      capítulo da autonomia da família; quem não tem dependentes não ouve
//      "sua família perderia o padrão de vida", porque não há família a
//      perder padrão nenhum — e insistir nisso soa a venda forçada.
//
//   2. A ORDEM. O arco consultivo NÃO muda com o público (entender → tomar
//      consciência → ver a solução → ver o preço → decidir): mudar isso
//      produziria decks irreconhecíveis entre si e a consultora perderia o
//      chão. O que muda é quais capítulos abrem o bloco de consciência —
//      cada público PUXA para a frente os dois ou três que carregam a tese
//      dele, e o resto do deck segue a ordem base.
//
//   3. O QUE FALAR. Cada capítulo carrega o objetivo em uma linha, a frase de
//      abertura com os números DESTE cliente, a pergunta que devolve a palavra
//      a ele e o que evitar. Mais a objeção que costuma aparecer naquele
//      momento exato — porque objeção tem hora, e quem sabe a hora responde
//      antes de ela virar dúvida.
//
// ── A REGRA QUE GOVERNA O ARQUIVO ────────────────────────────────────────────
// AFIRMAÇÃO SOBRE ESTE CLIENTE SÓ COM O NÚMERO ATRÁS. Toda frase que diz
// quanto, quantos meses ou quanto falta é montada com os valores do estudo
// dele; quando o número que a sustentaria não existe, a frase não é gerada.
// Meia frase dita com confiança inteira na frente do cliente é pior do que
// silêncio.
//
// O que sempre sobra, mesmo no estudo mais vazio, é a frase de ENQUADRAMENTO —
// a que diz do que o capítulo trata sem afirmar número nenhum ("patrimônio não
// é liquidez"). É por isso que nenhum capítulo fica mudo: o pior momento para
// a consultora descobrir que aquele slide não tem nota é no meio da reunião.
//
// Determinístico, sem rede e sem modelo de linguagem: o mesmo estudo produz o
// mesmo roteiro, sempre. É o mínimo que se pede de um texto que a consultora
// vai ler em voz alta na frente de alguém.
// ─────────────────────────────────────────────────────────────────────────────

import { brl, brlCompacto } from './format.js'
import { COBERTURAS, COBERTURAS_EM_VIDA, IDADE_INDEPENDENCIA } from './estudo.js'

const m = (v) => brlCompacto(v)
const reais = (v) => brl(Math.round(v))
const curto = (id) => COBERTURAS.find((c) => c.id === id)?.curto ?? id

// ─── OS MOMENTOS DA REUNIÃO ──────────────────────────────────────────────────
// O mesmo arco do roteiro de conversa (`roteiro.js`), agora aplicado aos
// slides: a barra mostra em que momento ela está, e é isso que impede a
// apresentação de virar uma sequência de telas bonitas sem direção.
export const MOMENTOS = [
  { id: 'abertura', rotulo: 'Abertura', proposito: 'Dizer para quem é este estudo e o que ele promete.' },
  { id: 'retrato', rotulo: 'O retrato', proposito: 'Devolver a vida dele em números — ele precisa se reconhecer.' },
  { id: 'consciencia', rotulo: 'Consciência', proposito: 'Fazer o risco sair do abstrato. Sem isso, o número é caro.' },
  { id: 'solucao', rotulo: 'A solução', proposito: 'O plano que responde exatamente ao que ficou exposto.' },
  { id: 'preco', rotulo: 'O investimento', proposito: 'O preço vem depois do valor, e vem com opções.' },
  { id: 'prova', rotulo: 'A prova', proposito: 'A conta que resiste à conferência — e às objeções.' },
  { id: 'decisao', rotulo: 'A decisão', proposito: 'Transformar concordância em próximo passo com data.' },
]

// A que momento pertence cada capítulo. Fixo: o público muda a ordem dentro do
// bloco, nunca o papel do capítulo na conversa.
const MOMENTO_DO_CAPITULO = {
  capa: 'abertura',
  diagnostico: 'retrato',
  reenquadramento: 'consciencia',
  autonomia: 'consciencia',
  'em-vida': 'consciencia',
  patrimonio: 'consciencia',
  sucessao: 'consciencia',
  'linha-inventario': 'consciencia',
  empresa: 'consciencia',
  aposentadoria: 'consciencia',
  numero: 'solucao',
  filhos: 'solucao',
  gap: 'solucao',
  plano: 'solucao',
  investimento: 'preco',
  niveis: 'preco',
  'se-acontecer': 'prova',
  'investir-ou-proteger': 'prova',
  cruzamento: 'prova',
  dimensoes: 'prova',
  'custo-espera': 'decisao',
  passos: 'decisao',
  fechamento: 'decisao',
}

// ─── A ORDEM BASE ────────────────────────────────────────────────────────────
// A sequência que funciona para a maioria e que qualquer público reconhece.
// Os públicos reordenam PUXANDO capítulos para o começo da consciência; nada
// aqui é embaralhado por perfil.
export const ORDEM_BASE = [
  'capa', 'diagnostico', 'reenquadramento',
  'autonomia', 'em-vida', 'patrimonio', 'sucessao', 'linha-inventario',
  'empresa', 'aposentadoria',
  'numero', 'filhos', 'gap', 'plano',
  'investimento', 'niveis',
  'se-acontecer', 'investir-ou-proteger', 'cruzamento', 'dimensoes',
  'custo-espera', 'passos', 'fechamento',
]

// O primeiro capítulo depois do reenquadramento é onde os capítulos puxados
// entram. Antes dele estão a capa, o retrato e o reenquadramento — que abrem
// qualquer reunião, para qualquer público.
const ANCORA_CONSCIENCIA = 'reenquadramento'

// ─── OS PÚBLICOS ─────────────────────────────────────────────────────────────
// Um por perfil do diagnóstico, pelo mesmo `id` — o perfil já sabia QUEM é o
// cliente e a apresentação não usava essa informação para nada.
//
// `eixo` é o assunto que carrega a reunião e decide os títulos dos slides.
// `puxa` são os capítulos que vão para a frente da consciência.
// `evita` são os capítulos que, para este público, custam mais atenção do que
//         entregam — ficam fora por padrão e voltam com um toque no índice.
export const PUBLICOS = [
  {
    id: 'provedor',
    rotulo: 'Provedor de família',
    eixo: 'renda',
    promessa: 'O padrão de vida de quem depende dele não depende de ele estar aqui.',
    abertura: 'Alguém perde o padrão de vida no dia em que essa renda parar — a reunião inteira '
      + 'se organiza em torno de manter a casa de pé.',
    puxa: ['autonomia', 'em-vida'],
    evita: [],
  },
  {
    id: 'patrimonial',
    rotulo: 'Sucessão e patrimônio',
    eixo: 'sucessao',
    promessa: 'O patrimônio construído não é consumido para pagar o custo de transmiti-lo.',
    abertura: 'A renda já não é o problema. O problema é o patrimônio travar no inventário e a '
      + 'família ter que vender bem para pagar imposto.',
    puxa: ['patrimonio', 'sucessao', 'linha-inventario'],
    evita: [],
  },
  {
    id: 'empresario',
    rotulo: 'Sócio / empresário',
    eixo: 'empresa',
    promessa: 'A empresa continua girando e a família não vira sócia de ninguém.',
    abertura: 'A exposição maior não está na família: está no que a empresa deve, no que ela '
      + 'avalizou e em quem a faz girar.',
    puxa: ['empresa', 'sucessao', 'linha-inventario'],
    evita: [],
  },
  {
    id: 'individual',
    rotulo: 'Sem dependentes',
    eixo: 'vida',
    promessa: 'O risco real não é faltar: é continuar aqui sem poder trabalhar.',
    abertura: 'Ninguém depende dessa renda, então morrer não deixa conta para ninguém. Esta '
      + 'apresentação é sobre ele mesmo, e não sobre a família dele.',
    puxa: ['em-vida'],
    // A autonomia da família não existe para quem não tem quem dependa dele, e
    // apresentar o capítulo mesmo assim é o momento em que a reunião vira
    // discurso pronto — o cliente percebe na hora que aquilo não foi feito
    // para ele.
    evita: ['autonomia', 'filhos'],
  },
  {
    id: 'acumulacao',
    rotulo: 'Acúmulo e aposentadoria',
    eixo: 'acumulo',
    promessa: 'O plano de chegar lá não morre junto com a renda que o alimenta.',
    abertura: 'O objetivo dele é chegar lá. O seguro entra como o que garante que o plano de '
      + 'acúmulo não para no dia em que a renda parar.',
    puxa: ['aposentadoria', 'em-vida'],
    evita: [],
  },
]

// Sem perfil (estudo ainda sem dados suficientes) a apresentação não pode
// simplesmente quebrar: ela cai no público neutro, que é a ordem base inteira,
// sem capítulo nenhum fora. É o comportamento antigo, preservado de propósito.
export const PUBLICO_NEUTRO = {
  id: 'geral',
  rotulo: 'Estudo geral',
  eixo: 'renda',
  promessa: 'Proteção financeira desenhada sob medida para o que importa para ele.',
  abertura: 'O estudo ainda não tem dados suficientes para um roteiro por público — '
    + 'a apresentação segue a ordem completa.',
  puxa: [],
  evita: [],
}

export const publicoPorId = (id) => PUBLICOS.find((p) => p.id === id) ?? PUBLICO_NEUTRO

// ─── QUAIS CAPÍTULOS FICAM DE FORA ───────────────────────────────────────────
// Um capítulo a menos não é uma apresentação mais pobre: é uma apresentação que
// respeita o tempo do cliente. A régua para tirar um capítulo é dura de
// propósito — só sai o que, para ESTE cliente, discute um assunto que ele não
// levantou ou responde uma pergunta que ele não fez.
//
// Nada é apagado: os capítulos saem apenas do CAMINHO de avançar nesta reunião,
// continuam no índice a um toque, e o PDF e o link do cliente seguem inteiros.
function capitulosFora(e, publico, { objecoes = null } = {}) {
  const fora = new Map()
  const tirar = (slide, motivo) => { if (!fora.has(slide)) fora.set(slide, motivo) }

  // SEM SABER QUEM ELE É, NÃO SE TIRA NADA. Um estudo ainda sem renda,
  // patrimônio nem foco não classifica público — e ausência de dado não é
  // informação sobre o cliente. Cortar capítulo por falta de preenchimento
  // seria a consultora perder metade do deck justamente na reunião em que ela
  // ainda está descobrindo o cliente.
  if (publico.id === 'geral' || !(e.renda > 0 || e.patrimonioBruto > 0)) return fora

  for (const slide of publico.evita ?? []) {
    tirar(slide, publico.id === 'individual'
      ? 'Ninguém depende financeiramente dele: falar do padrão de vida da família soa a discurso pronto.'
      : `Fora do eixo desta conversa (${publico.rotulo.toLowerCase()}).`)
  }

  // O DEBATE QUE ELE NÃO ABRIU. Três capítulos da proposta existem para
  // responder "não seria melhor investir?". São ótimos — e só quando a
  // pergunta existe. Para quem não investe, não aporta em previdência e não
  // veio por acúmulo, eles introduzem uma dúvida que o cliente não tinha, no
  // meio da reunião, contra a própria proposta.
  const debateDeInvestimento = e.previdenciaAporte > 0 || e.investimentos > 0
    || e.focos.includes('aposentadoria') || publico.eixo === 'acumulo'
    || (objecoes?.porId?.investir?.pontos ?? 0) >= 70
  if (!debateDeInvestimento) {
    for (const slide of ['investir-ou-proteger', 'cruzamento', 'dimensoes']) {
      tirar(slide, 'Ele não investe nem aporta em previdência — abrir o debate "investir ou proteger" '
        + 'cria a objeção em vez de responder a ela. O capítulo "Se acontecer amanhã" já faz o ponto.')
    }
  }

  // O INVENTÁRIO PEQUENO. A linha do tempo do inventário é o capítulo mais
  // longo do deck e vive de uma conta grande. Quando o custo do inventário não
  // chega a meio ano de renda, ele consome cinco minutos para provar um ponto
  // que o próprio cliente considera pequeno — e a sucessão continua sendo dita
  // no capítulo anterior, que é curto.
  const inventarioPequeno = e.custoInventario > 0 && e.renda > 0
    && e.custoInventario < e.renda * 6 && e.deficitLiquidez <= 0
  if (inventarioPequeno && publico.eixo !== 'sucessao') {
    tirar('linha-inventario', `O inventário custa ${m(e.custoInventario)} e a família já tem liquidez `
      + 'para ele: o calendário mês a mês prova um ponto que aqui é pequeno.')
  }

  // As três formas de fazer existem para trocar "aceita?" por "qual dos três?".
  // Com o orçamento apertado a escada é o capítulo mais importante da reunião;
  // ela nunca sai por perfil, só por falta de cotação (o que a própria tela
  // resolve não renderizando o capítulo).

  return fora
}

// ─── A ORDEM PARA ESTE PÚBLICO ───────────────────────────────────────────────
// Puxa os capítulos da tese para logo depois do reenquadramento, mantendo tudo
// o mais na ordem base. Devolve a lista inteira — os capítulos que este cliente
// não tem simplesmente não aparecem na tela, e a ordem continua válida.
export function ordemPara(publico) {
  const puxados = (publico.puxa ?? []).filter((s) => ORDEM_BASE.includes(s))
  if (puxados.length === 0) return [...ORDEM_BASE]

  const resto = ORDEM_BASE.filter((s) => !puxados.includes(s))
  const corte = resto.indexOf(ANCORA_CONSCIENCIA) + 1
  return [...resto.slice(0, corte), ...puxados, ...resto.slice(corte)]
}

// ─────────────────────────────────────────────────────────────────────────────
// AS FALAS — o que dizer em cada capítulo, com os números deste cliente.
//
// `objetivo`  o que este slide precisa deixar acontecido, em uma linha;
// `diga`      a frase de abertura, pronta para ser dita em voz alta;
// `pergunte`  a pergunta que devolve a palavra ao cliente (slide que só informa
//             vira monólogo, e monólogo não fecha);
// `cuidado`   o erro que este capítulo específico convida a cometer;
// `objecao`   a objeção que costuma nascer aqui — o id bate com `objecoes.js`,
//             e a barra mostra a resposta já calculada para este cliente.
//
// Cada montador recebe o contexto e devolve o que consegue sustentar com
// número. Campo sem número atrás fica de fora.
// ─────────────────────────────────────────────────────────────────────────────

const FALAS = {
  capa: ({ e, nome, publico }) => ({
    objetivo: 'Dizer em uma frase para que serve o próximo meia hora.',
    diga: [
      `${nome}, isto não é uma proposta de seguro: é o estudo do que a sua vida financeira `
      + `pede hoje. ${publico.promessa}`,
      e.focos.length > 0
        ? 'Os assuntos aqui embaixo são os que você me trouxe — a apresentação segue exatamente eles.'
        : null,
    ],
    pergunte: 'Antes de eu começar: mudou alguma coisa desde a nossa conversa?',
    cuidado: 'Não comece pelo produto nem pela seguradora. A capa é sobre ele, e o nome dele está nela.',
  }),

  diagnostico: ({ e }) => ({
    objetivo: 'Ele precisa se reconhecer nos números antes de aceitar qualquer conclusão tirada deles.',
    diga: [
      e.renda > 0 && e.custoVida > 0
        ? `Estes são os números que você me deu: ${reais(e.renda)} de renda, ${reais(e.custoVida)} `
          + `de custo de vida${e.patrimonioBruto > 0 ? ` e ${m(e.patrimonioBruto)} construídos` : ''}.`
        : 'Este é o retrato que montamos juntos na nossa conversa.',
      'Tudo isso depende de uma única coisa continuar existindo: a sua capacidade de gerar renda.',
    ],
    pergunte: 'Está tudo certo aqui? Se algum número estiver defasado, é melhor corrigir agora.',
    cuidado: 'Não passe rápido. É o único slide em que o cliente confere, e é a conferência dele '
      + 'que dá autoridade a todos os números seguintes.',
  }),

  reenquadramento: ({ publico }) => ({
    objetivo: 'Tirar a palavra "morte" do centro da conversa antes que ela trave o resto.',
    diga: [
      publico.eixo === 'vida'
        ? 'A maior parte deste plano paga com você aqui: invalidez, doença grave, cirurgia, '
          + 'internação e afastamento. Morrer é o capítulo menor deste estudo.'
        : publico.eixo === 'sucessao'
          ? 'Seguro de vida, aqui, não é sobre morrer: é sobre o que acontece com o que você '
            + 'construiu no dia seguinte.'
          : 'Seguro de vida não é sobre morrer. É sobre continuar cuidando — com ou sem você por perto.',
    ],
    pergunte: 'Qual desses três é o que mais pesa para você?',
    cuidado: 'Não liste as três coisas de uma vez. Revele um cartão por vez e pare depois de cada um — '
      + 'é aqui que ele começa a falar, e o que ele disser vale mais que o slide.',
    objecao: 'nao_recebo',
  }),

  autonomia: ({ e }) => ({
    objetivo: 'Transformar "se algo acontecer" em um número de meses que ele não esperava.',
    diga: [
      e.mesesLiquidos != null
        ? `Sem vender nada, a sua família se sustenta ${e.mesesLiquidos} ${e.mesesLiquidos === 1 ? 'mês' : 'meses'}. `
          + `Com o plano, ${e.mesesComPlano} — e o patrimônio fica inteiro.`
        : e.mesesVendendoTudo != null
          ? `Vendendo tudo o que você construiu, a família mantém o padrão por ${e.mesesVendendoTudo} meses `
            + '— e termina com zero de patrimônio.'
          : null,
      'O plano não substitui o que você construiu: ele impede que seja consumido.',
    ],
    pergunte: 'Se a sua renda parasse hoje, por quanto tempo você acha que eles manteriam o padrão?',
    cuidado: 'Faça a pergunta ANTES de mostrar o número. O valor deste slide está na diferença entre '
      + 'o que ele chuta e o que a conta mostra.',
    objecao: 'patrimonio',
  }),

  'em-vida': ({ e }) => {
    const ativas = COBERTURAS_EM_VIDA.filter((id) => e.valores[id] > 0)
    return {
      objetivo: 'Desmontar de vez o "isso só serve depois que eu morrer" — com a lista na tela.',
      diga: [
        ativas.length > 0
          ? `${ativas.length} das coberturas deste plano pagam com você aqui: `
            + `${ativas.map(curto).join(', ')}.`
          : 'A maior parte dos sinistros desta categoria acontece com o segurado vivo.',
        e.valores.doencas_graves > 0
          ? `No diagnóstico de uma doença grave, ${m(e.valores.doencas_graves)} caem na sua conta `
            + 'para você usar como quiser — sem tocar em nada do que você construiu.'
          : null,
        e.valores.cirurgias > 0
          ? `E cirurgia é o que mais acontece: ${m(e.valores.cirurgias)} por procedimento, `
            + 'para o que o plano de saúde não paga.'
          : null,
      ],
      pergunte: 'Se você precisasse operar amanhã e ficar seis semanas sem trabalhar, quem cobriria essas seis semanas?',
      cuidado: 'Não chame isso de "benefício extra". São as coberturas mais acionadas da apólice — '
        + 'trate-as como o centro do plano, porque estatisticamente elas são.',
      objecao: 'plano_saude',
    }
  },

  patrimonio: ({ e }) => ({
    objetivo: 'Separar patrimônio de liquidez. São coisas diferentes, e quase ninguém separa.',
    diga: [
      e.patrimonioBruto > 0
        ? `Você construiu ${m(e.patrimonioBruto)}. Na segunda-feira seguinte, a sua família acessa `
          + `${m(e.liquidezImediata)} disso.`
        : null,
      e.pctIliquido != null && e.pctIliquido >= 50
        ? `${e.pctIliquido}% do que você construiu não vira dinheiro rápido — e é exatamente esse `
          + 'perfil que obriga a vender abaixo do valor.'
        : 'Patrimônio não é liquidez: o que a família precisa no primeiro mês é dinheiro disponível.',
    ],
    pergunte: 'Se a sua família precisasse de dinheiro no primeiro mês, de onde ele sairia?',
    cuidado: 'Não sugira que ele construiu errado. Ele construiu bem e construiu ilíquido — '
      + 'são coisas diferentes, e confundi-las coloca você do lado oposto ao dele.',
    objecao: 'patrimonio',
  }),

  sucessao: ({ e }) => ({
    objetivo: 'Pôr na mesa a conta que a família paga ANTES de receber qualquer bem.',
    diga: [
      e.custoInventario > 0
        ? `Para destravar ${m(e.bensInventariaveis)} de patrimônio, a sua família precisa entregar `
          + `${m(e.custoInventario)} em dinheiro, à vista, antes de acessar qualquer bem.`
        : null,
      e.deficitLiquidez > 0
        ? `Hoje faltam ${m(e.deficitLiquidez)} para essa conta. Sem eles, a saída é vender com pressa — `
          + 'e quem compra de família com inventário aberto sabe disso.'
        : 'O capital do seguro não entra em inventário e chega em dias, direto a quem você indicar.',
    ],
    pergunte: `De onde sairia esse dinheiro hoje, se fosse preciso na semana que vem?`,
    cuidado: 'Não entre em discussão jurídica de ITCMD por estado. A premissa está no rodapé do slide; '
      + 'o assunto aqui é de onde sai o dinheiro, não a alíquota.',
    objecao: 'patrimonio',
  }),

  'linha-inventario': ({ e }) => ({
    objetivo: 'Mostrar que a conta chega antes do dinheiro — o problema é de calendário, não de tamanho.',
    diga: [
      e.sucessao?.inventarioJudicial
        ? 'Como você tem herdeiro menor, o inventário nem pode ser feito em cartório: vai para a '
          + `justiça, com o Ministério Público acompanhando — cerca de ${e.sucessao.prazoInventarioMeses} meses.`
        : `Pelo caminho mais rápido, o extrajudicial, ainda são cerca de ${e.sucessao?.prazoInventarioMeses ?? 6} `
          + 'meses até a escritura de partilha sair.',
      e.custoVida > 0
        ? `E ${reais(e.custoVida)} por mês de contas continuam chegando o tempo todo.`
        : null,
    ],
    pergunte: 'Você já acompanhou um inventário de perto? Como foi o tempo até liberar as coisas?',
    cuidado: 'Não leia os cinco degraus em voz alta. Revele um a um e comente só os dois que pesam '
      + 'para ele — o slide inteiro lido vira aula, e aula perde a reunião.',
  }),

  empresa: ({ e }) => ({
    objetivo: 'Mostrar que o risco da empresa alcança o patrimônio pessoal dele.',
    diga: [
      e.pj?.dividaAval > 0
        ? `${m(e.pj.dividaAval)} de dívida da empresa estão avalizados por você. O aval não morre `
          + 'com o avalista: vira dívida do espólio e alcança o patrimônio da família.'
        : null,
      e.pj?.quota > 0 && e.pj?.numSocios >= 2
        ? `E a sua quota vale ${m(e.pj.quota)}: sem capital, os seus sócios compram do próprio bolso `
          + 'ou passam a ser sócios dos seus herdeiros.'
        : 'A empresa não pode parar, e a sua família não pode virar sócia de ninguém.',
    ],
    pergunte: 'Vocês têm acordo de sócios escrito? E ele diz de onde sai o dinheiro da compra?',
    cuidado: 'Não trate a empresa como um patrimônio a mais. Aqui o cliente é o sócio, e o que decide '
      + 'é o que acontece com a sociedade na segunda-feira.',
    objecao: 'conjuge',
  }),

  aposentadoria: ({ e }) => ({
    objetivo: 'Ligar o plano de acúmulo à proteção — é o elo que quase ninguém faz.',
    diga: [
      e.aposentadoria?.aporteAtual > 0
        ? `Você aporta ${reais(e.aposentadoria.aporteAtual)} por mês, e esse aporte sai da renda do `
          + 'trabalho. Numa invalidez, ele para no mesmo mês em que a renda para.'
        : null,
      e.aposentadoria?.lacuna > 0
        ? `Para a meta de ${reais(e.aposentadoria.alvoMensal)} por mês, ainda faltam `
          + `${m(e.aposentadoria.lacuna)} no caminho de hoje.`
        : 'Proteger a renda é o que mantém o plano de aposentadoria vivo.',
    ],
    pergunte: 'O que acontece com esse plano se você ficar dois anos sem poder trabalhar?',
    cuidado: 'Não critique a previdência dele. O ponto não é o produto: é o que financia o aporte.',
    objecao: 'investir',
  }),

  numero: ({ e, publico }) => ({
    objetivo: 'Entregar UM número e deixá-lo respirar. Este slide não tem segunda ideia.',
    diga: [
      publico.eixo === 'vida'
        ? `${m(e.valores.morte)} é o capital que fecha as suas contas e não deixa nada para ninguém `
          + 'resolver por você.'
        : e.mesesProtegidos > 0
          ? `${m(e.valores.morte)}. Este número sustenta o padrão de vida da sua família por `
            + `${Math.floor(e.mesesProtegidos / 12)} anos${e.dividas > 0 ? `, já quitando ${m(e.dividas)} de dívidas` : ''}.`
          : `${m(e.valores.morte)} — e este número tem uma conta atrás, que eu te mostro linha a linha.`,
    ],
    pergunte: 'O que passou pela sua cabeça quando você viu esse valor?',
    cuidado: 'Silêncio depois do número. Quem explica um número grande antes de o cliente reagir '
      + 'está pedindo desculpa por ele.',
  }),

  filhos: ({ e }) => ({
    objetivo: 'Mostrar que o gasto com os filhos tem data para acabar — e que o plano respeita isso.',
    diga: [
      e.capitalFilhos > 0
        ? `${m(e.capitalFilhos)} do capital são dos seus filhos, calculados até cada um completar `
          + `${IDADE_INDEPENDENCIA} anos. Nem um dia a mais.`
        : `A conta dos filhos entra no plano com prazo: até cada um completar ${IDADE_INDEPENDENCIA} anos.`,
    ],
    pergunte: 'Faz sentido proteger até os 24, ou vocês pensam em bancar a pós também?',
    cuidado: 'Não use os filhos como alavanca emocional. O argumento aqui é aritmético, e é justamente '
      + 'a frieza da conta ("nem um real a mais") que dá credibilidade ao número.',
  }),

  gap: ({ e }) => ({
    objetivo: 'Mostrar que a proposta é a DIFERENÇA, não uma segunda apólice em cima da primeira.',
    diga: [
      e.gap > 0
        ? `Você já tem ${m(e.coberturaAtual)}. O estudo recomenda ${m(e.valores.morte)} — a proposta `
          + `trata dos ${m(e.gap)} que faltam, e não do total.`
        : 'A sua cobertura atual está no alvo do que o estudo recomenda.',
      e.capitalQueEvapora > 0
        ? `Só que ${m(e.capitalQueEvapora)} do que você tem é da empresa e acaba com o vínculo. `
          + `Sem isso, o que falta salta para ${m(e.gapPortavel)}.`
        : null,
    ],
    pergunte: 'Você tem a apólice atual aí? Vale a gente olhar quem é o beneficiário e até quando ela vale.',
    cuidado: 'Não critique quem vendeu a apólice que ele já tem. Peça o documento: ele faz o argumento '
      + 'sozinho, e você fica do lado dele lendo.',
    objecao: 'ja_tem',
  }),

  plano: ({ e, nome }) => ({
    objetivo: 'Mostrar a apólice inteira de uma vez — é o slide que justifica o preço do próximo.',
    diga: [
      e.ativas.length > 0
        ? `São ${e.ativas.length} coberturas, ${nome}. Cada uma responde a uma coisa que a gente `
          + `conversou hoje, e juntas somam ${m(e.capitalTotal)} de importância segurada.`
        : `Este é o plano inteiro, ${nome} — cada linha nasceu de alguma coisa que a gente conversou hoje.`,
      e.capitalMaximoEvento > 0 && e.capitalMaximoEvento < e.capitalTotal
        ? `Elas se acionam conforme o que acontece — em um único acontecimento, a família recebe até `
          + `${m(e.capitalMaximoEvento)}.`
        : null,
    ],
    pergunte: 'Alguma dessas linhas você quer que eu abra melhor?',
    cuidado: 'Não leia a lista inteira. Aponte as três que nasceram do que ELE disse na reunião e '
      + 'deixe o resto para as perguntas dele.',
  }),

  investimento: ({ e }) => ({
    objetivo: 'Dizer o preço uma vez, com clareza, e calar.',
    diga: [
      e.investimento?.mensal > 0
        ? `${reais(e.investimento.mensal)} por mês` + (e.investimento.diario > 0
          ? ` — ${reais(e.investimento.diario)} por dia.` : '.')
        : 'Você escolhe como pagar: as duas formas dão exatamente a mesma proteção.',
      e.investimento?.alavancagem > 0
        ? `Cada R$ 1 aqui carrega ${e.investimento.alavancagem.toLocaleString('pt-BR')} reais de proteção. `
          + 'Não existe outro produto financeiro com essa relação.'
        : null,
    ],
    pergunte: 'Como você prefere: mensal no débito ou anual à vista?',
    cuidado: 'Não defenda o preço e não ofereça desconto. Preço defendido vira negociação, e a tabela '
      + 'é da seguradora. O que se ajusta é o ESCOPO — e o próximo capítulo existe para isso.',
    objecao: 'preco',
  }),

  niveis: ({ e }) => ({
    objetivo: 'Trocar a pergunta "aceita?" por "qual dos três?".',
    diga: [
      'Não é uma escolha entre proteger e não proteger. É entre começar por tudo ou começar pelo '
      + 'que mais pesa — e subir depois, quando fizer sentido.',
      e.poupancaMensal > 0
        ? 'Pela sua sobra mensal, o que cabe com folga é este aqui do meio.'
        : null,
    ],
    pergunte: 'Qual desses três desenhos você levaria hoje?',
    cuidado: 'Não empurre o completo. Defenda o do meio e mostre honestamente o que o essencial deixa '
      + 'descoberto — a coluna do que falta é o que torna a escolha confiável.',
    objecao: 'preco',
  }),

  'se-acontecer': ({ e }) => ({
    objetivo: 'Mostrar a diferença de ordem de grandeza no primeiro ano.',
    diga: [
      'O mesmo dinheiro, os dois caminhos, no primeiro ano — e a diferença não é de percentual, '
      + 'é de ordem de grandeza.',
      e.acumularEmVezDeSegurar?.anos != null
        ? `Guardando, você leva ${String(e.acumularEmVezDeSegurar.anos).replace('.', ',')} anos para `
          + 'chegar onde o seguro chega no primeiro mês.'
        : null,
    ],
    pergunte: 'E se acontecesse no ano que vem?',
    cuidado: 'Não transforme isso em ataque ao investimento. O terreno é o PRAZO, não o rendimento.',
    objecao: 'investir',
  }),

  'investir-ou-proteger': () => ({
    objetivo: 'Responder à objeção mais legítima da categoria antes que ela seja feita.',
    diga: [
      'É a pergunta certa, e a resposta não é escolher um dos dois: é olhar o prazo.',
      'Investimento e seguro não competem — o seguro é o que impede o seu investimento de ser '
      + 'consumido no pior momento.',
    ],
    pergunte: 'Concordo que você deve continuar investindo. Minha pergunta é outra: e se acontecer '
      + 'antes de a conta chegar lá?',
    cuidado: 'Não tente ganhar no rendimento de longo prazo. Ele tem razão nesse ponto, e um assessor '
      + 'desmonta o argumento em trinta segundos.',
    objecao: 'investir',
  }),

  cruzamento: ({ e }) => ({
    objetivo: 'Provar o argumento anterior com a curva, ano a ano.',
    diga: [
      'A área riscada é o que faltaria à sua família se acontecesse naquele ano — e ela é maior '
      + 'justamente no começo.',
      e.recursosLiquidos > 0
        ? `Hoje você tem ${m(e.recursosLiquidos)} líquidos: é daqui que a curva azul parte.`
        : null,
    ],
    pergunte: 'Faz sentido a premissa de juro real que eu usei aqui?',
    cuidado: 'Deixe a premissa à vista e ofereça mudá-la. Gráfico com premissa escondida é o tipo de '
      + 'slide que um cliente analítico derruba inteiro com uma pergunta.',
    objecao: 'investir',
  }),

  dimensoes: () => ({
    objetivo: 'Ganhar credibilidade mostrando onde o investimento ganha.',
    diga: [
      'Repare que o investimento ganha duas linhas desta tabela — e é para ganhar mesmo. '
      + 'O seguro não está aqui para render mais que ele.',
    ],
    pergunte: 'Qual dessas linhas é a que mais importa para você?',
    cuidado: 'Não minimize as linhas em que o outro lado ganha. É a honestidade delas que faz o '
      + 'cliente acreditar nas linhas em que o seguro ganha.',
  }),

  'custo-espera': ({ e }) => ({
    objetivo: 'Dar preço à espera, sem criar urgência falsa.',
    diga: [
      e.custoDaEspera?.cenarios?.length > 0
        ? `A mesma apólice daqui a ${e.custoDaEspera.cenarios.at(-1).daquiAAnos} anos custaria cerca de `
          + `${reais(e.custoDaEspera.cenarios.at(-1).mensal)} por mês — e isso supondo a mesma saúde de hoje.`
        : null,
      'O que você tem hoje e não vai ter depois não é dinheiro: é saúde aprovada na análise.',
    ],
    pergunte: 'O que precisaria acontecer para isso virar prioridade neste mês?',
    cuidado: 'Nada de "essa condição é só hoje". Urgência inventada transforma um "quase" em um "não" '
      + 'definitivo — e leva junto a indicação que viria dele.',
    objecao: 'pensar',
  }),

  passos: () => ({
    objetivo: 'Transformar concordância em um próximo passo com data.',
    diga: [
      'São quatro passos, e o primeiro leva poucos minutos: a declaração de saúde, pelo link que eu te mando.',
      'A proteção vale a partir do primeiro pagamento — não depende de a apólice ficar pronta.',
    ],
    pergunte: 'Posso já te mandar a declaração de saúde hoje?',
    cuidado: 'Não termine em "eu te aviso". Combine dia e hora do retorno aqui, com ele olhando o slide.',
    objecao: 'adiar',
  }),

  fechamento: ({ nome, objetivos }) => ({
    objetivo: 'Fechar com a frase dele, não com a sua.',
    diga: [
      objetivos ? `Você me disse que queria garantir isto: "${objetivos}". É exatamente para isso `
        + 'que este plano existe.' : null,
      `Vamos ativar o seu plano, ${nome}?`,
    ],
    pergunte: 'O que falta para começarmos ainda este mês?',
    cuidado: 'Faça a pergunta e espere. O silêncio depois do fechamento é dele — quem preenche esse '
      + 'silêncio compra de volta a própria proposta.',
    objecao: 'pensar',
  }),
}

// ─────────────────────────────────────────────────────────────────────────────
// OS TEXTOS DO SLIDE — o que muda na TELA conforme o público.
//
// Não é enfeite: o título do slide é a frase que o cliente lê antes de a
// consultora falar. "Se a renda parasse hoje, por quanto tempo a família
// manteria o padrão de vida?" é uma pergunta excelente para um pai de família e
// uma pergunta sem sentido para quem mora sozinho — e o cliente que lê uma
// pergunta sem sentido para ele conclui, corretamente, que o estudo é de
// prateleira.
//
// Só devolve o que muda. O que não estiver aqui continua com o texto do slide.
// ─────────────────────────────────────────────────────────────────────────────

const TEXTOS = {
  // A etiqueta da capa é a primeira coisa que o cliente lê, e ela precisa
  // dizer duas verdades ao mesmo tempo: de que assunto este estudo trata (o
  // eixo do público) e se ele alcança a empresa. Um sócio que recebe um
  // "estudo de sucessão" sem a palavra empresarial na capa pergunta, com
  // razão, se a clínica entrou na conta.
  capa: ({ e, publico }) => {
    const comEmpresa = e.temPJ && e.capitalPJ > 0
    const porEixo = {
      empresa: 'Estudo de proteção pessoal e empresarial',
      sucessao: comEmpresa
        ? 'Estudo de sucessão patrimonial e empresarial'
        : 'Estudo de sucessão e blindagem patrimonial',
      vida: comEmpresa
        ? 'Estudo de proteção pessoal e empresarial'
        : 'Estudo de proteção da sua renda e da sua saúde',
      acumulo: comEmpresa
        ? 'Estudo de proteção pessoal e empresarial'
        : 'Estudo de acúmulo e proteção do plano de longo prazo',
      renda: comEmpresa
        ? 'Estudo de proteção pessoal e empresarial'
        : 'Estudo de proteção da renda familiar',
    }
    return { etiqueta: porEixo[publico.eixo] ?? porEixo.renda }
  },

  reenquadramento: ({ publico }) => (
    publico.eixo === 'vida' ? {
      etiqueta: 'Antes de tudo, uma verdade',
      titulo: 'Seguro de vida quase nunca é sobre morrer.',
      destaque: 'É sobre continuar de pé.',
      remate: 'A maior parte dos sinistros desta categoria acontece com o segurado vivo — '
        + 'e é justamente a parte que ninguém contrata.',
    } : publico.eixo === 'sucessao' ? {
      etiqueta: 'Antes de tudo, uma verdade',
      titulo: 'Seguro de vida não é sobre morrer.',
      destaque: 'É sobre o que acontece com o que você construiu.',
      remate: 'É o único ativo que vira dinheiro exatamente no dia em que todo o resto trava.',
    } : publico.eixo === 'empresa' ? {
      etiqueta: 'Antes de tudo, uma verdade',
      titulo: 'Seguro de vida não é sobre morrer.',
      destaque: 'É sobre a empresa continuar girando.',
      remate: 'É o único ativo que se multiplica exatamente na hora em que a sociedade mais precisa.',
    } : {
      etiqueta: 'Antes de tudo, uma verdade',
      titulo: 'Seguro de vida não é sobre morrer.',
      destaque: 'É sobre continuar cuidando.',
      remate: 'É o único ativo que se multiplica exatamente na hora que você mais precisa.',
    }
  ),

  autonomia: ({ publico }) => ({
    titulo: publico.eixo === 'sucessao'
      ? 'Se a renda parasse hoje, por quanto tempo o padrão de vida da casa se manteria — sem vender bens?'
      : 'Se a renda parasse hoje, por quanto tempo a família manteria o padrão de vida?',
  }),

  numero: ({ e, publico }) => ({
    etiqueta: publico.eixo === 'sucessao' ? 'A liquidez recomendada'
      : publico.eixo === 'vida' ? 'A proteção recomendada para você'
        : 'A proteção recomendada',
    // Sem dependentes o capital não repõe renda de ninguém: ele fecha as contas
    // que a morte dele deixa abertas. Dizer "sustenta a família" aqui seria
    // descrever um cálculo que o próprio motor não fez.
    legenda: !e.temDependentes && e.dividas > 0
      ? `Quita ${m(e.dividas)} de dívidas e não deixa conta aberta para ninguém resolver.`
      : null,
  }),

  'em-vida': ({ e }) => ({
    etiqueta: 'Proteção em vida',
    titulo: 'A maior parte deste plano paga com você aqui',
    remate: e.valores.cirurgias > 0
      ? 'Doença grave, cirurgia, internação e afastamento acontecem muito mais do que o cenário '
        + 'que todo mundo imagina quando ouve "seguro de vida".'
      : 'Invalidez, doença grave e afastamento acontecem muito mais do que o cenário que todo '
        + 'mundo imagina quando ouve "seguro de vida".',
  }),

  plano: ({ publico }) => ({
    etiqueta: publico.eixo === 'empresa' ? 'O plano pessoal e o da empresa' : 'Seu plano completo',
  }),

  fechamento: ({ publico }) => (
    publico.eixo === 'sucessao' ? {
      titulo: 'O patrimônio você já construiu.',
      destaque: 'Falta garantir que ele chegue inteiro.',
    } : publico.eixo === 'empresa' ? {
      titulo: 'A empresa depende de decisões suas.',
      destaque: 'Esta é uma delas.',
    } : publico.eixo === 'vida' ? {
      titulo: 'O melhor dia para proteger a sua renda foi ontem.',
      destaque: 'O segundo melhor é hoje.',
    } : {
      titulo: 'O melhor dia para proteger sua família foi ontem.',
      destaque: 'O segundo melhor é hoje.',
    }
  ),
}

// ─── OS CARTÕES DO REENQUADRAMENTO ───────────────────────────────────────────
// Três cartões, escolhidos primeiro pelo que ELE declarou na reunião (os focos)
// e depois pelo eixo do público. Quem veio por sucessão não ouve primeiro sobre
// a educação dos filhos.
const CARTOES_POR_EIXO = {
  renda: ['vida', 'renda', 'educacao'],
  sucessao: ['sucessao', 'blindagem', 'vida'],
  empresa: ['empresarial', 'sucessao', 'vida'],
  vida: ['vida', 'dividas', 'blindagem'],
  acumulo: ['aposentadoria', 'vida', 'renda'],
}

export function cartoesDoReenquadramento(e, publico) {
  const escolhidos = [...(e.focos ?? []), ...(CARTOES_POR_EIXO[publico.eixo] ?? []), 'vida', 'renda']
  const vistos = new Set()
  return escolhidos.filter((id) => (vistos.has(id) ? false : vistos.add(id))).slice(0, 3)
}

// ─── O QUE O PLANO PAGA COM ELE AQUI ─────────────────────────────────────────
// Alimenta o capítulo "proteção em vida": as coberturas ativas que pagam com o
// segurado vivo, já com o total que elas representam em dinheiro (as diárias
// entram pelo limite total, que é o que a cobertura vale de verdade).
export function protecaoEmVida(e) {
  if (!e) return null
  const itens = COBERTURAS_EM_VIDA
    .map((id) => {
      const cob = (e.ativas ?? []).find((c) => c.id === id)
      if (!cob) return null
      const total = cob.tipo === 'diaria' ? (cob.total ?? cob.valor * (cob.dias ?? 0)) : cob.valor
      return { ...cob, totalEmDinheiro: total }
    })
    .filter(Boolean)
  if (itens.length === 0) return null
  return {
    itens,
    // Quanto o plano pode entregar sem que nada de irreversível tenha
    // acontecido. Não é a soma de um sinistro só — é a amplitude da parte da
    // apólice que paga em vida, e o slide diz isso com essas palavras.
    total: itens.reduce((s, i) => s + i.totalEmDinheiro, 0),
    // A maior indenização única em vida: o número que resiste à pergunta
    // "mas elas pagam todas juntas?".
    maior: Math.max(...itens.map((i) => i.totalEmDinheiro)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// O ROTEIRO
//
// Recebe o estudo e o diagnóstico (que já sabe o perfil) e devolve tudo o que a
// apresentação precisa para se adaptar: o público, a ordem dos capítulos, os
// que ficam fora desta reunião e a fala de cada um.
// ─────────────────────────────────────────────────────────────────────────────
export function montarRoteiro(estudo, {
  diagnostico = null, cliente = {}, objecoes = null, objetivos = null,
} = {}) {
  if (!estudo) return null

  const publico = publicoPorId(diagnostico?.perfil?.id)
  const nome = String(cliente.nome ?? '').trim().split(' ')[0] || 'você'
  // `objetivos` é a frase que o CLIENTE disse na reunião ("garantir a faculdade
  // da Alice"). Ela mora no planejamento, não no estudo, e é a única citação
  // literal dele em todo o roteiro — por isso vem de fora, e não é inventada
  // quando falta.
  const ctx = { e: estudo, publico, cliente, nome, objetivos: String(objetivos ?? '').trim() || null }

  const ordem = ordemPara(publico)
  const fora = capitulosFora(estudo, publico, { objecoes })
  const posicao = new Map(ordem.map((slide, i) => [slide, i + 1]))

  const falaDe = (slide) => {
    const montar = FALAS[slide]
    if (!montar) return null
    let bruta = null
    try {
      bruta = montar(ctx)
    } catch {
      // Uma fala que não consegue se montar não pode derrubar a apresentação
      // no meio da reunião. O capítulo continua, só sem a nota da consultora.
      return null
    }
    if (!bruta) return null
    const diga = (bruta.diga ?? []).filter((f) => typeof f === 'string' && f.trim() !== '')
    return {
      slide,
      momento: MOMENTO_DO_CAPITULO[slide] ?? null,
      objetivo: bruta.objetivo ?? null,
      diga,
      pergunte: bruta.pergunte ?? null,
      cuidado: bruta.cuidado ?? null,
      objecao: bruta.objecao ? (objecoes?.porId?.[bruta.objecao] ?? null) : null,
    }
  }

  const textoDe = (slide) => {
    const montar = TEXTOS[slide]
    if (!montar) return {}
    try {
      return montar(ctx) ?? {}
    } catch {
      return {}
    }
  }

  return {
    publico,
    ordem,
    // Posição de cada capítulo, para a tela reordenar sem mexer no conteúdo.
    // O que não estiver no roteiro vai para o fim, nunca para o meio.
    ordemDe: (slide) => posicao.get(slide) ?? 900,
    momentoDe: (slide) => MOMENTO_DO_CAPITULO[slide] ?? null,
    // Fora do caminho de avançar NESTA reunião — nunca apagado.
    fora,
    estaFora: (slide) => fora.has(slide),
    motivoFora: (slide) => fora.get(slide) ?? null,
    falaDe,
    textoDe,
    cartoes: cartoesDoReenquadramento(estudo, publico),
    emVida: protecaoEmVida(estudo),
    // A linha que a consultora lê de relance antes de compartilhar a tela.
    resumo: `${publico.rotulo}: ${publico.abertura}`,
  }
}
