import { useEffect, useState } from 'react'
import { Plus, Percent, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  PageHeader, Card, Button, Input, Campo, Modal, Spinner, Badge,
} from '../components/ui'

export default function Cadastros() {
  return (
    <div>
      <PageHeader titulo="Cadastros"
        subtitulo="Assessores, seguradoras e a regra de divisão de comissão" />
      <div className="grid gap-6 xl:grid-cols-2">
        <PainelAssessores />
        <div className="space-y-6">
          <PainelSeguradoras />
          <PainelSplit />
        </div>
      </div>
    </div>
  )
}

function PainelAssessores() {
  const [lista, setLista] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '' })
  const [erro, setErro] = useState(null)

  const carregar = () =>
    supabase.from('assessores').select('*').order('nome').then(({ data }) => setLista(data ?? []))

  useEffect(() => { carregar() }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.from('assessores')
      .insert({ ...form, telefone: form.telefone || null, email: form.email || null })
    if (error) return setErro(error.message)
    setModal(false)
    setForm({ nome: '', telefone: '', email: '' })
    carregar()
  }

  async function alternarAtivo(a) {
    await supabase.from('assessores').update({ ativo: !a.ativo }).eq('id', a.id)
    carregar()
  }

  if (!lista) return <Card className="p-5"><Spinner /></Card>

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Assessores ({lista.filter((a) => a.ativo).length} ativos)</h2>
        <Button onClick={() => setModal(true)}><Plus size={15} /> Novo</Button>
      </div>
      <ul className="divide-y divide-slate-100">
        {lista.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{a.nome}</p>
              <p className="truncate text-xs text-slate-400">{[a.telefone, a.email].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            <button onClick={() => alternarAtivo(a)} title="Clique para alternar">
              <Badge tom={a.ativo ? 'green' : 'slate'}>{a.ativo ? 'ativo' : 'inativo'}</Badge>
            </button>
          </li>
        ))}
        {lista.length === 0 && <p className="py-4 text-sm text-slate-400">Cadastre os assessores do escritório.</p>}
      </ul>

      <Modal aberto={modal} titulo="Novo assessor" onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome" obrigatorio>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Telefone">
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </Campo>
            <Campo label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Campo>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

function PainelSeguradoras() {
  const [lista, setLista] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', comissao_padrao_percentual: '' })
  const [erro, setErro] = useState(null)

  const carregar = () =>
    supabase.from('seguradoras').select('*').order('nome').then(({ data }) => setLista(data ?? []))

  useEffect(() => { carregar() }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.from('seguradoras').insert(form)
    if (error) return setErro(error.message)
    setModal(false)
    setForm({ nome: '', comissao_padrao_percentual: '' })
    carregar()
  }

  if (!lista) return <Card className="p-5"><Spinner /></Card>

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Seguradoras</h2>
        <Button onClick={() => setModal(true)}><Plus size={15} /> Nova</Button>
      </div>
      <ul className="divide-y divide-slate-100">
        {lista.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-3">
            <p className="text-sm font-medium text-slate-800">{s.nome}</p>
            <Badge tom="blue"><Percent size={11} /> comissão padrão {s.comissao_padrao_percentual}%</Badge>
          </li>
        ))}
        {lista.length === 0 && (
          <p className="py-4 text-sm text-slate-400">
            Cadastre as seguradoras com que a Natália trabalha e o % de comissão de cada uma.
          </p>
        )}
      </ul>

      <Modal aberto={modal} titulo="Nova seguradora" onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome" obrigatorio>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          </Campo>
          <Campo label="Comissão padrão (%)" obrigatorio
            dica="Usada automaticamente ao registrar vendas desta seguradora">
            <Input type="number" step="0.01" min="0" max="100" required
              value={form.comissao_padrao_percentual}
              onChange={(e) => setForm({ ...form, comissao_padrao_percentual: e.target.value })} />
          </Campo>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

function PainelSplit() {
  const [cfg, setCfg] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('configuracoes').select('*').single().then(({ data }) => setCfg(data))
  }, [])

  if (!cfg) return <Card className="p-5"><Spinner /></Card>

  const soma = Number(cfg.split_natalia_pct) + Number(cfg.split_assessor_pct) + Number(cfg.split_escritorio_pct)

  async function salvar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('configuracoes').update({
      split_natalia_pct: cfg.split_natalia_pct,
      split_assessor_pct: cfg.split_assessor_pct,
      split_escritorio_pct: cfg.split_escritorio_pct,
      dias_alerta_amarelo: cfg.dias_alerta_amarelo,
      dias_alerta_vermelho: cfg.dias_alerta_vermelho,
      meta_premio_mensal: cfg.meta_premio_mensal || 0,
      meta_reunioes_mensal: cfg.meta_reunioes_mensal || 0,
      meta_apolices_mensal: cfg.meta_apolices_mensal || 0,
    }).eq('id', 1)
    setMsg(error ? `Erro: ${error.message}` : 'Salvo! Vale para as próximas vendas.')
  }

  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value })

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold text-slate-900">Divisão de comissão e alertas</h2>
      <p className="mb-4 text-xs text-slate-400">
        Aplicada automaticamente em cada venda. Alterações não afetam vendas antigas.
      </p>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Natália (%)">
            <Input type="number" step="0.01" value={cfg.split_natalia_pct} onChange={set('split_natalia_pct')} />
          </Campo>
          <Campo label="Assessor (%)">
            <Input type="number" step="0.01" value={cfg.split_assessor_pct} onChange={set('split_assessor_pct')} />
          </Campo>
          <Campo label="Escritório (%)">
            <Input type="number" step="0.01" value={cfg.split_escritorio_pct} onChange={set('split_escritorio_pct')} />
          </Campo>
        </div>
        {soma !== 100 && (
          <p className="text-sm text-amber-600">A soma precisa dar 100% (atual: {soma}%).</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Alerta amarelo (dias parado)">
            <Input type="number" min="1" value={cfg.dias_alerta_amarelo} onChange={set('dias_alerta_amarelo')} />
          </Campo>
          <Campo label="Alerta vermelho (dias parado)">
            <Input type="number" min="1" value={cfg.dias_alerta_vermelho} onChange={set('dias_alerta_vermelho')} />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Meta: prêmio/mês (R$)" dica="0 = sem meta">
            <Input type="number" step="0.01" min="0" value={cfg.meta_premio_mensal ?? 0} onChange={set('meta_premio_mensal')} />
          </Campo>
          <Campo label="Meta: reuniões/mês">
            <Input type="number" min="0" value={cfg.meta_reunioes_mensal ?? 0} onChange={set('meta_reunioes_mensal')} />
          </Campo>
          <Campo label="Meta: apólices/mês">
            <Input type="number" min="0" value={cfg.meta_apolices_mensal ?? 0} onChange={set('meta_apolices_mensal')} />
          </Campo>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={soma !== 100}><Save size={15} /> Salvar configurações</Button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </form>
    </Card>
  )
}
