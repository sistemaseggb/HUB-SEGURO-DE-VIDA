import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, MessageCircle, CalendarClock, Mail, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS_REUNIAO, etapaLabel } from '../lib/constants'
import { whatsapp, dataHoraBR, hojeLocal, diaLocal, localParaISO } from '../lib/format'
import {
  PageHeader, Card, Button, Select, Input, Textarea, Campo, Modal, Spinner, EmptyState, ComoFunciona, Badge,
} from '../components/ui'
import { useToast } from '../components/toastContexto'

// Agenda: tudo que está marcado, agrupado por dia, com ação rápida de status.
export default function Agenda() {
  const toast = useToast()
  const [reunioes, setReunioes] = useState(null)
  const [clientes, setClientes] = useState([])
  const [pendentes, setPendentes] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ id_cliente: '', data_hora: '', notas: '' })

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - 30 * 86400000).toISOString()
    const [r, c, p] = await Promise.all([
      supabase.from('vw_agenda_reunioes').select('*').gte('data_hora', desde).order('data_hora'),
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase.from('vw_agenda_externa_pendentes').select('*'),
    ])
    setReunioes(r.data ?? [])
    setClientes(c.data ?? [])
    setPendentes(p.data ?? [])
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function agendar(e) {
    e.preventDefault()
    const { error } = await supabase.from('reunioes').insert({
      id_cliente: form.id_cliente,
      // O campo entrega a hora local sem fuso; sem esta conversão o Postgres
      // (que roda em UTC) lê 14:30 como 14:30Z = 11:30 no Brasil.
      data_hora: localParaISO(form.data_hora),
      notas: form.notas || null,
    })
    if (error) return toast.erro(`Não foi possível agendar: ${error.message}`)
    setModal(false)
    setForm({ id_cliente: '', data_hora: '', notas: '' })
    toast.ok('Reunião agendada! O cliente avançou no funil.')
    carregar()
  }

  async function mudarStatus(r, status) {
    const { error } = await supabase.from('reunioes').update({ status }).eq('id', r.id)
    if (error) return toast.erro(`Não foi possível atualizar: ${error.message}`)
    carregar()
  }

  async function vincular(evento, idCliente) {
    if (!idCliente) return
    const { error } = await supabase.rpc('fn_vincular_evento', { p_evento_id: evento.id, p_cliente_id: idCliente })
    if (error) return toast.erro('Erro ao vincular: ' + error.message)
    toast.ok('Reunião vinculada ao cliente.')
    carregar()
  }

  async function ignorarEvento(evento) {
    const { error } = await supabase.from('agenda_externa').update({ status: 'ignorada' }).eq('id', evento.id)
    if (error) return toast.erro(`Não foi possível ignorar: ${error.message}`)
    setPendentes((ps) => ps.filter((p) => p.id !== evento.id))
  }

  const grupos = useMemo(() => {
    if (!reunioes) return []
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const porDia = new Map()
    for (const r of reunioes) {
      const d = new Date(r.data_hora); d.setHours(0, 0, 0, 0)
      const passada = d < hoje && r.status === 'agendada'
      const chave = passada ? 'ATRASADAS' : diaLocal(r.data_hora)
      if (!porDia.has(chave)) porDia.set(chave, [])
      porDia.get(chave).push(r)
    }
    return [...porDia.entries()].sort(([a], [b]) =>
      a === 'ATRASADAS' ? -1 : b === 'ATRASADAS' ? 1 : a.localeCompare(b))
  }, [reunioes])

  if (!reunioes) return <Spinner />

  const rotuloDia = (chave) => {
    if (chave === 'ATRASADAS') return 'Atrasadas — aguardando atualização'
    const hoje = hojeLocal()
    const amanha = diaLocal(Date.now() + 86400000)
    if (chave === hoje) return 'Hoje'
    if (chave === amanha) return 'Amanhã'
    const [y, m, d] = chave.split('-')
    return new Date(Number(y), Number(m) - 1, Number(d))
      .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div>
      <PageHeader titulo="Agenda de Reuniões"
        subtitulo="Marcar como realizada avança o cliente no funil e cria a tarefa do estudo — sozinho">
        <Button onClick={() => setModal(true)}><CalendarPlus size={16} /> Agendar reunião</Button>
      </PageHeader>

      <ComoFunciona id="agenda">
        Suas reuniões agrupadas por dia. Ao marcar uma reunião como <strong>Realizada</strong>, o sistema move o
        cliente para "Reunião Realizada" no funil e já cria a tarefa de montar o estudo — você não precisa fazer nada
        manualmente. Reuniões cujo horário já passou aparecem em destaque no topo. Se a integração com o Outlook
        estiver ligada, as reuniões marcadas lá aparecem aqui sozinhas.
      </ComoFunciona>

      {/* Caixa de entrada do Outlook: eventos que o sistema não conseguiu casar */}
      {pendentes.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/40 p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <Mail size={18} className="text-amber-700" /> Reuniões do Outlook a vincular
            <Badge tom="yellow">{pendentes.length}</Badge>
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Estas reuniões vieram da sua agenda do Outlook, mas o sistema não identificou o cliente automaticamente.
            Escolha o cliente de cada uma (ou ignore, se não for reunião de cliente).
          </p>
          <ul className="space-y-2">
            {pendentes.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{ev.assunto || '(sem assunto)'}</p>
                  <p className="text-xs text-slate-400">{dataHoraBR(ev.inicio)}{ev.organizador && ` · ${ev.organizador}`}</p>
                </div>
                <Select aria-label="Vincular este evento a um cliente" defaultValue="" onChange={(e) => vincular(ev, e.target.value)} style={{ width: 'auto' }}>
                  <option value="">Vincular ao cliente…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
                <button onClick={() => ignorarEvento(ev)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Ignorar (não é reunião de cliente)">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {grupos.length === 0 && (
        <Card>
          <EmptyState icone={CalendarClock} titulo="Agenda vazia"
            texto="Agende a primeira reunião — o cliente avança no funil automaticamente." />
        </Card>
      )}

      <div className="space-y-6">
        {grupos.map(([chave, itens]) => (
          <div key={chave}>
            <h2 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${
              chave === 'ATRASADAS' ? 'text-red-700' : 'text-slate-400'}`}>
              {rotuloDia(chave)}
            </h2>
            <Card>
              <ul className="divide-y divide-slate-100">
                {itens.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-14 text-lg font-bold text-slate-800">
                      {new Date(r.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/clientes/${r.id_cliente}`}
                        className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                        {r.nome_cliente}
                      </Link>
                      <p className="truncate text-xs text-slate-400">
                        {etapaLabel(r.status_funil)} · Assessor: {r.nome_assessor}
                        {r.notas && ` · ${r.notas}`}
                      </p>
                    </div>
                    <Select aria-label="Situação da reunião" value={r.status} onChange={(e) => mudarStatus(r, e.target.value)} style={{ width: 'auto' }}>
                      {STATUS_REUNIAO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                    {whatsapp(r.telefone) && (
                      <a target="_blank" rel="noreferrer"
                        href={whatsapp(r.telefone,
                          `Olá ${r.nome_cliente.split(' ')[0]}! Confirmando nossa reunião de ${new Date(r.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Até lá! — Natália`)}
                        className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"
                        title="Confirmar por WhatsApp">
                        <MessageCircle size={17} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>

      <Modal aberto={modal} titulo="Agendar reunião" onFechar={() => setModal(false)}>
        <form onSubmit={agendar} className="space-y-4">
          <Campo label="Cliente" obrigatorio>
            <Select value={form.id_cliente} required
              onChange={(e) => setForm({ ...form, id_cliente: e.target.value })}>
              <option value="">Selecione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Campo>
          <Campo label="Data e hora" obrigatorio>
            <Input type="datetime-local" required value={form.data_hora}
              onChange={(e) => setForm({ ...form, data_hora: e.target.value })} />
          </Campo>
          <Campo label="Pauta / notas">
            <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </Campo>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Agendar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
