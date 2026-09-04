import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cake, MessageCircle, ShieldCheck, Wallet, TrendingUp, AlertCircle, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto, dataBR, whatsapp } from '../lib/format'
import { PageHeader, Card, Badge, Spinner, EmptyState, StatTile, ComoFunciona, Select } from '../components/ui'
import { CHART } from '../lib/constants'

export default function PosVenda() {
  const [apolices, setApolices] = useState(null)
  const [regua, setRegua] = useState([])
  const [carteira, setCarteira] = useState({})
  const [porSeg, setPorSeg] = useState([])
  const [semContato, setSemContato] = useState([])
  const [busca, setBusca] = useState('')
  const [filtroSeg, setFiltroSeg] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('apolices')
        .select('*, clientes(id, nome, telefone), seguradoras(nome)')
        .eq('status', 'ativa')
        .order('data_vigencia', { ascending: false }),
      supabase.from('vw_regua_relacionamento').select('*').lte('dias_restantes', 45),
      supabase.from('vw_carteira').select('*').single(),
      supabase.from('vw_carteira_seguradora').select('*'),
      supabase.from('vw_clientes_sem_contato').select('*').limit(10),
    ]).then(([a, r, c, s, sc]) => {
      setApolices(a.data ?? [])
      setRegua(r.data ?? [])
      setCarteira(c.data ?? {})
      setPorSeg(s.data ?? [])
      setSemContato(sc.data ?? [])
    })
  }, [])

  // Filtro da carteira: busca por cliente/seguradora + filtro por seguradora.
  // Essencial quando a carteira tem centenas de apólices.
  const apolicesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (apolices ?? []).filter((a) => {
      if (filtroSeg && (a.seguradoras?.nome ?? '') !== filtroSeg) return false
      if (!q) return true
      return (a.clientes?.nome ?? '').toLowerCase().includes(q)
        || (a.seguradoras?.nome ?? '').toLowerCase().includes(q)
        || (a.numero_apolice ?? '').toLowerCase().includes(q)
    })
  }, [apolices, busca, filtroSeg])

  const nomesSeg = useMemo(
    () => [...new Set((apolices ?? []).map((a) => a.seguradoras?.nome).filter(Boolean))].sort(),
    [apolices],
  )

  if (!apolices) return <Spinner />

  const maxSeg = Math.max(...porSeg.map((s) => Number(s.premio_mensal)), 1)

  return (
    <div>
      <PageHeader titulo="Pós-Venda"
        subtitulo="Carteira ativa e régua de relacionamento — os alertas aparecem sozinhos" />

      <ComoFunciona id="posvenda">
        Depois da venda, o relacionamento é o que garante renovação e indicações. Aqui você vê a <strong>saúde da
        sua carteira</strong> (quanto ela rende por mês), os <strong>aniversários</strong> de clientes e apólices que
        se aproximam, e um alerta de <strong>clientes esquecidos</strong> — quem comprou mas está há muito tempo sem
        contato. Cada item tem um botão de WhatsApp com mensagem pronta.
      </ComoFunciona>

      {/* Saúde da carteira */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile rotulo="Receita mensal recorrente" valor={brl(carteira.receita_mensal_recorrente ?? 0)}
          detalhe={`${carteira.apolices_ativas ?? 0} apólices ativas`} icone={Wallet} corIcone="text-emerald-600 bg-emerald-50" />
        <StatTile rotulo="Receita anualizada" valor={brlCompacto(carteira.receita_anualizada ?? 0)}
          icone={TrendingUp} corIcone="text-blue-600 bg-blue-50" />
        <StatTile rotulo="Capital total protegido" valor={brlCompacto(carteira.capital_total ?? 0)}
          icone={ShieldCheck} corIcone="text-laranja-600 bg-laranja-50" />
        <StatTile rotulo="Ticket médio" valor={brl(carteira.ticket_medio ?? 0)}
          detalhe="prêmio mensal por apólice" icone={TrendingUp} corIcone="text-amber-600 bg-amber-50" />
      </div>

      {/* Distribuição por seguradora + clientes esquecidos */}
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Carteira por seguradora</h2>
          {porSeg.length === 0
            ? <p className="text-sm text-slate-400">Sem apólices ativas ainda.</p>
            : (
              <div className="space-y-2">
                {porSeg.map((s) => (
                  <div key={s.nome} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-right text-xs text-slate-500" title={s.nome}>{s.nome}</span>
                    <div className="h-6 flex-1 rounded-r-md bg-slate-50">
                      <div className="flex h-6 items-center justify-end rounded-r-md pr-2"
                        style={{ width: `${Math.max((Number(s.premio_mensal) / maxSeg) * 100, 12)}%`, background: CHART.serie1 }}>
                        <span className="text-xs font-semibold text-white">{brlCompacto(s.premio_mensal)}</span>
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-xs text-slate-400">{s.apolices}</span>
                  </div>
                ))}
              </div>
            )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <AlertCircle size={17} className="text-amber-500" /> Clientes que precisam de atenção
          </h2>
          <p className="mb-4 text-xs text-slate-400">Com apólice ativa e sem contato há muito tempo (retenção)</p>
          {semContato.length === 0
            ? <p className="text-sm text-slate-400">Nenhum cliente esquecido. 👏</p>
            : (
              <ul className="space-y-2">
                {semContato.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/clientes/${c.id}`} className="block truncate text-sm font-medium text-slate-800 hover:underline">
                        {c.nome}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {c.dias_sem_contato == null ? 'sem contato registrado' : `há ${c.dias_sem_contato} dias sem contato`}
                      </p>
                    </div>
                    {whatsapp(c.telefone) && (
                      <a href={whatsapp(c.telefone, `Olá ${c.nome.split(' ')[0]}! Tudo bem? Passando para saber como você está e se está tudo certo com sua proteção. Abraço, Natália.`)}
                        target="_blank" rel="noreferrer" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" title="WhatsApp">
                        <MessageCircle size={16} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Régua de relacionamento */}
        <Card className="p-5">
          <h2 className="mb-4 flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            <Cake size={18} className="text-amber-500" /> Régua de Relacionamento
            <span className="text-xs font-normal text-slate-400">próximos 45 dias</span>
          </h2>
          {regua.length === 0
            ? <p className="text-sm text-slate-400">Nenhum evento próximo.</p>
            : (
              <ul className="space-y-2">
                {regua.map((e, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      e.tipo_evento === 'aniversario_cliente' ? 'bg-laranja-50 text-laranja-600' : 'bg-slate-100 text-slate-500'}`}>
                      {e.tipo_evento === 'aniversario_cliente' ? <Cake size={17} /> : <ShieldCheck size={17} />}
                    </span>
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
                    <span className="shrink-0">
                      <Badge tom={e.dias_restantes <= 7 ? 'yellow' : 'slate'}>
                        {e.dias_restantes === 0 ? 'HOJE!' : `em ${e.dias_restantes}d`}
                      </Badge>
                    </span>
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
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5 pb-3">
            <h2 className="font-semibold text-slate-900">
              Apólices ativas <span className="text-slate-400">({apolicesFiltradas.length}{apolicesFiltradas.length !== apolices.length ? ` de ${apolices.length}` : ''})</span>
            </h2>
            {apolices.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar cliente, seguradora ou nº..."
                    aria-label="Buscar apólice por cliente, seguradora ou número"
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-laranja-400 focus:outline-none sm:w-56" />
                </div>
                {nomesSeg.length > 1 && (
                  <Select value={filtroSeg} onChange={(e) => setFiltroSeg(e.target.value)} style={{ width: 'auto' }}
                    aria-label="Filtrar apólices por seguradora">
                    <option value="">Todas as seguradoras</option>
                    {nomesSeg.map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                )}
              </div>
            )}
          </div>
          {apolices.length === 0
            ? <EmptyState icone={ShieldCheck} titulo="Nenhuma apólice ativa"
                texto="As vendas registradas nos clientes aparecem aqui automaticamente." />
            : apolicesFiltradas.length === 0
              ? <p className="py-10 text-center text-sm text-slate-400">Nenhuma apólice encontrada para “{busca || filtroSeg}”.</p>
              : (
              <div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Seguradora</th>
                    <th className="px-3 py-3 font-medium">Prêmio mensal</th>
                    <th className="px-3 py-3 font-medium">Capital segurado</th>
                    <th className="px-3 py-3 font-medium">Vigência</th>
                  </tr>
                </thead>
                <tbody>
                  {apolicesFiltradas.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link to={`/clientes/${a.clientes?.id}`}
                          className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                          {a.clientes?.nome}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{a.seguradoras?.nome}</td>
                      <td className="px-3 py-3">{brl(a.valor_premio_mensal)}</td>
                      <td className="px-3 py-3">{Number(a.capital_segurado) > 0 ? brl(a.capital_segurado) : '—'}</td>
                      <td className="px-3 py-3 text-slate-500">{dataBR(a.data_vigencia)}</td>
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
