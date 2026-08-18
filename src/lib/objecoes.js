// ─────────────────────────────────────────────────────────────────────────────
// AS OBJEÇÕES — previstas antes de acontecerem, respondidas com os números
// DESTE cliente.
//
// A transcrição já sabia DETECTAR objeção depois da reunião, e o catálogo dela
// (`OBJECOES`, em transcricao.js) traz a resposta certa em abstrato: "não
// discuta o preço, reduza o escopo". Está certo, e é tarde: chega quando a
// reunião acabou, e é genérico — a mesma frase para o médico de 48 anos com
// dois filhos e para o MEI de 26 sem dependentes.
//
// Este arquivo faz as duas coisas que faltavam.
//
// ── 1. PREVER ────────────────────────────────────────────────────────────────
// O estudo já sabe quais objeções ESTE cliente vai levantar, e nunca disse.
// Prêmio em 14% da renda? "Está caro" vai aparecer. Ele aporta em previdência?
// "Prefiro investir" vai aparecer. Tem vida em grupo da empresa? "Já tenho
// seguro" vai aparecer, e é a que mais derruba venda quando pega de surpresa.
// A probabilidade sai de condições explícitas sobre os números do estudo — não
// de um ranking fixo.
//
// ── 2. RESPONDER COM NÚMERO ──────────────────────────────────────────────────
// Objeção não se vence com retórica, se vence com aritmética que o cliente
// consegue conferir. "Sai por R$ 4,20 por dia" derruba "está caro" de um jeito
// que "mas é a segurança da sua família" nunca derrubou. Todo argumento aqui
// carrega números vindos do estudo, e some quando o número que o sustenta não
// existe — resposta com lacuna no meio é pior do que resposta nenhuma.
//
// ── E O QUE NÃO DIZER ────────────────────────────────────────────────────────
// Cada objeção traz um `naoDiga`. É a parte que nenhum material de treinamento
// escreve e que decide a conversa: a resposta errada para "vou pensar" não é
// uma resposta fraca, é uma resposta que fecha a porta. Pressionar quem pediu
// tempo transforma um "quase" em um "não" definitivo.
//
// Determinístico, sem rede, sem chave de API — e os ids batem com os da
// transcrição, para o que foi DETECTADO na gravação encontrar aqui a resposta
// já calculada para aquele cliente.
// ─────────────────────────────────────────────────────────────────────────────

import { COBERTURAS_EM_VIDA } from './estudo.js'

const m = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
const virg = (v) => String(v).replace('.', ',')

// Quanto uma objeção é provável NESTE caso. Não é opinião: cada nível tem uma
// condição que se pode apontar no estudo.
const CERTA = 100      // o estudo mostra o gatilho explícito
const PROVAVEL = 70    // o perfil favorece
const POSSIVEL = 40    // acontece com qualquer cliente
const IMPROVAVEL = 15  // o estudo já responde sozinho

// ─────────────────────────────────────────────────────────────────────────────
// Cada montador recebe o contexto e devolve a resposta pronta, ou `null` quando
// não há número que a sustente.
//
//   contexto = { e: estudo, d: diagnostico, p: estimativa de prêmio, cliente }
// ─────────────────────────────────────────────────────────────────────────────

