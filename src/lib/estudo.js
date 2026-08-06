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

// Campo numérico "definido pela consultora": vazio/null = usar a sugestão
const definido = (v) => v != null && v !== '' && Number.isFinite(Number(v))

// Idade em que o filho deixa de depender financeiramente (fim da faculdade)
export const IDADE_INDEPENDENCIA = 24

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
      const idade = f.idade === '' || f.idade == null ? null : n(f.idade)
      const custoMensal = n(f.custo_mensal)
      const anosRestantes = idade == null
        ? (anosProtecao ?? 0)
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
export function calcularEstudo(plano) {
  if (!plano) return null

  const renda = n(plano.renda_mensal)
  const custoVida = n(plano.custo_vida_mensal)
  const dividas = n(plano.dividas_total)
  const anos = n(plano.anos_protecao) || 10
  const itcmd = definido(plano.itcmd_pct) ? n(plano.itcmd_pct) : 4
  const custas = definido(plano.custas_pct) ? n(plano.custas_pct) : 8

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
  const classes = CLASSES_PATRIMONIO.map((c) => ({ ...c, valor: n(plano[c.campo]) }))
  const somaClasses = classes.reduce((s, c) => s + c.valor, 0)
  const detalhado = somaClasses > 0
  const totalDeclarado = n(plano.patrimonio_total)

  const previdencia = n(plano.previdencia_saldo)
  // Bens que entram no inventário (tudo menos a previdência)
  const bensInventariaveis = detalhado
    ? classes.filter((c) => c.inventario).reduce((s, c) => s + c.valor, 0)
    : totalDeclarado
  const patrimonioBruto = bensInventariaveis + previdencia
  const patrimonioLiquido = patrimonioBruto - dividas

  // O que vira dinheiro rápido — e o que só vira vendendo
  const investimentos = n(plano.patrimonio_investimentos)
  const bensIliquidos = detalhado
    ? classes.filter((c) => c.inventario && !c.liquido).reduce((s, c) => s + c.valor, 0)
    : Math.max(totalDeclarado - investimentos, 0)
  // Sem a composição por classe não dá para afirmar o que é líquido: quem só
  // informou o total não vira "100% ilíquido" na apresentação.
  const pctIliquido = detalhado && patrimonioBruto > 0
    ? Math.round((bensIliquidos / patrimonioBruto) * 100) : null

  // Inventário: a base é só o que passa por ele. Previdência e seguro ficam
  // fora — esse é o ponto que a maioria dos clientes nunca ouviu.
  const custoInventario = bensInventariaveis * (itcmd + custas) / 100
  const coberturaAtual = n(plano.cobertura_atual)
  // Recursos que a família acessa em DIAS, sem alvará e sem inventário
  const liquidezImediata = previdencia + coberturaAtual
  const deficitLiquidez = Math.max(custoInventario - liquidezImediata, 0)
  // Meses até o inventário ser resolvido — média de mercado citada na reunião
  const patrimonioTravado = bensInventariaveis

  // ── Capital de morte ──────────────────────────────────────────────────────
  const capitalMorteSugerido = custoFilhosMensal > 0
    ? custoVidaBase * 12 * anos + capitalFilhos + dividas
    : custoVida * 12 * anos + dividas

  // ── Bloco empresarial ─────────────────────────────────────────────────────
  const pjValuation = n(plano.pj_valuation)
  const pjParticipacao = n(plano.pj_participacao_pct)
  const pjLucro = n(plano.pj_lucro_anual)
  const pjFaturamento = n(plano.pj_faturamento_anual)
  const pjDividaAval = n(plano.pj_divida_avalizada)
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
    valores[c.id] = definido(plano[c.campo]) ? n(plano[c.campo]) : (sugestoes[c.id] ?? 0)
  }

  // Diárias: limite de dias e o total potencial em dinheiro (o que a cobertura
  // vale de verdade quando o pior acontece)
  const diarias = COBERTURAS.filter((c) => c.tipo === 'diaria').filter(disponivel).map((c) => {
    const dias = definido(plano[c.campoDias]) ? n(plano[c.campoDias]) : c.diasPadrao
    const franquia = c.campoFranquia
      ? (definido(plano[c.campoFranquia]) ? n(plano[c.campoFranquia]) : c.franquiaPadrao)
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
  const soma = (ids) => ids.reduce((s, id) => {
    const c = ativas.find((a) => a.id === id)
    return s + (c ? c.valor : 0)
  }, 0)
  const cenarios = {
    morte: soma(['morte', 'sucessao', 'socios', 'homem_chave', 'aval', 'funeral_individual']),
    morteAcidental: soma(['morte', 'morte_acidental', 'sucessao', 'socios', 'homem_chave', 'aval', 'funeral_individual']),
    invalidez: soma(['invalidez', 'aval']),
    doencaGrave: soma(['doencas_graves']),
  }
  const capitalMaximoEvento = Math.max(...Object.values(cenarios))

  // ── Autonomia: a pergunta que abre os olhos ───────────────────────────────
  // Hoje, sem o plano, a família vive do que é líquido (investimentos +
  // previdência + seguro que já existe), depois começa a vender bens.
  const recursosLiquidos = investimentos + previdencia
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

  // ── O investimento: mensal E anual, o cliente escolhe ─────────────────────
  const premioMensal = n(plano.premio_estimado)
  const premioAnualCotado = n(plano.premio_anual)
  const formaPagamento = plano.forma_pagamento === 'anual' ? 'anual' : 'mensal'
  const investimento = premioMensal > 0 || premioAnualCotado > 0 ? (() => {
    // Uma das duas formas basta: a outra se deduz (12× o mensal, sem desconto)
    const mensal = premioMensal > 0 ? premioMensal : Math.round((premioAnualCotado / 12) * 100) / 100
    const doze = mensal * 12
    const anual = premioAnualCotado > 0 ? premioAnualCotado : doze
    const economiaAnual = Math.max(doze - anual, 0)
    const descontoPct = doze > 0 && economiaAnual > 0
      ? Math.round((economiaAnual / doze) * 1000) / 10 : null
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
  if (detalhado && totalDeclarado > 0 && Math.abs(somaClasses - previdencia - totalDeclarado) > 1) {
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
  if (temPJ && pjValuation > 0 && detalhado && n(plano.patrimonio_empresa) === 0) {
    inconsistencias.push({
      grave: false, corrigir: 'patrimonio_empresa', valor: Math.round(pjQuota),
      texto: 'A participação na empresa não está no patrimônio — o inventário vai cobrar ITCMD sobre ela.',
    })
  }

  return {
    // entrada normalizada
    renda, custoVida, dividas, anos, itcmd, custas, tipo, focos, temPJ,
    // filhos
    filhos, custoFilhosMensal, capitalFilhos, custoVidaBase,
    // patrimônio
    classes, detalhado, patrimonio: bensInventariaveis, patrimonioBruto, patrimonioLiquido,
    previdencia, investimentos, recursosLiquidos, bensIliquidos, pctIliquido,
    bensInventariaveis, patrimonioTravado, custoInventario, liquidezImediata, deficitLiquidez,
    // coberturas
    sugestoes, valores, ativas, diarias, diariaPorId, tem014, tem019,
    capitalTotal, capitalPF, capitalPJ, totalDiarias, cenarios, capitalMaximoEvento,
    // empresa
    pj: {
      razaoSocial: plano.pj_razao_social ?? '', valuation: pjValuation,
      participacao: pjParticipacao, quota: pjQuota, lucro: pjLucro, lucroBase: pjLucroBase,
      faturamento: pjFaturamento, dividaAval: pjDividaAval,
      numSocios: n(plano.pj_num_socios),
    },
    // leitura do estudo
    coberturaAtual, gap, gapReal, mesesProtegidos, mesesLiquidos, mesesVendendoTudo,
    mesesComPlano, autonomiaAtualMeses, poupancaMensal, comprometimentoRenda,
    anosSugeridosPorFilhos, investimento, completude, inconsistencias,
    // compat: capital de morte + sucessão
    protecaoTotal: valores.morte + valores.sucessao,
  }
}
