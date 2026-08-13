// ─────────────────────────────────────────────────────────────────────────────
// O MOTOR DA CONSULTORIA — de dados de reunião a uma apólice construída.
//
// Usado na aba Planejamento (formulário + inteligência), na Proposta (slides)
// e no Dossiê. Tudo que aparece na apresentação nasce aqui: um número só existe
// em um lugar, para a tela e o slide nunca discordarem entre si.
//
// As três frentes do estudo:
//
//   1. PROTEÇÃO DA RENDA (PF)
//      Morte, invalidez, doenças graves, diárias e acidentes — o que sustenta
//      a família quando a renda para, por qualquer motivo.
//
//   2. SUCESSÃO E BLINDAGEM
//      O patrimônio é decomposto por classe porque cada uma se comporta de um
//      jeito no inventário:
//        • Previdência (VGBL/PGBL) e seguro NÃO passam por inventário — vão
//          direto ao beneficiário, em dias, sem ITCMD na maioria dos estados.
//        • Investimentos, imóveis, empresa e veículos ficam TRAVADOS até o
//          imposto ser pago — e o imposto se paga em dinheiro, não em imóvel.
//      Daí sai o número que vende sozinho: o déficit de liquidez.
//
//   3. PLANEJAMENTO EMPRESARIAL (PJ)
//      Acordo de sócios (buy-sell), homem-chave e dívidas avalizadas — o aval
//      do sócio não morre com ele, vira dívida do espólio.
//
// Referências das sugestões (prática de mercado em consultoria de vida):
//   Morte            → custo de vida × 12 × anos + dívidas
//                      (o gasto de cada filho entra separado, só até os 24)
//   Invalidez (IPTA) → mesmo capital da morte (a renda para do mesmo jeito)
//   Doenças graves   → 24 × renda mensal (≈ 2 anos de tratamento sem trabalhar)
//   DIT / DIH        → renda ÷ 30 por dia parado ou internado
//   Morte acidental  → 100% do capital de morte (paga somado a ele)
//   Sucessão         → base inventariável × (ITCMD % + custas/honorários %)
//   Buy-sell         → valuation × participação do sócio
//   Homem-chave      → 2 × lucro anual da empresa
// ─────────────────────────────────────────────────────────────────────────────

const n = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

// Campo numérico "definido pela consultora": vazio/null = usar a sugestão.
// Booleano e texto em branco não contam como valor — vieram de um campo vazio.
const definido = (v) => v != null && typeof v !== 'boolean'
  && String(v).trim() !== '' && Number.isFinite(Number(v))

// ─── Blindagem da entrada ────────────────────────────────────────────────────
// Um "-5" digitado por engano num campo de dinheiro não pode virar capital de
// morte negativo na proposta do cliente, e um zero a mais colado não pode
// estourar o layout com um número de vinte dígitos. Toda quantidade que entra
// no estudo passa por aqui; o que sai errado é sinalizado na conferência, não
// escondido (ver `inconsistencias`).
const TETO_VALOR = 1e12          // R$ 1 trilhão: acima disso é erro de digitação
const TETO_ANOS = 60             // horizonte de proteção plausível
const TETO_DIAS = 1095           // 3 anos de diárias

// Quantidade em dinheiro: nunca negativa, nunca absurda
const q = (v, teto = TETO_VALOR) => {
  const x = Number(v)
  if (!Number.isFinite(x) || x <= 0) return 0
  return Math.min(x, teto)
}
// Percentual: sempre entre 0 e um teto declarado (100 quando não se diz outro)
const pctVal = (v, padrao, teto = 100) => (definido(v) ? Math.min(Math.max(n(v), 0), teto) : padrao)
// Alíquotas do inventário. Os tetos não são decoração: sem eles um dígito a
// mais digitado na pressa (40 em vez de 4) faz o custo do inventário passar do
// próprio patrimônio, e a proposta sai com um número que não existe no mundo.
// O ITCMD brasileiro vai até 8%; custas + honorários raramente passam de 12%.
const TETO_ITCMD = 20
const TETO_CUSTAS = 30
// Contagem inteira dentro de uma faixa (anos, dias, idades)
const inteiro = (v, padrao, min, max) => {
  if (!definido(v)) return padrao
  const x = Math.round(n(v))
  return Math.min(Math.max(x, min), max)
}

// Idade em que o filho deixa de depender financeiramente (fim da faculdade)
export const IDADE_INDEPENDENCIA = 24

// ─── O QUE O MERCADO EMITE DE VERDADE ────────────────────────────────────────
// Uma sugestão que a seguradora não aceita não é uma sugestão: é um número que
// a cotação derruba depois que o cliente já se acostumou com ele. Renda ÷ 30
// para quem ganha R$ 150 mil dá R$ 5.000 de diária — nenhuma apólice individual
// no Brasil emite isso, e a consultora só descobre na hora de cotar.
//
// Os tetos abaixo são a prática do mercado brasileiro de vida individual. Não
// são lei: são o ponto em que o caso deixa de ser automático. O estudo limita
// a SUGESTÃO a eles e avisa que limitou — a consultora continua livre para
// digitar o que a seguradora aprovar.
export const LIMITES_MERCADO = {
  // acima disso o caso vai a resseguro facultativo: exames, entrevista e meses
  morte: 20_000_000,
  invalidez: 20_000_000,
  // doenças graves é a cobertura mais cara de resseguro e a mais limitada
  doencas_graves: 3_000_000,
  // diárias são limitadas por dia E pelo comprometimento da renda
  diaria_dit: 1_500,
  diaria_dih: 1_500,
}

// Doenças graves acima do capital de morte não passa em subscrição: a
// seguradora não cobre mais o adoecer do que o morrer.
const DG_TETO_SOBRE_MORTE = 1

// ─── ITCMD: O IMPOSTO É ESTADUAL ─────────────────────────────────────────────
// Assumir 4% para todo mundo (a alíquota de SP) erra a verba sucessória em até
// o dobro — e erra para MENOS, que é o pior lado: a família descobre o buraco
// no cartório. Cada estado tem a sua lei, e vários são progressivos por faixa.
//
// A tabela traz a alíquota EFETIVA típica de um patrimônio de médio porte no
// estado. Onde a lei é progressiva, é a alíquota da faixa alta — que é onde
// caem os clientes desta carteira. É premissa declarada, não cotação: a tela
// mostra a origem do número e a consultora pode sobrescrever.
export const ITCMD_POR_UF = {
  AC: 4, AL: 4, AM: 2, AP: 4, BA: 8, CE: 8, DF: 6, ES: 4, GO: 8,
  MA: 7, MG: 5, MS: 6, MT: 8, PA: 6, PB: 8, PE: 8, PI: 6, PR: 4,
  RJ: 8, RN: 6, RO: 4, RR: 8, RS: 6, SC: 8, SE: 8, SP: 4, TO: 8,
}
export const ITCMD_PADRAO = 4

// ─── O QUE CUSTA SEGURAR OS BENS ENQUANTO O INVENTÁRIO CORRE ─────────────────
// O ITCMD é o número que todo mundo cita, e é o menor deles. Enquanto o
// processo corre — 6 meses no cartório, 18 na justiça — o imóvel travado
// continua gerando IPTU, condomínio, seguro e manutenção; o carro, IPVA e
// licenciamento; a empresa, contador. A família paga tudo isso sem poder vender
// nada, e paga do próprio bolso.
//
// 1% ao ano sobre o valor dos bens ilíquidos é conservador para imóvel urbano
// (só o IPTU costuma dar 0,6% a 1%, antes do condomínio).
const CUSTO_ANUAL_MANUTENCAO_BENS = 0.01

// Idade em que o mercado costuma encerrar a aceitação e a renovação de vida
// individual. Serve para avisar quando o horizonte pedido passa do produto.
export const IDADE_LIMITE_PRODUTO = 80

// ─── O PREÇO DA ESPERA ───────────────────────────────────────────────────────
// O prêmio de risco de vida acompanha a mortalidade, que cresce de forma
// acelerada com a idade — devagar até os 35, mais rápido a cada década depois.
// A curva abaixo é o índice relativo de prêmio por idade usado nas ESTIMATIVAS
// da tela e da proposta. Não é cotação: serve para dimensionar a conversa
// ("esperar 5 anos custa mais ou menos isso"), e toda aparição dela na
// interface leva a etiqueta de estimativa.
//
// Base: agravamento típico das tábuas de mortalidade usadas no mercado
// brasileiro de vida individual (o prêmio de risco aproximadamente dobra a
// cada 8–10 anos na faixa dos 30 aos 60). Ajuste os pares aqui se a carteira
// mostrar outro comportamento — nenhum outro lugar do código depende deles.
const CURVA_PREMIO_IDADE = [
  [18, 0.55], [25, 0.70], [30, 0.85], [35, 1.00], [40, 1.28],
  [45, 1.70], [50, 2.35], [55, 3.30], [60, 4.70], [65, 6.80], [70, 9.50],
]
// Fumante paga tipicamente entre 50% e 100% a mais no risco de vida.
const AGRAVO_FUMANTE = 1.6

// Índice de prêmio para uma idade, interpolado entre os pontos da curva.
export function indicePremioIdade(idade, { fumante = false } = {}) {
  if (!Number.isFinite(idade)) return null
  const i = Math.min(Math.max(idade, CURVA_PREMIO_IDADE[0][0]),
    CURVA_PREMIO_IDADE[CURVA_PREMIO_IDADE.length - 1][0])
  let base = CURVA_PREMIO_IDADE[CURVA_PREMIO_IDADE.length - 1][1]
  for (let k = 0; k < CURVA_PREMIO_IDADE.length - 1; k++) {
    const [x0, y0] = CURVA_PREMIO_IDADE[k]
    const [x1, y1] = CURVA_PREMIO_IDADE[k + 1]
    if (i >= x0 && i <= x1) { base = y0 + ((i - x0) / (x1 - x0)) * (y1 - y0); break }
  }
  return base * (fumante ? AGRAVO_FUMANTE : 1)
}

// Idade a partir da data de nascimento (aniversário já feito ou não no ano)
export function idadeEm(dataNascimento, referencia = new Date()) {
  if (!dataNascimento) return null
  const [a, m, d] = String(dataNascimento).slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return null
  let idade = referencia.getFullYear() - a
  const mesAtual = referencia.getMonth() + 1
  if (mesAtual < m || (mesAtual === m && referencia.getDate() < d)) idade -= 1
  return idade >= 0 && idade <= 120 ? idade : null
}

// ─── SUCESSÃO: O QUE MUDA O CUSTO E O PRAZO DO INVENTÁRIO ────────────────────
// Prazo típico do inventário no Brasil. Extrajudicial (cartório) só é possível
// com todos os herdeiros maiores, capazes e de acordo; havendo menor, o rito é
// judicial por lei — mais lento e mais caro, e é isso que a família enfrenta.
export const PRAZO_INVENTARIO = { extrajudicial: 6, judicial: 18 }

// Holding familiar não reduz o ITCMD (o imposto incide na transmissão das
// quotas do mesmo jeito), mas corta boa parte das custas e honorários porque
// a partilha já está desenhada em contrato social.
const DESCONTO_CUSTAS_HOLDING = 0.4

