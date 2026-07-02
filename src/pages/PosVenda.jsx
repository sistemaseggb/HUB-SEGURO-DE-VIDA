import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cake, MessageCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, dataBR, whatsapp } from '../lib/format'
import { PageHeader, Card, Badge, Spinner, EmptyState } from '../components/ui'

export default function PosVenda() {
  const [apolices, setApolices] = useState(null)
  const [regua, setRegua] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('apolices')
        .select('*, clientes(id, nome, telefone), seguradoras(nome)')
        .eq('status', 'ativa')
        .order('data_vigencia', { ascending: false }),
      supabase.from('vw_regua_relacionamento').select('*').lte('dias_restantes', 45),
    ]).then(([a, r]) => {
      setApolices(a.data ?? [])
      setRegua(r.data ?? [])
    })
  }, [])

  if (!apolices) return <Spinner />

  return (
    <div>
      <PageHeader titulo="Pós-Venda"
        subtitulo="Carteira ativa e régua de relacionamento — os alertas aparecem sozinhos" />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Régua de relacionamento */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Cake size={18} className="text-amber-500" /> Régua de Relacionamento
            <span className="text-xs font-normal text-slate-400">próximos 45 dias</span>
          </h2>
          {regua.length === 0
            ? <p className="text-sm text-slate-400">Nenhum evento próximo.</p>
            : (
              <ul className="space-y-2">
                {regua.map((e, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                    <span className="text-xl">{e.tipo_evento === 'aniversario_cliente' ? '🎂' : '📄'}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/clientes/${e.id_cliente}`}
                        className="block truncate text-sm font-medium text-slate-800 hover:underline">
                        {e.nome_cliente}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {e.tipo_evento === 'aniversario_cliente' ? 'Aniversário' : 'Aniversário da apólice'}
                        {' · '}{dataBR(e.data_evento)}
                      </p>
                    </div>
                    <Badge tom={e.dias_restantes <= 7 ? 'yellow' : 'slate'}>
                      {e.dias_restantes === 0 ? 'HOJE!' : `em ${e.dias_restantes}d`}
                    </Badge>
                    {whatsapp(e.telefone) && (
                      <a target="_blank" rel="noreferrer"
                        href={whatsapp(e.telefone,
                          e.tipo_evento === 'aniversario_cliente'
                            ? `Olá ${e.nome_cliente.split(' ')[0]}! Passando para te desejar um feliz aniversário! 🎉 Que seja um ano incrível. Um abraço, Natália.`
                            : `Olá ${e.nome_cliente.split(' ')[0]}! Sua apólice está completando mais um ano 🎉 Que tal marcarmos uma conversa rápida para revisar se a proteção continua ideal para o seu momento?`)}
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" title="Mensagem pronta no WhatsApp">
                        <MessageCircle size={17} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </Card>

        {/* Carteira ativa */}
        <Card className="xl:col-span-2">
          <div className="border-b border-slate-100 p-5 pb-3">
            <h2 className="font-semibold text-slate-900">Apólices ativas ({apolices.length})</h2>
          </div>
          {apolices.length === 0
            ? <EmptyState icone={ShieldCheck} titulo="Nenhuma apólice ativa"
                texto="As vendas registradas nos clientes aparecem aqui automaticamente." />
            : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Seguradora</th>
                    <th className="px-3 py-3 font-medium">Prêmio mensal</th>
                    <th className="px-3 py-3 font-medium">Capital segurado</th>
                    <th className="px-3 py-3 font-medium">Vigência</th>
                  </tr>
                </thead>
                <tbody>
                  {apolices.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link to={`/clientes/${a.clientes?.id}`}
                          className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                          {a.clientes?.nome}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{a.seguradoras?.nome}</td>
                      <td className="px-3 py-3">{brl(a.valor_premio_mensal)}</td>
                      <td className="px-3 py-3">{brl(a.capital_segurado)}</td>
                      <td className="px-3 py-3 text-slate-500">{dataBR(a.data_vigencia)}</td>
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
