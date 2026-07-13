// Estudo de proteção por pilares — o motor de cálculo da consultoria.
// Usado na aba Planejamento (sugestões), na Proposta (slides) e no Dossiê.
//
// Referências das sugestões (prática de mercado em consultoria de vida):
//   Morte            → custo de vida × 12 × anos de proteção + dívidas
//                      (o gasto com cada filho entra separado, só até os 24)
//   Invalidez (IPTA) → mesmo capital da morte (a renda para do mesmo jeito)
//   Doenças graves   → 24 × renda mensal (≈ 2 anos de tratamento sem trabalhar)
//   DIT              → renda ÷ 30 por dia parado (autônomos e liberais)
//   Sucessão         → patrimônio × (ITCMD % + custas/honorários %)
//     O inventário só libera os bens depois de pago o imposto — o seguro dá
//     a liquidez imediata (e não entra em inventário: vai direto aos
//     beneficiários, sem ITCMD na maioria dos estados).

const n = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

// Idade em que o filho deixa de depender financeiramente (fim da faculdade)
export const IDADE_INDEPENDENCIA = 24

// Normaliza a lista de filhos do planejamento (coluna jsonb `dependentes`,
// formato [{nome, idade, custo_mensal}]) e calcula, por filho, quantos anos
// de sustento faltam e o capital necessário até os 24.
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

export function calcularEstudo(plano) {
  if (!plano) return null
  const renda = n(plano.renda_mensal)
  const custoVida = n(plano.custo_vida_mensal)
  const dividas = n(plano.dividas_total)
  const patrimonio = n(plano.patrimonio_total)
  const anos = n(plano.anos_protecao) || 10
  const itcmd = plano.itcmd_pct == null ? 4 : n(plano.itcmd_pct)
  const custas = plano.custas_pct == null ? 8 : n(plano.custas_pct)

  // ── Filhos: o gasto de hoje que DEIXA de existir quando cada um faz 24 ────
  const filhos = normalizarFilhos(plano, anos)
  const custoFilhosMensal = filhos.reduce((s, f) => s + f.custoMensal, 0)
  const capitalFilhos = filhos.reduce((s, f) => s + f.capitalAte24, 0)

  // Capital de morte: o custo de vida SEM os filhos é projetado pelo horizonte
  // inteiro; o gasto de cada filho entra separado, só pelos anos até os 24.
  // Assim o estudo não cobra do cliente um capital para sustentar aos 30 anos
  // um filho que hoje tem 20.
  const custoVidaBase = Math.max(custoVida - custoFilhosMensal, 0)
  const capitalMorte = custoFilhosMensal > 0
    ? custoVidaBase * 12 * anos + capitalFilhos + dividas
    : custoVida * 12 * anos + dividas

  const sugestoes = {
    morte: capitalMorte,
    invalidez: capitalMorte,
    doencas_graves: renda * 24,
    dit: renda > 0 ? Math.round(renda / 30) : 0,
    sucessao: patrimonio * (itcmd + custas) / 100,
  }

  // Valores definidos (o que a consultora escolheu); caem na sugestão se vazios
  const capMorte = n(plano.capital_sugerido) || sugestoes.morte
  const valores = {
    morte: capMorte,
    invalidez: plano.capital_invalidez == null || plano.capital_invalidez === ''
      ? sugestoes.invalidez : n(plano.capital_invalidez),
    doencas_graves: plano.capital_doencas_graves == null || plano.capital_doencas_graves === ''
      ? sugestoes.doencas_graves : n(plano.capital_doencas_graves),
    dit: plano.dit_diaria == null || plano.dit_diaria === '' ? sugestoes.dit : n(plano.dit_diaria),
    sucessao: plano.verba_sucessoria == null || plano.verba_sucessoria === ''
      ? sugestoes.sucessao : n(plano.verba_sucessoria),
  }

  const coberturaAtual = n(plano.cobertura_atual)
  const gap = Math.max(valores.morte - coberturaAtual, 0)
  const mesesProtegidos = custoVida > 0
    ? Math.max(Math.round((valores.morte - dividas) / custoVida), 0)
    : null
  const custoInventario = patrimonio * (itcmd + custas) / 100

  // ── Inteligência do estudo ────────────────────────────────────────────────
  // Autonomia ATUAL da família: quantos meses o padrão de vida se sustenta
  // hoje, sem o plano — patrimônio + cobertura existente, menos dívidas,
  // dividido pelo custo mensal. É o número que abre os olhos do cliente.
  const autonomiaAtualMeses = custoVida > 0
    ? Math.max(Math.round((patrimonio + coberturaAtual - dividas) / custoVida), 0)
    : null

  // Fôlego financeiro mensal e comprometimento da renda
  const poupancaMensal = renda > 0 ? renda - custoVida : null
  const comprometimentoRenda = renda > 0 ? Math.round((custoVida / renda) * 100) : null

  // Horizonte sugerido pelos filhos: proteger até o mais novo completar 24.
  // Usa a lista estruturada de filhos; se só houver o texto livre antigo
  // ("3, 7 e 12 anos"), extrai as idades dele.
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

  // Cotação (migração 015): o investimento que aparece na proposta
  const premio = n(plano.premio_estimado)
  const protecaoTotal = valores.morte + valores.sucessao
  const investimento = premio > 0 ? {
    mensal: premio,
    diario: Math.round((premio / 30) * 100) / 100,
    pctRenda: renda > 0 ? Math.round((premio / renda) * 1000) / 10 : null,
    // cada R$ 1 de prêmio mensal protege R$ N de capital (morte + sucessão)
    alavancagem: protecaoTotal > 0 ? Math.round(protecaoTotal / premio) : null,
  } : null

  // Completude do estudo: os campos que sustentam uma proposta forte
  const camposChave = [
    ['renda_mensal', renda > 0], ['custo_vida_mensal', custoVida > 0],
    ['patrimonio_total', patrimonio > 0], ['num_dependentes', plano.num_dependentes != null],
    ['objetivos', !!String(plano.objetivos ?? '').trim()],
    ['cobertura_atual', plano.cobertura_atual != null && plano.cobertura_atual !== ''],
    ['premio_estimado', premio > 0],
  ]
  const completude = {
    feitos: camposChave.filter(([, ok]) => ok).length,
    total: camposChave.length,
    faltando: camposChave.filter(([, ok]) => !ok).map(([campo]) => campo),
  }

  return {
    renda, custoVida, dividas, patrimonio, anos, itcmd, custas,
    sugestoes, valores, coberturaAtual, gap, mesesProtegidos, custoInventario,
    autonomiaAtualMeses, poupancaMensal, comprometimentoRenda,
    anosSugeridosPorFilhos, investimento, completude,
    filhos, custoFilhosMensal, capitalFilhos, custoVidaBase,
    // capital total de morte + sucessão (quando sucessão não está embutida)
    protecaoTotal,
  }
}

