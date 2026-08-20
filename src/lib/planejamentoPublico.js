// ─────────────────────────────────────────────────────────────────────────────
// O PLANEJAMENTO QUE O PRÓPRIO CLIENTE PREENCHE — `/pl/<token>`
//
// Existe um tipo de cliente que compra seguro e não gosta de reunião. Ele
// responde no WhatsApp às onze da noite, resolve tudo por link, e some da
// agenda por três semanas se a próxima etapa for "vamos marcar uma call de
// 40 minutos". Até aqui o Hub não tinha caminho para ele: o planejamento só
// existia dentro da aba da consultora, preenchida AO VIVO, com o cliente na
// frente. Sem reunião, não havia estudo — e sem estudo, não havia proposta.
//
// Este arquivo é o mesmo planejamento, virado do avesso: as perguntas que a
// consultora faria na conversa, escritas para serem respondidas sozinho, no
// celular, sem ninguém para explicar o que significa "verba sucessória".
//
// ── O QUE O CLIENTE PREENCHE, E O QUE ELE NÃO PREENCHE ───────────────────────
// Ele preenche o que só ele sabe: a família, a renda, o custo de vida, as
// dívidas, cada classe do patrimônio, a empresa, o que já tem de seguro, o
// perfil de risco e quem ele quer proteger. Isso é o DIAGNÓSTICO — a matéria-
// prima do estudo.
//
// Ele NÃO preenche capital de morte, invalidez, doenças graves, diárias nem
// prêmio. Não por desconfiança: porque esses números não são opinião. Saem do
// motor (`estudo.js`) a partir do que ele respondeu, e o prêmio sai da cotação
// na seguradora. Pedir que o cliente escolha o próprio capital seria pedir que
// ele fizesse a consultoria — e é exatamente por não querer fazer isso que ele
// contrata alguém.
//
// ── AS RESPOSTAS USAM O NOME DA COLUNA ───────────────────────────────────────
// Cada `id` de campo aqui é o nome da coluna em `planejamentos`. Isso não é
// economia de código: é o que impede o erro clássico deste tipo de tela, o
// mapa de-para entre dois vocabulários que envelhece torto e passa a gravar
// renda no campo de custo de vida. Quem lê o formulário lê o banco.
//
// As exceções são três, e todas derivadas (nunca perguntadas duas vezes):
//   · `cobertura_atual`  = soma das apólices declaradas
//   · `patrimonio_total` = soma das classes de bens
//   · `num_dependentes`  = quantidade de filhos declarados
//
// ── QUEM APLICA AS RESPOSTAS NO PLANEJAMENTO ─────────────────────────────────
// Em produção, a função `fn_plan_concluir` (migração 029) — o cliente é
// anônimo e não pode escrever na tabela. `aplicarAoPlano()` daqui é a MESMA
// regra em JavaScript, e serve para três coisas: a tela de revisão do cliente,
// o painel da consultora e o modo demonstração. O teste
// `scripts/teste-planejamento-publico.mjs` compara as duas listas de colunas e
// falha se uma delas ganhar um campo que a outra não tem.
// ─────────────────────────────────────────────────────────────────────────────
import { FOCOS, TIPOS_PLANEJAMENTO, ITCMD_POR_UF, ORIGENS_SEGURO } from './estudo.js'
import { ATIVIDADES_RISCO } from './subscricao.js'
import { PARENTESCOS } from './beneficiarios.js'

// ─── Listas de opções ────────────────────────────────────────────────────────
export const UFS = Object.keys(ITCMD_POR_UF).sort()

export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)']
export const REGIMES_BENS = [
  'Comunhão parcial', 'Comunhão universal', 'Separação total',
  'Separação obrigatória', 'Participação final nos aquestos',
]
export const TIPOS_PREVIDENCIA = ['VGBL', 'PGBL', 'Ambos']

// Casado ou em união estável — quem tem meação e regime de bens para declarar.
const EM_UNIAO = new Set(['Casado(a)', 'União estável'])
const temUniao = (r) => EM_UNIAO.has(r.estado_civil)
const temPJ = (r) => r.tipo_planejamento === 'pj' || r.tipo_planejamento === 'pf_pj'

// Objetivos que a consultora ouve em quase toda reunião. Viram chips: o cliente
// marca em vez de escrever, e o texto livre continua ali para o que é dele.
export const OBJETIVOS_SUGERIDOS = [
  'Garantir a educação dos filhos',
  'Manter o padrão de vida da família',
  'Quitar dívidas e financiamentos',
  'Planejamento sucessório e blindagem patrimonial',
  'Proteger a renda de autônomo',
  'Proteger a sociedade e a continuidade da empresa',
  'Complementar a aposentadoria',
  'Deixar um legado',
]

// ─── Tetos e faixas ──────────────────────────────────────────────────────────
// Os mesmos limites que o banco cobra nas constraints (migrações 021, 024 e
// 025). Repetidos aqui de propósito: o cliente precisa ser avisado ENQUANTO
// digita, e não descobrir no último passo que o envio falhou por causa de um
// peso de 4.000 kg. O banco continua sendo a última palavra.
export const FAIXAS = {
  altura_cm: [100, 250],
  peso_kg: [20, 400],
  idade_aposentadoria: [40, 90],
  dividas_prazo_anos: [0, 60],
  pj_participacao_pct: [0, 100],
  pj_num_socios: [1, 50],
  idade_filho: [0, 60],
}
// R$ 1 trilhão — acima disso é dedo escorregando na tecla, não patrimônio.
export const TETO_DINHEIRO = 1e12

