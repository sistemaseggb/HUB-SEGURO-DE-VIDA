// ─────────────────────────────────────────────────────────────────────────────
// A SUBSCRIÇÃO — "isso sai, e em quanto tempo?"
//
// O motor sabe QUANTO proteger. O estimador sabe QUANTO CUSTA. Faltava a
// pergunta que vem depois do aperto de mão, e que é a que mata venda já ganha:
//
//     "Beleza, fechado. Quando é que está valendo?"
//
// Até aqui a resposta era um chute animado. A consultora dizia "uns dez dias",
// o caso ia para exame médico e perfil financeiro, voltava em 45 dias com um
// agravo de 30% que ninguém tinha avisado, e o cliente — que já tinha decidido
// comprar — desistia. Não porque o produto ficou ruim: porque a promessa
// quebrou. Cliente perdoa preço; não perdoa surpresa.
//
// Este arquivo é o que um subscritor experiente sabe de cabeça, escrito de
// forma que a consultora saiba ANTES de prometer:
//
//   · o que a seguradora vai EXIGIR neste capital e nesta idade;
//   · quanto tempo isso leva, de verdade;
//   · o que provavelmente vem com AGRAVO ou RESTRIÇÃO, e por quê;
//   · e o que dá para separar AINDA NA REUNIÃO para o processo não parar.
//
// ── O QUE ISTO NÃO É ─────────────────────────────────────────────────────────
// Não é a política de subscrição de nenhuma seguradora, e não decide nada. Cada
// companhia tem a sua tabela, e a mesma proposta sai diferente em duas delas.
// É o mapa do terreno: serve para a consultora combinar prazo com o cliente
// olhando para a realidade, e para ela pedir o documento na hora em que o
// cliente está com a caneta na mão — não três semanas depois, por e-mail.
//
// Tudo determinístico, sem rede e sem chave de API, como o resto do sistema.
// ─────────────────────────────────────────────────────────────────────────────

import { LIMITES_MERCADO } from './estudo.js'

