// ─────────────────────────────────────────────────────────────────────────────
// MODO DEMONSTRAÇÃO — banco simulado em memória, com dados FICTÍCIOS.
//
// Liga sozinho quando o .env não tem as credenciais do Supabase (ou com
// VITE_DEMO=1). Serve para: demonstrar o sistema a interessados sem expor
// dados reais, treinar novos usuários e rodar os testes de ponta a ponta.
//
// Implementa o subconjunto da API do Supabase que o Hub usa: query builder
// (select/eq/or/ilike/order/limit/range/single...), relações embutidas
// ('assessores(nome)'), views (vw_*), auth, storage e as functions (rpc).
// Nada é persistido: recarregou a página, os dados demo voltam ao início.
// ─────────────────────────────────────────────────────────────────────────────

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  }))

const hoje = () => new Date()
const iso = (d) => d.toISOString()
// "AAAA-MM-DD" no fuso local (não UTC), para casar com hojeLocal() do frontend
const dia = (d) => { const o = d.getTimezoneOffset() * 60000; return new Date(d - o).toISOString().slice(0, 10) }
const diasAtras = (n) => { const d = hoje(); d.setDate(d.getDate() - n); return d }
const diasFrente = (n) => { const d = hoje(); d.setDate(d.getDate() + n); return d }
const mesTrunc = (d) => `${String(d).slice(0, 7)}-01`
const mesAtras = (n) => { const d = hoje(); d.setMonth(d.getMonth() - n, 1); return dia(d) }

