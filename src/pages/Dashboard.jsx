import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck, Wallet, FileSignature, TrendingUp, CheckCircle2,
  MessageCircle, AlertTriangle, Trophy, Cake, Target, Percent, Timer, ShieldCheck, Flame, Rocket,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto, mesBR, dataBR, whatsapp } from '../lib/format'
import { CHART, etapaLabel } from '../lib/constants'
import { Card, StatTile, Spinner, Badge, EmptyState } from '../components/ui'

// ─── Gráfico de barras (série única, tooltip por barra) ──────────────────────
function GraficoBarras({ dados, formatoValor = brlCompacto }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...dados.map((d) => d.valor), 1)
  const W = 560, H = 180, PAD = 8, EIXO = 22
  const bw = Math.min(48, (W - PAD * 2) / dados.length - 8)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + EIXO}`} className="w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H - H * f} y2={H - H * f}
            stroke={CHART.grid} strokeWidth="1" />
        ))}
        <line x1={PAD} x2={W - PAD} y1={H} y2={H} stroke={CHART.eixo} strokeWidth="1" />
        {dados.map((d, i) => {
          const x = PAD + ((W - PAD * 2) / dados.length) * (i + 0.5) - bw / 2
          const h = Math.max((d.valor / max) * (H - 12), d.valor > 0 ? 3 : 0)
          return (
            <g key={d.rotulo}>
              {/* alvo de hover maior que a barra */}
              <rect x={x - 6} y={0} width={bw + 12} height={H} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              <rect x={x} y={H - h} width={bw} height={h} rx="4"
                fill={CHART.serie1} opacity={hover === null || hover === i ? 1 : 0.45}
                style={{ pointerEvents: 'none' }} />
              {/* cantos inferiores retos (âncora na linha de base) */}
              {h > 4 && <rect x={x} y={H - 4} width={bw} height={4} fill={CHART.serie1}
                opacity={hover === null || hover === i ? 1 : 0.45} style={{ pointerEvents: 'none' }} />}
              <text x={x + bw / 2} y={H + 15} textAnchor="middle" fontSize="11" fill={CHART.textoMudo}>
                {d.rotulo}
              </text>
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-md"
          style={{ left: `${((hover + 0.5) / dados.length) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <span className="font-semibold text-slate-900">{formatoValor(dados[hover].valor)}</span>
          <span className="ml-1 text-slate-400">{dados[hover].rotulo}</span>
        </div>
      )}
    </div>
  )
}

