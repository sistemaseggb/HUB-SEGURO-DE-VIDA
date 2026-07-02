// Reconhecimento e normalização das planilhas de comissão das seguradoras.
// Cada seguradora exporta num formato diferente (mapeados em
// docs/PLANILHAS_COMISSAO.md); aqui cada formato vira um "perfil" que é
// detectado pelo cabeçalho e convertido para o modelo canônico da tabela
// comissoes_importadas. A usuária só copia as células da planilha e cola.
import { parseCSV, normalizar, acharColuna } from './csv'

// Converte dinheiro nos 3 formatos que aparecem nas planilhas:
// "61.08" (número americano), "R$1.539,94" / "273,96" (texto BR),
// com suporte a negativos ("-R$144,81" = estorno).
export function paraValor(v) {
  let s = String(v ?? '').trim().replace(/R\$\s?/g, '').replace(/\s/g, '')
  if (!s || s === '-' || s === '#REF!') return null
  const negativo = s.startsWith('-')
  if (negativo) s = s.slice(1)
  if (s.includes(',')) s = s.replaceAll('.', '').replace(',', '.')
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

// "473522.0" → "473522" (códigos que viraram float no Excel)
export const limparCodigo = (v) => String(v ?? '').trim().replace(/\.0$/, '')

const limparNome = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

// "202605", "05/2026", "01/05/2026" ou "2026-05" → "2026-05-01" (null se não der)
export function paraCompetencia(v) {
  const s = String(v ?? '').trim().replace(/\.0$/, '')
  let m = s.match(/^(\d{4})(\d{2})$/)                 // 202605
  if (m) return `${m[1]}-${m[2]}-01`
  m = s.match(/^(\d{1,2})\/(\d{4})$/)                 // 05/2026
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}-01`
  m = s.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/)         // 01/05/2026
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}-01`
  m = s.match(/^(\d{4})-(\d{1,2})(-\d{1,2})?$/)       // 2026-05 / 2026-05-01
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-01`
  return null
}

// ─── Perfis de planilha ──────────────────────────────────────────────────────
// A detecção usa "assinaturas": nomes de coluna que só existem naquele formato.
// A ordem importa — os perfis mais específicos vêm primeiro.
const PERFIS = [
  {
    // Formato consolidado do próprio Hub: aceita vários meses e várias
    // seguradoras num arquivo só (usado para carga histórica e para colar
    // de volta um "Detalhado" exportado). Mês e seguradora vêm por linha.
    id: 'hub_consolidado',
    rotulo: 'Hub — consolidado (vários meses e seguradoras)',
    seguradora: null,
    porLinha: true, // seguradora e competência vêm do próprio arquivo
    assinatura: ['tipodereceita', 'seguradora'],
    colunas: {
      competencia: ['competencia'],
      seguradora: ['seguradora'],
      segmento: ['segmento'],
      cliente: ['cliente'],
      codigoCliente: ['codcliente', 'codigodocliente'],
      codigoAssessor: ['codassessor', 'codigoassessor'],
      producao: ['producao'],
      parcela: ['parcela'],
      tipoReceita: ['tipodereceita'],
      valor: ['valor'],
    },
    linha(g) {
      const receita = normalizar(g('tipoReceita'))
      return {
        cliente_nome: String(g('cliente') ?? '').replace(/\s+/g, ' ').trim(),
        codigo_cliente: limparCodigo(g('codigoCliente')) || null,
        codigo_assessor: limparCodigo(g('codigoAssessor')) || null,
        producao: String(g('producao') ?? '').trim() || null,
        parcela: parseInt(limparCodigo(g('parcela'))) || null,
        competencia: paraCompetencia(g('competencia')),
        seguradora: String(g('seguradora') ?? '').trim(),
        segmento: String(g('segmento') ?? '').trim() || 'individual',
        tipo_receita: receita.includes('campanha') ? 'campanha'
          : receita.includes('nova') ? 'venda_nova' : 'recorrente',
        valor: paraValor(g('valor')),
      }
    },
  },
  {
    id: 'mag_oficial',
    rotulo: 'MAG — relatório oficial (Relação de Comissões)',
    seguradora: 'MAG',
    assinatura: ['tipodelancamento', 'valorangariacao'],
    colunas: {
      cliente: ['nomerazaosocial'],
      parcela: ['parcelacomissionada'],
      competencia: ['competenciacomissionada'],
      tipoLancamento: ['tipodelancamento'],
      valorComissao: ['valorcomissao'],
      valorAngariacao: ['valorangariacao'],
      valorEstorno: ['valorestorno'],
      valorBonificacao: ['valorbonificacao'],
      valorIncentivo: ['valorincentivo'],
    },
    linha(g) {
      const vendaNova = (g('tipoLancamento') ?? '').includes('ANGARIACAO')
      let valor = paraValor(vendaNova ? g('valorAngariacao') : g('valorComissao')) ?? 0
      valor += (paraValor(g('valorBonificacao')) ?? 0) + (paraValor(g('valorIncentivo')) ?? 0)
      valor -= Math.abs(paraValor(g('valorEstorno')) ?? 0)
      return {
        cliente_nome: limparNome(g('cliente')),
        parcela: parseInt(limparCodigo(g('parcela'))) || null,
        competencia: paraCompetencia(g('competencia')),
        tipo_receita: vendaNova ? 'venda_nova' : 'recorrente',
        valor,
      }
    },
  },
  {
    id: 'azos_campanhas',
    rotulo: 'Azos — relatório oficial de campanhas',
    seguradora: 'Azos',
    segmento: 'campanha',
    assinatura: ['nomedacampanha', 'valorrecebido'],
    colunas: {
      cliente: ['nomedosegurado'],
      competencia: ['mesdecompetencia'],
      valor: ['valorrecebido'],
    },
    linha(g) {
      return {
        cliente_nome: limparNome(g('cliente')) || '(estorno de campanha)',
        competencia: paraCompetencia(g('competencia')),
        tipo_receita: 'campanha',
        valor: paraValor(g('valor')),
      }
    },
  },
  {
    id: 'azos_oficial',
    rotulo: 'Azos — relatório oficial de comissões',
    seguradora: 'Azos',
    assinatura: ['cpfdosegurado', 'comissaobruta'],
    colunas: {
      cliente: ['nomedosegurado'],
      parcela: ['parcela'],
      competencia: ['mesdecompetencia'],
      valor: ['comissaobruta'],
    },
    linha(g) {
      const nome = limparNome(g('cliente'))
      if (nome.startsWith('Total ')) return null // rodapé de total do relatório
      const parcela = parseInt(limparCodigo(g('parcela'))) || null
      return {
        cliente_nome: nome,
        parcela,
        competencia: paraCompetencia(g('competencia')),
        tipo_receita: parcela === 1 ? 'venda_nova' : 'recorrente',
        valor: paraValor(g('valor')),
      }
    },
  },
  {
    id: 'icatu_oficial_individual',
    rotulo: 'Icatu — extrato analítico individual',
    seguradora: 'Icatu',
    assinatura: ['lancamento', 'certificado'],
    colunas: {
      cliente: ['cliente'],
      lancamento: ['lancamento'],
      parcela: ['parcela'],
      dataPagamento: ['datadepagamento'],
      valor: ['comissao'],
    },
    linha(g) {
      const lanc = String(g('lancamento') ?? '')
      if (!lanc.includes('Comissão')) return null // rodapés e linhas de total
      return {
        cliente_nome: limparNome(g('cliente')),
        parcela: parseInt(limparCodigo(g('parcela'))) || null,
        competencia: paraCompetencia(g('dataPagamento')),
        tipo_receita: lanc.includes('Agenciamento') ? 'venda_nova' : 'recorrente',
        valor: paraValor(g('valor')),
      }
    },
  },
  {
    id: 'icatu_oficial_empresarial',
    rotulo: 'Icatu — comissões empresarial (vida em grupo)',
    seguradora: 'Icatu',
    segmento: 'empresarial',
    assinatura: ['estipulante', 'nfatura'],
    colunas: {
      cliente: ['estipulante'],
      parcela: ['nfatura'],
      valor: ['comissao'],
      // A coluna "Competência" do extrato é a da FATURA (mês anterior), não a
      // do recebimento — por isso o mês informado na importação prevalece.
    },
    linha(g) {
      const nome = limparNome(g('cliente'))
      if (!nome || ['valortotal', 'nan'].includes(normalizar(nome))) return null
      return {
        cliente_nome: nome,
        parcela: parseInt(limparCodigo(g('parcela'))) || null,
        competencia: null,
        tipo_receita: 'recorrente',
        valor: paraValor(g('valor')),
      }
    },
  },
  {
    // Formato interno do escritório: qualquer seguradora, com as colunas de
    // gestão (Código assessor + Produção). Fica por último por ser o mais
    // genérico — os oficiais acima têm assinaturas mais específicas.
    id: 'interna',
    rotulo: 'Planilha interna mensal (com Produção e Cód. assessor)',
    seguradora: null, // escolhida pela usuária
    assinatura: ['producao'],
    colunas: {
      cliente: ['nomedosegurado', 'nomerazaosocial', 'seguradoestipulante', 'cliente', 'nome'],
      codigoCliente: ['codigodocliente', 'codcliente'],
      codigoAssessor: ['codigoassessor', 'codassessor'],
      producao: ['producao'],
      parcela: ['parcelacomissionada', 'nparcela', 'parcela', 'nfatura'],
      competencia: ['competenciacomissionada'],
      valor: ['comissaobruta', 'valorcomissao', 'vlareceber', 'comissao'],
      valorEstorno: ['valorestorno'],
    },
    linha(g) {
      const parcela = parseInt(limparCodigo(g('parcela'))) || null
      let valor = paraValor(g('valor'))
      if (valor != null) valor -= Math.abs(paraValor(g('valorEstorno')) ?? 0)
      return {
        cliente_nome: limparNome(g('cliente')),
        codigo_cliente: limparCodigo(g('codigoCliente')) || null,
        codigo_assessor: limparCodigo(g('codigoAssessor')) || null,
        producao: limparNome(g('producao')) || null,
        parcela,
        competencia: paraCompetencia(g('competencia')),
        tipo_receita: parcela === 1 ? 'venda_nova' : 'recorrente',
        valor,
      }
    },
  },
]

// Procura, nas primeiras linhas do texto colado, uma linha de cabeçalho que
// case com algum perfil (os relatórios oficiais têm razão social/CNPJ antes
// do cabeçalho de verdade — por isso não dá para assumir a linha 1).
export function detectarPlanilha(texto) {
  const todasLinhas = String(texto ?? '').split(/\r?\n/)
  for (let i = 0; i < Math.min(todasLinhas.length, 12); i++) {
    const recorte = todasLinhas.slice(i).join('\n')
    const { cabecalho, linhas } = parseCSV(recorte)
    if (cabecalho.length < 3 || !linhas.length) continue
    const norm = cabecalho.map(normalizar)
    const perfil = PERFIS.find((p) => p.assinatura.every((a) => norm.some((h) => h.includes(a))))
    if (perfil) return { perfil, cabecalho, linhas }
  }
  return null
}

// Converte as linhas cruas para o modelo canônico. `competenciaPadrao`
// ("2026-05-01") cobre as planilhas sem coluna de mês (Icatu/Omint internas).
export function normalizarComissoes({ perfil, cabecalho, linhas }, { competenciaPadrao, seguradora }) {
  const idx = {}
  for (const [campo, apelidos] of Object.entries(perfil.colunas)) {
    const i = acharColuna(cabecalho, apelidos)
    if (i >= 0) idx[campo] = i
  }
  const registros = []
  const avisos = []
  linhas.forEach((l, n) => {
    const g = (campo) => (idx[campo] !== undefined ? l[idx[campo]] : undefined)
    const r = perfil.linha(g)
    if (!r) return // linha de total/rodapé — ignorada de propósito
    if (!r.cliente_nome || r.valor == null) {
      if (l.some((c) => c !== '')) avisos.push(`Linha ${n + 2} ignorada (sem cliente ou valor)`)
      return
    }
    if (perfil.porLinha && !r.seguradora) {
      avisos.push(`Linha ${n + 2} ignorada (sem seguradora)`)
      return
    }
    registros.push({
      seguradora: perfil.seguradora ?? seguradora,
      segmento: perfil.segmento ?? 'individual',
      producao: null,
      codigo_cliente: null,
      codigo_assessor: null,
      ...r,
      competencia: r.competencia ?? competenciaPadrao ?? null,
      valor: Math.round(r.valor * 100) / 100,
    })
  })
  const semCompetencia = registros.filter((r) => !r.competencia).length
  if (semCompetencia) avisos.push(`${semCompetencia} linha(s) sem mês de competência — informe o mês acima`)
  return { registros, avisos }
}