function objPreco({ e, p }) {
  const inv = e.investimento
  const mensal = inv?.mensal ?? p?.mensal ?? 0
  if (!(mensal > 0)) return null

  const diario = inv?.diario ?? Math.round((mensal * 12 / 365) * 100) / 100
  const pctRenda = inv?.pctRenda ?? p?.pctRenda ?? null
  const protegido = e.capitalMaximoEvento > 0 ? e.capitalMaximoEvento : e.valores.morte

  const argumentos = [
    `São ${m(mensal)} por mês — ${m(diario)} por dia — para colocar até ${m(protegido)} na mão da família no pior cenário.`,
  ]
  if (inv?.alavancagem > 0) {
    argumentos.push(`Cada R$ 1 de prêmio carrega ${inv.alavancagem.toLocaleString('pt-BR')} reais de proteção. Não existe outro produto financeiro com essa relação.`)
  }
  if (pctRenda != null && pctRenda <= 10) {
    argumentos.push(`É ${virg(pctRenda)}% da renda dele, dentro da faixa de 5% a 10% que o mercado considera saudável — ou seja, não é caro: é o preço.`)
  }
  if (e.previdenciaAporte > 0) {
    argumentos.push(`Ele já destina ${m(e.previdenciaAporte)}/mês à previdência. O plano custa ${Math.round((mensal / e.previdenciaAporte) * 100)}% disso, e é o único aporte que vale o valor cheio já no mês que vem.`)
  }

  return {
    argumentos,
    naoDiga: 'Não dê desconto e não defenda o preço. Preço defendido vira negociação, e '
      + 'negociação de prêmio você perde — a seguradora é que define a tabela. O que se '
      + 'ajusta é o ESCOPO: mostre o plano essencial e o que ele deixa descoberto.',
    pergunta: pctRenda != null && pctRenda > 10
      ? 'Qual valor por mês caberia com folga no seu orçamento? Eu monto o melhor plano possível dentro dele.'
      : 'Se o valor fosse metade disso, você faria hoje? (Se sim, o problema não é o preço — é a prioridade.)',
  }
}

function objInvestir({ e }) {
  const a = e.acumularEmVezDeSegurar
  if (!a || a.anos == null) return null
  const argumentos = [
    `Guardando os mesmos ${m(a.aporteMensal)}/mês a ${virg(Math.round(a.taxaReal * 1000) / 10)}% ao ano reais, ele leva ${virg(a.anos)} anos para juntar os ${m(a.alvo)} que o seguro entrega no primeiro mês.`,
    'Não é seguro CONTRA investimento: é o seguro que protege o plano de investimento de ser consumido no meio do caminho.',
  ]
  if (e.valores.doencas_graves > 0) {
    argumentos.push(`E na doença grave o investimento é sacado com prejuízo, no pior momento possível. O seguro paga ${m(e.valores.doencas_graves)} sem tocar em nada do que ele construiu.`)
  }
  if (e.custoInventario > 0) {
    argumentos.push(`Tem outra: a carteira de investimentos dele passa por inventário. O capital do seguro não (CC art. 794) — chega em dias, enquanto o resto fica travado.`)
  }
  return {
    argumentos,
    naoDiga: 'Não diga que investir é ruim, nem tente vencer no rendimento. Ele tem razão '
      + 'sobre o longo prazo, e um assessor de investimentos desmonta o argumento em trinta '
      + 'segundos. O terreno é o PRAZO e o que acontece se ele não for cumprido até o fim.',
    pergunta: 'Concordo que você deve continuar investindo. Minha pergunta é outra: e se acontecer antes de a conta chegar lá?',
  }
}

function objJaTenho({ e }) {
  if (!(e.coberturaAtual > 0) && !(e.carteira?.total > 0)) return null
  const k = e.carteira
  const argumentos = []

  if (k?.condicionada > 0) {
    argumentos.push(`${m(k.condicionada)} do que ele tem é vida em grupo da empresa: acaba no dia em que o vínculo acabar — e o vínculo raramente acaba num bom momento.`)
    argumentos.push(`Sem ela, o que falta de proteção salta de ${m(e.gap)} para ${m(e.gapPortavel)}. E a recontratação sai pelo preço da idade que ele tiver na hora${e.idade != null ? `, não pelos ${e.idade} de hoje` : ''}.`)
  }
  if (k?.quitaDivida > 0) {
    argumentos.push(`${m(k.quitaDivida)} são prestamista do financiamento: o beneficiário é o banco. Quita a dívida e não entrega um real para a família.`)
  }
  if (k?.portavel > 0) {
    argumentos.push(`Só ${m(k.portavel)} são realmente dele e acompanham a vida dele. O estudo já desconta esse valor — o que está na proposta é o que FALTA, não o total.`)
  }
  if (argumentos.length === 0) {
    argumentos.push(`Ele declara ${m(e.coberturaAtual)} de cobertura. Vale abrir a apólice na reunião: se for da empresa, acaba com o emprego; se for do banco, paga o banco.`)
    argumentos.push('O estudo abate o que ele já tem — a proposta mostra a diferença, não uma segunda apólice em cima da primeira.')
  }

  return {
    argumentos,
    naoDiga: 'Não diga que o seguro dele "não vale nada" nem critique quem vendeu. Ele '
      + 'escolheu aquilo e vai defender a própria escolha. Peça para ver a apólice: o '
      + 'documento faz o argumento sozinho, e você fica do lado dele lendo, não do lado oposto.',
    pergunta: 'Você tem a apólice aí? Vamos olhar juntos quem é o beneficiário e até quando ela vale.',
  }
}