// Tamanho máximo de cada texto livre, igual ao que a migração 029 grava. O
// banco corta em silêncio; a tela simplesmente não deixa passar disso.
export const LIMITE_TEXTO = {
  nome_filho: 120, nome_beneficiario: 120, descricao_seguro: 200,
}

// ─── ETAPAS ──────────────────────────────────────────────────────────────────
// Uma pergunta por vez seria longo demais (são doze blocos); uma tela só seria
// um paredão que ninguém termina. O meio-termo é o bloco temático curto, na
// ordem da conversa que a consultora teria: primeiro o que ele veio resolver,
// depois quem depende dele, depois o dinheiro, depois os bens.
//
// `mostrarSe` esconde o que não se aplica: quem não tem empresa não vê sete
// perguntas sobre valuation, e a barra de progresso conta só o que ele vai
// mesmo responder.
export const ETAPAS_PLANO = [
  {
    id: 'objetivo',
    titulo: 'O que você quer resolver',
    descricao: 'Começando pelo motivo — é ele que define o resto do estudo.',
    campos: [
      {
        id: 'tipo_planejamento', tipo: 'escolha', obrigatorio: true,
        rotulo: 'Este planejamento é para…',
        opcoes: TIPOS_PLANEJAMENTO.map((t) => ({ valor: t.id, rotulo: t.rotulo, nota: t.descricao })),
      },
      {
        id: 'focos', tipo: 'chips', obrigatorio: true, minimo: 1,
        rotulo: 'O que mais importa para você? (pode marcar quantos quiser)',
        opcoes: FOCOS.map((f) => ({ valor: f.id, rotulo: f.rotulo, nota: f.descricao })),
      },
    ],
  },
  {
    id: 'familia',
    titulo: 'Você e sua família',
    descricao: 'Quem depende de você é o começo de qualquer cálculo de proteção.',
    campos: [
      { id: 'profissao', tipo: 'texto', rotulo: 'Sua profissão', obrigatorio: true, limite: 120,
        dica: 'Influencia a classe de risco e as condições da seguradora.' },
      { id: 'estado_civil', tipo: 'select', rotulo: 'Estado civil', obrigatorio: true, opcoes: ESTADOS_CIVIS },
      { id: 'conjuge_nome', tipo: 'texto', rotulo: 'Nome do cônjuge/companheiro(a)', mostrarSe: temUniao, limite: 120 },
      { id: 'regime_bens', tipo: 'select', rotulo: 'Regime de bens', opcoes: REGIMES_BENS, mostrarSe: temUniao,
        dica: 'Muda quem herda o quê. Se não souber, deixe em branco — a Natália confirma depois.' },
      { id: 'uf', tipo: 'select', rotulo: 'Estado onde você mora', obrigatorio: true, opcoes: UFS,
        dica: 'O imposto sobre herança (ITCMD) muda de estado para estado.' },
    ],
  },
  {
    id: 'filhos',
    titulo: 'Filhos e dependentes',
    descricao: 'Quanto cada um custa por mês hoje — escola, saúde, atividades. '
      + 'Se ninguém depende de você financeiramente, é só seguir.',
    campos: [
      { id: 'dependentes', tipo: 'filhos', rotulo: 'Filhos e dependentes' },
    ],
  },
  {
    id: 'financeira',
    titulo: 'Sua vida financeira',
    descricao: 'Valores aproximados já servem. Ninguém mais vê isto além da Natália.',
    campos: [
      { id: 'renda_mensal', tipo: 'moeda', rotulo: 'Sua renda mensal (líquida)', obrigatorio: true,
        dica: 'Some tudo o que entra por mês: salário, pró-labore, aluguéis, dividendos.' },
      { id: 'custo_vida_mensal', tipo: 'moeda', rotulo: 'Quanto sua família gasta por mês', obrigatorio: true,
        dica: 'O custo de manter o padrão de vida de hoje, com os filhos incluídos.' },
      { id: 'dividas_total', tipo: 'moeda', rotulo: 'Dívidas e financiamentos em aberto',
        dica: 'Saldo devedor total: casa, carro, empréstimos. Sem dívidas? Deixe zerado.' },
      { id: 'dividas_prazo_anos', tipo: 'inteiro', rotulo: 'Faltam quantos anos para quitar?',
        faixa: FAIXAS.dividas_prazo_anos, sufixo: 'anos',
        mostrarSe: (r) => numero(r.dividas_total) > 0 },
    ],
  },
  {
    id: 'patrimonio',
    titulo: 'O que você construiu',
    descricao: 'Cada tipo de bem se comporta de um jeito no inventário — por isso perguntamos separado. '
      + 'Não tem algum deles? Deixe em branco.',
    campos: [
      { id: 'patrimonio_imoveis', tipo: 'moeda', rotulo: 'Imóveis',
        dica: 'Casa, apartamentos, terrenos, sala comercial.' },
      { id: 'patrimonio_investimentos', tipo: 'moeda', rotulo: 'Investimentos',
        dica: 'Aplicações, ações, fundos, poupança.' },
      { id: 'patrimonio_empresa', tipo: 'moeda', rotulo: 'Participação em empresa',
        dica: 'Quanto valem suas quotas ou ações.' },
      { id: 'patrimonio_veiculos', tipo: 'moeda', rotulo: 'Veículos',
        dica: 'Carros, motos, embarcações.' },
      { id: 'patrimonio_outros', tipo: 'moeda', rotulo: 'Outros bens',
        dica: 'Obras, joias, direitos, qualquer coisa relevante que não coube acima.' },
      { id: 'previdencia_saldo', tipo: 'moeda', rotulo: 'Previdência privada (VGBL/PGBL)',
        dica: 'O saldo que aparece no extrato. Ela não passa por inventário — vai direto a quem você indicou.' },
      { id: 'previdencia_tipo', tipo: 'select', rotulo: 'Tipo do plano', opcoes: TIPOS_PREVIDENCIA,
        mostrarSe: (r) => numero(r.previdencia_saldo) > 0 },
      { id: 'previdencia_aporte_mensal', tipo: 'moeda', rotulo: 'Quanto aporta por mês na previdência',
        mostrarSe: (r) => numero(r.previdencia_saldo) > 0 },
    ],
  },
  {
    id: 'sucessao',
    titulo: 'Herança e organização',
    descricao: 'Três perguntas que mudam bastante a conta do inventário.',
    mostrarSe: (r) => somaBens(r) > 0 || numero(r.previdencia_saldo) > 0,
    campos: [
      { id: 'herdeiros_menores', tipo: 'simnao', rotulo: 'Algum herdeiro seu é menor de 18 anos?',
        dica: 'Com herdeiro menor, o inventário passa obrigatoriamente pela justiça — mais lento e mais caro.' },
      { id: 'tem_holding', tipo: 'simnao', rotulo: 'Você já tem uma holding familiar?' },
      { id: 'tem_testamento', tipo: 'simnao', rotulo: 'Você já tem testamento?' },
    ],
  },
  {
    id: 'empresa',
    titulo: 'Sua empresa',
    descricao: 'O que protege a sociedade e o que a família recebe pela sua parte.',
    mostrarSe: temPJ,
    campos: [
      { id: 'pj_razao_social', tipo: 'texto', rotulo: 'Nome da empresa', limite: 200 },
      { id: 'pj_valuation', tipo: 'moeda', rotulo: 'Quanto vale a empresa hoje (aproximado)',
        dica: 'Valor de mercado do negócio inteiro, não só da sua parte.' },
      { id: 'pj_participacao_pct', tipo: 'percentual', rotulo: 'Qual a sua participação',
        faixa: FAIXAS.pj_participacao_pct, sufixo: '%' },
      { id: 'pj_num_socios', tipo: 'inteiro', rotulo: 'Quantos sócios ao todo (contando você)',
        faixa: FAIXAS.pj_num_socios, sufixo: 'sócios' },
      { id: 'pj_faturamento_anual', tipo: 'moeda', rotulo: 'Faturamento anual' },
      { id: 'pj_lucro_anual', tipo: 'moeda', rotulo: 'Lucro anual' },
      { id: 'pj_divida_avalizada', tipo: 'moeda', rotulo: 'Dívidas da empresa que você avalizou',
        dica: 'O aval alcança seu patrimônio pessoal e não acaba com a sua falta.' },
    ],
  },
  {
    id: 'aposentadoria',
    titulo: 'Quando você parar',
    descricao: 'Opcional, mas é o que liga a proteção de hoje ao plano de longo prazo.',
    campos: [
      { id: 'renda_desejada_aposentadoria', tipo: 'moeda',
        rotulo: 'Quanto você gostaria de receber por mês ao parar de trabalhar',
        dica: 'Em valores de hoje — não precisa corrigir pela inflação.' },
      { id: 'idade_aposentadoria', tipo: 'inteiro', rotulo: 'Com que idade pretende parar',
        faixa: FAIXAS.idade_aposentadoria, sufixo: 'anos' },
    ],
  },
  {
    id: 'seguros',
    titulo: 'O que você já tem',
    descricao: 'Seguros que já existem entram na conta — inclusive os que a empresa paga. '
      + 'Nenhum? É só seguir.',
    campos: [
      { id: 'seguros_existentes', tipo: 'seguros', rotulo: 'Seguros de vida que você já tem' },
    ],
  },
  {
    id: 'perfil',
    titulo: 'Seu perfil',
    descricao: 'A seguradora usa isto na análise. Nada aqui substitui a declaração de saúde — '
      + 'ela vem depois, num link próprio.',
    campos: [
      { id: 'altura_cm', tipo: 'inteiro', rotulo: 'Altura', faixa: FAIXAS.altura_cm, sufixo: 'cm', placeholder: '175' },
      { id: 'peso_kg', tipo: 'decimal', rotulo: 'Peso', faixa: FAIXAS.peso_kg, sufixo: 'kg', placeholder: '80' },
      { id: 'fumante', tipo: 'simnao', rotulo: 'Você fumou nos últimos 12 meses?',
        dica: 'Cigarro, vape, charuto ou narguilé. Mexe no preço — e omitir mexe na indenização.' },
      {
        id: 'atividades_risco', tipo: 'chips', rotulo: 'Você pratica alguma destas atividades?',
        dica: 'Marque o que fizer parte da sua rotina. Não é impeditivo — só precisa ser declarado.',
        opcoes: ATIVIDADES_RISCO.map((a) => ({ valor: a.id, rotulo: a.rotulo })),
      },
      { id: 'condicoes_declaradas', tipo: 'textarea', limite: 2000,
        rotulo: 'Alguma condição de saúde, cirurgia ou tratamento que a seguradora deva saber?',
        placeholder: 'Ex.: hipertensão controlada desde 2020, cirurgia de joelho em 2019...',
        dica: 'Opcional aqui. Vale a pena adiantar: é o que define prazo e exigências da análise.' },
    ],
  },
  {
    id: 'beneficiarios',
    titulo: 'Quem você quer proteger',
    descricao: 'As pessoas que recebem o capital, e quanto cabe a cada uma. A soma precisa fechar 100%.',
    campos: [
      { id: 'beneficiarios', tipo: 'beneficiarios', rotulo: 'Beneficiários' },
    ],
  },
  {
    id: 'objetivos',
    titulo: 'Por último: o que você quer garantir',
    descricao: 'Isto abre a sua proposta. Escreva com as suas palavras.',
    campos: [
      { id: 'objetivos_chips', tipo: 'chips', rotulo: 'Marque o que combina com você',
        opcoes: OBJETIVOS_SUGERIDOS.map((o) => ({ valor: o, rotulo: o })) },
      { id: 'objetivos', tipo: 'textarea', rotulo: 'Quer acrescentar algo?', limite: 2000,
        placeholder: 'Ex.: quero que meus filhos terminem a faculdade sem depender de ninguém.' },
    ],
  },
]