// ─── Dados de exemplo (todos fictícios) ─────────────────────────────────────
function semear() {
  // IDs determinísticos: o banco demo é recriado a cada recarga da página —
  // com IDs fixos, links como /clientes/:id e /proposta/:id sobrevivem ao F5.
  let seq = 0
  const idDemo = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

  const idNat = idDemo(), idRicardo = idDemo(), idJuliana = idDemo(), idPedro = idDemo()
  const assessores = [
    { id: idNat, nome: 'Natália (demonstração)', codigo: 'CS8868', telefone: '(41) 99999-0001', email: 'natalia@demo.com', ativo: true, created_at: iso(diasAtras(400)) },
    { id: idRicardo, nome: 'Ricardo Almeida', codigo: 'A1001', telefone: '(41) 99999-0002', email: 'ricardo@demo.com', ativo: true, created_at: iso(diasAtras(400)) },
    { id: idJuliana, nome: 'Juliana Castro', codigo: 'A2002', telefone: '(41) 99999-0003', email: 'juliana@demo.com', ativo: true, created_at: iso(diasAtras(300)) },
    { id: idPedro, nome: 'Pedro Fontes', codigo: 'A3003', telefone: '(41) 99999-0004', email: 'pedro@demo.com', ativo: true, created_at: iso(diasAtras(200)) },
  ]

  const idMag = idDemo(), idAzos = idDemo(), idIcatu = idDemo(), idOmint = idDemo(), idPrud = idDemo()
  const seguradoras = [
    { id: idMag, nome: 'MAG Seguros', comissao_padrao_percentual: 40, ativo: true },
    { id: idAzos, nome: 'Azos', comissao_padrao_percentual: 40, ativo: true },
    { id: idIcatu, nome: 'Icatu', comissao_padrao_percentual: 45, ativo: true },
    { id: idOmint, nome: 'Omint', comissao_padrao_percentual: 21, ativo: true },
    { id: idPrud, nome: 'Prudential', comissao_padrao_percentual: 40, ativo: true },
  ]

  const cli = (nome, etapa, assessor, extras = {}) => ({
    id: idDemo(), nome, codigo: extras.codigo ?? null, telefone: extras.telefone ?? '(41) 98888-1234',
    email: extras.email ?? null, data_nascimento: extras.nascimento ?? null,
    status_funil: etapa, perfil_necessidade: extras.perfil ?? null, motivo_perda: extras.motivo ?? null,
    id_assessor: assessor, importado: false,
    created_at: iso(extras.criado ?? diasAtras(60)),
    data_entrada_etapa: iso(extras.naEtapa ?? diasAtras(6)),
  })

  const clientes = [
    cli('Carlos Eduardo Menezes', 'fechado', idRicardo, {
      codigo: '100234', telefone: '(41) 98888-0101', email: 'carlos@exemplo.com',
      nascimento: '1985-03-18', perfil: 'Médico, casado, 2 filhos — foco em sucessão e doenças graves.',
      criado: diasAtras(220), naEtapa: diasAtras(180),
    }),
    cli('Fernanda Ribas Antunes', 'fechado', idJuliana, {
      codigo: '100812', telefone: '(41) 98888-0202', nascimento: '1990-11-02',
      perfil: 'Empresária do setor de tecnologia, solteira.', criado: diasAtras(150), naEtapa: diasAtras(120),
    }),
    cli('Rodrigo Sartori', 'proposta_apresentada', idRicardo, {
      telefone: '(41) 98888-0303', nascimento: '1982-07-25',
      perfil: 'Engenheiro autônomo — DIT é essencial.', criado: diasAtras(30), naEtapa: diasAtras(4),
    }),
    cli('Beatriz Kolling', 'estudo_em_andamento', idPedro, {
      telefone: '(41) 98888-0404', criado: diasAtras(20), naEtapa: diasAtras(2),
      perfil: 'Advogada, 1 filha pequena.',
    }),
    cli('Marcos Vinícius Teles', 'agendamento', idJuliana, {
      telefone: '(41) 98888-0505', criado: diasAtras(12), naEtapa: diasAtras(8),
    }),
    cli('Ana Clara Boff', 'lead_recebido', idRicardo, {
      telefone: '(41) 98888-0606', criado: diasAtras(3), naEtapa: diasAtras(3),
    }),
    cli('Gustavo Prado Lima', 'reuniao_realizada', idNat, {
      telefone: '(41) 98888-0707', criado: diasAtras(15), naEtapa: diasAtras(1),
      perfil: 'Indicação direta da consultora (código próprio).',
    }),
    cli('Helena Struck', 'perdido', idPedro, {
      telefone: '(41) 98888-0808', criado: diasAtras(90), naEtapa: diasAtras(45),
      motivo: 'Achou o investimento alto no momento',
    }),
  ]
  const [carlos, fernanda, rodrigo, beatriz, , , gustavo] = clientes

  const apolice = (cliente, seg, premio, capital, pct, extras = {}) => {
    const comissao = Math.round(premio * 12 * pct) / 100
    return {
      id: idDemo(), id_cliente: cliente.id, id_seguradora: seg,
      numero_apolice: extras.numero ?? null, valor_premio_mensal: premio, capital_segurado: capital,
      percentual_comissao: pct, comissao_gerada: comissao,
      comissao_natalia: Math.round(comissao * 40) / 100,
      comissao_assessor: Math.round(comissao * 30) / 100,
      comissao_escritorio: Math.round(comissao * 30) / 100,
      data_vigencia: extras.vigencia ?? dia(diasAtras(200)),
      status: extras.status ?? 'ativa', tipo_produto: extras.tipo ?? 'Seguro Temporário',
      motivo_cancelamento: extras.motivo ?? null, importada: extras.importada ?? false,
      created_at: iso(extras.criado ?? diasAtras(200)),
    }
  }

  const apolices = [
    apolice(carlos, idMag, 850, 2_500_000, 40, { numero: 'AP-77201', vigencia: dia(diasAtras(170)), tipo: 'Seguro Vitalício', criado: diasAtras(170) }),
    // pré-sistema: veio da planilha geral via Importar (aparece separada na aba)
    apolice(carlos, idOmint, 320, 500_000, 21, { numero: 'OM-1108', vigencia: dia(diasAtras(340)), tipo: 'Seguro Temporário', criado: diasAtras(340), importada: true }),
    apolice(fernanda, idAzos, 465, 1_200_000, 40, { numero: 'AZ-55980', vigencia: dia(diasAtras(110)), criado: diasAtras(110) }),
    apolice(fernanda, idIcatu, 210, 300_000, 45, {
      numero: 'IC-30412', vigencia: dia(diasAtras(400)), status: 'cancelada',
      motivo: 'Substituída por apólice maior na Azos', criado: diasAtras(400), importada: true,
    }),
  ]

  const planejamentos = [{
    id: idDemo(), id_cliente: rodrigo.id, profissao: 'Engenheiro civil (autônomo)', estado_civil: 'Casado(a)',
    renda_mensal: 22000, custo_vida_mensal: 14000, patrimonio_total: 900_000, dividas_total: 120_000,
    num_dependentes: 1, dependentes: [{ nome: 'Sofia', idade: 3, custo_mensal: 2100 }], anos_protecao: 21,
    // em branco: o estudo usa a própria sugestão — (11.900 base × 12 × 21) +
    // (2.100 da Sofia × 12 × 21) + 120 mil de dívidas = 3,648 mi
    capital_sugerido: null, objetivos: 'Proteger a renda de autônomo (DIT) e a faculdade da Sofia.',
    observacoes_reuniao: 'Sem CLT — a DIT é o centro do estudo. Quer parcela abaixo de R$ 500.',
    capital_invalidez: null, capital_doencas_graves: null, dit_diaria: 700,
    verba_sucessoria: null, cobertura_atual: 0, itcmd_pct: 4, custas_pct: 8,
    premio_estimado: 480,
    conjuge_nome: 'Paula', filhos_idades: '3 anos',
    // migração 019 — planejamento completo
    tipo_planejamento: 'pf', focos: ['renda', 'educacao', 'dividas'],
    patrimonio_imoveis: 650_000, patrimonio_investimentos: 160_000, patrimonio_empresa: null,
    patrimonio_veiculos: 90_000, patrimonio_outros: null,
    previdencia_saldo: 60_000, previdencia_tipo: 'VGBL', previdencia_aporte_mensal: 800,
    regime_bens: 'Comunhão parcial', tem_holding: false, tem_testamento: false, herdeiros_menores: true,
    pj_razao_social: null, pj_valuation: null, pj_participacao_pct: null, pj_num_socios: null,
    pj_faturamento_anual: null, pj_lucro_anual: null, pj_divida_avalizada: null,
    capital_socios: null, capital_homem_chave: null, capital_aval: null,
    capital_morte_acidental: null, capital_fraturas: null,
    dih_diaria: 700, dih_dias: 30, dit_dias: 90, dit_franquia_dias: 15,
    funeral_individual: 15_000, funeral_familiar: 15_000,
    // anual com 5% de desconto sobre as 12 parcelas de R$ 480
    premio_anual: 5_472, forma_pagamento: 'mensal',
    // migração 021 — perfil de risco, aposentadoria e o que ele já tem
    fumante: false, renda_desejada_aposentadoria: null, idade_aposentadoria: null,
    seguros_existentes: [
      { origem: 'consignado', descricao: 'Prestamista do financiamento do imóvel',
        capital: 120_000, custeio: 'proprio' },
    ],
    quem_decide: null, prazo_decisao: null,
    // migração 023 — ainda sem desenho: é o estado em que toda proposta nasce
    anotacoes_proposta: {},
    token_proposta: 'demo-proposta-rodrigo', roteiro: {},
    created_at: iso(diasAtras(10)), updated_at: iso(diasAtras(2)),
  }, {
    id: idDemo(), id_cliente: carlos.id, profissao: 'Médico cardiologista', estado_civil: 'Casado(a)',
    renda_mensal: 48000, custo_vida_mensal: 27000, patrimonio_total: 3_800_000, dividas_total: 250_000,
    num_dependentes: 2,
    // filhos com o gasto mensal de hoje — o estudo garante só até os 24 anos
    dependentes: [
      { nome: 'Alice', idade: 6, custo_mensal: 3200 },
      { nome: 'Lucas', idade: 9, custo_mensal: 3800 },
    ],
    anos_protecao: 10,
    // em branco: o estudo calcula (20.000 base × 12 × 10) + 1,375 mi dos filhos
    // até os 24 + 250 mil de dívidas = 4,025 mi
    capital_sugerido: null, objetivos: 'Garantir a faculdade dos filhos, blindar o patrimônio e proteger a sociedade da clínica.',
    observacoes_reuniao: 'Preocupado com sucessão da clínica. Esposa não trabalha fora. Quer revisar previdência no 2º semestre.',
    capital_invalidez: null, capital_doencas_graves: null, dit_diaria: 1600,
    verba_sucessoria: null, cobertura_atual: 800_000, itcmd_pct: 4, custas_pct: 8,
    premio_estimado: 1890,
    conjuge_nome: 'Mariana', filhos_idades: '6 e 9 anos',
    // migração 019 — estudo PF + PJ, com sucessão e acordo de sócios
    tipo_planejamento: 'pf_pj',
    focos: ['renda', 'educacao', 'sucessao', 'blindagem', 'empresarial', 'aposentadoria'],
    patrimonio_imoveis: 2_300_000, patrimonio_investimentos: 700_000, patrimonio_empresa: 600_000,
    patrimonio_veiculos: 200_000, patrimonio_outros: null,
    previdencia_saldo: 450_000, previdencia_tipo: 'PGBL', previdencia_aporte_mensal: 4_000,
    regime_bens: 'Comunhão parcial', tem_holding: false, tem_testamento: false, herdeiros_menores: true,
    pj_razao_social: 'Cardiocare Serviços Médicos Ltda', pj_valuation: 1_500_000,
    pj_participacao_pct: 40, pj_num_socios: 3,
    pj_faturamento_anual: 4_200_000, pj_lucro_anual: 900_000, pj_divida_avalizada: 350_000,
    capital_socios: null, capital_homem_chave: null, capital_aval: null,
    capital_morte_acidental: null, capital_fraturas: null,
    dih_diaria: 1600, dih_dias: 60, dit_dias: 180, dit_franquia_dias: 15,
    funeral_individual: 20_000, funeral_familiar: 20_000,
    // anual com 10% de desconto sobre as 12 parcelas de R$ 1.890
    premio_anual: 20_412, forma_pagamento: 'anual',
    // migração 021 — quer parar aos 60 com R$ 20 mil por mês; o seguro que ele
    // tem hoje é da clínica, e acaba no dia em que ele sair de lá
    fumante: false, renda_desejada_aposentadoria: 20_000, idade_aposentadoria: 60,
    seguros_existentes: [
      { origem: 'empresa', descricao: 'Vida em grupo da Cardiocare',
        capital: 500_000, custeio: 'empresa' },
      { origem: 'banco', descricao: 'Seguro do financiamento da sala comercial',
        capital: 300_000, custeio: 'proprio' },
    ],
    quem_decide: 'Ele e a esposa, juntos', prazo_decisao: 'Quer decidir até o fim do mês',
    // migração 022 — a tabela de resgate colada da cotação do resgatável
    seguro_resgatavel: [
      { ano: 5, resgate: 42_000 }, { ano: 10, resgate: 138_000 },
      { ano: 15, resgate: 268_000 }, { ano: 20, resgate: 432_000 },
      { ano: 30, resgate: 840_000 },
    ],
    comparador_alternativa: 'pgbl', comparador_taxa_real: 4, aliquota_ir_cliente: 27.5,
    premio_temporario_mensal: 640,
    // migração 023 — o círculo que ela fez em volta do déficit de liquidez na
    // reunião de fechamento, guardado por nome de capítulo e em coordenadas
    // relativas (0..1), do jeito que sai do quadro de desenho
    anotacoes_proposta: {
      sucessao: [{ t: 'caneta', c: '#d96527', l: 0.0032, p: [
        0.6566, 0.5091, 0.45, 0.6694, 0.5589, 0.53, 0.6432, 0.6066, 0.6,
        0.5841, 0.6413, 0.67, 0.5056, 0.6549, 0.72, 0.4258, 0.6445, 0.77,
        0.3631, 0.6122, 0.79, 0.3319, 0.5657, 0.8, 0.3394, 0.5155, 0.79,
        0.3839, 0.4733, 0.77, 0.4551, 0.4487, 0.72, 0.5366, 0.4475, 0.67,
        0.6097, 0.4698, 0.6, 0.6576, 0.5106, 0.53, 0.6692, 0.5605, 0.45,
      ] }],
    },
    token_proposta: 'demo-proposta-carlos',
    roteiro: { blocos: {
      abertura: { feito: true, nota: 'Muito receptivo. Falou da clínica e dos dois filhos.' },
      descoberta: { feito: true, nota: 'Esposa não trabalha fora. Preocupado com a faculdade dos filhos.' },
    } },
    created_at: iso(diasAtras(180)), updated_at: iso(diasAtras(30)),
  }]

  const reunioes = [
    { id: idDemo(), id_cliente: rodrigo.id, data_hora: iso(diasFrente(2)), status: 'agendada', notas: 'Apresentar proposta ajustada', created_at: iso(diasAtras(3)) },
    { id: idDemo(), id_cliente: beatriz.id, data_hora: iso(diasFrente(5)), status: 'agendada', notas: 'Coleta de dados para o estudo', created_at: iso(diasAtras(2)) },
    { id: idDemo(), id_cliente: carlos.id, data_hora: iso(diasAtras(175)), status: 'realizada', notas: 'Fechamento da apólice MAG', created_at: iso(diasAtras(180)) },
    { id: idDemo(), id_cliente: gustavo.id, data_hora: iso(diasAtras(1)), status: 'realizada', notas: 'Primeira reunião — perfil levantado', created_at: iso(diasAtras(4)) },
  ]

  const interacoes = [
    { id: idDemo(), id_cliente: carlos.id, tipo: 'whatsapp', descricao: 'Enviado resumo anual da apólice. Cliente satisfeito.', data: iso(diasAtras(20)), created_at: iso(diasAtras(20)) },
    { id: idDemo(), id_cliente: rodrigo.id, tipo: 'ligacao', descricao: 'Dúvidas sobre carência da DIT — esclarecidas.', data: iso(diasAtras(2)), created_at: iso(diasAtras(2)) },
    { id: idDemo(), id_cliente: fernanda.id, tipo: 'reuniao', descricao: 'Revisão anual — aumentar capital em 20% no próximo ciclo.', data: iso(diasAtras(40)), created_at: iso(diasAtras(40)) },
  ]

  const tarefas = [
    { id: idDemo(), id_cliente: rodrigo.id, titulo: 'Follow-up da proposta apresentada', descricao: null, tipo: 'contato', data_vencimento: dia(hoje()), concluida: false, automatica: true, created_at: iso(diasAtras(4)) },
    { id: idDemo(), id_cliente: beatriz.id, titulo: 'Montar estudo de proteção', descricao: null, tipo: 'planejamento', data_vencimento: dia(diasFrente(1)), concluida: false, automatica: true, created_at: iso(diasAtras(2)) },
    { id: idDemo(), id_cliente: carlos.id, titulo: 'Revisão anual da apólice', descricao: null, tipo: 'revisao', data_vencimento: dia(diasFrente(10)), concluida: false, automatica: true, created_at: iso(diasAtras(30)) },
  ]

  const formularios = [{
    id: idDemo(), id_cliente: carlos.id, token: 'demo-dps-token', status: 'concluido', etapa_atual: 8,
    respostas: {
      nome_completo: 'Carlos Eduardo Menezes', cpf: '000.000.000-00', data_nascimento: '1985-03-18',
      sexo: 'Masculino', estado_civil: 'Casado(a)', email: 'carlos@exemplo.com', telefone: '(41) 98888-0101',
      cep: '80000-000', endereco: 'Rua das Araucárias, 1200', cidade: 'Curitiba', uf: 'PR',
      profissao: 'Médico cardiologista', renda_mensal: '48000', atividade_risco: 'nao', ppe: 'nao',
      altura_cm: '178', peso_kg: '84', dps_pressao_coracao: 'sim',
      dps_pressao_coracao_detalhe: 'Hipertensão leve desde 2020, controlada com losartana 50mg.',
      dps_diabetes: 'nao', dps_cancer: 'nao', dps_respiratorio: 'nao', dps_neurologico: 'nao',
      dps_psiquiatrico: 'nao', dps_digestivo_renal: 'nao', dps_coluna_articulacoes: 'nao',
      dps_infecciosa: 'nao', dps_internacao: 'nao', dps_exames_alterados: 'nao', dps_afastamento: 'nao',
      dps_invalidez: 'nao', medicamentos: 'Losartana 50mg', dps_familia: 'sim',
      dps_familia_detalhe: 'Pai infartou aos 58 anos.', fumante: 'nao', alcool: 'Socialmente',
      atividade_fisica: 'Corrida 3x por semana', esporte_risco: 'nao', motocicleta: 'nao',
      possui_seguro: 'sim', possui_seguro_detalhe: 'Seguro empresarial da clínica (R$ 800 mil)',
      proposta_recusada: 'nao',
      beneficiarios: [
        { nome: 'Mariana Menezes', relacao: 'Cônjuge', percentual: 50 },
        { nome: 'Filhos (menores)', relacao: 'Filhos', percentual: 50 },
      ],
    },
    enviado_em: iso(diasAtras(178)), iniciado_em: iso(diasAtras(178)), concluido_em: iso(diasAtras(177)),
    updated_at: iso(diasAtras(177)),
  }, {
    id: idDemo(), id_cliente: rodrigo.id, token: 'demo-dps-aberta', status: 'pendente', etapa_atual: 0,
    respostas: {}, enviado_em: iso(diasAtras(2)), iniciado_em: null, concluido_em: null, updated_at: iso(diasAtras(2)),
  }]

  // Comissões importadas: 3 competências, várias seguradoras, Nati × Bruno
  const m0 = mesTrunc(mesAtras(0)), m1 = mesTrunc(mesAtras(1)), m2 = mesTrunc(mesAtras(2))
  const com = (competencia, seguradora, cliente, valor, extras = {}) => ({
    id: idDemo(), competencia, seguradora, segmento: extras.segmento ?? 'individual',
    tipo_receita: extras.receita ?? 'recorrente', cliente_nome: cliente,
    codigo_cliente: extras.cod ?? null, id_cliente: extras.idCliente ?? null,
    codigo_assessor: extras.codAssessor ?? 'A1001', id_assessor: extras.idAssessor ?? idRicardo,
    producao: extras.producao ?? 'Nati', parcela: extras.parcela ?? 3, valor,
    origem: 'demo', criado_em: iso(hoje()),
  })
  const comissoes_importadas = []
  for (const [mes, fator] of [[m2, 0.92], [m1, 1], [m0, 1.08]]) {
    comissoes_importadas.push(
      com(mes, 'MAG Seguros', 'Carlos Eduardo Menezes', 412.30 * fator, { cod: '100234', idCliente: carlos.id }),
      com(mes, 'MAG Seguros', 'Fernanda Ribas Antunes', 188.15 * fator, { cod: '100812', idCliente: fernanda.id, codAssessor: 'A2002', idAssessor: idJuliana }),
      com(mes, 'MAG Seguros', 'Otávio Brandt', 96.40 * fator, { producao: 'Bruno', codAssessor: 'A3003', idAssessor: idPedro }),
      com(mes, 'Azos', 'Fernanda Ribas Antunes', 186.00 * fator, { cod: '100812', idCliente: fernanda.id, codAssessor: 'A2002', idAssessor: idJuliana }),
      com(mes, 'Azos', 'Laura Zimmer', 74.90 * fator, { producao: 'Bruno', codAssessor: 'A1001' }),
      com(mes, 'Icatu', 'Carlos Eduardo Menezes', 145.75 * fator, { cod: '100234', idCliente: carlos.id, segmento: 'empresarial' }),
      com(mes, 'Omint', 'Gustavo Prado Lima', 98.60 * fator, { idCliente: gustavo.id, codAssessor: 'CS8868', idAssessor: idNat }),
    )
  }
  // venda nova + campanha no mês atual + um estorno
  comissoes_importadas.push(
    com(m0, 'Azos', 'Rodrigo Sartori', 512.00, { receita: 'venda_nova', parcela: 1, idCliente: rodrigo.id }),
    com(m0, 'Azos', 'Campanha Multiplicazos', 274.00, { receita: 'campanha', segmento: 'campanha', producao: 'Nati', codAssessor: 'CS8868', idAssessor: idNat, parcela: null }),
    com(m0, 'MAG Seguros', 'Helena Struck', -84.12, { producao: 'Bruno', codAssessor: 'A3003', idAssessor: idPedro }),
  )
  // pendências de classificação (exercitam o fluxo "É da Nati / vincular assessor")
  const pendente = com(m0, 'Icatu', 'Vera Lúcia Camargo', 67.40, {})
  pendente.producao = null
  pendente.codigo_assessor = null
  pendente.id_assessor = null
  comissoes_importadas.push(pendente)

  const fila_mensagens = [
    { id: idDemo(), id_cliente: carlos.id, tipo: 'aniversario_apolice', telefone: carlos.telefone, mensagem: 'Olá Carlos! Sua apólice está completando mais um ano 🎉 Que tal marcarmos uma revisão?', data_alvo: dia(hoje()), status: 'pendente', enviada_em: null, created_at: iso(hoje()) },
    { id: idDemo(), id_cliente: rodrigo.id, tipo: 'manual', telefone: rodrigo.telefone, mensagem: 'Oi Rodrigo! Ficou alguma dúvida da proposta que apresentei?', data_alvo: dia(hoje()), status: 'pendente', enviada_em: null, created_at: iso(hoje()) },
  ]

  const historico_funil = clientes.flatMap((c) => [
    { id: idDemo(), id_cliente: c.id, etapa_anterior: null, etapa_nova: 'lead_recebido', mudou_em: c.created_at },
    ...(c.status_funil !== 'lead_recebido'
      ? [{ id: idDemo(), id_cliente: c.id, etapa_anterior: 'lead_recebido', etapa_nova: c.status_funil, mudou_em: c.data_entrada_etapa }]
      : []),
  ])

  // Transcrição de reunião (migração 020): o Tactiq gera exatamente neste
  // formato — carimbo de tempo, nome do participante e a fala.
  const transcricoes = [{
    id: idDemo(), id_cliente: carlos.id, id_reuniao: null,
    titulo: 'Reunião de descoberta — Carlos', data_reuniao: dia(diasAtras(30)),
    origem: 'tactiq', analise: {}, resumo: null,
    texto: [
      '# Transcript of Reunião — Carlos Eduardo Menezes',
      'https://tactiq.io/transcripts/demo',
      '',
      '00:00:04 Natália Maschendorf: Carlos, boa tarde! Tudo bem? Obrigada pelo tempo de hoje.',
      '00:00:11 Carlos Menezes: Boa tarde, Natália. Tudo ótimo.',
      '00:00:16 Natália Maschendorf: Hoje é uma conversa, não é uma venda. Me conta um pouco de você e da sua família.',
      '00:00:41 Carlos Menezes: Sou médico cardiologista, tenho uma clínica com mais dois sócios. Sou casado, minha esposa Mariana não trabalha fora. Temos dois filhos, a Alice tem 6 anos e o Lucas tem 9 anos.',
      '00:01:12 Natália Maschendorf: E como está a sua renda hoje?',
      '00:01:30 Carlos Menezes: Minha renda gira em torno de R$ 48.000 por mês, entre a clínica e os plantões.',
      '00:01:42 Natália Maschendorf: E o custo de vida da família, quanto vocês gastam por mês?',
      '00:01:50 Carlos Menezes: Com escola, condomínio e plano de saúde, o custo de vida fica em uns R$ 27 mil por mês.',
      '00:02:05 Natália Maschendorf: Tem algum financiamento em aberto?',
      '00:02:11 Carlos Menezes: Tenho o financiamento do apartamento da praia, uns R$ 250 mil de saldo devedor.',
      '00:02:22 Natália Maschendorf: E o patrimônio que vocês construíram?',
      '00:02:29 Carlos Menezes: Os imóveis somam uns R$ 2,3 milhões, tenho R$ 700 mil investido entre CDB e fundos, os carros dão uns R$ 200 mil. E tem a previdência, um PGBL com R$ 450 mil.',
      '00:03:02 Natália Maschendorf: E a clínica, quanto ela fatura?',
      '00:03:08 Carlos Menezes: O faturamento é de uns R$ 4,2 milhões por ano. Eu tenho 40% do capital social.',
      '00:03:32 Natália Maschendorf: Se a sua renda parasse hoje, por quanto tempo a família manteria o padrão de vida?',
      '00:03:45 Carlos Menezes: Nossa, nunca pensei nisso direito. Sinceramente, me preocupa. Acho que uns dois anos consumindo o que a gente tem.',
      '00:04:05 Natália Maschendorf: E aí entra o inventário: os bens ficam travados até o ITCMD ser pago, e o imposto se paga em dinheiro.',
      '00:04:20 Carlos Menezes: Isso eu vivi. Quando meu pai faleceu o inventário levou três anos, minha mãe passou aperto. É exatamente isso que eu não quero para a Mariana.',
      '00:04:40 Natália Maschendorf: Muita gente acha que seguro só paga se a pessoa morrer, mas a maior parte paga em vida: invalidez, doenças graves, DIT, diária de internação hospitalar, fraturas e morte acidental. Tem também a assistência funeral.',
      '00:05:10 Carlos Menezes: Não sabia disso de doenças graves. Paga em vida mesmo?',
      '00:05:30 Natália Maschendorf: Paga no diagnóstico. Deixa eu te mostrar a proposta com o capital e a verba de inventário.',
      '00:06:15 Carlos Menezes: Faz sentido. E qual seria o investimento mensal?',
      '00:06:22 Natália Maschendorf: O prêmio ficaria em R$ 1.890 por mês, ou R$ 20.412 à vista no ano, com 10% de desconto.',
      '00:06:38 Carlos Menezes: Achei um pouco caro. Mas preciso conversar com minha esposa antes de decidir.',
      '00:07:12 Carlos Menezes: E quando começa a valer a cobertura? Preciso fazer exame?',
      '00:07:33 Natália Maschendorf: Na maioria dos casos só a declaração de saúde, que é um formulário online.',
      '00:07:52 Natália Maschendorf: Vou te enviar a proposta hoje ainda pelo link. E vamos marcar a call com a Mariana para quinta-feira.',
      '00:08:05 Carlos Menezes: Pode ser quinta à noite. Vou falar com ela hoje.',
    ].join('\n'),
    created_at: iso(diasAtras(30)), updated_at: iso(diasAtras(30)),
  }]

  // Propostas na seguradora (migração 024): o vão entre "o cliente disse sim" e
  // "a apólice existe". Três estados que a consultora vive de verdade — uma
  // travada com o cliente, uma andando dentro do prazo e uma aprovada
  // esperando só a emissão.
  const propostas_seguradora = [
    {
      id: idDemo(), id_cliente: rodrigo.id, id_seguradora: seguradoras[0].id,
      numero_proposta: 'PRP-2026-4471', data_envio: dia(diasAtras(19)),
      capital: 1_200_000, premio_mensal: 940, situacao: 'exigencia',
      exigencias: [
        { o_que: 'Exame de sangue e eletrocardiograma', de_quem: 'cliente',
          pedida_em: dia(diasAtras(13)), resolvida_em: null },
        { o_que: 'Declaração pessoal de saúde assinada', de_quem: 'cliente',
          pedida_em: dia(diasAtras(13)), resolvida_em: dia(diasAtras(8)) },
      ],
      motivo_recusa: null, observacoes: 'Cliente viajou a trabalho, prometeu fazer o exame na volta.',
      id_apolice: null, created_at: iso(diasAtras(19)), updated_at: iso(diasAtras(13)),
    },
    {
      id: idDemo(), id_cliente: gustavo.id, id_seguradora: seguradoras[1]?.id ?? seguradoras[0].id,
      numero_proposta: 'PRP-2026-4620', data_envio: dia(diasAtras(4)),
      capital: 600_000, premio_mensal: 410, situacao: 'em_analise',
      exigencias: [], motivo_recusa: null, observacoes: null,
      id_apolice: null, created_at: iso(diasAtras(4)), updated_at: iso(diasAtras(4)),
    },
    {
      id: idDemo(), id_cliente: beatriz.id, id_seguradora: seguradoras[0].id,
      numero_proposta: 'PRP-2026-4388', data_envio: dia(diasAtras(26)),
      capital: 850_000, premio_mensal: 620, situacao: 'aprovada',
      exigencias: [
        { o_que: 'Parecer da mesa médica', de_quem: 'seguradora',
          pedida_em: dia(diasAtras(20)), resolvida_em: dia(diasAtras(9)) },
      ],
      motivo_recusa: null, observacoes: 'Aprovada sem agravo. Falta emitir.',
      id_apolice: null, created_at: iso(diasAtras(26)), updated_at: iso(diasAtras(9)),
    },
  ]

  return {
    assessores, seguradoras, clientes, apolices, planejamentos, reunioes, interacoes, tarefas,
    transcricoes, propostas_seguradora,
    formularios_onboarding: formularios, comissoes_importadas, fila_mensagens, historico_funil,
    documentos: [], agenda_externa: [],
    configuracoes: [{
      id: 1, split_natalia_pct: 40, split_assessor_pct: 30, split_escritorio_pct: 30,
      imposto_pct: 20, codigo_natalia: 'CS8868', dias_alerta_amarelo: 5, dias_alerta_vermelho: 10,
      dias_sem_contato_alerta: 90, meta_premio_mensal: 5000, meta_reunioes_mensal: 12,
      meta_apolices_mensal: 4, meta_comissao_mensal: 15000,
      msg_aniversario: 'Olá {nome}! 🎉 Feliz aniversário!', msg_aniversario_apolice: 'Olá {nome}! Sua apólice faz aniversário!',
      updated_at: iso(hoje()),
    }],
  }
}

