import { useEffect, useMemo, useState } from 'react'
import {
  Download, TrendingDown, TrendingUp, Timer, Wallet, Database, Landmark, HandCoins,
  CheckCircle2, AlertTriangle, Printer, Sparkles, ArrowUpRight, ArrowDownRight, MessageCircle, PiggyBank,
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
// Bloco do fechamento: linha-resumo do assessor + uma sub-linha por seguradora
// (a quebra assessor × seguradora que o financeiro precisa para lançar)
function FragmentoAssessor({ a }) {
  return (
    <>
      <tr className={`border-t border-slate-100 ${a.codigo === '(sem código)' ? 'bg-amber-50/60' : 'bg-slate-50/60'}`}>
        <td className="py-2.5">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
            {a.codigo}
          </span>
        </td>
        <td className="py-2.5 font-semibold text-slate-800">{a.nome ?? <span className="text-slate-400">— cadastrar —</span>}</td>
        <td className="py-2.5 text-xs text-slate-500">{[...a.producoes].join(' / ') || '—'}</td>
        <td className="py-2.5 text-right text-slate-500">{a.clientes}</td>
        <td className="py-2.5 text-right text-slate-500">{a.lancamentos}</td>
        <td className={`py-2.5 text-right ${a.estornos < 0 ? 'text-red-600' : 'text-slate-300'}`}>
          {a.estornos < 0 ? brl(a.estornos) : '—'}
        </td>
        <td className="py-2.5 text-right font-semibold text-slate-900">{brl(a.split.bruto)}</td>
        <td className="py-2.5 text-right text-slate-600">{brl(a.split.liquido)}</td>
        <td className="py-2.5 text-right font-semibold text-emerald-700">{brl(a.split.assessor)}</td>
      </tr>
      {a.seguradoras.map((s) => (
        <tr key={s.seguradora} className="border-b border-slate-50 text-xs">
          <td />
          <td className="py-2 pl-4 text-slate-500">↳ {s.seguradora}</td>
          <td className="py-2 text-slate-400">{[...s.producoes].join(' / ') || '—'}</td>
          <td className="py-2 text-right text-slate-400">{s.clientes}</td>
          <td className="py-2 text-right text-slate-400">{s.lancamentos}</td>
          <td className={`py-2 text-right ${s.estornos < 0 ? 'text-red-500' : 'text-slate-300'}`}>
            {s.estornos < 0 ? brl(s.estornos) : '—'}
          </td>
          <td className="py-2 text-right tabular-nums text-slate-700">{brl(s.split.bruto)}</td>
          <td className="py-2 text-right tabular-nums text-slate-400">{brl(s.split.liquido)}</td>
          <td className="py-2 text-right tabular-nums text-slate-600">{brl(s.split.assessor)}</td>
        </tr>
      ))}
    </>
  )
}
import { supabase } from '../lib/supabase'
import { brl, mesBR, dataBR } from '../lib/format'
import { etapaLabel, CHART } from '../lib/constants'
import { baixarCSV } from '../lib/csv'
import { configSplit, splitComissao } from '../lib/fechamento'
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
  const [cfgBanco, setCfgBanco] = useState(null)
  const [todasComissoes, setTodasComissoes] = useState([])

  // Percentuais do fechamento (imposto 20% e divisão 40/30/30 sobre o líquido)
  // vêm de Cadastros; antes da migração 011 valem os padrões do escritório.
  const cfg = useMemo(() => configSplit(cfgBanco), [cfgBanco])

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

  // Todos os meses (colunas mínimas) — alimenta o Controle da Natália:
  // quanto ela ganha em cada mês, incluindo as vendas indicadas por ela.
  function carregarTodasComissoes() {
    buscarComissoesPaginado('competencia, producao, tipo_receita, codigo_assessor, valor')
      .then(setTodasComissoes)
  }
  useEffect(carregarTodasComissoes, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.from('assessores').select('id, nome, codigo').order('nome')
      .then(({ data }) => setAssessoresLista(data ?? []))
    supabase.from('configuracoes').select('*').single()
      .then(({ data }) => setCfgBanco(data))
  }, [])

  // Pendências de classificação do mês: produção (Nati/Bruno) e assessor.
  // Corrigir aqui atualiza TODAS as competências daquele cliente que ainda
  // estejam pendentes — classifica uma vez, vale para sempre.
  async function classificarProducao(cliente, producao) {
    await supabase.from('comissoes_importadas').update({ producao })
      .eq('cliente_nome', cliente).is('producao', null)
    carregarComissoesDoMes()
    carregarTodasComissoes()
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
    carregarTodasComissoes()
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

  // Fechamento para o financeiro: assessor × seguradora, identificado pelo
  // código. É a planilha que o líder usa para pagar — precisa conferir 100%.
  // Cada bloco traz a cascata completa: bruto → imposto → líquido → divisão
  // (especialista / escritório / assessor).
  const fechamento = useMemo(() => {
    const porCod = new Map()
    for (const r of importadas) {
      const cod = r.codigo_assessor || '(sem código)'
      if (!porCod.has(cod)) {
        porCod.set(cod, { codigo: cod, nome: null, clientes: new Set(), producoes: new Set(), segMap: new Map() })
      }
      const a = porCod.get(cod)
      if (r.assessores?.nome) a.nome = r.assessores.nome
      a.clientes.add(r.cliente_nome)
      if (r.producao) a.producoes.add(r.producao)
      if (!a.segMap.has(r.seguradora)) {
        a.segMap.set(r.seguradora, {
          seguradora: r.seguradora, bruto: 0, estornos: 0, lancamentos: 0,
          recorrente: 0, vendaNova: 0, campanha: 0, clientes: new Set(), producoes: new Set(),
        })
      }
      const s = a.segMap.get(r.seguradora)
      const v = Number(r.valor)
      s.bruto += v
      if (v < 0) s.estornos += v
      s.lancamentos += 1
      s.clientes.add(r.cliente_nome)
      if (r.producao) s.producoes.add(r.producao)
      if (r.tipo_receita === 'recorrente') s.recorrente += v
      else if (r.tipo_receita === 'venda_nova') s.vendaNova += v
      else if (r.tipo_receita === 'campanha') s.campanha += v
    }
    const linhas = [...porCod.values()].map((a) => {
      const seguradoras = [...a.segMap.values()]
        .map((s) => ({ ...s, clientes: s.clientes.size, split: splitComissao(s.bruto, cfg) }))
        .sort((x, y) => y.bruto - x.bruto)
      const soma = (k) => seguradoras.reduce((acc, s) => acc + s[k], 0)
      const bruto = soma('bruto')
      return {
        codigo: a.codigo, nome: a.nome, producoes: a.producoes, seguradoras,
        clientes: a.clientes.size, lancamentos: soma('lancamentos'), estornos: soma('estornos'),
        recorrente: soma('recorrente'), vendaNova: soma('vendaNova'), campanha: soma('campanha'),
        bruto, split: splitComissao(bruto, cfg),
      }
    }).sort((x, y) => y.bruto - x.bruto)
    const brutoGeral = linhas.reduce((s, a) => s + a.bruto, 0)
    const totalGeral = {
      bruto: brutoGeral,
      estornos: linhas.reduce((s, a) => s + a.estornos, 0),
      lancamentos: linhas.reduce((s, a) => s + a.lancamentos, 0),
      split: splitComissao(brutoGeral, cfg),
    }
    return { linhas, totalGeral, confere: Math.abs(brutoGeral - imp.total) < 0.005 }
  }, [importadas, imp.total, cfg])

  // Controle da Natália — quanto ela ganha de fato em cada mês:
  //   40% do líquido da produção dela (Nati) + 30% do líquido das vendas em
  //   que ELA é a assessora que indicou (código próprio, padrão CS8868).
  const natalia = useMemo(() => {
    const codNat = String(cfg.codigo_natalia ?? '').trim().toUpperCase()
    const ehCodigoDela = (c) => codNat && String(c ?? '').trim().toUpperCase() === codNat
    const porMes = new Map()
    for (const r of todasComissoes) {
      const m = String(r.competencia).slice(0, 7)
      if (!porMes.has(m)) {
        porMes.set(m, { brutoNati: 0, recorrente: 0, vendaNova: 0, campanha: 0, brutoIndicacao: 0 })
      }
      const acc = porMes.get(m)
      const v = Number(r.valor)
      if (r.producao === 'Nati') {
        acc.brutoNati += v
        if (r.tipo_receita === 'recorrente') acc.recorrente += v
        else if (r.tipo_receita === 'venda_nova') acc.vendaNova += v
        else if (r.tipo_receita === 'campanha') acc.campanha += v
      }
      if (ehCodigoDela(r.codigo_assessor)) acc.brutoIndicacao += v
    }
    const meses = [...porMes.entries()].sort().map(([m, acc]) => {
      const sp = splitComissao(acc.brutoNati, cfg)
      const ganhoIndicacao = splitComissao(acc.brutoIndicacao, cfg).assessor
      return {
        mes: m, ...acc,
        imposto: sp.imposto, liquido: sp.liquido,
        ganhoProducao: sp.especialista,
        ganhoRecorrente: splitComissao(acc.recorrente, cfg).especialista,
        ganhoVendaNova: splitComissao(acc.vendaNova, cfg).especialista,
        ganhoCampanha: splitComissao(acc.campanha, cfg).especialista,
        ganhoIndicacao,
        ganhoTotal: sp.especialista + ganhoIndicacao,
      }
    })
    const doMes = meses.find((x) => x.mes === mes) ?? null
    // Recorrência garantida: média do ganho recorrente dos últimos 3 meses
    const base = meses.filter((x) => x.ganhoRecorrente > 0).slice(-3)
    const projecaoRecorrente = base.length >= 2
      ? { media: base.reduce((s, x) => s + x.ganhoRecorrente, 0) / base.length, meses: base.map((x) => x.mes) }
      : null
    return { meses, doMes, projecaoRecorrente, codigo: cfg.codigo_natalia }
  }, [todasComissoes, cfg, mes])

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

  const num = (v) => Number(v ?? 0).toFixed(2).replace('.', ',')

  // A planilha do financeiro: uma linha por assessor × seguradora com a
  // cascata completa (bruto → imposto → líquido → 40/30/30) + subtotal por
  // assessor e total geral. O financeiro lança pelo bruto; as demais colunas
  // mostram exatamente como o valor se divide.
  function exportarFechamento() {
    const pctEsp = `${Number(cfg.split_natalia_pct)}%`
    const pctEsc = `${Number(cfg.split_escritorio_pct)}%`
    const pctAss = `${Number(cfg.split_assessor_pct)}%`
    const linhaSplit = (base) => [
      num(base.split.bruto), num(base.split.imposto), num(base.split.liquido),
      num(base.split.especialista), num(base.split.escritorio), num(base.split.assessor),
    ]
    const linhas = []
    for (const a of fechamento.linhas) {
      for (const s of a.seguradoras) {
        linhas.push([a.codigo, a.nome ?? '', s.seguradora, [...s.producoes].join('/'),
          s.clientes, s.lancamentos, num(s.recorrente), num(s.vendaNova), num(s.campanha),
          num(s.estornos), ...linhaSplit(s)])
      }
      linhas.push([a.codigo, `TOTAL ${a.nome ?? a.codigo}`, 'Todas', [...a.producoes].join('/'),
        a.clientes, a.lancamentos, num(a.recorrente), num(a.vendaNova), num(a.campanha),
        num(a.estornos), ...linhaSplit(a)])
    }
    linhas.push(['', 'TOTAL GERAL DO MÊS', '', '', '', fechamento.totalGeral.lancamentos,
      '', '', '', num(fechamento.totalGeral.estornos), ...linhaSplit(fechamento.totalGeral)])
    baixarCSV(`fechamento-financeiro-${mes}.csv`,
      ['Cód. assessor', 'Assessor', 'Seguradora', 'Produção', 'Clientes', 'Lançamentos',
        'Recorrente (bruto)', 'Venda nova (bruto)', 'Campanha (bruto)', 'Estornos',
        'Comissão bruta', `Imposto (${Number(cfg.imposto_pct)}%)`, 'Base líquida',
        `Especialista (${pctEsp})`, `Escritório (${pctEsc})`, `Repasse assessor (${pctAss})`],
      linhas)
  }

  function exportarFechamentoDetalhado() {
    baixarCSV(`fechamento-detalhado-${mes}.csv`,
      ['Cód. assessor', 'Assessor', 'Cód. cliente', 'Cliente', 'Seguradora', 'Segmento', 'Produção',
        'Parcela', 'Tipo de receita', 'Valor bruto', `Valor líquido (−${Number(cfg.imposto_pct)}%)`,
        `Repasse assessor (${Number(cfg.split_assessor_pct)}%)`],
      [...importadas]
        .sort((a, b) => (a.codigo_assessor ?? 'zzz').localeCompare(b.codigo_assessor ?? 'zzz') || a.cliente_nome.localeCompare(b.cliente_nome))
        .map((r) => {
          const sp = splitComissao(Number(r.valor), cfg)
          return [r.codigo_assessor ?? '', r.assessores?.nome ?? '', codCliente(r), r.cliente_nome,
            r.seguradora, r.segmento, r.producao ?? 'A classificar', r.parcela ?? '', r.tipo_receita,
            num(sp.bruto), num(sp.liquido), num(sp.assessor)]
        }))
  }

  // Extrato da Natália em CSV — todos os meses, com a memória de cálculo
  function exportarGanhosNatalia() {
    baixarCSV('ganhos-natalia.csv',
      ['Mês', 'Bruto produção Nati', `Imposto (${Number(cfg.imposto_pct)}%)`, 'Líquido',
        `Ganho produção (${Number(cfg.split_natalia_pct)}%)`, 'do qual recorrente', 'do qual venda nova', 'do qual campanha',
        `Indicações ${natalia.codigo} (${Number(cfg.split_assessor_pct)}%)`, 'GANHO TOTAL NO MÊS'],
      natalia.meses.map((x) => [mesBR(`${x.mes}-01`), num(x.brutoNati), num(x.imposto), num(x.liquido),
        num(x.ganhoProducao), num(x.ganhoRecorrente), num(x.ganhoVendaNova), num(x.ganhoCampanha),
        num(x.ganhoIndicacao), num(x.ganhoTotal)]))
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
    const tg = fechamento.totalGeral.split
    const texto = [
      `*Fechamento de comissões — ${mesBR(mes + '-01')}*`,
      `Bruto: ${brl(imp.total)}${fechamento.confere ? ' ✅ conferido' : ''}`,
      `Imposto (${Number(cfg.imposto_pct)}%): ${brl(tg.imposto)} · Líquido: ${brl(tg.liquido)}`,
      `Divisão do líquido — Especialista ${Number(cfg.split_natalia_pct)}%: ${brl(tg.especialista)} · Escritório ${Number(cfg.split_escritorio_pct)}%: ${brl(tg.escritorio)} · Assessores ${Number(cfg.split_assessor_pct)}%: ${brl(tg.assessor)}`,
      `Produção — Natália: ${brl(imp.nati)} · Bruno: ${brl(imp.bruno)} (bruto)`,
      '',
      '*Por seguradora (bruto):*',
      ...imp.porSeguradora.map((s) => `• ${s.chave}: ${brl(s.total)}`),
      '',
      `*Assessores (bruto gerado · repasse ${Number(cfg.split_assessor_pct)}%):*`,
      ...fechamento.linhas.slice(0, 8).map((a) => `• ${a.codigo}${a.nome ? ` — ${a.nome}` : ''}: ${brl(a.bruto)} · ${brl(a.split.assessor)}`),
      fechamento.linhas.length > 8 ? `… e mais ${fechamento.linhas.length - 8} (planilha completa em anexo)` : '',
      '',
      '_Gerado pelo Hub Seguro de Vida_',
    ].filter((l) => l !== '').join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noreferrer')
  }

  // Fechamento em PDF: abre uma janela de impressão com layout limpo —
  // o navegador salva em PDF (mesmo caminho da Proposta). Cada assessor
  // aparece com o detalhamento por seguradora e a cascata bruto → líquido.
  function imprimirFechamento() {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const tg = fechamento.totalGeral
    const linhas = fechamento.linhas.map((a) => `
      <tr class="assessor">
        <td><code>${esc(a.codigo)}</code></td>
        <td class="nome">${esc(a.nome ?? '— cadastrar —')} <span class="mudo">· ${esc([...a.producoes].join(' / ') || 'produção a classificar')}</span></td>
        <td class="num">${a.clientes}</td>
        <td class="num">${a.lancamentos}</td>
        <td class="num ${a.estornos < 0 ? 'neg' : 'mudo'}">${a.estornos < 0 ? brl(a.estornos) : '—'}</td>
        <td class="num total">${brl(a.split.bruto)}</td>
        <td class="num">${brl(a.split.liquido)}</td>
        <td class="num total">${brl(a.split.assessor)}</td>
      </tr>
      ${a.seguradoras.map((s) => `
      <tr class="seg">
        <td></td>
        <td class="mudo">↳ ${esc(s.seguradora)}</td>
        <td class="num mudo">${s.clientes}</td>
        <td class="num mudo">${s.lancamentos}</td>
        <td class="num ${s.estornos < 0 ? 'neg' : 'mudo'}">${s.estornos < 0 ? brl(s.estornos) : '—'}</td>
        <td class="num">${brl(s.split.bruto)}</td>
        <td class="num mudo">${brl(s.split.liquido)}</td>
        <td class="num">${brl(s.split.assessor)}</td>
      </tr>`).join('')}`).join('')
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Fechamento de comissões — ${mesBR(mes + '-01')}</title>
      <style>
        * { box-sizing: border-box; margin: 0; }
        body { font: 13px/1.5 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; padding: 36px; }
        h1 { font-size: 20px; margin-bottom: 2px; }
        .sub { color: #64748b; font-size: 12px; margin-bottom: 18px; }
        .confere { border: 1px solid ${fechamento.confere ? '#a7f3d0' : '#fecaca'}; background: ${fechamento.confere ? '#ecfdf5' : '#fef2f2'};
          color: ${fechamento.confere ? '#065f46' : '#991b1b'}; border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 12px; }
        .cascata { display: flex; gap: 18px; flex-wrap: wrap; border: 1px solid #e2e8f0; border-radius: 8px;
          padding: 10px 14px; font-size: 12px; margin-bottom: 18px; color: #334155; }
        .cascata b { display: block; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #64748b;
          border-bottom: 2px solid #e2e8f0; padding: 6px 8px; }
        th.num { text-align: right; }
        td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        td.total { font-weight: 700; }
        td.nome { font-weight: 600; }
        td.mudo, .mudo { color: #94a3b8; font-weight: 400; }
        td.neg { color: #dc2626; }
        tr.assessor td { background: #f8fafc; border-top: 1px solid #e2e8f0; }
        tr.seg td { font-size: 12px; }
        code { background: #f1f5f9; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
        tr.geral td { border-top: 2px solid #e2e8f0; font-weight: 700; font-size: 14px; }
        .rodape { margin-top: 22px; color: #94a3b8; font-size: 10px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Fechamento de comissões — ${mesBR(mes + '-01')}</h1>
      <p class="sub">Por assessor e seguradora · gerado pelo Hub Seguro de Vida em ${new Date().toLocaleDateString('pt-BR')}</p>
      <p class="confere">${fechamento.confere
        ? `✓ Conferido: a soma dos assessores (${brl(tg.bruto)}) bate com o total importado do mês, centavo a centavo.`
        : `⚠ Atenção: a soma dos assessores (${brl(tg.bruto)}) difere do total do mês (${brl(imp.total)}).`}</p>
      <div class="cascata">
        <span>Comissão bruta<b>${brl(tg.split.bruto)}</b></span>
        <span>− Imposto (${Number(cfg.imposto_pct)}%)<b>${brl(tg.split.imposto)}</b></span>
        <span>= Base líquida<b>${brl(tg.split.liquido)}</b></span>
        <span>Especialista (${Number(cfg.split_natalia_pct)}%)<b>${brl(tg.split.especialista)}</b></span>
        <span>Escritório (${Number(cfg.split_escritorio_pct)}%)<b>${brl(tg.split.escritorio)}</b></span>
        <span>Assessores (${Number(cfg.split_assessor_pct)}%)<b>${brl(tg.split.assessor)}</b></span>
      </div>
      <table>
        <thead><tr><th>Cód. assessor</th><th>Assessor / Seguradora</th>
          <th class="num">Clientes</th><th class="num">Lanç.</th><th class="num">Estornos</th>
          <th class="num">Comissão bruta</th><th class="num">Líquido (−${Number(cfg.imposto_pct)}%)</th>
          <th class="num">Repasse assessor (${Number(cfg.split_assessor_pct)}%)</th></tr></thead>
        <tbody>${linhas}
          <tr class="geral"><td colspan="5">Total geral do mês</td>
            <td class="num">${brl(tg.split.bruto)}</td><td class="num">${brl(tg.split.liquido)}</td>
            <td class="num">${brl(tg.split.assessor)}</td></tr>
        </tbody>
      </table>
      <p class="rodape">Cascata do escritório: comissão bruta − imposto (${Number(cfg.imposto_pct)}%) = líquido, dividido em
        ${Number(cfg.split_natalia_pct)}% especialista / ${Number(cfg.split_escritorio_pct)}% escritório / ${Number(cfg.split_assessor_pct)}% assessor.
        Estornos entram com valor negativo e já estão abatidos dos totais. Seguros com pagamento anual
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

        {/* Fechamento para o financeiro — assessor × seguradora com a cascata bruto → líquido */}
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <HandCoins size={17} className="text-blue-700" /> Fechamento para o financeiro — {mesBR(mes + '-01')}
              </h2>
              <p className="text-xs text-slate-400">
                A planilha de pagamento, separada por <strong>assessor e seguradora</strong>, com bruto, imposto
                ({Number(cfg.imposto_pct)}%), líquido e a divisão {Number(cfg.split_natalia_pct)}/{Number(cfg.split_escritorio_pct)}/{Number(cfg.split_assessor_pct)}.
                Envie o CSV para o financeiro.
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
                  ? <>Conferido: a soma dos assessores ({brl(fechamento.totalGeral.bruto)}) bate com o total importado do mês, centavo a centavo.</>
                  : <>Atenção: a soma dos assessores ({brl(fechamento.totalGeral.bruto)}) difere do total do mês ({brl(imp.total)}) — verifique antes de pagar.</>}
              </div>

              {/* Cascata do mês: bruto → imposto → líquido → divisão 40/30/30 */}
              <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['Comissão bruta', fechamento.totalGeral.split.bruto, 'font-bold'],
                  [`− Imposto (${Number(cfg.imposto_pct)}%)`, fechamento.totalGeral.split.imposto, 'text-slate-500'],
                  ['= Base líquida', fechamento.totalGeral.split.liquido, 'font-bold'],
                  [`Especialista (${Number(cfg.split_natalia_pct)}%)`, fechamento.totalGeral.split.especialista, 'text-blue-700 font-semibold'],
                  [`Escritório (${Number(cfg.split_escritorio_pct)}%)`, fechamento.totalGeral.split.escritorio, 'text-slate-700 font-semibold'],
                  [`Assessores (${Number(cfg.split_assessor_pct)}%)`, fechamento.totalGeral.split.assessor, 'text-emerald-700 font-semibold'],
                ].map(([rotulo, valor, classe]) => (
                  <div key={rotulo}>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
                    <p className={`tabular-nums ${classe}`}>{brl(valor)}</p>
                  </div>
                ))}
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
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                      <th className="py-2 font-medium">Cód. assessor</th>
                      <th className="py-2 font-medium">Assessor / Seguradora</th>
                      <th className="py-2 font-medium">Produção</th>
                      <th className="py-2 text-right font-medium">Clientes</th>
                      <th className="py-2 text-right font-medium">Lanç.</th>
                      <th className="py-2 text-right font-medium">Estornos</th>
                      <th className="py-2 text-right font-medium">Comissão bruta</th>
                      <th className="py-2 text-right font-medium">Líquido (−{Number(cfg.imposto_pct)}%)</th>
                      <th className="py-2 text-right font-medium">Repasse assessor ({Number(cfg.split_assessor_pct)}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fechamento.linhas.map((a) => (
                      <FragmentoAssessor key={a.codigo} a={a} />
                    ))}
                    <tr className="bg-slate-50/60">
                      <td colSpan={6} className="px-2 py-3 text-right text-xs uppercase text-slate-400">Total geral do mês</td>
                      <td className="py-3 text-right font-bold text-slate-900">{brl(fechamento.totalGeral.split.bruto)}</td>
                      <td className="py-3 text-right font-bold text-slate-900">{brl(fechamento.totalGeral.split.liquido)}</td>
                      <td className="py-3 text-right font-bold text-emerald-700">{brl(fechamento.totalGeral.split.assessor)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Cascata do escritório: comissão bruta − imposto ({Number(cfg.imposto_pct)}%) = líquido, dividido em{' '}
                {Number(cfg.split_natalia_pct)}% especialista / {Number(cfg.split_escritorio_pct)}% escritório / {Number(cfg.split_assessor_pct)}% assessor
                (percentuais editáveis em Cadastros). O financeiro lança pelo <strong>bruto</strong>; as demais colunas
                mostram como o valor se divide. Seguros com pagamento anual aparecem no mês em que a seguradora paga a
                comissão (parcela única); os mensais aparecem todo mês. Estornos entram negativos e já saem abatidos.
              </p>
            </div>
          )}
        </Card>

        {/* Controle da Natália — o que ela de fato ganha (líquido), mês a mês */}
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <PiggyBank size={17} className="text-pink-600" /> Controle da Natália — quanto ela ganha
              </h2>
              <p className="text-xs text-slate-400">
                Líquido real: {Number(cfg.split_natalia_pct)}% da produção dela (após imposto de {Number(cfg.imposto_pct)}%)
                + {Number(cfg.split_assessor_pct)}% das vendas indicadas pelo código dela ({natalia.codigo})
              </p>
            </div>
            <Button variant="secondary" disabled={natalia.meses.length === 0} onClick={exportarGanhosNatalia}>
              <Download size={15} /> Extrato da Natália (CSV)
            </Button>
          </div>

          {natalia.meses.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Importe as planilhas das seguradoras em <strong>Importar → Comissões</strong> para calcular os ganhos.
            </p>
          ) : (
            <div className="p-5">
              {natalia.doMes ? (
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['Bruto produção Nati', natalia.doMes.brutoNati, 'text-slate-900 font-bold'],
                    [`− Imposto (${Number(cfg.imposto_pct)}%)`, natalia.doMes.imposto, 'text-slate-500'],
                    ['= Líquido', natalia.doMes.liquido, 'text-slate-900 font-bold'],
                    [`Parte dela (${Number(cfg.split_natalia_pct)}%)`, natalia.doMes.ganhoProducao, 'text-pink-700 font-semibold'],
                    [`Indicações ${natalia.codigo}`, natalia.doMes.ganhoIndicacao, 'text-pink-700 font-semibold'],
                    ['GANHO NO MÊS', natalia.doMes.ganhoTotal, 'text-pink-700 font-bold text-base'],
                  ].map(([rotulo, valor, classe]) => (
                    <div key={rotulo} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
                      <p className={`tabular-nums ${classe}`}>{brl(valor)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-5 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                  Ainda não há comissões importadas em {mesBR(mes + '-01')} — a tabela abaixo mostra os meses já importados.
                </p>
              )}

              {natalia.doMes && (
                <div className="mb-5 flex flex-wrap gap-2">
                  <Badge tom="green">Recorrente: {brl(natalia.doMes.ganhoRecorrente)}</Badge>
                  <Badge tom="blue">Venda nova: {brl(natalia.doMes.ganhoVendaNova)}</Badge>
                  {natalia.doMes.ganhoCampanha !== 0 && <Badge tom="gold">Campanhas: {brl(natalia.doMes.ganhoCampanha)}</Badge>}
                  <span className="self-center text-xs text-slate-400">— parte da Natália ({Number(cfg.split_natalia_pct)}% do líquido) por tipo de receita</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <p className="mb-2 text-xs font-medium uppercase text-slate-400">Mês a mês — o extrato dela</p>
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                      <th className="py-2 font-medium">Mês</th>
                      <th className="py-2 text-right font-medium">Bruto produção</th>
                      <th className="py-2 text-right font-medium">Líquido (−{Number(cfg.imposto_pct)}%)</th>
                      <th className="py-2 text-right font-medium">Parte dela ({Number(cfg.split_natalia_pct)}%)</th>
                      <th className="py-2 text-right font-medium">do qual recorrente</th>
                      <th className="py-2 text-right font-medium">Indicações ({Number(cfg.split_assessor_pct)}%)</th>
                      <th className="py-2 text-right font-medium">Ganho total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {natalia.meses.map((x) => (
                      <tr key={x.mes} className={`border-b border-slate-50 ${x.mes === mes ? 'bg-pink-50/50 font-medium' : ''}`}>
                        <td className="py-2.5 text-slate-800">{mesBR(`${x.mes}-01`)}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">{brl(x.brutoNati)}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">{brl(x.liquido)}</td>
                        <td className="py-2.5 text-right tabular-nums">{brl(x.ganhoProducao)}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">{brl(x.ganhoRecorrente)}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">{brl(x.ganhoIndicacao)}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-pink-700">{brl(x.ganhoTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {natalia.projecaoRecorrente && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-pink-100 bg-pink-50/70 p-3 text-sm text-slate-700">
                  <TrendingUp size={16} className="shrink-0 text-pink-600" />
                  <span>
                    <strong>Recorrência dela:</strong> ≈ {brl(natalia.projecaoRecorrente.media)}/mês já garantidos
                    pela carteira, mantidos os contratos atuais.
                  </span>
                  <span className="text-xs text-slate-400">
                    Média da parte recorrente de {natalia.projecaoRecorrente.meses.map((m) => mesBR(`${m}-01`)).join(', ')} —
                    não inclui vendas novas, campanhas nem indicações.
                  </span>
                </div>
              )}
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