// ─── Números: uma leitura só, para tela e banco ──────────────────────────────
// O cliente digita no celular e o campo de dinheiro devolve string. Aqui tudo
// vira número uma única vez, e do mesmo jeito — texto vazio, "abc", "1.234,56"
// e "-5" jamais chegam ao cálculo como NaN, Infinity ou negativo.
export function numero(v) {
  if (v == null || v === '' || typeof v === 'boolean') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let t = String(v).trim()
  if (t === '') return 0
  // pt-BR ("1.234,56") só quando há vírgula: "12000.5" é o número já normalizado
  if (t.includes(',')) t = t.replaceAll('.', '').replace(',', '.')
  const num = Number(t)
  return Number.isFinite(num) ? num : 0
}

// Número para gravar: `null` quando não foi respondido (o banco distingue
// "não respondeu" de "respondeu zero", e o estudo também).
const numOuNulo = (v, teto = TETO_DINHEIRO) => {
  if (v == null || v === '' || (typeof v === 'string' && v.trim() === '')) return null
  const num = numero(v)
  if (num === 0 && !/^[\s0.,]+$/.test(String(v))) return null
  return Math.min(Math.max(num, 0), teto)
}

const inteiroOuNulo = (v, [min, max]) => {
  const num = numOuNulo(v, max)
  if (num == null) return null
  return Math.min(Math.max(Math.round(num), min), max)
}

