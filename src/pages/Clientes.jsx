import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { etapaLabel } from '../lib/constants'
import { dataBR } from '../lib/format'
import {
  PageHeader, Button, Card, Input, Select, Textarea, Campo, Modal, Badge, Spinner, EmptyState,
} from '../components/ui'

const NOVO = { nome: '', telefone: '', email: '', data_nascimento: '', id_assessor: '', perfil_necessidade: '' }

export default function Clientes() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState(null)
  const [assessores, setAssessores] = useState([])
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(NOVO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  async function carregar() {
    const [c, a] = await Promise.all([
      supabase.from('clientes').select('*, assessores(nome)').order('created_at', { ascending: false }),
      supabase.from('assessores').select('id, nome').eq('ativo', true).order('nome'),
    ])
    setClientes(c.data ?? [])
    setAssessores(a.data ?? [])
  }

  useEffect(() => { carregar() }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes ?? []
    return (clientes ?? []).filter(
      (c) => c.nome.toLowerCase().includes(q) || (c.assessores?.nome ?? '').toLowerCase().includes(q)
    )
  }, [clientes, busca])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)
    const payload = { ...form, data_nascimento: form.data_nascimento || null, email: form.email || null }
    const { data, error } = await supabase.from('clientes').insert(payload).select('id').single()
    setSalvando(false)
    if (error) return setErro(error.message)
    setModal(false)
    setForm(NOVO)
    navigate(`/clientes/${data.id}`)
  }

  if (!clientes) return <Spinner />

  return (
    <div>
      <PageHeader titulo="Clientes" subtitulo={`${clientes.length} cliente(s) na base`}>
        <Button onClick={() => setModal(true)}><Plus size={16} /> Novo lead</Button>
      </PageHeader>

      <Card>
        <div className="border-b border-slate-100 p-3">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Buscar por cliente ou assessor..."
              value={busca} onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState icone={Users} titulo="Nenhum cliente encontrado"
            texto="Cadastre o primeiro lead — o vínculo com o assessor é obrigatório para a divisão de comissão." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Assessor</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal aberto={modal} titulo="Novo lead" onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome completo" obrigatorio>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          </Campo>
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
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar lead'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
