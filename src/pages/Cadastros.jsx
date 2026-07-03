import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Percent, Save, MessageSquareText, Pencil, Trash2, CalendarSync, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  PageHeader, Card, Button, Input, Textarea, Campo, Modal, Spinner, Badge, ComoFunciona,
} from '../components/ui'
import { useToast } from '../components/Toast'

export default function Cadastros() {
  return (
    <div>
      <PageHeader titulo="Cadastros"
        subtitulo="Assessores, seguradoras, comissão, metas e mensagens automáticas" />

      <ComoFunciona id="cadastros">
        Esta é a base de configuração do sistema. Cadastre os <strong>assessores</strong> (quem traz os leads) e as
        <strong> seguradoras</strong> com o <strong>% de comissão</strong> de cada uma — é o que faz o sistema calcular
        as comissões automaticamente. Defina também como a comissão é <strong>dividida</strong> (Natália / assessor /
        escritório), suas <strong>metas do mês</strong> e os <strong>textos das mensagens</strong> automáticas.
      </ComoFunciona>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <PainelAssessores />
          <PainelMensagens />
        </div>
        <div className="space-y-6">
          <PainelSeguradoras />
          <PainelSplit />
          <PainelOutlook />
        </div>
      </div>
    </div>
  )
}

const ASSESSOR_VAZIO = { nome: '', codigo: '', telefone: '', email: '' }

