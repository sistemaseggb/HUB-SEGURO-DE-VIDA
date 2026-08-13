// ─────────────────────────────────────────────────────────────────────────────
// O DIAGNÓSTICO — a leitura do estudo, não o cálculo dele.
//
// `calcularEstudo()` responde "quanto". Este arquivo responde as três
// perguntas que vêm depois, e que até aqui só existiam na cabeça da consultora:
//
//     1. QUEM é este cliente?          (perfil → o que priorizar)
//     2. O QUE FAZER com este estudo?  (recomendações ordenadas)
//     3. O QUE AINDA FALTA PERGUNTAR?  (pendências, antes de apresentar)
//
// A regra que governa o arquivo inteiro: PALPITE SEM CONTA ATRÁS É CHUTE.
// Toda recomendação carrega o `porque` com os números DESTE cliente, porque é
// exatamente isso que a consultora vai repetir quando o cliente perguntar "de
// onde você tirou esse valor?". Uma recomendação que não sabe se justificar
// não é gerada — silêncio é melhor do que confiança inventada.
//
// A ordenação também é metódica, e não estética. Cada recomendação tem um
// PESO composto por:
//     · gravidade   — erro que quebra a apresentação vem antes de refinamento;
//     · probabilidade — risco provável vem antes de risco raro (a invalidez
//                       acontece muito mais que a morte, e o estudo precisa
//                       refletir isso);
//     · dinheiro em jogo — em % da exposição do cliente, não em valor absoluto,
//                       senão todo cliente rico teria as mesmas prioridades;
//     · alinhamento com o foco que ELE declarou na reunião.
//
// Nada aqui usa rede, chave de API ou modelo de linguagem: é determinístico,
// roda em milissegundos e dá a mesma resposta para o mesmo estudo — que é o
// mínimo que se pede de um sistema que a consultora vai citar na frente do
// cliente.
// ─────────────────────────────────────────────────────────────────────────────

import { IDADE_INDEPENDENCIA, LIMITES_MERCADO, COBERTURAS, focoRotulo } from './estudo.js'

const m = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
const pct = (v) => `${String(Math.round(v * 10) / 10).replace('.', ',')}%`
const rotulo = (id) => COBERTURAS.find((c) => c.id === id)?.curto ?? id

// ─── PERFIS ──────────────────────────────────────────────────────────────────
// Não é segmentação de marketing: é o que muda a ORDEM das coberturas. Um
// empresário com aval no banco e um casal com filho pequeno têm exposições
// diferentes, e o estudo que trata os dois igual está errado para os dois.
export const PERFIS = [
  {
    id: 'provedor',
    rotulo: 'Provedor de família',
    tese: 'Alguém perde o padrão de vida no dia em que essa renda parar. '
      + 'Tudo se organiza em torno de manter a casa de pé.',
    prioridade: ['morte', 'invalidez', 'doencas_graves', 'dit', 'sucessao'],
  },
  {
    id: 'empresario',
    rotulo: 'Sócio / empresário',
    tese: 'A exposição maior não está na família: está no que a empresa deve, '
      + 'no que ela avalizou e em quem a faz girar.',
    prioridade: ['aval', 'socios', 'homem_chave', 'invalidez', 'morte', 'sucessao'],
  },
  {
    id: 'patrimonial',
    rotulo: 'Patrimônio consolidado',
    tese: 'A renda já não é o problema. O problema é o patrimônio travar no '
      + 'inventário e a família ter que vender bem para pagar imposto.',
    prioridade: ['sucessao', 'doencas_graves', 'invalidez', 'morte'],
  },
  {
    id: 'individual',
    rotulo: 'Sem dependentes',
    tese: 'Ninguém depende dessa renda, então morrer não deixa conta para '
      + 'ninguém. O risco real é continuar vivo sem poder trabalhar.',
    prioridade: ['invalidez', 'doencas_graves', 'dit', 'sucessao', 'morte'],
  },
  {
    id: 'acumulacao',
    rotulo: 'Acúmulo e aposentadoria',
    tese: 'O objetivo é chegar lá. O seguro entra como o que garante que o '
      + 'plano de acúmulo não morre junto com a renda que o alimenta.',
    prioridade: ['invalidez', 'dit', 'doencas_graves', 'morte', 'sucessao'],
  },
]

