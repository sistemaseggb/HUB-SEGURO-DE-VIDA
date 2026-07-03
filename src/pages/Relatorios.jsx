import { useEffect, useMemo, useState } from 'react'
import {
  Download, TrendingDown, TrendingUp, Timer, Wallet, Database, Landmark, HandCoins,
  CheckCircle2, AlertTriangle, Printer, Sparkles, ArrowUpRight, ArrowDownRight, MessageCircle,
} from 'lucide-react'

// Badge de variação percentual vs mês anterior (▲ verde / ▼ vermelho)
function VariacaoBadge({ atual, anterior, rotulo, grande }) {
  if (!anterior) return rotulo ? <span className="text-xs text-slate-400">{rotulo}: novo</span>
    : <span className="text-xs text-slate-300">novo</span>
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100)
  const sobe = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${
      grande ? 'text-sm' : 'text-xs'} ${sobe ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {sobe ? <ArrowUpRight size={grande ? 15 : 12} /> : <ArrowDownRight size={grande ? 15 : 12} />}
      {sobe ? '+' : ''}{pct}%{rotulo ? ` ${rotulo}` : ''}
    </span>
  )
}
import { supabase } from '../lib/supabase'
import { brl, mesBR, dataBR } from '../lib/format'
import { etapaLabel, CHART } from '../lib/constants'
import { baixarCSV } from '../lib/csv'
import { PageHeader, Card, Button, Spinner, Input, Select, Campo, ComoFunciona, Badge } from '../components/ui'

// Busca comissoes_importadas em páginas de 1000 (limite do Supabase por
// consulta) — meses cheios passam disso com facilidade (MAG sozinha tem 500+).
async function buscarComissoesPaginado(colunas, filtro = (q) => q) {
  const todas = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtro(
      supabase.from('comissoes_importadas').select(colunas).order('id')
    ).range(de, de + 999)
    if (error || !data?.length) break
    todas.push(...data)
    if (data.length < 1000) break
  }
  return todas
}