// ─── Views calculadas sobre os dados ─────────────────────────────────────────
function criarViews(db) {
  const porId = (tabela) => new Map(db[tabela].map((r) => [r.id, r]))
  const diasDesde = (d) => Math.floor((hoje() - new Date(d)) / 86400000)
  const proxAniversario = (d) => {
    if (!d) return null
    const base = new Date(d)
    const prox = new Date(hoje().getFullYear(), base.getMonth(), base.getDate())
    if (prox < new Date(dia(hoje()))) prox.setFullYear(prox.getFullYear() + 1)
    return prox
  }

  const vwPipeline = () => db.clientes.map((c) => ({
    id: c.id, nome: c.nome, telefone: c.telefone, status_funil: c.status_funil,
    perfil_necessidade: c.perfil_necessidade, data_entrada_etapa: c.data_entrada_etapa,
    dias_na_etapa: diasDesde(c.data_entrada_etapa),
    id_assessor: c.id_assessor, nome_assessor: porId('assessores').get(c.id_assessor)?.nome ?? '',
  }))

  const vwRegua = () => {
    const linhas = []
    for (const c of db.clientes) {
      if (c.data_nascimento) {
        const ev = proxAniversario(c.data_nascimento)
        linhas.push({ tipo_evento: 'aniversario_cliente', id_cliente: c.id, nome_cliente: c.nome, telefone: c.telefone, data_evento: dia(ev), dias_restantes: Math.round((ev - new Date(dia(hoje()))) / 86400000) })
      }
    }
    for (const a of db.apolices.filter((x) => x.status === 'ativa')) {
      const c = porId('clientes').get(a.id_cliente)
      if (!c) continue
      const ev = proxAniversario(a.data_vigencia)
      linhas.push({ tipo_evento: 'aniversario_apolice', id_cliente: c.id, nome_cliente: c.nome, telefone: c.telefone, data_evento: dia(ev), dias_restantes: Math.round((ev - new Date(dia(hoje()))) / 86400000) })
    }
    return linhas.sort((x, y) => x.dias_restantes - y.dias_restantes)
  }

  const vwPrioridades = () => {
    const ORDEM = { lead_recebido: 1, agendamento: 2, reuniao_realizada: 3, estudo_em_andamento: 4, proposta_apresentada: 5, em_analise: 6, fechado: 7, perdido: 0 }
    return vwPipeline().filter((p) => !['fechado', 'perdido'].includes(p.status_funil)).map((p) => {
      const c = porId('clientes').get(p.id)
      const plano = db.planejamentos.find((x) => x.id_cliente === p.id)
      const prox = db.reunioes.filter((r) => r.id_cliente === p.id && r.status === 'agendada' && new Date(r.data_hora) >= hoje())
        .sort((a, b) => a.data_hora.localeCompare(b.data_hora))[0]
      const acao = p.status_funil === 'lead_recebido' ? 'Fazer 1º contato e agendar reunião'
        : p.status_funil === 'agendamento' ? (prox ? 'Reunião marcada — confirmar presença' : 'Agendar a reunião')
        : p.status_funil === 'reuniao_realizada' ? 'Montar o estudo/planejamento'
        : p.status_funil === 'estudo_em_andamento' ? (plano ? 'Gerar e apresentar a proposta' : 'Preencher o planejamento da reunião')
        : p.status_funil === 'proposta_apresentada' ? 'Fazer follow-up da proposta'
        : p.status_funil === 'em_analise' ? 'Retomar contato para fechar' : 'Acompanhar'
      const score = Math.round(((ORDEM[p.status_funil] ?? 0) * 8 + Math.min(p.dias_na_etapa, 30)
        + Math.min((plano?.capital_sugerido ?? 0) / 100000, 25) + (prox ? 10 : 0)) * 10) / 10
      return {
        ...p, codigo: c?.codigo ?? null, capital_sugerido: plano?.capital_sugerido ?? null,
        proxima_reuniao: prox?.data_hora ?? null, proxima_acao: acao, score,
        temperatura: score >= 55 ? 'quente' : score >= 32 ? 'morno' : 'frio',
      }
    }).sort((a, b) => b.score - a.score)
  }

  const vwClientesContato = () => db.clientes.map((c) => {
    const datas = [
      ...db.interacoes.filter((i) => i.id_cliente === c.id).map((i) => i.data),
      ...db.reunioes.filter((r) => r.id_cliente === c.id && r.status === 'realizada').map((r) => r.data_hora),
    ]
    const ultimo = datas.length ? datas.sort().at(-1) : null
    return {
      id: c.id, nome: c.nome, codigo: c.codigo, telefone: c.telefone, status_funil: c.status_funil,
      ultimo_contato: ultimo, dias_sem_contato: ultimo == null ? null : diasDesde(ultimo),
    }
  })

  const mesesApolices = () => {
    const m = new Map()
    for (const a of db.apolices) {
      const mes = mesTrunc(a.created_at)
      const acc = m.get(mes) ?? { apolices: 0, premio: 0, comissao: 0, nat: 0, ass: 0, esc: 0 }
      acc.apolices += 1; acc.premio += Number(a.valor_premio_mensal); acc.comissao += Number(a.comissao_gerada ?? 0)
      acc.nat += Number(a.comissao_natalia ?? 0); acc.ass += Number(a.comissao_assessor ?? 0); acc.esc += Number(a.comissao_escritorio ?? 0)
      m.set(mes, acc)
    }
    return m
  }

  // Espelha a view SQL da migração 024: só as propostas vivas, com os dias
  // parados calculados. A conta fica aqui pelo mesmo motivo que fica no banco —
  // a resposta tem que ser a mesma em toda tela que perguntar.
  const vwPropostasAbertas = () => {
    const cli = porId('clientes')
    const seg = porId('seguradoras')
    const ABERTAS = new Set(['enviada', 'em_analise', 'exigencia', 'aprovada'])
    return (db.propostas_seguradora ?? [])
      .filter((p) => ABERTAS.has(p.situacao))
      .map((p) => {
        const pendentes = (p.exigencias ?? []).filter((e) => !e.resolvida_em)
        return {
          ...p,
          cliente_nome: cli.get(p.id_cliente)?.nome ?? '—',
          cliente_telefone: cli.get(p.id_cliente)?.telefone ?? null,
          seguradora_nome: seg.get(p.id_seguradora)?.nome ?? null,
          dias_na_seguradora: diasDesde(p.data_envio),
          exigencias_abertas: pendentes.length,
          dias_exigencia_mais_antiga: pendentes.length
            ? Math.max(...pendentes.map((e) => diasDesde(e.pedida_em))) : null,
        }
      })
  }

  return {
    vw_propostas_abertas: vwPropostasAbertas,
    vw_pipeline: vwPipeline,
    vw_regua_relacionamento: vwRegua,
    vw_prioridades_classificadas: vwPrioridades,
    vw_clientes_contato: vwClientesContato,
    vw_clientes_sem_contato: () => vwClientesContato().filter((c) =>
      db.apolices.some((a) => a.id_cliente === c.id && a.status === 'ativa')
      && (c.dias_sem_contato == null || c.dias_sem_contato >= 90)),
    vw_funil_contagem: () => {
      const ORDEM = { lead_recebido: 1, agendamento: 2, reuniao_realizada: 3, estudo_em_andamento: 4, proposta_apresentada: 5, em_analise: 6, fechado: 7, perdido: 8 }
      const m = new Map()
      for (const c of db.clientes) m.set(c.status_funil, (m.get(c.status_funil) ?? 0) + 1)
      return [...m.entries()].map(([status_funil, total]) => ({ status_funil, ordem: ORDEM[status_funil] ?? 9, total }))
        .sort((a, b) => a.ordem - b.ordem)
    },
    vw_kpis_gerais: () => {
      const fechados = db.clientes.filter((c) => c.status_funil === 'fechado').length
      const perdidos = db.clientes.filter((c) => c.status_funil === 'perdido').length
      const ativas = db.apolices.filter((a) => a.status === 'ativa')
      return [{
        total_clientes: db.clientes.length, total_fechados: fechados, total_perdidos: perdidos,
        taxa_conversao_pct: fechados + perdidos > 0 ? Math.round(fechados / (fechados + perdidos) * 1000) / 10 : 0,
        ticket_medio_premio: db.apolices.length ? Math.round(db.apolices.reduce((s, a) => s + Number(a.valor_premio_mensal), 0) / db.apolices.length * 100) / 100 : 0,
        dias_medios_ate_fechar: 21.5,
        capital_total_carteira: ativas.reduce((s, a) => s + Number(a.capital_segurado), 0),
      }]
    },
    vw_dashboard_mensal: () => {
      const m = mesesApolices()
      for (const r of db.reunioes.filter((x) => x.status === 'realizada')) {
        const mes = mesTrunc(r.data_hora)
        if (!m.has(mes)) m.set(mes, { apolices: 0, premio: 0, comissao: 0, nat: 0, ass: 0, esc: 0 })
      }
      return [...m.entries()].map(([mes, v]) => ({
        mes,
        reunioes_realizadas: db.reunioes.filter((r) => r.status === 'realizada' && mesTrunc(r.data_hora) === mes).length,
        apolices_vendidas: v.apolices, premio_mensal_vendido: v.premio, comissao_gerada: v.comissao,
      })).sort((a, b) => b.mes.localeCompare(a.mes))
    },
    vw_comissoes_mensal: () => [...mesesApolices().entries()].map(([mes, v]) => ({
      mes, apolices: v.apolices, premio_mensal_total: v.premio, comissao_total: v.comissao,
      comissao_natalia: v.nat, comissao_assessor: v.ass, comissao_escritorio: v.esc,
    })).sort((a, b) => b.mes.localeCompare(a.mes)),
    vw_comissoes_assessor_mensal: () => {
      const m = new Map()
      for (const a of db.apolices) {
        const c = porId('clientes').get(a.id_cliente); if (!c) continue
        const ass = porId('assessores').get(c.id_assessor); if (!ass) continue
        const k = `${mesTrunc(a.created_at)}|${ass.id}`
        const acc = m.get(k) ?? { mes: mesTrunc(a.created_at), id_assessor: ass.id, nome_assessor: ass.nome, vendas: 0, premio_mensal_total: 0, comissao_a_pagar: 0 }
        acc.vendas += 1; acc.premio_mensal_total += Number(a.valor_premio_mensal); acc.comissao_a_pagar += Number(a.comissao_assessor ?? 0)
        m.set(k, acc)
      }
      return [...m.values()]
    },
    vw_motivos_perda: () => {
      const m = new Map()
      for (const c of db.clientes.filter((x) => x.status_funil === 'perdido')) {
        const k = c.motivo_perda?.trim() || '(sem motivo registrado)'
        m.set(k, (m.get(k) ?? 0) + 1)
      }
      return [...m.entries()].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total)
    },
    vw_tempo_medio_etapa: () => [
      { etapa: 'lead_recebido', ordem: 1, dias_medios: 2.5, passagens: 9 },
      { etapa: 'agendamento', ordem: 2, dias_medios: 4.1, passagens: 7 },
      { etapa: 'reuniao_realizada', ordem: 3, dias_medios: 3.2, passagens: 6 },
      { etapa: 'estudo_em_andamento', ordem: 4, dias_medios: 5.8, passagens: 5 },
      { etapa: 'proposta_apresentada', ordem: 5, dias_medios: 6.4, passagens: 4 },
    ],
    vw_conversao_mensal: () => {
      const m = new Map()
      for (const c of db.clientes) {
        const mes = mesTrunc(c.created_at)
        const acc = m.get(mes) ?? { mes, leads_criados: 0, fechados: 0 }
        acc.leads_criados += 1
        if (c.status_funil === 'fechado') acc.fechados += 1
        m.set(mes, acc)
      }
      return [...m.values()].sort((a, b) => b.mes.localeCompare(a.mes))
    },
    vw_possiveis_duplicados: () => [],
    vw_carteira: () => {
      const ativas = db.apolices.filter((a) => a.status === 'ativa')
      const premio = ativas.reduce((s, a) => s + Number(a.valor_premio_mensal), 0)
      return [{
        apolices_ativas: ativas.length, receita_mensal_recorrente: premio, receita_anualizada: premio * 12,
        capital_total: ativas.reduce((s, a) => s + Number(a.capital_segurado), 0),
        comissao_natalia_carteira: ativas.reduce((s, a) => s + Number(a.comissao_natalia ?? 0), 0),
        ticket_medio: ativas.length ? Math.round(premio / ativas.length * 100) / 100 : 0,
      }]
    },
    vw_carteira_seguradora: () => {
      const m = new Map()
      for (const a of db.apolices.filter((x) => x.status === 'ativa')) {
        const s = porId('seguradoras').get(a.id_seguradora)
        const acc = m.get(s.nome) ?? { nome: s.nome, apolices: 0, premio_mensal: 0, capital_total: 0 }
        acc.apolices += 1; acc.premio_mensal += Number(a.valor_premio_mensal); acc.capital_total += Number(a.capital_segurado)
        m.set(s.nome, acc)
      }
      return [...m.values()].sort((a, b) => b.premio_mensal - a.premio_mensal)
    },
    vw_ranking_assessores: () => db.assessores.map((a) => {
      const cls = db.clientes.filter((c) => c.id_assessor === a.id)
      const aps = db.apolices.filter((ap) => cls.some((c) => c.id === ap.id_cliente))
      return {
        id: a.id, nome: a.nome, total_vendas: aps.length,
        premio_mensal_total: aps.reduce((s, x) => s + Number(x.valor_premio_mensal), 0),
        comissao_total: aps.reduce((s, x) => s + Number(x.comissao_gerada ?? 0), 0),
        total_leads: cls.length,
        taxa_conversao_pct: cls.length ? Math.round(aps.length / cls.length * 1000) / 10 : 0,
      }
    }).sort((a, b) => b.total_vendas - a.total_vendas),
    vw_assessor_resumo: () => db.assessores.map((a) => {
      const cls = db.clientes.filter((c) => c.id_assessor === a.id)
      const fechados = cls.filter((c) => c.status_funil === 'fechado').length
      const perdidos = cls.filter((c) => c.status_funil === 'perdido').length
      const aps = db.apolices.filter((ap) => cls.some((c) => c.id === ap.id_cliente))
      return {
        id: a.id, nome: a.nome, codigo: a.codigo, telefone: a.telefone, email: a.email, ativo: a.ativo,
        total_leads: cls.length, fechados, perdidos, em_andamento: cls.length - fechados - perdidos,
        taxa_conversao_pct: fechados + perdidos > 0 ? Math.round(fechados / (fechados + perdidos) * 1000) / 10 : 0,
        apolices: aps.length,
        premio_mensal_total: aps.reduce((s, x) => s + Number(x.valor_premio_mensal), 0),
        comissao_assessor_total: aps.reduce((s, x) => s + Number(x.comissao_assessor ?? 0), 0),
      }
    }),
    vw_agenda_reunioes: () => db.reunioes.map((r) => {
      const c = porId('clientes').get(r.id_cliente)
      return {
        id: r.id, data_hora: r.data_hora, status: r.status, notas: r.notas,
        id_cliente: c?.id, nome_cliente: c?.nome ?? '', telefone: c?.telefone ?? null,
        status_funil: c?.status_funil, nome_assessor: porId('assessores').get(c?.id_assessor)?.nome ?? '',
      }
    }),
    vw_agenda_externa_pendentes: () => [],
    vw_busca_global: () => [
      ...db.clientes.map((c) => ({ tipo: 'cliente', id: c.id, nome: c.nome, codigo: c.codigo, telefone: c.telefone, detalhe: c.status_funil })),
      ...db.assessores.map((a) => ({ tipo: 'assessor', id: a.id, nome: a.nome, codigo: a.codigo, telefone: a.telefone, detalhe: a.ativo ? 'ativo' : 'inativo' })),
    ],
    vw_comissoes_importadas_resumo: () => {
      const m = new Map()
      for (const r of db.comissoes_importadas) {
        const k = `${r.competencia}|${r.seguradora}|${r.producao ?? 'A classificar'}|${r.tipo_receita}`
        const acc = m.get(k) ?? {
          competencia: r.competencia, seguradora: r.seguradora,
          producao: r.producao ?? 'A classificar', tipo_receita: r.tipo_receita,
          lancamentos: 0, clientes: new Set(), total: 0,
        }
        acc.lancamentos += 1; acc.clientes.add(r.cliente_nome); acc.total += Number(r.valor)
        m.set(k, acc)
      }
      return [...m.values()].map((x) => ({ ...x, clientes: x.clientes.size }))
    },
    vw_central_dia: () => {
      const linhas = []
      for (const t of db.tarefas.filter((x) => !x.concluida && x.data_vencimento <= dia(diasFrente(3)))) {
        const c = porId('clientes').get(t.id_cliente)
        linhas.push({ tipo: 'tarefa', id_item: t.id, id_cliente: t.id_cliente, nome_cliente: c?.nome ?? null, telefone: c?.telefone ?? null, titulo: t.titulo, data_ref: t.data_vencimento, atrasado: t.data_vencimento < dia(hoje()) })
      }
      for (const r of vwRegua().filter((x) => x.dias_restantes <= 7)) {
        linhas.push({ tipo: 'aniversario', id_item: r.id_cliente, id_cliente: r.id_cliente, nome_cliente: r.nome_cliente, telefone: r.telefone, titulo: r.tipo_evento === 'aniversario_cliente' ? `Aniversário de ${r.nome_cliente} 🎂` : `Aniversário da apólice de ${r.nome_cliente}`, data_ref: r.data_evento, atrasado: false })
      }
      return linhas.sort((a, b) => (b.atrasado - a.atrasado) || String(a.data_ref).localeCompare(String(b.data_ref)))
    },
  }
}