const texto = (v) => {
  const t = String(v ?? '').trim()
  return t === '' ? null : t
}

const lista = (v) => (Array.isArray(v) ? v : [])
// Ids de lista fechada, sem repetido e sem nada que o sistema não conheça — o
// mesmo que `jsonb_agg(distinct ...)` faz do lado do banco.
const idsValidos = (v, validos) => [...new Set(lista(v).filter((x) => validos.has(x)))]
const somaBens = (r) => CAMPOS_BENS.reduce((s, c) => s + numero(r[c]), 0)

const CAMPOS_BENS = [
  'patrimonio_imoveis', 'patrimonio_investimentos', 'patrimonio_empresa',
  'patrimonio_veiculos', 'patrimonio_outros',
]

// ─── Limpeza das listas ──────────────────────────────────────────────────────
// Linha em branco não vai para o banco: o cliente clica em "adicionar" para ver
// o que aparece e depois desiste, e essa linha fantasma viraria um filho sem
// nome puxando o cálculo para baixo.
export function limparFilhos(v) {
  return lista(v)
    .filter((f) => f && (texto(f.nome) || f.idade !== '' && f.idade != null || numero(f.custo_mensal) > 0))
    .map((f) => ({
      nome: texto(f.nome) ?? '',
      idade: inteiroOuNulo(f.idade, FAIXAS.idade_filho),
      custo_mensal: numOuNulo(f.custo_mensal),
    }))
}

const ORIGENS_VALIDAS = new Set(ORIGENS_SEGURO.map((o) => o.id))

export function limparSeguros(v) {
  return lista(v)
    .filter((s) => s && (texto(s.descricao) || numero(s.capital) > 0))
    .map((s) => ({
      origem: ORIGENS_VALIDAS.has(s.origem) ? s.origem : 'individual',
      descricao: texto(s.descricao) ?? '',
      capital: numOuNulo(s.capital),
      custeio: s.custeio === 'empresa' ? 'empresa' : 'proprio',
    }))
}

const PARENTESCOS_VALIDOS = new Set(PARENTESCOS)

export function limparBeneficiarios(v) {
  return lista(v)
    .filter((b) => b && (texto(b.nome) || numero(b.pct) > 0))
    .map((b) => ({
      nome: texto(b.nome) ?? '',
      parentesco: PARENTESCOS_VALIDOS.has(b.parentesco) ? b.parentesco : 'Outro',
      pct: numOuNulo(b.pct, 100) ?? 0,
      nascimento: /^\d{4}-\d{2}-\d{2}$/.test(String(b.nascimento ?? '')) ? b.nascimento : null,
    }))
}

