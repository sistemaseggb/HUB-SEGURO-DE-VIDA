import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Users, AlertTriangle, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { etapaLabel } from '../lib/constants'
import { dataBR, whatsapp } from '../lib/format'
import {
  PageHeader, Button, Card, Input, Select, Textarea, Campo, Modal, Badge, Spinner, EmptyState, ComoFunciona,
} from '../components/ui'
import { useToast } from '../components/toastContexto'

const NOVO = { nome: '', codigo: '', telefone: '', email: '', data_nascimento: '', id_assessor: '', perfil_necessidade: '' }

export default function Clientes() {
  const navigate = useNavigate()
  const toast = useToast()
  const [clientes, setClientes] = useState(null)
  const [assessores, setAssessores] = useState([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(NOVO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  const [duplicados, setDuplicados] = useState([])

  async function carregar() {
    const [c, a, d] = await Promise.all([
      supabase.from('clientes').select('*, assessores(nome)').order('created_at', { ascending: false }),
      supabase.from('assessores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('vw_possiveis_duplicados').select('*').limit(20),
    ])
    setClientes(c.data ?? [])
    setAssessores(a.data ?? [])
    setDuplicados(d.data ?? [])
  }

  useEffect(() => { carregar() }, [])

  // Filtro por situação: em andamento = todo mundo que ainda não fechou nem perdeu
  const grupoDe = (c) => (c.status_funil === 'fechado' ? 'fechado'
    : c.status_funil === 'perdido' ? 'perdido' : 'andamento')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (clientes ?? []).filter((c) => {
      if (filtro !== 'todos' && grupoDe(c) !== filtro) return false
      if (!q) return true
      return c.nome.toLowerCase().includes(q)
        || (c.codigo ?? '').toLowerCase().includes(q)
        || (c.assessores?.nome ?? '').toLowerCase().includes(q)
    })
  }, [clientes, busca, filtro])

  const contagens = useMemo(() => {
    const acc = { todos: (clientes ?? []).length, andamento: 0, fechado: 0, perdido: 0 }
    for (const c of clientes ?? []) acc[grupoDe(c)] += 1
    return acc
  }, [clientes])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)
    const payload = { ...form, data_nascimento: form.data_nascimento || null, email: form.email || null, codigo: form.codigo || null }
    const { data, error } = await supabase.from('clientes').insert(payload).select('id').single()
    setSalvando(false)
    if (error) return setErro(error.message)
    setModal(false)
    setForm(NOVO)
    toast.ok('Lead cadastrado! Já criei a tarefa de primeiro contato.')
    navigate(`/clientes/${data.id}`)
  }

  if (!clientes) return <Spinner />

  return (
    <div>
      <PageHeader titulo="Clientes" subtitulo={`${clientes.length} cliente(s) na base`}>
        <Button onClick={() => setModal(true)}><Plus size={16} /> Novo lead</Button>
      </PageHeader>

      <ComoFunciona id="clientes">
        Aqui fica sua base de clientes. Todo cliente começa como <strong>lead</strong> e precisa estar ligado a um
        <strong> assessor</strong> (é o que define a divisão de comissão). Clique em <strong>Novo lead</strong> para
        cadastrar, ou no nome de um cliente para abrir o perfil completo — com reuniões, planejamento, apólices e documentos.
      </ComoFunciona>

      {duplicados.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <AlertTriangle size={15} /> {duplicados.length} telefone(s) com possível cliente duplicado
          </p>
          <ul className="mt-1 text-xs text-amber-700">
            {duplicados.slice(0, 5).map((d) => (
              <li key={d.fone}>• {d.clientes} <span className="text-amber-700">({d.fone})</span></li>
            ))}
            {duplicados.length > 5 && <li className="text-amber-700">…e mais {duplicados.length - 5}</li>}
          </ul>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <div className="relative max-w-xs flex-1 basis-56">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Buscar por cliente ou assessor..."
              value={busca} onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'andamento', label: 'Em andamento' },
              { id: 'fechado', label: 'Fechados' },
              { id: 'perdido', label: 'Perdidos' },
            ].map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filtro === f.id
                    ? 'bg-brand-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f.label} <span className={filtro === f.id ? 'text-white/60' : 'text-slate-400'}>{contagens[f.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState icone={Users} titulo={busca ? 'Nenhum resultado' : 'Nenhum cliente ainda'}
            texto={busca ? `Nada encontrado para "${busca}".` : 'Cadastre o primeiro lead — o vínculo com o assessor é obrigatório para a divisão de comissão.'}>
            {!busca && <Button onClick={() => setModal(true)}><Plus size={16} /> Cadastrar primeiro lead</Button>}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Assessor</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
                <th className="px-2 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.codigo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link to={`/clientes/${c.id}`} className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
                      {c.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.assessores?.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tom={c.status_funil === 'fechado' ? 'green' : c.status_funil === 'perdido' ? 'red' : 'blue'}>
                      {etapaLabel(c.status_funil)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.telefone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{dataBR(c.created_at)}</td>
                  <td className="px-2 py-3">
                    {whatsapp(c.telefone) && (
                      <a href={whatsapp(c.telefone)} target="_blank" rel="noreferrer"
                        className="inline-flex rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50"
                        title={`WhatsApp de ${c.nome.split(' ')[0]}`}>
                        <MessageCircle size={16} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Modal aberto={modal} titulo="Novo lead" onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Campo label="Nome completo" obrigatorio>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
              </Campo>
            </div>
            <Campo label="Código" dica="Do escritório">
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="CLI-000" />
            </Campo>
          </div>
          <Campo label="Assessor que indicou" obrigatorio dica="Obrigatório — define a divisão de comissão">
            <Select value={form.id_assessor} onChange={(e) => setForm({ ...form, id_assessor: e.target.value })} required>
              <option value="">Selecione...</option>
              {assessores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Telefone (WhatsApp)">
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(41) 99999-9999" />
            </Campo>
            <Campo label="Data de nascimento" dica="Alimenta a régua de aniversários">
              <Input type="date" value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
            </Campo>
          </div>
          <Campo label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Campo>
          <Campo label="Perfil / necessidade percebida">
            <Textarea value={form.perfil_necessidade}
              onChange={(e) => setForm({ ...form, perfil_necessidade: e.target.value })}
              placeholder="Ex.: médico, 2 filhos, preocupado com sucessão patrimonial..." />
          </Campo>
          {erro && <p className="text-sm text-red-700">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar lead'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
