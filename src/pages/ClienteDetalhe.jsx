import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MessageCircle, Presentation, Copy, Check, Printer,
  CalendarPlus, FileSignature, ClipboardList, Zap, Upload, FileText, Download, Trash2, Pencil,
  Phone, Mail, Handshake, StickyNote, Flame, ChartPie, HeartHandshake, RefreshCw, CheckCircle2,
  Users2, Wallet, Shield, Landmark, Sparkles, Plus, Baby, Archive, TrendingDown,
  ListChecks, Lightbulb, MessageSquareQuote, Clock3,
} from 'lucide-react'
import { ETAPAS_FORM, ROTULOS_FORM } from '../lib/formularioConfig'
import { supabase } from '../lib/supabase'
import { ETAPAS, etapaLabel, STATUS_REUNIAO } from '../lib/constants'
import { brl, brlCompacto, dataBR, dataHoraBR, whatsapp, iniciais } from '../lib/format'
import { calcularEstudo, normalizarFilhos, IDADE_INDEPENDENCIA, PILARES } from '../lib/estudo'
import { BLOCOS_ROTEIRO } from '../lib/roteiro'
import {
  Button, Card, Input, InputMoeda, Select, Textarea, Campo, Modal, Badge, Spinner, ComoFunciona,
} from '../components/ui'
import { useToast } from '../components/Toast'
import LinhaProtecao from '../components/LinhaProtecao'

const ABAS = [
  { nome: 'Planejamento', icone: ChartPie },
  { nome: 'Roteiro', icone: ListChecks },
  { nome: 'Interações', icone: MessageCircle },
  { nome: 'Reuniões', icone: CalendarPlus },
  { nome: 'Apólices', icone: FileSignature },
  { nome: 'Comissões', icone: Wallet },
  { nome: 'Documentos', icone: FileText },
  { nome: 'Formulário', icone: ClipboardList },
  { nome: 'Tarefas', icone: CheckCircle2 },
  { nome: 'Histórico', icone: RefreshCw },
]

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

  const [carteira, setCarteira] = useState(null)

  const carregar = useCallback(async () => {
    const [c, pr, ct, ap] = await Promise.all([
      supabase.from('clientes').select('*, assessores(nome, telefone)').eq('id', id).single(),
      supabase.from('vw_prioridades_classificadas').select('proxima_acao, temperatura, score').eq('id', id).maybeSingle(),
      supabase.from('vw_clientes_contato').select('dias_sem_contato, ultimo_contato').eq('id', id).maybeSingle(),
      supabase.from('apolices').select('valor_premio_mensal, capital_segurado, comissao_gerada, status').eq('id_cliente', id),
    ])
    setCliente(c.data)
    setPrioridade(pr.data)
    setContato(ct.data)
    // resumo de valor do cliente para o cabeçalho (só apólices ativas)
    const ativas = (ap.data ?? []).filter((a) => a.status === 'ativa')
    setCarteira({
      total: (ap.data ?? []).length,
      ativas: ativas.length,
      premio: ativas.reduce((s, a) => s + Number(a.valor_premio_mensal || 0), 0),
      capital: ativas.reduce((s, a) => s + Number(a.capital_segurado || 0), 0),
      comissao: (ap.data ?? []).reduce((s, a) => s + Number(a.comissao_gerada || 0), 0),
    })
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
            <Button variant="secondary" onClick={() => imprimirDossie(cliente, contato)}
              title="1 página com tudo: planejamento, apólices, últimas conversas e pendências — leve para a reunião">
              <FileText size={16} /> Dossiê
            </Button>
            <button onClick={abrirEdicao} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Editar cliente">
              <Pencil size={17} />
            </button>
          </div>
        </div>
        {/* Resumo de valor: o que este cliente representa na carteira */}
        {carteira && carteira.total > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              <FileSignature size={13} className="text-laranja-600" />
              <strong className="tabular text-slate-800">{carteira.ativas}</strong> apólice(s) ativa(s)
              {carteira.total > carteira.ativas && <span className="text-slate-400">de {carteira.total}</span>}
            </span>
            {carteira.premio > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                <Wallet size={13} className="text-laranja-600" />
                Prêmio ativo: <strong className="tabular text-slate-800">{brl(carteira.premio)}/mês</strong>
              </span>
            )}
            {carteira.capital > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                <Shield size={13} className="text-laranja-600" />
                Capital segurado: <strong className="tabular text-slate-800">{brlCompacto(carteira.capital)}</strong>
              </span>
            )}
            {carteira.comissao > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                <Sparkles size={13} className="text-laranja-600" />
                Comissão gerada: <strong className="tabular text-slate-800">{brl(carteira.comissao)}</strong>
              </span>
            )}
          </div>
        )}
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
                {prioridade.temperatura === 'quente' ? <><Flame size={12} className="inline -mt-0.5" /> quente</> : prioridade.temperatura === 'morno' ? 'morno' : 'frio'}
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
        {ABAS.map(({ nome, icone: Icone }) => (
          <button key={nome} onClick={() => setAba(nome)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              aba === nome ? 'border-laranja-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            <Icone size={15} className={aba === nome ? 'text-laranja-600' : 'text-slate-400'} />
            {nome}
          </button>
        ))}
      </div>

      {aba === 'Planejamento' && <AbaPlanejamento idCliente={id} />}
      {aba === 'Roteiro' && <AbaRoteiro idCliente={id} cliente={cliente} />}
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

// ─── PLANEJAMENTO: o estudo completo por pilares que vira a proposta ─────────
// Seções: família → vida financeira → 5 pilares (com sugestão calculada e
// botão "usar") → sucessão/inventário → objetivos. Tudo alimenta os slides.
const SECAO = 'mb-2 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 first:mt-0'

// Campo de pilar: valor com pontuação + sugestão calculada com botão "usar".
// Fica FORA da AbaPlanejamento: se fosse recriado a cada render, o React
// remontaria o input a cada tecla e o campo perderia o foco.
function CampoPilar({ pilar, estudo, plano, setPlano }) {
  const sugestao = estudo.sugestoes[pilar.id]
  const valorForm = plano[pilar.campo]
  const sugestaoArredondada = Math.round(sugestao * 100) / 100
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4">
      <p className="font-medium text-slate-800">{pilar.rotulo}</p>
      <p className="mb-3 mt-0.5 text-xs text-slate-400">{pilar.descricao}</p>
      <InputMoeda value={valorForm ?? ''}
        placeholder={sugestao > 0 ? Math.round(sugestao).toLocaleString('pt-BR') : '0'}
        onChange={(e) => setPlano({ ...plano, [pilar.campo]: e.target.value })} />
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-400" title={pilar.comoCalcula}>
          Sugestão: <strong className="text-slate-600">{pilar.porDia ? `${brl(sugestao)}/dia` : brlCompacto(sugestao)}</strong>
        </span>
        {sugestao > 0 && String(valorForm ?? '') === '' && (
          <span className="text-slate-300">em branco = usa a sugestão</span>
        )}
        {sugestao > 0 && String(valorForm ?? '') !== '' && Number(valorForm) !== sugestaoArredondada && (
          <button type="button" className="font-semibold text-blue-600 hover:underline"
            onClick={() => setPlano({ ...plano, [pilar.campo]: sugestaoArredondada })}>
            usar sugestão
          </button>
        )}
      </div>
    </div>
  )
}

