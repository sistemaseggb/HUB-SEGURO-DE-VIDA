import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, RefreshCw, X, Check, Inbox } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { whatsapp, dataBR } from '../lib/format'
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, ComoFunciona } from '../components/ui'
import { useToast } from '../components/Toast'

const ROTULO_TIPO = {
  aniversario_cliente: { texto: 'Aniversário', tom: 'yellow' },
  aniversario_apolice: { texto: 'Aniversário da apólice 📄', tom: 'blue' },
  lead_parado: { texto: 'Reativação de lead', tom: 'red' },
  manual: { texto: 'Manual', tom: 'slate' },
}

// Central de Mensagens: o banco escreve as mensagens sozinho (pg_cron às 8h);
// aqui a Natália dispara cada uma com 1 clique — o envio marca como enviada.
export default function Mensagens() {
  const toast = useToast()
  const [pendentes, setPendentes] = useState(null)
  const [historico, setHistorico] = useState([])
  const [gerando, setGerando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(async () => {
    const [p, h] = await Promise.all([
      supabase.from('fila_mensagens').select('*, clientes(nome)')
        .eq('status', 'pendente').order('created_at'),
      supabase.from('fila_mensagens').select('*, clientes(nome)')
        .neq('status', 'pendente').order('enviada_em', { ascending: false }).limit(15),
    ])
    setPendentes(p.data ?? [])
    setHistorico(h.data ?? [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function gerarAgora() {
    setGerando(true)
    const { data, error } = await supabase.rpc('fn_gerar_fila_diaria')
    setGerando(false)
    setAviso(error ? `Erro: ${error.message}` : `${data ?? 0} mensagem(ns) nova(s) na fila.`)
    carregar()
  }

  async function marcar(m, status) {
    await supabase.from('fila_mensagens').update({
      status, enviada_em: status === 'enviada' ? new Date().toISOString() : null,
    }).eq('id', m.id)
    if (status === 'enviada') toast.ok('Marcada como enviada.')
    else if (status === 'descartada') toast.info('Mensagem descartada.')
    carregar()
  }

  function enviar(m) {
    const url = whatsapp(m.telefone, m.mensagem)
    if (url) window.open(url, '_blank')
    marcar(m, 'enviada')
  }

  if (!pendentes) return <Spinner />

  return (
    <div>
      <PageHeader titulo="Central de Mensagens"
        subtitulo="Mensagens escritas automaticamente pelo sistema — envie cada uma com 1 clique">
        <Button variant="secondary" onClick={gerarAgora} disabled={gerando}>
          <RefreshCw size={15} className={gerando ? 'animate-spin' : ''} /> Gerar mensagens de hoje
        </Button>
      </PageHeader>

      <ComoFunciona id="mensagens">
        Todo dia de manhã o sistema <strong>escreve sozinho</strong> as mensagens do dia: parabéns de aniversário,
        aniversário de apólice, reativação de leads parados e confirmação de reunião. Você só revisa e clica em
        <strong> Enviar no WhatsApp</strong> — a conversa abre com o texto pronto. Os textos podem ser
        personalizados em <strong>Cadastros → Mensagens automáticas</strong>.
      </ComoFunciona>

      {aviso && <p className="mb-4 text-sm text-slate-500">{aviso}</p>}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Para enviar ({pendentes.length})</h2>
          </div>
          {pendentes.length === 0
            ? <EmptyState icone={Inbox} titulo="Fila vazia"
                texto="Com o pg_cron ativo, a fila se abastece sozinha todo dia às 8h. Você também pode gerar manualmente no botão acima." />
            : (
              <ul className="divide-y divide-slate-100">
                {pendentes.map((m) => {
                  const rot = ROTULO_TIPO[m.tipo] ?? ROTULO_TIPO.manual
                  return (
                    <li key={m.id} className="px-5 py-4">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tom={rot.tom}>{rot.texto}</Badge>
                        {m.clientes?.nome && (
                          <Link to={`/clientes/${m.id_cliente}`}
                            className="text-sm font-medium text-slate-800 hover:underline">
                            {m.clientes.nome}
                          </Link>
                        )}
                        <span className="text-xs text-slate-400">{dataBR(m.data_alvo)}</span>
                      </div>
                      <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{m.mensagem}</p>
                      <div className="flex gap-2">
                        {whatsapp(m.telefone)
                          ? <Button variant="success" onClick={() => enviar(m)}>
                              <MessageCircle size={15} /> Enviar no WhatsApp
                            </Button>
                          : <span className="text-xs text-amber-600">cliente sem telefone cadastrado</span>}
                        <Button variant="secondary" onClick={() => marcar(m, 'enviada')}>
                          <Check size={15} /> Já enviei
                        </Button>
                        <Button variant="ghost" onClick={() => marcar(m, 'descartada')}>
                          <X size={15} /> Descartar
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Últimas tratadas</h2>
          {historico.length === 0
            ? <p className="text-sm text-slate-400">Nada ainda.</p>
            : (
              <ul className="space-y-2">
                {historico.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-100 p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-700">{m.clientes?.nome ?? '—'}</span>
                      <Badge tom={m.status === 'enviada' ? 'green' : 'slate'}>{m.status}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{m.mensagem}</p>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>
    </div>
  )
}