// ─── Query builder compatível com o subconjunto usado pelo Hub ──────────────
const RELACOES = {
  assessores: ['assessores', 'id_assessor'],
  clientes: ['clientes', 'id_cliente'],
  seguradoras: ['seguradoras', 'id_seguradora'],
}

function aplicarEmbeds(db, sel, linha) {
  // extrai padrões rel(campos) do select e anexa o objeto relacionado
  const out = { ...linha }
  const re = /(\w+)\(([^)]*)\)/g
  let m
  while ((m = re.exec(sel)) !== null) {
    const [, rel, campos] = m
    const def = RELACOES[rel]
    if (!def) continue
    const [tabela, fk] = def
    const alvo = db[tabela]?.find((r) => r.id === linha[fk]) ?? null
    if (!alvo) { out[rel] = null; continue }
    const lista = campos.split(',').map((s) => s.trim()).filter(Boolean)
    out[rel] = lista.length && lista[0] !== '*'
      ? Object.fromEntries(lista.map((c) => [c, alvo[c]]))
      : { ...alvo }
  }
  return out
}

function ilikeParaRegex(padrao) {
  const esc = String(padrao).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('%', '.*').replaceAll('_', '.')
  return new RegExp(`^${esc}$`, 'i')
}

class ConsultaDemo {
  constructor(db, views, nome, hooks) {
    this.db = db; this.views = views; this.nome = nome; this.hooks = hooks
    this.filtros = []; this.ordens = []; this._sel = '*'
    this._limite = null; this._range = null; this._single = false; this._maybe = false
    this._count = null; this._head = false; this._op = null; this._payload = null; this._onConflict = null
  }

