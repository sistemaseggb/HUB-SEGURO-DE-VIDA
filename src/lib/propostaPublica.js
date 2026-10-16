// Contrato público explícito: novos campos internos nunca são compartilhados automaticamente.
export const CAMPOS_PUBLICOS = [
  'aliquota_ir_cliente',
  'anos_protecao',
  'capital_aval',
  'capital_cirurgias',
  'capital_doencas_graves',
  'capital_fraturas',
  'capital_homem_chave',
  'capital_invalidez',
  'capital_morte_acidental',
  'capital_socios',
  'capital_sugerido',
  'cobertura_atual',
  'comparador_alternativa',
  'comparador_taxa_real',
  'conjuge_nome',
  'custas_pct',
  'custo_vida_mensal',
  'dependentes',
  'dih_diaria',
  'dih_dias',
  'dit_diaria',
  'dit_dias',
  'dit_franquia_dias',
  'dividas_prazo_anos',
  'dividas_total',
  'estado_civil',
  'filhos_idades',
  'focos',
  'forma_pagamento',
  'fumante',
  'funeral_familiar',
  'funeral_individual',
  'herdeiros_menores',
  'idade_aposentadoria',
  'itcmd_pct',
  'num_dependentes',
  'objetivos',
  'patrimonio_empresa',
  'patrimonio_imoveis',
  'patrimonio_investimentos',
  'patrimonio_outros',
  'patrimonio_total',
  'patrimonio_veiculos',
  'pj_divida_avalizada',
  'pj_faturamento_anual',
  'pj_lucro_anual',
  'pj_num_socios',
  'pj_participacao_pct',
  'pj_razao_social',
  'pj_valuation',
  'premio_anual',
  'premio_estimado',
  'premio_temporario_mensal',
  'previdencia_aporte_mensal',
  'previdencia_saldo',
  'previdencia_tipo',
  'profissao',
  'regime_bens',
  'renda_desejada_aposentadoria',
  'renda_mensal',
  'seguro_resgatavel',
  'seguros_existentes',
  'tem_holding',
  'tem_testamento',
  'tipo_planejamento',
  'uf',
  'verba_sucessoria',
]
const ARRAYS_PUBLICOS = {
  dependentes: ['nome', 'idade', 'custo_mensal'],
  seguros_existentes: ['origem', 'descricao', 'capital', 'custeio'],
  seguro_resgatavel: ['ano', 'resgate'],
}
export function planoPublico(plano) {
  const saida = Object.fromEntries(
    CAMPOS_PUBLICOS.filter((k) => Object.hasOwn(plano, k)).map((k) => [
      k,
      structuredClone(plano[k]),
    ]),
  )
  for (const [campo, permitidos] of Object.entries(ARRAYS_PUBLICOS)) {
    if (!Object.hasOwn(saida, campo)) continue
    saida[campo] = (Array.isArray(saida[campo]) ? saida[campo] : []).map((item) =>
      Object.fromEntries(
        permitidos
          .filter((k) => item && typeof item === 'object' && Object.hasOwn(item, k))
          .map((k) => [k, item[k]]),
      ),
    )
  }
  return saida
}