// Regime de bens e MEAÇÃO: a parte do patrimônio que já é do cônjuge e por
// isso não entra na herança nem na base do ITCMD. Meação não é herança — é a
// metade que já era dele.
//
// O detalhe que separa um estudo sério de um chute: em comunhão UNIVERSAL a
// meação alcança todo o patrimônio, e o estudo pode aplicá-la com segurança.
// Em comunhão PARCIAL ela só alcança o que foi adquirido na constância do
// casamento — o apartamento que ele já tinha antes de casar é inventariado
// inteiro. Como o formulário não pergunta quais bens são comuns, o estudo NÃO
// desconta sozinho: mostra o quanto poderia ser meação e pede a confirmação.
// Descontar por conta própria produziria um imposto menor que o real, e o
// advogado da família desmontaria a apresentação.
const MEACAO_POR_REGIME = {
  'Comunhão parcial': { pct: 0.5, certo: false },
  'Comunhão universal': { pct: 0.5, certo: true },
  'Separação total': { pct: 0, certo: true },
  'Separação obrigatória': { pct: 0, certo: true },
  'Participação final nos aquestos': { pct: 0.5, certo: false },
}

// ─── PREVIDÊNCIA: O QUE A FAMÍLIA RECEBE DE VERDADE ──────────────────────────
// VGBL e PGBL são tributados de forma diferente no resgate/benefício:
//   VGBL → IR só sobre o RENDIMENTO
//   PGBL → IR sobre o VALOR TOTAL resgatado (o aporte foi deduzido no IR)
// Na tabela regressiva, um plano antigo chega a 10%. Usamos 10% como a
// alíquota do longo prazo — é a hipótese mais favorável ao cliente, e mesmo
// assim o PGBL entrega bem menos do que o saldo que aparece no extrato.
const IR_PREVIDENCIA_LONGO_PRAZO = 0.10
// Sem saber quanto do saldo é rendimento, assumimos um terço — proporção
// conservadora para um plano de alguns anos.
const FRACAO_RENDIMENTO_PRESUMIDA = 1 / 3

// ─── ACÚMULO E APOSENTADORIA ─────────────────────────────────────────────────
// Taxa de juros REAL (acima da inflação) usada nas projeções de acúmulo e na
// comparação "investir ou proteger". 4% ao ano é conservador para o Brasil no
// longo prazo — quem quiser discutir a premissa discute UM número, aqui.
// Ela aparece escrita na tela e no slide: projeção sem premissa à vista é
// adivinhação.
export const TAXA_REAL_ANUAL = 0.04

// Taxa de retirada sustentável: quanto dá para sacar por ano de um capital
// sem consumi-lo. É a mesma taxa real — retirar o rendimento mantém o
// principal e a renda dura enquanto ele durar.
const TAXA_RETIRADA = TAXA_REAL_ANUAL

// Valor futuro de um saldo + aportes mensais, a juros reais compostos.
function valorFuturo(saldoInicial, aporteMensal, anos, taxaAnual = TAXA_REAL_ANUAL) {
  if (!(anos > 0)) return saldoInicial
  const i = (1 + taxaAnual) ** (1 / 12) - 1
  const meses = Math.round(anos * 12)
  const doSaldo = saldoInicial * (1 + i) ** meses
  const dosAportes = i > 0 ? aporteMensal * (((1 + i) ** meses - 1) / i) : aporteMensal * meses
  return doSaldo + dosAportes
}

// Aporte mensal necessário para chegar a um capital em N anos.
function aportePara(alvo, saldoInicial, anos, taxaAnual = TAXA_REAL_ANUAL) {
  if (!(anos > 0)) return null
  const i = (1 + taxaAnual) ** (1 / 12) - 1
  const meses = Math.round(anos * 12)
  const faltando = alvo - saldoInicial * (1 + i) ** meses
  if (faltando <= 0) return 0
  return i > 0 ? faltando / (((1 + i) ** meses - 1) / i) : faltando / meses
}

// Quantos anos de aporte mensal levam até um capital — a conta que responde
// "prefiro investir": o seguro entrega esse valor amanhã de manhã.
export function anosParaAcumular(alvo, aporteMensal, saldoInicial = 0, taxaAnual = TAXA_REAL_ANUAL) {
  if (!(alvo > 0) || !(aporteMensal > 0)) return null
  if (saldoInicial >= alvo) return 0
  const i = (1 + taxaAnual) ** (1 / 12) - 1
  let saldo = saldoInicial
  for (let m = 1; m <= 12 * 100; m++) {
    saldo = saldo * (1 + i) + aporteMensal
    if (saldo >= alvo) return Math.round((m / 12) * 10) / 10
  }
  return null // mais de 100 anos: a resposta é "nunca", e a tela diz isso
}

// Teto das simulações de autonomia: acima disso o padrão de vida se sustenta
// pelo resto da vida e o número deixa de significar alguma coisa.
export const MESES_VITALICIO = 1200

// Padrões de mercado das assistências (Icatu, MetLife, Prudential, Azos giram
// nesta faixa). São ponto de partida — a consultora ajusta pela cotação.
export const FUNERAL_INDIVIDUAL_PADRAO = 15_000
export const FUNERAL_FAMILIAR_PADRAO = 15_000
export const FRATURAS_TETO = 50_000
export const DIH_DIAS_PADRAO = 30
export const DIT_DIAS_PADRAO = 90
export const DIT_FRANQUIA_PADRAO = 15

// ─── TIPOS DE PLANEJAMENTO ───────────────────────────────────────────────────
// Um plano de renda familiar não é um plano de sucessão nem um acordo de
// sócios. O tipo define quais blocos o formulário mostra e quais capítulos a
// proposta apresenta.
export const TIPOS_PLANEJAMENTO = [
  { id: 'pf', rotulo: 'Pessoa física', descricao: 'Família, renda e patrimônio pessoal' },
  { id: 'pj', rotulo: 'Empresarial (PJ)', descricao: 'Sócios, homem-chave e avais' },
  { id: 'pf_pj', rotulo: 'PF + PJ', descricao: 'A vida pessoal e a empresa no mesmo estudo' },
]

// Focos: o que este cliente veio resolver. Alimentam a capa, o fechamento e a
// ordem de importância das coberturas.
export const FOCOS = [
  { id: 'renda', rotulo: 'Proteção da renda familiar',
    descricao: 'Manter o padrão de vida se a renda parar' },
  { id: 'educacao', rotulo: 'Educação dos filhos',
    descricao: 'Garantir escola e faculdade até a independência' },
  { id: 'dividas', rotulo: 'Quitação de dívidas',
    descricao: 'Financiamentos e compromissos não passam para a família' },
  { id: 'sucessao', rotulo: 'Sucessão e inventário',
    descricao: 'Liquidez imediata para o inventário não travar os bens' },
  { id: 'blindagem', rotulo: 'Blindagem patrimonial',
    descricao: 'O patrimônio construído não é consumido nem vendido às pressas' },
  { id: 'empresarial', rotulo: 'Proteção da empresa',
    descricao: 'Acordo de sócios, homem-chave e dívidas avalizadas' },
  { id: 'aposentadoria', rotulo: 'Aposentadoria e acúmulo',
    descricao: 'Previdência e formação de reserva de longo prazo' },
]

export const focoRotulo = (id) => FOCOS.find((f) => f.id === id)?.rotulo ?? id

// ─── CLASSES DE PATRIMÔNIO ───────────────────────────────────────────────────
// `inventario`: passa por inventário e ITCMD (fica travado até o imposto sair).
// `liquido`:    vira dinheiro rápido, sem vender nada e sem deságio.
export const CLASSES_PATRIMONIO = [
  { id: 'imoveis', campo: 'patrimonio_imoveis', rotulo: 'Imóveis',
    inventario: true, liquido: false, cor: '#1272a8',
    nota: 'Casa, apartamentos, terrenos, sala comercial' },
  { id: 'investimentos', campo: 'patrimonio_investimentos', rotulo: 'Investimentos',
    inventario: true, liquido: true, cor: '#3f9bd0',
    nota: 'Aplicações, ações, fundos, poupança — travam no inventário, mas não têm deságio' },
  { id: 'empresa', campo: 'patrimonio_empresa', rotulo: 'Participação em empresa',
    inventario: true, liquido: false, cor: '#77448c',
    nota: 'Quotas e ações da empresa — o ativo mais difícil de transformar em dinheiro' },
  { id: 'veiculos', campo: 'patrimonio_veiculos', rotulo: 'Veículos',
    inventario: true, liquido: false, cor: '#8f929b',
    nota: 'Carros, motos, embarcações' },
  { id: 'outros', campo: 'patrimonio_outros', rotulo: 'Outros bens',
    inventario: true, liquido: false, cor: '#b8bac0',
    nota: 'Obras, joias, participações, direitos' },
  { id: 'previdencia', campo: 'previdencia_saldo', rotulo: 'Previdência (VGBL/PGBL)',
    inventario: false, liquido: true, cor: '#0e9f6e',
    nota: 'NÃO passa por inventário: vai direto ao beneficiário indicado, como o seguro' },
]

// ─── CATÁLOGO DE COBERTURAS ──────────────────────────────────────────────────
// A apólice inteira em um lugar só. `grupo` organiza o formulário e os slides;
// `soma` diz se o capital entra na importância segurada total (diárias e
// assistências não entram — não são capital de indenização única).
export const GRUPOS_COBERTURA = [
  { id: 'essencial', rotulo: 'Proteção essencial',
    descricao: 'O capital que substitui a renda quando ela para de vez' },
  { id: 'vida', rotulo: 'Proteção em vida',
    descricao: 'As coberturas que pagam com o cliente aqui — a maior parte dos sinistros' },
  { id: 'acidentes', rotulo: 'Acidentes',
    descricao: 'O que acontece de repente, sem aviso e sem doença prévia' },
  { id: 'assistencia', rotulo: 'Assistências',
    descricao: 'Serviço acionado em horas, sem esperar a indenização' },
  { id: 'sucessao', rotulo: 'Sucessão e blindagem',
    descricao: 'Liquidez para o inventário — os bens não ficam travados' },
  { id: 'empresarial', rotulo: 'Proteção empresarial',
    descricao: 'A empresa continua e a família não vira sócia de ninguém' },
]

