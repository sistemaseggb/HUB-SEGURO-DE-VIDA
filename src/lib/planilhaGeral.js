// ─────────────────────────────────────────────────────────────────────────────
// Leitor da PLANILHA GERAL (Seguros Fechados) — o registro-mestre do escritório.
//
// É a planilha que a consultora sobe todo mês para atualizar os números. Tem
// várias abas; a que interessa é a das apólices vigentes ("Propostas fechadas"
// / "Seguros fechados"). Este módulo lê o .xlsx direto (sem converter para CSV),
// mapeia as colunas reais, arruma as sujeiras (datas em número do Excel,
// comissão em fração, grafias diferentes da mesma seguradora) e devolve uma
// lista limpa de registros — pronta para o importador criar/atualizar.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx'

// Consolida grafias diferentes da MESMA seguradora (evita cadastro duplicado)
const CANONICO_SEGURADORA = {
  'metlife': 'MetLife', 'met life': 'MetLife',
  'mag': 'MAG', 'mag seguros': 'MAG',
  'omint': 'Omint', 'omint (seg. viagem)': 'Omint', 'omint seg viagem': 'Omint',
  'azos': 'Azos', 'icatu': 'Icatu', 'prudential': 'Prudential',
  'pottencial': 'Pottencial', 'potencial': 'Pottencial',
  'akad (rc)': 'Akad', 'akad': 'Akad',
  'axa (empresarial)': 'AXA', 'axa': 'AXA',
}

export function canonSeguradora(nome) {
  const bruto = String(nome ?? '').trim()
  if (!bruto) return ''
  const chave = bruto.toLowerCase().replace(/\s+/g, ' ')
  return CANONICO_SEGURADORA[chave] || bruto
}

// Número do Excel (ex.: 45030) ou texto → ISO "AAAA-MM-DD" (ou null).
// Conversão manual do serial do Excel (serial 25569 = 1970-01-01), em UTC
// para não sofrer com fuso — não depende de XLSX.SSF.
function paraISO(v) {
  if (typeof v === 'number' && isFinite(v) && v > 60) {
    const d = new Date(Math.round((v - 25569) * 86400000))
    if (Number.isNaN(d.getTime())) return null
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

// Aceita número puro (xlsx) ou texto "R$ 1.234,56" / "1234.56"
function paraNumero(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null
  let s = String(v ?? '').replace(/[R$\s]/g, '')
  if (s === '') return null
  // se tem vírgula, ela é o decimal (pt-BR) e ponto é milhar
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return isFinite(n) ? n : null
}

// Normaliza um cabeçalho: "PRÊMIO MES" → "premiomes"
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// Acha o valor de uma linha por apelidos de cabeçalho (o primeiro que casar)
function campo(linhaNorm, ...apelidos) {
  for (const ap of apelidos) {
    for (const [k, v] of linhaNorm) if (k.includes(ap)) return v
  }
  return ''
}

// Escolhe a aba das apólices vigentes
export function acharAbaApolices(nomes) {
  return nomes.find((n) => /proposta.*fechad|seguro.*fechad|fechad|apolic|vigent/i.test(n))
    ?? nomes.find((n) => /proposta|apolic|seguro/i.test(n))
    ?? nomes[0]
}

// Lê o arquivo (ArrayBuffer) e devolve os registros de apólice limpos
export function lerPlanilhaGeral(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })
  const aba = acharAbaApolices(wb.SheetNames)
  const ws = wb.Sheets[aba]
  if (!ws) return { aba: null, abas: wb.SheetNames, registros: [], ignoradas: 0 }

  const linhas = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
  const registros = []
  let ignoradas = 0

  for (const linha of linhas) {
    // pares [cabecalho-normalizado, valor], ignorando colunas vazias/__EMPTY
    const linhaNorm = Object.entries(linha)
      .filter(([k]) => !/^__EMPTY/.test(k))
      .map(([k, v]) => [norm(k), v])

    const cliente = String(campo(linhaNorm, 'nomerazaosocial', 'nomecliente', 'razaosocial', 'nome', 'segurado', 'cliente')).trim()
    const seguradora = canonSeguradora(campo(linhaNorm, 'seguradora', 'cia', 'companhia'))
    const premioMes = paraNumero(campo(linhaNorm, 'premiomes', 'premiomensal', 'mensal'))
    const premioAnual = paraNumero(campo(linhaNorm, 'premioanual', 'anual'))
    const dataISO = paraISO(campo(linhaNorm, 'data', 'vigencia', 'inicio', 'emissao'))

    // linha só é apólice se tem cliente + seguradora + um prêmio
    if (!cliente || !seguradora || (premioMes == null && premioAnual == null)) {
      if (cliente || seguradora) ignoradas += 1
      continue
    }

    const comissaoBruta = paraNumero(campo(linhaNorm, 'comissao', 'percentual', '%'))
    // 0.4 → 40% ; 40 → 40% ; vazio → null (herda o padrão da seguradora)
    const percentual = comissaoBruta == null ? null
      : comissaoBruta > 0 && comissaoBruta <= 1 ? Math.round(comissaoBruta * 1000) / 10
        : comissaoBruta

    const statusBruto = String(campo(linhaNorm, 'status', 'situacao')).toLowerCase()
    const status = /cancel|inativ/.test(statusBruto) ? 'cancelada'
      : /suspens/.test(statusBruto) ? 'suspensa' : 'ativa'

    registros.push({
      cliente,
      codCliente: String(campo(linhaNorm, 'codcliente', 'codigocliente', 'codigo') ?? '').trim() || null,
      assessor: String(campo(linhaNorm, 'assessor', 'consultor') ?? '').trim() || null,
      codAssessor: String(campo(linhaNorm, 'codai', 'codassessor', 'codigoassessor', 'aai') ?? '').trim() || null,
      especialista: String(campo(linhaNorm, 'especialista') ?? '').trim() || null,
      numeroApolice: String(campo(linhaNorm, 'apolice', 'contrato', 'numero') ?? '').trim() || null,
      seguradora,
      premioMensal: premioMes ?? (premioAnual != null ? Math.round((premioAnual / 12) * 100) / 100 : null),
      premioAnual,
      percentual,
      vigencia: dataISO,
      tipoProduto: String(campo(linhaNorm, 'tipo', 'produto') ?? '').trim() || null,
      status,
      motivoCancelamento: String(campo(linhaNorm, 'motivocancelamento', 'motivo') ?? '').trim() || null,
    })
  }

  return { aba, abas: wb.SheetNames, registros, ignoradas }
}
