// ─────────────────────────────────────────────────────────────────────────────
// O CLIENTE DO TUTORIAL — o guia calcula os próprios exemplos.
//
// Um manual que descreve o motor por escrito começa certo e envelhece sozinho:
// alguém ajusta uma regra de cálculo e o texto continua ensinando a conta
// antiga, com toda a confiança de quem foi escrito uma vez. Pior num sistema
// como este, em que o número do guia é o número que a consultora vai repetir
// na frente do cliente.
//
// Então o guia não descreve o motor: ele RODA o motor. Carlos é um cliente
// fictício completo, e todos os números que aparecem no guia saem de
// `calcularEstudo()` e `diagnosticar()` — as mesmas funções que atendem a aba
// Planejamento. Mudou a regra, mudou o exemplo, no mesmo instante.
//
// E `scripts/teste-tutorial.mjs` fecha o círculo: ele confere que as
// AFIRMAÇÕES do guia continuam verdadeiras (o capital de morte é mesmo a soma
// daquelas três parcelas, a invalidez é mesmo igual à morte quando há
// dependentes, a carteira emprestada é mesmo o que separa `gap` de
// `gapPortavel`). Se alguém mudar o motor de um jeito que desminta o guia, o
// teste quebra em vez de o guia mentir.
//
// Por que Carlos é assim: ele foi desenhado para acender de uma vez as
// situações que mais aparecem e mais confundem — filhos que saem da conta aos
// 24, patrimônio travado no inventário, uma sociedade com aval, e as duas
// apólices "que ele já tem" que na verdade não são dele. Um exemplo simples
// não ensinaria nada que a consultora já não soubesse.
// ─────────────────────────────────────────────────────────────────────────────

import { calcularEstudo, IDADE_INDEPENDENCIA, LIMITES_MERCADO } from './estudo.js'
import { diagnosticar } from './diagnostico.js'
import { estimarPremio } from './premio.js'
import { responderObjecoes } from './objecoes.js'

// A data fixa importa: o exemplo do guia não pode mudar de número porque
// alguém abriu a página no dia seguinte, e a idade de Carlos precisa ser a
// mesma na explicação e na conta.
export const HOJE_EXEMPLO = new Date('2026-09-04T12:00:00')
export const NASCIMENTO_EXEMPLO = '1984-05-14'

export const CLIENTE_EXEMPLO = {
  nome: 'Carlos Eduardo Menezes',
  resumo: '42 anos, cirurgião-dentista, casado em comunhão parcial, dois filhos '
    + '(Alice de 6 e Lucas de 9). Sócio de uma clínica com um outro sócio.',
}

export const PLANO_EXEMPLO = {
  tipo_planejamento: 'pf_pj',
  focos: ['renda', 'sucessao'],
  profissao: 'Cirurgião-dentista',
  estado_civil: 'Casado(a)',
  regime_bens: 'Comunhão parcial',
  uf: 'PR',

  renda_mensal: 48_000,
  custo_vida_mensal: 27_000,
  dividas_total: 780_000,
  dividas_prazo_anos: 18,
  anos_protecao: 20,
  idade_aposentadoria: 60,

  dependentes: [
    { nome: 'Alice', idade: 6, custo_mensal: 3_200 },
    { nome: 'Lucas', idade: 9, custo_mensal: 2_800 },
  ],

  patrimonio_imoveis: 2_400_000,
  patrimonio_investimentos: 620_000,
  patrimonio_empresa: 1_800_000,
  patrimonio_veiculos: 180_000,
  previdencia_saldo: 340_000,
  previdencia_tipo: 'VGBL',
  previdencia_aporte_mensal: 3_000,

  // As duas apólices que ele "já tem" — e que o estudo trata de forma
  // diferente uma da outra. É o caso que ensina a objeção mais comum da
  // categoria.
  cobertura_atual: 500_000,
  seguros_existentes: [
    { descricao: 'Vida em grupo da clínica', origem: 'empresa', capital: 300_000 },
    { descricao: 'Prestamista do financiamento do consultório', origem: 'banco', capital: 200_000 },
  ],

  pj_razao_social: 'Clínica Menezes',
  pj_valuation: 4_200_000,
  pj_participacao_pct: 50,
  pj_num_socios: 2,
  pj_lucro_anual: 900_000,
  pj_divida_avalizada: 600_000,

  premio_estimado: 2_180,
  premio_anual: 24_500,

  // colunas das migrações 014/019/027 presentes: o exemplo mostra o sistema
  // completo, não uma instalação atrasada
  capital_invalidez: null,
  capital_doencas_graves: null,
  capital_cirurgias: null,
}

// O MESMO cliente, no meio da reunião: só o que ela conseguiu anotar nos
// primeiros dez minutos. Serve para mostrar o outro lado do diagnóstico — as
// pendências, que só aparecem quando falta dado.
export const PLANO_INCOMPLETO = {
  tipo_planejamento: 'pf',
  focos: ['renda'],
  estado_civil: 'Casado(a)',
  custo_vida_mensal: 27_000,
  dividas_total: 780_000,
  patrimonio_total: 5_000_000,
  capital_invalidez: null,
  capital_doencas_graves: null,
  capital_cirurgias: null,
}

