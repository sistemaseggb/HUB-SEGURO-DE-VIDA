// Etapas do funil de vendas — a ordem aqui define a ordem das colunas do Kanban
export const ETAPAS = [
  { id: 'lead_recebido',        label: 'Lead Recebido',        cor: '#8eb5ff' },
  { id: 'agendamento',          label: 'Agendamento',          cor: '#598cfb' },
  { id: 'reuniao_realizada',    label: 'Reunião Realizada',    cor: '#3366f0' },
  { id: 'estudo_em_andamento',  label: 'Estudo em Andamento',  cor: '#2049dc' },
  { id: 'proposta_apresentada', label: 'Proposta Apresentada', cor: '#1c3ab8' },
  { id: 'em_analise',           label: 'Em Análise',           cor: '#1d3494' },
  { id: 'fechado',              label: 'Fechado ✅',           cor: '#0e9f6e' },
  { id: 'perdido',              label: 'Perdido',              cor: '#94a0b8' },
]

export const etapaLabel = (id) => ETAPAS.find((e) => e.id === id)?.label ?? id

export const STATUS_REUNIAO = [
  { id: 'agendada',  label: 'Agendada' },
  { id: 'realizada', label: 'Realizada' },
  { id: 'cancelada', label: 'Cancelada' },
  { id: 'remarcada', label: 'Remarcada' },
]

export const TIPO_TAREFA_ICONE = {
  contato: '📞',
  agendamento: '📅',
  planejamento: '📊',
  formulario: '📋',
  pos_venda: '🤝',
  revisao: '🔄',
  geral: '✔️',
}

// Paleta dos gráficos (validada para daltonismo — ver skill dataviz)
export const CHART = {
  serie1: '#2049dc', // azul da marca — Natália
  serie2: '#1baf7a', // aqua — Assessor
  serie3: '#eaa119', // âmbar — Escritório
  grid: '#e8ecf3',
  eixo: '#cbd2e0',
  textoMudo: '#94a0b8',
  sequencial: ['#bcd2ff', '#8eb5ff', '#598cfb', '#3366f0', '#2049dc', '#1c3ab8', '#1d3494', '#1d3175'],
}