function objPensar({ e, cliente }) {
  const argumentos = [
    '"Vou pensar" quase nunca é sobre pensar: é uma dúvida específica que não foi dita. Descubra qual antes de qualquer coisa.',
  ]
  if (e.custoDaEspera?.cenarios?.length > 0) {
    const c = e.custoDaEspera.cenarios[0]
    argumentos.push(`Pensar é legítimo. Só que a mesma apólice daqui a ${c.daquiAAnos} ano(s) sai por cerca de ${m(c.mensal)}/mês (${virg(c.aMaisPct)}% a mais) — e isso supondo a mesma saúde de hoje, que é a premissa mais frágil de todas.`)
  }
  if (String(cliente?.quem_decide ?? '').trim() !== '') {
    argumentos.push(`Ele já disse que quem decide é: ${cliente.quem_decide}. Ofereça a conversa com quem falta em vez de esperar que ele reapresente o estudo de memória.`)
  }
  return {
    argumentos,
    naoDiga: 'Não pressione e não crie urgência falsa ("essa condição é só hoje"). Quem pediu '
      + 'tempo e foi empurrado não compra depois — vira um "não" definitivo, e você perde '
      + 'também a indicação que viria dele.',
    pergunta: 'Claro. Só me ajuda a entender: o que exatamente você quer pensar melhor — o valor, as coberturas ou a seguradora?',
  }
}

function objConjuge({ e, cliente }) {
  const argumentos = [
    'É o melhor sinal da reunião: ninguém consulta o cônjuge sobre algo que já decidiu recusar.',
    'O risco não é o "não" dele — é a proposta chegar recontada de memória. Explicada por quem ouviu o estudo, ela chega inteira; resumida no jantar, chega como um preço solto.',
  ]
  if (e.temConjuge) {
    argumentos.push('E a conversa interessa aos dois de verdade: é o padrão de vida da casa que está sendo protegido, não uma despesa dele.')
  }
  if (String(cliente?.prazo_decisao ?? '').trim() !== '') {
    argumentos.push(`Ele sinalizou o prazo: ${cliente.prazo_decisao}. Marque o retorno DENTRO desse prazo, não depois dele.`)
  }
  return {
    argumentos,
    naoDiga: 'Não mande só o PDF e espere. Proposta enviada sem data de retorno marcada é '
      + 'proposta esfriando — e a segunda pessoa, que não esteve na reunião, não tem como '
      + 'defender o que não ouviu.',
    pergunta: 'Perfeito. Que tal uma call de 15 minutos com vocês dois? Eu mostro o estudo e respondo o que ela quiser perguntar — assim você não precisa virar o especialista.',
  }
}

function objSemUrgencia({ e }) {
  const argumentos = []
  if (e.custoDaEspera?.cenarios?.length > 0) {
    const ultimo = e.custoDaEspera.cenarios[e.custoDaEspera.cenarios.length - 1]
    argumentos.push(`A mesma apólice daqui a ${ultimo.daquiAAnos} anos: cerca de ${m(ultimo.mensal)}/mês, ${virg(ultimo.aMaisPct)}% a mais — para sempre, enquanto a apólice existir.`)
  }
  argumentos.push('Ser jovem e saudável não é motivo para adiar: é exatamente o que ele está vendendo para a seguradora agora, e é o único ativo dele que só piora com o tempo.')
  if (e.valores.invalidez > 0) {
    argumentos.push(`E o risco maior nessa idade não é morrer: é uma invalidez. Antes dos 65 ela é bem mais provável que a morte, e o estudo cobre ${m(e.valores.invalidez)} justamente por isso.`)
  }
  return argumentos.length === 0 ? null : {
    argumentos,
    naoDiga: 'Não use medo nem estatística de tragédia. Com cliente jovem isso soa a venda '
      + 'forçada e queima a relação. O argumento é econômico: preço e aprovação, não morte.',
    pergunta: 'Você aceita fazer um teste? Guardo essa cotação e a gente compara com a que você conseguir daqui a três anos. O que muda no meio do caminho é a sua saúde, não a minha tabela.',
  }
}