// Relatórios gerenciais: fechamento de comissões (quanto pagar a cada assessor),
// análise de perdas e velocidade do funil. Tudo exportável em CSV.
export default function Relatorios() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [comissoes, setComissoes] = useState(null)
  const [splitMensal, setSplitMensal] = useState([])
  const [motivos, setMotivos] = useState([])
  const [tempos, setTempos] = useState([])
  const [importadas, setImportadas] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('vw_comissoes_assessor_mensal').select('*'),
      supabase.from('vw_comissoes_mensal').select('*').limit(12),
      supabase.from('vw_motivos_perda').select('*'),
      supabase.from('vw_tempo_medio_etapa').select('*'),
    ]).then(([c, s, m, t]) => {
      setComissoes(c.data ?? [])
      setSplitMensal(s.data ?? [])
      setMotivos(m.data ?? [])
      setTempos(t.data ?? [])
    })
  }, [])

  const [resumoImportadas, setResumoImportadas] = useState([])

  const [assessoresLista, setAssessoresLista] = useState([])

  function carregarComissoesDoMes() {
    buscarComissoesPaginado(
      'seguradora, segmento, tipo_receita, cliente_nome, codigo_cliente, codigo_assessor, producao, parcela, valor, assessores(nome), clientes(codigo)',
      (q) => q.eq('competencia', `${mes}-01`)
    ).then(setImportadas)
  }
  useEffect(carregarComissoesDoMes, [mes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.from('assessores').select('id, nome, codigo').order('nome')
      .then(({ data }) => setAssessoresLista(data ?? []))
  }, [])

  // Pendências de classificação do mês: produção (Nati/Bruno) e assessor.
  // Corrigir aqui atualiza TODAS as competências daquele cliente que ainda
  // estejam pendentes — classifica uma vez, vale para sempre.
  async function classificarProducao(cliente, producao) {
    await supabase.from('comissoes_importadas').update({ producao })
      .eq('cliente_nome', cliente).is('producao', null)
    carregarComissoesDoMes()
    supabase.from('vw_comissoes_importadas_resumo').select('*')
      .then(({ data }) => setResumoImportadas(data ?? []))
  }
  async function vincularAssessor(cliente, idAssessor) {
    const a = assessoresLista.find((x) => x.id === idAssessor)
    if (!a) return
    await supabase.from('comissoes_importadas')
      .update({ id_assessor: a.id, codigo_assessor: a.codigo ?? null })
      .eq('cliente_nome', cliente).is('codigo_assessor', null)
    carregarComissoesDoMes()
  }

  useEffect(() => {
    supabase.from('vw_comissoes_importadas_resumo').select('*')
      .then(({ data }) => setResumoImportadas(data ?? []))
  }, [])

  // Abre direto no último mês que tem comissões importadas (o mês corrente
  // costuma estar vazio até as planilhas chegarem) — a menos que a usuária
  // já tenha escolhido um mês.
  const [mesEscolhidoPelaUsuaria, setMesEscolhidoPelaUsuaria] = useState(false)
  useEffect(() => {
    if (mesEscolhidoPelaUsuaria || resumoImportadas.length === 0) return
    const meses = [...new Set(resumoImportadas.map((r) => String(r.competencia).slice(0, 7)))].sort()
    if (!meses.includes(mes)) setMes(meses[meses.length - 1])
  }, [resumoImportadas, mesEscolhidoPelaUsuaria, mes])

  const doMes = useMemo(
    () => (comissoes ?? []).filter((c) => String(c.mes).startsWith(mes)),
    [comissoes, mes]
  )
  const splitDoMes = useMemo(
    () => splitMensal.find((s) => String(s.mes).startsWith(mes)),
    [splitMensal, mes]
  )
  const totalPagar = doMes.reduce((s, c) => s + Number(c.comissao_a_pagar), 0)
  const maxMotivo = Math.max(...motivos.map((m) => m.total), 1)

  // Comissões importadas das seguradoras: agregações do mês selecionado
  const imp = useMemo(() => {
    const soma = (arr) => arr.reduce((s, r) => s + Number(r.valor), 0)
    const agrupa = (chave) => {
      const m = new Map()
      for (const r of importadas) {
        const k = chave(r)
        if (!m.has(k)) m.set(k, [])
        m.get(k).push(r)
      }
      return [...m.entries()].map(([k, rs]) => ({
        chave: k, total: soma(rs),
        nati: soma(rs.filter((r) => r.producao === 'Nati')),
        bruno: soma(rs.filter((r) => r.producao === 'Bruno')),
        clientes: new Set(rs.map((r) => r.cliente_nome)).size,
      })).sort((a, b) => b.total - a.total)
    }
    return {
      total: soma(importadas),
      nati: soma(importadas.filter((r) => r.producao === 'Nati')),
      bruno: soma(importadas.filter((r) => r.producao === 'Bruno')),
      semProducao: soma(importadas.filter((r) => r.producao !== 'Nati' && r.producao !== 'Bruno')),
      porSeguradora: agrupa((r) => r.seguradora),
      recorrente: soma(importadas.filter((r) => r.tipo_receita === 'recorrente')),
      vendaNova: soma(importadas.filter((r) => r.tipo_receita === 'venda_nova')),
      campanha: soma(importadas.filter((r) => r.tipo_receita === 'campanha')),
    }
  }, [importadas])

  // Fechamento para o financeiro: repasse por assessor, identificado pelo
  // código. É a planilha que o líder usa para pagar — precisa conferir 100%.
  const fechamento = useMemo(() => {
    const porCod = new Map()
    for (const r of importadas) {
      const cod = r.codigo_assessor || '(sem código)'
      if (!porCod.has(cod)) {
        porCod.set(cod, { codigo: cod, nome: null, total: 0, estornos: 0, lancamentos: 0, clientes: new Set(), producoes: new Set() })
      }
      const a = porCod.get(cod)
      if (r.assessores?.nome) a.nome = r.assessores.nome
      a.total += Number(r.valor)
      if (Number(r.valor) < 0) a.estornos += Number(r.valor)
      a.lancamentos += 1
      a.clientes.add(r.cliente_nome)
      if (r.producao) a.producoes.add(r.producao)
    }
    const linhas = [...porCod.values()].sort((a, b) => b.total - a.total)
    const totalGeral = linhas.reduce((s, a) => s + a.total, 0)
    return { linhas, totalGeral, confere: Math.abs(totalGeral - imp.total) < 0.005 }
  }, [importadas, imp.total])

  const codCliente = (r) => r.codigo_cliente || r.clientes?.codigo || ''

  const pendencias = useMemo(() => {
    const semProducao = new Map()
    const semAssessor = new Map()
    for (const r of importadas) {
      if (!r.producao) {
        const c = semProducao.get(r.cliente_nome) ?? { n: 0, total: 0 }
        c.n += 1; c.total += Number(r.valor)
        semProducao.set(r.cliente_nome, c)
      }
      if (!r.codigo_assessor) {
        const c = semAssessor.get(r.cliente_nome) ?? { n: 0, total: 0 }
        c.n += 1; c.total += Number(r.valor)
        semAssessor.set(r.cliente_nome, c)
      }
    }
    const ordena = (m) => [...m.entries()].sort((a, b) => b[1].total - a[1].total)
    return { semProducao: ordena(semProducao), semAssessor: ordena(semAssessor) }
  }, [importadas])

  function exportarFechamento() {
    baixarCSV(`fechamento-financeiro-${mes}.csv`,
      ['Cód. assessor', 'Assessor', 'Produção', 'Clientes', 'Lançamentos', 'Estornos', 'Total a repassar'],
      [
        ...fechamento.linhas.map((a) => [a.codigo, a.nome ?? '', [...a.producoes].join('/'),
          a.clientes.size, a.lancamentos, a.estornos.toFixed(2).replace('.', ','), a.total.toFixed(2).replace('.', ',')]),
        ['', 'TOTAL GERAL', '', '', '', '', fechamento.totalGeral.toFixed(2).replace('.', ',')],
      ])
  }

  function exportarFechamentoDetalhado() {
    baixarCSV(`fechamento-detalhado-${mes}.csv`,
      ['Cód. assessor', 'Assessor', 'Cód. cliente', 'Cliente', 'Seguradora', 'Segmento', 'Produção', 'Parcela', 'Tipo de receita', 'Valor'],
      [...importadas]
        .sort((a, b) => (a.codigo_assessor ?? 'zzz').localeCompare(b.codigo_assessor ?? 'zzz') || a.cliente_nome.localeCompare(b.cliente_nome))
        .map((r) => [r.codigo_assessor ?? '', r.assessores?.nome ?? '', codCliente(r), r.cliente_nome,
          r.seguradora, r.segmento, r.producao ?? 'A classificar', r.parcela ?? '', r.tipo_receita,
          Number(r.valor).toFixed(2).replace('.', ',')]))
  }

  // Inteligência do mês: comparativos com o mês anterior, top clientes,
  // concentração de receita e vigilância de seguradoras não importadas.
  const inteligencia = useMemo(() => {
    const [a, m] = mes.split('-').map(Number)
    const dAnt = new Date(a, m - 2, 1)
    const mesAnterior = `${dAnt.getFullYear()}-${String(dAnt.getMonth() + 1).padStart(2, '0')}`
    const doMes = (mesX) => resumoImportadas.filter((r) => String(r.competencia).slice(0, 7) === mesX)

    const porSeg = (linhas) => {
      const mm = new Map()
      for (const r of linhas) mm.set(r.seguradora, (mm.get(r.seguradora) ?? 0) + Number(r.total))
      return mm
    }
    const segAtual = porSeg(doMes(mes))
    const segAnt = porSeg(doMes(mesAnterior))
    const seguradoras = [...new Set([...segAtual.keys(), ...segAnt.keys()])]
      .map((s) => ({ seguradora: s, atual: segAtual.get(s) ?? 0, anterior: segAnt.get(s) ?? 0 }))
      .sort((x, y) => y.atual - x.atual)

    const porReceita = (linhas) => {
      const mm = { recorrente: 0, venda_nova: 0, campanha: 0 }
      for (const r of linhas) mm[r.tipo_receita] = (mm[r.tipo_receita] ?? 0) + Number(r.total)
      return mm
    }
    const recAtual = porReceita(doMes(mes))
    const recAnt = porReceita(doMes(mesAnterior))

    const totalAtual = seguradoras.reduce((s, x) => s + x.atual, 0)
    const totalAnterior = seguradoras.reduce((s, x) => s + x.anterior, 0)
    const faltando = seguradoras.filter((x) => x.anterior > 0 && x.atual === 0).map((x) => x.seguradora)

    const porCliente = new Map()
    for (const r of importadas) porCliente.set(r.cliente_nome, (porCliente.get(r.cliente_nome) ?? 0) + Number(r.valor))
    const topClientes = [...porCliente.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
    const somaTop = topClientes.reduce((s, [, v]) => s + v, 0)

    // Projeção de receita recorrente: média dos últimos 3 meses com carteira
    // (estimativa conservadora — não inclui vendas novas nem campanhas)
    const recPorMes = new Map()
    for (const r of resumoImportadas) {
      if (r.tipo_receita !== 'recorrente') continue
      const mm = String(r.competencia).slice(0, 7)
      recPorMes.set(mm, (recPorMes.get(mm) ?? 0) + Number(r.total))
    }
    const baseProjecao = [...recPorMes.entries()].sort().slice(-3)
    const projecao = baseProjecao.length >= 2
      ? {
          media: baseProjecao.reduce((s, [, v]) => s + v, 0) / baseProjecao.length,
          meses: baseProjecao.map(([mm]) => mm),
        }
      : null

    return {
      mesAnterior, seguradoras, recAtual, recAnt, totalAtual, totalAnterior, faltando,
      topClientes, projecao,
      concentracao: totalAtual > 0 ? Math.round((somaTop / totalAtual) * 100) : 0,
      temAnterior: totalAnterior > 0,
    }
  }, [resumoImportadas, importadas, mes])

  // Resumo do fechamento pronto para mandar ao líder pelo WhatsApp
  function enviarResumoWhatsApp() {
    const texto = [
      `*Fechamento de comissões — ${mesBR(mes + '-01')}*`,
      `Total: ${brl(imp.total)}${fechamento.confere ? ' ✅ conferido' : ''}`,
      `Natália: ${brl(imp.nati)} · Bruno: ${brl(imp.bruno)}`,
      '',
      '*Por seguradora:*',
      ...imp.porSeguradora.map((s) => `• ${s.chave}: ${brl(s.total)}`),
      '',
      '*Assessores (total a repassar):*',
      ...fechamento.linhas.slice(0, 8).map((a) => `• ${a.codigo}${a.nome ? ` — ${a.nome}` : ''}: ${brl(a.total)}`),
      fechamento.linhas.length > 8 ? `… e mais ${fechamento.linhas.length - 8} (planilha completa em anexo)` : '',
      '',
      '_Gerado pelo Hub Seguro de Vida_',
    ].filter((l) => l !== '').join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noreferrer')
  }

  // Fechamento em PDF: abre uma janela de impressão com layout limpo —
  // o navegador salva em PDF (mesmo caminho da Proposta).
  function imprimirFechamento() {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const linhas = fechamento.linhas.map((a, i) => `
      <tr>
        <td class="mudo">${i + 1}º</td>
        <td><code>${esc(a.codigo)}</code></td>
        <td class="nome">${esc(a.nome ?? '— cadastrar —')}</td>
        <td>${esc([...a.producoes].join(' / ') || '—')}</td>
        <td class="num">${a.clientes.size}</td>
        <td class="num">${a.lancamentos}</td>
        <td class="num ${a.estornos < 0 ? 'neg' : 'mudo'}">${a.estornos < 0 ? brl(a.estornos) : '—'}</td>
        <td class="num total">${brl(a.total)}</td>
      </tr>`).join('')
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Fechamento de comissões — ${mesBR(mes + '-01')}</title>
      <style>
        * { box-sizing: border-box; margin: 0; }
        body { font: 13px/1.5 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; padding: 36px; }
        h1 { font-size: 20px; margin-bottom: 2px; }
        .sub { color: #64748b; font-size: 12px; margin-bottom: 18px; }
        .confere { border: 1px solid ${fechamento.confere ? '#a7f3d0' : '#fecaca'}; background: ${fechamento.confere ? '#ecfdf5' : '#fef2f2'};
          color: ${fechamento.confere ? '#065f46' : '#991b1b'}; border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #64748b;
          border-bottom: 2px solid #e2e8f0; padding: 6px 8px; }
        th.num { text-align: right; }
        td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        td.total { font-weight: 700; }
        td.nome { font-weight: 600; }
        td.mudo, .mudo { color: #94a3b8; }
        td.neg { color: #dc2626; }
        code { background: #f1f5f9; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
        tr.geral td { border-top: 2px solid #e2e8f0; font-weight: 700; font-size: 14px; }
        .rodape { margin-top: 22px; color: #94a3b8; font-size: 10px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Fechamento de comissões — ${mesBR(mes + '-01')}</h1>
      <p class="sub">Repasse por assessor · gerado pelo Hub Seguro de Vida em ${new Date().toLocaleDateString('pt-BR')}</p>
      <p class="confere">${fechamento.confere
        ? `✓ Conferido: a soma dos assessores (${brl(fechamento.totalGeral)}) bate com o total importado do mês, centavo a centavo.`
        : `⚠ Atenção: a soma dos assessores (${brl(fechamento.totalGeral)}) difere do total do mês (${brl(imp.total)}).`}</p>
      <table>
        <thead><tr><th>#</th><th>Cód. assessor</th><th>Assessor</th><th>Produção</th>
          <th class="num">Clientes</th><th class="num">Lançamentos</th><th class="num">Estornos</th><th class="num">Total a repassar</th></tr></thead>
        <tbody>${linhas}
          <tr class="geral"><td colspan="7">Total geral do mês</td><td class="num">${brl(fechamento.totalGeral)}</td></tr>
        </tbody>
      </table>
      <p class="rodape">Estornos entram com valor negativo e já estão abatidos dos totais. Seguros com pagamento anual
        aparecem no mês em que a seguradora pagou a comissão; os mensais aparecem todo mês.</p>
      <script>window.onload = () => window.print()</script>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  // Evolução de todos os meses importados (Natália × Bruno × total)
  const evolucaoImportadas = useMemo(() => {
    const porMes = new Map()
    for (const r of resumoImportadas) {
      const m = String(r.competencia).slice(0, 7)
      const acc = porMes.get(m) ?? { total: 0, nati: 0, bruno: 0 }
      acc.total += Number(r.total)
      if (r.producao === 'Nati') acc.nati += Number(r.total)
      if (r.producao === 'Bruno') acc.bruno += Number(r.total)
      porMes.set(m, acc)
    }
    return [...porMes.entries()].sort().map(([m, v]) => ({ mes: m, ...v }))
  }, [resumoImportadas])

  // Matriz cliente × mês — a "Comissão Mês" da planilha geral, agora automática
  async function exportarMatrizClienteMes() {
    const linhas = await buscarComissoesPaginado('cliente_nome, seguradora, competencia, valor')
    const meses = [...new Set(linhas.map((r) => String(r.competencia).slice(0, 7)))].sort()
    const porCliente = new Map()
    for (const r of linhas) {
      const k = `${r.cliente_nome}|${r.seguradora}`
      if (!porCliente.has(k)) porCliente.set(k, {})
      const c = porCliente.get(k)
      const m = String(r.competencia).slice(0, 7)
      c[m] = (c[m] ?? 0) + Number(r.valor)
    }
    baixarCSV('matriz-cliente-mes.csv',
      ['Cliente', 'Seguradora', ...meses.map((m) => mesBR(`${m}-01`))],
      [...porCliente.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, valores]) => {
          const [cliente, seguradora] = k.split('|')
          return [cliente, seguradora, ...meses.map((m) => valores[m]?.toFixed(2).replace('.', ',') ?? '')]
        }))
  }

  async function exportarClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('codigo, nome, telefone, email, data_nascimento, status_funil, perfil_necessidade, assessores(nome)')
      .order('nome')
    baixarCSV('clientes.csv',
      ['Código', 'Nome', 'Telefone', 'Email', 'Nascimento', 'Etapa', 'Assessor', 'Perfil'],
      (data ?? []).map((c) => [c.codigo, c.nome, c.telefone, c.email,
        c.data_nascimento ? dataBR(c.data_nascimento) : '', etapaLabel(c.status_funil),
        c.assessores?.nome ?? '', c.perfil_necessidade]))
  }

  async function exportarApolices() {
    const { data } = await supabase
      .from('apolices')
      .select('numero_apolice, valor_premio_mensal, capital_segurado, comissao_gerada, data_vigencia, status, clientes(nome, codigo), seguradoras(nome)')
      .order('data_vigencia', { ascending: false })
    baixarCSV('apolices.csv',
      ['Nº Apólice', 'Cliente', 'Cód. Cliente', 'Seguradora', 'Prêmio mensal', 'Capital', 'Comissão', 'Vigência', 'Status'],
      (data ?? []).map((a) => [a.numero_apolice, a.clientes?.nome ?? '', a.clientes?.codigo ?? '',
        a.seguradoras?.nome ?? '', a.valor_premio_mensal, a.capital_segurado, a.comissao_gerada,
        a.data_vigencia ? dataBR(a.data_vigencia) : '', a.status]))
  }

  if (!comissoes) return <Spinner />

  return (
    <div>
      <PageHeader titulo="Relatórios" subtitulo="Fechamento de comissões e análises do funil">
        <div className="w-44">
          <Campo label="Mês de referência">
            <Input type="month" value={mes}
              onChange={(e) => { setMes(e.target.value); setMesEscolhidoPelaUsuaria(true) }} />
          </Campo>
        </div>
      </PageHeader>

      <ComoFunciona id="relatorios">
        Escolha o <strong>mês</strong> no canto superior para ver quanto pagar a cada assessor no fechamento
        (com botão de exportar para Excel). Mais abaixo, o sistema mostra <strong>por que você perde clientes</strong> e
        o <strong>tempo médio em cada etapa</strong> do funil — para descobrir onde travam as vendas. Faça o backup
        dos dados de tempos em tempos.
      </ComoFunciona>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Backup / exportação de dados */}
        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Database size={17} className="text-slate-600" /> Backup dos dados
              </h2>
              <p className="text-xs text-slate-400">Baixe uma cópia completa em CSV (abre no Excel) — faça isso de tempos em tempos.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={exportarClientes}><Download size={15} /> Exportar clientes</Button>
              <Button variant="secondary" onClick={exportarApolices}><Download size={15} /> Exportar apólices</Button>
            </div>
          </div>
        </Card>

        {/* Fechamento de comissões por assessor */}
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Wallet size={17} className="text-blue-600" /> Comissões a pagar — {mesBR(mes + '-01')}
              </h2>
              <p className="text-xs text-slate-400">Use este relatório no fechamento do mês com o escritório</p>
            </div>
            <Button variant="secondary" disabled={doMes.length === 0}
              onClick={() => baixarCSV(
                `comissoes-assessores-${mes}.csv`,
                ['Assessor', 'Vendas', 'Prêmio mensal total', 'Comissão a pagar'],
                doMes.map((c) => [c.nome_assessor, c.vendas, c.premio_mensal_total, c.comissao_a_pagar])
              )}>
              <Download size={15} /> Exportar CSV
            </Button>
          </div>
          {doMes.length === 0
            ? <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhuma venda no mês selecionado.</p>
            : (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="px-5 py-3 font-medium">Assessor</th>
                    <th className="px-3 py-3 font-medium">Vendas</th>
                    <th className="px-3 py-3 font-medium">Prêmio mensal gerado</th>
                    <th className="px-3 py-3 text-right font-medium">Comissão a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {doMes.map((c) => (
                    <tr key={c.id_assessor} className="border-b border-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{c.nome_assessor}</td>
                      <td className="px-3 py-3">{c.vendas}</td>
                      <td className="px-3 py-3">{brl(c.premio_mensal_total)}</td>
                      <td className="px-3 py-3 text-right font-semibold">{brl(c.comissao_a_pagar)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-right text-xs uppercase text-slate-400">Total assessores</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-900">{brl(totalPagar)}</td>
                  </tr>
                  {splitDoMes && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={3} className="px-5 py-3 text-right text-xs uppercase text-slate-400">
                        Natália: {brl(splitDoMes.comissao_natalia)} · Escritório: {brl(splitDoMes.comissao_escritorio)}
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-slate-400">
                        comissão total {brl(splitDoMes.comissao_total)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table></div>
            )}
        </Card>

        {/* Comissões importadas das seguradoras */}
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Landmark size={17} className="text-emerald-600" /> Comissões recebidas das seguradoras — {mesBR(mes + '-01')}
              </h2>
              <p className="text-xs text-slate-400">
                Extrato real importado das planilhas (Azos, Icatu, MAG, Omint...) em Importar → Comissões
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={importadas.length === 0}
                onClick={() => baixarCSV(
                  `comissoes-seguradoras-${mes}.csv`,
                  ['Seguradora', 'Natália', 'Bruno', 'Total', 'Clientes'],
                  imp.porSeguradora.map((s) => [s.chave, s.nati, s.bruno, s.total, s.clientes])
                )}>
                <Download size={15} /> Resumo CSV
              </Button>
              <Button variant="secondary" disabled={importadas.length === 0}
                onClick={() => baixarCSV(
                  `comissoes-detalhado-${mes}.csv`,
                  ['Cliente', 'Seguradora', 'Segmento', 'Produção', 'Assessor', 'Cód. assessor', 'Parcela', 'Tipo de receita', 'Valor'],
                  importadas.map((r) => [r.cliente_nome, r.seguradora, r.segmento, r.producao ?? 'A classificar',
                    r.assessores?.nome ?? '', r.codigo_assessor ?? '', r.parcela ?? '', r.tipo_receita, r.valor])
                )}>
                <Download size={15} /> Detalhado CSV
              </Button>
              <Button variant="secondary" disabled={evolucaoImportadas.length === 0}
                onClick={exportarMatrizClienteMes}
                title="Comissão de cada cliente mês a mês — a 'Comissão Mês' da planilha geral, agora automática">
                <Download size={15} /> Matriz cliente × mês
              </Button>
            </div>
          </div>

          {importadas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Nenhuma comissão importada neste mês. Importe as planilhas das seguradoras em <strong>Importar → Comissões</strong>.
            </p>
          ) : (
            <div className="p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge tom="blue">Total do mês: {brl(imp.total)}</Badge>
                <Badge tom="green">Natália: {brl(imp.nati)}</Badge>
                <Badge>Bruno: {brl(imp.bruno)}</Badge>
                {imp.semProducao !== 0 && <Badge tom="yellow">A classificar: {brl(imp.semProducao)}</Badge>}
                <Badge>Recorrente: {brl(imp.recorrente)}</Badge>
                <Badge>Venda nova: {brl(imp.vendaNova)}</Badge>
                {imp.campanha !== 0 && <Badge tom="gold">Campanhas: {brl(imp.campanha)}</Badge>}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs font-medium uppercase text-slate-400">Por seguradora</p>
                  <table className="w-full min-w-[380px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                        <th className="py-2 font-medium">Seguradora</th>
                        <th className="py-2 text-right font-medium">Natália</th>
                        <th className="py-2 text-right font-medium">Bruno</th>
                        <th className="py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imp.porSeguradora.map((s) => (
                        <tr key={s.chave} className="border-b border-slate-50">
                          <td className="py-2.5 font-medium text-slate-800">{s.chave}</td>
                          <td className="py-2.5 text-right">{brl(s.nati)}</td>
                          <td className="py-2.5 text-right text-slate-500">{brl(s.bruno)}</td>
                          <td className="py-2.5 text-right font-semibold">{brl(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs font-medium uppercase text-slate-400">Evolução — todos os meses importados</p>
                  <table className="w-full min-w-[380px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                        <th className="py-2 font-medium">Mês</th>
                        <th className="py-2 text-right font-medium">Natália</th>
                        <th className="py-2 text-right font-medium">Bruno</th>
                        <th className="py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evolucaoImportadas.map((e) => (
                        <tr key={e.mes}
                          className={`border-b border-slate-50 ${e.mes === mes ? 'bg-blue-50/50 font-medium' : ''}`}>
                          <td className="py-2.5 text-slate-800">{mesBR(`${e.mes}-01`)}</td>
                          <td className="py-2.5 text-right">{brl(e.nati)}</td>
                          <td className="py-2.5 text-right text-slate-500">{brl(e.bruno)}</td>
                          <td className="py-2.5 text-right font-semibold">{brl(e.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}
        </Card>

        {/* Inteligência do mês — comparativos e alertas */}
        {importadas.length > 0 && (
          <Card className="p-5 xl:col-span-2">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Sparkles size={17} className="text-violet-600" /> Inteligência do mês — {mesBR(mes + '-01')}
              </h2>
              {inteligencia.temAnterior && (
                <VariacaoBadge atual={inteligencia.totalAtual} anterior={inteligencia.totalAnterior}
                  rotulo={`vs ${mesBR(inteligencia.mesAnterior + '-01')}`} grande />
              )}
            </div>
            <p className="mb-4 text-xs text-slate-400">Comparativos calculados sozinhos a partir das planilhas importadas</p>

            {inteligencia.faltando.length > 0 && (
              <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle size={15} className="shrink-0" />
                <span><strong>Falta importar:</strong> {inteligencia.faltando.join(', ')} — teve movimento em{' '}
                {mesBR(inteligencia.mesAnterior + '-01')} e ainda não entrou neste mês.</span>
              </p>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-slate-400">Seguradoras — variação vs mês anterior</p>
                <div className="space-y-1.5">
                  {inteligencia.seguradoras.map((s) => (
                    <div key={s.seguradora} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 font-medium text-slate-800">{s.seguradora}</span>
                      <span className="w-24 text-right font-semibold tabular-nums">{brl(s.atual)}</span>
                      <VariacaoBadge atual={s.atual} anterior={s.anterior} />
                    </div>
                  ))}
                </div>

                <p className="mb-2 mt-5 text-xs font-medium uppercase text-slate-400">Tipo de receita</p>
                <div className="space-y-1.5">
                  {[['recorrente', 'Recorrente (carteira)'], ['venda_nova', 'Venda nova'], ['campanha', 'Campanhas']].map(([k, rotulo]) => (
                    (inteligencia.recAtual[k] !== 0 || inteligencia.recAnt[k] !== 0) && (
                      <div key={k} className="flex items-center gap-3 text-sm">
                        <span className="w-40 shrink-0 text-slate-600">{rotulo}</span>
                        <span className="w-24 text-right font-semibold tabular-nums">{brl(inteligencia.recAtual[k] ?? 0)}</span>
                        <VariacaoBadge atual={inteligencia.recAtual[k] ?? 0} anterior={inteligencia.recAnt[k] ?? 0} />
                      </div>
                    )
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase text-slate-400">
                  Top 5 clientes do mês · concentram {inteligencia.concentracao}% da receita
                </p>
                <div className="space-y-2">
                  {inteligencia.topClientes.map(([cliente, v], i) => (
                    <div key={cliente} className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{cliente}</p>
                        <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                          <div className="h-1.5 rounded bg-violet-400"
                            style={{ width: `${Math.max((v / (inteligencia.topClientes[0]?.[1] || 1)) * 100, 4)}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{brl(v)}</span>
                    </div>
                  ))}
                </div>
                {inteligencia.concentracao >= 40 && (
                  <p className="mt-3 text-xs text-slate-400">
                    ⚠ Quase metade da receita vem de poucos clientes — vale reforçar a retenção deles no Pós-Venda.
                  </p>
                )}
              </div>
            </div>

            {inteligencia.projecao && (
              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-sm text-slate-700">
                <TrendingUp size={16} className="shrink-0 text-blue-600" />
                <span>
                  <strong>Projeção de receita recorrente:</strong> ≈ {brl(inteligencia.projecao.media)}/mês
                  nos próximos meses, mantida a carteira atual.
                </span>
                <span className="text-xs text-slate-400">
                  Estimativa pela média recorrente de {inteligencia.projecao.meses.map((m) => mesBR(`${m}-01`)).join(', ')} —
                  não inclui vendas novas nem campanhas.
                </span>
              </div>
            )}
          </Card>
        )}

        {/* Fechamento para o financeiro — repasse por assessor */}
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <HandCoins size={17} className="text-blue-700" /> Fechamento para o financeiro — {mesBR(mes + '-01')}
              </h2>
              <p className="text-xs text-slate-400">
                A planilha de pagamento: quanto repassar a cada assessor, identificado pelo código.
                Envie o CSV para o líder.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={importadas.length === 0} onClick={exportarFechamento}>
                <Download size={15} /> Fechamento (CSV)
              </Button>
              <Button variant="secondary" disabled={importadas.length === 0} onClick={imprimirFechamento}>
                <Printer size={15} /> Imprimir / PDF
              </Button>
              <Button variant="secondary" disabled={importadas.length === 0} onClick={enviarResumoWhatsApp}
                title="Abre o WhatsApp com o resumo do fechamento pronto — escolha o contato do líder e envie">
                <MessageCircle size={15} /> Enviar resumo (WhatsApp)
              </Button>
              <Button variant="secondary" disabled={importadas.length === 0} onClick={exportarFechamentoDetalhado}>
                <Download size={15} /> Detalhado com códigos (CSV)
              </Button>
            </div>
          </div>

          {importadas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Importe as planilhas do mês em <strong>Importar → Comissões</strong> para gerar o fechamento.
            </p>
          ) : (
            <div className="p-5">
              {/* Conferência automática: a soma dos assessores TEM que bater com o total do mês */}
              <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
                fechamento.confere ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'}`}>
                {fechamento.confere ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {fechamento.confere
                  ? <>Conferido: a soma dos assessores ({brl(fechamento.totalGeral)}) bate com o total importado do mês, centavo a centavo.</>
                  : <>Atenção: a soma dos assessores ({brl(fechamento.totalGeral)}) difere do total do mês ({brl(imp.total)}) — verifique antes de pagar.</>}
              </div>

              {(pendencias.semProducao.length > 0 || pendencias.semAssessor.length > 0) && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <AlertTriangle size={15} /> Pendências de classificação — resolva aqui mesmo, antes de enviar ao líder
                  </p>

                  {pendencias.semProducao.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium uppercase text-amber-700">
                        Produção não identificada — de quem é cada cliente?
                      </p>
                      <div className="space-y-2">
                        {pendencias.semProducao.map(([cliente, c]) => (
                          <div key={cliente} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm">
                            <span className="font-medium text-slate-800">{cliente}</span>
                            <span className="text-xs text-slate-500">{c.n} lançamento(s) · {brl(c.total)}</span>
                            <div className="ml-auto flex gap-1.5">
                              <button onClick={() => classificarProducao(cliente, 'Nati')}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                É da Nati
                              </button>
                              <button onClick={() => classificarProducao(cliente, 'Bruno')}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                É do Bruno
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendencias.semAssessor.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-amber-700">
                        Sem código de assessor — escolha quem indicou
                      </p>
                      <div className="space-y-2">
                        {pendencias.semAssessor.map(([cliente, c]) => (
                          <div key={cliente} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm">
                            <span className="font-medium text-slate-800">{cliente}</span>
                            <span className="text-xs text-slate-500">{c.n} lançamento(s) · {brl(c.total)}</span>
                            <div className="ml-auto w-60">
                              <Select defaultValue="" onChange={(e) => e.target.value && vincularAssessor(cliente, e.target.value)}>
                                <option value="">Vincular assessor...</option>
                                {assessoresLista.map((a) => (
                                  <option key={a.id} value={a.id}>{a.nome}{a.codigo ? ` (${a.codigo})` : ''}</option>
                                ))}
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fechamento.linhas.some((a) => a.codigo !== '(sem código)' && !a.nome) && (
                <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle size={14} className="shrink-0" />
                  Há códigos de assessor ainda sem cadastro (nome em branco na tabela).
                  Cadastre-os em <strong>Cadastros → Assessores</strong> para o nome aparecer no fechamento.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                      <th className="py-2 pr-2 font-medium">#</th>
                      <th className="py-2 font-medium">Cód. assessor</th>
                      <th className="py-2 font-medium">Assessor</th>
                      <th className="py-2 font-medium">Produção</th>
                      <th className="py-2 text-right font-medium">Clientes</th>
                      <th className="py-2 text-right font-medium">Lançamentos</th>
                      <th className="py-2 text-right font-medium">Estornos</th>
                      <th className="py-2 text-right font-medium">Total a repassar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fechamento.linhas.map((a, i) => (
                      <tr key={a.codigo} className={`border-b border-slate-50 ${a.codigo === '(sem código)' ? 'bg-amber-50/60' : ''}`}>
                        <td className="py-2.5 pr-2 text-xs text-slate-400">{i + 1}º</td>
                        <td className="py-2.5">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                            {a.codigo}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-slate-800">{a.nome ?? <span className="text-slate-400">— cadastrar —</span>}</td>
                        <td className="py-2.5 text-xs text-slate-500">{[...a.producoes].join(' / ') || '—'}</td>
                        <td className="py-2.5 text-right text-slate-500">{a.clientes.size}</td>
                        <td className="py-2.5 text-right text-slate-500">{a.lancamentos}</td>
                        <td className={`py-2.5 text-right ${a.estornos < 0 ? 'text-red-600' : 'text-slate-300'}`}>
                          {a.estornos < 0 ? brl(a.estornos) : '—'}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-slate-900">{brl(a.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/60">
                      <td colSpan={7} className="px-2 py-3 text-right text-xs uppercase text-slate-400">Total geral do mês</td>
                      <td className="py-3 text-right font-bold text-slate-900">{brl(fechamento.totalGeral)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Seguros com pagamento anual aparecem no mês em que a seguradora paga a comissão (parcela única);
                os mensais aparecem todo mês. Estornos entram negativos e já saem abatidos do repasse.
              </p>
            </div>
          )}
        </Card>

        {/* Motivos de perda */}
        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <TrendingDown size={17} className="text-red-500" /> Por que perdemos clientes
          </h2>
          <p className="mb-4 text-xs text-slate-400">Registrado ao mover para "Perdido" no Kanban</p>
          {motivos.length === 0
            ? <p className="text-sm text-slate-400">Nenhuma perda registrada. 🎉</p>
            : (
              <div className="space-y-2">
                {motivos.map((m) => (
                  <div key={m.motivo} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-right text-xs text-slate-500" title={m.motivo}>
                      {m.motivo}
                    </span>
                    <div className="h-6 flex-1 rounded-r-md bg-slate-50">
                      <div className="flex h-6 items-center rounded-r-md pl-2"
                        style={{ width: `${Math.max((m.total / maxMotivo) * 100, 8)}%`, background: CHART.serie1 }}>
                        <span className="text-xs font-semibold text-white">{m.total}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>

        {/* Tempo médio por etapa */}
        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <Timer size={17} className="text-violet-600" /> Tempo médio em cada etapa
          </h2>
          <p className="mb-4 text-xs text-slate-400">Calculado do histórico automático do funil — mostra gargalos</p>
          {tempos.length === 0
            ? <p className="text-sm text-slate-400">Ainda sem movimentações suficientes.</p>
            : (
              <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-2 font-medium">Etapa</th>
                    <th className="py-2 text-right font-medium">Dias médios</th>
                    <th className="py-2 text-right font-medium">Passagens</th>
                  </tr>
                </thead>
                <tbody>
                  {tempos.map((t) => (
                    <tr key={t.etapa} className="border-b border-slate-50">
                      <td className="py-2.5 text-slate-700">{etapaLabel(t.etapa)}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-800">{t.dias_medios}</td>
                      <td className="py-2.5 text-right text-slate-400">{t.passagens}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
        </Card>
      </div>
    </div>
  )
}
