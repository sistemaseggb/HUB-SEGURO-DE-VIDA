// Cascata financeira do fechamento mensal (regra oficial do escritório):
//
//   comissão BRUTA (planilha da seguradora)
//     − imposto do escritório (20%)
//     = base LÍQUIDA
//         × 40% → especialista (Natália na produção dela, Bruno na dele)
//         × 30% → escritório
//         × 30% → assessor que indicou o cliente
//
// O financeiro recebe o bruto; o Hub mostra o líquido para a Natália ter o
// controle real do que ganha. Os percentuais vivem em `configuracoes`
// (migração 011) e podem ser ajustados em Cadastros — estes são os padrões
// usados enquanto a migração não roda.
export const SPLIT_PADRAO = {
  imposto_pct: 20,
  split_natalia_pct: 40,
  split_assessor_pct: 30,
  split_escritorio_pct: 30,
  codigo_natalia: 'CS8868', // Natália também atua como assessora
}

const arred = (v) => Math.round(v * 100) / 100

// Configuração efetiva: usa o que veio do banco e completa com os padrões
// (antes da migração 011 as colunas novas não existem).
export function configSplit(cfg) {
  const c = { ...SPLIT_PADRAO }
  for (const k of Object.keys(SPLIT_PADRAO)) {
    if (cfg?.[k] !== undefined && cfg?.[k] !== null) c[k] = cfg[k]
  }
  return c
}

// Aplica a cascata sobre um valor bruto. Funciona também para estornos
// (valores negativos): todas as partes saem proporcionalmente negativas.
export function splitComissao(bruto, cfg = SPLIT_PADRAO) {
  const c = configSplit(cfg)
  const liquido = bruto * (100 - Number(c.imposto_pct)) / 100
  return {
    bruto: arred(bruto),
    imposto: arred(bruto - liquido),
    liquido: arred(liquido),
    especialista: arred(liquido * Number(c.split_natalia_pct) / 100),
    escritorio: arred(liquido * Number(c.split_escritorio_pct) / 100),
    assessor: arred(liquido * Number(c.split_assessor_pct) / 100),
  }
}