function objDesconfianca({ e }) {
  const argumentos = [
    'Seguradora no Brasil é regulada pela SUSEP, e o prazo de pagamento do sinistro está no contrato — 30 dias após a entrega dos documentos, por regra.',
    'O que de fato faz uma seguradora negar é DPS mal preenchida. Por isso a declaração de saúde é preenchida com calma, junto, e nada é omitido: omissão é o único caminho real para a recusa.',
  ]
  if (e.valores.morte > 0) {
    argumentos.push(`É exatamente por isso que preenchemos tudo com você na tela: ${m(e.valores.morte)} é um capital que a seguradora vai analisar de perto, e a hora de resolver qualquer pendência é agora, não no sinistro.`)
  }
  return {
    argumentos,
    naoDiga: 'Não se ofenda e não defenda o setor em abstrato. Ele provavelmente ouviu um caso '
      + 'real de alguém. Pergunte qual foi — em quase todos, o problema foi omissão na DPS, e '
      + 'aí o argumento se conta sozinho.',
    pergunta: 'Aconteceu com alguém que você conhece? Me conta o caso — quase sempre dá para mostrar onde travou, e o que a gente faz diferente aqui.',
  }
}

function objAdiar() {
  return {
    argumentos: [
      'Mandar é ótimo — pelo link da proposta, que abre no celular e mostra o estudo inteiro, não um PDF morto.',
      'Mas proposta sem data de retorno marcada não é follow-up: é esperança. O momento em que ele mais entende o estudo é agora, e esse entendimento decai todo dia.',
    ],
    naoDiga: 'Não aceite "eu te aviso". Quem vai avisar não avisa — e você fica no papel de '
      + 'quem cobra, que é o pior lugar para retomar a conversa.',
    pergunta: 'Combinado, mando agora. Só para eu não ficar te perseguindo: prefere que eu te ligue na quinta de manhã ou na sexta à tarde?',
  }
}

function objPatrimonio({ e }) {
  if (!(e.custoInventario > 0)) return null
  const meses = e.sucessao?.prazoInventarioMeses ?? 6
  const argumentos = [
    `Ele tem razão em ter patrimônio — o problema é que ${m(e.bensInventariaveis)} ficam TRAVADOS por cerca de ${meses} meses no inventário.`,
    `E para destravar, a família precisa entregar ${m(e.custoInventario)} em dinheiro antes: o imposto vence antes de qualquer bem ser liberado.`,
  ]
  if (e.deficitLiquidez > 0) {
    argumentos.push(`Hoje faltam ${m(e.deficitLiquidez)} em dinheiro disponível para isso. Sem esse capital, a saída é vender às pressas — e quem vende com prazo apertado vende com deságio.`)
  }
  argumentos.push('O capital do seguro é a única parte do patrimônio dele que não entra em inventário (CC art. 794): chega em dias, direto ao beneficiário.')
  return {
    argumentos,
    naoDiga: 'Não sugira que o patrimônio dele é pequeno ou mal construído. O argumento não é '
      + 'o tamanho: é a LIQUIDEZ. Ele construiu bem e construiu ilíquido — são coisas diferentes.',
    pergunta: `Seus ${m(e.bensInventariaveis)} ficam travados por ${meses} meses. Para destravar, sua família precisa pôr ${m(e.custoInventario)} em dinheiro na mesa. De onde sai?`,
  }
}

