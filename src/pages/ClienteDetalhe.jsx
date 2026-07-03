import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MessageCircle, Presentation, Copy, Check,
  CalendarPlus, FileSignature, ClipboardList, Zap, Upload, FileText, Download, Trash2, Pencil,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS, etapaLabel, STATUS_REUNIAO, TIPO_TAREFA_ICONE } from '../lib/constants'
import { brl, dataBR, dataHoraBR, whatsapp, iniciais } from '../lib/format'
import {
  Button, Card, Input, Select, Textarea, Campo, Modal, Badge, Spinner,
} from '../components/ui'
import { useToast } from '../components/Toast'

const ABAS = ['Planejamento', 'Interações', 'Reuniões', 'Apólices', 'Comissões', 'Documentos', 'Formulário', 'Tarefas', 'Histórico']

export default function ClienteDetalhe() {
  const { id } = useParams()
  const [cliente, setCliente] = useState(null)
  const [aba, setAba] = useState('Planejamento')

  const navigate = useNavigate()
  const toast = useToast()
  const [prioridade, setPrioridade] = useState(null)
  const [contato, setContato] = useState(null)
  const [editar, setEditar] = useState(false)
  const [assessores, setAssessores] = useState([])
  const [formEdit, setFormEdit] = useState(null)
  const [erroEdit, setErroEdit] = useState(null)

  const carregar = useCallback(async () => {
    const [c, pr, ct] = await Promise.all([
      supabase.from('clientes').select('*, assessores(nome, telefone)').eq('id', id).single(),
      supabase.from('vw_prioridades_classificadas').select('proxima_acao, temperatura, score').eq('id', id).maybeSingle(),
      supabase.from('vw_clientes_contato').select('dias_sem_contato, ultimo_contato').eq('id', id).maybeSingle(),
    ])
    setCliente(c.data)
    setPrioridade(pr.data)
    setContato(ct.data)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  function abrirEdicao() {
    setFormEdit({
      nome: cliente.nome ?? '', codigo: cliente.codigo ?? '', telefone: cliente.telefone ?? '',
      email: cliente.email ?? '', data_nascimento: cliente.data_nascimento ?? '',
      id_assessor: cliente.id_assessor ?? '', perfil_necessidade: cliente.perfil_necessidade ?? '',
    })
    setErroEdit(null)
    setEditar(true)
    if (assessores.length === 0) {
      supabase.from('assessores').select('id, nome').eq('ativo', true).order('nome')
        .then(({ data }) => setAssessores(data ?? []))
    }
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    setErroEdit(null)
    const payload = {
      ...formEdit,
      codigo: formEdit.codigo || null, telefone: formEdit.telefone || null,
      email: formEdit.email || null, data_nascimento: formEdit.data_nascimento || null,
    }
    const { error } = await supabase.from('clientes').update(payload).eq('id', id)
    if (error) return setErroEdit(error.message)
    setEditar(false)
    toast.ok('Dados do cliente atualizados.')
    carregar()
  }

  async function excluirCliente() {
    if (!window.confirm(`Excluir ${cliente.nome} e TODOS os seus dados (reuniões, apólices, documentos, tarefas)? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) return window.alert(`Erro ao excluir: ${error.message}`)
    navigate('/clientes')
  }

  if (!cliente) return <Spinner />

  return (
    <div>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Clientes
      </Link>

      {/* Cabeçalho do cliente */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
            {iniciais(cliente.nome)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">
              {cliente.nome}
              {cliente.codigo && <span className="ml-2 font-mono text-sm font-normal text-slate-400">{cliente.codigo}</span>}
            </h1>
            <p className="text-sm text-slate-500">
              Assessor: {cliente.assessores?.nome ?? '—'}
              {cliente.data_nascimento && ` · Nascimento: ${dataBR(cliente.data_nascimento)}`}
              {contato && (
                <> · Último contato: {contato.dias_sem_contato == null
                  ? 'nunca registrado'
                  : contato.dias_sem_contato === 0 ? 'hoje' : `há ${contato.dias_sem_contato} dia(s)`}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={cliente.status_funil}
              onChange={async (e) => {
                await supabase.from('clientes').update({ status_funil: e.target.value }).eq('id', id)
                carregar()
              }}
              style={{ width: 'auto' }}
            >
              {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </Select>
            {whatsapp(cliente.telefone) && (
              <a href={whatsapp(cliente.telefone)} target="_blank" rel="noreferrer">
                <Button variant="success"><MessageCircle size={16} /> WhatsApp</Button>
              </a>
            )}
            <Link to={`/proposta/${id}`}>
              <Button variant="secondary"><Presentation size={16} /> Gerar proposta</Button>
            </Link>
            <button onClick={abrirEdicao} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Editar cliente">
              <Pencil size={17} />
            </button>
          </div>
        </div>
        {cliente.perfil_necessidade && (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{cliente.perfil_necessidade}</p>
        )}
        {prioridade && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <Zap size={16} className="shrink-0 text-blue-600" />
            <span className="text-sm text-slate-700">
              <strong>Próxima ação:</strong> {prioridade.proxima_acao}
            </span>
            <span className="ml-auto">
              <Badge tom={prioridade.temperatura === 'quente' ? 'red' : prioridade.temperatura === 'morno' ? 'yellow' : 'slate'}>
                {prioridade.temperatura === 'quente' ? '🔥 quente' : prioridade.temperatura === 'morno' ? 'morno' : 'frio'}
              </Badge>
            </span>
          </div>
        )}
      </Card>

      {/* Modal de edição do cliente */}
      <Modal aberto={editar} titulo="Editar cliente" onFechar={() => setEditar(false)}>
        {formEdit && (
          <form onSubmit={salvarEdicao} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Campo label="Nome completo" obrigatorio>
                  <Input value={formEdit.nome} onChange={(e) => setFormEdit({ ...formEdit, nome: e.target.value })} required autoFocus />
                </Campo>
              </div>
              <Campo label="Código">
                <Input value={formEdit.codigo} onChange={(e) => setFormEdit({ ...formEdit, codigo: e.target.value })} placeholder="CLI-000" />
              </Campo>
            </div>
            <Campo label="Assessor" obrigatorio>
              <Select value={formEdit.id_assessor} onChange={(e) => setFormEdit({ ...formEdit, id_assessor: e.target.value })} required>
                <option value="">Selecione...</option>
                {assessores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Telefone (WhatsApp)">
                <Input value={formEdit.telefone} onChange={(e) => setFormEdit({ ...formEdit, telefone: e.target.value })} />
              </Campo>
              <Campo label="Data de nascimento">
                <Input type="date" value={formEdit.data_nascimento} onChange={(e) => setFormEdit({ ...formEdit, data_nascimento: e.target.value })} />
              </Campo>
            </div>
            <Campo label="E-mail">
              <Input type="email" value={formEdit.email} onChange={(e) => setFormEdit({ ...formEdit, email: e.target.value })} />
            </Campo>
            <Campo label="Perfil / necessidade">
              <Textarea value={formEdit.perfil_necessidade} onChange={(e) => setFormEdit({ ...formEdit, perfil_necessidade: e.target.value })} />
            </Campo>
            {erroEdit && <p className="text-sm text-red-600">{erroEdit}</p>}
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="danger" onClick={excluirCliente}>
                <Trash2 size={15} /> Excluir cliente
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditar(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Abas */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {ABAS.map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              aba === a ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {a}
          </button>
        ))}
      </div>

      {aba === 'Planejamento' && <AbaPlanejamento idCliente={id} />}
      {aba === 'Interações' && <AbaInteracoes idCliente={id} onMudanca={carregar} />}
      {aba === 'Reuniões' && <AbaReunioes idCliente={id} onMudanca={carregar} />}
      {aba === 'Apólices' && <AbaApolices idCliente={id} onMudanca={carregar} />}
      {aba === 'Comissões' && <AbaComissoes idCliente={id} cliente={cliente} />}
      {aba === 'Documentos' && <AbaDocumentos idCliente={id} />}
      {aba === 'Formulário' && <AbaFormulario idCliente={id} cliente={cliente} />}
      {aba === 'Tarefas' && <AbaTarefas idCliente={id} />}
      {aba === 'Histórico' && <AbaHistorico idCliente={id} cliente={cliente} />}
    </div>
  )
}

// ─── HISTÓRICO: linha do tempo do funil (gravada automaticamente) ────────────
function AbaHistorico({ idCliente, cliente }) {
  const [eventos, setEventos] = useState(null)

  useEffect(() => {
    supabase.from('historico_funil').select('*').eq('id_cliente', idCliente)
      .order('mudou_em', { ascending: false })
      .then(({ data }) => setEventos(data ?? []))
  }, [idCliente])

  if (!eventos) return <Spinner />

  return (
    <Card className="p-5">
      {cliente.motivo_perda && (
        <p className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          Motivo da perda registrado: {cliente.motivo_perda}
        </p>
      )}
      {eventos.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">Sem movimentações registradas.</p>
        : (
          <ol className="relative ml-3 space-y-4 border-l-2 border-slate-100 pl-5">
            {eventos.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                <p className="text-sm text-slate-800">
                  {e.etapa_anterior
                    ? <>Moveu de <strong>{etapaLabel(e.etapa_anterior)}</strong> para <strong>{etapaLabel(e.etapa_nova)}</strong></>
                    : <>Entrou no funil em <strong>{etapaLabel(e.etapa_nova)}</strong></>}
                </p>
                <p className="text-xs text-slate-400">{dataHoraBR(e.mudou_em)}</p>
              </li>
            ))}
          </ol>
        )}
    </Card>
  )
}

// ─── PLANEJAMENTO: os dados da reunião viram o estudo e a proposta ───────────
function AbaPlanejamento({ idCliente }) {
  const toast = useToast()
  const [plano, setPlano] = useState(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    supabase.from('planejamentos').select('*').eq('id_cliente', idCliente).maybeSingle()
      .then(({ data }) => setPlano(data ?? {
        id_cliente: idCliente, profissao: '', estado_civil: '', renda_mensal: '',
        custo_vida_mensal: '', patrimonio_total: '', dividas_total: '',
        num_dependentes: 0, anos_protecao: 10, capital_sugerido: '',
        objetivos: '', observacoes_reuniao: '',
      }))
  }, [idCliente])

  if (!plano) return <Spinner />

  const set = (k) => (e) => setPlano({ ...plano, [k]: e.target.value })

  async function salvar(e) {
    e.preventDefault()
    const payload = {
      ...plano,
      renda_mensal: plano.renda_mensal || null,
      custo_vida_mensal: plano.custo_vida_mensal || null,
      patrimonio_total: plano.patrimonio_total || null,
      dividas_total: plano.dividas_total || 0,
      capital_sugerido: plano.capital_sugerido || null, // vazio = banco calcula sozinho
      num_dependentes: plano.num_dependentes || 0,
      anos_protecao: plano.anos_protecao || 10,
    }
    const { data } = await supabase.from('planejamentos').upsert(payload, { onConflict: 'id_cliente' })
      .select().single()
    if (data) setPlano(data)
    setSalvo(true)
    toast.ok('Planejamento salvo.')
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm text-slate-500">
        Preencha com o que foi coletado na reunião. Se deixar o capital em branco,
        o sistema sugere automaticamente: <em>custo de vida × 12 × anos de proteção + dívidas</em>.
      </p>
      <form onSubmit={salvar} className="grid gap-4 md:grid-cols-3">
        <Campo label="Profissão"><Input value={plano.profissao ?? ''} onChange={set('profissao')} /></Campo>
        <Campo label="Estado civil">
          <Select value={plano.estado_civil ?? ''} onChange={set('estado_civil')}>
            <option value="">—</option>
            {['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Nº de dependentes">
          <Input type="number" min="0" value={plano.num_dependentes ?? 0} onChange={set('num_dependentes')} />
        </Campo>
        <Campo label="Renda mensal (R$)"><Input type="number" step="0.01" value={plano.renda_mensal ?? ''} onChange={set('renda_mensal')} /></Campo>
        <Campo label="Custo de vida mensal (R$)"><Input type="number" step="0.01" value={plano.custo_vida_mensal ?? ''} onChange={set('custo_vida_mensal')} /></Campo>
        <Campo label="Dívidas totais (R$)"><Input type="number" step="0.01" value={plano.dividas_total ?? ''} onChange={set('dividas_total')} /></Campo>
        <Campo label="Patrimônio total (R$)"><Input type="number" step="0.01" value={plano.patrimonio_total ?? ''} onChange={set('patrimonio_total')} /></Campo>
        <Campo label="Anos de proteção" dica="Horizonte usado no cálculo do capital">
          <Input type="number" min="1" value={plano.anos_protecao ?? 10} onChange={set('anos_protecao')} />
        </Campo>
        <Campo label="Capital segurado (R$)" dica="Deixe vazio para o cálculo automático">
          <Input type="number" step="0.01" value={plano.capital_sugerido ?? ''} onChange={set('capital_sugerido')} />
        </Campo>
        <div className="md:col-span-3">
          <Campo label="Objetivos do cliente">
            <Textarea value={plano.objetivos ?? ''} onChange={set('objetivos')}
              placeholder="Ex.: garantir a faculdade dos filhos, proteger a empresa, planejamento sucessório..." />
          </Campo>
        </div>
        <div className="md:col-span-3">
          <Campo label="Notas da reunião">
            <Textarea value={plano.observacoes_reuniao ?? ''} onChange={set('observacoes_reuniao')} rows={4} />
          </Campo>
        </div>
        <div className="flex items-center gap-3 md:col-span-3">
          <Button type="submit">Salvar planejamento</Button>
          {salvo && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={15} /> Salvo!</span>}
          {plano.capital_sugerido && (
            <span className="text-sm text-slate-500">Capital sugerido: <strong>{brl(plano.capital_sugerido)}</strong></span>
          )}
        </div>
      </form>
    </Card>
  )
}

// ─── INTERAÇÕES: linha do tempo de contatos com o cliente ────────────────────
const TIPO_INTERACAO = [
  { id: 'ligacao', label: '📞 Ligação' },
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'email', label: '✉️ E-mail' },
  { id: 'reuniao', label: '🤝 Reunião/Encontro' },
  { id: 'nota', label: '📝 Nota' },
]

function AbaInteracoes({ idCliente, onMudanca }) {
  const [itens, setItens] = useState(null)
  const [tipo, setTipo] = useState('ligacao')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() =>
    supabase.from('interacoes').select('*').eq('id_cliente', idCliente)
      .order('data', { ascending: false })
      .then(({ data }) => setItens(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  async function registrar(e) {
    e.preventDefault()
    if (!descricao.trim()) return
    setSalvando(true)
    await supabase.from('interacoes').insert({ id_cliente: idCliente, tipo, descricao: descricao.trim() })
    setDescricao('')
    setSalvando(false)
    carregar()
    onMudanca?.()
  }

  async function excluir(i) {
    if (!window.confirm('Excluir este registro de contato?')) return
    await supabase.from('interacoes').delete().eq('id', i.id)
    carregar()
    onMudanca?.()
  }

  if (!itens) return <Spinner />
  const label = (t) => TIPO_INTERACAO.find((x) => x.id === t)?.label ?? t

  return (
    <Card className="p-5">
      <form onSubmit={registrar} className="mb-5 flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Campo label="Tipo de contato">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPO_INTERACAO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </Campo>
        </div>
        <div className="min-w-0 flex-1">
          <Campo label="O que aconteceu?">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: cliente pediu para retornar após o dia 15..." />
          </Campo>
        </div>
        <Button type="submit" disabled={salvando}>Registrar</Button>
      </form>

      {itens.length === 0
        ? <p className="py-4 text-center text-sm text-slate-400">Nenhum contato registrado ainda.</p>
        : (
          <ol className="relative ml-3 space-y-4 border-l-2 border-slate-100 pl-5">
            {itens.map((i) => (
              <li key={i.id} className="group relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-800">{label(i.tipo)} — {i.descricao}</p>
                    <p className="text-xs text-slate-400">{dataHoraBR(i.data)}</p>
                  </div>
                  <button onClick={() => excluir(i)} className="rounded p-1 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
    </Card>
  )
}

// ─── REUNIÕES: agendar avança o funil sozinho; concluir também ───────────────
function AbaReunioes({ idCliente, onMudanca }) {
  const [reunioes, setReunioes] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ data_hora: '', notas: '' })

  const carregar = useCallback(() =>
    supabase.from('reunioes').select('*').eq('id_cliente', idCliente).order('data_hora', { ascending: false })
      .then(({ data }) => setReunioes(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  async function agendar(e) {
    e.preventDefault()
    await supabase.from('reunioes').insert({ id_cliente: idCliente, data_hora: form.data_hora, notas: form.notas || null })
    setModal(false)
    setForm({ data_hora: '', notas: '' })
    carregar(); onMudanca()
  }

  async function mudarStatus(r, status) {
    await supabase.from('reunioes').update({ status }).eq('id', r.id)
    carregar(); onMudanca()
  }

  async function excluir(r) {
    if (!window.confirm('Excluir esta reunião?')) return
    await supabase.from('reunioes').delete().eq('id', r.id)
    carregar(); onMudanca()
  }

  if (!reunioes) return <Spinner />

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Agendar move o cliente para <strong>Agendamento</strong>; marcar como realizada
          move para <strong>Reunião Realizada</strong> e cria a tarefa do estudo. Tudo automático.
        </p>
        <Button onClick={() => setModal(true)}><CalendarPlus size={16} /> Agendar reunião</Button>
      </div>

      {reunioes.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">Nenhuma reunião registrada.</p>
        : (
          <ul className="divide-y divide-slate-100">
            {reunioes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-32 text-sm font-medium text-slate-800">{dataHoraBR(r.data_hora)}</span>
                <Select value={r.status} onChange={(e) => mudarStatus(r, e.target.value)} style={{ width: 'auto' }}>
                  {STATUS_REUNIAO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{r.notas}</span>
                <button onClick={() => excluir(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir reunião">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

      <Modal aberto={modal} titulo="Agendar reunião" onFechar={() => setModal(false)}>
        <form onSubmit={agendar} className="space-y-4">
          <Campo label="Data e hora" obrigatorio>
            <Input type="datetime-local" value={form.data_hora}
              onChange={(e) => setForm({ ...form, data_hora: e.target.value })} required />
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
    </Card>
  )
}

// ─── APÓLICES: cadastrar a venda dispara toda a esteira de pós-venda ─────────
const APOLICE_VAZIA = {
  id_seguradora: '', numero_apolice: '', valor_premio_mensal: '',
  capital_segurado: '', percentual_comissao: '', data_vigencia: '',
}

function AbaApolices({ idCliente, onMudanca }) {
  const toast = useToast()
  const [apolices, setApolices] = useState(null)
  const [seguradoras, setSeguradoras] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(APOLICE_VAZIA)

  const carregar = useCallback(() =>
    supabase.from('apolices').select('*, seguradoras(nome)').eq('id_cliente', idCliente)
      .order('created_at', { ascending: false })
      .then(({ data }) => setApolices(data ?? [])), [idCliente])

  useEffect(() => {
    carregar()
    supabase.from('seguradoras').select('id, nome, comissao_padrao_percentual').eq('ativo', true).order('nome')
      .then(({ data }) => setSeguradoras(data ?? []))
  }, [carregar])

  function abrirNova() { setEditando(null); setForm(APOLICE_VAZIA); setModal(true) }
  function abrirEdicao(a) {
    setEditando(a.id)
    setForm({
      id_seguradora: a.id_seguradora, numero_apolice: a.numero_apolice ?? '',
      valor_premio_mensal: a.valor_premio_mensal, capital_segurado: a.capital_segurado,
      percentual_comissao: a.percentual_comissao ?? '', data_vigencia: a.data_vigencia,
    })
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    const payload = {
      id_seguradora: form.id_seguradora,
      numero_apolice: form.numero_apolice || null,
      valor_premio_mensal: form.valor_premio_mensal,
      capital_segurado: form.capital_segurado,
      percentual_comissao: form.percentual_comissao || null,
      data_vigencia: form.data_vigencia,
    }
    // Na edição NÃO reenviamos id_cliente (evita re-disparar a esteira de pós-venda)
    if (editando) {
      await supabase.from('apolices').update(payload).eq('id', editando)
      toast.ok('Apólice atualizada. Comissão recalculada.')
    } else {
      await supabase.from('apolices').insert({ ...payload, id_cliente: idCliente })
      toast.ok('Venda registrada! 🎉 Cliente fechado e pós-venda agendado.')
    }
    setModal(false)
    carregar(); onMudanca()
  }

  async function excluir(a) {
    if (!window.confirm(`Excluir a apólice de ${a.seguradoras?.nome ?? 'seguradora'} (${brl(a.valor_premio_mensal)}/mês)?`)) return
    await supabase.from('apolices').delete().eq('id', a.id)
    toast.ok('Apólice excluída.')
    carregar(); onMudanca()
  }

  if (!apolices) return <Spinner />

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Ao cadastrar a venda, o sistema fecha o cliente no funil, calcula a divisão
          da comissão, gera o formulário de onboarding e agenda o pós-venda. Zero trabalho manual.
        </p>
        <Button onClick={abrirNova}><FileSignature size={16} /> Registrar venda</Button>
      </div>

      {apolices.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">Nenhuma apólice ainda.</p>
        : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="py-2 pr-3 font-medium">Seguradora</th>
                <th className="py-2 pr-3 font-medium">Prêmio mensal</th>
                <th className="py-2 pr-3 font-medium">Capital</th>
                <th className="py-2 pr-3 font-medium">Comissão total</th>
                <th className="py-2 pr-3 font-medium">Natália / Assessor / Escritório</th>
                <th className="py-2 pr-3 font-medium">Vigência</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {apolices.map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="py-3 pr-3 font-medium text-slate-800">{a.seguradoras?.nome}</td>
                  <td className="py-3 pr-3">{brl(a.valor_premio_mensal)}</td>
                  <td className="py-3 pr-3">{brl(a.capital_segurado)}</td>
                  <td className="py-3 pr-3 font-semibold text-slate-800">{brl(a.comissao_gerada)}</td>
                  <td className="py-3 pr-3 text-slate-500">
                    {brl(a.comissao_natalia)} / {brl(a.comissao_assessor)} / {brl(a.comissao_escritorio)}
                  </td>
                  <td className="py-3 pr-3">{dataBR(a.data_vigencia)}</td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button onClick={() => abrirEdicao(a)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => excluir(a)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

      <Modal aberto={modal} titulo={editando ? 'Editar apólice' : 'Registrar venda 🎉'} onFechar={() => setModal(false)}>
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Seguradora" obrigatorio>
            <Select value={form.id_seguradora} required
              onChange={(e) => setForm({ ...form, id_seguradora: e.target.value })}>
              <option value="">Selecione...</option>
              {seguradoras.map((s) => (
                <option key={s.id} value={s.id}>{s.nome} (comissão padrão {s.comissao_padrao_percentual}%)</option>
              ))}
            </Select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Prêmio mensal (R$)" obrigatorio>
              <Input type="number" step="0.01" min="0" required value={form.valor_premio_mensal}
                onChange={(e) => setForm({ ...form, valor_premio_mensal: e.target.value })} />
            </Campo>
            <Campo label="Capital segurado (R$)" obrigatorio>
              <Input type="number" step="0.01" min="0" required value={form.capital_segurado}
                onChange={(e) => setForm({ ...form, capital_segurado: e.target.value })} />
            </Campo>
            <Campo label="Início de vigência" obrigatorio>
              <Input type="date" required value={form.data_vigencia}
                onChange={(e) => setForm({ ...form, data_vigencia: e.target.value })} />
            </Campo>
            <Campo label="% comissão" dica="Vazio = padrão da seguradora">
              <Input type="number" step="0.01" min="0" max="100" value={form.percentual_comissao}
                onChange={(e) => setForm({ ...form, percentual_comissao: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Nº da apólice">
            <Input value={form.numero_apolice} onChange={(e) => setForm({ ...form, numero_apolice: e.target.value })} />
          </Campo>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" variant="success">{editando ? 'Salvar alterações' : 'Confirmar venda'}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

// ─── DOCUMENTOS: anexos do cliente no Storage do Supabase ────────────────────
const CATEGORIAS_DOC = [
  { id: 'apolice', label: 'Apólice' },
  { id: 'documento', label: 'Documento pessoal' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'geral', label: 'Outro' },
]

function AbaDocumentos({ idCliente }) {
  const [docs, setDocs] = useState(null)
  const [categoria, setCategoria] = useState('apolice')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(() =>
    supabase.from('documentos').select('*').eq('id_cliente', idCliente)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocs(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  async function enviar(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite reenviar o mesmo arquivo depois
    if (!arquivo) return
    setErro(null)
    setEnviando(true)
    const caminho = `${idCliente}/${Date.now()}-${arquivo.name}`
    const up = await supabase.storage.from('documentos').upload(caminho, arquivo)
    if (up.error) {
      setErro(`Falha no upload: ${up.error.message}`)
      setEnviando(false)
      return
    }
    await supabase.from('documentos').insert({
      id_cliente: idCliente, nome: arquivo.name, categoria,
      caminho, tamanho_bytes: arquivo.size, tipo_mime: arquivo.type,
    })
    setEnviando(false)
    carregar()
  }

  async function baixar(doc) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.caminho, 120)
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function excluir(doc) {
    if (!window.confirm(`Excluir "${doc.nome}"?`)) return
    await supabase.storage.from('documentos').remove([doc.caminho])
    await supabase.from('documentos').delete().eq('id', doc.id)
    carregar()
  }

  const tamanho = (b) => {
    if (!b) return ''
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }
  const tomCat = { apolice: 'blue', documento: 'slate', proposta: 'green', geral: 'yellow' }

  if (!docs) return <Spinner />

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-500">Guarde aqui a apólice, documentos do cliente e propostas.</p>
        <div className="ml-auto flex items-center gap-2">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: 'auto' }}>
            {CATEGORIAS_DOC.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${enviando ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            <Upload size={16} /> {enviando ? 'Enviando...' : 'Enviar arquivo'}
            <input type="file" className="hidden" onChange={enviar} disabled={enviando} />
          </label>
        </div>
      </div>

      {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}

      {docs.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">Nenhum documento anexado ainda.</p>
        : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <FileText size={18} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <button onClick={() => baixar(d)} className="truncate text-left text-sm font-medium text-slate-800 hover:text-blue-700 hover:underline">
                    {d.nome}
                  </button>
                  <p className="text-xs text-slate-400">{tamanho(d.tamanho_bytes)} · {dataBR(d.created_at)}</p>
                </div>
                <Badge tom={tomCat[d.categoria] ?? 'slate'}>{CATEGORIAS_DOC.find((c) => c.id === d.categoria)?.label ?? d.categoria}</Badge>
                <button onClick={() => baixar(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Baixar">
                  <Download size={16} />
                </button>
                <button onClick={() => excluir(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
    </Card>
  )
}

// ─── FORMULÁRIO: link público de onboarding + respostas recebidas ────────────
function AbaFormulario({ idCliente, cliente }) {
  const [forms, setForms] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const carregar = useCallback(() =>
    supabase.from('formularios_onboarding').select('*').eq('id_cliente', idCliente)
      .order('enviado_em', { ascending: false })
      .then(({ data }) => setForms(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  async function gerar() {
    await supabase.from('formularios_onboarding').insert({ id_cliente: idCliente })
    carregar()
  }

  function copiar(f) {
    const url = `${window.location.origin}/f/${f.token}`
    navigator.clipboard.writeText(url)
    setCopiado(f.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  if (!forms) return <Spinner />

  const tomStatus = { pendente: 'slate', em_andamento: 'yellow', concluido: 'green' }
  const labelStatus = { pendente: 'Aguardando cliente', em_andamento: 'Preenchendo', concluido: 'Concluído ✓' }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          O cliente preenche pelo link, em etapas curtas, com progresso salvo automaticamente
          — pode parar e continuar depois sem perder nada.
        </p>
        <Button onClick={gerar}><ClipboardList size={16} /> Gerar novo link</Button>
      </div>

      {forms.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">
            Nenhum formulário — ele é criado automaticamente na primeira venda, ou gere um manualmente.
          </p>
        : forms.map((f) => (
          <div key={f.id} className="mb-3 rounded-lg border border-slate-100 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tom={tomStatus[f.status]}>{labelStatus[f.status]}</Badge>
              <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-500">
                {window.location.origin}/f/{f.token}
              </code>
              <Button variant="secondary" onClick={() => copiar(f)}>
                {copiado === f.id ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar link</>}
              </Button>
              {whatsapp(cliente.telefone) && (
                <a target="_blank" rel="noreferrer"
                  href={whatsapp(cliente.telefone,
                    `Olá ${cliente.nome.split(' ')[0]}! Para finalizarmos sua apólice, preencha seus dados neste link (leva poucos minutos e salva sozinho): ${window.location.origin}/f/${f.token}`)}>
                  <Button variant="success"><MessageCircle size={15} /> Enviar</Button>
                </a>
              )}
            </div>
            {f.status === 'concluido' && (
              <div className="mt-3 grid gap-1 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-2">
                {Object.entries(f.respostas ?? {}).map(([k, v]) => (
                  <p key={k} className="truncate">
                    <span className="text-slate-400">{k.replaceAll('_', ' ')}: </span>
                    <span className="text-slate-700">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
    </Card>
  )
}

// ─── TAREFAS do cliente ──────────────────────────────────────────────────────
function AbaTarefas({ idCliente }) {
  const [tarefas, setTarefas] = useState(null)

  const carregar = useCallback(() =>
    supabase.from('tarefas').select('*').eq('id_cliente', idCliente)
      .order('concluida').order('data_vencimento')
      .then(({ data }) => setTarefas(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  async function alternar(t) {
    await supabase.from('tarefas').update({
      concluida: !t.concluida,
      concluida_em: t.concluida ? null : new Date().toISOString(),
    }).eq('id', t.id)
    carregar()
  }

  if (!tarefas) return <Spinner />

  return (
    <Card className="p-5">
      {tarefas.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">Nenhuma tarefa para este cliente.</p>
        : (
          <ul className="space-y-2">
            {tarefas.map((t) => (
              <li key={t.id} className={`flex items-center gap-3 rounded-lg border p-3 ${
                t.concluida ? 'border-slate-100 opacity-50' : 'border-slate-200'}`}>
                <input type="checkbox" checked={t.concluida} onChange={() => alternar(t)}
                  className="h-4 w-4 accent-blue-600" />
                <span className="text-lg">{TIPO_TAREFA_ICONE[t.tipo] ?? '✔️'}</span>
                <div className="flex-1">
                  <p className={`text-sm ${t.concluida ? 'line-through' : 'text-slate-800'}`}>{t.titulo}</p>
                  <p className="text-xs text-slate-400">
                    vence {dataBR(t.data_vencimento)} {t.automatica && '· criada automaticamente'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
    </Card>
  )
}

// ─── COMISSÕES: extrato real do que o cliente gerou (planilhas importadas) ───
// Busca pelo vínculo direto (id_cliente) e também pelo nome, para pegar
// lançamentos importados antes do cliente existir no cadastro.
function AbaComissoes({ idCliente, cliente }) {
  const [linhas, setLinhas] = useState(null)

  useEffect(() => {
    async function carregar() {
      const [porId, porNome] = await Promise.all([
        supabase.from('comissoes_importadas')
          .select('competencia, seguradora, segmento, tipo_receita, producao, valor')
          .eq('id_cliente', idCliente),
        cliente?.nome
          ? supabase.from('comissoes_importadas')
              .select('competencia, seguradora, segmento, tipo_receita, producao, valor')
              .is('id_cliente', null).ilike('cliente_nome', cliente.nome.trim())
          : Promise.resolve({ data: [] }),
      ])
      setLinhas([...(porId.data ?? []), ...(porNome.data ?? [])])
    }
    carregar()
  }, [idCliente, cliente?.nome])

  if (!linhas) return <Spinner />
  if (linhas.length === 0) {
    return (
      <Card className="p-5">
        <p className="py-6 text-center text-sm text-slate-400">
          Nenhuma comissão importada para este cliente ainda. Elas aparecem aqui quando as
          planilhas das seguradoras forem importadas em <strong>Importar → Comissões</strong>.
        </p>
      </Card>
    )
  }

  const total = linhas.reduce((s, l) => s + Number(l.valor), 0)
  const porMes = new Map()
  for (const l of linhas) {
    const m = String(l.competencia).slice(0, 7)
    const acc = porMes.get(m) ?? { total: 0, n: 0, seguradoras: new Set() }
    acc.total += Number(l.valor)
    acc.n += 1
    acc.seguradoras.add(l.seguradora)
    porMes.set(m, acc)
  }
  const meses = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const mediaMensal = total / meses.length
  const mesBRLocal = (m) => new Date(`${m}-15`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">Comissões geradas por este cliente</h3>
        <div className="ml-auto flex flex-wrap gap-2">
          <Badge tom="blue">Total: {brl(total)}</Badge>
          <Badge tom="green">Média mensal: {brl(mediaMensal)}</Badge>
          <Badge>{meses.length} mês(es) com movimento</Badge>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <th className="py-2 font-medium">Mês</th>
              <th className="py-2 font-medium">Seguradora(s)</th>
              <th className="py-2 text-right font-medium">Lançamentos</th>
              <th className="py-2 text-right font-medium">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {meses.map(([m, acc]) => (
              <tr key={m} className="border-b border-slate-50">
                <td className="py-2.5 font-medium capitalize text-slate-800">{mesBRLocal(m)}</td>
                <td className="py-2.5 text-slate-500">{[...acc.seguradoras].join(', ')}</td>
                <td className="py-2.5 text-right text-slate-500">{acc.n}</td>
                <td className={`py-2.5 text-right font-semibold ${acc.total < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {brl(acc.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Extrato real vindo das planilhas das seguradoras. Valores negativos são estornos.
      </p>
    </Card>
  )
}