// ─── O exemplo, calculado pelo motor de verdade ──────────────────────────────
// Sem memo: `calcularEstudo` leva menos de um décimo de milissegundo, e uma
// camada de cache aqui seria complexidade para um problema que não existe.
export function estudoDoExemplo() {
  return calcularEstudo(PLANO_EXEMPLO, {
    dataNascimento: NASCIMENTO_EXEMPLO,
    hoje: HOJE_EXEMPLO,
  })
}

export function diagnosticoDoExemplo(estudo = estudoDoExemplo()) {
  return diagnosticar(estudo, { cliente: { nome: CLIENTE_EXEMPLO.nome } })
}

export function estudoIncompleto() {
  return calcularEstudo(PLANO_INCOMPLETO, { hoje: HOJE_EXEMPLO })
}

export function diagnosticoIncompleto(estudo = estudoIncompleto()) {
  return diagnosticar(estudo, { cliente: { nome: CLIENTE_EXEMPLO.nome } })
}

// As objeções que ESTE cliente vai levantar, já respondidas com os números
// dele. O guia mostra as três mais prováveis — não como amostra de recurso,
// mas porque ler três respostas prontas ensina o formato de todas: argumento
// com conta atrás, o que NÃO dizer, e a pergunta que devolve a palavra ao
// cliente.
export function objecoesDoExemplo(estudo = estudoDoExemplo(), diagnostico = null) {
  const d = diagnostico ?? diagnosticoDoExemplo(estudo)
  return responderObjecoes(estudo, {
    diagnostico: d,
    premio: estimarPremio(estudo),
    cliente: { nome: CLIENTE_EXEMPLO.nome },
  })
}

// ─── O CAPITAL DE MORTE, ABERTO PARCELA A PARCELA ────────────────────────────
// A conta mais importante do sistema e a que a consultora mais precisa saber
// defender — é o número que abre a proposta e o primeiro que o cliente
// questiona. Aqui ela aparece somada na tela, com cada parcela nomeada.
//
// As parcelas saem do estudo já calculado, e não de uma conta refeita à mão:
// refazer a conta aqui seria criar uma segunda fonte da verdade, exatamente o
// que o motor existe para evitar.
export function parcelasDoCapitalDeMorte(e) {
  const partes = []
  if (e.custoVidaBase > 0) {
    partes.push({
      id: 'padrao',
      rotulo: 'Padrão de vida da família',
      conta: `${moeda(e.custoVidaBase)}/mês × 12 × ${e.anos} anos`,
      valor: e.custoVidaBase * 12 * e.anos,
      porque: 'O custo de vida SEM os filhos, projetado pelos anos de proteção. '
        + 'O gasto de cada filho entra na parcela seguinte, porque tem prazo para acabar.',
    })
  }
  if (e.capitalFilhos > 0) {
    partes.push({
      id: 'filhos',
      rotulo: `Filhos, até os ${IDADE_INDEPENDENCIA}`,
      conta: e.filhos.filter((f) => f.capitalAte24 > 0)
        .map((f) => `${f.nome || 'filho'}: ${moeda(f.custoMensal)} × 12 × ${f.anosRestantes} anos`)
        .join('  +  '),
      valor: e.capitalFilhos,
      porque: `Cada filho custa até se formar, não para sempre. Alice tem mais anos pela frente `
        + `que Lucas, então pesa mais — e os dois somem da conta aos ${IDADE_INDEPENDENCIA}.`,
    })
  }
  if (e.dividas > 0) {
    partes.push({
      id: 'dividas',
      rotulo: 'Dívidas quitadas',
      conta: 'saldo devedor informado',
      valor: e.dividas,
      porque: 'A dívida não morre com o devedor: vai para o espólio e come a herança '
        + 'antes de qualquer herdeiro receber um real.',
    })
  }
  return partes
}

