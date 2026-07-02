import { useEffect, useMemo, useState } from 'react'
import { Download, TrendingDown, Timer, Wallet, Database } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, mesBR, dataBR } from '../lib/format'
import { etapaLabel, CHART } from '../lib/constants'
import { baixarCSV } from '../lib/csv'
import { PageHeader, Card, Button, Spinner, Input, Campo } from '../components/ui'

// Relatórios gerenciais: fechamento de comissões (quanto pagar a cada assessor),
// análise de perdas e velocidade do funil. Tudo exportável em CSV.
export default function Relatorios() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [comissoes, setComissoes] = useState(null)
  const [splitMensal, setSplitMensal] = useState([])
  const [motivos, setMotivos] = useState([])
  const [tempos, setTempos] = useState([])

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
              <table className="w-full text-left text-sm">
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
              </table>
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
              <table className="w-full text-left text-sm">
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
              </table>
            )}
        </Card>
      </div>
    </div>
  )
}