// A classificação é uma disputa de pontos, não uma escada de `if`: um sócio
// com filho pequeno pontua nos dois lados, e quem ganha é a exposição maior.
function classificarPerfil(e) {
  const p = {
    provedor: 0, empresario: 0, patrimonial: 0, individual: 0, acumulacao: 0,
  }

  if (e.filhosDependentes.length > 0) p.provedor += 3
  if (e.temConjuge) p.provedor += 1
  if (!e.temDependentes) p.individual += 4

  // Empresa: o que pesa é a dívida avalizada e a quota, não o faturamento.
  if (e.temPJ) p.empresario += 1
  if (e.pj.dividaAval > 0) p.empresario += 3
  if (e.pj.quota > 0 && e.pj.numSocios >= 2) p.empresario += 2
  if (e.pj.faturamento > 0 || e.pj.valuation > 0) p.empresario += 1

  // Patrimonial: o custo do inventário grande em relação à renda anual é o
  // sinal de que a conversa mudou de reposição de renda para liquidez.
  const rendaAnual = e.renda * 12
  if (e.custoInventario > 0 && rendaAnual > 0 && e.custoInventario > rendaAnual) p.patrimonial += 3
  if (e.bensInventariaveis > 3_000_000) p.patrimonial += 2
  if (e.idade != null && e.idade >= 58) p.patrimonial += 1
  if (e.filhosDependentes.length === 0 && e.bensInventariaveis > 1_000_000) p.patrimonial += 1

  if (e.aposentadoria) p.acumulacao += 2
  if (e.previdenciaAporte > 0) p.acumulacao += 2

  // O foco que ELE declarou na reunião vale muito: é a única entrada que veio
  // da boca do cliente e não de uma inferência do sistema.
  const porFoco = {
    renda: 'provedor', educacao: 'provedor', dividas: 'provedor',
    sucessao: 'patrimonial', blindagem: 'patrimonial',
    empresarial: 'empresario', aposentadoria: 'acumulacao',
  }
  for (const f of e.focos) if (porFoco[f]) p[porFoco[f]] += 3

  const vencedor = Object.entries(p).sort((a, b) => b[1] - a[1])[0]
  if (!vencedor || vencedor[1] === 0) return null
  const perfil = PERFIS.find((x) => x.id === vencedor[0])
  return perfil ? { ...perfil, pontos: p } : null
}

// ─── PESO DE UMA RECOMENDAÇÃO ────────────────────────────────────────────────
// gravidade × probabilidade × dinheiro em jogo. Explícito de propósito: quem
// discordar da ordem discorda de um número que dá para apontar.
const GRAVIDADE = { bloqueia: 100, corrige: 60, reforca: 35, refina: 15 }

function peso(r, e) {
  let x = GRAVIDADE[r.tipo] ?? 10
  // Dinheiro em jogo, sempre relativo à exposição do cliente: R$ 200 mil
  // descobertos valem muito para quem ganha 8 mil e pouco para quem ganha 200.
  if (r.emJogo > 0) {
    const referencia = Math.max(e.capitalTotal, e.renda * 12, e.bensInventariaveis, 1)
    x += Math.min((r.emJogo / referencia) * 60, 60)
  }
  // O foco declarado pelo cliente sobe a recomendação que fala dele.
  if (r.foco && e.focos.includes(r.foco)) x += 25
  return Math.round(x)
}

