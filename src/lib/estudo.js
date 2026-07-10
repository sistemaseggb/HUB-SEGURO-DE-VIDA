// Estudo de proteção por pilares — o motor de cálculo da consultoria.
// Usado na aba Planejamento (sugestões), na Proposta (slides) e no Dossiê.
//
// Referências das sugestões (prática de mercado em consultoria de vida):
//   Morte            → custo de vida × 12 × anos de proteção + dívidas
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

export function calcularEstudo(plano) {
  if (!plano) return null
  const renda = n(plano.renda_mensal)
  const custoVida = n(plano.custo_vida_mensal)
  const dividas = n(plano.dividas_total)
  const patrimonio = n(plano.patrimonio_total)
  const anos = n(plano.anos_protecao) || 10
  const itcmd = plano.itcmd_pct == null ? 4 : n(plano.itcmd_pct)
  const custas = plano.custas_pct == null ? 8 : n(plano.custas_pct)

  const sugestoes = {
    morte: custoVida * 12 * anos + dividas,
    invalidez: custoVida * 12 * anos + dividas,
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
  const mesesProtegidos = custoVida > 0 ? Math.round((valores.morte - dividas) / custoVida) : null
  const custoInventario = patrimonio * (itcmd + custas) / 100

  return {
    renda, custoVida, dividas, patrimonio, anos, itcmd, custas,
    sugestoes, valores, coberturaAtual, gap, mesesProtegidos, custoInventario,
    // capital total de morte + sucessão (quando sucessão não está embutida)
    protecaoTotal: valores.morte + valores.sucessao,
  }
}

// Rótulos e descrições dos pilares — texto único para form, slides e dossiê
export const PILARES = [
  {
    id: 'morte', rotulo: 'Proteção da família', campo: 'capital_sugerido',
    descricao: 'Padrão de vida garantido e dívidas quitadas se a renda faltar',
    comoCalcula: 'custo de vida × 12 × anos de proteção + dívidas',
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