// ─── AS TRÊS TRAVAS QUE IMPEDEM UMA PROPOSTA IMPOSSÍVEL ──────────────────────
// O motor não sugere o que a seguradora recusa. Ensinar as três de uma vez
// evita a pior sequência possível: apresentar um número, o cliente se
// acostumar com ele, e a cotação voltar menor.
export const TRAVAS_DO_MOTOR = [
  {
    id: 'teto',
    titulo: 'O teto do que o mercado emite',
    texto: `Renda ÷ 30 para quem ganha muito dá uma diária que nenhuma apólice individual `
      + `emite no Brasil. O estudo limita a SUGESTÃO ao que sai de verdade `
      + `(morte e invalidez até ${moedaCurta(LIMITES_MERCADO.morte)}, doenças graves até `
      + `${moedaCurta(LIMITES_MERCADO.doencas_graves)}, diárias até `
      + `${moeda(LIMITES_MERCADO.diaria_dit)}) e AVISA que limitou.`,
    naPratica: 'Você continua livre para digitar o que a seguradora aprovar — o teto trava a '
      + 'sugestão automática, nunca a sua decisão.',
  },
  {
    id: 'dg',
    titulo: 'Doenças graves nunca passa do capital de morte',
    texto: 'Nenhuma seguradora cobre mais o adoecer do que o morrer. Se você baixar a morte e '
      + 'deixar doenças graves acima dela, a conferência acusa — porque quem acusaria depois '
      + 'seria a subscrição, com o cliente já tendo visto o número maior.',
    naPratica: 'Viu esse aviso? Ou sobe a morte, ou desce doenças graves. Não há terceira saída '
      + 'que a seguradora aceite.',
  },
  {
    id: 'cotacao',
    titulo: 'Quando a cotação chega, é ela que manda',
    texto: 'A faixa de prêmio por idade é um DIMENSIONADOR, não uma cotação: serve para a '
      + 'conversa ter uma ordem de grandeza em vez de um silêncio. Assim que você digita o '
      + 'prêmio cotado, ele vale em todo o resto do sistema e a estimativa vira só uma '
      + 'conferência.',
    naPratica: 'Cotação muito acima da faixa costuma ser agravo médico ou cobertura a mais; '
      + 'muito abaixo costuma ser cobertura que ficou de fora. Vale conferir ANTES de apresentar.',
  },
]

// ─── O QUE MUDA QUANDO SE ENTENDE O SISTEMA ──────────────────────────────────
// Os erros que o guia antigo não cobria porque só ensinava onde clicar. Cada
// um é um comportamento que parece inofensivo e custa uma venda ou a
// credibilidade do estudo.
export const ERROS_CAROS = [
  {
    erro: 'Apresentar com a conferência acesa',
    custa: 'A conferência é a lista do que não fecha. Um aviso grave ignorado vira um número '
      + 'que não se sustenta na frente de quem perguntar — e quem pergunta costuma ser o '
      + 'contador ou o advogado da família.',
    faca: 'Zere os avisos graves antes de gerar a proposta. Os não-graves você decide se '
      + 'valem uma pergunta ao cliente.',
  },
  {
    erro: 'Abater tudo o que o cliente "já tem"',
    custa: 'Vida em grupo acaba com o vínculo e prestamista paga o banco. Abatidas do capital '
      + 'de morte, elas escondem o buraco de proteção e ainda descontam a dívida duas vezes.',
    faca: 'Liste cada apólice com a ORIGEM no bloco de seguros existentes. O estudo passa a '
      + 'separar o que é dele do que é emprestado.',
  },
  {
    erro: 'Cortar cobertura no chute quando o preço trava',
    custa: 'Cortado no olho, o primeiro a sair é sempre a invalidez — que é a mais provável de '
      + 'todas e a que o cliente entende menos.',
    faca: 'Use o plano que cabe no orçamento: ele monta a apólice na ordem do risco DESTE '
      + 'cliente dentro do teto, e lista o que ficou de fora com quanto faltaria para entrar.',
  },
  {
    erro: 'Prometer prazo de emissão de cabeça',
    custa: 'O caso vai a exame, volta em 45 dias com agravo que ninguém avisou, e o cliente que '
      + 'já tinha decidido comprar desiste. Não pelo preço: pela promessa quebrada.',
    faca: 'Abra a Subscrição antes de combinar data. Ela diz o que a seguradora vai exigir '
      + 'neste capital e nesta idade, e o prazo típico de verdade.',
  },
  {
    erro: 'Indicar os filhos menores como beneficiários principais',
    custa: 'A seguradora paga, e o dinheiro fica sob representação legal: o uso costuma '
      + 'depender de alvará judicial. Meses de espera pelo capital que existia justamente '
      + 'para não haver espera.',
    faca: 'Cônjuge como principal e filhos como suplentes resolve na proposta de contratação, '
      + 'em dez segundos.',
  },
  {
    erro: 'Deixar o planejamento para depois da reunião',
    custa: 'O que o cliente disse esfria em horas, e o estudo montado de memória perde '
      + 'justamente os números que dariam peso à apresentação.',
    faca: 'Preencha durante a reunião, com ele vendo os números aparecerem. O próprio '
      + 'preenchimento vira parte da consultoria.',
  },
]

// ─── Formatação local ────────────────────────────────────────────────────────
// O guia mostra dinheiro em texto corrido dentro de frases, então usa uma
// formatação mais curta que a das telas de número.
export function moeda(v) {
  return `R$ ${Math.round(Number(v) || 0).toLocaleString('pt-BR')}`
}

export function moedaCurta(v) {
  const n = Number(v) || 0
  if (Math.abs(n) >= 1_000_000) {
    return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (Math.abs(n) >= 1_000) return `R$ ${Math.round(n / 1_000).toLocaleString('pt-BR')} mil`
  return moeda(n)
}