// ─────────────────────────────────────────────────────────────────────────────
// O DIAGNÓSTICO
// ─────────────────────────────────────────────────────────────────────────────
export function diagnosticar(e, { cliente = {} } = {}) {
  if (!e) return null

  const perfil = classificarPerfil(e)
  const rec = []
  const add = (r) => { if (r && r.porque && r.porque.length >= 20) rec.push(r) }

  // ── 1. O QUE ESTÁ DESCOBERTO ──────────────────────────────────────────────

  // Invalidez zerada é o buraco mais comum e o mais caro. A probabilidade de
  // uma invalidez que tira a capacidade de trabalhar antes dos 65 é várias
  // vezes maior que a de morrer no mesmo período — e o estudo que só cobre
  // morte cobra prêmio pelo risco menor.
  if (e.valores.morte > 0 && e.valores.invalidez === 0 && e.tem014) {
    add({
      id: 'sem-invalidez', tipo: 'corrige', campo: 'capital_invalidez',
      valor: Math.round(e.sugestoes.invalidez),
      titulo: 'Incluir invalidez — hoje o plano não cobre o cenário mais provável',
      porque: `O estudo protege ${m(e.valores.morte)} na morte e nada na invalidez. `
        + 'Antes dos 65 anos, ficar permanentemente incapaz de trabalhar é bem mais '
        + 'provável do que morrer — e é pior financeiramente: a renda para do mesmo '
        + 'jeito, e ele continua aqui, custando tratamento.',
      emJogo: e.sugestoes.invalidez,
      dizerAssim: 'Se amanhã você não puder mais trabalhar, quem paga as contas — '
        + 'e quem paga o seu tratamento?',
    })
  }

  // Doenças graves: o dinheiro em vida no diagnóstico.
  if (e.renda > 0 && e.valores.doencas_graves === 0 && e.tem014) {
    add({
      id: 'sem-doencas-graves', tipo: 'reforca', campo: 'capital_doencas_graves',
      valor: Math.round(e.sugestoes.doencas_graves),
      titulo: 'Incluir doenças graves — é o que paga com ele vivo',
      porque: `${m(e.sugestoes.doencas_graves)} equivalem a cerca de dois anos da renda `
        + `de ${m(e.renda)}: é o tempo de tratar um câncer ou se recuperar de um infarto `
        + 'sem depender de trabalhar e sem consumir o patrimônio da família.',
      emJogo: e.sugestoes.doencas_graves,
      dizerAssim: 'Essa cobertura paga no diagnóstico, com você aqui. É o dinheiro '
        + 'que compra o melhor tratamento sem você precisar vender nada.',
    })
  }

  // DIT: para autônomo é o risco mais frequente de todos.
  const ehAutonomo = /aut[oô]nom|liberal|mei|m[ée]dic|advogad|dentista|arquitet|corretor|consultor|empres[áa]ri|s[óo]ci/i
    .test(String(cliente.profissao ?? ''))
  if (e.renda > 0 && e.valores.dit === 0 && e.tem014 && (ehAutonomo || !e.temConjuge)) {
    add({
      id: 'sem-dit', tipo: 'reforca', campo: 'dit_diaria',
      valor: Math.round(e.sugestoes.dit),
      titulo: ehAutonomo
        ? 'Incluir DIT — sem CLT, dia parado é dia sem receber'
        : 'Considerar DIT — o afastamento temporário não tem rede de proteção',
      porque: `${m(e.sugestoes.dit)} por dia parado. Quem não é CLT não tem os 15 dias `
        + 'do empregador nem auxílio-doença que reponha a renda de verdade: uma cirurgia '
        + 'com 60 dias de recuperação vira 60 dias sem faturar, com as contas correndo igual.',
      emJogo: e.sugestoes.dit * 90,
      dizerAssim: 'Quantos dias você consegue ficar sem trabalhar antes de a conta apertar?',
    })
  }

  // Verba sucessória: o déficit de liquidez com nome e sobrenome.
  if (e.deficitLiquidez > 0 && e.valores.sucessao === 0) {
    const meses = e.sucessao.prazoInventarioMeses
    add({
      id: 'sem-sucessao', tipo: 'corrige', campo: 'verba_sucessoria',
      valor: Math.round(e.custoInventario), foco: 'sucessao',
      titulo: 'Incluir verba sucessória — faltam ' + m(e.deficitLiquidez) + ' em dinheiro',
      porque: `O inventário custa ${m(e.custoInventario)} (${pct(e.itcmd + e.sucessao.custasEfetivas)} `
        + `de ${m(e.sucessao.baseInventario)}, mais ${m(e.sucessao.custoSustentacao)} de IPTU, `
        + `condomínio e manutenção nos ${meses} meses de processo) e a família tem `
        + `${m(e.liquidezSucessoria)} disponíveis em dias. O imposto vence ANTES de qualquer `
        + `bem ser liberado — sem esse capital, a saída é vender às pressas, com deságio.`,
      emJogo: e.deficitLiquidez,
      dizerAssim: `Seus ${m(e.bensInventariaveis)} ficam travados por ${meses} meses. `
        + `Para destravar, sua família precisa entregar ${m(e.custoInventario)} em dinheiro. `
        + 'De onde sai?',
    })
  }

  // Aval descoberto na invalidez.
  if (e.valores.aval > 0 && e.cenarios.invalidez < e.valores.aval) {
    add({
      id: 'aval-invalidez', tipo: 'corrige', campo: 'capital_invalidez',
      valor: Math.round(Math.max(e.valores.invalidez, e.valores.aval)), foco: 'empresarial',
      titulo: 'Cobrir o aval também na invalidez',
      porque: `${m(e.valores.aval)} de dívida avalizada estão cobertos na morte e `
        + `${m(e.cenarios.invalidez)} na invalidez. O banco executa o aval nos dois casos — `
        + 'ele não espera o óbito, e na invalidez o cliente ainda está aqui para responder '
        + 'com o patrimônio pessoal.',
      emJogo: e.valores.aval - e.cenarios.invalidez,
      dizerAssim: 'O aval que você deu não morre com você — e também não some se você ficar inválido.',
    })
  }

  // Horizonte curto demais para os filhos.
  if (e.janelaProtecao?.curto && e.anosSugeridosPorFilhos != null
    && e.anos < e.anosSugeridosPorFilhos) {
    const faltam = e.anosSugeridosPorFilhos - e.anos
    add({
      id: 'horizonte-curto', tipo: 'corrige', campo: 'anos_protecao',
      valor: e.anosSugeridosPorFilhos, foco: 'educacao',
      titulo: `Estender a proteção para ${e.anosSugeridosPorFilhos} anos`,
      porque: `A proteção acaba em ${e.anos} anos, mas o filho mais novo só completa `
        + `${IDADE_INDEPENDENCIA} daqui a ${e.anosSugeridosPorFilhos}. São ${faltam} ano(s) `
        + 'em que ele ainda depende dessa renda e a apólice já terminou — justamente a '
        + 'faixa da faculdade, a mais cara de todas.',
      emJogo: e.custoFilhosMensal * 12 * faltam,
      dizerAssim: 'A proteção precisa durar até o dia em que eles não precisarem mais dela.',
    })
  }

  // Capital menor que a dívida.
  if (e.dividas > 0 && e.valores.morte > 0 && e.valores.morte < e.dividas) {
    add({
      id: 'capital-menor-divida', tipo: 'bloqueia', campo: 'capital_sugerido',
      valor: Math.round(e.sugestoes.morte), foco: 'dividas',
      titulo: 'O capital não cobre nem a dívida',
      porque: `Capital de ${m(e.valores.morte)} contra ${m(e.dividas)} de dívida. `
        + 'Do jeito que está, a família recebe o seguro, quita parte do saldo devedor e '
        + 'ainda fica devendo — o plano entrega o oposto do que promete.',
      emJogo: e.dividas - e.valores.morte,
    })
  }

  // ── 2. O QUE ESTÁ SOBRANDO OU FORA DE LUGAR ───────────────────────────────

  // Prêmio que não cabe: a recomendação aqui é reduzir, não insistir.
  if (e.investimento && e.poupancaMensal != null && e.investimento.mensal > 0
    && e.investimento.mensal > e.poupancaMensal) {
    const cabe = Math.max(e.poupancaMensal, 0)
    add({
      id: 'premio-nao-cabe', tipo: 'bloqueia',
      titulo: 'O prêmio não cabe no orçamento do cliente',
      porque: `O plano pede ${m(e.investimento.mensal)}/mês e a sobra do cliente é `
        + `${m(cabe)}/mês (renda ${m(e.renda)} menos custo de vida ${m(e.custoVida)}). `
        + 'Apólice que não cabe cancela em poucos meses — e cancelamento devolve a '
        + 'comissão. Melhor apresentar um plano menor que ele mantém a vida inteira.',
      emJogo: 0,
      dizerAssim: 'Prefiro te entregar um plano que você mantém para sempre a um plano '
        + 'perfeito que você cancela em seis meses.',
    })
  }

  // Buy-sell sem contraparte.
  if (e.temPJ && e.pj.quota > 0 && e.pj.numSocios < 2) {
    add({
      id: 'buysell-sem-socio', tipo: 'refina', foco: 'empresarial',
      titulo: 'Sócio único: a conversa é homem-chave, não acordo de sócios',
      porque: `Com ${e.pj.participacao}% do capital social não existe outro sócio para `
        + 'comprar a quota da família — o acordo de sócios não tem contraparte. O que '
        + 'resolve aqui é o capital de homem-chave e a liquidez para o inventário das quotas.',
      emJogo: 0,
    })
  }

  // Reposição de renda para quem já vive de patrimônio.
  if (e.idade != null && e.idade >= 60 && e.filhosDependentes.length === 0
    && e.capitalReposicaoRenda > e.custoInventario * 2 && e.custoInventario > 0) {
    add({
      id: 'idoso-reposicao', tipo: 'refina', campo: 'capital_sugerido',
      valor: Math.round(e.dividas + e.custoInventario), foco: 'sucessao',
      titulo: 'Rever a régua do capital: aqui a conversa é sucessão, não reposição de renda',
      porque: `Aos ${e.idade} anos e sem filhos dependentes, o estudo está projetando `
        + `${m(e.capitalReposicaoRenda)} para repor ${e.anos} anos de renda. Se ele já vive `
        + `de patrimônio, o número que resolve de verdade é o do inventário `
        + `(${m(e.custoInventario)}) — e o prêmio cai junto, o que torna a venda mais fácil.`,
      emJogo: 0,
    })
  }

  // ── 3. O QUE FORTALECE A APRESENTAÇÃO ─────────────────────────────────────

  // A conta que ganha a objeção "prefiro investir".
  if (e.acumularEmVezDeSegurar?.anos != null && e.acumularEmVezDeSegurar.anos > 3) {
    const a = e.acumularEmVezDeSegurar
    add({
      id: 'usar-comparador', tipo: 'reforca',
      titulo: 'Leve a conta do "prefiro investir" pronta',
      porque: `Guardando os mesmos ${m(a.aporteMensal)}/mês a ${pct(a.taxaReal * 100)} ao ano `
        + `reais, ele leva ${String(a.anos).replace('.', ',')} anos para juntar os `
        + `${m(a.alvo)} que o seguro entrega no primeiro mês. Não é contra investir — é `
        + 'sobre o que acontece se o prazo não for cumprido até o fim.',
      emJogo: 0,
      dizerAssim: `Investir é ótimo e você deve continuar. Só que a poupança leva `
        + `${String(a.anos).replace('.', ',')} anos para chegar nesse número, e o risco não espera.`,
    })
  }

  // O preço da espera, quando existe idade para calcular.
  if (e.custoDaEspera?.cenarios?.length > 0) {
    const c5 = e.custoDaEspera.cenarios[e.custoDaEspera.cenarios.length - 1]
    add({
      id: 'preco-da-espera', tipo: 'reforca',
      titulo: 'Tenha o preço da espera na ponta da língua',
      porque: `A mesma apólice contratada daqui a ${c5.daquiAAnos} anos sairia por cerca de `
        + `${m(c5.mensal)}/mês (${pct(c5.aMaisPct)} a mais), e isso supondo a mesma saúde de hoje — `
        + 'que é a premissa mais frágil de todas. É estimativa por idade, não cotação.',
      emJogo: 0,
      dizerAssim: 'O que você tem hoje e não vai ter depois não é dinheiro: é saúde aprovada na análise.',
    })
  }

  // Aposentadoria: o elo que a maioria não faz.
  if (e.aposentadoria?.dependeDaRenda && !e.aposentadoria.cobreInvalidez) {
    add({
      id: 'acumulo-sem-invalidez', tipo: 'corrige', campo: 'capital_invalidez',
      valor: Math.round(e.sugestoes.invalidez), foco: 'aposentadoria',
      titulo: 'O plano de aposentadoria para junto com a renda',
      porque: `Ele aporta ${m(e.aposentadoria.aporteAtual)}/mês na previdência, e esse aporte `
        + 'sai da renda do trabalho. Numa invalidez, o aporte para no mesmo mês em que a '
        + 'renda para — o plano de aposentadoria morre antes da aposentadoria. Sem cobrir '
        + 'invalidez, o acúmulo é uma promessa condicionada a nada dar errado.',
      emJogo: e.aposentadoria.lacuna,
      dizerAssim: 'Seu plano de aposentadoria depende de você continuar trabalhando. '
        + 'O que garante o plano se isso não acontecer?',
    })
  }

  // Cliente sem dependentes: a régua muda, e é preciso dizer isso em voz alta.
  if (!e.temDependentes && (e.renda > 0 || e.custoVida > 0)) {
    add({
      id: 'sem-dependentes', tipo: 'reforca',
      titulo: 'Sem dependentes: o argumento não é a família, é ele mesmo',
      porque: 'Ninguém perde padrão de vida se essa renda parar, então reposição de renda '
        + 'na morte não é o argumento aqui — e insistir nele soa a venda forçada. O que '
        + 'sustenta a conversa é a exposição dele: invalidez '
        + `(${m(e.sugestoes.invalidez)}), doenças graves (${m(e.sugestoes.doencas_graves)}) `
        + 'e a liquidez para o inventário dos bens que ele construiu.',
      emJogo: 0,
      dizerAssim: 'Esse plano não é para quando você faltar. É para o dia em que você '
        + 'estiver aqui e não puder trabalhar.',
    })
  }

  // Herdeiro menor: o rito muda e quase ninguém sabe disso.
  if (e.sucessao.herdeirosMenores && e.custoInventario > 0) {
    add({
      id: 'inventario-judicial', tipo: 'reforca', foco: 'sucessao',
      titulo: 'Herdeiro menor: o inventário é judicial por lei',
      porque: `Com herdeiro menor não existe inventário em cartório — a lei obriga o rito `
        + `judicial, com Ministério Público no processo: ${e.sucessao.prazoInventarioMeses} meses `
        + 'em vez de 6, e custas maiores. É um ponto concreto que quase nenhum cliente sabe '
        + 'e que muda a percepção do prazo na hora.',
      emJogo: 0,
      dizerAssim: 'Como você tem filho menor, o inventário nem pode ser feito em cartório: '
        + 'vai para a justiça, com o Ministério Público acompanhando.',
    })
  }

  // ── POR ONDE ABRIR A CONVERSA ─────────────────────────────────────────────
  // Um estudo bem preenchido e sem furos não deixa a consultora sem nada: ela
  // ainda precisa decidir qual número coloca na mesa primeiro. Esta é a única
  // recomendação que aparece mesmo quando está tudo certo — e ela não é
  // enfeite: o slide que abre a reunião define o resto dela.
  if (perfil && e.ativas.length > 0) {
    const abre = perfil.prioridade.find((id) => e.valores[id] > 0)
    if (abre) {
      const numero = abre === 'sucessao' ? e.custoInventario
        : abre === 'dit' ? e.valores.dit * (e.diariaPorId?.dit?.dias ?? 90)
          : e.valores[abre]
      const contexto = abre === 'sucessao'
        ? `${m(e.custoInventario)} que a família precisa entregar em dinheiro para destravar `
          + `${m(e.bensInventariaveis)} de patrimônio`
        : abre === 'invalidez'
          ? `${m(e.valores.invalidez)} para o cenário em que ele continua aqui e não pode mais trabalhar`
          : abre === 'aval'
            ? `${m(e.valores.aval)} de dívida que o aval dele garante e que não morre com ele`
            : abre === 'morte'
              ? `${m(e.valores.morte)} para manter o padrão de vida de quem depende dele`
              : `${m(e.valores[abre])} de ${rotulo(abre)}`
      add({
        id: 'abrir-por', tipo: 'refina',
        titulo: `Abra pela cobertura de ${rotulo(abre)}`,
        porque: `Perfil ${perfil.rotulo.toLowerCase()}: ${perfil.tese} Neste estudo, o número `
          + `que carrega essa tese é ${contexto}. Comece por ele — quando a primeira conta `
          + 'faz sentido, o resto da apólice deixa de parecer venda casada.',
        emJogo: numero,
      })
    }
  }

  // ── 4. PENDÊNCIAS: o que perguntar antes de apresentar ────────────────────
  // Separadas das recomendações de propósito. Recomendação é decisão; pendência
  // é dado que falta. Misturar as duas faz a consultora apresentar um estudo
  // achando que ele está pronto.
  const pendencias = []
  const pergunta = (id, campo, texto, perguntaAoCliente, critico = false) => {
    pendencias.push({ id, campo, texto, perguntaAoCliente, critico })
  }

  if (!(e.renda > 0)) {
    pergunta('renda', 'renda_mensal',
      'Sem a renda o estudo não dimensiona doenças graves, DIT nem diária de internação.',
      'Quanto entra por mês, somando tudo?', true)
  }
  if (!(e.custoVida > 0)) {
    pergunta('custo-vida', 'custo_vida_mensal',
      'Sem o custo de vida não há capital de morte nem gráfico de autonomia — é o número que sustenta a apresentação inteira.',
      'Quanto a casa consome por mês, com tudo dentro?', true)
  }
  if (e.idade == null) {
    pergunta('idade', 'data_nascimento',
      'Sem a data de nascimento no cadastro não dá para estimar o preço da espera nem conferir o limite de idade do produto.',
      'Qual a sua data de nascimento?', true)
  }
  if (e.sucessao.casado && !e.sucessao.regimeBens) {
    pergunta('regime', 'regime_bens',
      'Casado(a) sem regime de bens: o estudo está cobrando ITCMD sobre o patrimônio inteiro, e metade pode ser meação do cônjuge.',
      'Vocês casaram em comunhão parcial, universal ou separação de bens?', true)
  }
  if (e.itcmdOrigem === 'padrao' && e.custoInventario > 0) {
    pergunta('uf', 'uf',
      `ITCMD assumido em ${e.itcmd}% por falta do estado. O imposto é estadual e vai de 2% a 8%.`,
      'Os bens estão em qual estado?', false)
  }
  if (!e.detalhado && e.patrimonioBruto > 0) {
    pergunta('composicao', 'patrimonio_imoveis',
      'Só o patrimônio total foi informado. Sem a composição por classe o estudo não separa o que trava do que é líquido — e o capítulo de sucessão perde o argumento principal.',
      'Desse total, quanto é imóvel, quanto é investimento e quanto é empresa?', false)
  }
  if (!(e.coberturaAtual > 0) && e.valores.morte > 0) {
    pergunta('cobertura-atual', 'cobertura_atual',
      'Sem saber o que ele já tem, o estudo pode estar propondo capital que já existe — ou ignorando que a apólice atual é do empregador e acaba junto com o emprego.',
      'Você já tem algum seguro de vida hoje, pela empresa, pelo banco ou individual?', false)
  }
  if (e.dividas > 0 && e.prazoDividaAnos == null) {
    pergunta('prazo-divida', 'dividas_prazo_anos',
      'Sem o prazo da dívida não dá para saber se a proteção termina antes do financiamento.',
      'Quantos anos ainda faltam do financiamento?', false)
  }
  if (e.temPJ && !(e.pj.numSocios > 0)) {
    pergunta('socios', 'pj_num_socios',
      'O acordo de sócios funciona por apólice cruzada: sem saber quantos sócios são, não dá para desenhar quem segura quem.',
      'Quantos sócios são, e com qual participação cada um?', false)
  }
  if (!(e.investimento?.mensal > 0)) {
    pergunta('premio', 'premio_estimado',
      'Sem o prêmio cotado a proposta não fecha: o capítulo do investimento, a alavancagem e o preço da espera ficam todos vazios.',
      null, false)
  }

  // ── 5. A LEITURA EM UMA FRASE ─────────────────────────────────────────────
  // O que a consultora lê de relance antes de entrar na reunião.
  const resumo = (() => {
    if (!perfil) return 'Estudo ainda sem dados suficientes para uma leitura.'
    const partes = [perfil.tese]
    if (e.deficitLiquidez > 0) {
      partes.push(`Faltam ${m(e.deficitLiquidez)} de liquidez para o inventário.`)
    }
    if (e.mesesLiquidos != null && e.mesesLiquidos < 24 && e.custoVidaBase > 0) {
      partes.push(`Hoje a família se sustenta ${e.mesesLiquidos} mês(es) sem vender bens.`)
    }
    if (e.gap > 0) partes.push(`O gap de proteção é de ${m(e.gap)}.`)
    return partes.join(' ')
  })()

  // Ordem de apresentação das coberturas para ESTE perfil: o que abre a
  // conversa vem primeiro, e o resto segue o catálogo.
  const ordemCoberturas = perfil
    ? [...e.ativas].sort((a, b) => {
      const ia = perfil.prioridade.indexOf(a.id)
      const ib = perfil.prioridade.indexOf(b.id)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    : e.ativas

  const recomendacoes = rec
    .map((r) => ({ ...r, peso: peso(r, e) }))
    .sort((a, b) => b.peso - a.peso)

  return {
    perfil,
    resumo,
    recomendacoes,
    pendencias,
    pendenciasCriticas: pendencias.filter((p) => p.critico),
    ordemCoberturas,
    // pronto para apresentar? é a soma das três coisas que travam uma reunião
    pronto: pendencias.filter((p) => p.critico).length === 0
      && !recomendacoes.some((r) => r.tipo === 'bloqueia')
      && e.inconsistencias.filter((i) => i.grave).length === 0,
  }
}

// Sugestões de capital que a consultora aplica com um clique. Vem do
// diagnóstico para a tela não precisar reimplementar a regra.
export function aplicaveis(diag) {
  if (!diag) return []
  return diag.recomendacoes.filter((r) => r.campo && Number.isFinite(r.valor) && r.valor > 0)
}

export { LIMITES_MERCADO, rotulo as rotuloCobertura, focoRotulo }