const m = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`

// ─── ATIVIDADES DE RISCO ─────────────────────────────────────────────────────
// O que muda de verdade na análise. Duas coisas distintas, e confundi-las é o
// erro mais comum: uma atividade pode encarecer o prêmio (agravo) OU excluir a
// cobertura de acidente durante a prática dela — e a segunda é muito pior,
// porque o cliente acha que está coberto justamente na hora de maior risco.
//
// `agravo` é o multiplicador típico sobre o prêmio de risco de MORTE/ACIDENTE.
// `excluiAcidente` marca as que costumam sair com exclusão da prática.
export const ATIVIDADES_RISCO = [
  {
    id: 'moto', rotulo: 'Moto no dia a dia', agravo: 1.35, excluiAcidente: false,
    nota: 'A atividade de risco mais comum e a mais subestimada. Várias seguradoras agravam '
      + 'o prêmio de acidente; algumas restringem se o uso for profissional (entrega, mototáxi).',
    perguntar: 'Ele usa moto para trabalhar ou só para se locomover? A resposta muda a análise.',
  },
  {
    id: 'aviacao', rotulo: 'Pilota aeronave', agravo: 1.8, excluiAcidente: true,
    nota: 'Aviação civil privada costuma sair com exclusão ou agravo alto. Piloto de linha '
      + 'aérea é outra conversa e tem produto próprio.',
    perguntar: 'Quantas horas de voo por ano, e em que tipo de aeronave?',
  },
  {
    id: 'mergulho', rotulo: 'Mergulho', agravo: 1.4, excluiAcidente: true,
    nota: 'Mergulho autônomo acima de certa profundidade sai excluído na maioria das apólices. '
      + 'Mergulho recreativo raso costuma passar sem agravo.',
    perguntar: 'Recreativo até 30 m, ou técnico/profissional?',
  },
  {
    id: 'paraquedismo', rotulo: 'Paraquedismo / voo livre', agravo: 2.0, excluiAcidente: true,
    nota: 'Quase sempre excluído da cobertura de acidente. Existe cobertura específica, '
      + 'em produto separado e com prêmio próprio.',
    perguntar: 'Com que frequência? Salto esporádico e prática regular são analisados diferente.',
  },
  {
    id: 'automobilismo', rotulo: 'Automobilismo / competição', agravo: 1.9, excluiAcidente: true,
    nota: 'Competição em pista é exclusão padrão. Track day recreativo às vezes passa — '
      + 'às vezes não, e é preciso perguntar antes.',
    perguntar: 'É competição federada, ou track day de fim de semana?',
  },
  {
    id: 'altura', rotulo: 'Trabalho em altura', agravo: 1.5, excluiAcidente: false,
    nota: 'Muda a classe de risco ocupacional inteira, não só o acidente. Costuma pedir '
      + 'detalhe da função e do treinamento (NR-35).',
    perguntar: 'Que altura, com que frequência, e com qual treinamento?',
  },
  {
    id: 'escalada', rotulo: 'Escalada / montanhismo', agravo: 1.45, excluiAcidente: true,
    nota: 'Escalada em rocha e alta montanha costumam sair excluídas; via ferrata e '
      + 'indoor normalmente passam.',
    perguntar: 'Indoor, rocha ou alta montanha?',
  },
  {
    id: 'artes_marciais', rotulo: 'Luta / artes marciais', agravo: 1.25, excluiAcidente: false,
    nota: 'Prática amadora costuma passar. Competição profissional muda a análise.',
    perguntar: 'Treina ou compete?',
  },
  {
    id: 'caca_submarina', rotulo: 'Caça submarina', agravo: 1.6, excluiAcidente: true,
    nota: 'Apneia com arpão é tratada como esporte de alto risco por praticamente todo mercado.',
    perguntar: 'Com que frequência, e a que profundidade?',
  },
]

const ATIVIDADE_POR_ID = Object.fromEntries(ATIVIDADES_RISCO.map((a) => [a.id, a]))

// ─── PROFISSÃO ───────────────────────────────────────────────────────────────
// A classe de risco ocupacional é o primeiro filtro da seguradora, e a
// profissão já é coletada no planejamento desde sempre — só nunca foi lida por
// ninguém além do diagnóstico, que a usa para sugerir DIT.
//
// A classificação abaixo é grosseira de propósito: quatro classes, como o
// mercado trabalha. O valor não está na precisão da nota, está em avisar que
// ESTE caso não é automático antes de a consultora prometer prazo.
const CLASSES_PROFISSAO = [
  {
    id: 'alto',
    rotulo: 'Risco ocupacional alto',
    agravo: 1.6,
    // ── PALAVRA SOLTA CLASSIFICA GENTE ERRADA ────────────────────────────
    // Esta lista existe para achar quem sobe em andaime e quem entrega de
    // moto. Escrita com termos soltos, ela pegava também quem nunca saiu de
    // uma cadeira: "desenvolvedor de aplicativos" batia em `aplicativo` (que
    // mirava o motorista de app) e "gerente de segurança da informação" batia
    // em `segurança` (que mirava o vigilante). Os dois saíam como risco
    // ocupacional ALTO, com agravo de 1,6, aviso de possível recusa e o caso
    // marcado como não automático — numa carteira cheia de profissionais
    // liberais e sócios de empresa de tecnologia, que é justamente quem mais
    // aparece aqui.
    //
    // Um falso positivo custa caro dos dois lados: a consultora combina prazo
    // e preço errados com um cliente de risco baixo, e o aviso perde crédito
    // quando aparece onde não devia. Então os termos ambíguos passam a exigir
    // o contexto que os torna arriscados de verdade; o resto continua solto.
    re: new RegExp([
      'motoboy', 'motociclista', 'mototax', 'entregador',
      // "aplicativo" sozinho é a profissão de quem PROGRAMA. O risco está em
      // quem roda a cidade por ele.
      '(motorista|motoqueiro|entrega|entregador|corrida)[^,;]{0,20}aplicativo',
      // "segurança" sozinho é cargo de escritório em metade dos casos
      // (informação, trabalho, patrimonial no sentido de auditoria).
      'seguran[\u00e7c]a\\s+(patrimonial|pessoal|armad|privad|p[\u00fau]blica)',
      'agente de seguran[\u00e7c]a', 'guarda(-| )(civil|municipal|noturno)',
      // "piloto" vale para quem voa ou compete; `aeronauta` já cobre a
      // aviação comercial e "projeto piloto" não é profissão de ninguém.
      'piloto de (avi[\u00e3a]o|aeronave|helic[\u00f3o]ptero|ca[\u00e7c]a|prova|teste|corrida|f[\u00f3o]rmula)',
      'aeronaut', 'comiss[\u00e1a]rio de bordo',
      'vigilante', 'policial', 'bombeiro', 'militar', 'soldado', 'mergulhador',
      'eletricista de rede', 'linha viva', 'torre', 'andaime',
      'constru[\u00e7c][\u00e3a]o civil', 'pedreiro', 'minera[\u00e7c][\u00e3a]o',
      'petr[\u00f3o]leo', 'plataforma', 'caminhoneiro', 'motorista de carga', 'taxista',
    ].join('|'), 'i'),
    nota: 'Classe de risco elevada: o prêmio sai agravado e a cobertura de acidente pode vir '
      + 'com restrição. Algumas seguradoras simplesmente não aceitam a profissão — vale cotar '
      + 'em mais de uma antes de apresentar.',
    dit: 'restrita',
  },
  {
    id: 'medio',
    rotulo: 'Risco ocupacional intermediário',
    agravo: 1.15,
    re: /m[ée]dic|enfermeir|dentista|veterin[áa]ri|t[ée]cnico|mec[âa]nic|industri|f[áa]bric|opera[çc][ãa]o|log[íi]stic|campo|rural|agr[íi]col|fazend|soldador|marceneir|serralheir/i,
    nota: 'Risco intermediário. Costuma passar sem agravo relevante, mas a profissão entra na '
      + 'análise — profissionais de saúde, por exemplo, respondem perguntas específicas de '
      + 'exposição a material biológico.',
    dit: 'normal',
  },
  {
    id: 'autonomo',
    rotulo: 'Renda sem carteira assinada',
    agravo: 1,
    re: /aut[ôo]nom|liberal|mei|empres[áa]ri|s[óo]ci|advogad|arquitet|consultor|corretor|contador|design|desenvolvedor|freelanc|profissional liberal/i,
    nota: 'Risco de acidente baixo, mas a comprovação de RENDA é o gargalo: sem holerite, a '
      + 'seguradora pede declaração de IR, pró-labore ou faturamento — e é isso que costuma '
      + 'travar o processo, não a saúde.',
    dit: 'essencial',
  },
  {
    id: 'baixo',
    rotulo: 'Risco ocupacional baixo',
    agravo: 1,
    re: /.*/,
    nota: 'Atividade administrativa ou de escritório: a classe mais simples de subscrever.',
    dit: 'normal',
  },
]

export function classificarProfissao(profissao) {
  const texto = String(profissao ?? '').trim()
  if (!texto) return null
  return CLASSES_PROFISSAO.find((c) => c.re.test(texto)) ?? null
}

// ─── IMC ─────────────────────────────────────────────────────────────────────
// Um dos poucos números que a seguradora calcula sozinha a partir da DPS e que
// mexe no prêmio sem o cliente perceber que mexeu. As faixas abaixo são as
// usadas na subscrição de vida, que são mais tolerantes que as clínicas: o que
// interessa aqui não é saúde, é mortalidade esperada.
export function faixaIMC(pesoKg, alturaCm) {
  const peso = Number(pesoKg)
  const altura = Number(alturaCm)
  if (!(peso > 0) || !(altura > 0)) return null
  const imc = peso / ((altura / 100) ** 2)
  if (!Number.isFinite(imc) || imc < 8 || imc > 100) return null
  const valor = Math.round(imc * 10) / 10
  if (imc < 18.5) {
    return { imc: valor, faixa: 'baixo', agravo: 1.1,
      nota: 'IMC abaixo de 18,5: a seguradora costuma perguntar sobre perda de peso recente, '
        + 'que é o que de fato preocupa na análise.' }
  }
  if (imc < 30) return { imc: valor, faixa: 'normal', agravo: 1, nota: null }
  if (imc < 35) {
    return { imc: valor, faixa: 'atencao', agravo: 1.25,
      nota: 'IMC acima de 30 costuma trazer agravo moderado e perguntas adicionais na DPS.' }
  }
  if (imc < 40) {
    return { imc: valor, faixa: 'alto', agravo: 1.5,
      nota: 'IMC acima de 35: agravo relevante e, em várias seguradoras, exame obrigatório '
        + 'independentemente do capital.' }
  }
  return { imc: valor, faixa: 'muito_alto', agravo: 2,
    nota: 'IMC acima de 40: caso não automático. Pode haver recusa em parte do mercado — '
      + 'cote em mais de uma seguradora antes de apresentar qualquer prazo.' }
}

// ─── O QUE A SEGURADORA EXIGE, POR CAPITAL E IDADE ───────────────────────────
// Os degraus são a prática do mercado brasileiro de vida individual. O capital
// que conta é o do maior evento indenizável — é ele que representa a exposição
// real da seguradora, e é por ele que a retenção é medida.
//
// `dias` é o prazo TÍPICO até a emissão quando nada dá errado. Nada dá errado
// menos vezes do que a gente gostaria, e por isso o texto da tela fala em
// faixa e não em data.
const DEGRAUS_CAPITAL = [
  { ate: 500_000, exige: ['DPS (declaração pessoal de saúde)'], dias: [3, 7] },
  { ate: 1_000_000, exige: ['DPS completa', 'possível teleentrevista médica'], dias: [7, 15] },
  {
    ate: 3_000_000,
    exige: ['DPS completa', 'exames laboratoriais', 'comprovação de renda'],
    dias: [15, 30],
  },
  {
    ate: 10_000_000,
    exige: ['DPS completa', 'exames laboratoriais e cardiológicos',
      'perfil financeiro (IR, faturamento ou patrimônio)'],
    dias: [30, 45],
  },
  {
    ate: Infinity,
    exige: ['DPS completa', 'bateria completa de exames',
      'perfil financeiro detalhado', 'resseguro facultativo'],
    dias: [45, 90],
  },
]

// Idade também empurra exigência: acima dos 50 o exame entra mais cedo, e
// acima dos 60 quase sempre entra.
const IDADE_EXAME_ANTECIPADO = 50
const IDADE_EXAME_CERTO = 60

// ─────────────────────────────────────────────────────────────────────────────
// A ANÁLISE
//
// Recebe o estudo calculado e o planejamento (para os campos da migração 025,
// que podem não existir). Devolve `null` quando não há nem capital nem nada a
// dizer — a tela não mostra um bloco vazio.
// ─────────────────────────────────────────────────────────────────────────────
export function analisarSubscricao(estudo, plano = {}) {
  if (!estudo) return null
  const capital = estudo.capitalMaximoEvento > 0 ? estudo.capitalMaximoEvento : estudo.valores?.morte ?? 0
  const idade = estudo.idade

  // ── Exigências e prazo, pelo capital ──────────────────────────────────────
  const degrau = DEGRAUS_CAPITAL.find((d) => capital <= d.ate) ?? DEGRAUS_CAPITAL[DEGRAUS_CAPITAL.length - 1]
  const exigencias = [...degrau.exige]
  let [diasMin, diasMax] = degrau.dias

  // A IDADE PESA MESMO QUANDO O EXAME JÁ ERA EXIGIDO. A primeira versão só
  // somava prazo quando a idade CRIAVA a exigência de exame — então um cliente
  // de 64 anos com capital alto (que já pedia exame) recebia o mesmo prazo de
  // um de 30. Está errado: acima dos 60 a análise é mais criteriosa
  // independentemente do capital, a bateria costuma ganhar itens
  // cardiológicos, e o subscritor pede segunda opinião com mais frequência.
  const temExame = () => exigencias.some((e) => /exame/i.test(e))
  if (idade != null && idade >= IDADE_EXAME_CERTO) {
    if (!temExame()) exigencias.push('exames laboratoriais e cardiológicos (pela idade)')
    else exigencias.push('bateria ampliada pela idade (cardiológico e função renal)')
    diasMin += 7; diasMax += 14
  } else if (idade != null && idade >= IDADE_EXAME_ANTECIPADO) {
    if (!temExame()) exigencias.push('possíveis exames (idade acima de 50)')
    diasMax += 7
  }

  // ── O que agrava, e por quê ───────────────────────────────────────────────
  // Cada fator entra com o multiplicador dele e com a explicação. O produto é
  // uma ESTIMATIVA grosseira: seguradoras não multiplicam agravos assim, elas
  // somam pontos de mortalidade. Serve para dizer "prepare o cliente para um
  // prêmio acima da faixa", não para prever o número.
  const fatores = []

  const classe = classificarProfissao(plano.profissao)
  if (classe && classe.agravo > 1) {
    fatores.push({
      id: `profissao-${classe.id}`, rotulo: `Profissão: ${plano.profissao}`,
      agravo: classe.agravo, nota: classe.nota,
    })
  }

  if (estudo.fumante) {
    fatores.push({
      id: 'fumante', rotulo: 'Fumante nos últimos 12 meses', agravo: 1.6,
      nota: 'O agravo mais previsível de todos, e o único que o cliente pode reverter: '
        + 'depois de 12 meses sem fumar, quase todo mercado reclassifica. Vale contratar '
        + 'agora e pedir a reavaliação no ano que vem.',
    })
  }

  const imc = faixaIMC(plano.peso_kg, plano.altura_cm)
  if (imc && imc.agravo > 1) {
    fatores.push({ id: 'imc', rotulo: `IMC ${String(imc.imc).replace('.', ',')}`, agravo: imc.agravo, nota: imc.nota })
  }

  const atividades = (Array.isArray(plano.atividades_risco) ? plano.atividades_risco : [])
    .map((id) => ATIVIDADE_POR_ID[id]).filter(Boolean)
  for (const a of atividades) {
    fatores.push({ id: `atividade-${a.id}`, rotulo: a.rotulo, agravo: a.agravo, nota: a.nota })
  }

  const agravoEstimado = fatores.reduce((x, f) => x * f.agravo, 1)

  // ── Restrições: o que pode NÃO estar coberto ──────────────────────────────
  // Separadas do agravo de propósito. Agravo é preço; restrição é o cliente
  // achar que está coberto justamente na hora de maior risco.
  const restricoes = atividades.filter((a) => a.excluiAcidente).map((a) => ({
    id: a.id, rotulo: a.rotulo,
    texto: `A cobertura de acidente pode sair EXCLUÍDA durante a prática de ${a.rotulo.toLowerCase()}. `
      + 'Isso não aparece no valor do prêmio — aparece na apólice, e o cliente só descobre no sinistro. '
      + 'Confirme com a seguradora e diga isso a ele na reunião, não depois.',
  }))

  if (classe?.dit === 'restrita' && estudo.valores?.dit > 0) {
    restricoes.push({
      id: 'dit-profissao', rotulo: 'DIT nesta profissão',
      texto: `A DIT foi dimensionada em ${m(estudo.valores.dit)}/dia, mas em profissões de risco `
        + 'elevado essa cobertura é a primeira a ser restringida ou recusada. Cote a DIT '
        + 'separadamente antes de colocá-la na proposta.',
    })
  }

  // ── Perguntas que a análise vai fazer, e que é melhor fazer antes ─────────
  const perguntar = atividades.map((a) => ({ id: a.id, rotulo: a.rotulo, texto: a.perguntar }))

  // ── O que separar AINDA NA REUNIÃO ────────────────────────────────────────
  // A lista mais útil do arquivo. O processo não trava por falta de decisão do
  // cliente: trava por falta de um PDF que ele tinha no celular no dia em que
  // disse sim. Pedir na hora é a diferença entre 10 e 40 dias.
  const documentos = ['Documento de identidade com foto e CPF', 'Comprovante de residência atualizado']
  if (exigencias.some((e) => /renda|financeiro/i.test(e))) {
    documentos.push(classe?.id === 'autonomo'
      ? 'Declaração de IR completa (a mais recente) ou pró-labore/faturamento — sem holerite, é isto que comprova a renda'
      : 'Holerite recente ou declaração de IR')
  }
  if (exigencias.some((e) => /exame/i.test(e))) {
    documentos.push('Exames recentes que ele já tenha (últimos 12 meses) — muitas seguradoras aceitam e economizam a coleta')
  }
  if (String(plano.condicoes_declaradas ?? '').trim() !== '') {
    documentos.push('Relatório do médico assistente sobre a condição declarada — pedido depois, atrasa o caso em semanas')
  }
  if (estudo.temPJ) {
    documentos.push('Contrato social e último balanço (para o capital empresarial)')
  }
  documentos.push('Dados completos dos beneficiários: nome, CPF e data de nascimento')

  // ── O veredito ────────────────────────────────────────────────────────────
  const automatico = fatores.length === 0 && restricoes.length === 0
    && capital <= 1_000_000 && (idade == null || idade < IDADE_EXAME_ANTECIPADO)
    && String(plano.condicoes_declaradas ?? '').trim() === ''

  const acimaDaRetencao = capital > LIMITES_MERCADO.morte

  return {
    capitalAnalisado: capital,
    idade,
    classe,
    imc,
    exigencias,
    prazoDias: [diasMin, diasMax],
    fatores,
    agravoEstimado: Math.round(agravoEstimado * 100) / 100,
    // acima de 15% o prêmio cotado tende a sair visivelmente acima da estimativa
    agravoRelevante: agravoEstimado >= 1.15,
    restricoes,
    perguntar,
    documentos,
    automatico,
    acimaDaRetencao,
    // A frase que ela diz ao cliente quando ele pergunta "quando começa a valer?"
    // Sem isto, a resposta é um chute animado — e chute animado vira promessa.
    combinado: automatico
      ? `Com DPS bem preenchida e sem pendência, costuma sair em ${diasMin} a ${diasMax} dias.`
      : `Este caso não é automático: conte com ${diasMin} a ${diasMax} dias`
        + (agravoEstimado >= 1.15 ? ', e prepare o cliente para um prêmio acima da faixa estimada' : '')
        + (acimaDaRetencao ? '. Acima do limite de retenção, o caso ainda passa por resseguro facultativo, que tem prazo próprio' : '')
        + '.',
  }
}
