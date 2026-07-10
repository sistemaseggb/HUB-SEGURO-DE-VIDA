// Etapas do funil de vendas — a ordem aqui define a ordem das colunas do Kanban
export const ETAPAS = [
  { id: 'lead_recebido',        label: 'Lead Recebido',        cor: '#8eb5ff' },
  { id: 'agendamento',          label: 'Agendamento',          cor: '#598cfb' },
  { id: 'reuniao_realizada',    label: 'Reunião Realizada',    cor: '#3366f0' },
  { id: 'estudo_em_andamento',  label: 'Estudo em Andamento',  cor: '#2049dc' },
  { id: 'proposta_apresentada', label: 'Proposta Apresentada', cor: '#1c3ab8' },
  { id: 'em_analise',           label: 'Em Análise',           cor: '#1d3494' },
  { id: 'fechado',              label: 'Fechado',              cor: '#0e9f6e' },
  { id: 'perdido',              label: 'Perdido',              cor: '#94a0b8' },
]

export const etapaLabel = (id) => ETAPAS.find((e) => e.id === id)?.label ?? id

export const STATUS_REUNIAO = [
  { id: 'agendada',  label: 'Agendada' },
  { id: 'realizada', label: 'Realizada' },
  { id: 'cancelada', label: 'Cancelada' },
  { id: 'remarcada', label: 'Remarcada' },
]

// Paleta dos gráficos — ordem categórica FIXA, validada no validador da skill
// dataviz (banda de luminosidade, croma, separação para daltonismo e
// contraste: todas as checagens passam sobre superfície clara).
export const CHART = {
  serie1: '#d96527', // laranja da marca — Natália
  serie2: '#1272a8', // azul — Assessor
  serie3: '#77448c', // ameixa — Escritório
  grid: '#ececee',
  eixo: '#cbccd2',
  textoMudo: '#8f929b',
  sequencial: ['#fae3d3', '#f5c8a8', '#eda672', '#e28442', '#d96527', '#c2531d', '#a1431a', '#83381b'],
}