// Rótulos e descrições dos pilares — texto único para form, slides e dossiê
export const PILARES = [
  {
    id: 'morte', rotulo: 'Proteção da família', campo: 'capital_sugerido',
    descricao: 'Padrão de vida garantido e dívidas quitadas se a renda faltar',
    comoCalcula: 'custo de vida × 12 × anos de proteção + dívidas (filhos contam só até os 24)',
  },
  {
    id: 'invalidez', rotulo: 'Invalidez permanente', campo: 'capital_invalidez',
    descricao: 'Se um acidente ou doença impedir de trabalhar para sempre',
    comoCalcula: 'mesmo capital da proteção da família',
  },
  {
    id: 'doencas_graves', rotulo: 'Doenças graves', campo: 'capital_doencas_graves',
    descricao: 'Dinheiro em vida no diagnóstico: tratamento sem tocar no patrimônio',
    comoCalcula: '24 × a renda mensal (≈ 2 anos de tratamento)',
  },
  {
    id: 'dit', rotulo: 'Incapacidade temporária (DIT)', campo: 'dit_diaria', porDia: true,
    descricao: 'Renda por dia parado — essencial para autônomos e liberais',
    comoCalcula: 'renda mensal ÷ 30, por dia de afastamento',
  },
  {
    id: 'sucessao', rotulo: 'Sucessão e inventário', campo: 'verba_sucessoria',
    descricao: 'Liquidez imediata para o inventário — os bens não ficam travados',
    comoCalcula: 'patrimônio × (ITCMD + custas e honorários)',
  },
]