// ─── Barra empilhada da divisão de comissão (rótulos diretos: regra de alívio) ─
function SplitComissao({ natalia, assessor, escritorio }) {
  const total = natalia + assessor + escritorio
  if (total <= 0) return <p className="text-sm text-slate-400">Sem vendas no período.</p>
  const partes = [
    { rotulo: 'Natália', valor: natalia, cor: CHART.serie1 },
    { rotulo: 'Assessores', valor: assessor, cor: CHART.serie2 },
    { rotulo: 'Escritório', valor: escritorio, cor: CHART.serie3 },
  ]
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-lg" style={{ gap: 2 }}>
        {partes.map((p) => (
          <div key={p.rotulo} style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }}
            className="min-w-[4px] rounded-sm" title={`${p.rotulo}: ${brl(p.valor)}`} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {partes.map((p) => (
          <div key={p.rotulo} className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: p.cor }} />
            <div>
              <p className="text-xs text-slate-500">{p.rotulo}</p>
              <p className="text-sm font-semibold text-slate-900">{brl(p.valor)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Gráfico de barras agrupadas (2 séries) com legenda e rótulos diretos
function GraficoConversao({ dados }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...dados.flatMap((d) => [d.leads, d.fechados]), 1)
  const W = 560, H = 170, PAD = 8, EIXO = 22
  const grupo = (W - PAD * 2) / dados.length
  const bw = Math.min(20, grupo / 2 - 4)

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: CHART.serie1 }} /> Leads criados</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: CHART.serie2 }} /> Fechados</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + EIXO}`} className="w-full">
          {[0.25, 0.5, 0.75, 1].map((fr) => (
            <line key={fr} x1={PAD} x2={W - PAD} y1={H - H * fr} y2={H - H * fr} stroke={CHART.grid} strokeWidth="1" />
          ))}
          <line x1={PAD} x2={W - PAD} y1={H} y2={H} stroke={CHART.eixo} strokeWidth="1" />
          {dados.map((d, i) => {
            const cx = PAD + grupo * (i + 0.5)
            const hL = Math.max((d.leads / max) * (H - 12), d.leads > 0 ? 3 : 0)
            const hF = Math.max((d.fechados / max) * (H - 12), d.fechados > 0 ? 3 : 0)
            return (
              <g key={d.rotulo} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={cx - grupo / 2} y={0} width={grupo} height={H} fill="transparent" />
                <rect x={cx - bw - 1} y={H - hL} width={bw} height={hL} rx="4" fill={CHART.serie1}
                  opacity={hover === null || hover === i ? 1 : 0.45} />
                <rect x={cx + 1} y={H - hF} width={bw} height={hF} rx="4" fill={CHART.serie2}
                  opacity={hover === null || hover === i ? 1 : 0.45} />
                <text x={cx} y={H + 15} textAnchor="middle" fontSize="11" fill={CHART.textoMudo}>{d.rotulo}</text>
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute -top-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-md"
            style={{ left: `${((hover + 0.5) / dados.length) * 100}%`, transform: 'translateX(-50%)' }}>
            <span className="font-semibold" style={{ color: CHART.serie1 }}>{dados[hover].leads} leads</span>
            {' · '}
            <span className="font-semibold" style={{ color: CHART.serie2 }}>{dados[hover].fechados} fechados</span>
            <span className="ml-1 text-slate-400">{dados[hover].rotulo}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Barra de progresso da meta mensal
function BarraMeta({ rotulo, atual, meta, formato = (v) => v }) {
  const pct = Math.min((atual / meta) * 100, 100)
  const bateu = atual >= meta
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-slate-600">{rotulo}</span>
        <span className={`text-sm font-semibold ${bateu ? 'text-emerald-600' : 'text-slate-800'}`}>
          {formato(atual)} / {formato(meta)} {bateu && '🎯'}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100">
        <div className={`h-2.5 rounded-full transition-all ${bateu ? 'bg-emerald-500' : 'bg-blue-600'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{Math.round(pct)}% da meta</p>
    </div>
  )
}