function objNaoRecebo({ e }) {
  const argumentos = [
    'Ele está certo sobre o seguro de vida tradicional, e negar isso destrói a credibilidade. O ponto é outro: seguro não é aplicação, é transferência de risco — como o seguro do carro, que ninguém quer usar.',
  ]
  const emVida = COBERTURAS_EM_VIDA.filter((id) => e.valores[id] > 0)
  if (emVida.length > 0) {
    argumentos.push(`E este plano não é só para depois: ${emVida.length} das coberturas pagam com ele VIVO — invalidez, doenças graves e diárias respondem pela maior parte dos sinistros da categoria.`)
    if (e.valores.doencas_graves > 0) {
      argumentos.push(`No diagnóstico de uma doença grave, ${m(e.valores.doencas_graves)} caem na conta dele, para ele usar como quiser.`)
    }
  }
  if (e.acumularEmVezDeSegurar?.anos != null) {
    argumentos.push(`Se o objetivo é ter o dinheiro de volta, existe o resgatável — e a comparação ano a ano está no estudo, com os dois lados.`)
  }
  return {
    argumentos,
    naoDiga: 'Não invente rentabilidade nem chame o seguro de investimento. Se ele descobrir '
      + 'depois que "investimento" era prêmio de risco, você perde o cliente e a indicação.',
    pergunta: 'Você faz seguro do carro esperando bater? A lógica aqui é a mesma — com a diferença de que boa parte deste plano paga com você aqui.',
  }
}

// "Eu já tenho plano de saúde" — a objeção que aparece exatamente no capítulo
// da proteção em vida, e a única que se responde mostrando o que o plano de
// saúde NÃO paga. Ele cobre o procedimento; não cobre o que a vida cobra em
// volta dele.
function objPlanoDeSaude({ e }) {
  const emVida = COBERTURAS_EM_VIDA.filter((id) => e.valores[id] > 0)
  if (emVida.length === 0) return null

  const argumentos = [
    'Ele está certo, e o plano de saúde é indispensável — só que ele paga HOSPITAL, não paga VIDA. '
    + 'Nenhum plano de saúde repõe um real de renda, e é a renda que para.',
  ]
  if (e.valores.cirurgias > 0) {
    argumentos.push(`Cirurgias: ${m(e.valores.cirurgias)} por procedimento, em dinheiro na conta dele. `
      + 'É o que cobre coparticipação, material fora do rol, o honorário do cirurgião que ele escolher '
      + 'e o tempo de recuperação — tudo que o plano de saúde manda para o boleto do associado.')
  }
  if (e.valores.dih > 0) {
    const d = e.diariaPorId?.dih
    argumentos.push(`Internado, o plano de saúde paga o leito e a casa continua cobrando: ${m(e.valores.dih)} `
      + `por dia${d?.dias ? `, até ${d.dias} diárias` : ''} entram para isso.`)
  }
  if (e.valores.doencas_graves > 0) {
    argumentos.push(`E no diagnóstico de uma doença grave o plano de saúde autoriza o tratamento; `
      + `${m(e.valores.doencas_graves)} caem na conta dele para o resto — que é a maior parte do custo real.`)
  }
  return {
    argumentos,
    naoDiga: 'Não diga que o plano de saúde dele é ruim nem sugira trocar um pelo outro. São produtos '
      + 'diferentes e ele sabe disso; a frase que funciona é "um paga o hospital, o outro paga a sua vida '
      + 'enquanto você se recupera".',
    pergunta: 'Se você precisasse operar amanhã e ficar seis semanas sem trabalhar, o plano de saúde '
      + 'resolveria a cirurgia. Quem resolveria as seis semanas?',
  }
}

function objNaoPoderPagar({ e, p }) {
  const mensal = e.investimento?.mensal ?? p?.mensal ?? 0
  if (!(mensal > 0)) return null
  return {
    argumentos: [
      'Medo legítimo, e é bom que ele diga isso agora: apólice cancelada em seis meses é ruim para os dois.',
      'Por isso o plano é dimensionado sobre a sobra real dele, e não sobre o capital ideal. Se apertar, o caminho não é cancelar: é reduzir capital e manter a apólice viva com a idade de hoje.',
      `Se ele contratar agora aos ${e.idade ?? '—'} anos e reduzir daqui a cinco, mantém o preço da idade de entrada. Se cancelar e recontratar, paga a idade nova — e passa por análise de saúde de novo.`,
    ],
    naoDiga: 'Não minimize ("é pouquinho, você nem vai sentir"). Ele acabou de dizer que vai '
      + 'sentir. Minimizar é dizer que você não escutou.',
    pergunta: 'Vamos fazer o contrário do normal: me diz o valor que você tem certeza que consegue manter por dez anos, mesmo num ano ruim. Eu monto o melhor plano dentro dele.',
  }
}

