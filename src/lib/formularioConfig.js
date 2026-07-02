// Estrutura do formulário de onboarding pós-venda.
// AJUSTÁVEL SEM MEXER EM CÓDIGO: acrescente/remova campos aqui e o wizard
// se adapta — as respostas são salvas em JSONB no banco.
// TODO: alinhar os campos com o formulário oficial (gbplanejamento.netlify.app)
// quando o conteúdo for repassado pelo administrador.

export const ETAPAS_FORM = [
  {
    titulo: 'Seus dados pessoais',
    descricao: 'Só o essencial para a emissão da sua apólice.',
    campos: [
      { id: 'nome_completo', rotulo: 'Nome completo', tipo: 'text', obrigatorio: true },
      { id: 'cpf', rotulo: 'CPF', tipo: 'text', obrigatorio: true, placeholder: '000.000.000-00' },
      { id: 'rg', rotulo: 'RG', tipo: 'text' },
      { id: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date', obrigatorio: true },
      {
        id: 'estado_civil', rotulo: 'Estado civil', tipo: 'select', obrigatorio: true,
        opcoes: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'],
      },
    ],
  },
  {
    titulo: 'Contato e endereço',
    descricao: 'Para onde enviamos sua apólice e comunicados.',
    campos: [
      { id: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true },
      { id: 'telefone', rotulo: 'Celular (WhatsApp)', tipo: 'text', obrigatorio: true, placeholder: '(41) 99999-9999' },
      { id: 'cep', rotulo: 'CEP', tipo: 'text', obrigatorio: true },
      { id: 'endereco', rotulo: 'Endereço completo', tipo: 'text', obrigatorio: true },
      { id: 'cidade', rotulo: 'Cidade', tipo: 'text', obrigatorio: true },
      { id: 'uf', rotulo: 'Estado (UF)', tipo: 'text', obrigatorio: true, placeholder: 'PR' },
    ],
  },
  {
    titulo: 'Vida profissional',
    descricao: 'Sua profissão influencia as condições do seguro.',
    campos: [
      { id: 'profissao', rotulo: 'Profissão', tipo: 'text', obrigatorio: true },
      { id: 'empresa', rotulo: 'Empresa onde trabalha', tipo: 'text' },
      { id: 'renda_mensal', rotulo: 'Renda mensal aproximada (R$)', tipo: 'number', obrigatorio: true },
    ],
  },
  {
    titulo: 'Um pouco sobre sua saúde',
    descricao: 'Respostas sinceras garantem que sua proteção valha quando precisar.',
    campos: [
      { id: 'altura_cm', rotulo: 'Altura (cm)', tipo: 'number', obrigatorio: true, placeholder: '175' },
      { id: 'peso_kg', rotulo: 'Peso (kg)', tipo: 'number', obrigatorio: true, placeholder: '80' },
      { id: 'fumante', rotulo: 'Você fuma ou fumou nos últimos 2 anos?', tipo: 'simnao', obrigatorio: true },
      { id: 'doenca_cronica', rotulo: 'Possui alguma doença crônica ou já passou por cirurgia?', tipo: 'simnao', obrigatorio: true },
      { id: 'doenca_detalhe', rotulo: 'Se sim, conte brevemente', tipo: 'textarea', dependeDe: 'doenca_cronica' },
      { id: 'medicamentos', rotulo: 'Usa algum medicamento contínuo? Qual?', tipo: 'text' },
    ],
  },
  {
    titulo: 'Hábitos e esportes',
    descricao: 'Últimas perguntas rápidas!',
    campos: [
      { id: 'esporte_risco', rotulo: 'Pratica esportes radicais (paraquedismo, mergulho, motociclismo...)?', tipo: 'simnao', obrigatorio: true },
      { id: 'esporte_detalhe', rotulo: 'Se sim, quais?', tipo: 'text', dependeDe: 'esporte_risco' },
      { id: 'viagens_frequentes', rotulo: 'Faz viagens internacionais frequentes a trabalho?', tipo: 'simnao' },
    ],
  },
  {
    titulo: 'Beneficiários',
    descricao: 'Quem você quer proteger? Indique as pessoas e o percentual de cada uma.',
    campos: [{ id: 'beneficiarios', tipo: 'beneficiarios' }],
  },
]