const ATIVIDADES_VALIDAS = new Set(ATIVIDADES_RISCO.map((a) => a.id))
const OBJETIVOS_VALIDOS = new Set(OBJETIVOS_SUGERIDOS)
const FOCOS_VALIDOS = new Set(FOCOS.map((f) => f.id))
const TIPOS_VALIDOS = new Set(TIPOS_PLANEJAMENTO.map((t) => t.id))

// ─── VALIDAÇÃO ───────────────────────────────────────────────────────────────
// A regra é uma só: nada que o banco recuse pode passar daqui. O cliente está
// sozinho, sem ninguém para explicar a mensagem de erro — se ele chegar ao
// último passo e o envio falhar, ele não volta.
//
// Devolve `[{ campo, mensagem }]` — vazio quando a etapa está boa.
export function validarEtapa(etapa, respostas) {
  const erros = []
  const anota = (campo, mensagem) => erros.push({ campo, mensagem })

  for (const campo of camposVisiveis(etapa, respostas)) {
    const valor = respostas[campo.id]
    const vazio = valor == null || valor === ''
      || (Array.isArray(valor) && valor.length === 0)

    if (campo.obrigatorio && vazio && campo.tipo !== 'simnao') {
      anota(campo.id, 'Precisamos desta resposta para continuar.')
      continue
    }
    if (campo.obrigatorio && campo.tipo === 'simnao' && valor !== true && valor !== false) {
      anota(campo.id, 'Escolha sim ou não.')
      continue
    }
    if (campo.minimo && lista(valor).length < campo.minimo) {
      anota(campo.id, `Escolha pelo menos ${campo.minimo}.`)
      continue
    }
    if (vazio) continue

    if (campo.faixa && (campo.tipo === 'inteiro' || campo.tipo === 'decimal' || campo.tipo === 'percentual')) {
      const [min, max] = campo.faixa
      const num = numero(valor)
      if (num < min || num > max) {
        anota(campo.id, `Use um valor entre ${min} e ${max}${campo.sufixo ? ` ${campo.sufixo}` : ''}.`)
      }
    }
    if ((campo.tipo === 'moeda') && numero(valor) > TETO_DINHEIRO) {
      anota(campo.id, 'Esse valor parece um erro de digitação — confira as casas.')
    }
  }

  // ── Regras que olham mais de um campo ──────────────────────────────────────
  if (etapa.id === 'financeira') {
    const renda = numero(respostas.renda_mensal)
    const custo = numero(respostas.custo_vida_mensal)
    if (renda > 0 && custo > renda * 3) {
      anota('custo_vida_mensal', 'O gasto ficou muito acima da renda — confira se não trocou os campos.')
    }
  }

  if (etapa.id === 'filhos') {
    limparFilhos(respostas.dependentes).forEach((f, i) => {
      if (!f.nome) anota(`dependentes.${i}.nome`, 'Falta o nome (ou apelido).')
      if (f.idade == null) anota(`dependentes.${i}.idade`, 'Falta a idade.')
    })
  }

  if (etapa.id === 'beneficiarios') {
    const itens = limparBeneficiarios(respostas.beneficiarios)
    itens.forEach((b, i) => {
      if (!b.nome) anota(`beneficiarios.${i}.nome`, 'Falta o nome de quem recebe.')
      if (!(b.pct > 0)) anota(`beneficiarios.${i}.pct`, 'Falta o percentual.')
    })
    if (itens.length > 0) {
      const soma = itens.reduce((s, b) => s + b.pct, 0)
      // uma casa de tolerância: 33,33 × 3 = 99,99 e isso é uma divisão legítima
      if (Math.abs(soma - 100) > 0.05) {
        anota('beneficiarios', `A soma dos percentuais está em ${formatarPct(soma)}% — precisa fechar 100%.`)
      }
    }
  }

  if (etapa.id === 'empresa') {
    const part = respostas.pj_participacao_pct
    if (part != null && part !== '' && numero(part) === 0) {
      anota('pj_participacao_pct', 'Se você é sócio, a participação não pode ser zero.')
    }
  }

  return erros
}

const formatarPct = (v) => Number(v.toFixed(2)).toLocaleString('pt-BR')

// Campos de uma etapa que estão realmente visíveis para estas respostas.
export function camposVisiveis(etapa, respostas) {
  return etapa.campos.filter((c) => !c.mostrarSe || c.mostrarSe(respostas))
}

// Etapas que este cliente vai mesmo responder. É a lista que o progresso conta:
// prometer "12 etapas" e mostrar 10 é pequeno, mas é o tipo de coisa que faz
// alguém desconfiar do resto.
export function etapasVisiveis(respostas) {
  return ETAPAS_PLANO.filter((e) => !e.mostrarSe || e.mostrarSe(respostas))
}