export const COBERTURAS = [
  // ── Essenciais ────────────────────────────────────────────────────────────
  {
    id: 'morte', campo: 'capital_sugerido', grupo: 'essencial', tipo: 'capital', soma: true,
    rotulo: 'Morte (proteção da família)', curto: 'Proteção da família',
    descricao: 'Padrão de vida garantido e dívidas quitadas se a renda faltar',
    comoCalcula: 'custo de vida × 12 × anos de proteção + dívidas (filhos contam só até os 24)',
  },
  {
    id: 'invalidez', campo: 'capital_invalidez', grupo: 'essencial', tipo: 'capital', soma: true,
    rotulo: 'Invalidez permanente (IPTA)', curto: 'Invalidez permanente', requer: '014',
    descricao: 'Se um acidente ou doença impedir de trabalhar para sempre',
    comoCalcula: 'mesmo capital da morte — a renda para exatamente do mesmo jeito',
  },
  {
    id: 'doencas_graves', campo: 'capital_doencas_graves', grupo: 'essencial', tipo: 'capital', soma: true,
    rotulo: 'Doenças graves', curto: 'Doenças graves', requer: '014',
    descricao: 'Dinheiro em vida no diagnóstico: tratamento sem tocar no patrimônio',
    comoCalcula: '24 × a renda mensal (≈ 2 anos de tratamento)',
  },
  // ── Em vida: diárias ──────────────────────────────────────────────────────
  {
    id: 'dit', campo: 'dit_diaria', grupo: 'vida', tipo: 'diaria', soma: false, requer: '014',
    campoDias: 'dit_dias', diasPadrao: DIT_DIAS_PADRAO,
    campoFranquia: 'dit_franquia_dias', franquiaPadrao: DIT_FRANQUIA_PADRAO,
    rotulo: 'Incapacidade temporária (DIT)', curto: 'Renda diária (DIT)',
    descricao: 'Renda por dia parado — essencial para autônomos e liberais',
    comoCalcula: 'renda mensal ÷ 30, por dia de afastamento',
  },
  {
    id: 'dih', campo: 'dih_diaria', grupo: 'vida', tipo: 'diaria', soma: false, requer: '019',
    campoDias: 'dih_dias', diasPadrao: DIH_DIAS_PADRAO,
    rotulo: 'Diária por internação hospitalar (DIH)', curto: 'Diária de internação',
    descricao: 'Dinheiro por dia internado — cobre o que o plano de saúde não paga',
    comoCalcula: 'renda mensal ÷ 30, por dia de internação',
  },
  // ── Acidentes ─────────────────────────────────────────────────────────────
  {
    id: 'morte_acidental', campo: 'capital_morte_acidental', grupo: 'acidentes',
    tipo: 'capital', soma: true, requer: '019',
    rotulo: 'Morte acidental (MA)', curto: 'Morte acidental',
    descricao: 'Indeniza SOMADO ao capital de morte quando a causa é um acidente',
    comoCalcula: '100% do capital de morte — dobra a proteção no cenário mais súbito',
  },
  {
    id: 'fraturas', campo: 'capital_fraturas', grupo: 'acidentes',
    tipo: 'capital', soma: true, requer: '019',
    rotulo: 'Fraturas', curto: 'Fraturas',
    descricao: 'Indenização por fratura, conforme tabela — cobre o custo imediato do acidente',
    comoCalcula: '≈ 3 meses de renda (indenização proporcional ao osso fraturado)',
  },
  // ── Assistências ──────────────────────────────────────────────────────────
  {
    id: 'funeral_individual', campo: 'funeral_individual', grupo: 'assistencia',
    tipo: 'capital', soma: false, requer: '019',
    rotulo: 'Assistência funeral — individual', curto: 'Funeral individual',
    descricao: 'Acionada por telefone, resolve tudo em horas — a família não gasta nem decide nada',
    comoCalcula: `padrão de mercado (${FUNERAL_INDIVIDUAL_PADRAO.toLocaleString('pt-BR')})`,
  },
  {
    id: 'funeral_familiar', campo: 'funeral_familiar', grupo: 'assistencia',
    tipo: 'capital', soma: false, requer: '019',
    rotulo: 'Assistência funeral — familiar', curto: 'Funeral familiar',
    descricao: 'Estende a assistência a cônjuge, filhos e, em alguns produtos, aos pais',
    comoCalcula: `padrão de mercado (${FUNERAL_FAMILIAR_PADRAO.toLocaleString('pt-BR')})`,
  },
  // ── Sucessão ──────────────────────────────────────────────────────────────
  {
    id: 'sucessao', campo: 'verba_sucessoria', grupo: 'sucessao', tipo: 'capital', soma: true, requer: '014',
    rotulo: 'Sucessão e inventário', curto: 'Sucessão e inventário',
    descricao: 'Liquidez imediata para o inventário — os bens não ficam travados',
    comoCalcula: 'patrimônio inventariável × (ITCMD + custas e honorários)',
  },
  // ── Empresarial ───────────────────────────────────────────────────────────
  {
    id: 'socios', campo: 'capital_socios', grupo: 'empresarial', tipo: 'capital', soma: true, requer: '019', pj: true,
    rotulo: 'Acordo de sócios (buy-sell)', curto: 'Acordo de sócios',
    descricao: 'Os sócios compram a quota da família à vista — ninguém vira sócio de herdeiro',
    comoCalcula: 'valuation × participação do cliente',
  },
  {
    id: 'homem_chave', campo: 'capital_homem_chave', grupo: 'empresarial', tipo: 'capital', soma: true, requer: '019', pj: true,
    rotulo: 'Homem-chave', curto: 'Homem-chave',
    descricao: 'O fôlego que a empresa precisa para se reorganizar sem quem a fazia girar',
    comoCalcula: '2 × o lucro anual da empresa',
  },
  {
    id: 'aval', campo: 'capital_aval', grupo: 'empresarial', tipo: 'capital', soma: true, requer: '019', pj: true,
    rotulo: 'Dívidas avalizadas', curto: 'Dívidas avalizadas',
    descricao: 'O aval não morre com o sócio: sem capital, ele alcança o patrimônio da família',
    comoCalcula: 'total das dívidas da empresa com aval pessoal',
  },
]

// ─── O PORQUÊ DE CADA NÚMERO ─────────────────────────────────────────────────
// `comoCalcula` explica a fórmula em abstrato ("24 × a renda mensal"). Isto
// aqui explica com os números DESTE cliente ("24 × os R$ 48 mil que ele ganha
// = R$ 1,2 mi, ≈ 2 anos de tratamento sem trabalhar"). É a diferença entre a
// consultora ler um slide e ela sustentar o número quando o cliente pergunta
// "de onde saiu isso?".
//
// Recebe o estudo já calculado. Devolve null quando não há dado que sustente
// a frase — inventar um porquê é pior do que não ter nenhum.
export function porqueCobertura(id, e) {
  if (!e) return null
  const m = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
  const v = e.valores?.[id] ?? 0
  if (!(v > 0)) return null

  switch (id) {
    case 'morte': {
      if (!(e.custoVida > 0)) return null
      const partes = [`${m(e.custoVidaBase)}/mês de padrão de vida por ${e.anos} anos`]
      if (e.capitalFilhos > 0) partes.push(`${m(e.capitalFilhos)} para os filhos até os ${IDADE_INDEPENDENCIA}`)
      if (e.dividas > 0) partes.push(`${m(e.dividas)} de dívidas quitadas`)
      return `${partes.join(', mais ')}.`
    }
    case 'invalidez':
      return e.valores.morte > 0 && v === e.valores.morte
        ? 'O mesmo capital da morte: inválido, ele para de gerar renda igual — e ainda passa a custar tratamento.'
        : 'A renda para do mesmo jeito da morte, com a diferença de que ele continua aqui para ser sustentado.'
    case 'doencas_graves':
      return e.renda > 0
        ? `24 × os ${m(e.renda)} de renda: cerca de dois anos de tratamento sem depender de trabalhar.`
        : null
    case 'dit': {
      const d = e.diariaPorId?.dit
      if (!d) return null
      return `${m(v)} por dia parado, a partir do ${(d.franquia ?? 0) + 1}º dia, até ${d.dias} diárias — ${m(d.total)} no limite.`
    }
    case 'dih': {
      const d = e.diariaPorId?.dih
      if (!d) return null
      return `${m(v)} por dia internado, até ${d.dias} diárias (${m(d.total)}) — cobre o que o plano de saúde não paga.`
    }
    case 'morte_acidental':
      return e.valores.morte > 0
        ? `Soma aos ${m(e.valores.morte)} da morte: num acidente a família recebe ${m(e.valores.morte + v)}.`
        : null
    case 'fraturas':
      return 'Indeniza por tabela conforme o osso — cobre o custo imediato do acidente sem mexer na reserva.'
    case 'funeral_individual':
      return 'Acionada por telefone e resolvida em horas: a família não gasta nem decide nada no pior dia.'
    case 'funeral_familiar':
      return 'Estende a assistência a cônjuge e filhos — e, em vários produtos, aos pais.'
    case 'sucessao': {
      if (!(e.custoInventario > 0)) return null
      const rito = e.sucessao?.inventarioJudicial ? 'judicial' : 'extrajudicial'
      const prazo = e.sucessao?.prazoInventarioMeses
      const base = `${(e.itcmd + (e.sucessao?.custasEfetivas ?? e.custas)).toFixed(1).replace('.', ',')}% de ${m(e.sucessao?.baseInventario ?? e.bensInventariaveis)}`
      const falta = e.deficitLiquidez > 0
        ? ` Hoje faltam ${m(e.deficitLiquidez)} em dinheiro para pagar isso.`
        : ''
      return `${base} — o imposto vence antes de qualquer bem ser liberado, e o inventário ${rito} leva cerca de ${prazo} meses.${falta}`
    }
    case 'socios':
      return e.pj?.valuation > 0
        ? `${e.pj.participacao}% de ${m(e.pj.valuation)}: é o que os sócios precisam ter em caixa para comprar a quota da família em vez de virar sócios dela.`
        : null
    case 'homem_chave':
      return e.pj?.lucroBase > 0
        ? `2 × ${m(e.pj.lucroBase)} de lucro anual — o fôlego para a empresa se reorganizar sem quem a fazia girar.`
        : null
    case 'aval':
      return e.pj?.dividaAval > 0
        ? `${m(e.pj.dividaAval)} de dívida com aval pessoal: morrer não cancela o aval, ele vira dívida do espólio e alcança o patrimônio da família.`
        : null
    default:
      return null
  }
}

// ─── FILHOS ──────────────────────────────────────────────────────────────────
// Normaliza a lista de filhos do planejamento (coluna jsonb `dependentes`,
// formato [{nome, idade, custo_mensal}]) e calcula, por filho, quantos anos de
// sustento faltam e o capital necessário até os 24.
export function normalizarFilhos(plano, anosProtecao) {
  const brutos = Array.isArray(plano?.dependentes) ? plano.dependentes : []
  return brutos
    .filter((f) => f && (String(f.nome ?? '').trim() !== ''
      || (f.idade !== '' && f.idade != null) || n(f.custo_mensal) > 0))
    .map((f) => {
      // idade fora de 0–120 é digitação errada, não um filho de -5 anos
      const idade = definido(f.idade) ? Math.min(Math.max(Math.round(n(f.idade)), 0), 120) : null
      const custoMensal = q(f.custo_mensal, 1e7)
      const anosRestantes = idade == null
        ? Math.max(anosProtecao ?? 0, 0)
        : Math.max(IDADE_INDEPENDENCIA - idade, 0)
      return {
        nome: String(f.nome ?? '').trim(),
        idade,
        custoMensal,
        anosRestantes,
        // o que este filho ainda vai custar até se formar — some aos 24
        capitalAte24: custoMensal * 12 * anosRestantes,
      }
    })
}