function PainelAssessores() {
  const toast = useToast()
  const [lista, setLista] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(ASSESSOR_VAZIO)
  const [editando, setEditando] = useState(null) // id em edição, ou null (novo)
  const [erro, setErro] = useState(null)

  const carregar = () =>
    supabase.from('assessores').select('*').order('nome').then(({ data }) => setLista(data ?? []))

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm(ASSESSOR_VAZIO); setErro(null); setModal(true) }
  function abrirEdicao(a) {
    setEditando(a.id)
    setForm({ nome: a.nome, codigo: a.codigo ?? '', telefone: a.telefone ?? '', email: a.email ?? '' })
    setErro(null); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const payload = { ...form, codigo: form.codigo || null, telefone: form.telefone || null, email: form.email || null }
    const { error } = editando
      ? await supabase.from('assessores').update(payload).eq('id', editando)
      : await supabase.from('assessores').insert(payload)
    if (error) return setErro(error.message)
    setModal(false)
    toast.ok(editando ? 'Assessor atualizado.' : 'Assessor cadastrado.')
    carregar()
  }

  async function alternarAtivo(a) {
    await supabase.from('assessores').update({ ativo: !a.ativo }).eq('id', a.id)
    carregar()
  }

  async function excluir(a) {
    if (!window.confirm(`Excluir o assessor "${a.nome}"? (Só é possível se ele não tiver clientes vinculados.)`)) return
    const { error } = await supabase.from('assessores').delete().eq('id', a.id)
    if (error) toast.erro('Não foi possível excluir: este assessor tem clientes vinculados. Marque como inativo.')
    else toast.ok('Assessor excluído.')
    carregar()
  }

  if (!lista) return <Card className="p-5"><Spinner /></Card>

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Assessores ({lista.filter((a) => a.ativo).length} ativos)</h2>
        <Button onClick={abrirNovo}><Plus size={15} /> Novo</Button>
      </div>
      <ul className="divide-y divide-slate-100">
        {lista.map((a) => (
          <li key={a.id} className="flex items-center gap-2 py-3">
            <div className="min-w-0 flex-1">
              <Link to={`/assessores/${a.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline">
                {a.nome} {a.codigo && <span className="font-mono text-xs text-slate-400">· {a.codigo}</span>}
              </Link>
              <p className="truncate text-xs text-slate-400">{[a.telefone, a.email].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            <button onClick={() => alternarAtivo(a)} title="Clique para alternar ativo/inativo">
              <Badge tom={a.ativo ? 'green' : 'slate'}>{a.ativo ? 'ativo' : 'inativo'}</Badge>
            </button>
            <button onClick={() => abrirEdicao(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Editar">
              <Pencil size={15} />
            </button>
            <button onClick={() => excluir(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {lista.length === 0 && <p className="py-4 text-sm text-slate-400">Cadastre os assessores do escritório.</p>}
      </ul>

      <Modal aberto={modal} titulo={editando ? 'Editar assessor' : 'Novo assessor'} onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Campo label="Nome" obrigatorio>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
              </Campo>
            </div>
            <Campo label="Código" dica="Do escritório">
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="ASS-000" />
            </Campo>
          </div>
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

const SEGURADORA_VAZIA = { nome: '', comissao_padrao_percentual: '' }

function PainelSeguradoras() {
  const toast = useToast()
  const [lista, setLista] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(SEGURADORA_VAZIA)
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState(null)

  const carregar = () =>
    supabase.from('seguradoras').select('*').order('nome').then(({ data }) => setLista(data ?? []))

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm(SEGURADORA_VAZIA); setErro(null); setModal(true) }
  function abrirEdicao(s) {
    setEditando(s.id)
    setForm({ nome: s.nome, comissao_padrao_percentual: s.comissao_padrao_percentual })
    setErro(null); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const { error } = editando
      ? await supabase.from('seguradoras').update(form).eq('id', editando)
      : await supabase.from('seguradoras').insert(form)
    if (error) return setErro(error.message)
    setModal(false)
    toast.ok(editando ? 'Seguradora atualizada.' : 'Seguradora cadastrada.')
    carregar()
  }

  async function excluir(s) {
    if (!window.confirm(`Excluir a seguradora "${s.nome}"? (Só é possível se não houver apólices dela.)`)) return
    const { error } = await supabase.from('seguradoras').delete().eq('id', s.id)
    if (error) toast.erro('Não foi possível excluir: existem apólices desta seguradora.')
    else toast.ok('Seguradora excluída.')
    carregar()
  }

  if (!lista) return <Card className="p-5"><Spinner /></Card>

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Seguradoras</h2>
        <Button onClick={abrirNovo}><Plus size={15} /> Nova</Button>
      </div>
      <ul className="divide-y divide-slate-100">
        {lista.map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{s.nome}</p>
            <Badge tom="blue"><Percent size={11} /> {s.comissao_padrao_percentual}%</Badge>
            <button onClick={() => abrirEdicao(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Editar">
              <Pencil size={15} />
            </button>
            <button onClick={() => excluir(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {lista.length === 0 && (
          <p className="py-4 text-sm text-slate-400">
            Cadastre as seguradoras com que a Natália trabalha e o % de comissão de cada uma.
          </p>
        )}
      </ul>

      <Modal aberto={modal} titulo={editando ? 'Editar seguradora' : 'Nova seguradora'} onFechar={() => setModal(false)}>
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
  const toast = useToast()
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
      // só existe após a migração 010 — incluir antes dela quebraria o salvar
      ...(cfg.meta_comissao_mensal !== undefined && { meta_comissao_mensal: cfg.meta_comissao_mensal || 0 }),
      // só existem após a migração 011 (imposto e código AAI da Natália)
      ...(cfg.imposto_pct !== undefined && { imposto_pct: cfg.imposto_pct || 0 }),
      ...(cfg.codigo_natalia !== undefined && { codigo_natalia: (cfg.codigo_natalia || '').trim().toUpperCase() }),
      dias_sem_contato_alerta: cfg.dias_sem_contato_alerta || 90,
    }).eq('id', 1)
    if (error) { setMsg(`Erro: ${error.message}`); toast.erro('Erro ao salvar configurações.') }
    else { setMsg(null); toast.ok('Configurações salvas! Valem para as próximas vendas.') }
  }

  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value })

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold text-slate-900">Divisão de comissão e alertas</h2>
      <p className="mb-4 text-xs text-slate-400">
        Regra do fechamento: da comissão <strong>bruta</strong> sai primeiro o imposto do escritório;
        a divisão Natália / Assessor / Escritório vale sobre o <strong>líquido</strong>.
        Usada nos Relatórios (fechamento e Controle da Natália) e em cada venda.
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
        {cfg.imposto_pct !== undefined && (
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Imposto do escritório (%)" dica="Sai da bruta, antes da divisão">
              <Input type="number" step="0.01" min="0" max="100" value={cfg.imposto_pct} onChange={set('imposto_pct')} />
            </Campo>
            <Campo label="Código AAI da Natália" dica="Indicações com este código também são dela">
              <Input value={cfg.codigo_natalia ?? ''} onChange={set('codigo_natalia')} placeholder="CS8868" />
            </Campo>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Campo label="Alerta amarelo (dias parado)">
            <Input type="number" min="1" value={cfg.dias_alerta_amarelo} onChange={set('dias_alerta_amarelo')} />
          </Campo>
          <Campo label="Alerta vermelho (dias parado)">
            <Input type="number" min="1" value={cfg.dias_alerta_vermelho} onChange={set('dias_alerta_vermelho')} />
          </Campo>
          <Campo label="Sem contato (dias)" dica="Alerta de retenção">
            <Input type="number" min="1" value={cfg.dias_sem_contato_alerta ?? 90} onChange={set('dias_sem_contato_alerta')} />
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
          {cfg.meta_comissao_mensal !== undefined && (
            <Campo label="Meta: comissão recebida/mês (R$)" dica="Medida pelas planilhas de comissão importadas">
              <Input type="number" step="0.01" min="0" value={cfg.meta_comissao_mensal ?? 0} onChange={set('meta_comissao_mensal')} />
            </Campo>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={soma !== 100}><Save size={15} /> Salvar configurações</Button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </form>
    </Card>
  )
}

function PainelOutlook() {
  const toast = useToast()
  const [cfg, setCfg] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    supabase.from('configuracoes')
      .select('outlook_email, outlook_sync_ativo, outlook_ultima_sync')
      .single().then(({ data }) => setCfg(data))
  }, [])

  if (!cfg) return <Card className="p-5"><Spinner /></Card>
  const set = (k, v) => setCfg({ ...cfg, [k]: v })

  async function salvar(e) {
    e.preventDefault()
    const { error } = await supabase.from('configuracoes').update({
      outlook_email: cfg.outlook_email || null,
      outlook_sync_ativo: cfg.outlook_sync_ativo,
    }).eq('id', 1)
    toast[error ? 'erro' : 'ok'](error ? 'Erro ao salvar.' : 'Integração salva.')
  }

  async function sincronizarAgora() {
    setSincronizando(true)
    const { data, error } = await supabase.functions.invoke('sync-outlook')
    setSincronizando(false)
    if (error) return toast.erro('A ponte ainda não está publicada ou houve erro. Veja o guia de configuração.')
    toast.ok(`Sincronizado: ${data?.processados ?? 0} evento(s).`)
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <CalendarSync size={17} className="text-blue-600" /> Integração com o Outlook
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Traz as reuniões da agenda da Natália (Microsoft 365) para o Hub automaticamente.
        Requer configuração inicial no painel da Microsoft — veja <code className="rounded bg-slate-100 px-1">docs/INTEGRACAO_OUTLOOK.md</code>.
      </p>
      <form onSubmit={salvar} className="space-y-4">
        <Campo label="E-mail (caixa) da Natália no Microsoft 365" dica="Ex.: natalia@empresa.com.br">
          <Input type="email" value={cfg.outlook_email ?? ''} onChange={(e) => set('outlook_email', e.target.value)}
            placeholder="natalia@empresa.com.br" />
        </Campo>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={cfg.outlook_sync_ativo ?? false}
            onChange={(e) => set('outlook_sync_ativo', e.target.checked)} className="h-4 w-4 accent-brand-600" />
          <span className="text-sm text-slate-700">Sincronização ativada</span>
        </label>
        {cfg.outlook_ultima_sync && (
          <p className="text-xs text-slate-400">Última sincronização: {new Date(cfg.outlook_ultima_sync).toLocaleString('pt-BR')}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit"><Save size={15} /> Salvar</Button>
          <Button type="button" variant="secondary" onClick={sincronizarAgora} disabled={sincronizando}>
            <RefreshCw size={15} className={sincronizando ? 'animate-spin' : ''} /> Sincronizar agora
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PainelMensagens() {
  const toast = useToast()
  const [cfg, setCfg] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('configuracoes')
      .select('msg_aniversario, msg_aniversario_apolice, msg_lead_parado, msg_reuniao')
      .single().then(({ data }) => setCfg(data))
  }, [])

  if (!cfg) return <Card className="p-5"><Spinner /></Card>
  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value })

  async function salvar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('configuracoes').update(cfg).eq('id', 1)
    if (error) { setMsg(`Erro: ${error.message}`); toast.erro('Erro ao salvar mensagens.') }
    else { setMsg(null); toast.ok('Mensagens salvas!') }
  }

  const CAMPOS = [
    { k: 'msg_aniversario', label: 'Aniversário do cliente 🎂' },
    { k: 'msg_aniversario_apolice', label: 'Aniversário da apólice 📄' },
    { k: 'msg_lead_parado', label: 'Reativação de lead parado 🔥' },
    { k: 'msg_reuniao', label: 'Confirmação de reunião 📅' },
  ]

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
        <MessageSquareText size={17} className="text-blue-600" /> Mensagens automáticas
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Textos que o sistema gera sozinho. Use <code className="rounded bg-slate-100 px-1">{'{nome}'}</code> para o
        primeiro nome do cliente e <code className="rounded bg-slate-100 px-1">{'{quando}'}</code> (só na reunião) para a data/hora.
      </p>
      <form onSubmit={salvar} className="space-y-3">
        {CAMPOS.map(({ k, label }) => (
          <Campo key={k} label={label}>
            <Textarea rows={2} value={cfg[k] ?? ''} onChange={set(k)} />
          </Campo>
        ))}
        <div className="flex items-center gap-3">
          <Button type="submit"><Save size={15} /> Salvar mensagens</Button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </form>
    </Card>
  )
}
