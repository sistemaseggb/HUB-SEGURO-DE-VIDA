// Estrutura do formulário de onboarding + DPS (Declaração Pessoal de Saúde).
// AJUSTÁVEL SEM MEXER EM CÓDIGO: acrescente/remova campos aqui e o wizard
// se adapta — as respostas são salvas em JSONB no banco.
//
// A DPS segue o padrão das seguradoras (MAG, Icatu, Azos, Omint): são os
// dados que o cliente precisa declarar para a apólice ser emitida. Perguntas
// de saúde respondidas com "sim" abrem um campo de detalhe — a seguradora
// sempre pede o complemento (o quê, quando, tratamento, situação atual).

export const ETAPAS_FORM = [
  {
    titulo: 'Seus dados pessoais',
    descricao: 'Só o essencial para a emissão da sua apólice.',
    campos: [
      { id: 'nome_completo', rotulo: 'Nome completo', tipo: 'text', obrigatorio: true },
      { id: 'cpf', rotulo: 'CPF', tipo: 'text', obrigatorio: true, placeholder: '000.000.000-00' },
      { id: 'rg', rotulo: 'RG (com órgão emissor)', tipo: 'text' },
      { id: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date', obrigatorio: true },
      { id: 'sexo', rotulo: 'Sexo', tipo: 'select', obrigatorio: true, opcoes: ['Feminino', 'Masculino'] },
      {
        id: 'estado_civil', rotulo: 'Estado civil', tipo: 'select', obrigatorio: true,
        opcoes: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'],
      },
      { id: 'nacionalidade', rotulo: 'Nacionalidade', tipo: 'text', placeholder: 'Brasileira' },
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
    titulo: 'Vida profissional e financeira',
    descricao: 'Sua profissão e renda influenciam as condições do seguro.',
    campos: [
      { id: 'profissao', rotulo: 'Profissão', tipo: 'text', obrigatorio: true },
      { id: 'empresa', rotulo: 'Empresa onde trabalha', tipo: 'text' },
      { id: 'renda_mensal', rotulo: 'Renda mensal aproximada (R$)', tipo: 'number', obrigatorio: true },
      { id: 'atividade_risco', rotulo: 'Sua atividade envolve risco (altura, eletricidade, químicos, armas, embarque...)?', tipo: 'simnao', obrigatorio: true },
      { id: 'atividade_risco_detalhe', rotulo: 'Se sim, descreva a atividade', tipo: 'textarea', dependeDe: 'atividade_risco' },
      { id: 'ppe', rotulo: 'Você é pessoa politicamente exposta (cargo público relevante, ou parente próximo de quem tem)?', tipo: 'simnao', obrigatorio: true },
    ],
  },
  {
    titulo: 'Dados físicos',
    descricao: 'Usados no cálculo do seu perfil de saúde.',
    campos: [
      { id: 'altura_cm', rotulo: 'Altura (cm)', tipo: 'number', obrigatorio: true, placeholder: '175' },
      { id: 'peso_kg', rotulo: 'Peso (kg)', tipo: 'number', obrigatorio: true, placeholder: '80' },
    ],
  },
  {
    titulo: 'Declaração de saúde — parte 1',
    descricao: 'Respostas sinceras garantem que sua proteção valha quando precisar. Respondeu "sim"? Conte o quê, quando, tratamento e situação atual.',
    campos: [
      { id: 'dps_pressao_coracao', rotulo: 'Tem ou teve pressão alta, colesterol alto ou doença do coração/circulação (infarto, arritmia, sopro...)?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_pressao_coracao_detalhe', rotulo: 'Detalhe (o quê, desde quando, tratamento)', tipo: 'textarea', dependeDe: 'dps_pressao_coracao' },
      { id: 'dps_diabetes', rotulo: 'Tem ou teve diabetes ou alteração de glicose?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_diabetes_detalhe', rotulo: 'Detalhe (tipo, desde quando, tratamento)', tipo: 'textarea', dependeDe: 'dps_diabetes' },
      { id: 'dps_cancer', rotulo: 'Tem ou teve câncer, tumor, nódulo ou cisto (mesmo benigno)?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_cancer_detalhe', rotulo: 'Detalhe (local, quando, tratamento, situação atual)', tipo: 'textarea', dependeDe: 'dps_cancer' },
      { id: 'dps_respiratorio', rotulo: 'Tem ou teve doença respiratória (asma, bronquite, enfisema, apneia do sono)?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_respiratorio_detalhe', rotulo: 'Detalhe', tipo: 'textarea', dependeDe: 'dps_respiratorio' },
      { id: 'dps_neurologico', rotulo: 'Tem ou teve doença neurológica (AVC/derrame, epilepsia, esclerose, Parkinson...)?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_neurologico_detalhe', rotulo: 'Detalhe', tipo: 'textarea', dependeDe: 'dps_neurologico' },
      { id: 'dps_psiquiatrico', rotulo: 'Tem ou teve depressão, ansiedade, burnout ou outro transtorno emocional com tratamento?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_psiquiatrico_detalhe', rotulo: 'Detalhe (diagnóstico, medicação, situação atual)', tipo: 'textarea', dependeDe: 'dps_psiquiatrico' },
    ],
  },
  {
    titulo: 'Declaração de saúde — parte 2',
    descricao: 'Continuando — falta pouco.',
    campos: [
      { id: 'dps_digestivo_renal', rotulo: 'Tem ou teve doença do fígado, estômago/intestino ou dos rins (hepatite, gastrite grave, cálculo, insuficiência)?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_digestivo_renal_detalhe', rotulo: 'Detalhe', tipo: 'textarea', dependeDe: 'dps_digestivo_renal' },
      { id: 'dps_coluna_articulacoes', rotulo: 'Tem ou teve problema de coluna, articulações, hérnia de disco, LER ou lesão ortopédica?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_coluna_articulacoes_detalhe', rotulo: 'Detalhe', tipo: 'textarea', dependeDe: 'dps_coluna_articulacoes' },
      { id: 'dps_infecciosa', rotulo: 'Tem ou teve HIV, hepatite B/C ou outra doença infecciosa crônica?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_infecciosa_detalhe', rotulo: 'Detalhe', tipo: 'textarea', dependeDe: 'dps_infecciosa' },
      { id: 'dps_internacao', rotulo: 'Nos últimos 5 anos, passou por cirurgia, internação ou tem alguma cirurgia indicada?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_internacao_detalhe', rotulo: 'Detalhe (o quê, quando, hospital)', tipo: 'textarea', dependeDe: 'dps_internacao' },
      { id: 'dps_exames_alterados', rotulo: 'Tem exame alterado, investigação em andamento ou consulta de acompanhamento marcada?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_exames_alterados_detalhe', rotulo: 'Detalhe', tipo: 'textarea', dependeDe: 'dps_exames_alterados' },
      { id: 'dps_afastamento', rotulo: 'Nos últimos 2 anos, ficou afastado do trabalho por mais de 15 dias por motivo de saúde?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_afastamento_detalhe', rotulo: 'Detalhe (motivo e período)', tipo: 'textarea', dependeDe: 'dps_afastamento' },
      { id: 'dps_invalidez', rotulo: 'Possui alguma deficiência, invalidez concedida ou aposentadoria por saúde?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_invalidez_detalhe', rotulo: 'Detalhe', tipo: 'textarea', dependeDe: 'dps_invalidez' },
      { id: 'medicamentos', rotulo: 'Usa algum medicamento contínuo? Qual e para quê?', tipo: 'text' },
      { id: 'dps_familia', rotulo: 'Pais ou irmãos tiveram câncer, infarto/AVC ou diabetes antes dos 60 anos?', tipo: 'simnao', obrigatorio: true },
      { id: 'dps_familia_detalhe', rotulo: 'Detalhe (quem e o quê)', tipo: 'textarea', dependeDe: 'dps_familia' },
      { id: 'gestante', rotulo: 'Está gestante?', tipo: 'simnao' },
    ],
  },
  {
    titulo: 'Hábitos e esportes',
    descricao: 'Últimas perguntas rápidas!',
    campos: [
      { id: 'fumante', rotulo: 'Você fuma ou fumou nos últimos 2 anos (cigarro, vape, charuto, narguilé)?', tipo: 'simnao', obrigatorio: true },
      { id: 'fumante_detalhe', rotulo: 'Se sim: o quê e quanto por dia?', tipo: 'text', dependeDe: 'fumante' },
      {
        id: 'alcool', rotulo: 'Consumo de bebida alcoólica', tipo: 'select', obrigatorio: true,
        opcoes: ['Não bebo', 'Socialmente', 'Frequentemente'],
      },
      { id: 'atividade_fisica', rotulo: 'Pratica atividade física regular? Qual?', tipo: 'text' },
      { id: 'esporte_risco', rotulo: 'Pratica esportes de risco (paraquedismo, mergulho, escalada, motovelocidade, lutas...)?', tipo: 'simnao', obrigatorio: true },
      { id: 'esporte_detalhe', rotulo: 'Se sim, quais e com que frequência?', tipo: 'text', dependeDe: 'esporte_risco' },
      { id: 'motocicleta', rotulo: 'Usa motocicleta com frequência (transporte ou lazer)?', tipo: 'simnao', obrigatorio: true },
      { id: 'viagens_frequentes', rotulo: 'Faz viagens internacionais frequentes a trabalho?', tipo: 'simnao' },
    ],
  },
  {
    titulo: 'Seguros atuais',
    descricao: 'Para a seguradora avaliar o conjunto da sua proteção.',
    campos: [
      { id: 'possui_seguro', rotulo: 'Já possui seguro de vida em outra seguradora?', tipo: 'simnao', obrigatorio: true },
      { id: 'possui_seguro_detalhe', rotulo: 'Se sim: seguradora e capital aproximado', tipo: 'text', dependeDe: 'possui_seguro' },
      { id: 'proposta_recusada', rotulo: 'Alguma seguradora já recusou, adiou ou agravou uma proposta sua?', tipo: 'simnao', obrigatorio: true },
      { id: 'proposta_recusada_detalhe', rotulo: 'Se sim, conte o que houve', tipo: 'textarea', dependeDe: 'proposta_recusada' },
    ],
  },
  {
    titulo: 'Beneficiários',
    descricao: 'Quem você quer proteger? Indique as pessoas e o percentual de cada uma.',
    campos: [{ id: 'beneficiarios', tipo: 'beneficiarios' }],
  },
]

// Rótulo de cada campo (para exibir respostas e imprimir a DPS)
export const ROTULOS_FORM = Object.fromEntries(
  ETAPAS_FORM.flatMap((e) => e.campos.map((c) => [c.id, c.rotulo ?? c.id]))
)
