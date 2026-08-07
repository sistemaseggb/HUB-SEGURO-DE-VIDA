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
  const itcmd = pctVal(plano.itcmd_pct, 4, TETO_ITCMD)
  const custas = pctVal(plano.custas_pct, 8, TETO_CUSTAS)

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
  const custoInventario = baseInventario * (itcmd + custasEfetivas) / 100
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
  const liquidezImediata = previdenciaLiquida + coberturaAtual
  const deficitLiquidez = Math.max(custoInventario - liquidezImediata, 0)
  const patrimonioTravado = bensInventariaveis

  // ── Capital de morte ──────────────────────────────────────────────────────
  const capitalMorteSugerido = custoFilhosMensal > 0
    ? custoVidaBase * 12 * anos + capitalFilhos + dividas
    : custoVida * 12 * anos + dividas

  // ── Bloco empresarial ─────────────────────────────────────────────────────
  const pjValuation = q(plano.pj_valuation)
  const pjParticipacao = pctVal(plano.pj_participacao_pct, 0)
  const pjLucro = q(plano.pj_lucro_anual)
  const pjFaturamento = q(plano.pj_faturamento_anual)
  const pjDividaAval = q(plano.pj_divida_avalizada)
  const pjQuota = pjValuation * pjParticipacao / 100
  // Sem lucro informado, estimamos a margem em 20% do faturamento — é a conta
  // que a consultora refaz com o contador, mas já dá o tamanho da conversa.
  const pjLucroBase = pjLucro > 0 ? pjLucro : pjFaturamento * 0.2

  // ── Sugestões de cada cobertura ───────────────────────────────────────────
  const sugestoes = {
    morte: capitalMorteSugerido,
    invalidez: capitalMorteSugerido,
    doencas_graves: renda * 24,
    dit: renda > 0 ? Math.round(renda / 30) : 0,
    dih: renda > 0 ? Math.round(renda / 30) : 0,
    morte_acidental: capitalMorteSugerido,
    // fraturas indenizam por tabela: o mercado trabalha entre R$ 10 mil e
    // R$ 50 mil, então a sugestão acompanha a renda mas respeita esse teto
    fraturas: renda > 0 ? Math.min(Math.round((renda * 3) / 1000) * 1000, FRATURAS_TETO) : 0,
    // As assistências têm valor fixo de mercado. Só entram quando o estudo já
    // tem substância — senão um planejamento em branco nasceria anunciando
    // duas coberturas que ninguém levantou.
    funeral_individual: capitalMorteSugerido > 0 || renda > 0 ? FUNERAL_INDIVIDUAL_PADRAO : 0,
    funeral_familiar: capitalMorteSugerido > 0 || renda > 0 ? FUNERAL_FAMILIAR_PADRAO : 0,
    sucessao: custoInventario,
    socios: pjQuota,
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

  // ── Autonomia: a pergunta que abre os olhos ───────────────────────────────
  // Hoje, sem o plano, a família vive do que é líquido (investimentos +
  // previdência + seguro que já existe), depois começa a vender bens.
  // Previdência entra pelo LÍQUIDO: é o que a família saca de fato.
  const recursosLiquidos = investimentos + previdenciaLiquida
  // Sem a composição por classe não dá para separar o líquido do ilíquido:
  // devolvemos null em vez de "0 meses", que seria uma afirmação que o estudo
  // não pode sustentar. A apresentação então mostra dois cenários em vez de três.
  const mesesLiquidos = detalhado
    ? mesesSustentados(recursosLiquidos + coberturaAtual - dividas, custoVidaBase, filhos)
    : null
  // Vendendo tudo que foi construído — inclusive a casa
  const mesesVendendoTudo = mesesSustentados(
    patrimonioBruto + coberturaAtual - dividas, custoVidaBase, filhos)
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
  if (investimento && renda > 0 && investimento.pctRenda > 30) {
    inconsistencias.push({
      grave: true,
      texto: `O prêmio compromete ${String(investimento.pctRenda).replace('.', ',')}% da renda — reveja os capitais antes de apresentar.`,
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

  return {
    // entrada normalizada
    renda, custoVida, dividas, anos, itcmd, custas, tipo, focos, temPJ,
    // quem é o cliente (vem do cadastro, não do planejamento)
    idade, fumante, idadeAposentar, anosAteAposentar, janelaProtecao, custoDaEspera,
    // filhos
    filhos, custoFilhosMensal, capitalFilhos, custoVidaBase,
    // patrimônio
    classes, detalhado, patrimonio: bensInventariaveis, patrimonioBruto, patrimonioLiquido,
    previdencia, investimentos, recursosLiquidos, bensIliquidos, pctIliquido,
    bensInventariaveis, patrimonioTravado, custoInventario, liquidezImediata, deficitLiquidez,
    // sucessão: o que muda a conta e o rito
    sucessao: {
      casado, regimeBens: plano.regime_bens || null,
      pctMeacao, meacao, meacaoPotencial, baseInventario,
      custasEfetivas, temHolding, temTestamento: plano.tem_testamento === true,
      herdeirosMenores, inventarioJudicial, prazoInventarioMeses,
    },
    // previdência: o extrato x o que a família saca
    previdenciaTipo, previdenciaAporte, previdenciaLiquida, irPrevidencia,
    // coberturas
    sugestoes, valores, ativas, diarias, diariaPorId, tem014, tem019,
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