// ─── AS COLUNAS QUE O CLIENTE ALIMENTA ───────────────────────────────────────
// A lista existe para ser conferida: é ela que o teste compara com a função
// `fn_plan_concluir` da migração 029. Coluna nova aqui e esquecida lá vira
// falha de teste, não dado perdido em silêncio.
export const COLUNAS_DO_CLIENTE = [
  'tipo_planejamento', 'focos',
  'profissao', 'estado_civil', 'conjuge_nome', 'regime_bens', 'uf',
  'dependentes', 'num_dependentes', 'filhos_idades',
  'renda_mensal', 'custo_vida_mensal', 'dividas_total', 'dividas_prazo_anos',
  'patrimonio_imoveis', 'patrimonio_investimentos', 'patrimonio_empresa',
  'patrimonio_veiculos', 'patrimonio_outros', 'patrimonio_total',
  'previdencia_saldo', 'previdencia_tipo', 'previdencia_aporte_mensal',
  'herdeiros_menores', 'tem_holding', 'tem_testamento',
  'pj_razao_social', 'pj_valuation', 'pj_participacao_pct', 'pj_num_socios',
  'pj_faturamento_anual', 'pj_lucro_anual', 'pj_divida_avalizada',
  'renda_desejada_aposentadoria', 'idade_aposentadoria',
  'seguros_existentes', 'cobertura_atual',
  'altura_cm', 'peso_kg', 'fumante', 'atividades_risco', 'condicoes_declaradas',
  'beneficiarios',
  'objetivos',
]

// ─── APLICAR AS RESPOSTAS NO PLANEJAMENTO ────────────────────────────────────
// Devolve só as colunas que o cliente REALMENTE respondeu. O que ele deixou em
// branco sai como `undefined` e não entra no objeto — quem grava (a RPC ou o
// modo demo) preserva o que já estava lá.
//
// Isso importa mais do que parece: a consultora pode ter conversado com ele por
// telefone e anotado a renda antes de mandar o link. Se o formulário gravasse
// nulo em tudo que ficou em branco, apagaria o trabalho dela e ninguém saberia.
export function aplicarAoPlano(respostas = {}) {
  const r = respostas ?? {}
  const p = {}
  const por = (coluna, valor) => { if (valor !== undefined && valor !== null) p[coluna] = valor }

  // 1. Tipo e focos
  if (TIPOS_VALIDOS.has(r.tipo_planejamento)) p.tipo_planejamento = r.tipo_planejamento
  const focos = idsValidos(r.focos, FOCOS_VALIDOS)
  if (focos.length > 0) p.focos = focos

  // 2. Família
  por('profissao', texto(r.profissao))
  por('estado_civil', ESTADOS_CIVIS.includes(r.estado_civil) ? r.estado_civil : null)
  por('conjuge_nome', temUniao(r) ? texto(r.conjuge_nome) : null)
  por('regime_bens', temUniao(r) && REGIMES_BENS.includes(r.regime_bens) ? r.regime_bens : null)
  por('uf', /^[A-Za-z]{2}$/.test(String(r.uf ?? '')) ? String(r.uf).toUpperCase() : null)

  // 3. Filhos — a lista manda; o número e o texto de idades são derivados dela
  const filhos = limparFilhos(r.dependentes)
  if (filhos.length > 0) {
    p.dependentes = filhos
    p.num_dependentes = filhos.length
    const idades = filhos.map((f) => f.idade).filter((i) => i != null)
    if (idades.length > 0) p.filhos_idades = `${idades.join(', ')} anos`
  } else if (Array.isArray(r.dependentes)) {
    // respondeu a etapa e não tem nenhum: é uma informação, não um vazio
    p.dependentes = []
    p.num_dependentes = 0
  }

  // 4. Vida financeira
  por('renda_mensal', numOuNulo(r.renda_mensal))
  por('custo_vida_mensal', numOuNulo(r.custo_vida_mensal))
  por('dividas_total', numOuNulo(r.dividas_total))
  por('dividas_prazo_anos', inteiroOuNulo(r.dividas_prazo_anos, FAIXAS.dividas_prazo_anos))

  // 5. Patrimônio. O total consolidado acompanha as classes (migração 019):
  // telas antigas leem `patrimonio_total` e ficariam desatualizadas sem isto.
  for (const campo of CAMPOS_BENS) por(campo, numOuNulo(r[campo]))
  const bens = somaBens(r)
  if (CAMPOS_BENS.some((c) => r[c] != null && r[c] !== '')) p.patrimonio_total = bens
  por('previdencia_saldo', numOuNulo(r.previdencia_saldo))
  por('previdencia_tipo', TIPOS_PREVIDENCIA.includes(r.previdencia_tipo) ? r.previdencia_tipo : null)
  por('previdencia_aporte_mensal', numOuNulo(r.previdencia_aporte_mensal))

  // 6. Sucessão. Filho menor declarado já responde a pergunta: se ele pulou o
  // sim/não, a lista de filhos decide — nunca o contrário.
  if (typeof r.herdeiros_menores === 'boolean') p.herdeiros_menores = r.herdeiros_menores
  else if (filhos.some((f) => f.idade != null && f.idade < 18)) p.herdeiros_menores = true
  if (typeof r.tem_holding === 'boolean') p.tem_holding = r.tem_holding
  if (typeof r.tem_testamento === 'boolean') p.tem_testamento = r.tem_testamento

  // 7. Empresa — só quando o planejamento tem PJ
  if (temPJ(r)) {
    por('pj_razao_social', texto(r.pj_razao_social))
    por('pj_valuation', numOuNulo(r.pj_valuation))
    por('pj_participacao_pct', numOuNulo(r.pj_participacao_pct, 100))
    por('pj_num_socios', inteiroOuNulo(r.pj_num_socios, FAIXAS.pj_num_socios))
    por('pj_faturamento_anual', numOuNulo(r.pj_faturamento_anual))
    por('pj_lucro_anual', numOuNulo(r.pj_lucro_anual))
    por('pj_divida_avalizada', numOuNulo(r.pj_divida_avalizada))
  }

  // 8. Aposentadoria
  por('renda_desejada_aposentadoria', numOuNulo(r.renda_desejada_aposentadoria))
  por('idade_aposentadoria', inteiroOuNulo(r.idade_aposentadoria, FAIXAS.idade_aposentadoria))

  // 9. Seguros que já existem — o total alimenta `cobertura_atual`, que é o
  // número que o estudo usa para mostrar o gap.
  const seguros = limparSeguros(r.seguros_existentes)
  if (seguros.length > 0) {
    p.seguros_existentes = seguros
    p.cobertura_atual = seguros.reduce((s, x) => s + (x.capital ?? 0), 0)
  } else if (Array.isArray(r.seguros_existentes)) {
    p.seguros_existentes = []
    p.cobertura_atual = 0
  }

  // 10. Perfil de risco
  por('altura_cm', inteiroOuNulo(r.altura_cm, FAIXAS.altura_cm))
  const peso = numOuNulo(r.peso_kg, FAIXAS.peso_kg[1])
  por('peso_kg', peso != null ? Math.max(peso, FAIXAS.peso_kg[0]) : null)
  if (typeof r.fumante === 'boolean') p.fumante = r.fumante
  const atividades = idsValidos(r.atividades_risco, ATIVIDADES_VALIDAS)
  if (Array.isArray(r.atividades_risco)) p.atividades_risco = atividades
  por('condicoes_declaradas', texto(r.condicoes_declaradas))

  // 11. Beneficiários
  const beneficiarios = limparBeneficiarios(r.beneficiarios)
  if (beneficiarios.length > 0) p.beneficiarios = beneficiarios
  else if (Array.isArray(r.beneficiarios)) p.beneficiarios = []

  // 12. Objetivos — os chips marcados e o texto livre viram um parágrafo só,
  // que é como a proposta e o fechamento leem esse campo.
  const chips = idsValidos(r.objetivos_chips, OBJETIVOS_VALIDOS)
  const livre = texto(r.objetivos)
  const objetivos = [chips.join('; '), livre].filter(Boolean).join(chips.length > 0 && livre ? '. ' : '')
  por('objetivos', objetivos || null)

  return p
}