  select(sel = '*', opts = {}) {
    if (sel) this._sel = sel
    if (opts.count) this._count = opts.count
    if (opts.head) this._head = true
    return this
  }
  insert(p) { this._op = 'insert'; this._payload = p; return this }
  update(p) { this._op = 'update'; this._payload = p; return this }
  upsert(p, o) { this._op = 'upsert'; this._payload = p; this._onConflict = o?.onConflict; return this }
  delete() { this._op = 'delete'; return this }

  eq(c, v) { this.filtros.push((r) => r[c] === v || String(r[c]) === String(v)); return this }
  neq(c, v) { this.filtros.push((r) => r[c] !== v && String(r[c]) !== String(v)); return this }
  is(c, v) { this.filtros.push((r) => (v === null ? r[c] == null : r[c] === v)); return this }
  gt(c, v) { this.filtros.push((r) => r[c] != null && r[c] > v); return this }
  gte(c, v) { this.filtros.push((r) => r[c] != null && String(r[c]) >= String(v)); return this }
  lt(c, v) { this.filtros.push((r) => r[c] != null && r[c] < v); return this }
  lte(c, v) { this.filtros.push((r) => r[c] != null && Number(r[c]) <= Number(v)); return this }
  ilike(c, padrao) { const re = ilikeParaRegex(padrao); this.filtros.push((r) => re.test(String(r[c] ?? ''))); return this }
  in(c, lista) { this.filtros.push((r) => lista.includes(r[c])); return this }
  or(expr) {
    const termos = String(expr).split(',').map((t) => {
      const [col, op, ...resto] = t.split('.')
      const val = resto.join('.')
      if (op === 'ilike') { const re = ilikeParaRegex(val); return (r) => re.test(String(r[col] ?? '')) }
      if (op === 'eq') return (r) => String(r[col]) === val
      return () => false
    })
    this.filtros.push((r) => termos.some((f) => f(r)))
    return this
  }
  order(c, opts = {}) { this.ordens.push([c, opts.ascending !== false]); return this }
  limit(n) { this._limite = n; return this }
  range(de, ate) { this._range = [de, ate]; return this }
  single() { this._single = true; return this }
  maybeSingle() { this._maybe = true; return this }