// ─── O CATÁLOGO ──────────────────────────────────────────────────────────────
// Os `id` batem com os de `OBJECOES` em transcricao.js sempre que existe o par:
// é assim que uma objeção DETECTADA na gravação encontra aqui a resposta já
// calculada para aquele cliente.
const CATALOGO = [
  {
    id: 'preco', rotulo: 'Está caro',
    comoSoa: '"Achei salgado", "está fora do meu orçamento", "é muito por mês"',
    montar: objPreco,
    probabilidade: ({ e, p }) => {
      const pct = e.investimento?.pctRenda ?? p?.pctRenda
      if (pct != null && pct > 10) return CERTA
      if (e.poupancaMensal != null && e.poupancaMensal > 0
        && (e.investimento?.mensal ?? p?.mensal ?? 0) > e.poupancaMensal * 0.5) return PROVAVEL
      if (pct != null && pct <= 5) return IMPROVAVEL
      return POSSIVEL
    },
  },
  {
    id: 'investir', rotulo: 'Prefiro investir esse dinheiro',
    comoSoa: '"No CDI rende mais", "prefiro deixar aplicado", "dinheiro parado"',
    montar: objInvestir,
    probabilidade: ({ e }) => {
      if (e.previdenciaAporte > 0 || e.investimentos > 0) return CERTA
      if (e.focos.includes('aposentadoria')) return PROVAVEL
      return POSSIVEL
    },
  },
  {
    id: 'ja_tem', rotulo: 'Já tenho seguro pela empresa',
    comoSoa: '"Tenho pela empresa", "o banco já me deu um", "já sou segurado"',
    montar: objJaTenho,
    probabilidade: ({ e }) => {
      if (e.carteira?.condicionada > 0 || e.carteira?.quitaDivida > 0) return CERTA
      if (e.coberturaAtual > 0) return PROVAVEL
      return IMPROVAVEL
    },
  },
  {
    id: 'pensar', rotulo: 'Vou pensar',
    comoSoa: '"Deixa eu analisar", "me dá um tempo", "depois eu vejo"',
    montar: objPensar,
    probabilidade: () => POSSIVEL,
  },
  {
    id: 'conjuge', rotulo: 'Preciso falar com minha esposa / meus sócios',
    comoSoa: '"Vou conversar em casa", "decido junto com meu sócio"',
    montar: objConjuge,
    probabilidade: ({ e, cliente }) => {
      if (String(cliente?.quem_decide ?? '').trim() !== '') return CERTA
      if (e.temConjuge || (e.temPJ && e.pj.numSocios >= 2)) return PROVAVEL
      return IMPROVAVEL
    },
  },
  {
    id: 'sem_urgencia', rotulo: 'Sou jovem e saudável, não é prioridade agora',
    comoSoa: '"Ano que vem eu vejo", "não tenho pressa", "sou saudável"',
    montar: objSemUrgencia,
    probabilidade: ({ e }) => {
      if (e.idade != null && e.idade < 35 && !e.temDependentes) return CERTA
      if (e.idade != null && e.idade < 40) return PROVAVEL
      return POSSIVEL
    },
  },
  {
    id: 'patrimonio', rotulo: 'Já tenho patrimônio, minha família está protegida',
    comoSoa: '"Tenho imóveis", "deixo o suficiente", "eles não vão passar necessidade"',
    montar: objPatrimonio,
    probabilidade: ({ e }) => {
      if (e.bensInventariaveis > 1_000_000 && e.deficitLiquidez > 0) return CERTA
      if (e.patrimonioBruto > 500_000) return PROVAVEL
      return IMPROVAVEL
    },
  },
  {
    id: 'nao_recebo', rotulo: 'Seguro é dinheiro jogado fora, não recebo nada de volta',
    comoSoa: '"É dinheiro perdido", "se eu não morrer não ganho nada", "prefiro guardar"',
    montar: objNaoRecebo,
    probabilidade: ({ e }) => {
      const emVida = ['invalidez', 'doencas_graves', 'dit', 'dih'].some((id) => e.valores[id] > 0)
      return emVida ? POSSIVEL : PROVAVEL
    },
  },
  {
    id: 'plano_saude', rotulo: 'Já tenho plano de saúde',
    comoSoa: '"Meu plano cobre tudo", "tenho o melhor convênio", "para isso eu tenho saúde"',
    montar: objPlanoDeSaude,
    // Quanto mais o estudo aposta nas coberturas em vida, mais certo é que a
    // objeção apareça — ela nasce justamente do capítulo que as apresenta.
    probabilidade: ({ e }) => {
      const emVida = COBERTURAS_EM_VIDA.filter((id) => e.valores[id] > 0).length
      if (emVida >= 3) return PROVAVEL
      return emVida > 0 ? POSSIVEL : IMPROVAVEL
    },
  },
  {
    id: 'desconfianca', rotulo: 'Seguradora não paga',
    comoSoa: '"Sempre tem letra miúda", "conheço um caso que não pagaram", "não confio"',
    montar: objDesconfianca,
    probabilidade: () => POSSIVEL,
  },
  {
    id: 'nao_poder_pagar', rotulo: 'E se eu não puder mais pagar?',
    comoSoa: '"E se eu perder o emprego?", "e se apertar?", "é um compromisso longo"',
    montar: objNaoPoderPagar,
    probabilidade: ({ e }) => {
      if (e.poupancaMensal != null && e.poupancaMensal > 0
        && (e.investimento?.mensal ?? 0) > e.poupancaMensal * 0.6) return PROVAVEL
      if (e.classeAutonomo) return PROVAVEL
      return POSSIVEL
    },
  },
  {
    id: 'adiar', rotulo: 'Manda por e-mail que eu vejo depois',
    comoSoa: '"Me envia que eu olho", "depois eu te retorno", "eu te aviso"',
    montar: objAdiar,
    probabilidade: () => POSSIVEL,
  },
]

