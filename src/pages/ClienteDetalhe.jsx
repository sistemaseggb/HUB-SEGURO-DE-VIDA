import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, MessageCircle, Presentation, Copy, Check,
  CalendarPlus, FileSignature, ClipboardList, Zap, Upload, FileText, Download, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS, etapaLabel, STATUS_REUNIAO, TIPO_TAREFA_ICONE } from '../lib/constants'
import { brl, dataBR, dataHoraBR, whatsapp, iniciais } from '../lib/format'
import {
  Button, Card, Input, Select, Textarea, Campo, Modal, Badge, Spinner,
} from '../components/ui'

const ABAS = ['Planejamento', 'Reuniões', 'Apólices', 'Documentos', 'Formulário', 'Tarefas', 'Histórico']

export default function ClienteDetalhe() {
  const { id } = useParams()
  const [cliente, setCliente] = useState(null)
  const [aba, setAba] = useState('Planejamento')

  const [prioridade, setPrioridade] = useState(null)

  const carregar = useCallback(async () => {
    const [c, pr] = await Promise.all([
      supabase.from('clientes').select('*, assessores(nome, telefone)').eq('id', id).single(),
      supabase.from('vw_prioridades_classificadas').select('proxima_acao, temperatura, score').eq('id', id).maybeSingle(),
    ])
    setCliente(c.data)
    setPrioridade(pr.data)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

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

      {/* Abas */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {ABAS.map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              aba === a ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {a}
          </button>
        ))}
      </div>

      {aba === 'Planejamento' && <AbaPlanejamento idCliente={id} />}
      {aba === 'Reuniões' && <AbaReunioes idCliente={id} onMudanca={carregar} />}
      {aba === 'Apólices' && <AbaApolices idCliente={id} onMudanca={carregar} />}
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
function AbaApolices({ idCliente, onMudanca }) {
  const [apolices, setApolices] = useState(null)
  const [seguradoras, setSeguradoras] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    id_seguradora: '', numero_apolice: '', valor_premio_mensal: '',
    capital_segurado: '', percentual_comissao: '', data_vigencia: '',
  })

  const carregar = useCallback(() =>
    supabase.from('apolices').select('*, seguradoras(nome)').eq('id_cliente', idCliente)
      .order('created_at', { ascending: false })
      .then(({ data }) => setApolices(data ?? [])), [idCliente])

  useEffect(() => {
    carregar()
    supabase.from('seguradoras').select('id, nome, comissao_padrao_percentual').eq('ativo', true).order('nome')
      .then(({ data }) => setSeguradoras(data ?? []))
  }, [carregar])

  async function vender(e) {
    e.preventDefault()
    await supabase.from('apolices').insert({
      id_cliente: idCliente,
      id_seguradora: form.id_seguradora,
      numero_apolice: form.numero_apolice || null,
      valor_premio_mensal: form.valor_premio_mensal,
      capital_segurado: form.capital_segurado,
      percentual_comissao: form.percentual_comissao || null,
      data_vigencia: form.data_vigencia,
    })
    setModal(false)
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
        <Button onClick={() => setModal(true)}><FileSignature size={16} /> Registrar venda</Button>
      </div>

      {apolices.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">Nenhuma apólice ainda.</p>
        : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="py-2 pr-3 font-medium">Seguradora</th>
                <th className="py-2 pr-3 font-medium">Prêmio mensal</th>
                <th className="py-2 pr-3 font-medium">Capital</th>
                <th className="py-2 pr-3 font-medium">Comissão total</th>
                <th className="py-2 pr-3 font-medium">Natália / Assessor / Escritório</th>
                <th className="py-2 font-medium">Vigência</th>
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
                  <td className="py-3">{dataBR(a.data_vigencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      <Modal aberto={modal} titulo="Registrar venda 🎉" onFechar={() => setModal(false)}>
        <form onSubmit={vender} className="space-y-4">
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
            <Button type="submit" variant="success">Confirmar venda</Button>
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