  _linhasBase() {
    if (this.views[this.nome]) return this.views[this.nome]()
    this.db[this.nome] ??= []
    return this.db[this.nome]
  }

  _exec() {
    const tabelaReal = !this.views[this.nome]

    // escritas
    if (this._op === 'insert' || this._op === 'upsert') {
      const lista = (Array.isArray(this._payload) ? this._payload : [this._payload]).map((p) => ({ ...p }))
      const inseridos = []
      for (const p of lista) {
        if (this._op === 'upsert' && this._onConflict) {
          const existente = this.db[this.nome]?.find((r) => String(r[this._onConflict]) === String(p[this._onConflict]))
          if (existente) { Object.assign(existente, p, { updated_at: iso(hoje()) }); inseridos.push(existente); continue }
        }
        const novo = { id: uuid(), created_at: iso(hoje()), ...p }
        this.hooks?.aoInserir?.(this.nome, novo)
        this.db[this.nome] ??= []
        this.db[this.nome].push(novo)
        inseridos.push(novo)
      }
      const data = this._single || this._maybe ? inseridos[0] ?? null : inseridos
      return { data, error: null }
    }
    if (this._op === 'update') {
      const alvo = this.db[this.nome]?.filter((r) => this.filtros.every((f) => f(r))) ?? []
      for (const r of alvo) Object.assign(r, this._payload, { updated_at: iso(hoje()) })
      const data = this._single || this._maybe ? alvo[0] ?? null : alvo
      return { data, error: null }
    }
    if (this._op === 'delete') {
      const restam = this.db[this.nome]?.filter((r) => !this.filtros.every((f) => f(r))) ?? []
      this.db[this.nome] = restam
      return { data: null, error: null }
    }

    // leitura
    let linhas = this._linhasBase().filter((r) => this.filtros.every((f) => f(r)))
    for (const [c, asc] of [...this.ordens].reverse()) {
      linhas = [...linhas].sort((a, b) => {
        const x = a[c], y = b[c]
        if (x == null && y == null) return 0
        if (x == null) return asc ? 1 : -1
        if (y == null) return asc ? -1 : 1
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
        return asc ? cmp : -cmp
      })
    }
    const total = linhas.length
    if (this._range) linhas = linhas.slice(this._range[0], this._range[1] + 1)
    if (this._limite != null) linhas = linhas.slice(0, this._limite)
    if (tabelaReal && this._sel.includes('(')) linhas = linhas.map((r) => aplicarEmbeds(this.db, this._sel, r))
    else linhas = linhas.map((r) => ({ ...r }))

    if (this._head) return { data: null, error: null, count: total }
    if (this._single || this._maybe) {
      const r = linhas[0] ?? null
      if (this._single && !r) return { data: null, error: { message: 'Registro não encontrado (demo)' } }
      return { data: r, error: null, count: this._count ? total : undefined }
    }
    return { data: linhas, error: null, count: this._count ? total : undefined }
  }