// ─── RESUMO PARA A TELA DE REVISÃO ───────────────────────────────────────────
// O último passo do cliente é conferir o que respondeu. Sem isso, o erro de
// digitação em "renda mensal" só aparece na reunião de apresentação — quando
// o estudo inteiro já foi montado em cima dele.
export function resumoRespostas(respostas = {}) {
  const r = respostas ?? {}
  const dinheiro = (v) => {
    const num = numOuNulo(v)
    return num == null ? null : `R$ ${num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
  }
  const simNao = (v) => (v === true ? 'Sim' : v === false ? 'Não' : null)
  const filhos = limparFilhos(r.dependentes)
  const seguros = limparSeguros(r.seguros_existentes)
  const beneficiarios = limparBeneficiarios(r.beneficiarios)
  const focos = idsValidos(r.focos, FOCOS_VALIDOS)
  const atividades = idsValidos(r.atividades_risco, ATIVIDADES_VALIDAS)
  const rotuloFoco = (id) => FOCOS.find((f) => f.id === id)?.rotulo ?? id
  const rotuloAtividade = (id) => ATIVIDADES_RISCO.find((a) => a.id === id)?.rotulo ?? id
  const bens = somaBens(r)

  const blocos = [
    {
      etapa: 'objetivo', titulo: 'O que você quer resolver',
      linhas: [
        ['Planejamento', TIPOS_PLANEJAMENTO.find((t) => t.id === r.tipo_planejamento)?.rotulo],
        ['Focos', focos.length > 0 ? focos.map(rotuloFoco).join(', ') : null],
      ],
    },
    {
      etapa: 'familia', titulo: 'Você e sua família',
      linhas: [
        ['Profissão', texto(r.profissao)],
        ['Estado civil', texto(r.estado_civil)],
        ['Cônjuge', temUniao(r) ? texto(r.conjuge_nome) : null],
        ['Regime de bens', temUniao(r) ? texto(r.regime_bens) : null],
        ['Estado', texto(r.uf)],
      ],
    },
    {
      etapa: 'filhos', titulo: 'Filhos e dependentes',
      linhas: filhos.length === 0
        ? (Array.isArray(r.dependentes) ? [['Filhos', 'nenhum declarado']] : [])
        : filhos.map((f) => [
          f.nome || 'sem nome',
          [f.idade != null ? `${f.idade} anos` : null, f.custo_mensal ? `${dinheiro(f.custo_mensal)}/mês` : null]
            .filter(Boolean).join(' · ') || '—',
        ]),
    },
    {
      etapa: 'financeira', titulo: 'Sua vida financeira',
      linhas: [
        ['Renda mensal', dinheiro(r.renda_mensal)],
        ['Custo de vida mensal', dinheiro(r.custo_vida_mensal)],
        ['Dívidas em aberto', dinheiro(r.dividas_total)],
        ['Prazo para quitar', r.dividas_prazo_anos ? `${numero(r.dividas_prazo_anos)} anos` : null],
      ],
    },
    {
      etapa: 'patrimonio', titulo: 'O que você construiu',
      linhas: [
        ['Imóveis', dinheiro(r.patrimonio_imoveis)],
        ['Investimentos', dinheiro(r.patrimonio_investimentos)],
        ['Empresa', dinheiro(r.patrimonio_empresa)],
        ['Veículos', dinheiro(r.patrimonio_veiculos)],
        ['Outros bens', dinheiro(r.patrimonio_outros)],
        ['Total em bens', bens > 0 ? dinheiro(bens) : null],
        ['Previdência', dinheiro(r.previdencia_saldo)],
        ['Tipo do plano', texto(r.previdencia_tipo)],
        ['Aporte mensal', dinheiro(r.previdencia_aporte_mensal)],
      ],
    },
    {
      etapa: 'sucessao', titulo: 'Herança e organização',
      linhas: [
        ['Herdeiro menor de 18', simNao(r.herdeiros_menores)],
        ['Holding familiar', simNao(r.tem_holding)],
        ['Testamento', simNao(r.tem_testamento)],
      ],
    },
    {
      etapa: 'empresa', titulo: 'Sua empresa',
      linhas: temPJ(r) ? [
        ['Empresa', texto(r.pj_razao_social)],
        ['Valor da empresa', dinheiro(r.pj_valuation)],
        ['Sua participação', r.pj_participacao_pct ? `${numero(r.pj_participacao_pct)}%` : null],
        ['Sócios', r.pj_num_socios ? `${numero(r.pj_num_socios)}` : null],
        ['Faturamento anual', dinheiro(r.pj_faturamento_anual)],
        ['Lucro anual', dinheiro(r.pj_lucro_anual)],
        ['Dívidas avalizadas', dinheiro(r.pj_divida_avalizada)],
      ] : [],
    },
    {
      etapa: 'aposentadoria', titulo: 'Quando você parar',
      linhas: [
        ['Renda desejada', dinheiro(r.renda_desejada_aposentadoria)],
        ['Idade-alvo', r.idade_aposentadoria ? `${numero(r.idade_aposentadoria)} anos` : null],
      ],
    },
    {
      etapa: 'seguros', titulo: 'O que você já tem',
      linhas: seguros.length === 0
        ? (Array.isArray(r.seguros_existentes) ? [['Seguros atuais', 'nenhum declarado']] : [])
        : seguros.map((s) => [
          s.descricao || ORIGENS_SEGURO.find((o) => o.id === s.origem)?.rotulo || 'Apólice',
          [dinheiro(s.capital), s.custeio === 'empresa' ? 'pago pela empresa' : null]
            .filter(Boolean).join(' · ') || '—',
        ]),
    },
    {
      etapa: 'perfil', titulo: 'Seu perfil',
      linhas: [
        ['Altura', r.altura_cm ? `${numero(r.altura_cm)} cm` : null],
        ['Peso', r.peso_kg ? `${numero(r.peso_kg)} kg` : null],
        ['Fumante', simNao(r.fumante)],
        ['Atividades', atividades.length > 0 ? atividades.map(rotuloAtividade).join(', ') : null],
        ['Condições declaradas', texto(r.condicoes_declaradas)],
      ],
    },
    {
      etapa: 'beneficiarios', titulo: 'Quem você quer proteger',
      linhas: beneficiarios.length === 0
        ? (Array.isArray(r.beneficiarios) ? [['Beneficiários', 'nenhum indicado']] : [])
        : beneficiarios.map((b) => [b.nome, `${b.parentesco} · ${formatarPct(b.pct)}%`]),
    },
    {
      etapa: 'objetivos', titulo: 'O que você quer garantir',
      linhas: [['Objetivos', texto(aplicarAoPlano(r).objetivos)]],
    },
  ]

  // Bloco sem nenhuma resposta não vai para a revisão: é ruído entre o que
  // interessa conferir.
  return blocos
    .map((b) => ({ ...b, linhas: b.linhas.filter(([, v]) => v != null && v !== '') }))
    .filter((b) => b.linhas.length > 0)
}

// ─── O QUE VAI PARA O BANCO NO ENVIO FINAL ───────────────────────────────────
// Números viram números, listas perdem as linhas em branco, ids desconhecidos
// somem. O jsonb guardado fica limpo, e a RPC recebe exatamente o que espera.
export function normalizarRespostas(respostas = {}) {
  const r = { ...(respostas ?? {}) }
  const limpo = {}
  const numericos = new Set()
  for (const etapa of ETAPAS_PLANO) {
    for (const campo of etapa.campos) {
      if (['moeda', 'inteiro', 'decimal', 'percentual'].includes(campo.tipo)) numericos.add(campo.id)
    }
  }
  for (const [k, v] of Object.entries(r)) {
    if (v == null || v === '') continue
    if (k === 'dependentes') { limpo[k] = limparFilhos(v); continue }
    if (k === 'seguros_existentes') { limpo[k] = limparSeguros(v); continue }
    if (k === 'beneficiarios') { limpo[k] = limparBeneficiarios(v); continue }
    if (k === 'atividades_risco') { limpo[k] = idsValidos(v, ATIVIDADES_VALIDAS); continue }
    if (k === 'focos') { limpo[k] = idsValidos(v, FOCOS_VALIDOS); continue }
    if (k === 'objetivos_chips') { limpo[k] = idsValidos(v, OBJETIVOS_VALIDOS); continue }
    if (numericos.has(k)) { limpo[k] = numero(v); continue }
    limpo[k] = v
  }
  return limpo
}