// ─── AUTONOMIA ───────────────────────────────────────────────────────────────
// Quantos meses um montante sustenta o padrão de vida ATUAL, respeitando o
// desenho real do gasto: o custo dos filhos sai da conta quando cada um faz 24.
// É a mesma curva desenhada no gráfico "Linha do tempo da proteção" — por isso
// o número do slide e o degrau do gráfico sempre batem.
function mesesSustentados(recursoLiquido, custoBaseMensal, filhos) {
  if (!(recursoLiquido > 0)) return 0
  if (!(custoBaseMensal > 0) && filhos.every((f) => f.custoMensal <= 0)) return null
  let saldo = recursoLiquido
  let m = 0
  while (m < MESES_VITALICIO) {
    const custoMes = custoBaseMensal
      + filhos.reduce((s, f) => s + (f.anosRestantes * 12 > m ? f.custoMensal : 0), 0)
    if (custoMes <= 0) return MESES_VITALICIO
    if (saldo < custoMes) break
    saldo -= custoMes
    m += 1
  }
  return m
}

// ─── O ESTUDO ────────────────────────────────────────────────────────────────
// O segundo parâmetro é opcional de propósito: quem chama sem ele (telas
// antigas, testes) continua funcionando, só sem os capítulos que dependem da
// idade. A idade não mora no planejamento — mora no cadastro do cliente.
export function calcularEstudo(plano, { dataNascimento = null, idade: idadeDada = null, hoje = new Date() } = {}) {
  if (!plano) return null

  // A proposta pública recebe só a idade (a RPC não expõe a data de
  // nascimento); as telas internas passam a data e a idade sai daqui.
  const idade = idadeEm(dataNascimento, hoje)
    ?? (Number.isFinite(Number(idadeDada)) && idadeDada > 0 && idadeDada <= 120
      ? Math.round(Number(idadeDada)) : null)
  const fumante = plano.fumante === true

  const renda = q(plano.renda_mensal)
  const custoVida = q(plano.custo_vida_mensal)
  const dividas = q(plano.dividas_total)
  const anos = inteiro(plano.anos_protecao, 10, 1, TETO_ANOS) || 10

  // ITCMD: a lei é estadual. Se a consultora digitou a alíquota, é dela que
  // vale; senão o estado do cliente decide; sem estado, o padrão nacional mais
  // comum — e a tela diz de onde veio, porque uma premissa escondida numa
  // apresentação é uma armadilha esperando o advogado da família.
  const uf = typeof plano.uf === 'string' ? plano.uf.trim().toUpperCase() : ''
  const itcmdDaUF = ITCMD_POR_UF[uf] ?? null
  const itcmdOrigem = definido(plano.itcmd_pct) ? 'consultora'
    : itcmdDaUF != null ? 'uf' : 'padrao'
  const itcmd = pctVal(plano.itcmd_pct, itcmdDaUF ?? ITCMD_PADRAO, TETO_ITCMD)
  const custas = pctVal(plano.custas_pct, 8, TETO_CUSTAS)
  // Prazo que ainda falta da dívida (financiamento imobiliário, normalmente).
  // Sem ele não dá para saber se a proteção acaba antes do financiamento.
  const prazoDividaAnos = definido(plano.dividas_prazo_anos)
    ? inteiro(plano.dividas_prazo_anos, 0, 0, TETO_ANOS) : null

  const tipo = plano.tipo_planejamento || 'pf'
  const focos = Array.isArray(plano.focos) ? plano.focos : []
  const temPJ = tipo === 'pj' || tipo === 'pf_pj'

  // Migrações são aplicadas à mão no Supabase: uma cobertura só existe no
  // estudo se a coluna dela já existe na tabela. Assim uma instalação atrasada
  // apresenta menos capítulos em vez de prometer o que não pode gravar.
  const tem014 = 'capital_invalidez' in plano
  const tem019 = 'tipo_planejamento' in plano
  const disponivel = (c) => !c.requer
    || (c.requer === '014' && tem014)
    || (c.requer === '019' && tem019)

  // ── Filhos: o gasto de hoje que DEIXA de existir quando cada um faz 24 ────
  const filhos = normalizarFilhos(plano, anos)
  const custoFilhosMensal = filhos.reduce((s, f) => s + f.custoMensal, 0)
  const capitalFilhos = filhos.reduce((s, f) => s + f.capitalAte24, 0)
  // O custo de vida informado JÁ inclui os filhos: separamos para não projetar
  // o gasto deles pelo horizonte inteiro do estudo.
  const custoVidaBase = Math.max(custoVida - custoFilhosMensal, 0)

  // ── Raio-X do patrimônio ──────────────────────────────────────────────────
  // Cada classe se comporta de um jeito no inventário e na hora de virar
  // dinheiro. Quem só tem o total antigo preenchido continua funcionando: as
  // classes ficam vazias e o estudo cai no patrimonio_total.
  const classes = CLASSES_PATRIMONIO.map((c) => ({ ...c, valor: q(plano[c.campo]) }))
  const totalDeclarado = q(plano.patrimonio_total)
  const previdencia = q(plano.previdencia_saldo)

  // "Detalhado" depende só das classes de BENS. A previdência é um campo à
  // parte (e o mais fácil de preencher primeiro): se ela sozinha ligasse o
  // modo detalhado, o estudo passaria a ignorar o patrimonio_total e o
  // patrimônio de quem só informou o saldo do VGBL despencaria.
  const somaBens = classes.filter((c) => c.inventario).reduce((s, c) => s + c.valor, 0)
  const detalhado = somaBens > 0

  // Bens que entram no inventário (tudo menos a previdência)
  const bensInventariaveis = detalhado ? somaBens : totalDeclarado
  const patrimonioBruto = bensInventariaveis + previdencia
  const patrimonioLiquido = patrimonioBruto - dividas

  // O que vira dinheiro rápido — e o que só vira vendendo
  const investimentos = q(plano.patrimonio_investimentos)
  const bensIliquidos = detalhado
    ? classes.filter((c) => c.inventario && !c.liquido).reduce((s, c) => s + c.valor, 0)
    : Math.max(totalDeclarado - investimentos, 0)
  // Sem a composição por classe não dá para afirmar o que é líquido: quem só
  // informou o total não vira "100% ilíquido" na apresentação.
  const pctIliquido = detalhado && patrimonioBruto > 0
    ? Math.round((bensIliquidos / patrimonioBruto) * 100) : null

  // ── Sucessão: meação, holding e o rito do inventário ──────────────────────
  // MEAÇÃO. Em comunhão de bens, metade do patrimônio do casal já é do cônjuge
  // — não é herança e não paga ITCMD. Cobrar imposto sobre o patrimônio
  // inteiro superdimensiona a verba sucessória e desmonta na frente de um
  // cliente que conversou com o advogado.
  const casado = ['Casado(a)', 'União estável'].includes(plano.estado_civil)
  const regra = (casado && MEACAO_POR_REGIME[plano.regime_bens]) || { pct: 0, certo: true }
  // Só descontamos o que é certo (comunhão universal). O resto vira um número
  // a confirmar, exibido como possibilidade e não como fato.
  const meacao = regra.certo ? bensInventariaveis * regra.pct : 0
  const meacaoPotencial = regra.certo ? 0 : bensInventariaveis * regra.pct
  const pctMeacao = regra.certo ? regra.pct : 0
  // A base do ITCMD é o que efetivamente se transmite
  const baseInventario = bensInventariaveis - meacao

  // HOLDING familiar: não mexe no ITCMD, corta parte das custas e honorários.
  const temHolding = plano.tem_holding === true
  const custasEfetivas = temHolding ? custas * (1 - DESCONTO_CUSTAS_HOLDING) : custas

  // RITO: herdeiro menor obriga inventário judicial — mais lento e mais caro.
  const herdeirosMenores = plano.herdeiros_menores === true
    || filhos.some((f) => f.idade != null && f.idade < 18)
  const inventarioJudicial = herdeirosMenores
  const prazoInventarioMeses = inventarioJudicial
    ? PRAZO_INVENTARIO.judicial : PRAZO_INVENTARIO.extrajudicial

  // Inventário: a base é só o que passa por ele, já descontada a meação.
  // Previdência e seguro ficam fora — esse é o ponto que a maioria dos
  // clientes nunca ouviu.
  const impostoECustas = baseInventario * (itcmd + custasEfetivas) / 100

  // O QUE CUSTA ESPERAR. O ITCMD é só a entrada. Enquanto o processo corre, os
  // bens travados continuam cobrando: IPTU e condomínio do imóvel que ninguém
  // pode vender, IPVA do carro na garagem, contador da empresa parada. A
  // família paga isso do próprio bolso, todo mês, sem acesso a nada.
  const custoSustentacaoInventario = bensIliquidos > 0
    ? bensIliquidos * CUSTO_ANUAL_MANUTENCAO_BENS * (prazoInventarioMeses / 12)
    : 0
  // A conta cheia do inventário: o que se paga para destravar E o que se paga
  // enquanto não destrava.
  const custoInventario = impostoECustas + custoSustentacaoInventario
  const coberturaAtual = q(plano.cobertura_atual)

  // ── Previdência: saldo do extrato x o que a família recebe ────────────────
  // PGBL é tributado sobre o total; VGBL só sobre o rendimento. O extrato
  // mostra o bruto e ninguém faz essa conta antes da hora.
  const previdenciaTipo = ['VGBL', 'PGBL', 'Ambos'].includes(plano.previdencia_tipo)
    ? plano.previdencia_tipo : null
  const previdenciaAporte = q(plano.previdencia_aporte_mensal, 1e7)
  const baseIRPrevidencia = previdenciaTipo === 'PGBL' ? 1
    : previdenciaTipo === 'Ambos' ? (1 + FRACAO_RENDIMENTO_PRESUMIDA) / 2
      : previdenciaTipo === 'VGBL' ? FRACAO_RENDIMENTO_PRESUMIDA : 0
  const irPrevidencia = previdencia * baseIRPrevidencia * IR_PREVIDENCIA_LONGO_PRAZO
  const previdenciaLiquida = previdencia - irPrevidencia

  // Recursos que a família acessa em DIAS, sem alvará e sem inventário — e é o
  // valor LÍQUIDO que paga conta, não o do extrato.
  //
  // UM REAL SÓ NÃO FAZ DUAS COISAS. A apólice que o cliente já tem entra no
  // estudo abatendo o capital de morte (é dinheiro para a família viver). Se
  // ela aparecesse INTEIRA aqui de novo, o estudo estaria prometendo o mesmo
  // dinheiro duas vezes: sustentando a família e pagando o ITCMD. Só a sobra
  // acima do que a família precisa para viver é que serve de liquidez
  // sucessória — e essa conta só fecha depois que o capital de morte existe,
  // por isso ela é refeita mais abaixo (`sucessaoFinal`).
  const liquidezBruta = previdenciaLiquida + coberturaAtual
  const patrimonioTravado = bensInventariaveis

  // ── QUEM DEPENDE DESSA RENDA ──────────────────────────────────────────────
  // A pergunta que decide o estudo inteiro, e que o motor não fazia: existe
  // alguém que perde o padrão de vida se essa renda parar?
  //
  // Se ninguém depende — solteiro sem filhos, viúvo com filhos já formados —
  // então NÃO HÁ RENDA A SUBSTITUIR. Projetar dez anos de custo de vida nesse
  // caso é vender proteção contra um risco que não existe: ele infla o prêmio,
  // e o cliente que faz a conta de cabeça percebe. O que sobra de real para
  // essas pessoas é outra coisa, e é bem concreta: a dívida que não pode virar
  // herança, o inventário que trava os bens e o dinheiro em vida das doenças
  // graves e da invalidez — os riscos de quem vai continuar aqui.
  //
  // "Depende" aqui é literal: filho até os 24, ou cônjuge, ou dependente
  // declarado. O estado civil sozinho não basta (um casal sem filhos com duas
  // rendas altas é outra conversa, e o aviso do estudo diz isso).
  const filhosDependentes = filhos.filter(
    (f) => f.idade == null || f.idade < IDADE_INDEPENDENCIA)
  const temConjuge = ['Casado(a)', 'União estável'].includes(plano.estado_civil)
  const outrosDependentes = inteiro(plano.num_dependentes, 0, 0, 30)
  const temDependentes = filhosDependentes.length > 0 || temConjuge || outrosDependentes > 0

  // ── Capital de morte ──────────────────────────────────────────────────────
  // Com dependentes: o padrão de vida da família pelos anos de proteção, mais
  // o que cada filho ainda vai custar até se formar, mais as dívidas.
  const capitalReposicaoRenda = custoFilhosMensal > 0
    ? custoVidaBase * 12 * anos + capitalFilhos
    : custoVida * 12 * anos
  // Sem dependentes: não há padrão de vida de terceiro a manter. Sobra o que a
  // morte dele efetivamente cria de conta para alguém: a dívida, que não morre
  // com o devedor — vai para o espólio e come a herança antes de qualquer
  // herdeiro receber. O inventário também custa, mas ele tem cobertura própria
  // no estudo (verba sucessória); somá-lo aqui seria cobrar duas vezes.
  const capitalMorteSugerido = temDependentes ? capitalReposicaoRenda + dividas : dividas

  // INVALIDEZ NÃO É MORTE. O motor sugeria o mesmo capital para as duas, e para
  // quem tem família isso está certo — a renda para igual. Mas para quem NÃO
  // tem dependentes a diferença é enorme: se ele morre, ninguém fica sem nada;
  // se ele fica inválido, ele mesmo precisa viver o resto da vida sem trabalhar,
  // e ainda com o custo do tratamento. Para o solteiro, invalidez é a maior
  // exposição que existe — e era justamente a que o estudo zerava junto.
  // Num estudo PJ puro a renda pessoal nem foi levantada, então não há o que
  // repor. Mas o risco de invalidez existe e é o mais esquecido da mesa: o
  // banco executa o aval na invalidez do avalista exatamente como na morte —
  // não espera o óbito — e a empresa perde quem a fazia girar do mesmo jeito.
  // Deixar a invalidez fora do estudo empresarial cobre metade do risco e
  // cobra o prêmio inteiro.
  const capitalInvalidezSugerido = tipo === 'pj'
    ? q(plano.pj_divida_avalizada)
    : custoVida * 12 * anos + dividas

  // ── Bloco empresarial ─────────────────────────────────────────────────────
  const pjValuation = q(plano.pj_valuation)
  const pjParticipacao = pctVal(plano.pj_participacao_pct, 0)
  const pjLucro = q(plano.pj_lucro_anual)
  const pjFaturamento = q(plano.pj_faturamento_anual)
  const pjDividaAval = q(plano.pj_divida_avalizada)
  const pjNumSocios = inteiro(plano.pj_num_socios, 0, 0, 999)
  const pjQuota = pjValuation * pjParticipacao / 100
  // Sem lucro informado, estimamos a margem em 20% do faturamento — é a conta
  // que a consultora refaz com o contador, mas já dá o tamanho da conversa.
  const pjLucroBase = pjLucro > 0 ? pjLucro : pjFaturamento * 0.2

  // ── Sugestões de cada cobertura ───────────────────────────────────────────
  // Toda sugestão passa pelo teto do que o mercado emite. Um número que a
  // seguradora recusa não ajuda ninguém: a consultora apresenta, o cliente se
  // acostuma, e a cotação volta menor — o pior momento possível para reduzir
  // uma proposta. Quando o teto morde, o estudo registra em `limitados` e a
  // tela avisa; a consultora continua livre para digitar o que for aprovado.
  const limitados = []
  const limitar = (id, valor, teto, nota) => {
    if (!(valor > teto)) return valor
    limitados.push({ id, pedido: valor, teto, nota })
    return teto
  }

  // Doenças graves: 24 × a renda é a régua certa (dois anos de tratamento sem
  // trabalhar), mas ela precisa caber em dois limites — o teto de emissão e o
  // próprio capital de morte, porque nenhuma seguradora cobre mais o adoecer
  // do que o morrer.
  const dgPelaRenda = renda * 24
  const tetoDG = Math.min(
    LIMITES_MERCADO.doencas_graves,
    capitalMorteSugerido > 0 ? capitalMorteSugerido * DG_TETO_SOBRE_MORTE : Infinity)
  const diariaPelaRenda = renda > 0 ? Math.round(renda / 30) : 0

  const sugestoes = {
    morte: limitar('morte', capitalMorteSugerido, LIMITES_MERCADO.morte,
      'acima deste valor o caso vai a resseguro facultativo'),
    invalidez: limitar('invalidez', capitalInvalidezSugerido, LIMITES_MERCADO.invalidez,
      'acima deste valor o caso vai a resseguro facultativo'),
    doencas_graves: limitar('doencas_graves', dgPelaRenda, tetoDG,
      dgPelaRenda > LIMITES_MERCADO.doencas_graves
        ? 'teto de emissão do mercado para doenças graves'
        : 'doenças graves não passa do capital de morte'),
    dit: limitar('dit', diariaPelaRenda, LIMITES_MERCADO.diaria_dit,
      'teto de diária por incapacidade praticado no mercado'),
    dih: limitar('dih', diariaPelaRenda, LIMITES_MERCADO.diaria_dih,
      'teto de diária de internação praticado no mercado'),
    morte_acidental: limitar('morte_acidental', capitalMorteSugerido, LIMITES_MERCADO.morte,
      'acima deste valor o caso vai a resseguro facultativo'),
    // fraturas indenizam por tabela: o mercado trabalha entre R$ 10 mil e
    // R$ 50 mil, então a sugestão acompanha a renda mas respeita esse teto
    fraturas: renda > 0 ? Math.min(Math.round((renda * 3) / 1000) * 1000, FRATURAS_TETO) : 0,
    // As assistências têm valor fixo de mercado. Só entram quando o estudo já
    // tem substância — senão um planejamento em branco nasceria anunciando
    // duas coberturas que ninguém levantou.
    funeral_individual: capitalMorteSugerido > 0 || renda > 0 ? FUNERAL_INDIVIDUAL_PADRAO : 0,
    funeral_familiar: capitalMorteSugerido > 0 || renda > 0 ? FUNERAL_FAMILIAR_PADRAO : 0,
    sucessao: custoInventario,
    // BUY-SELL PRECISA DE DOIS. O acordo de sócios funciona por apólice
    // cruzada: cada sócio segura o outro para poder comprar a quota da família
    // dele à vista. Sócio único não tem com quem cruzar — sugerir o capital
    // aqui é apresentar uma cobertura que não tem contraparte, e a primeira
    // pergunta do cliente ("quem compraria?") não tem resposta. Para ele o
    // capital certo é homem-chave e liquidez sucessória, que o estudo já traz.
    socios: pjNumSocios >= 2 ? pjQuota : 0,
    homem_chave: pjLucroBase * 2,
    aval: pjDividaAval,
  }

  // ── Valores contratados: o que a consultora definiu, ou a sugestão ────────
  const valores = {}
  for (const c of COBERTURAS) {
    valores[c.id] = definido(plano[c.campo]) ? q(plano[c.campo]) : q(sugestoes[c.id])
  }

  // Diárias: limite de dias e o total potencial em dinheiro (o que a cobertura
  // vale de verdade quando o pior acontece)
  const diarias = COBERTURAS.filter((c) => c.tipo === 'diaria').filter(disponivel).map((c) => {
    const dias = inteiro(plano[c.campoDias], c.diasPadrao, 1, TETO_DIAS)
    const franquia = c.campoFranquia
      ? inteiro(plano[c.campoFranquia], c.franquiaPadrao, 0, 365)
      : null
    return { id: c.id, valor: valores[c.id], dias, franquia, total: valores[c.id] * dias }
  })
  const diariaPorId = Object.fromEntries(diarias.map((d) => [d.id, d]))

  // Coberturas ativas (valor > 0), na ordem do catálogo — é a lista que
  // alimenta o quadro da apólice na tela e no slide.
  const ativas = COBERTURAS
    .filter(disponivel)
    .filter((c) => valores[c.id] > 0)
    .filter((c) => !c.pj || temPJ)
    // Estudo "Empresarial (PJ)" é sobre a empresa. Trazer morte, DIT e funeral
    // calculados sobre uma renda pessoal que a consultora nem levantou naquela
    // reunião polui a proposta e abre uma pergunta que ela não tem como
    // responder. Quem quer os dois lados escolhe "PF + PJ" — está lá para isso.
    // A invalidez é a exceção: ela é o risco empresarial que ninguém lembra
    // (o aval é executado com o sócio vivo e inválido), e por isso continua no
    // estudo PJ, dimensionada pela dívida avalizada.
    .filter((c) => tipo !== 'pj' || c.pj || c.id === 'invalidez')
    .map((c) => ({
      ...c,
      valor: valores[c.id],
      sugestao: sugestoes[c.id] ?? 0,
      ...(c.tipo === 'diaria' ? diariaPorId[c.id] : {}),
    }))

  // Importância segurada total: só capitais de indenização única. Diárias e
  // assistências ficam de fora para o número não inflar — é o mesmo total
  // usado no slide do investimento e na alavancagem.
  const capitalTotal = ativas.filter((c) => c.soma).reduce((s, c) => s + c.valor, 0)
  const capitalPF = ativas.filter((c) => c.soma && !c.pj).reduce((s, c) => s + c.valor, 0)
  const capitalPJ = ativas.filter((c) => c.soma && c.pj).reduce((s, c) => s + c.valor, 0)
  const totalDiarias = diarias.reduce((s, d) => s + d.total, 0)

  // Quanto a família recebe DE VERDADE em um único acontecimento. A soma das
  // importâncias é a amplitude da apólice, mas morte e invalidez nunca pagam
  // juntas — e um cliente atento pergunta isso na reunião. Ter os cenários
  // calculados é o que sustenta a resposta.
  // Só capitais que entram na importância segurada: as assistências são
  // serviço, não indenização, e somá-las aqui faria o "maior cenário" passar
  // do total contratado — que é justamente o número que ele deve respeitar.
  const soma = (ids) => ids.reduce((s, id) => {
    const c = ativas.find((a) => a.id === id && a.soma)
    return s + (c ? c.valor : 0)
  }, 0)
  const cenarios = {
    morte: soma(['morte', 'sucessao', 'socios', 'homem_chave', 'aval']),
    morteAcidental: soma(['morte', 'morte_acidental', 'sucessao', 'socios', 'homem_chave', 'aval']),
    invalidez: soma(['invalidez', 'aval']),
    doencaGrave: soma(['doencas_graves']),
  }
  const capitalMaximoEvento = Math.max(...Object.values(cenarios))

  // ── LIQUIDEZ SUCESSÓRIA: sem contar o mesmo dinheiro duas vezes ───────────
  // A apólice que o cliente já tem é a primeira coisa que a família usa para
  // viver — é para isso que ela existe, e é assim que o estudo a trata quando
  // abate o gap de morte. Portanto ela NÃO está disponível para pagar o ITCMD:
  // só a sobra acima do capital que a família precisa é que serve de liquidez
  // sucessória. Antes desta conta, o estudo prometia o mesmo dinheiro nas duas
  // pontas e o déficit de liquidez saía menor do que é.
  const coberturaLivreParaSucessao = Math.max(coberturaAtual - valores.morte, 0)
  const liquidezSucessoria = previdenciaLiquida + coberturaLivreParaSucessao
  const deficitLiquidez = Math.max(custoInventario - liquidezSucessoria, 0)
  // As telas de sucessão ("chega em dias", "tem disponível") mostram ESTE
  // número, não o bruto: é o que sobra de verdade para o inventário depois de
  // reservado o que a família precisa para viver.
  const liquidezImediata = liquidezSucessoria
  // Quanto da previdência o inventário consome: é ela que sobra na mesa quando
  // não há verba sucessória, e a família não percebe que está gastando a
  // própria reserva para destravar os bens.
  const previdenciaConsumidaNoInventario = valores.sucessao > 0
    ? 0 : Math.min(previdenciaLiquida, custoInventario)

  // ── Autonomia: a pergunta que abre os olhos ───────────────────────────────
  // Hoje, sem o plano, a família vive do que é líquido (investimentos +
  // previdência + seguro que já existe), depois começa a vender bens.
  // Previdência entra pelo LÍQUIDO: é o que a família saca de fato.
  const recursosLiquidos = investimentos + previdenciaLiquida
  // E o inventário cobra ANTES. O imposto vence em meses, à vista, e sai
  // justamente do dinheiro líquido — que era o mesmo que ia sustentar a casa.
  // Descontar aqui não é pessimismo: é a ordem em que as contas chegam.
  const custoInventarioNaoCoberto = Math.max(custoInventario - valores.sucessao, 0)
  // Sem a composição por classe não dá para separar o líquido do ilíquido:
  // devolvemos null em vez de "0 meses", que seria uma afirmação que o estudo
  // não pode sustentar. A apresentação então mostra dois cenários em vez de três.
  const mesesLiquidos = detalhado
    ? mesesSustentados(
      recursosLiquidos + coberturaAtual - dividas - custoInventarioNaoCoberto,
      custoVidaBase, filhos)
    : null
  // Vendendo tudo que foi construído — inclusive a casa
  const mesesVendendoTudo = mesesSustentados(
    patrimonioBruto + coberturaAtual - dividas - custoInventarioNaoCoberto,
    custoVidaBase, filhos)
  // Com o plano: o capital do seguro chega em dias e o patrimônio fica intacto.
  // (valores.morte já embute o que a cobertura atual cobre, então ela não entra
  // de novo aqui — seria contar duas vezes.)
  const mesesComPlano = mesesSustentados(
    (detalhado ? recursosLiquidos : patrimonioBruto) + valores.morte - dividas,
    custoVidaBase, filhos)
  // Só o capital do seguro, isolado — usado no slide "o número"
  const mesesProtegidos = mesesSustentados(valores.morte - dividas, custoVidaBase, filhos)

  // Compatibilidade com telas antigas
  const autonomiaAtualMeses = mesesVendendoTudo

  // Fôlego financeiro mensal e comprometimento da renda
  const poupancaMensal = renda > 0 ? renda - custoVida : null
  const comprometimentoRenda = renda > 0 ? Math.round((custoVida / renda) * 100) : null

  // Gap: o que falta para o plano estar de pé
  const gap = Math.max(valores.morte - coberturaAtual, 0)
  // Gap real: considera também o que a família já tem de liquidez própria
  const gapReal = Math.max(valores.morte - coberturaAtual - recursosLiquidos, 0)

  // Horizonte sugerido pelos filhos: proteger até o mais novo completar 24.
  let anosSugeridosPorFilhos = null
  {
    const idades = filhos.length > 0
      ? filhos.map((f) => f.idade).filter((i) => i != null)
      : String(plano.filhos_idades ?? '').match(/\d+/g)?.map(Number) ?? []
    if (idades.length > 0) {
      const maisNovo = Math.min(...idades)
      if (maisNovo >= 0 && maisNovo < IDADE_INDEPENDENCIA) {
        anosSugeridosPorFilhos = IDADE_INDEPENDENCIA - maisNovo
      }
    }
  }

  // ── A janela real de proteção ─────────────────────────────────────────────
  // "Anos de proteção" não é um número escolhido no chute: é o tempo até a
  // família parar de depender daquela renda. Dois relógios correm juntos —
  // o filho mais novo virando adulto e o titular chegando à aposentadoria —
  // e a proteção precisa cobrir o mais longo dos dois.
  const idadeAposentar = inteiro(plano.idade_aposentadoria, 65, 40, 90)
  const anosAteAposentar = idade != null ? Math.max(idadeAposentar - idade, 0) : null
  const janelaProtecao = (() => {
    const motivos = []
    let sugerido = null
    if (anosSugeridosPorFilhos != null) {
      sugerido = anosSugeridosPorFilhos
      motivos.push(`o filho mais novo faz ${IDADE_INDEPENDENCIA} em ${anosSugeridosPorFilhos} ano(s)`)
    }
    if (anosAteAposentar != null && anosAteAposentar > 0) {
      if (sugerido == null || anosAteAposentar > sugerido) sugerido = anosAteAposentar
      motivos.push(`faltam ${anosAteAposentar} ano(s) para os ${idadeAposentar}`)
    }
    if (sugerido == null) return null
    return {
      anos: Math.min(sugerido, TETO_ANOS),
      motivo: motivos.join(' e '),
      // a consultora digitou menos do que a família precisa?
      curto: anos < sugerido,
    }
  })()

  // ── O investimento: mensal E anual, o cliente escolhe ─────────────────────
  const premioMensal = q(plano.premio_estimado, 1e7)
  const premioAnualCotado = q(plano.premio_anual, 1e8)
  const formaPagamento = plano.forma_pagamento === 'anual' ? 'anual' : 'mensal'
  const investimento = premioMensal > 0 || premioAnualCotado > 0 ? (() => {
    // Uma das duas formas basta: a outra se deduz (12× o mensal, sem desconto).
    // O desconto à vista só existe quando as DUAS foram cotadas — deduzir o
    // mensal a partir do anual e comparar de volta produzia uma "economia" de
    // centavos, vinda só do arredondamento, e um selo de "0% de desconto" na
    // proposta que o cliente vê.
    const cotouAmbos = premioMensal > 0 && premioAnualCotado > 0
    const mensal = premioMensal > 0 ? premioMensal : Math.round((premioAnualCotado / 12) * 100) / 100
    const doze = premioMensal > 0 ? premioMensal * 12 : premioAnualCotado
    const anual = premioAnualCotado > 0 ? premioAnualCotado : doze
    // Um real de diferença não é desconto: é arredondamento de cotação.
    const economiaBruta = cotouAmbos ? doze - anual : 0
    const economiaAnual = economiaBruta >= 1 ? economiaBruta : 0
    const pctBruto = doze > 0 && economiaAnual > 0
      ? Math.round((economiaAnual / doze) * 1000) / 10 : 0
    // abaixo de 0,1% o selo sairia como "0% de desconto"
    const descontoPct = pctBruto >= 0.1 ? pctBruto : null
    const custoAnualEfetivo = formaPagamento === 'anual' ? anual : doze
    return {
      mensal,
      anual,
      // quanto o plano anual custa "por mês" — a comparação justa
      mensalEquivalente: Math.round((anual / 12) * 100) / 100,
      doze,
      economiaAnual,
      descontoPct,
      temDescontoAnual: economiaAnual > 0,
      formaPagamento,
      diario: Math.round((custoAnualEfetivo / 365) * 100) / 100,
      pctRenda: renda > 0 ? Math.round((custoAnualEfetivo / 12 / renda) * 1000) / 10 : null,
      // Cada R$ 1 de prêmio mensal protege R$ N. Usa o maior cenário de
      // indenização, não a soma das importâncias: é o número que resiste à
      // pergunta "mas morte e invalidez pagam juntas?".
      alavancagem: mensal > 0 && capitalMaximoEvento > 0
        ? Math.round(capitalMaximoEvento / mensal) : null,
    }
  })() : null

  // ── O preço da espera ─────────────────────────────────────────────────────
  // ESTIMATIVA, nunca cotação: o índice de prêmio por idade dimensiona quanto
  // a mesma apólice custaria se a decisão ficasse para depois. É a resposta
  // concreta ao "depois eu contrato", e o argumento de que a saúde de hoje é o
  // melhor ativo dele na análise — porque ela não volta. O campo `estimativa`
  // existe para a tela nunca esquecer de dizer que é estimativa.
  const custoDaEspera = (() => {
    const mensalHoje = investimento?.mensal ?? 0
    if (idade == null || !(mensalHoje > 0)) return null
    const indiceHoje = indicePremioIdade(idade, { fumante })
    if (!(indiceHoje > 0)) return null
    const cenarios = [1, 3, 5]
      .filter((d) => idade + d <= IDADE_LIMITE_PRODUTO)
      .map((daquiAAnos) => {
        const indice = indicePremioIdade(idade + daquiAAnos, { fumante })
        const mensal = Math.round(mensalHoje * (indice / indiceHoje) * 100) / 100
        return {
          daquiAAnos,
          idadeNaEpoca: idade + daquiAAnos,
          mensal,
          aMaisPorMes: Math.round((mensal - mensalHoje) * 100) / 100,
          aMaisPct: Math.round(((mensal / mensalHoje) - 1) * 1000) / 10,
          // o que a espera custa por ANO, para sempre, enquanto a apólice viver
          aMaisPorAno: Math.round((mensal - mensalHoje) * 12 * 100) / 100,
        }
      })
      .filter((c) => c.aMaisPorMes > 0)
    if (cenarios.length === 0) return null
    return { idade, fumante, mensalHoje, cenarios, estimativa: true }
  })()

  // ── Aposentadoria e acúmulo ───────────────────────────────────────────────
  // O foco "aposentadoria" existia na lista e não tinha cálculo nenhum atrás.
  // Aqui ele vira pilar: a meta, o que a previdência atual entrega já líquida
  // de IR, e a lacuna. O elo que fecha a conversa está no fim: sem invalidez
  // coberta, o plano de acúmulo para junto com a renda — porque o aporte sai
  // da renda, e ela é que parou.
  const rendaAposentadoria = q(plano.renda_desejada_aposentadoria, 1e7)
  const aposentadoria = (() => {
    const querAposentadoria = focos.includes('aposentadoria')
    if (!querAposentadoria && !(rendaAposentadoria > 0)) return null
    if (anosAteAposentar == null) return null

    // Meta padrão: manter o padrão de vida atual, se ele não disse outro valor
    const alvoMensal = rendaAposentadoria > 0 ? rendaAposentadoria : custoVida
    if (!(alvoMensal > 0)) return null

    // Capital que sustenta essa renda pela retirada do rendimento real
    const capitalNecessario = (alvoMensal * 12) / TAXA_RETIRADA
    // O que a previdência de hoje entrega lá na frente, já sem o IR
    const projetadoBruto = valorFuturo(previdencia, previdenciaAporte, anosAteAposentar)
    const projetadoLiquido = projetadoBruto * (1 - baseIRPrevidencia * IR_PREVIDENCIA_LONGO_PRAZO)
    const lacuna = Math.max(capitalNecessario - projetadoLiquido, 0)
    const aporteNecessario = aportePara(capitalNecessario, previdenciaLiquida, anosAteAposentar)

    return {
      alvoMensal,
      idadeAlvo: idadeAposentar,
      anos: anosAteAposentar,
      taxaReal: TAXA_REAL_ANUAL,
      capitalNecessario,
      projetadoBruto,
      projetadoLiquido,
      lacuna,
      // renda mensal que a previdência projetada sustenta de verdade
      rendaProjetada: (projetadoLiquido * TAXA_RETIRADA) / 12,
      aporteNecessario: aporteNecessario == null ? null : Math.round(aporteNecessario),
      aporteAtual: previdenciaAporte,
      faltaAportar: aporteNecessario == null ? null
        : Math.max(Math.round(aporteNecessario - previdenciaAporte), 0),
      // O acúmulo depende da renda continuar existindo: é aqui que o pilar de
      // proteção e o de aposentadoria se encontram.
      dependeDaRenda: previdenciaAporte > 0 && renda > 0,
      cobreInvalidez: valores.invalidez > 0,
    }
  })()

  // ── Investir ou proteger: quantos anos de aporte levariam até o capital ───
  // Responde a "prefiro investir" sem brigar com a ideia — mostrando o prazo.
  const acumularEmVezDeSegurar = (() => {
    const alvo = valores.morte
    const aporte = investimento?.mensal ?? 0
    if (!(alvo > 0) || !(aporte > 0)) return null
    const anosAcumulando = anosParaAcumular(alvo, aporte, recursosLiquidos)
    return {
      alvo,
      aporteMensal: aporte,
      partindoDe: recursosLiquidos,
      taxaReal: TAXA_REAL_ANUAL,
      // null = nem em 100 anos; a tela escreve isso em vez de um número
      anos: anosAcumulando,
      // o seguro entrega o valor cheio já no primeiro mês
      mesesAteOSeguroValer: 1,
    }
  })()

  // ── Completude do estudo ──────────────────────────────────────────────────
  const camposChave = [
    ['renda_mensal', renda > 0],
    ['custo_vida_mensal', custoVida > 0],
    ['patrimonio', patrimonioBruto > 0],
    ['composicao_patrimonio', detalhado],
    ['familia', filhos.length > 0 || n(plano.num_dependentes) > 0 || !!plano.estado_civil],
    ['objetivos', !!String(plano.objetivos ?? '').trim() || focos.length > 0],
    ['cobertura_atual', definido(plano.cobertura_atual)],
    ['coberturas', ativas.length >= 3],
    ['premio', premioMensal > 0 || premioAnualCotado > 0],
    ...(temPJ ? [['empresa', pjValuation > 0 || pjFaturamento > 0]] : []),
  ]
  const completude = {
    feitos: camposChave.filter(([, ok]) => ok).length,
    total: camposChave.length,
    faltando: camposChave.filter(([, ok]) => !ok).map(([campo]) => campo),
  }

  // ── Consistência: os erros de número, pegos antes da reunião ──────────────
  // Cada item é um aviso acionável. É o que impede a apresentação de mostrar
  // um número que não fecha na frente do cliente.
  const inconsistencias = []
  if (renda > 0 && custoVida > renda) {
    inconsistencias.push({
      grave: true,
      texto: `O custo de vida (${custoVida.toLocaleString('pt-BR')}) está maior que a renda (${renda.toLocaleString('pt-BR')}) — confira os valores com o cliente.`,
    })
  }
  if (custoFilhosMensal > custoVida && custoVida > 0) {
    inconsistencias.push({
      grave: true,
      texto: 'A soma do gasto com os filhos passou do custo de vida total. O custo de vida deve INCLUIR os filhos.',
    })
  }
  if (detalhado && totalDeclarado > 0 && Math.abs(somaBens - totalDeclarado) > 1) {
    inconsistencias.push({
      grave: false, corrigir: 'patrimonio_total', valor: bensInventariaveis,
      texto: `O patrimônio total (${totalDeclarado.toLocaleString('pt-BR')}) não bate com a soma das classes (${bensInventariaveis.toLocaleString('pt-BR')}, sem previdência).`,
    })
  }
  if (dividas > patrimonioBruto && dividas > 0 && patrimonioBruto > 0) {
    inconsistencias.push({
      grave: false,
      texto: 'As dívidas superam o patrimônio — o patrimônio líquido está negativo. Vale confirmar os saldos.',
    })
  }
  if (definido(plano.capital_sugerido) && capitalMorteSugerido > 0) {
    const desvio = Math.abs(n(plano.capital_sugerido) - capitalMorteSugerido) / capitalMorteSugerido
    if (desvio > 0.5) {
      inconsistencias.push({
        grave: false, corrigir: 'capital_sugerido', valor: Math.round(capitalMorteSugerido),
        texto: 'O capital de morte definido está mais de 50% distante do que o estudo calcula — confira se ainda faz sentido.',
      })
    }
  }
  if (premioAnualCotado > 0 && premioMensal > 0 && premioAnualCotado > premioMensal * 12) {
    inconsistencias.push({
      grave: true,
      texto: 'O prêmio anual está maior que 12× o mensal — normalmente o anual tem desconto. Confira a cotação.',
    })
  }
  if (pjParticipacao > 100) {
    inconsistencias.push({ grave: true, texto: 'A participação societária passou de 100%.' })
  }
  if (meacaoPotencial > 0) {
    inconsistencias.push({
      grave: false,
      texto: `Regime de ${String(plano.regime_bens).toLowerCase()}: até ${Math.round(meacaoPotencial).toLocaleString('pt-BR')} podem ser meação do cônjuge e ficar fora do ITCMD — mas só os bens adquiridos durante o casamento. Confirme quais são antes de apresentar; o estudo está calculando o imposto sobre o patrimônio inteiro.`,
    })
  }
  if (temPJ && pjValuation > 0 && detalhado && n(plano.patrimonio_empresa) === 0) {
    inconsistencias.push({
      grave: false, corrigir: 'patrimonio_empresa', valor: Math.round(pjQuota),
      texto: 'A participação na empresa não está no patrimônio — o inventário vai cobrar ITCMD sobre ela.',
    })
  }

  // ── Conferências que só existem com a idade e a apólice montada ───────────
  // O horizonte acaba antes de o filho mais novo virar adulto: a família fica
  // descoberta justamente nos anos em que ainda depende da renda.
  if (janelaProtecao?.curto && anosSugeridosPorFilhos != null && anos < anosSugeridosPorFilhos) {
    inconsistencias.push({
      grave: true, corrigir: 'anos_protecao', valor: anosSugeridosPorFilhos,
      texto: `A proteção acaba em ${anos} anos, mas o filho mais novo só completa ${IDADE_INDEPENDENCIA} daqui a ${anosSugeridosPorFilhos} — sobram ${anosSugeridosPorFilhos - anos} anos descobertos.`,
    })
  }
  // Capital menor que a dívida: a família herda o saldo devedor.
  if (dividas > 0 && valores.morte > 0 && valores.morte < dividas) {
    inconsistencias.push({
      grave: true,
      texto: `O capital de morte (${Math.round(valores.morte).toLocaleString('pt-BR')}) é menor que as dívidas (${Math.round(dividas).toLocaleString('pt-BR')}) — do jeito que está, a família recebe o seguro e ainda fica devendo.`,
    })
  }
  // Franquia igual ou maior que o limite: a diária nunca chega a pagar.
  for (const d of diarias) {
    if (d.franquia != null && d.valor > 0 && d.franquia >= d.dias) {
      const cob = COBERTURAS.find((c) => c.id === d.id)
      inconsistencias.push({
        grave: true,
        texto: `${cob?.curto ?? d.id}: a franquia de ${d.franquia} dias é maior ou igual ao limite de ${d.dias} diárias — essa cobertura nunca paga.`,
      })
    }
  }
  // Idade + horizonte passando do limite de produto
  if (idade != null && idade + anos > IDADE_LIMITE_PRODUTO) {
    inconsistencias.push({
      grave: false,
      texto: `Com ${idade} anos e ${anos} de proteção, a apólice iria até os ${idade + anos} — acima dos ${IDADE_LIMITE_PRODUTO} a maioria dos produtos não renova. Confirme o prazo com a seguradora.`,
    })
  }
  // Sociedade que não fecha: participações incompatíveis com o nº de sócios
  const numSociosInf = inteiro(plano.pj_num_socios, 0, 0, 999)
  if (temPJ && numSociosInf > 1 && pjParticipacao > 0
    && pjParticipacao * numSociosInf > 100 + 0.5 && pjParticipacao > 100 / numSociosInf) {
    const sobra = Math.round((100 - pjParticipacao) * 10) / 10
    if (sobra >= 0 && numSociosInf - 1 > 0 && sobra / (numSociosInf - 1) < 1) {
      inconsistencias.push({
        grave: false,
        texto: `${numSociosInf} sócios e ${pjParticipacao}% para o cliente deixam menos de 1% para cada um dos outros — confira a participação ou o número de sócios.`,
      })
    }
  }
  // Previdência maior que o patrimônio total declarado (um dos dois está errado)
  if (previdencia > 0 && totalDeclarado > 0 && !detalhado && previdencia > totalDeclarado) {
    inconsistencias.push({
      grave: false,
      texto: 'A previdência sozinha é maior que o patrimônio total declarado — confira se o total já inclui o saldo do VGBL/PGBL (não deveria: previdência entra à parte).',
    })
  }
  // Foco de aposentadoria marcado e nada para calcular
  if (focos.includes('aposentadoria') && !aposentadoria) {
    inconsistencias.push({
      grave: false,
      texto: idade == null
        ? 'Foco em aposentadoria, mas sem a data de nascimento do cliente no cadastro o estudo não consegue projetar nada.'
        : 'Foco em aposentadoria sem renda desejada nem custo de vida — preencha um dos dois para o estudo projetar a meta.',
    })
  }
  // Idade-alvo já passou
  if (idade != null && definido(plano.idade_aposentadoria) && idadeAposentar <= idade) {
    inconsistencias.push({
      grave: false,
      texto: `A idade de aposentadoria (${idadeAposentar}) não é maior que a idade atual (${idade}) — sem prazo à frente não há o que projetar.`,
    })
  }
  // O prêmio saiu numa forma só, mas a proposta mostra as duas
  if (premioMensal > 0 && premioAnualCotado === 0) {
    inconsistencias.push({
      grave: false,
      texto: 'Só o prêmio mensal foi cotado. Cote o anual também: quase toda seguradora dá desconto à vista, e a escolha é do cliente.',
    })
  }

  // ── O plano cabe no bolso? ────────────────────────────────────────────────
  // A conta que decide se a apólice sobrevive ao sexto mês. Prêmio maior que a
  // sobra do cliente não é venda: é cancelamento com estorno de comissão.
  if (investimento && poupancaMensal != null && investimento.mensal > 0) {
    if (poupancaMensal <= 0) {
      inconsistencias.push({
        grave: true,
        texto: `O cliente gasta tudo o que ganha (custo de vida ${custoVida.toLocaleString('pt-BR')} para uma renda de ${renda.toLocaleString('pt-BR')}) — não há sobra de onde tirar os ${Math.round(investimento.mensal).toLocaleString('pt-BR')} do prêmio. Reveja os capitais ou trate o orçamento antes de apresentar.`,
      })
    } else if (investimento.mensal > poupancaMensal) {
      inconsistencias.push({
        grave: true,
        texto: `O prêmio de ${Math.round(investimento.mensal).toLocaleString('pt-BR')}/mês é maior que a sobra mensal do cliente (${Math.round(poupancaMensal).toLocaleString('pt-BR')}). Do jeito que está, o plano não cabe no orçamento dele.`,
      })
    }
  }
  // A régua de mercado da proteção pessoal é 5% a 10% da renda. Acima de 20%
  // o plano vira um problema; entre 10% e 20% ainda dá para sustentar, mas a
  // consultora precisa saber antes de abrir a proposta, não depois.
  if (investimento && renda > 0 && investimento.pctRenda > 20) {
    inconsistencias.push({
      grave: true,
      texto: `O prêmio compromete ${String(investimento.pctRenda).replace('.', ',')}% da renda — o razoável para proteção pessoal é de 5% a 10%. Reveja os capitais antes de apresentar.`,
    })
  } else if (investimento && renda > 0 && investimento.pctRenda > 10) {
    inconsistencias.push({
      grave: false,
      texto: `O prêmio está em ${String(investimento.pctRenda).replace('.', ',')}% da renda, acima da faixa usual de 5% a 10%. Tenha pronta a versão enxuta do plano para o caso de o preço travar a conversa.`,
    })
  }

  // ── Perguntas decisivas que faltaram ──────────────────────────────────────
  // Casado sem regime de bens: o estudo cobra ITCMD sobre o patrimônio inteiro
  // porque não tem como saber o que é meação. É o erro que mais superdimensiona
  // a verba sucessória — e some com uma pergunta de dez segundos.
  if (casado && !plano.regime_bens && custoInventario > 0) {
    inconsistencias.push({
      grave: true, perguntar: 'regime_bens',
      texto: `Cliente casado(a) e sem o regime de bens informado: o estudo está cobrando ITCMD sobre os ${Math.round(bensInventariaveis).toLocaleString('pt-BR')} inteiros. Em comunhão de bens, metade já é do cônjuge (meação) e não paga imposto — a verba sucessória pode estar quase o dobro do necessário.`,
    })
  }
  // ITCMD assumido sem saber o estado: 4% é a alíquota de SP, mas RJ, BA, GO,
  // CE, PE, SC e MT chegam a 8%. Errar isso é errar a verba pela metade.
  if (itcmdOrigem === 'padrao' && custoInventario > 0) {
    inconsistencias.push({
      grave: false, perguntar: 'uf',
      texto: `O ITCMD está em ${itcmd}% (padrão) porque o estado do cliente não foi informado. O imposto é estadual e vai de 2% a 8% — em vários estados o dobro do que o estudo está mostrando.`,
    })
  }

  // ── Coerência do desenho da apólice ───────────────────────────────────────
  // Estudo só de morte: perde a objeção mais comum da categoria antes de ela
  // ser feita.
  if (ativas.length > 0 && valores.morte > 0
    && !['invalidez', 'doencas_graves', 'dit', 'dih'].some((id) => valores[id] > 0)) {
    inconsistencias.push({
      grave: false,
      texto: 'O plano só paga se o cliente morrer. Sem invalidez, doenças graves ou DIT, o "isso só serve depois que eu morro" fica sem resposta — e essas coberturas respondem por boa parte dos sinistros.',
    })
  }
  // Aval é executado na invalidez também: o banco não espera o óbito.
  if (valores.aval > 0 && cenarios.invalidez < valores.aval) {
    inconsistencias.push({
      grave: false,
      texto: `A dívida avalizada (${Math.round(valores.aval).toLocaleString('pt-BR')}) está coberta na morte, mas na invalidez a apólice paga só ${Math.round(cenarios.invalidez).toLocaleString('pt-BR')}. O banco executa o aval nos dois casos — e na invalidez o cliente ainda está aqui para responder por ele.`,
    })
  }
  // Buy-sell sem contraparte
  if (temPJ && pjQuota > 0 && pjNumSocios < 2) {
    inconsistencias.push({
      grave: false, perguntar: 'pj_num_socios',
      texto: pjNumSocios === 1 || pjParticipacao >= 100
        ? 'Sócio único: não há acordo de sócios a fazer (não existe outro sócio para comprar a quota da família). O capital certo aqui é homem-chave e liquidez sucessória — o estudo não sugeriu buy-sell por isso.'
        : 'Informe o número de sócios: o acordo de sócios funciona por apólice cruzada, e sem saber quantos são não dá para dizer quem paga o prêmio de quem.',
    })
  }
  // A proteção acaba antes da dívida
  if (prazoDividaAnos != null && prazoDividaAnos > anos && dividas > 0) {
    inconsistencias.push({
      grave: true, corrigir: 'anos_protecao', valor: prazoDividaAnos,
      texto: `A dívida ainda tem ${prazoDividaAnos} anos e a proteção acaba em ${anos}. Nos ${prazoDividaAnos - anos} anos finais a família fica com o saldo devedor e sem capital nenhum — é o erro clássico do seguro temporário curto demais.`,
    })
  }
  // Reposição de renda para quem já não vive dessa renda
  if (idade != null && idade >= 60 && filhosDependentes.length === 0
    && capitalReposicaoRenda > 0 && custoInventario > 0
    && capitalReposicaoRenda > custoInventario * 2 && !definido(plano.capital_sugerido)) {
    inconsistencias.push({
      grave: false, corrigir: 'capital_sugerido', valor: Math.round(dividas + custoInventario),
      texto: `Aos ${idade} anos e sem filhos dependentes, o estudo está projetando ${Math.round(capitalReposicaoRenda).toLocaleString('pt-BR')} de reposição de renda por ${anos} anos. Confirme até quando essa renda ainda existiria: se ele já vive de patrimônio, o capital que resolve é o do inventário (${Math.round(custoInventario).toLocaleString('pt-BR')}) e não o da renda — e o prêmio cai junto.`,
    })
  }
  // Capital sem dependentes: o estudo mudou a régua, e a consultora precisa
  // saber disso antes de o cliente perguntar por que o número é baixo.
  if (!temDependentes && (renda > 0 || custoVida > 0)) {
    inconsistencias.push({
      grave: false,
      texto: 'Ninguém depende financeiramente deste cliente (sem cônjuge e sem filhos até os 24), então o estudo NÃO projetou reposição de renda na morte — seria proteger um risco que não existe. O capital de morte cobre a dívida, e o peso do plano está onde a exposição real dele está: invalidez, doenças graves e a liquidez do inventário.',
    })
  }
  // Sugestão que bateu no teto de emissão
  for (const l of limitados) {
    const cob = COBERTURAS.find((c) => c.id === l.id)
    inconsistencias.push({
      grave: false,
      texto: `${cob?.curto ?? l.id}: a conta do estudo daria ${Math.round(l.pedido).toLocaleString('pt-BR')}, mas a sugestão foi limitada a ${Math.round(l.teto).toLocaleString('pt-BR')} — ${l.nota}. Confirme o limite com a seguradora antes de prometer o valor cheio.`,
    })
  }
  // Capital acima do que sai sem resseguro facultativo
  if (valores.morte > LIMITES_MERCADO.morte) {
    inconsistencias.push({
      grave: false,
      texto: `Capital de morte de ${Math.round(valores.morte).toLocaleString('pt-BR')}: acima de ${LIMITES_MERCADO.morte.toLocaleString('pt-BR')} o caso vai a resseguro facultativo — exames, entrevista médica e prazo de semanas a meses. Combine o prazo com o cliente antes de prometer data.`,
    })
  }
  // O inventário vai comer a previdência que a família achava que era dela
  if (previdenciaConsumidaNoInventario > 0 && custoInventario > 0) {
    inconsistencias.push({
      grave: false,
      texto: `Sem verba sucessória, os ${Math.round(custoInventario).toLocaleString('pt-BR')} do inventário saem da previdência — que é justamente o dinheiro que a família ia usar para viver. É o argumento mais forte da conversa de sucessão: mostre o saldo antes e depois.`,
    })
  }

  return {
    // entrada normalizada
    renda, custoVida, dividas, anos, itcmd, custas, tipo, focos, temPJ,
    uf: uf || null, itcmdOrigem, prazoDividaAnos,
    // quem é o cliente (vem do cadastro, não do planejamento)
    idade, fumante, idadeAposentar, anosAteAposentar, janelaProtecao, custoDaEspera,
    // filhos e quem depende dessa renda
    filhos, filhosDependentes, temDependentes, temConjuge,
    custoFilhosMensal, capitalFilhos, custoVidaBase,
    // patrimônio
    classes, detalhado, patrimonio: bensInventariaveis, patrimonioBruto, patrimonioLiquido,
    previdencia, investimentos, recursosLiquidos, bensIliquidos, pctIliquido,
    bensInventariaveis, patrimonioTravado, custoInventario, liquidezImediata, liquidezBruta,
    deficitLiquidez,
    // a conta cheia do inventário, aberta em suas duas parcelas
    impostoECustas, custoSustentacaoInventario, custoInventarioNaoCoberto,
    liquidezSucessoria, coberturaLivreParaSucessao, previdenciaConsumidaNoInventario,
    // sucessão: o que muda a conta e o rito
    sucessao: {
      casado, regimeBens: plano.regime_bens || null,
      pctMeacao, meacao, meacaoPotencial, baseInventario,
      custasEfetivas, temHolding, temTestamento: plano.tem_testamento === true,
      herdeirosMenores, inventarioJudicial, prazoInventarioMeses,
      impostoECustas, custoSustentacao: custoSustentacaoInventario,
    },
    // previdência: o extrato x o que a família saca
    previdenciaTipo, previdenciaAporte, previdenciaLiquida, irPrevidencia,
    // coberturas
    sugestoes, valores, ativas, diarias, diariaPorId, tem014, tem019, limitados,
    capitalReposicaoRenda,
    capitalTotal, capitalPF, capitalPJ, totalDiarias, cenarios, capitalMaximoEvento,
    // empresa
    pj: {
      razaoSocial: plano.pj_razao_social ?? '', valuation: pjValuation,
      participacao: pjParticipacao, quota: pjQuota, lucro: pjLucro, lucroBase: pjLucroBase,
      faturamento: pjFaturamento, dividaAval: pjDividaAval,
      numSocios: inteiro(plano.pj_num_socios, 0, 0, 999),
    },
    // leitura do estudo
    coberturaAtual, gap, gapReal, mesesProtegidos, mesesLiquidos, mesesVendendoTudo,
    mesesComPlano, autonomiaAtualMeses, poupancaMensal, comprometimentoRenda,
    anosSugeridosPorFilhos, investimento, completude, inconsistencias,
    // acúmulo
    aposentadoria, acumularEmVezDeSegurar, taxaReal: TAXA_REAL_ANUAL,
    // compat: capital de morte + sucessão
    protecaoTotal: valores.morte + valores.sucessao,
  }
}
