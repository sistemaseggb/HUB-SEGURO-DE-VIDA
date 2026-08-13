import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Users, Trophy, Wallet, FileSignature } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { etapaLabel } from '../lib/constants'
import { brl, brlCompacto, whatsapp, iniciais } from '../lib/format'
import { Card, StatTile, Spinner, Badge, EmptyState, Button } from '../components/ui'

// Assessor 360: visão do gestor sobre cada assessor — leads, conversão,
// apólices geradas e comissão a receber.
export default function AssessorDetalhe() {
  const { id } = useParams()
  const [resumo, setResumo] = useState(null)
  const [clientes, setClientes] = useState([])
  const [comissoes, setComissoes] = useState([])

  const carregar = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from('vw_assessor_resumo').select('*').eq('id', id).single(),
      supabase.from('clientes').select('id, nome, codigo, status_funil, telefone').eq('id_assessor', id).order('created_at', { ascending: false }),
    ])
    // assessor inexistente não pode virar carregando eterno
    setResumo(r.data ?? (r.error ? 'nao-encontrado' : null))
    setClientes(c.data ?? [])
    // extrato importado das seguradoras: pelo vínculo direto e pelo código
    const filtro = r.data?.codigo
      ? `id_assessor.eq.${id},codigo_assessor.eq.${r.data.codigo}`
      : `id_assessor.eq.${id}`
    const { data: ext } = await supabase.from('comissoes_importadas')
      .select('competencia, seguradora, cliente_nome, producao, valor').or(filtro)
    setComissoes(ext ?? [])
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  if (resumo === 'nao-encontrado') {
    return (
      <div>
        <Link to="/cadastros" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Cadastros
        </Link>
        <Card className="p-8 text-center">
          <p className="font-semibold text-slate-800">Assessor não encontrado</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Este assessor não existe mais ou o link está desatualizado.
          </p>
          <Link to="/cadastros" className="mt-4 inline-block">
            <Button variant="secondary">Ver cadastros</Button>
          </Link>
        </Card>
      </div>
    )
  }
  if (!resumo) return <Spinner />

  return (
    <div>
      <Link to="/cadastros" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Cadastros
      </Link>

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-laranja-100 text-lg font-bold text-laranja-700">
            {iniciais(resumo.nome)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">
              {resumo.nome}
              {resumo.codigo && <span className="ml-2 font-mono text-sm font-normal text-slate-400">{resumo.codigo}</span>}
            </h1>
            <p className="text-sm text-slate-500">
              {[resumo.telefone, resumo.email].filter(Boolean).join(' · ') || 'sem contato cadastrado'}
              {' · '}<Badge tom={resumo.ativo ? 'green' : 'slate'}>{resumo.ativo ? 'ativo' : 'inativo'}</Badge>
            </p>
          </div>
          {whatsapp(resumo.telefone) && (
            <a href={whatsapp(resumo.telefone)} target="_blank" rel="noreferrer">
              <Button variant="success"><MessageCircle size={16} /> WhatsApp</Button>
            </a>
          )}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile rotulo="Leads trazidos" valor={resumo.total_leads} detalhe={`${resumo.em_andamento} em andamento`}
          icone={Users} />
        <StatTile rotulo="Taxa de conversão" valor={`${resumo.taxa_conversao_pct}%`}
          detalhe={`${resumo.fechados} fechados · ${resumo.perdidos} perdidos`} icone={Trophy} corIcone="text-amber-700 bg-amber-50" />
        <StatTile rotulo="Apólices geradas" valor={resumo.apolices}
          detalhe={`${brl(resumo.premio_mensal_total)}/mês`} icone={FileSignature} corIcone="text-emerald-700 bg-emerald-50" />
        <StatTile rotulo="Comissão do assessor" valor={brlCompacto(resumo.comissao_assessor_total)}
          detalhe="total gerado (histórico)" icone={Wallet} corIcone="text-laranja-600 bg-laranja-50" />
      </div>

      {comissoes.length > 0 && <ExtratoComissoesAssessor comissoes={comissoes} />}

      <Card>
        <div className="border-b border-slate-100 p-5 pb-3">
          <h2 className="font-semibold text-slate-900">Clientes deste assessor ({clientes.length})</h2>
        </div>
        {clientes.length === 0
          ? <EmptyState icone={Users} titulo="Nenhum cliente ainda"
              texto="Quando este assessor trouxer leads, eles aparecem aqui." />
          : (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="px-5 py-3 font-medium">Código</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Etapa</th>
                  <th className="px-3 py-3 font-medium">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{c.codigo ?? '—'}</td>
                    <td className="px-3 py-3">
                      <Link to={`/clientes/${c.id}`} className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tom={c.status_funil === 'fechado' ? 'green' : c.status_funil === 'perdido' ? 'red' : 'blue'}>
                        {etapaLabel(c.status_funil)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{c.telefone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
      </Card>
    </div>
  )
}

// Extrato real de comissões do assessor (planilhas importadas): total por mês
// e os clientes que mais geram — a base da conversa de repasse com ele.
function ExtratoComissoesAssessor({ comissoes }) {
  const total = comissoes.reduce((s, c) => s + Number(c.valor), 0)

  const porMes = new Map()
  const porCliente = new Map()
  for (const c of comissoes) {
    const m = String(c.competencia).slice(0, 7)
    porMes.set(m, (porMes.get(m) ?? 0) + Number(c.valor))
    porCliente.set(c.cliente_nome, (porCliente.get(c.cliente_nome) ?? 0) + Number(c.valor))
  }
  const meses = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  const top = [...porCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const mesRotulo = (m) => new Date(`${m}-15`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

  return (
    <Card className="mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-slate-900">Comissões geradas (extrato das seguradoras)</h2>
        <div className="ml-auto flex gap-2">
          <Badge tom="blue">Total: {brl(total)}</Badge>
          <Badge>{porCliente.size} cliente(s) com movimento</Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400">Últimos meses</p>
          <div className="space-y-1.5">
            {meses.map(([m, v]) => (
              <div key={m} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 capitalize text-slate-500">{mesRotulo(m)}</span>
                <div className="h-5 flex-1 rounded bg-slate-50">
                  <div className="flex h-5 items-center rounded bg-laranja-400/90 pl-2"
                    style={{ width: `${Math.max((v / Math.max(...meses.map(([, x]) => x), 1)) * 100, 6)}%` }}>
                    <span className="text-xs font-semibold text-white">{brl(v)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400">Clientes que mais geram</p>
          <ul className="space-y-2">
            {top.map(([nome, v], i) => (
              <li key={nome} className="flex items-center gap-2 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? 'bg-laranja-100 text-laranja-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{nome}</span>
                <span className="font-semibold tabular-nums text-slate-900">{brl(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