// Saudação conforme o horário
function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Guia de primeiros passos: detecta o que ainda falta configurar e some sozinho
// quando o essencial estiver pronto. Ajuda a Natália a começar do zero.
function PrimeirosPassos() {
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('seguradoras').select('id', { count: 'exact', head: true }),
      supabase.from('assessores').select('id', { count: 'exact', head: true }),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('apolices').select('id', { count: 'exact', head: true }),
      supabase.from('configuracoes').select('meta_premio_mensal').single(),
    ]).then(([s, a, c, ap, cfg]) => setEstado({
      seguradoras: s.count ?? 0,
      assessores: a.count ?? 0,
      clientes: c.count ?? 0,
      apolices: ap.count ?? 0,
      temMeta: Number(cfg.data?.meta_premio_mensal ?? 0) > 0,
    }))
  }, [])

  if (!estado) return null

  const passos = [
    { ok: estado.seguradoras > 0, texto: 'Cadastrar as seguradoras (com % de comissão)', para: '/cadastros' },
    { ok: estado.assessores > 0, texto: 'Cadastrar os assessores do escritório', para: '/cadastros' },
    { ok: estado.temMeta, texto: 'Definir as metas do mês', para: '/cadastros' },
    { ok: estado.clientes > 0, texto: 'Cadastrar o primeiro cliente (ou importar sua base)', para: '/clientes' },
    { ok: estado.apolices > 0, texto: 'Registrar a primeira venda (apólice)', para: '/clientes' },
  ]
  const feitos = passos.filter((p) => p.ok).length

  // Some quando tudo estiver concluído
  if (feitos === passos.length) return null

  return (
    <Card className="mb-6 border-blue-100 bg-blue-50/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Rocket size={18} className="text-blue-600" /> Primeiros passos
        </h2>
        <span className="text-sm text-slate-500">{feitos} de {passos.length}</span>
      </div>
      <div className="mb-4 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>
      <ul className="space-y-2">
        {passos.map((p, i) => (
          <li key={i}>
            <Link to={p.para} className={`flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors ${
              p.ok ? 'border-transparent text-slate-400' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}>
              {p.ok
                ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                : <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-slate-300" />}
              <span className={p.ok ? 'line-through' : 'font-medium'}>{p.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Dashboard() {
  const [carregando, setCarregando] = useState(true)
  const [comissoes, setComissoes] = useState([])
  const [dashboard, setDashboard] = useState([])
  const [ranking, setRanking] = useState([])
  const [central, setCentral] = useState([])
  const [funil, setFunil] = useState([])
  const [kpis, setKpis] = useState({})
  const [metas, setMetas] = useState({})
  const [foco, setFoco] = useState([])
  const [conversao, setConversao] = useState([])

  async function carregar() {
    const [c, d, r, ce, f, k, cfg, pr, cv] = await Promise.all([
      supabase.from('vw_comissoes_mensal').select('*').limit(6),
      supabase.from('vw_dashboard_mensal').select('*').limit(6),
      supabase.from('vw_ranking_assessores').select('*').limit(5),
      supabase.from('vw_central_dia').select('*').limit(20),
      supabase.from('vw_funil_contagem').select('*'),
      supabase.from('vw_kpis_gerais').select('*').single(),
      supabase.from('configuracoes').select('meta_premio_mensal, meta_reunioes_mensal, meta_apolices_mensal').single(),
      supabase.from('vw_prioridades_classificadas').select('*').limit(6),
      supabase.from('vw_conversao_mensal').select('*').limit(6),
    ])
    setComissoes(c.data ?? [])
    setDashboard(d.data ?? [])
    setRanking(r.data ?? [])
    setCentral(ce.data ?? [])
    setFunil(f.data ?? [])
    setKpis(k.data ?? {})
    setMetas(cfg.data ?? {})
    setFoco(pr.data ?? [])
    setConversao(cv.data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function concluirTarefa(id) {
    await supabase.from('tarefas').update({ concluida: true, concluida_em: new Date().toISOString() }).eq('id', id)
    setCentral((c) => c.filter((i) => !(i.tipo === 'tarefa' && i.id_item === id)))
  }

  const mesAtual = useMemo(() => {
    const chave = new Date().toISOString().slice(0, 7)
    return {
      dash: dashboard.find((d) => String(d.mes).startsWith(chave)) ?? {},
      com: comissoes.find((d) => String(d.mes).startsWith(chave)) ?? {},
    }
  }, [dashboard, comissoes])

  const evolucao = useMemo(
    () => [...dashboard].reverse().map((d) => ({ rotulo: mesBR(d.mes), valor: Number(d.premio_mensal_vendido) })),
    [dashboard]
  )

  const conversaoChart = useMemo(
    () => [...conversao].reverse().map((c) => ({
      rotulo: mesBR(c.mes), leads: Number(c.leads_criados), fechados: Number(c.fechados),
    })),
    [conversao]
  )

  if (carregando) return <Spinner />

  const tarefas = central.filter((i) => i.tipo === 'tarefa')
  const aniversarios = central.filter((i) => i.tipo === 'aniversario')
  const parados = central.filter((i) => i.tipo === 'lead_parado')
  const maxFunil = Math.max(...funil.map((f) => f.total), 1)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {saudacao()}, Natália! 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}{tarefas.length} tarefa(s) na sua central do dia
        </p>
      </div>

      <PrimeirosPassos />


      {/* KPIs do mês */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile rotulo="Reuniões realizadas no mês" valor={mesAtual.dash.reunioes_realizadas ?? 0}
          icone={CalendarCheck} />
        <StatTile rotulo="Apólices vendidas no mês" valor={mesAtual.dash.apolices_vendidas ?? 0}
          icone={FileSignature} corIcone="text-emerald-600 bg-emerald-50" />
        <StatTile rotulo="Prêmio mensal vendido" valor={brlCompacto(mesAtual.dash.premio_mensal_vendido ?? 0)}
          icone={TrendingUp} corIcone="text-violet-600 bg-violet-50" />
        <StatTile rotulo="Sua comissão do mês" valor={brl(mesAtual.com.comissao_natalia ?? 0)}
          detalhe="parte da Natália na divisão" icone={Wallet} corIcone="text-amber-600 bg-amber-50" />
      </div>

      {/* KPIs históricos */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile rotulo="Taxa de conversão geral" valor={`${kpis.taxa_conversao_pct ?? 0}%`}
          detalhe="fechados ÷ (fechados + perdidos)" icone={Percent} corIcone="text-blue-600 bg-blue-50" />
        <StatTile rotulo="Ticket médio (prêmio mensal)" valor={brl(kpis.ticket_medio_premio ?? 0)}
          icone={TrendingUp} corIcone="text-emerald-600 bg-emerald-50" />
        <StatTile rotulo="Dias médios até fechar" valor={kpis.dias_medios_ate_fechar ?? '—'}
          detalhe="do cadastro do lead à venda" icone={Timer} corIcone="text-violet-600 bg-violet-50" />
        <StatTile rotulo="Capital total da carteira" valor={brlCompacto(kpis.capital_total_carteira ?? 0)}
          detalhe="soma das apólices ativas" icone={ShieldCheck} corIcone="text-amber-600 bg-amber-50" />
      </div>

      {/* Metas do mês */}
      {(Number(metas.meta_premio_mensal) > 0 || Number(metas.meta_reunioes_mensal) > 0 || Number(metas.meta_apolices_mensal) > 0) && (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Target size={18} className="text-blue-600" /> Metas do mês
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {Number(metas.meta_premio_mensal) > 0 && (
              <BarraMeta rotulo="Prêmio vendido"
                atual={Number(mesAtual.dash.premio_mensal_vendido ?? 0)}
                meta={Number(metas.meta_premio_mensal)} formato={brlCompacto} />
            )}
            {Number(metas.meta_reunioes_mensal) > 0 && (
              <BarraMeta rotulo="Reuniões realizadas"
                atual={Number(mesAtual.dash.reunioes_realizadas ?? 0)}
                meta={Number(metas.meta_reunioes_mensal)} />
            )}
            {Number(metas.meta_apolices_mensal) > 0 && (
              <BarraMeta rotulo="Apólices vendidas"
                atual={Number(mesAtual.dash.apolices_vendidas ?? 0)}
                meta={Number(metas.meta_apolices_mensal)} />
            )}
          </div>
        </Card>
      )}

      {/* Foco de Hoje — priorização inteligente */}
      {foco.length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <Flame size={18} className="text-orange-500" /> Foco de Hoje
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            Leads ordenados pela prioridade que o sistema calcula sozinho — com a próxima ação sugerida
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {foco.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Link to={`/clientes/${c.id}`} className="truncate font-medium text-slate-800 hover:text-blue-700 hover:underline">
                    {c.nome}
                  </Link>
                  <Badge tom={c.temperatura === 'quente' ? 'red' : c.temperatura === 'morno' ? 'yellow' : 'slate'}>
                    {c.temperatura === 'quente' ? '🔥' : c.temperatura === 'morno' ? '🌤' : '❄️'} {c.score}
                  </Badge>
                </div>
                <p className="mb-2 text-sm text-blue-700">→ {c.proxima_acao}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{etapaLabel(c.status_funil)}</span>
                  {c.dias_na_etapa > 0 && <span>· {c.dias_na_etapa}d parado</span>}
                  {whatsapp(c.telefone) && (
                    <a href={whatsapp(c.telefone)} target="_blank" rel="noreferrer"
                      className="ml-auto rounded p-1 text-emerald-600 hover:bg-emerald-50" title="WhatsApp">
                      <MessageCircle size={15} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Central do dia */}
        <Card className="p-5 xl:row-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Central do Dia</h2>

          {central.length === 0 && (
            <EmptyState icone={CheckCircle2} titulo="Tudo em dia!"
              texto="Nenhuma tarefa, aniversário ou lead parado exigindo ação." />
          )}

          {parados.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <AlertTriangle size={14} /> Leads parados há muito tempo
              </p>
              {parados.map((i) => (
                <Link key={i.id_item} to={`/clientes/${i.id_cliente}`}
                  className="block truncate py-0.5 text-sm text-red-800 hover:underline">
                  {i.titulo}
                </Link>
              ))}
            </div>
          )}

          <ul className="space-y-2">
            {tarefas.map((t) => (
              <li key={t.id_item} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5">
                <button onClick={() => concluirTarefa(t.id_item)} title="Concluir"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{t.titulo}</p>
                  <p className="text-xs text-slate-400">
                    {t.nome_cliente && <Link to={`/clientes/${t.id_cliente}`} className="hover:underline">{t.nome_cliente}</Link>}
                    {' · '}{dataBR(t.data_ref)}
                    {t.atrasado && <Badge tom="red">atrasada</Badge>}
                  </p>
                </div>
              </li>
            ))}
            {aniversarios.map((a) => (
              <li key={`${a.id_item}-${a.titulo}`} className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                <Cake size={16} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{a.titulo}</p>
                  <p className="text-xs text-slate-400">{dataBR(a.data_ref)}</p>
                </div>
                {whatsapp(a.telefone) && (
                  <a href={whatsapp(a.telefone, `Olá ${a.nome_cliente?.split(' ')[0]}! 🎉`)} target="_blank" rel="noreferrer"
                    className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" title="Enviar WhatsApp">
                    <MessageCircle size={16} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {/* Evolução de vendas */}
        <Card className="p-5 xl:col-span-2">
          <h2 className="mb-1 font-semibold text-slate-900">Prêmio mensal vendido — últimos meses</h2>
          <p className="mb-4 text-xs text-slate-400">Soma dos prêmios mensais das apólices cadastradas em cada mês</p>
          {evolucao.length === 0
            ? <p className="py-8 text-center text-sm text-slate-400">Cadastre a primeira venda para ver o gráfico.</p>
            : <GraficoBarras dados={evolucao} />}
        </Card>

        {/* Conversão: leads x fechados */}
        <Card className="p-5 xl:col-span-2">
          <h2 className="mb-1 font-semibold text-slate-900">Conversão — leads criados × fechados</h2>
          <p className="mb-4 text-xs text-slate-400">Quantos leads entraram e quantos viraram venda em cada mês</p>
          {conversaoChart.length === 0
            ? <p className="py-8 text-center text-sm text-slate-400">Sem dados suficientes ainda.</p>
            : <GraficoConversao dados={conversaoChart} />}
        </Card>

        {/* Comissões divididas */}
        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Divisão da comissão — mês atual</h2>
          <p className="mb-4 text-xs text-slate-400">Calculada automaticamente em cada venda</p>
          <SplitComissao
            natalia={Number(mesAtual.com.comissao_natalia ?? 0)}
            assessor={Number(mesAtual.com.comissao_assessor ?? 0)}
            escritorio={Number(mesAtual.com.comissao_escritorio ?? 0)}
          />
        </Card>

        {/* Ranking */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Trophy size={18} className="text-amber-500" /> Top 5 Assessores
          </h2>
          {ranking.filter((r) => r.total_vendas > 0).length === 0
            ? <p className="text-sm text-slate-400">Ainda sem vendas convertidas.</p>
            : (
              <ol className="space-y-3">
                {ranking.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}º
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{r.nome}</p>
                      <p className="text-xs text-slate-400">
                        {r.total_vendas} venda(s) · conversão {r.taxa_conversao_pct}%
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{brlCompacto(r.comissao_total)}</span>
                  </li>
                ))}
              </ol>
            )}
        </Card>

        {/* Funil macro */}
        <Card className="p-5 xl:col-span-3">
          <h2 className="mb-4 font-semibold text-slate-900">Visão do funil</h2>
          <div className="space-y-2">
            {funil.map((f, i) => (
              <Link key={f.status_funil} to="/pipeline" className="group flex items-center gap-3">
                <span className="w-44 shrink-0 text-right text-xs text-slate-500">{etapaLabel(f.status_funil)}</span>
                <div className="h-6 flex-1 rounded-r-md bg-slate-50">
                  <div className="flex h-6 items-center rounded-r-md pl-2 group-hover:opacity-80"
                    style={{
                      width: `${Math.max((f.total / maxFunil) * 100, 6)}%`,
                      background: CHART.sequencial[Math.min(i + 1, CHART.sequencial.length - 1)],
                    }}>
                    <span className="text-xs font-semibold text-white">{f.total}</span>
                  </div>
                </div>
              </Link>
            ))}
            {funil.length === 0 && <p className="text-sm text-slate-400">Nenhum cliente cadastrado ainda.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
