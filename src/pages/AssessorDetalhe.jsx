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

  const carregar = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from('vw_assessor_resumo').select('*').eq('id', id).single(),
      supabase.from('clientes').select('id, nome, codigo, status_funil, telefone').eq('id_assessor', id).order('created_at', { ascending: false }),
    ])
    setResumo(r.data)
    setClientes(c.data ?? [])
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  if (!resumo) return <Spinner />

  return (
    <div>
      <Link to="/cadastros" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Cadastros
      </Link>

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-700">
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
          detalhe={`${resumo.fechados} fechados · ${resumo.perdidos} perdidos`} icone={Trophy} corIcone="text-amber-600 bg-amber-50" />
        <StatTile rotulo="Apólices geradas" valor={resumo.apolices}
          detalhe={`${brl(resumo.premio_mensal_total)}/mês`} icone={FileSignature} corIcone="text-emerald-600 bg-emerald-50" />
        <StatTile rotulo="Comissão do assessor" valor={brlCompacto(resumo.comissao_assessor_total)}
          detalhe="total gerado (histórico)" icone={Wallet} corIcone="text-violet-600 bg-violet-50" />
      </div>

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