const NIVEL = [
  { min: CERTA, id: 'certa', rotulo: 'Vai aparecer' },
  { min: PROVAVEL, id: 'provavel', rotulo: 'Provável' },
  { min: POSSIVEL, id: 'possivel', rotulo: 'Possível' },
  { min: 0, id: 'improvavel', rotulo: 'Pouco provável' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Devolve as objeções ordenadas pela probabilidade NESTE caso, cada uma com a
// resposta montada com os números do estudo. Objeção cuja resposta não pôde ser
// montada por falta de dado é omitida — meia resposta na reunião é pior do que
// nenhuma, porque ela é dita com a mesma confiança da inteira.
// ─────────────────────────────────────────────────────────────────────────────
export function responderObjecoes(estudo, { diagnostico = null, premio = null, cliente = {} } = {}) {
  if (!estudo) return null
  const ctx = { e: estudo, d: diagnostico, p: premio, cliente }

  const lista = CATALOGO.map((o) => {
    let corpo = null
    try {
      corpo = o.montar(ctx)
    } catch {
      corpo = null
    }
    if (!corpo || !corpo.argumentos?.length) return null
    const pontos = o.probabilidade(ctx)
    const nivel = NIVEL.find((n) => pontos >= n.min) ?? NIVEL[NIVEL.length - 1]
    return {
      id: o.id,
      rotulo: o.rotulo,
      comoSoa: o.comoSoa,
      pontos,
      nivel: nivel.id,
      nivelRotulo: nivel.rotulo,
      argumentos: corpo.argumentos,
      naoDiga: corpo.naoDiga,
      pergunta: corpo.pergunta,
    }
  }).filter(Boolean)

  lista.sort((a, b) => b.pontos - a.pontos || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))

  return {
    lista,
    // As que o estudo garante que vêm. É por onde a consultora se prepara
    // quando tem cinco minutos antes da reunião, e não meia hora.
    esperadas: lista.filter((o) => o.pontos >= PROVAVEL),
    porId: Object.fromEntries(lista.map((o) => [o.id, o])),
  }
}

// Ponte com a transcrição: dada a análise da gravação, devolve a resposta
// personalizada de cada objeção que o cliente REALMENTE levantou. Fecha o ciclo
// — o que foi detectado depois da reunião vira munição para o follow-up, agora
// com os números daquele cliente em vez do conselho genérico.
export function responderObjecoesDetectadas(analise, respostas) {
  if (!analise?.objecoes?.length || !respostas) return []
  return analise.objecoes
    .map((o) => ({ detectada: o, resposta: respostas.porId[o.id] ?? null }))
    .filter((x) => x.resposta)
}
