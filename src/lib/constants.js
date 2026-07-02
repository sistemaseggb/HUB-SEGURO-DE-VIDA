// Etapas do funil de vendas — a ordem aqui define a ordem das colunas do Kanban
export const ETAPAS = [
  { id: 'lead_recebido',        label: 'Lead Recebido',        cor: '#86b6ef' },
  { id: 'agendamento',          label: 'Agendamento',          cor: '#6da7ec' },
  { id: 'reuniao_realizada',    label: 'Reunião Realizada',    cor: '#5598e7' },
  { id: 'estudo_em_andamento',  label: 'Estudo em Andamento',  cor: '#3987e5' },
  { id: 'proposta_apresentada', label: 'Proposta Apresentada', cor: '#2a78d6' },
  { id: 'em_analise',           label: 'Em Análise',           cor: '#256abf' },
  { id: 'fechado',              label: 'Fechado ✅',           cor: '#1c5cab' },
  { id: 'perdido',              label: 'Perdido',              cor: '#898781' },
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
  serie1: '#2a78d6', // azul — Natália
  serie2: '#1baf7a', // aqua — Assessor
  serie3: '#eda100', // amarelo — Escritório
  grid: '#e1e0d9',
  eixo: '#c3c2b7',
  textoMudo: '#898781',
  sequencial: ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#104281'],
}