  then(resolve, reject) { return Promise.resolve(this._exec()).then(resolve, reject) }
}

// ─── Cliente demo completo (from/auth/storage/rpc) ──────────────────────────
export function criarSupabaseDemo() {
  const db = semear()
  const views = criarViews(db)
  const ouvintes = new Set()
  let sessao = null
  try {
    if (localStorage.getItem('hub_demo_sessao')) sessao = { user: { email: localStorage.getItem('hub_demo_sessao') } }
  } catch { /* sem localStorage (SSR/teste) */ }

  // recalcula comissão tripartida ao registrar venda (imita o trigger do banco)
  const hooks = {
    aoInserir(tabela, r) {
      // imita o default gen_random_uuid() da migração 017
      if (tabela === 'planejamentos' && !r.token_proposta) r.token_proposta = uuid()
      if (tabela !== 'apolices') return
      const cfg = db.configuracoes[0]
      if (r.percentual_comissao == null) {
        r.percentual_comissao = db.seguradoras.find((s) => s.id === r.id_seguradora)?.comissao_padrao_percentual ?? 0
      }
      r.comissao_gerada = Math.round(Number(r.valor_premio_mensal) * 12 * Number(r.percentual_comissao)) / 100
      r.comissao_natalia = Math.round(r.comissao_gerada * cfg.split_natalia_pct) / 100
      r.comissao_assessor = Math.round(r.comissao_gerada * cfg.split_assessor_pct) / 100
      r.comissao_escritorio = Math.round(r.comissao_gerada * cfg.split_escritorio_pct) / 100
    },
  }

  const notificar = () => ouvintes.forEach((fn) => fn('SIGNED_IN', sessao))

  return {
    from: (nome) => new ConsultaDemo(db, views, nome, hooks),

    auth: {
      getSession: async () => ({ data: { session: sessao } }),
      onAuthStateChange(fn) {
        ouvintes.add(fn)
        return { data: { subscription: { unsubscribe: () => ouvintes.delete(fn) } } }
      },
      async signInWithPassword({ email }) {
        sessao = { user: { email: email || 'demo@hub.com' } }
        try { localStorage.setItem('hub_demo_sessao', sessao.user.email) } catch { /* ok */ }
        notificar()
        return { data: { session: sessao }, error: null }
      },
      async signOut() {
        sessao = null
        try { localStorage.removeItem('hub_demo_sessao') } catch { /* ok */ }
        ouvintes.forEach((fn) => fn('SIGNED_OUT', null))
        return { error: null }
      },
    },

    storage: {
      from: () => ({
        upload: async (caminho) => ({ data: { path: caminho }, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: '#demo-sem-storage' }, error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },

    async rpc(fn, args = {}) {
      if (fn === 'fn_form_carregar') {
        const f = db.formularios_onboarding.find((x) => x.token === args.p_token)
        if (!f) return { data: { erro: 'nao_encontrado' }, error: null }
        const c = db.clientes.find((x) => x.id === f.id_cliente)
        return {
          data: {
            primeiro_nome: c?.nome?.split(' ')[0] ?? '', respostas: f.respostas,
            status: f.status, etapa_atual: f.etapa_atual,
          }, error: null,
        }
      }
      if (fn === 'fn_form_salvar') {
        const f = db.formularios_onboarding.find((x) => x.token === args.p_token)
        if (f) {
          f.respostas = args.p_respostas; f.etapa_atual = args.p_etapa
          f.status = args.p_concluido ? 'concluido' : 'em_andamento'
          f.iniciado_em ??= iso(hoje())
          if (args.p_concluido) f.concluido_em = iso(hoje())
        }
        return { data: true, error: null }
      }
      if (fn === 'fn_proposta_carregar') {
        const p = db.planejamentos.find((x) => x.token_proposta === args.p_token)
        if (!p) return { data: { erro: 'proposta_nao_encontrada' }, error: null }
        const c = db.clientes.find((x) => x.id === p.id_cliente)
        const plano = { ...p }
        delete plano.id; delete plano.id_cliente; delete plano.token_proposta
        return { data: { cliente_nome: c?.nome ?? '', plano }, error: null }
      }
      if (fn === 'fn_gerar_fila_diaria') return { data: 0, error: null }
      if (fn === 'fn_vincular_evento') return { data: true, error: null }
      return { data: null, error: { message: `rpc ${fn} não existe no modo demo` } }
    },
  }
}
