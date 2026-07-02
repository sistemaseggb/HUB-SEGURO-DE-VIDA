import { useEffect, useMemo, useState } from 'react'
import { Download, TrendingDown, Timer, Wallet, Database, Landmark } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, mesBR, dataBR } from '../lib/format'
import { etapaLabel, CHART } from '../lib/constants'
import { baixarCSV } from '../lib/csv'
import { PageHeader, Card, Button, Spinner, Input, Campo, ComoFunciona, Badge } from '../components/ui'

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

  useEffect(() => {
    supabase.from('comissoes_importadas')
      .select('seguradora, segmento, tipo_receita, cliente_nome, codigo_assessor, producao, parcela, valor, assessores(nome)')
      .eq('competencia', `${mes}-01`)
      .then(({ data }) => setImportadas(data ?? []))
  }, [mes])

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
      porAssessor: agrupa((r) => r.assessores?.nome ?? r.codigo_assessor ?? '(sem assessor)'),
      recorrente: soma(importadas.filter((r) => r.tipo_receita === 'recorrente')),
      vendaNova: soma(importadas.filter((r) => r.tipo_receita === 'venda_nova')),
      campanha: soma(importadas.filter((r) => r.tipo_receita === 'campanha')),
    }
  }, [importadas])

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
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
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
                  <p className="mb-2 text-xs font-medium uppercase text-slate-400">Por assessor (comissão gerada)</p>
                  <table className="w-full min-w-[380px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                        <th className="py-2 font-medium">Assessor</th>
                        <th className="py-2 text-right font-medium">Clientes</th>
                        <th className="py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imp.porAssessor.slice(0, 12).map((a) => (
                        <tr key={a.chave} className="border-b border-slate-50">
                          <td className="py-2.5 font-medium text-slate-800">{a.chave}</td>
                          <td className="py-2.5 text-right text-slate-500">{a.clientes}</td>
                          <td className="py-2.5 text-right font-semibold">{brl(a.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