function AbaPlanejamento({ idCliente }) {
  const toast = useToast()
  const [plano, setPlano] = useState(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    supabase.from('planejamentos').select('*').eq('id_cliente', idCliente).maybeSingle()
      .then(({ data }) => setPlano(data ?? {
        id_cliente: idCliente, profissao: '', estado_civil: '', renda_mensal: '',
        custo_vida_mensal: '', patrimonio_total: '', dividas_total: '',
        num_dependentes: 0, dependentes: [], anos_protecao: 10, capital_sugerido: '',
        objetivos: '', observacoes_reuniao: '',
      }))
  }, [idCliente])

  if (!plano) return <Spinner />

  const estudo = calcularEstudo(plano)
  const set = (k) => (e) => setPlano({ ...plano, [k]: e.target.value })
  // Colunas das migrações 014/015: só enviamos ao banco se já existirem
  const tem014 = 'capital_invalidez' in plano
  const tem015 = 'premio_estimado' in plano

  // Filhos: lista estruturada guardada na coluna jsonb `dependentes`
  // (formato [{nome, idade, custo_mensal}]) — o gasto some quando fazem 24
  const filhos = Array.isArray(plano.dependentes) ? plano.dependentes : []
  const setFilho = (i, campo, valor) =>
    setPlano({ ...plano, dependentes: filhos.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)) })
  const addFilho = () =>
    setPlano({ ...plano, dependentes: [...filhos, { nome: '', idade: '', custo_mensal: '' }] })
  const removerFilho = (i) =>
    setPlano({ ...plano, dependentes: filhos.filter((_, j) => j !== i) })

  async function salvar(e) {
    e.preventDefault()
    // limpa linhas vazias e normaliza os tipos antes de gravar o jsonb
    const filhosLimpos = filhos
      .filter((f) => String(f?.nome ?? '').trim() !== ''
        || (f?.idade !== '' && f?.idade != null) || Number(f?.custo_mensal) > 0)
      .map((f) => ({
        nome: String(f.nome ?? '').trim(),
        idade: f.idade === '' || f.idade == null ? null : Number(f.idade),
        custo_mensal: f.custo_mensal === '' || f.custo_mensal == null ? null : Number(f.custo_mensal),
      }))
    const idades = filhosLimpos.map((f) => f.idade).filter((i) => i != null)
    const payload = {
      id_cliente: idCliente,
      profissao: plano.profissao || null,
      estado_civil: plano.estado_civil || null,
      renda_mensal: plano.renda_mensal || null,
      custo_vida_mensal: plano.custo_vida_mensal || null,
      patrimonio_total: plano.patrimonio_total || null,
      dividas_total: plano.dividas_total || 0,
      capital_sugerido: plano.capital_sugerido || null, // vazio = banco calcula sozinho
      dependentes: filhosLimpos,
      num_dependentes: filhosLimpos.length > 0 ? filhosLimpos.length : (plano.num_dependentes || 0),
      anos_protecao: plano.anos_protecao || 10,
      objetivos: plano.objetivos || null,
      observacoes_reuniao: plano.observacoes_reuniao || null,
      ...(tem015 && { premio_estimado: plano.premio_estimado || null }),
      ...(tem014 && {
        capital_invalidez: plano.capital_invalidez || null,
        capital_doencas_graves: plano.capital_doencas_graves || null,
        dit_diaria: plano.dit_diaria || null,
        verba_sucessoria: plano.verba_sucessoria || null,
        cobertura_atual: plano.cobertura_atual || 0,
        itcmd_pct: plano.itcmd_pct ?? 4,
        custas_pct: plano.custas_pct ?? 8,
        conjuge_nome: plano.conjuge_nome || null,
        // texto-resumo das idades (mantém compatibilidade com telas antigas)
        filhos_idades: idades.length > 0
          ? `${idades.join(', ')} anos`
          : plano.filhos_idades || null,
      }),
    }
    const { data, error } = await supabase.from('planejamentos').upsert(payload, { onConflict: 'id_cliente' })
      .select().single()
    if (error) return toast.erro(`Erro ao salvar: ${error.message}`)
    if (data) setPlano(data)
    setSalvo(true)
    toast.ok('Planejamento salvo.')
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <Card className="p-5">
      <ComoFunciona id="planejamento" titulo="Como montar o planejamento">
        Preencha os dados que você levantou na reunião — renda, custo de vida, patrimônio, dívidas e os
        filhos. O sistema calcula sozinho os <strong>5 pilares da proteção</strong> e o capital ideal.
        Cada número aqui alimenta a <strong>proposta</strong> e a linha do tempo. Deixe um pilar em branco
        para usar a sugestão automática, ou digite o valor que você definiu.
      </ComoFunciona>
      <form onSubmit={salvar}>
        <p className={SECAO}><Users2 size={13} /> Família e perfil</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Campo label="Profissão"><Input value={plano.profissao ?? ''} onChange={set('profissao')} /></Campo>
          <Campo label="Estado civil">
            <Select value={plano.estado_civil ?? ''} onChange={set('estado_civil')}>
              <option value="">—</option>
              {['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </Campo>
          {tem014 ? (
            <Campo label="Cônjuge" dica="Aparece no estudo">
              <Input value={plano.conjuge_nome ?? ''} onChange={set('conjuge_nome')} />
            </Campo>
          ) : (
            <Campo label="Nº de dependentes">
              <Input type="number" min="0" value={plano.num_dependentes ?? 0} onChange={set('num_dependentes')} />
            </Campo>
          )}
        </div>

        {/* Filhos: quanto custam HOJE — o estudo garante o valor só até os 24 */}
        <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Baby size={15} className="text-laranja-600" /> Filhos — o gasto que tem prazo para acabar
            </p>
            <button type="button" onClick={addFilho}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800">
              <Plus size={13} /> Adicionar filho
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Informe quanto cada filho custa por mês hoje (escola, saúde, atividades...). Esse valor já
            faz parte do custo de vida — o estudo o separa e garante <strong>apenas até os {IDADE_INDEPENDENCIA} anos</strong>:
            depois disso ele deixa de existir e sai do capital.
          </p>
          {filhos.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
              Nenhum filho cadastrado — sem filhos, o custo de vida inteiro é projetado pelo horizonte do estudo.
            </p>
          )}
          {filhos.map((f, i) => {
            const info = normalizarFilhos({ dependentes: [f] }, estudo.anos)[0]
            return (
              <div key={i} className="mb-2 grid items-end gap-2 rounded-lg border border-slate-200/70 bg-white p-3 sm:grid-cols-[1fr_90px_1fr_auto]">
                <Campo label="Nome">
                  <Input value={f.nome ?? ''} placeholder="Nome do filho"
                    onChange={(e) => setFilho(i, 'nome', e.target.value)} />
                </Campo>
                <Campo label="Idade">
                  <Input type="number" min="0" max="40" value={f.idade ?? ''}
                    onChange={(e) => setFilho(i, 'idade', e.target.value)} />
                </Campo>
                <Campo label="Gasto mensal hoje">
                  <InputMoeda value={f.custo_mensal ?? ''} placeholder="0"
                    onChange={(e) => setFilho(i, 'custo_mensal', e.target.value)} />
                </Campo>
                <div className="flex items-center gap-2 pb-1">
                  <span className="whitespace-nowrap text-xs text-slate-400">
                    {info && info.idade != null
                      ? info.anosRestantes > 0
                        ? <>faltam <strong className="text-slate-600">{info.anosRestantes} anos</strong> até os {IDADE_INDEPENDENCIA}{info.capitalAte24 > 0 && <> · {brlCompacto(info.capitalAte24)}</>}</>
                        : <span className="text-emerald-600">já independente ✓</span>
                      : 'informe a idade'}
                  </span>
                  <button type="button" onClick={() => removerFilho(i)}
                    className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600" title="Remover filho">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
          {estudo.custoFilhosMensal > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Gasto com filhos hoje: <strong className="tabular text-slate-700">{brl(estudo.custoFilhosMensal)}/mês</strong>
              {' '}· reserva necessária até cada um fazer {IDADE_INDEPENDENCIA}:{' '}
              <strong className="tabular text-slate-700">{brlCompacto(estudo.capitalFilhos)}</strong>
              {' '}— já embutida na sugestão de proteção da família.
            </p>
          )}
        </div>

        <p className={SECAO}><Wallet size={13} /> Vida financeira</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Campo label="Renda mensal"><InputMoeda value={plano.renda_mensal ?? ''} onChange={set('renda_mensal')} /></Campo>
          <Campo label="Custo de vida mensal" dica={estudo.custoFilhosMensal > 0 ? `Inclui os ${brl(estudo.custoFilhosMensal)} dos filhos` : 'Quanto a família gasta por mês, no total'}>
            <InputMoeda value={plano.custo_vida_mensal ?? ''} onChange={set('custo_vida_mensal')} />
          </Campo>
          <Campo label="Dívidas totais"><InputMoeda value={plano.dividas_total ?? ''} onChange={set('dividas_total')} /></Campo>
          <Campo label="Patrimônio total" dica="Base do cálculo de inventário">
            <InputMoeda value={plano.patrimonio_total ?? ''} onChange={set('patrimonio_total')} />
          </Campo>
          <Campo label="Anos de proteção" dica="Horizonte do estudo">
            <Input type="number" min="1" value={plano.anos_protecao ?? 10} onChange={set('anos_protecao')} />
          </Campo>
          {tem014 && (
            <Campo label="Cobertura que já possui" dica="Seguros atuais — o estudo mostra o gap">
              <InputMoeda value={plano.cobertura_atual ?? ''} onChange={set('cobertura_atual')} />
            </Campo>
          )}
          {tem015 && (
            <Campo label="Prêmio cotado (por mês)" dica="Cotação nas seguradoras — vira o slide 'O investimento'">
              <InputMoeda value={plano.premio_estimado ?? ''} onChange={set('premio_estimado')} />
            </Campo>
          )}
        </div>

        <p className={SECAO}><Shield size={13} /> Os 5 pilares da proteção</p>
        {!tem014 && (
          <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
            Rode a migração <strong>014_planejamento_detalhado.sql</strong> no Supabase para liberar
            invalidez, doenças graves, DIT, sucessão e o gap de cobertura.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CampoPilar pilar={PILARES[0]} estudo={estudo} plano={plano} setPlano={setPlano} />
          {tem014 && PILARES.slice(1).map((p) => (
            <CampoPilar key={p.id} pilar={p} estudo={estudo} plano={plano} setPlano={setPlano} />
          ))}
        </div>

        {tem014 && (
          <>
            <p className={SECAO}><Landmark size={13} /> Sucessão — o custo do inventário</p>
            <div className="grid items-end gap-4 md:grid-cols-4">
              <Campo label="ITCMD do estado (%)" dica="RS 6 · PR 4 · SC até 8">
                <Input type="number" step="0.5" min="0" max="20" value={plano.itcmd_pct ?? 4} onChange={set('itcmd_pct')} />
              </Campo>
              <Campo label="Custas + honorários (%)" dica="Tipicamente 6–12%">
                <Input type="number" step="0.5" min="0" max="30" value={plano.custas_pct ?? 8} onChange={set('custas_pct')} />
              </Campo>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 md:col-span-2">
                <p className="text-xs uppercase text-slate-400">Custo estimado do inventário</p>
                <p className="font-display text-xl font-semibold text-slate-900 tabular-nums">
                  {brl(estudo.custoInventario)}
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    ({(estudo.itcmd + estudo.custas).toFixed(1).replace('.', ',')}% de {brlCompacto(estudo.patrimonio)})
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  É a liquidez que a família precisa ter <strong>em dinheiro</strong> para destravar os bens.
                  O seguro paga direto ao beneficiário, fora do inventário.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Inteligência do estudo: leituras que viram argumento de venda */}
        <div className="mt-6 rounded-xl border border-slate-200/70 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles size={13} className="text-laranja-600" /> Inteligência do estudo
            </p>
            <div className="flex items-center gap-2" title="Campos que sustentam uma proposta forte">
              <div className="h-1.5 w-24 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-laranja-500 transition-all"
                  style={{ width: `${(estudo.completude.feitos / estudo.completude.total) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-400">estudo {estudo.completude.feitos}/{estudo.completude.total}</span>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Autonomia da família hoje</p>
              <p className={`font-display text-lg font-semibold tabular-nums ${
                estudo.autonomiaAtualMeses != null && estudo.autonomiaAtualMeses < 24 ? 'text-red-600' : 'text-slate-900'}`}>
                {estudo.autonomiaAtualMeses == null ? '—'
                  : estudo.autonomiaAtualMeses >= 1200 ? 'vitalícia'
                  : `${estudo.autonomiaAtualMeses} meses`}
              </p>
              <p className="text-xs text-slate-400">se a renda parasse hoje, sem o plano</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Fôlego mensal</p>
              <p className={`font-display text-lg font-semibold tabular-nums ${
                (estudo.poupancaMensal ?? 0) < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {estudo.poupancaMensal == null ? '—' : brl(estudo.poupancaMensal)}
              </p>
              <p className="text-xs text-slate-400">
                renda − custo de vida{estudo.comprometimentoRenda != null ? ` · ${estudo.comprometimentoRenda}% comprometida` : ''}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Horizonte pelos filhos</p>
              {estudo.anosSugeridosPorFilhos ? (
                <>
                  <p className="font-display text-lg font-semibold tabular-nums text-slate-900">{estudo.anosSugeridosPorFilhos} anos</p>
                  <p className="text-xs text-slate-400">
                    até o mais novo fazer {IDADE_INDEPENDENCIA} —{' '}
                    {Number(plano.anos_protecao) !== estudo.anosSugeridosPorFilhos && (
                      <button type="button" className="font-semibold text-laranja-700 hover:underline"
                        onClick={() => setPlano({ ...plano, anos_protecao: estudo.anosSugeridosPorFilhos })}>
                        usar no estudo
                      </button>
                    )}
                    {Number(plano.anos_protecao) === estudo.anosSugeridosPorFilhos && 'aplicado ✓'}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold text-slate-300">—</p>
                  <p className="text-xs text-slate-400">cadastre os filhos com as idades acima</p>
                </>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Alavancagem do plano</p>
              {estudo.investimento?.alavancagem != null ? (
                <>
                  <p className="font-display text-lg font-semibold tabular-nums text-slate-900">1 → {estudo.investimento.alavancagem.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-slate-400">cada R$ 1/mês protege R$ {estudo.investimento.alavancagem.toLocaleString('pt-BR')}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold text-slate-300">—</p>
                  <p className="text-xs text-slate-400">preencha o prêmio cotado</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Linha do tempo: o custo garantido caindo em degraus até os 24 */}
        {estudo.custoFilhosMensal > 0 && estudo.custoVida > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200/70 bg-white p-4">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <TrendingDown size={13} className="text-laranja-600" /> Linha do tempo da proteção
            </p>
            <p className="mb-3 text-xs text-slate-400">
              O custo mensal que o plano garante cai em degraus: cada filho sai da conta ao
              fazer {IDADE_INDEPENDENCIA} anos, e o padrão de vida vale pelo horizonte do estudo.
              É o desenho de por que o capital é sob medida — mostre na reunião.
            </p>
            <LinhaProtecao estudo={estudo} />
          </div>
        )}

        {/* Resumo vivo do estudo */}
        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">Resumo do estudo (ao vivo)</p>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Proteção da família</p>
              <p className="font-semibold tabular-nums text-slate-900">{brlCompacto(estudo.valores.morte)}</p>
              {estudo.capitalFilhos > 0 ? (
                <p className="text-xs text-slate-500">
                  inclui {brlCompacto(estudo.capitalFilhos)} para os filhos até os {IDADE_INDEPENDENCIA}
                </p>
              ) : estudo.mesesProtegidos > 0 && (
                <p className="text-xs text-slate-500">{estudo.mesesProtegidos} meses de padrão de vida</p>
              )}
            </div>
            {tem014 && (
              <>
                <div>
                  <p className="text-xs text-slate-400">+ Sucessão (inventário)</p>
                  <p className="font-semibold tabular-nums text-slate-900">{brlCompacto(estudo.valores.sucessao)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Já possui de cobertura</p>
                  <p className="font-semibold tabular-nums text-slate-900">{brlCompacto(estudo.coberturaAtual)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Gap de proteção</p>
                  <p className={`font-semibold tabular-nums ${estudo.gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {estudo.gap > 0 ? brlCompacto(estudo.gap) : 'Coberto ✓'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <Campo label="Objetivos do cliente">
            <Textarea value={plano.objetivos ?? ''} onChange={set('objetivos')}
              placeholder="Ex.: garantir a faculdade dos filhos, proteger a empresa, planejamento sucessório..." />
          </Campo>
          <Campo label="Notas da reunião">
            <Textarea value={plano.observacoes_reuniao ?? ''} onChange={set('observacoes_reuniao')} rows={4} />
          </Campo>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit">Salvar planejamento</Button>
          {salvo && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={15} /> Salvo!</span>}
        </div>
      </form>
    </Card>
  )
}

// ─── ROTEIRO: o script consultivo que a consultora conduz na reunião ─────────
// Cada bloco tem falas, perguntas e um campo de anotação. O progresso e as
// notas ficam salvos no planejamento (coluna `roteiro`, migração 018).
function AbaRoteiro({ idCliente, cliente }) {
  const toast = useToast()
  const [plano, setPlano] = useState(null)
  const [roteiro, setRoteiro] = useState({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('planejamentos').select('*').eq('id_cliente', idCliente).maybeSingle()
      .then(({ data }) => {
        setPlano(data ?? { id_cliente: idCliente })
        setRoteiro(data?.roteiro?.blocos ?? {})
      })
  }, [idCliente])

  if (!plano) return <Spinner />

  const tem018 = plano.roteiro !== undefined
  const feitos = BLOCOS_ROTEIRO.filter((b) => roteiro[b.id]?.feito).length
  const setBloco = (id, campo, valor) =>
    setRoteiro((r) => ({ ...r, [id]: { ...r[id], [campo]: valor } }))

  async function salvar() {
    setSalvando(true)
    const payload = {
      id_cliente: idCliente,
      roteiro: { blocos: roteiro, atualizado_em: new Date().toISOString() },
    }
    const { error } = await supabase.from('planejamentos').upsert(payload, { onConflict: 'id_cliente' })
    setSalvando(false)
    if (error) return toast.erro(`Não foi possível salvar: ${error.message}`)
    toast.ok('Roteiro salvo.')
  }

  // Junta as anotações do roteiro numa nota de reunião consolidada
  async function consolidarNotas() {
    const linhas = BLOCOS_ROTEIRO
      .filter((b) => roteiro[b.id]?.nota?.trim())
      .map((b) => `• ${b.titulo}: ${roteiro[b.id].nota.trim()}`)
    if (linhas.length === 0) return toast.info('Sem anotações para consolidar ainda.')
    const texto = `Reunião de ${dataBR(new Date().toISOString())}\n${linhas.join('\n')}`
    const atual = plano.observacoes_reuniao ? `${plano.observacoes_reuniao}\n\n` : ''
    const { error } = await supabase.from('planejamentos')
      .upsert({ id_cliente: idCliente, observacoes_reuniao: atual + texto }, { onConflict: 'id_cliente' })
    if (error) return toast.erro(`Erro: ${error.message}`)
    toast.ok('Anotações levadas para as Notas da reunião (aba Planejamento).')
  }

  return (
    <Card className="p-5">
      {!tem018 && (
        <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
          Rode a migração <strong>018_roteiro_reuniao.sql</strong> no Supabase para que as anotações
          do roteiro fiquem salvas. Sem ela, o roteiro funciona como guia, mas não grava.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <ListChecks size={18} className="text-laranja-600" /> Roteiro da reunião
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Seu guia de conversa com {cliente.nome.split(' ')[0]} — conduza bloco a bloco e anote o que ouvir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2" title="Blocos concluídos">
            <div className="h-1.5 w-28 rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-laranja-500 transition-all"
                style={{ width: `${(feitos / BLOCOS_ROTEIRO.length) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-400">{feitos}/{BLOCOS_ROTEIRO.length}</span>
          </div>
          <Button variant="secondary" onClick={() => imprimirRoteiro(cliente, roteiro)}>
            <Printer size={15} /> Imprimir
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {BLOCOS_ROTEIRO.map((b, i) => {
          const estado = roteiro[b.id] ?? {}
          return (
            <div key={b.id} className={`rounded-xl border p-4 transition-colors ${
              estado.feito ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200/70 bg-white'}`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => setBloco(b.id, 'feito', !estado.feito)}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    estado.feito ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-emerald-400'}`}
                  title={estado.feito ? 'Concluído' : 'Marcar como feito'}>
                  <CheckCircle2 size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">{i + 1}</span>
                    <h4 className="font-semibold text-slate-900">{b.titulo}</h4>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                      <Clock3 size={11} /> {b.tempo}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{b.objetivo}</p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <MessageSquareQuote size={12} /> Como conduzir
                      </p>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {b.falas.map((f, j) => <li key={j} className="flex gap-1.5"><span className="text-laranja-400">›</span> {f}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Perguntas-chave</p>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {b.perguntas.map((p, j) => <li key={j} className="flex gap-1.5"><span className="text-laranja-400">?</span> {p}</li>)}
                      </ul>
                    </div>
                  </div>

                  {b.dica && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-laranja-100 bg-laranja-50/60 px-3 py-2 text-xs text-laranja-800">
                      <Lightbulb size={13} className="mt-0.5 shrink-0" /> {b.dica}
                    </p>
                  )}

                  <Textarea rows={2} className="mt-3" placeholder={`Anote o que o cliente disse em "${b.titulo}"...`}
                    value={estado.nota ?? ''} onChange={(e) => setBloco(b.id, 'nota', e.target.value)} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar roteiro'}</Button>
        <Button variant="secondary" onClick={consolidarNotas}>
          <StickyNote size={15} /> Levar anotações para as Notas da reunião
        </Button>
      </div>
    </Card>
  )
}

// Impressão do roteiro — leve para a reunião no papel, se preferir
function imprimirRoteiro(cliente, roteiro) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const blocos = BLOCOS_ROTEIRO.map((b, i) => `
    <h2>${i + 1}. ${esc(b.titulo)} <span class="tempo">${esc(b.tempo)}</span></h2>
    <p class="obj">${esc(b.objetivo)}</p>
    <p class="rot">Como conduzir</p>
    <ul>${b.falas.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="rot">Perguntas-chave</p>
    <ul>${b.perguntas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    ${roteiro[b.id]?.nota ? `<p class="nota"><strong>Anotações:</strong> ${esc(roteiro[b.id].nota)}</p>` : '<div class="linha"></div>'}
  `).join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Roteiro — ${esc(cliente.nome)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; }
      body { font: 12.5px/1.5 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; padding: 34px; }
      h1 { font-size: 19px; } .sub { color: #64748b; font-size: 11px; margin: 3px 0 14px; }
      h2 { font-size: 13px; color: #0f172a; margin: 16px 0 3px; }
      .tempo { font-size: 10px; color: #94a3b8; font-weight: 400; }
      .obj { color: #475569; font-size: 11.5px; margin-bottom: 5px; }
      .rot { font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: #d96527; font-weight: 700; margin-top: 6px; }
      ul { margin: 2px 0 4px 18px; } li { margin: 1px 0; }
      .nota { background: #f8fafc; border-left: 3px solid #d96527; padding: 5px 8px; margin-top: 5px; font-size: 11.5px; }
      .linha { border-bottom: 1px dashed #cbd5e1; height: 22px; margin-top: 4px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Roteiro de reunião — ${esc(cliente.nome)}</h1>
    <p class="sub">Hub Seguro de Vida · guia consultivo · ${new Date().toLocaleDateString('pt-BR')}</p>
    ${blocos}
    <script>window.onload = () => window.print()</script>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

// Ícones por tipo de tarefa automática (contato, revisão, pós-venda...)
const ICONE_TAREFA = {
  contato: Phone, agendamento: CalendarPlus, planejamento: ChartPie,
  formulario: ClipboardList, pos_venda: HeartHandshake, revisao: RefreshCw, geral: CheckCircle2,
}

// ─── INTERAÇÕES: linha do tempo de contatos com o cliente ────────────────────
const TIPO_INTERACAO = [
  { id: 'ligacao', label: 'Ligação', icone: Phone },
  { id: 'whatsapp', label: 'WhatsApp', icone: MessageCircle },
  { id: 'email', label: 'E-mail', icone: Mail },
  { id: 'reuniao', label: 'Reunião/Encontro', icone: Handshake },
  { id: 'nota', label: 'Nota', icone: StickyNote },
]

function AbaInteracoes({ idCliente, onMudanca }) {
  const toast = useToast()
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
    const { error } = await supabase.from('interacoes').insert({ id_cliente: idCliente, tipo, descricao: descricao.trim() })
    setSalvando(false)
    if (error) return toast.erro(`Não foi possível registrar: ${error.message}`)
    setDescricao('')
    toast.ok('Contato registrado.')
    carregar()
    onMudanca?.()
  }

  async function excluir(i) {
    if (!window.confirm('Excluir este registro de contato?')) return
    const { error } = await supabase.from('interacoes').delete().eq('id', i.id)
    if (error) return toast.erro(`Não foi possível excluir: ${error.message}`)
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
                <span className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-laranja-100 text-laranja-700">
                  {(() => { const Ic = TIPO_INTERACAO.find((x) => x.id === i.tipo)?.icone ?? StickyNote; return <Ic size={11} /> })()}
                </span>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-800"><span className="font-medium">{label(i.tipo)}</span> — {i.descricao}</p>
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
  const toast = useToast()
  const [reunioes, setReunioes] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ data_hora: '', notas: '' })

  const carregar = useCallback(() =>
    supabase.from('reunioes').select('*').eq('id_cliente', idCliente).order('data_hora', { ascending: false })
      .then(({ data }) => setReunioes(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  async function agendar(e) {
    e.preventDefault()
    const { error } = await supabase.from('reunioes').insert({ id_cliente: idCliente, data_hora: form.data_hora, notas: form.notas || null })
    if (error) return toast.erro(`Não foi possível agendar: ${error.message}`)
    setModal(false)
    setForm({ data_hora: '', notas: '' })
    toast.ok('Reunião agendada!')
    carregar(); onMudanca()
  }

  async function mudarStatus(r, status) {
    const { error } = await supabase.from('reunioes').update({ status }).eq('id', r.id)
    if (error) return toast.erro(`Não foi possível atualizar: ${error.message}`)
    carregar(); onMudanca()
  }

  async function excluir(r) {
    if (!window.confirm('Excluir esta reunião?')) return
    const { error } = await supabase.from('reunioes').delete().eq('id', r.id)
    if (error) return toast.erro(`Não foi possível excluir: ${error.message}`)
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
  status: 'ativa', motivo_cancelamento: '',
}

const STATUS_APOLICE = [
  { id: 'ativa', label: 'Ativa', tom: 'green' },
  { id: 'suspensa', label: 'Suspensa', tom: 'yellow' },
  { id: 'cancelada', label: 'Cancelada', tom: 'red' },
]

// Tabela de apólices — usada duas vezes na aba: novas (do Hub) e pré-sistema
function TabelaApolices({ apolices, preSistema = false, onEditar, onExcluir }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className={`border-b border-slate-100 text-xs uppercase text-slate-400 ${preSistema ? 'bg-slate-50/80' : 'bg-white'}`}>
            <th className="py-2.5 pl-4 pr-3 font-medium">Seguradora</th>
            <th className="py-2.5 pr-3 font-medium">Prêmio mensal</th>
            <th className="py-2.5 pr-3 font-medium">Capital</th>
            <th className="py-2.5 pr-3 font-medium">Comissão total</th>
            <th className="py-2.5 pr-3 font-medium">Natália / Assessor / Escritório</th>
            <th className="py-2.5 pr-3 font-medium">Vigência</th>
            <th className="py-2.5 pr-3 font-medium">Status</th>
            <th className="py-2.5 pr-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className={preSistema ? 'bg-slate-50/40' : 'bg-white'}>
          {apolices.map((a) => (
            <tr key={a.id} className={`border-b border-slate-50 last:border-0 ${a.status === 'cancelada' ? 'opacity-60' : ''}`}>
              <td className="py-3 pl-4 pr-3 font-medium text-slate-800">
                {a.seguradoras?.nome}
                {a.numero_apolice && <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">{a.numero_apolice}</span>}
                {a.tipo_produto && <p className="text-xs font-normal text-slate-400">{a.tipo_produto}</p>}
              </td>
              <td className="py-3 pr-3 tabular">{brl(a.valor_premio_mensal)}</td>
              <td className="py-3 pr-3 tabular">{Number(a.capital_segurado) > 0 ? brl(a.capital_segurado) : '—'}</td>
              <td className="py-3 pr-3 font-semibold tabular text-slate-800">{brl(a.comissao_gerada)}</td>
              <td className="py-3 pr-3 tabular text-slate-500">
                {brl(a.comissao_natalia)} / {brl(a.comissao_assessor)} / {brl(a.comissao_escritorio)}
              </td>
              <td className="py-3 pr-3">{dataBR(a.data_vigencia)}</td>
              <td className="py-3 pr-3">
                <Badge tom={STATUS_APOLICE.find((s) => s.id === a.status)?.tom ?? 'slate'}>
                  {STATUS_APOLICE.find((s) => s.id === a.status)?.label ?? a.status}
                </Badge>
                {a.status === 'cancelada' && a.motivo_cancelamento && (
                  <p className="mt-1 max-w-[180px] truncate text-xs text-slate-400" title={a.motivo_cancelamento}>
                    {a.motivo_cancelamento}
                  </p>
                )}
              </td>
              <td className="py-3 pr-2">
                <div className="flex gap-1">
                  <button onClick={() => onEditar(a)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => onExcluir(a)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
      status: a.status ?? 'ativa', motivo_cancelamento: a.motivo_cancelamento ?? '',
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
      status: form.status,
      // coluna da migração 012 — só envia quando ela já existe no banco
      // (com a lista vazia não dá para inspecionar; assume que a 012 rodou)
      ...((apolices.length === 0 || apolices.some((a) => 'motivo_cancelamento' in a))
        && { motivo_cancelamento: form.status === 'cancelada' ? (form.motivo_cancelamento || null) : null }),
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
          <>
            {/* Organização: as vendas feitas PELO Hub separadas do histórico
                importado das planilhas antigas (pré-sistema) */}
            {apolices.some((a) => !a.importada) && (
              <div className="mb-5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <FileSignature size={13} className="text-laranja-600" />
                  Novas apólices — registradas no Hub ({apolices.filter((a) => !a.importada).length})
                </p>
                <TabelaApolices apolices={apolices.filter((a) => !a.importada)}
                  onEditar={abrirEdicao} onExcluir={excluir} />
              </div>
            )}
            {apolices.some((a) => a.importada) && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Archive size={13} />
                  Apólices pré-sistema — histórico importado ({apolices.filter((a) => a.importada).length})
                </p>
                <TabelaApolices apolices={apolices.filter((a) => a.importada)} preSistema
                  onEditar={abrirEdicao} onExcluir={excluir} />
                <p className="mt-2 text-xs text-slate-400">
                  Vieram das planilhas antigas via <strong>Importar</strong> — valem como memória do
                  atendimento e não disparam as automações de pós-venda.
                </p>
              </div>
            )}
          </>
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
            <Campo label="Prêmio mensal" obrigatorio>
              <InputMoeda required value={form.valor_premio_mensal}
                onChange={(e) => setForm({ ...form, valor_premio_mensal: e.target.value })} />
            </Campo>
            <Campo label="Capital segurado" obrigatorio>
              <InputMoeda required value={form.capital_segurado}
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
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nº da apólice">
              <Input value={form.numero_apolice} onChange={(e) => setForm({ ...form, numero_apolice: e.target.value })} />
            </Campo>
            <Campo label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_APOLICE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Campo>
          </div>
          {form.status === 'cancelada' && (
            <Campo label="Motivo do cancelamento" dica="Fica no histórico do cliente — ajuda o pós-venda">
              <Input value={form.motivo_cancelamento} placeholder="Ex.: inadimplência, troca de seguradora..."
                onChange={(e) => setForm({ ...form, motivo_cancelamento: e.target.value })} />
            </Campo>
          )}
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
// Dossiê pré-reunião: 1 página com o retrato completo do cliente — perfil,
// estudo de proteção, apólices, últimas conversas e pendências. É a folha
// que a consultora imprime (ou abre no celular) antes de qualquer reunião.
async function imprimirDossie(cliente, contato) {
  const [pl, ap, inter, tar, forms] = await Promise.all([
    supabase.from('planejamentos').select('*').eq('id_cliente', cliente.id).maybeSingle(),
    supabase.from('apolices').select('*, seguradoras(nome)').eq('id_cliente', cliente.id).order('data_vigencia', { ascending: false }),
    supabase.from('interacoes').select('tipo, descricao, data').eq('id_cliente', cliente.id).order('data', { ascending: false }).limit(5),
    supabase.from('tarefas').select('titulo, data_vencimento').eq('id_cliente', cliente.id).eq('concluida', false).order('data_vencimento').limit(6),
    supabase.from('formularios_onboarding').select('status').eq('id_cliente', cliente.id).order('enviado_em', { ascending: false }).limit(1),
  ])
  const plano = pl.data
  const estudo = plano ? calcularEstudo(plano) : null
  const apolices = ap.data ?? []
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const statusForm = forms.data?.[0]?.status
  const dpsLabel = statusForm === 'concluido' ? '✓ DPS/formulário concluído'
    : statusForm ? '⏳ DPS/formulário em preenchimento' : '✗ DPS/formulário ainda não enviado'

  const linhaAp = (a) => `<tr>
    <td>${esc(a.seguradoras?.nome ?? '—')}</td><td>${esc(a.tipo_produto ?? '—')}</td>
    <td class="num">${brl(a.valor_premio_mensal)}/mês</td><td>${dataBR(a.data_vigencia)}</td>
    <td>${a.importada ? 'Pré-sistema' : 'Hub'}</td>
    <td>${a.status === 'ativa' ? 'Ativa' : a.status === 'cancelada' ? `Cancelada${a.motivo_cancelamento ? ` — ${esc(a.motivo_cancelamento)}` : ''}` : 'Suspensa'}</td></tr>`

  const filhosDossie = estudo?.filhos?.length
    ? estudo.filhos.map((f) => `${esc(f.nome || 'filho(a)')}${f.idade != null ? ` (${f.idade})` : ''}${
      f.custoMensal > 0 ? ` — ${brl(f.custoMensal)}/mês até os 24` : ''}`).join(' · ')
    : (plano?.filhos_idades ? esc(plano.filhos_idades) : null)

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Dossiê — ${esc(cliente.nome)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; }
      body { font: 12px/1.45 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; padding: 30px; }
      h1 { font-size: 18px; } .sub { color: #64748b; font-size: 11px; margin: 2px 0 12px; }
      h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #475569;
        border-bottom: 2px solid #e2e8f0; padding-bottom: 3px; margin: 14px 0 6px; }
      table { width: 100%; border-collapse: collapse; }
      td, th { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; text-align: left; vertical-align: top; }
      th { font-size: 9.5px; text-transform: uppercase; color: #94a3b8; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .celula { border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px; }
      .celula p { font-size: 10px; text-transform: uppercase; color: #94a3b8; }
      .celula b { font-size: 13.5px; }
      .aviso { border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; padding: 7px 10px; font-size: 11.5px; margin-top: 8px; }
      .muted { color: #94a3b8; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Dossiê — ${esc(cliente.nome)} ${cliente.codigo ? `<span class="muted">· ${esc(cliente.codigo)}</span>` : ''}</h1>
    <p class="sub">
      ${esc(cliente.assessores?.nome ? `Assessor: ${cliente.assessores.nome}` : 'Sem assessor')}
      ${cliente.telefone ? ` · ${esc(cliente.telefone)}` : ''}
      ${cliente.data_nascimento ? ` · Nascimento: ${dataBR(cliente.data_nascimento)}` : ''}
      · Último contato: ${contato?.dias_sem_contato == null ? 'nunca registrado' : contato.dias_sem_contato === 0 ? 'hoje' : `há ${contato.dias_sem_contato} dia(s)`}
      · ${dpsLabel}
    </p>

    ${estudo ? `<h2>Estudo de proteção</h2>
    <div class="grade">
      <div class="celula"><p>Renda</p><b>${estudo.renda > 0 ? brl(estudo.renda) : '—'}</b></div>
      <div class="celula"><p>Custo de vida</p><b>${estudo.custoVida > 0 ? brl(estudo.custoVida) : '—'}</b></div>
      <div class="celula"><p>Patrimônio</p><b>${estudo.patrimonio > 0 ? brlCompacto(estudo.patrimonio) : '—'}</b></div>
      <div class="celula"><p>Dívidas</p><b>${estudo.dividas > 0 ? brlCompacto(estudo.dividas) : '—'}</b></div>
      <div class="celula"><p>Proteção família</p><b>${brlCompacto(estudo.valores.morte)}</b></div>
      <div class="celula"><p>Doenças graves</p><b>${brlCompacto(estudo.valores.doencas_graves)}</b></div>
      <div class="celula"><p>Sucessão</p><b>${brlCompacto(estudo.valores.sucessao)}</b></div>
      <div class="celula"><p>Gap vs atual</p><b>${estudo.gap > 0 ? brlCompacto(estudo.gap) : 'Coberto ✓'}</b></div>
    </div>
    ${filhosDossie ? `<p style="margin-top:6px"><strong>Filhos:</strong> ${filhosDossie}</p>` : ''}
    ${plano.objetivos ? `<p style="margin-top:6px"><strong>Objetivos:</strong> ${esc(plano.objetivos)}</p>` : ''}
    ${plano.observacoes_reuniao ? `<p style="margin-top:3px"><strong>Notas da última reunião:</strong> ${esc(plano.observacoes_reuniao)}</p>` : ''}`
    : '<div class="aviso">Planejamento ainda não preenchido — colete os dados na reunião (renda, custo de vida, patrimônio, dívidas, família).</div>'}

    <h2>Apólices (${apolices.length})</h2>
    ${apolices.length ? `<table><tr><th>Seguradora</th><th>Produto</th><th>Prêmio</th><th>Emissão</th><th>Origem</th><th>Status</th></tr>
      ${apolices.map(linhaAp).join('')}</table>` : '<p class="muted">Nenhuma apólice ainda — cliente em prospecção.</p>'}

    <h2>Últimas conversas</h2>
    ${(inter.data ?? []).length ? `<table>${inter.data.map((i) => `<tr>
      <td style="white-space:nowrap">${dataBR(i.data)}</td><td>${esc(i.tipo)}</td><td>${esc(i.descricao ?? '')}</td></tr>`).join('')}</table>`
      : '<p class="muted">Nenhuma interação registrada.</p>'}

    <h2>Pendências abertas</h2>
    ${(tar.data ?? []).length ? `<table>${tar.data.map((t) => `<tr>
      <td style="white-space:nowrap">${t.data_vencimento ? dataBR(t.data_vencimento) : '—'}</td><td>${esc(t.titulo)}</td></tr>`).join('')}</table>`
      : '<p class="muted">Nenhuma tarefa pendente. ✓</p>'}

    <p class="sub" style="margin-top:14px">Gerado pelo Hub Seguro de Vida em ${new Date().toLocaleString('pt-BR')} · uso interno</p>
    <script>window.onload = () => window.print()</script>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

// Impressão da DPS: documento limpo, agrupado pelas seções do formulário,
// com os "sim" destacados — pronto para transcrever ao portal da seguradora.
function imprimirDPS(cliente, respostas) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fmt = (v) => {
    if (v === 'sim') return '<strong class="sim">SIM</strong>'
    if (v === 'nao') return 'Não'
    if (Array.isArray(v)) return esc(v.map((b) => `${b.nome ?? ''} (${b.relacao ?? ''}, ${b.percentual ?? ''}%)`).join(' · '))
    return esc(String(v))
  }
  const altura = Number(respostas.altura_cm), peso = Number(respostas.peso_kg)
  const imc = altura > 0 && peso > 0 ? (peso / ((altura / 100) ** 2)).toFixed(1) : null
  const secoes = ETAPAS_FORM.map((etapa) => {
    const linhas = etapa.campos
      .filter((c) => respostas[c.id] !== undefined && respostas[c.id] !== '' && respostas[c.id] !== null)
      .map((c) => `<tr><td class="q">${esc(c.rotulo ?? c.id)}</td><td>${fmt(respostas[c.id])}</td></tr>`)
      .join('')
    return linhas ? `<h2>${esc(etapa.titulo)}</h2><table>${linhas}</table>` : ''
  }).join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>DPS — ${esc(cliente.nome)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; }
      body { font: 12.5px/1.5 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; padding: 36px; }
      h1 { font-size: 19px; }
      .sub { color: #64748b; font-size: 11px; margin: 3px 0 6px; }
      .imc { display: inline-block; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; font-size: 12px; margin-bottom: 8px; }
      h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #475569;
        border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin: 18px 0 6px; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 4.5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      td.q { width: 62%; color: #475569; }
      .sim { color: #dc2626; }
      .rodape { margin-top: 24px; color: #94a3b8; font-size: 10px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Declaração Pessoal de Saúde — ${esc(cliente.nome)}</h1>
    <p class="sub">Respostas do formulário do Hub · geradas em ${new Date().toLocaleString('pt-BR')} · uso interno para transcrição à seguradora</p>
    ${imc ? `<span class="imc">Altura ${esc(respostas.altura_cm)} cm · Peso ${esc(respostas.peso_kg)} kg · <strong>IMC ${imc}</strong></span>` : ''}
    ${secoes}
    <p class="rodape">Declarações prestadas pelo próprio cliente pelo link seguro do formulário. Respostas "SIM" destacadas em vermelho exigem detalhamento junto à seguradora.</p>
    <script>window.onload = () => window.print()</script>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

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
              <>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    {Object.keys(f.respostas ?? {}).length} respostas ·{' '}
                    {Object.values(f.respostas ?? {}).filter((v) => v === 'sim').length} "sim" declarados
                  </p>
                  <Button variant="secondary" onClick={() => imprimirDPS(cliente, f.respostas ?? {})}
                    title="Documento limpo para transcrever a DPS ao portal da seguradora">
                    <Printer size={15} /> Imprimir DPS
                  </Button>
                </div>
                <div className="mt-2 grid gap-1 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-2">
                  {Object.entries(f.respostas ?? {}).map(([k, v]) => (
                    <p key={k} className="truncate" title={ROTULOS_FORM[k] ?? k}>
                      <span className="text-slate-400">{ROTULOS_FORM[k] ?? k.replaceAll('_', ' ')}: </span>
                      <span className={v === 'sim' ? 'font-semibold text-red-600' : 'text-slate-700'}>
                        {typeof v === 'object' ? JSON.stringify(v) : v === 'sim' ? 'SIM' : v === 'nao' ? 'Não' : String(v)}
                      </span>
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
    </Card>
  )
}

// ─── TAREFAS do cliente ──────────────────────────────────────────────────────
function AbaTarefas({ idCliente }) {
  const toast = useToast()
  const [tarefas, setTarefas] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() =>
    supabase.from('tarefas').select('*').eq('id_cliente', idCliente)
      .order('concluida').order('data_vencimento')
      .then(({ data }) => setTarefas(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  async function criar(e) {
    e.preventDefault()
    if (!titulo.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('tarefas').insert({
      id_cliente: idCliente, titulo: titulo.trim(), tipo: 'geral',
      data_vencimento: vencimento || undefined, automatica: false,
    })
    setSalvando(false)
    if (error) return toast.erro(`Não foi possível criar: ${error.message}`)
    setTitulo(''); setVencimento('')
    toast.ok('Tarefa criada.')
    carregar()
  }

  async function alternar(t) {
    const { error } = await supabase.from('tarefas').update({
      concluida: !t.concluida,
      concluida_em: t.concluida ? null : new Date().toISOString(),
    }).eq('id', t.id)
    if (error) return toast.erro(`Erro: ${error.message}`)
    carregar()
  }

  async function excluir(t) {
    if (!window.confirm(`Excluir a tarefa "${t.titulo}"?`)) return
    const { error } = await supabase.from('tarefas').delete().eq('id', t.id)
    if (error) return toast.erro(`Erro: ${error.message}`)
    carregar()
  }

  if (!tarefas) return <Spinner />

  return (
    <Card className="p-5">
      <form onSubmit={criar} className="mb-5 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Campo label="Nova tarefa">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: retornar ligação, enviar cotação, cobrar a DPS..." />
          </Campo>
        </div>
        <div className="w-44">
          <Campo label="Vence em">
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </Campo>
        </div>
        <Button type="submit" disabled={salvando}><Plus size={15} /> Adicionar</Button>
      </form>

      {tarefas.length === 0
        ? <p className="py-6 text-center text-sm text-slate-400">Nenhuma tarefa para este cliente. Crie a primeira acima.</p>
        : (
          <ul className="space-y-2">
            {tarefas.map((t) => (
              <li key={t.id} className={`group flex items-center gap-3 rounded-lg border p-3 ${
                t.concluida ? 'border-slate-100 opacity-50' : 'border-slate-200'}`}>
                <input type="checkbox" checked={t.concluida} onChange={() => alternar(t)}
                  className="h-4 w-4 accent-blue-600" />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  {(() => { const Ic = ICONE_TAREFA[t.tipo] ?? CheckCircle2; return <Ic size={15} /> })()}
                </span>
                <div className="flex-1">
                  <p className={`text-sm ${t.concluida ? 'line-through' : 'text-slate-800'}`}>{t.titulo}</p>
                  <p className="text-xs text-slate-400">
                    vence {dataBR(t.data_vencimento)} {t.automatica && '· criada automaticamente'}
                  </p>
                </div>
                <button onClick={() => excluir(t)} className="rounded p-1.5 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100" title="Excluir">
                  <Trash2 size={14} />
                </button>
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
