import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MessageCircle, Presentation, Copy, Check, Printer,
  CalendarPlus, FileSignature, ClipboardList, Zap, Upload, FileText, Download, Trash2, Pencil,
  Phone, Mail, Handshake, StickyNote, Flame, ChartPie, HeartHandshake, RefreshCw, CheckCircle2,
  Users2, Wallet, Shield, Landmark, Sparkles, Plus, Baby, Archive, TrendingDown, TrendingUp,
  ListChecks, Lightbulb, MessageSquareQuote, Clock3,
  Building2, PiggyBank, Coins, HeartPulse, Ambulance, AlertTriangle, FileAudio, Scale, Hourglass,
} from 'lucide-react'
import { ETAPAS_FORM, ROTULOS_FORM } from '../lib/formularioConfig'
import { supabase } from '../lib/supabase'
import { ETAPAS, etapaLabel, STATUS_REUNIAO } from '../lib/constants'
import { brl, brlCompacto, dataBR, dataHoraBR, whatsapp, iniciais, localParaISO } from '../lib/format'
import {
  calcularEstudo, normalizarFilhos, IDADE_INDEPENDENCIA, MESES_VITALICIO,
  COBERTURAS, GRUPOS_COBERTURA, TIPOS_PLANEJAMENTO, FOCOS, CLASSES_PATRIMONIO,
  porqueCobertura,
} from '../lib/estudo'
import { BLOCOS_ROTEIRO } from '../lib/roteiro'
import {
  Button, Card, Input, InputMoeda, Select, Textarea, Campo, Modal, Badge, Spinner, ComoFunciona,
} from '../components/ui'
import { useToast } from '../components/toastContexto'
import LinhaProtecao from '../components/LinhaProtecao'
import MapaPatrimonio from '../components/MapaPatrimonio'
import AbaTranscricao from './AbaTranscricao'
import AbaComparador from './AbaComparador'
import AbaAnalise from './AbaAnalise'

const ABAS = [
  { nome: 'Planejamento', icone: ChartPie },
  { nome: 'Comparador', icone: Scale },
  { nome: 'Roteiro', icone: ListChecks },
  { nome: 'Transcrição', icone: FileAudio },
  { nome: 'Interações', icone: MessageCircle },
  { nome: 'Reuniões', icone: CalendarPlus },
  { nome: 'Em análise', icone: Hourglass },
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
    // Cliente que não existe (link antigo, cliente excluído noutra aba) não
    // pode virar carregando eterno: marcamos explicitamente para a tela avisar.
    setCliente(c.data ?? (c.error ? 'nao-encontrado' : null))
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

  if (cliente === 'nao-encontrado') {
    return (
      <div>
        <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Clientes
        </Link>
        <Card className="p-8 text-center">
          <p className="font-semibold text-slate-800">Cliente não encontrado</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Este cliente não existe mais ou o link está desatualizado. Volte para a lista e
            procure pelo nome.
          </p>
          <Link to="/clientes" className="mt-4 inline-block">
            <Button variant="secondary">Ver todos os clientes</Button>
          </Link>
        </Card>
      </div>
    )
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
          {/* flex-wrap: no celular esta fileira (etapa + 4 botões) media 615px
              num visor de 375 e empurrava a página inteira para o lado */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Select
              aria-label="Etapa do funil"
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
            {erroEdit && <p className="text-sm text-red-700">{erroEdit}</p>}
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

      {aba === 'Planejamento' && <AbaPlanejamento idCliente={id} cliente={cliente} />}
      {aba === 'Comparador' && <AbaComparador idCliente={id} cliente={cliente} />}
      {aba === 'Roteiro' && <AbaRoteiro idCliente={id} cliente={cliente} />}
      {aba === 'Transcrição' && <AbaTranscricao idCliente={id} cliente={cliente} />}
      {aba === 'Interações' && <AbaInteracoes idCliente={id} onMudanca={carregar} />}
      {aba === 'Reuniões' && <AbaReunioes idCliente={id} onMudanca={carregar} />}
      {aba === 'Em análise' && <AbaAnalise idCliente={id} cliente={cliente} onMudanca={carregar} />}
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

// ─── PLANEJAMENTO: a construção da apólice, do diagnóstico ao prêmio ────────
// A aba é a mesa de trabalho da consultora e a fonte única dos slides. Ordem:
//   tipo e focos → família → filhos → vida financeira → raio-X do patrimônio →
//   empresa (PJ) → sucessão → coberturas da apólice → investimento →
//   inteligência do estudo → objetivos.
// Nenhum número é calculado aqui: tudo vem de calcularEstudo(), para a tela e
// a apresentação nunca mostrarem contas diferentes.
const SECAO = 'mb-2 mt-6 flex scroll-mt-20 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 first:mt-0'

// Objetivos comuns em consultoria de vida — chips que a consultora agrega com
// um clique. Enriquecem a capa e o fechamento da proposta.
const OBJETIVOS_SUGERIDOS = [
  'Garantir a educação dos filhos',
  'Manter o padrão de vida da família',
  'Quitar dívidas e financiamentos',
  'Planejamento sucessório e blindagem patrimonial',
  'Proteger a renda de autônomo',
  'Proteger a sociedade e a continuidade da empresa',
  'Complementar a aposentadoria',
  'Deixar um legado',
]

const ICONE_GRUPO = {
  essencial: Shield, vida: HeartPulse, acidentes: Ambulance,
  assistencia: HeartHandshake, sucessao: Landmark, empresarial: Building2,
}

const fmtMeses = (m) => (m == null ? '—' : m >= MESES_VITALICIO ? 'vitalícia' : `${m} meses`)

// Campo de cobertura: valor com pontuação + sugestão calculada com botão "usar".
// Fica FORA da AbaPlanejamento: se fosse recriado a cada render, o React
// remontaria o input a cada tecla e o campo perderia o foco.
function CampoCobertura({ cob, estudo, plano, setPlano }) {
  const sugestao = estudo.sugestoes[cob.id] ?? 0
  const valorForm = plano[cob.campo]
  const sugestaoArredondada = Math.round(sugestao * 100) / 100
  const diaria = cob.tipo === 'diaria' ? estudo.diariaPorId[cob.id] : null
  const porque = porqueCobertura(cob.id, estudo)
  const mudar = (campo, valor) => setPlano({ ...plano, [campo]: valor })

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4">
      <p className="font-medium text-slate-800">{cob.rotulo}</p>
      <p className="mb-3 mt-0.5 text-xs text-slate-400">{cob.descricao}</p>
      <InputMoeda value={valorForm ?? ''}
        placeholder={sugestao > 0 ? Math.round(sugestao).toLocaleString('pt-BR') : '0'}
        onChange={(e) => mudar(cob.campo, e.target.value)} />

      {/* Diárias: o que vale mesmo é diária × limite de dias */}
      {diaria && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Campo label="Limite de diárias">
            <Input type="number" min="1" max="1095" value={plano[cob.campoDias] ?? ''}
              placeholder={String(cob.diasPadrao)}
              onChange={(e) => mudar(cob.campoDias, e.target.value)} />
          </Campo>
          {cob.campoFranquia && (
            <Campo label="Franquia (dias)" dica="Dias de afastamento antes de a diária começar a contar">
              <Input type="number" min="0" max="120" value={plano[cob.campoFranquia] ?? ''}
                placeholder={String(cob.franquiaPadrao)}
                onChange={(e) => mudar(cob.campoFranquia, e.target.value)} />
            </Campo>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-400" title={cob.comoCalcula}>
          Sugestão: <strong className="text-slate-600">
            {cob.tipo === 'diaria' ? `${brl(sugestao)}/dia` : brlCompacto(sugestao)}
          </strong>
        </span>
        {sugestao > 0 && String(valorForm ?? '') === '' && (
          <span className="text-slate-400">em branco = usa a sugestão</span>
        )}
        {sugestao > 0 && String(valorForm ?? '') !== '' && Number(valorForm) !== sugestaoArredondada && (
          <button type="button" className="font-semibold text-blue-600 hover:underline"
            onClick={() => mudar(cob.campo, sugestaoArredondada)}>
            usar sugestão
          </button>
        )}
      </div>
      {/* De onde saiu esse número, com os valores DESTE cliente. É o que a
          consultora responde quando ele pergunta "por que tanto?". */}
      {porque && (
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-xs text-slate-500">{porque}</p>
      )}
    </div>
  )
}

// Rascunhos em memória, por cliente. Quando a consultora sai da aba com algo
// não salvo, guardamos aqui além de mandar para o banco: se ela voltar antes
// da gravação terminar, a tela remonta com o que ela digitou, e não com a
// versão antiga que o banco ainda responderia.
const rascunhosPlano = new Map()
const ESPERA_AUTOSALVAR = 1800

function AbaPlanejamento({ idCliente, cliente }) {
  const toast = useToast()
  const [plano, setPlano] = useState(null)
  const [colunas, setColunas] = useState(null)
  const [estadoSalvar, setEstadoSalvar] = useState('ocioso')
  const [salvoEm, setSalvoEm] = useState(null)
  // JSON do último payload gravado — a régua para saber o que ainda falta salvar
  const salvoRef = useRef(null)
  // o que está pendente agora, lido pela descarga ao desmontar a aba
  const pendenteRef = useRef(null)
  const sujoRef = useRef(false)
  const planoRef = useRef(null)
  const gravarRef = useRef(null)
  // qual cliente serviu de base para salvoRef (protege contra troca de cliente)
  const baseRef = useRef(null)
  // payload que o banco recusou: não insistimos nele sozinhos, só se ela mudar algo
  const erroRef = useRef(null)

  useEffect(() => {
    // Migrações são aplicadas à mão no Supabase: perguntamos ao banco quais
    // colunas existem antes de montar o formulário. Assim uma instalação
    // atrasada continua funcionando, só com menos blocos.
    // troca de cliente volta para o carregando: nunca renderizamos o
    // formulário de um cliente com os dados de outro
    setPlano(null)
    setColunas(null)
    const probe = (coluna) => supabase.from('planejamentos').select(coluna).limit(1)
      .then(({ error }) => !error)
    Promise.all([
      supabase.from('planejamentos').select('*').eq('id_cliente', idCliente).maybeSingle(),
      probe('capital_invalidez'), probe('premio_estimado'), probe('tipo_planejamento'),
      probe('renda_desejada_aposentadoria'),
    ]).then(([{ data }, tem014, tem015, tem019, tem021]) => {
      setColunas({ tem014, tem015, tem019, tem021 })
      // Rascunho local vence a resposta do banco quando é mais recente que a
      // linha lida — cobre tanto a gravação ainda em voo quanto a volta rápida
      // para a aba. Se outra tela (a Transcrição, por exemplo) gravou depois,
      // o updated_at da linha é maior e o banco vence.
      const rascunho = rascunhosPlano.get(String(idCliente))
      if (rascunho) {
        const gravadoEm = Date.parse(data?.updated_at ?? '')
        if (!Number.isFinite(gravadoEm) || gravadoEm <= rascunho.em) {
          setPlano(rascunho.plano)
          return
        }
        rascunhosPlano.delete(String(idCliente))
      }
      setPlano(data ?? {
        id_cliente: idCliente, profissao: '', estado_civil: '', renda_mensal: '',
        custo_vida_mensal: '', patrimonio_total: '', dividas_total: '',
        num_dependentes: 0, dependentes: [], anos_protecao: 10, capital_sugerido: '',
        objetivos: '', observacoes_reuniao: '',
        // as chaves das migrações aplicadas precisam existir no objeto: é por
        // elas que o estudo sabe quais coberturas pode oferecer
        ...(tem014 && {
          capital_invalidez: '', capital_doencas_graves: '', dit_diaria: '',
          verba_sucessoria: '', cobertura_atual: '', conjuge_nome: '',
        }),
        ...(tem015 && { premio_estimado: '' }),
        ...(tem019 && { tipo_planejamento: 'pf', focos: [] }),
        ...(tem021 && {
          fumante: false, renda_desejada_aposentadoria: '', idade_aposentadoria: '',
          seguros_existentes: [], quem_decide: '', prazo_decisao: '',
        }),
      })
    })
  }, [idCliente])

  // Grava sozinho pouco depois que ela para de digitar. Reagimos também ao
  // estadoSalvar: quando uma gravação termina e ainda há coisa nova, o efeito
  // roda de novo e agenda a próxima — nada fica preso atrás de um upsert.
  useEffect(() => {
    if (!sujoRef.current || estadoSalvar === 'salvando') return
    if (erroRef.current !== null && erroRef.current === JSON.stringify(pendenteRef.current)) return
    const t = setTimeout(() => {
      if (sujoRef.current && pendenteRef.current) {
        gravarRef.current?.(pendenteRef.current, { silencioso: true })
      }
    }, ESPERA_AUTOSALVAR)
    return () => clearTimeout(t)
  }, [plano, estadoSalvar])

  // Sair da aba (ou do cliente) descarrega o que estiver pendente. Não mexemos
  // em estado aqui: o componente já está indo embora.
  useEffect(() => () => {
    const payload = pendenteRef.current
    if (!sujoRef.current || !payload) return
    rascunhosPlano.set(String(idCliente), { plano: planoRef.current, em: Date.now() })
    supabase.from('planejamentos').upsert(payload, { onConflict: 'id_cliente' })
      .then(() => {}, () => {})
  }, [idCliente])

  // Fechar o navegador com algo pendente pede confirmação.
  useEffect(() => {
    const aviso = (e) => { if (sujoRef.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [])

  if (!plano || !colunas) return <Spinner />

  const { tem014, tem015, tem019, tem021 } = colunas
  const estudo = calcularEstudo(plano, { dataNascimento: cliente?.data_nascimento })
  const set = (k) => (e) => setPlano({ ...plano, [k]: e.target.value })
  const setValor = (k, v) => setPlano({ ...plano, [k]: v })
  const focos = Array.isArray(plano.focos) ? plano.focos : []
  const alternarFoco = (id) => setValor('focos', focos.includes(id)
    ? focos.filter((f) => f !== id) : [...focos, id])

  // Filhos: lista estruturada guardada na coluna jsonb `dependentes`
  // (formato [{nome, idade, custo_mensal}]) — o gasto some quando fazem 24
  const filhos = Array.isArray(plano.dependentes) ? plano.dependentes : []
  const setFilho = (i, campo, valor) =>
    setPlano({ ...plano, dependentes: filhos.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)) })
  const addFilho = () =>
    setPlano({ ...plano, dependentes: [...filhos, { nome: '', idade: '', custo_mensal: '' }] })
  const removerFilho = (i) =>
    setPlano({ ...plano, dependentes: filhos.filter((_, j) => j !== i) })

  // Coberturas visíveis: o catálogo filtrado pelas migrações aplicadas e pelo
  // tipo de planejamento (as empresariais só aparecem quando há PJ no estudo)
  const gruposVisiveis = GRUPOS_COBERTURA
    .map((g) => ({
      ...g,
      itens: COBERTURAS.filter((c) => c.grupo === g.id)
        .filter((c) => (c.requer !== '014' || tem014) && (c.requer !== '019' || tem019))
        .filter((c) => !c.pj || estudo.temPJ),
    }))
    .filter((g) => g.itens.length > 0)

  // Monta o que vai para o banco a partir do estado atual. É função pura de
  // propósito: o autosalvamento compara o JSON dela para saber se há mudança
  // pendente, e a descarga ao sair da aba grava exatamente este objeto.
  function montarPayload() {
    // limpa linhas vazias e normaliza os tipos antes de gravar o jsonb
    const filhosLimpos = filhos
      .filter((f) => String(f?.nome ?? '').trim() !== ''
        || (f?.idade !== '' && f?.idade != null) || Number(f?.custo_mensal) > 0)
      .map((f) => ({
        nome: String(f.nome ?? '').trim(),
        idade: f.idade === '' || f.idade == null ? null : Number(f.idade),
        custo_mensal: f.custo_mensal === '' || f.custo_mensal == null ? null : Number(f.custo_mensal),
      }))
    // apólices que ele já tem: linhas em branco não vão para o banco
    const segurosLimpos = (Array.isArray(plano.seguros_existentes) ? plano.seguros_existentes : [])
      .filter((s) => String(s?.descricao ?? '').trim() !== '' || Number(s?.capital) > 0)
      .map((s) => ({
        origem: s.origem || 'individual',
        descricao: String(s.descricao ?? '').trim(),
        capital: s.capital === '' || s.capital == null ? null : Number(s.capital),
        custeio: s.custeio || 'proprio',
      }))
    const idades = filhosLimpos.map((f) => f.idade).filter((i) => i != null)
    // número vazio vira null (e não 0): null significa "usa a sugestão"
    const num = (v) => (v === '' || v == null ? null : Number(v))
    const payload = {
      id_cliente: idCliente,
      profissao: plano.profissao || null,
      estado_civil: plano.estado_civil || null,
      renda_mensal: num(plano.renda_mensal),
      custo_vida_mensal: num(plano.custo_vida_mensal),
      patrimonio_total: num(plano.patrimonio_total),
      dividas_total: num(plano.dividas_total) ?? 0,
      capital_sugerido: num(plano.capital_sugerido),
      dependentes: filhosLimpos,
      num_dependentes: filhosLimpos.length > 0 ? filhosLimpos.length : (Number(plano.num_dependentes) || 0),
      anos_protecao: Number(plano.anos_protecao) || 10,
      objetivos: plano.objetivos || null,
      observacoes_reuniao: plano.observacoes_reuniao || null,
      ...(tem015 && { premio_estimado: num(plano.premio_estimado) }),
      ...(tem014 && {
        capital_invalidez: num(plano.capital_invalidez),
        capital_doencas_graves: num(plano.capital_doencas_graves),
        dit_diaria: num(plano.dit_diaria),
        verba_sucessoria: num(plano.verba_sucessoria),
        cobertura_atual: num(plano.cobertura_atual) ?? 0,
        itcmd_pct: num(plano.itcmd_pct) ?? 4,
        custas_pct: num(plano.custas_pct) ?? 8,
        conjuge_nome: plano.conjuge_nome || null,
        // texto-resumo das idades (mantém compatibilidade com telas antigas)
        filhos_idades: idades.length > 0 ? `${idades.join(', ')} anos` : plano.filhos_idades || null,
      }),
      ...(tem019 && {
        tipo_planejamento: plano.tipo_planejamento || 'pf',
        focos,
        patrimonio_imoveis: num(plano.patrimonio_imoveis),
        patrimonio_investimentos: num(plano.patrimonio_investimentos),
        patrimonio_empresa: num(plano.patrimonio_empresa),
        patrimonio_veiculos: num(plano.patrimonio_veiculos),
        patrimonio_outros: num(plano.patrimonio_outros),
        previdencia_saldo: num(plano.previdencia_saldo),
        previdencia_tipo: plano.previdencia_tipo || null,
        previdencia_aporte_mensal: num(plano.previdencia_aporte_mensal),
        regime_bens: plano.regime_bens || null,
        tem_holding: !!plano.tem_holding,
        tem_testamento: !!plano.tem_testamento,
        herdeiros_menores: !!plano.herdeiros_menores,
        pj_razao_social: plano.pj_razao_social || null,
        pj_valuation: num(plano.pj_valuation),
        pj_participacao_pct: num(plano.pj_participacao_pct),
        pj_num_socios: num(plano.pj_num_socios),
        pj_faturamento_anual: num(plano.pj_faturamento_anual),
        pj_lucro_anual: num(plano.pj_lucro_anual),
        pj_divida_avalizada: num(plano.pj_divida_avalizada),
        capital_socios: num(plano.capital_socios),
        capital_homem_chave: num(plano.capital_homem_chave),
        capital_aval: num(plano.capital_aval),
        capital_morte_acidental: num(plano.capital_morte_acidental),
        capital_fraturas: num(plano.capital_fraturas),
        dih_diaria: num(plano.dih_diaria),
        dih_dias: num(plano.dih_dias),
        dit_dias: num(plano.dit_dias),
        dit_franquia_dias: num(plano.dit_franquia_dias),
        funeral_individual: num(plano.funeral_individual),
        funeral_familiar: num(plano.funeral_familiar),
        premio_anual: num(plano.premio_anual),
        forma_pagamento: plano.forma_pagamento || 'mensal',
      }),
      ...(tem021 && {
        fumante: !!plano.fumante,
        renda_desejada_aposentadoria: num(plano.renda_desejada_aposentadoria),
        idade_aposentadoria: num(plano.idade_aposentadoria),
        seguros_existentes: segurosLimpos,
        quem_decide: plano.quem_decide || null,
        prazo_decisao: plano.prazo_decisao || null,
      }),
    }
    return payload
  }

  // ── Autosalvamento ────────────────────────────────────────────────────────
  // Este formulário tem quase cem campos e é preenchido AO VIVO, durante a
  // reunião. Antes, um clique em outra aba jogava fora tudo que estava
  // digitado. Agora o rascunho se grava sozinho quando ela para de digitar, é
  // descarregado ao sair da aba e o navegador avisa antes de fechar com algo
  // pendente. O botão continua ali para quem quer salvar na hora.
  const payloadAtual = montarPayload()
  const payloadJSON = JSON.stringify(payloadAtual)
  // Primeira renderização com dados: o que veio do banco vira a régua.
  if (baseRef.current !== idCliente) {
    baseRef.current = idCliente
    salvoRef.current = payloadJSON
  }
  const sujo = salvoRef.current !== payloadJSON
  planoRef.current = plano
  pendenteRef.current = payloadAtual
  sujoRef.current = sujo

  async function gravar(payload, { silencioso } = {}) {
    const json = JSON.stringify(payload)
    setEstadoSalvar('salvando')
    const { data, error } = await supabase.from('planejamentos')
      .upsert(payload, { onConflict: 'id_cliente' }).select().single()
    if (error) {
      erroRef.current = json
      setEstadoSalvar('erro')
      if (!silencioso) toast.erro(`Erro ao salvar: ${error.message}`)
      return false
    }
    erroRef.current = null
    rascunhosPlano.delete(String(idCliente))
    salvoRef.current = json
    sujoRef.current = pendenteRef.current !== payload
    setSalvoEm(new Date())
    setEstadoSalvar('salvo')
    // no autosalvamento não reescrevemos o estado: a consultora pode estar
    // digitando neste exato momento e o cursor pularia
    if (!silencioso && data) setPlano(data)
    return true
  }

  // o autosalvamento é agendado num efeito lá em cima (antes do carregando),
  // então ele alcança a gravação por referência
  gravarRef.current = gravar

  async function salvar(e) {
    e.preventDefault()
    if (await gravar(montarPayload())) toast.ok('Planejamento salvo.')
  }

  // Prontidão da proposta: o que já dá para apresentar e o que ainda pega mal
  const pct = Math.round((estudo.completude.feitos / estudo.completude.total) * 100)
  const pronto = estudo.completude.feitos >= estudo.completude.total - 1
  const pendencias = []
  if (estudo.renda <= 0) pendencias.push('Preencha a renda mensal — vários cálculos dependem dela.')
  if (estudo.custoVida <= 0) pendencias.push('Preencha o custo de vida — é a base da proteção da família.')
  if (!estudo.investimento)
    pendencias.push('Sem prêmio cotado: a proposta não terá o slide “O investimento”. Cote nas seguradoras e preencha.')
  else if (!estudo.investimento.temDescontoAnual)
    pendencias.push('Informe o prêmio anual: quase toda seguradora dá desconto à vista, e o cliente tem o direito de escolher.')
  if (estudo.patrimonioBruto <= 0)
    pendencias.push('Sem patrimônio: a proposta não mostrará a sucessão nem a blindagem.')
  else if (tem019 && !estudo.detalhado)
    pendencias.push('Detalhe o patrimônio por classe: é o que separa o que trava no inventário do que vai direto ao beneficiário.')
  if (estudo.temPJ && estudo.pj.valuation <= 0)
    pendencias.push('Estudo com PJ: informe o valuation e a participação para calcular o acordo de sócios.')

  // ── Roteiro do preenchimento ──────────────────────────────────────────────
  // O formulário é longo porque a apólice é grande. Em vez de pedir que ela
  // role atrás do que falta, o roteiro mostra a espinha do estudo: cada bloco
  // com o que já está em pé, e um clique leva direto até ele. Serve também
  // durante a reunião — é a ordem natural da conversa com o cliente.
  const cheio = (v) => v != null && String(v).trim() !== '' && Number(v) !== 0
  const roteiro = [
    tem019 && { id: 'sec-tipo', rotulo: 'Tipo e focos', icone: ChartPie, ok: focos.length > 0,
      resumo: focos.length > 0 ? `${focos.length} foco(s)` : 'escolha os focos' },
    { id: 'sec-familia', rotulo: 'Família', icone: Users2,
      ok: cheio(plano.profissao) || filhos.length > 0 || cheio(plano.conjuge_nome),
      resumo: filhos.length > 0 ? `${filhos.length} filho(s)` : (plano.estado_civil || 'quem depende dele') },
    { id: 'sec-financeira', rotulo: 'Vida financeira', icone: Wallet,
      ok: estudo.renda > 0 && estudo.custoVida > 0,
      resumo: estudo.renda > 0 ? `renda ${brlCompacto(estudo.renda)}` : 'renda e custo de vida' },
    tem019 && { id: 'sec-patrimonio', rotulo: 'Patrimônio', icone: PiggyBank, ok: estudo.detalhado,
      resumo: estudo.patrimonioBruto > 0 ? brlCompacto(estudo.patrimonioBruto) : 'por classe de bem' },
    tem019 && estudo.temPJ && { id: 'sec-empresa', rotulo: 'Empresa', icone: Building2,
      ok: estudo.pj.valuation > 0,
      resumo: estudo.pj.valuation > 0 ? `quota ${brlCompacto(estudo.pj.quota)}` : 'valuation e sócios' },
    tem014 && { id: 'sec-sucessao', rotulo: 'Sucessão', icone: Landmark, ok: estudo.custoInventario > 0,
      resumo: estudo.custoInventario > 0 ? `inventário ${brlCompacto(estudo.custoInventario)}` : 'depende do patrimônio' },
    { id: 'sec-coberturas', rotulo: 'Coberturas', icone: Shield, ok: estudo.ativas.length > 0,
      resumo: estudo.ativas.length > 0 ? `${estudo.ativas.length} na apólice` : 'nada montado ainda' },
    tem021 && { id: 'sec-aposentadoria', rotulo: 'Aposentadoria', icone: TrendingUp,
      ok: !!estudo.aposentadoria,
      resumo: estudo.aposentadoria
        ? `meta ${brlCompacto(estudo.aposentadoria.capitalNecessario)}`
        : 'renda desejada e idade' },
    tem015 && { id: 'sec-investimento', rotulo: 'Investimento', icone: Coins, ok: !!estudo.investimento,
      resumo: estudo.investimento ? `${brl(estudo.investimento.mensal)}/mês` : 'prêmio cotado' },
  ].filter(Boolean)
  const irPara = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <Card className="p-5">
      <ComoFunciona id="planejamento" titulo="Como montar o planejamento">
        Preencha o que você levantou na reunião: família, renda, custo de vida, <strong>cada classe do
        patrimônio</strong> e, se houver, a empresa. O sistema calcula sozinho todas as coberturas da
        apólice, o custo do inventário e o déficit de liquidez. Deixe uma cobertura em branco para usar
        a sugestão automática, ou digite o valor que você cotou. Tudo aqui alimenta a{' '}
        <strong>proposta</strong> — o que estiver na tela é exatamente o que o cliente vai ver.
      </ComoFunciona>

      {!tem019 && (
        <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
          Rode a migração <strong>019_planejamento_completo.sql</strong> no Supabase para liberar o
          raio-X do patrimônio, o planejamento empresarial, as coberturas de morte acidental, fraturas,
          internação e funeral, e o prêmio anual com desconto.
        </p>
      )}

      {/* Prontidão da proposta */}
      <div className="mb-5 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={pronto ? '#0e9f6e' : '#d96527'} strokeWidth="3"
                  strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
              </svg>
              <span className="absolute text-xs font-bold text-slate-700">{pct}%</span>
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {pronto ? 'Estudo pronto para apresentar ✓' : 'Prontidão da proposta'}
              </p>
              <p className="text-xs text-slate-500">
                {estudo.completude.feitos} de {estudo.completude.total} informações-chave preenchidas
              </p>
            </div>
          </div>
          <Link to={`/proposta/${idCliente}`}>
            <Button variant={pronto ? 'primary' : 'secondary'}>
              <Presentation size={16} /> Gerar proposta
            </Button>
          </Link>
        </div>

        {/* Números que não fecham — corrigidos antes de a reunião começar */}
        {estudo.inconsistencias.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-3">
            {estudo.inconsistencias.map((inc, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs ${inc.grave ? 'text-red-700' : 'text-amber-800'}`}>
                <AlertTriangle size={13} className={`mt-0.5 shrink-0 ${inc.grave ? 'text-red-700' : 'text-amber-700'}`} />
                <span>
                  {inc.texto}
                  {inc.corrigir && (
                    <button type="button" className="ml-1.5 font-semibold text-blue-600 hover:underline"
                      onClick={() => setValor(inc.corrigir, inc.valor)}>
                      corrigir para {brlCompacto(inc.valor)}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {pendencias.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-3">
            {pendencias.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                <span className="mt-0.5 text-amber-700">▹</span> {a}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Roteiro: a espinha do estudo em uma linha. Um clique leva ao bloco. */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {roteiro.map((s) => {
          const Icone = s.icone
          return (
            <button key={s.id} type="button" onClick={() => irPara(s.id)}
              title={s.ok ? `${s.rotulo}: ${s.resumo}` : `Falta preencher: ${s.resumo}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                s.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-laranja-300 hover:text-laranja-700'}`}>
              <Icone size={13} className={s.ok ? 'text-emerald-700' : 'text-slate-400'} />
              <span className="font-medium">{s.rotulo}</span>
              <span className={s.ok ? 'text-emerald-700/80' : 'text-slate-400'}>· {s.resumo}</span>
            </button>
          )
        })}
      </div>

      <form onSubmit={salvar}>
        {/* ── Tipo de planejamento e focos ─────────────────────────────────── */}
        {tem019 && (
          <>
            <p id="sec-tipo" className={SECAO}><ChartPie size={13} /> Que planejamento estamos construindo</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TIPOS_PLANEJAMENTO.map((t) => {
                const ativo = (plano.tipo_planejamento || 'pf') === t.id
                return (
                  <button key={t.id} type="button" onClick={() => setValor('tipo_planejamento', t.id)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      ativo ? 'border-laranja-300 bg-laranja-50/60 ring-1 ring-laranja-200'
                        : 'border-slate-200/70 bg-white hover:border-slate-300'}`}>
                    <p className={`text-sm font-semibold ${ativo ? 'text-laranja-800' : 'text-slate-800'}`}>
                      {ativo ? '✓ ' : ''}{t.rotulo}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{t.descricao}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-slate-400">
                Focos do estudo — definem quais capítulos a proposta apresenta e a ordem das coberturas.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FOCOS.map((f) => {
                  const ativo = focos.includes(f.id)
                  return (
                    <button key={f.id} type="button" onClick={() => alternarFoco(f.id)} title={f.descricao}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        ativo ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-laranja-300 hover:text-laranja-700'}`}>
                      {ativo ? '✓ ' : '+ '}{f.rotulo}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Família e perfil ─────────────────────────────────────────────── */}
        <p id="sec-familia" className={SECAO}><Users2 size={13} /> Família e perfil</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          {tem019 && (
            <Campo label="Regime de bens" dica="Muda quem herda o quê — meação e herança são coisas diferentes">
              <Select value={plano.regime_bens ?? ''} onChange={set('regime_bens')}>
                <option value="">—</option>
                {['Comunhão parcial', 'Comunhão universal', 'Separação total', 'Separação obrigatória',
                  'Participação final nos aquestos'].map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Campo>
          )}
          {tem019 && (
            <div className="flex flex-col justify-center gap-1.5 md:col-span-2">
              {[
                ['herdeiros_menores', 'Há herdeiros menores de idade', 'O inventário vira judicial obrigatoriamente — mais lento e mais caro'],
                ['tem_holding', 'Já possui holding familiar', 'Reduz custas, mas não elimina o ITCMD nem a necessidade de liquidez'],
                ['tem_testamento', 'Já possui testamento', 'Organiza a partilha; não antecipa o dinheiro do imposto'],
              ].map(([campo, rotulo, dica]) => (
                <label key={campo} className="flex cursor-pointer items-start gap-2 text-sm text-slate-600" title={dica}>
                  <input type="checkbox" checked={!!plano[campo]}
                    onChange={(e) => setValor(campo, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-laranja-600 focus:ring-laranja-500" />
                  <span>{rotulo} <span className="text-xs text-slate-400">· {dica}</span></span>
                </label>
              ))}
            </div>
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
                        : <span className="text-emerald-700">já independente ✓</span>
                      : 'informe a idade'}
                  </span>
                  <button type="button" onClick={() => removerFilho(i)}
                    className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-700" title="Remover filho">
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

        {/* ── Vida financeira ──────────────────────────────────────────────── */}
        <p id="sec-financeira" className={SECAO}><Wallet size={13} /> Vida financeira</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Campo label="Renda mensal"><InputMoeda value={plano.renda_mensal ?? ''} onChange={set('renda_mensal')} /></Campo>
          <Campo label="Custo de vida mensal" dica={estudo.custoFilhosMensal > 0 ? `Inclui os ${brl(estudo.custoFilhosMensal)} dos filhos` : 'Quanto a família gasta por mês, no total'}>
            <InputMoeda value={plano.custo_vida_mensal ?? ''} onChange={set('custo_vida_mensal')} />
          </Campo>
          <Campo label="Dívidas totais" dica="Financiamentos, consignados, cartão — o que a família herdaria">
            <InputMoeda value={plano.dividas_total ?? ''} onChange={set('dividas_total')} />
          </Campo>
          <Campo label="Anos de proteção"
            dica={estudo.janelaProtecao
              ? `Sugestão: ${estudo.janelaProtecao.anos} anos — ${estudo.janelaProtecao.motivo}`
              : 'Horizonte do estudo'}>
            <Input type="number" min="1" value={plano.anos_protecao ?? 10} onChange={set('anos_protecao')} />
            {estudo.janelaProtecao && Number(plano.anos_protecao) !== estudo.janelaProtecao.anos && (
              <button type="button" className="mt-1 text-xs font-semibold text-blue-600 hover:underline"
                onClick={() => setValor('anos_protecao', estudo.janelaProtecao.anos)}>
                usar {estudo.janelaProtecao.anos} anos
              </button>
            )}
          </Campo>
          {tem014 && (
            <Campo label="Cobertura que já possui" dica="Seguros atuais — o estudo mostra o gap">
              <InputMoeda value={plano.cobertura_atual ?? ''} onChange={set('cobertura_atual')} />
            </Campo>
          )}
          {!tem019 && (
            <Campo label="Patrimônio total" dica="Base do cálculo de inventário">
              <InputMoeda value={plano.patrimonio_total ?? ''} onChange={set('patrimonio_total')} />
            </Campo>
          )}
        </div>

        {/* ── Raio-X do patrimônio ─────────────────────────────────────────── */}
        {tem019 && (
          <>
            <p id="sec-patrimonio" className={SECAO}><PiggyBank size={13} /> Raio-X do patrimônio</p>
            <p className="mb-3 text-xs text-slate-400">
              Cada classe se comporta de um jeito quando o titular falta. Imóveis, investimentos, empresa
              e veículos <strong>travam no inventário</strong> até o ITCMD ser pago — e o imposto se paga
              em dinheiro, não em imóvel. Previdência e seguro <strong>não passam por inventário</strong>:
              vão direto ao beneficiário indicado, em dias.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {CLASSES_PATRIMONIO.filter((c) => c.id !== 'previdencia').map((c) => (
                <Campo key={c.id} label={c.rotulo} dica={c.nota}>
                  <InputMoeda value={plano[c.campo] ?? ''} onChange={set(c.campo)} />
                </Campo>
              ))}
              <Campo label="Previdência (VGBL/PGBL)" dica="Não entra no inventário nem na base do ITCMD">
                <InputMoeda value={plano.previdencia_saldo ?? ''} onChange={set('previdencia_saldo')} />
              </Campo>
              <Campo label="Tipo de previdência">
                <Select value={plano.previdencia_tipo ?? ''} onChange={set('previdencia_tipo')}>
                  <option value="">—</option>
                  {['VGBL', 'PGBL', 'Ambos'].map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Campo>
              <Campo label="Aporte mensal na previdência" dica="Entra na leitura de quanto já é destinado ao longo prazo">
                <InputMoeda value={plano.previdencia_aporte_mensal ?? ''} onChange={set('previdencia_aporte_mensal')} />
              </Campo>
            </div>

            {/* O extrato mostra o bruto. A família saca o líquido. */}
            {estudo.irPrevidencia > 0 && (
              <p className="mt-2 rounded-lg border border-slate-200/70 bg-slate-50/60 p-3 text-xs text-slate-600">
                <strong>{estudo.previdenciaTipo}:</strong>{' '}
                {estudo.previdenciaTipo === 'PGBL'
                  ? 'o IR incide sobre o valor TOTAL resgatado, porque o aporte foi deduzido na declaração.'
                  : estudo.previdenciaTipo === 'VGBL'
                    ? 'o IR incide só sobre o rendimento — o aporte já foi tributado na origem.'
                    : 'parte do saldo é VGBL (IR só no rendimento) e parte é PGBL (IR sobre o total).'}
                {' '}Dos <strong>{brlCompacto(estudo.previdencia)}</strong> do extrato, a família recebe
                {' '}<strong className="text-slate-900">{brlCompacto(estudo.previdenciaLiquida)}</strong>
                {' '}— saem <strong>{brlCompacto(estudo.irPrevidencia)}</strong> de imposto de renda
                {' '}(alíquota de longo prazo, 10%). É esse número que paga o inventário, não o do extrato.
              </p>
            )}

            {estudo.patrimonioBruto > 0 && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metrica rotulo="Patrimônio bruto" valor={brl(estudo.patrimonioBruto)}
                    detalhe="bens + previdência" />
                  <Metrica rotulo="Patrimônio líquido" valor={brl(estudo.patrimonioLiquido)}
                    detalhe={estudo.dividas > 0 ? `já descontadas as dívidas de ${brlCompacto(estudo.dividas)}` : 'sem dívidas'}
                    tom={estudo.patrimonioLiquido < 0 ? 'ruim' : 'neutro'} />
                  <Metrica rotulo="Trava no inventário" valor={brl(estudo.bensInventariaveis)}
                    detalhe={estudo.pctIliquido != null ? `${estudo.pctIliquido}% do total é ilíquido` : 'passa por ITCMD'}
                    tom="ruim" />
                  <Metrica rotulo="Chega em dias" valor={brl(estudo.liquidezImediata)}
                    detalhe={estudo.irPrevidencia > 0
                      ? 'previdência líquida de IR + seguro atual'
                      : 'previdência + seguro que já existe'} tom="bom" />
                </div>
                {estudo.detalhado && (
                  <div className="mt-4 rounded-xl border border-slate-200/70 bg-white p-4">
                    <MapaPatrimonio estudo={estudo} />
                  </div>
                )}
              </>
            )}

            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <Campo label="Patrimônio total declarado" dica="Consolidado que aparece no dossiê — mantenha igual à soma das classes">
                <InputMoeda value={plano.patrimonio_total ?? ''} onChange={set('patrimonio_total')} />
              </Campo>
            </div>
          </>
        )}

        {/* ── Empresa (PJ) ─────────────────────────────────────────────────── */}
        {tem019 && estudo.temPJ && (
          <>
            <p id="sec-empresa" className={SECAO}><Building2 size={13} /> A empresa</p>
            <p className="mb-3 text-xs text-slate-400">
              Sem acordo de sócios, a família herda a quota e vira sócia de quem ficou — sem saber tocar
              o negócio e sem poder vender. Com capital, os sócios compram a participação à vista e todo
              mundo segue a vida. O <strong>aval do sócio também não morre com ele</strong>: vira dívida
              do espólio e alcança o patrimônio pessoal.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Campo label="Razão social">
                <Input value={plano.pj_razao_social ?? ''} onChange={set('pj_razao_social')} />
              </Campo>
              <Campo label="Valuation da empresa" dica="Valor de mercado — base do acordo de sócios">
                <InputMoeda value={plano.pj_valuation ?? ''} onChange={set('pj_valuation')} />
              </Campo>
              <Campo label="Participação do cliente (%)">
                <Input type="number" step="0.5" min="0" max="100" value={plano.pj_participacao_pct ?? ''}
                  onChange={set('pj_participacao_pct')} />
              </Campo>
              <Campo label="Nº de sócios">
                <Input type="number" min="1" value={plano.pj_num_socios ?? ''} onChange={set('pj_num_socios')} />
              </Campo>
              <Campo label="Faturamento anual">
                <InputMoeda value={plano.pj_faturamento_anual ?? ''} onChange={set('pj_faturamento_anual')} />
              </Campo>
              <Campo label="Lucro anual" dica="Base do capital de homem-chave — sem ele, estimamos 20% do faturamento">
                <InputMoeda value={plano.pj_lucro_anual ?? ''} onChange={set('pj_lucro_anual')} />
              </Campo>
              <Campo label="Dívidas da empresa com aval do sócio" dica="O aval alcança o patrimônio pessoal da família">
                <InputMoeda value={plano.pj_divida_avalizada ?? ''} onChange={set('pj_divida_avalizada')} />
              </Campo>
            </div>
            {estudo.pj.quota > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metrica rotulo="Quota do cliente" valor={brl(estudo.pj.quota)}
                  detalhe={`${estudo.pj.participacao}% de ${brlCompacto(estudo.pj.valuation)}`} />
                <Metrica rotulo="Capital de homem-chave" valor={brl(estudo.valores.homem_chave)}
                  detalhe={estudo.valores.homem_chave !== estudo.sugestoes.homem_chave
                    ? `definido por você · sugestão ${brlCompacto(estudo.sugestoes.homem_chave)}`
                    : estudo.pj.lucro > 0 ? '2× o lucro anual' : '2× o lucro estimado (20% do faturamento)'} />
                <Metrica rotulo="Exposição pelo aval" valor={brl(estudo.pj.dividaAval)}
                  detalhe="alcança o patrimônio pessoal" tom={estudo.pj.dividaAval > 0 ? 'ruim' : 'neutro'} />
              </div>
            )}
          </>
        )}

        {/* ── Sucessão ─────────────────────────────────────────────────────── */}
        {tem014 && (
          <>
            <p id="sec-sucessao" className={SECAO}><Landmark size={13} /> Sucessão — o custo do inventário</p>
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
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
                    ({(estudo.itcmd + estudo.sucessao.custasEfetivas).toFixed(1).replace('.', ',')}% de {brlCompacto(estudo.sucessao.baseInventario)})
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Incide só sobre o que passa por inventário
                  {estudo.previdencia > 0 && <> — os {brlCompacto(estudo.previdencia)} de previdência ficam de fora</>}.
                  É a liquidez que a família precisa ter <strong>em dinheiro</strong> para destravar os bens.
                </p>
              </div>
            </div>

            {/* O que o perfil dele muda no inventário — os campos que a tela já
                coletava e a conta ignorava até agora */}
            {tem019 && estudo.bensInventariaveis > 0 && (
              <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200/70 bg-white p-3 text-xs text-slate-600">
                <p className="flex items-start gap-2">
                  <Clock3 size={13} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    Rito <strong>{estudo.sucessao.inventarioJudicial ? 'judicial' : 'extrajudicial'}</strong> —
                    {' '}cerca de <strong>{estudo.sucessao.prazoInventarioMeses} meses</strong>
                    {estudo.sucessao.inventarioJudicial
                      ? ' porque há herdeiro menor de idade: cartório não resolve, tem que correr na Justiça.'
                      : ' se todos os herdeiros forem maiores e estiverem de acordo.'}
                  </span>
                </p>
                {estudo.sucessao.temHolding && (
                  <p className="flex items-start gap-2">
                    <Building2 size={13} className="mt-0.5 shrink-0 text-slate-400" />
                    <span>
                      Holding familiar: custas e honorários caem de {estudo.custas}% para
                      {' '}<strong>{estudo.sucessao.custasEfetivas}%</strong> — mas o <strong>ITCMD continua igual</strong>,
                      porque o imposto incide na transmissão das quotas do mesmo jeito.
                    </span>
                  </p>
                )}
                {estudo.sucessao.temTestamento && (
                  <p className="flex items-start gap-2">
                    <FileSignature size={13} className="mt-0.5 shrink-0 text-slate-400" />
                    <span>
                      Testamento organiza a partilha, mas <strong>não antecipa o dinheiro do imposto</strong> —
                      a necessidade de liquidez continua a mesma.
                    </span>
                  </p>
                )}
                {estudo.sucessao.pctMeacao > 0 && (
                  <p className="flex items-start gap-2">
                    <Users2 size={13} className="mt-0.5 shrink-0 text-slate-400" />
                    <span>
                      Comunhão universal: <strong>{brlCompacto(estudo.sucessao.meacao)}</strong> já são do
                      cônjuge por meação e ficam fora da herança e do ITCMD.
                    </span>
                  </p>
                )}
                {estudo.sucessao.meacaoPotencial > 0 && (
                  <p className="flex items-start gap-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-700" />
                    <span>
                      Até <strong>{brlCompacto(estudo.sucessao.meacaoPotencial)}</strong> podem ser meação —
                      mas só o que foi adquirido durante o casamento. O estudo está calculando o imposto
                      sobre o patrimônio inteiro: confirme com ele antes de apresentar.
                    </span>
                  </p>
                )}
              </div>
            )}

            {tem019 && estudo.custoInventario > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Metrica rotulo="A família tem hoje, em dias" valor={brl(estudo.liquidezImediata)}
                  detalhe={estudo.irPrevidencia > 0
                    ? `previdência líquida de IR + seguro atual`
                    : 'previdência + seguro atual'} tom="bom" />
                <Metrica rotulo="Precisa pagar" valor={brl(estudo.custoInventario)}
                  detalhe="à vista, antes de acessar os bens" />
                <Metrica rotulo="Déficit de liquidez" valor={brl(estudo.deficitLiquidez)}
                  detalhe={estudo.deficitLiquidez > 0 ? 'sai da venda de bens às pressas' : 'coberto ✓'}
                  tom={estudo.deficitLiquidez > 0 ? 'ruim' : 'bom'} />
              </div>
            )}
          </>
        )}

        {/* ── Aposentadoria e acúmulo ──────────────────────────────────────── */}
        {tem021 && (
          <>
            <p id="sec-aposentadoria" className={SECAO}>
              <TrendingUp size={13} /> Aposentadoria e acúmulo
            </p>
            <p className="mb-3 text-xs text-slate-400">
              O aporte da previdência sai da renda. Se a renda parar, o plano de aposentadoria para
              junto — é por isso que proteção e acúmulo são o mesmo assunto, não dois.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Campo label="Renda desejada na aposentadoria"
                dica="Por mês, em valores de hoje. Em branco = manter o padrão de vida atual">
                <InputMoeda value={plano.renda_desejada_aposentadoria ?? ''}
                  onChange={set('renda_desejada_aposentadoria')} />
              </Campo>
              <Campo label="Idade para parar de trabalhar" dica="Em branco = 65 anos">
                <Input type="number" min="40" max="90" value={plano.idade_aposentadoria ?? ''}
                  onChange={set('idade_aposentadoria')} />
              </Campo>
              <div className="flex flex-col justify-center">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600"
                  title="Fumante paga mais caro no risco de vida — e o preço da espera sobe junto">
                  <input type="checkbox" checked={!!plano.fumante}
                    onChange={(ev) => setValor('fumante', ev.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-laranja-600 focus:ring-laranja-500" />
                  <span>
                    Fumante nos últimos 12 meses
                    <span className="block text-xs text-slate-400">
                      Muda o prêmio e o custo de deixar para depois
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {estudo.aposentadoria ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metrica rotulo="Meta de capital" valor={brlCompacto(estudo.aposentadoria.capitalNecessario)}
                    detalhe={`para ${brl(estudo.aposentadoria.alvoMensal)}/mês aos ${estudo.aposentadoria.idadeAlvo}`} />
                  <Metrica rotulo="A previdência entrega"
                    valor={brlCompacto(estudo.aposentadoria.projetadoLiquido)}
                    detalhe={estudo.irPrevidencia > 0 ? 'já líquida de IR' : 'em valores de hoje'} />
                  <Metrica rotulo="Renda que isso sustenta"
                    valor={`${brl(estudo.aposentadoria.rendaProjetada)}/mês`}
                    detalhe={`retirando ${(estudo.aposentadoria.taxaReal * 100).toFixed(0)}% ao ano`}
                    tom={estudo.aposentadoria.rendaProjetada < estudo.aposentadoria.alvoMensal ? 'ruim' : 'bom'} />
                  <Metrica rotulo="Falta aportar por mês"
                    valor={estudo.aposentadoria.faltaAportar != null
                      ? `${brl(estudo.aposentadoria.faltaAportar)}/mês` : '—'}
                    detalhe={estudo.aposentadoria.aporteAtual > 0
                      ? `além dos ${brl(estudo.aposentadoria.aporteAtual)} que já aporta`
                      : 'nenhum aporte informado'}
                    tom={estudo.aposentadoria.faltaAportar > 0 ? 'ruim' : 'bom'} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Projeção a <strong>{(estudo.aposentadoria.taxaReal * 100).toFixed(0)}% ao ano
                  acima da inflação</strong>, em {estudo.aposentadoria.anos} anos.
                  {estudo.aposentadoria.dependeDaRenda && (
                    <>
                      {' '}O aporte de {brl(estudo.aposentadoria.aporteAtual)} sai da renda:
                      {estudo.aposentadoria.cobreInvalidez
                        ? ' com a invalidez coberta, o plano continua de pé mesmo se ele não puder mais trabalhar.'
                        : ' sem cobertura de invalidez, ele para no dia em que a renda parar.'}
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="mt-3 rounded-lg border border-slate-200/70 bg-slate-50/60 p-3 text-xs text-slate-500">
                Para calcular a aposentadoria o estudo precisa da{' '}
                <strong>data de nascimento do cliente</strong> (no cadastro, ali em cima) e de pelo
                menos o custo de vida. Com isso ele já mostra a meta, o que a previdência atual
                entrega e o que falta.
              </p>
            )}
          </>
        )}

        {/* ── Coberturas da apólice ────────────────────────────────────────── */}
        <p id="sec-coberturas" className={SECAO}><Shield size={13} /> As coberturas da apólice</p>
        {!tem014 && (
          <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
            Rode a migração <strong>014_planejamento_detalhado.sql</strong> no Supabase para liberar
            invalidez, doenças graves, DIT, sucessão e o gap de cobertura.
          </p>
        )}
        {gruposVisiveis.map((g) => {
          const Icone = ICONE_GRUPO[g.id] ?? Shield
          return (
            <div key={g.id} className="mt-4 first:mt-0">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Icone size={14} className="text-laranja-600" /> {g.rotulo}
                </p>
                <p className="text-xs text-slate-400">{g.descricao}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.itens.map((c) => (
                  <CampoCobertura key={c.id} cob={c} estudo={estudo} plano={plano} setPlano={setPlano} />
                ))}
              </div>
            </div>
          )
        })}

        {/* ── O investimento: mensal E anual ───────────────────────────────── */}
        {tem015 && (
          <>
            <p id="sec-investimento" className={SECAO}><Coins size={13} /> O investimento — o cliente escolhe como pagar</p>
            <p className="mb-3 text-xs text-slate-400">
              Cote as duas formas. O pagamento anual quase sempre sai com desconto, e essa escolha é do
              cliente — a proposta mostra as duas lado a lado, com a economia em destaque.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Campo label="Prêmio mensal cotado" dica="12 parcelas — a forma mais comum">
                <InputMoeda value={plano.premio_estimado ?? ''} onChange={set('premio_estimado')} />
              </Campo>
              {tem019 && (
                <>
                  <Campo label="Prêmio anual à vista" dica="Normalmente com desconto sobre 12× o mensal">
                    <InputMoeda value={plano.premio_anual ?? ''} onChange={set('premio_anual')} />
                    {Number(plano.premio_estimado) > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        aplicar desconto:
                        {[3, 5, 8, 10].map((d) => (
                          <button key={d} type="button"
                            onClick={() => setValor('premio_anual',
                              Math.round(Number(plano.premio_estimado) * 12 * (1 - d / 100) * 100) / 100)}
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 hover:border-laranja-300 hover:text-laranja-700">
                            {d}%
                          </button>
                        ))}
                      </div>
                    )}
                  </Campo>
                  <Campo label="Preferência do cliente" dica="Destacada na proposta como a opção escolhida">
                    <Select value={plano.forma_pagamento ?? 'mensal'} onChange={set('forma_pagamento')}>
                      <option value="mensal">Mensal</option>
                      <option value="anual">Anual à vista</option>
                    </Select>
                  </Campo>
                </>
              )}
            </div>
            {estudo.investimento && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metrica rotulo="Mensal" valor={`${brl(estudo.investimento.mensal)}/mês`}
                  detalhe={`${brl(estudo.investimento.doze)} em 12 parcelas`} />
                <Metrica rotulo="Anual à vista" valor={brl(estudo.investimento.anual)}
                  detalhe={estudo.investimento.temDescontoAnual
                    ? `equivale a ${brl(estudo.investimento.mensalEquivalente)}/mês`
                    : 'sem desconto informado'}
                  tom={estudo.investimento.temDescontoAnual ? 'bom' : 'neutro'} />
                <Metrica rotulo="Economia no anual"
                  valor={estudo.investimento.economiaAnual > 0 ? brl(estudo.investimento.economiaAnual) : '—'}
                  detalhe={estudo.investimento.descontoPct != null
                    ? `${String(estudo.investimento.descontoPct).replace('.', ',')}% de desconto` : 'cote o anual'}
                  tom={estudo.investimento.economiaAnual > 0 ? 'bom' : 'neutro'} />
                <Metrica rotulo="Peso na renda"
                  valor={estudo.investimento.pctRenda != null
                    ? `${String(estudo.investimento.pctRenda).replace('.', ',')}%` : '—'}
                  detalhe={`${brl(estudo.investimento.diario)} por dia`}
                  tom={estudo.investimento.pctRenda != null && estudo.investimento.pctRenda > 15 ? 'ruim' : 'neutro'} />
              </div>
            )}

            {/* Âncora de comparação: ele já destina dinheiro ao longo prazo */}
            {estudo.investimento && estudo.previdenciaAporte > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Ele já destina <strong>{brl(estudo.previdenciaAporte)}/mês</strong> à previdência.
                O plano custa{' '}
                <strong className="text-slate-700">
                  {Math.round((estudo.investimento.mensal / estudo.previdenciaAporte) * 100)}%
                </strong>{' '}
                disso — e é o único aporte que já vale o valor cheio no primeiro mês.
              </p>
            )}

            {/* O preço de deixar para depois — estimativa, nunca cotação */}
            {estudo.custoDaEspera && (
              <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                  <Clock3 size={15} className="text-amber-700" />
                  O preço de deixar para depois
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    estimativa
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Aos {estudo.custoDaEspera.idade} anos{estudo.custoDaEspera.fumante && ', fumante'}, o mesmo
                  plano custaria — pela curva de agravamento por idade. A cotação real vem da seguradora.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {estudo.custoDaEspera.cenarios.map((c) => (
                    <div key={c.daquiAAnos} className="rounded-lg bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        daqui a {c.daquiAAnos} ano{c.daquiAAnos > 1 ? 's' : ''} · {c.idadeNaEpoca} anos
                      </p>
                      <p className="font-display text-lg font-semibold tabular-nums text-slate-900">
                        {brl(c.mensal)}<span className="text-sm font-normal text-slate-400">/mês</span>
                      </p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        +{brl(c.aMaisPorMes)}/mês · {String(c.aMaisPct).replace('.', ',')}% a mais,
                        {' '}{brl(c.aMaisPorAno)} por ano
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  E o preço é a parte menor: a saúde de hoje é o melhor ativo dele na análise da
                  seguradora — e ela não volta.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Inteligência do estudo ───────────────────────────────────────── */}
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
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Autonomia com o que é líquido</p>
              <p className={`font-display text-lg font-semibold tabular-nums ${
                estudo.mesesLiquidos != null && estudo.mesesLiquidos < 24 ? 'text-red-700' : 'text-slate-900'}`}>
                {fmtMeses(estudo.mesesLiquidos)}
              </p>
              <p className="text-xs text-slate-400">
                {estudo.mesesLiquidos == null
                  ? 'detalhe o patrimônio por classe para separar o líquido do ilíquido'
                  : 'investimentos + previdência + seguro atual, sem vender nada'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Vendendo tudo que construiu</p>
              <p className="font-display text-lg font-semibold tabular-nums text-slate-900">
                {fmtMeses(estudo.mesesVendendoTudo)}
              </p>
              <p className="text-xs text-slate-400">inclusive a casa — e depois não sobra nada</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Com o plano</p>
              <p className="font-display text-lg font-semibold tabular-nums text-emerald-700">
                {fmtMeses(estudo.mesesComPlano)}
              </p>
              <p className="text-xs text-slate-400">e o patrimônio fica intacto</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Fôlego mensal</p>
              <p className={`font-display text-lg font-semibold tabular-nums ${
                (estudo.poupancaMensal ?? 0) < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                {estudo.poupancaMensal == null ? '—' : brl(estudo.poupancaMensal)}
              </p>
              <p className="text-xs text-slate-400">
                renda − custo de vida{estudo.comprometimentoRenda != null ? ` · ${estudo.comprometimentoRenda}% comprometida` : ''}
              </p>
            </div>
            {/* Janela de proteção: dois relógios correm juntos — o filho mais
                novo virando adulto e o titular chegando à aposentadoria. A
                proteção precisa cobrir o mais longo dos dois. */}
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Janela de proteção</p>
              {estudo.janelaProtecao ? (
                <>
                  <p className="font-display text-lg font-semibold tabular-nums text-slate-900">
                    {estudo.janelaProtecao.anos} anos
                  </p>
                  <p className="text-xs text-slate-400">
                    {estudo.janelaProtecao.motivo} —{' '}
                    {Number(plano.anos_protecao) === estudo.janelaProtecao.anos ? 'aplicado ✓' : (
                      <button type="button" className="font-semibold text-laranja-700 hover:underline"
                        onClick={() => setValor('anos_protecao', estudo.janelaProtecao.anos)}>
                        usar no estudo
                      </button>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold text-slate-300">—</p>
                  <p className="text-xs text-slate-400">
                    cadastre os filhos com as idades, ou a data de nascimento do cliente
                  </p>
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
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Gap de proteção</p>
              <p className={`font-display text-lg font-semibold tabular-nums ${
                estudo.gap > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {estudo.gap > 0 ? brlCompacto(estudo.gap) : 'Coberto ✓'}
              </p>
              <p className="text-xs text-slate-400">
                {estudo.recursosLiquidos > 0
                  ? `${brlCompacto(estudo.gapReal)} considerando a reserva líquida`
                  : 'capital recomendado − o que já possui'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Importância segurada total</p>
              <p className="font-display text-lg font-semibold tabular-nums text-slate-900">
                {brlCompacto(estudo.capitalTotal)}
              </p>
              <p className="text-xs text-slate-400">
                {estudo.ativas.filter((c) => c.soma).length} coberturas · até{' '}
                {brlCompacto(estudo.capitalMaximoEvento)} num único evento
                {estudo.totalDiarias > 0 && ` · + ${brlCompacto(estudo.totalDiarias)} em diárias`}
              </p>
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
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Proteção da família</p>
              <p className="font-semibold tabular-nums text-slate-900">{brlCompacto(estudo.valores.morte)}</p>
              {estudo.capitalFilhos > 0 ? (
                <p className="text-xs text-slate-500">
                  inclui {brlCompacto(estudo.capitalFilhos)} para os filhos até os {IDADE_INDEPENDENCIA}
                </p>
              ) : estudo.mesesProtegidos > 0 && (
                <p className="text-xs text-slate-500">{fmtMeses(estudo.mesesProtegidos)} de padrão de vida</p>
              )}
            </div>
            {tem014 && (
              <>
                <div>
                  <p className="text-xs text-slate-400">+ Sucessão (inventário)</p>
                  <p className="font-semibold tabular-nums text-slate-900">{brlCompacto(estudo.valores.sucessao)}</p>
                  <p className="text-xs text-slate-500">
                    {estudo.deficitLiquidez > 0
                      ? `${brlCompacto(estudo.deficitLiquidez)} de déficit sem o seguro`
                      : 'liquidez do inventário resolvida'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Já possui de cobertura</p>
                  <p className="font-semibold tabular-nums text-slate-900">{brlCompacto(estudo.coberturaAtual)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">
                    {estudo.temPJ ? 'Capital PF + PJ' : 'Importância segurada'}
                  </p>
                  <p className="font-semibold tabular-nums text-slate-900">{brlCompacto(estudo.capitalTotal)}</p>
                  {estudo.temPJ && estudo.capitalPJ > 0 && (
                    <p className="text-xs text-slate-500">
                      {brlCompacto(estudo.capitalPF)} pessoal · {brlCompacto(estudo.capitalPJ)} empresa
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <Campo label="Objetivos do cliente" dica="Aparecem na capa e no fechamento da proposta — clique para adicionar sugestões">
            <Textarea value={plano.objetivos ?? ''} onChange={set('objetivos')}
              placeholder="Ex.: garantir a faculdade dos filhos, proteger a empresa, planejamento sucessório..." />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OBJETIVOS_SUGERIDOS.map((o) => {
                const jaTem = String(plano.objetivos ?? '').toLowerCase().includes(o.toLowerCase())
                return (
                  <button key={o} type="button" disabled={jaTem}
                    onClick={() => {
                      const atual = String(plano.objetivos ?? '').trim()
                      setValor('objetivos', atual ? `${atual}; ${o}` : o)
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      jaTem
                        ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-laranja-300 hover:text-laranja-700'}`}>
                    {jaTem ? '✓ ' : '+ '}{o}
                  </button>
                )
              })}
            </div>
          </Campo>
          <Campo label="Notas da reunião">
            <Textarea value={plano.observacoes_reuniao ?? ''} onChange={set('observacoes_reuniao')} rows={4} />
          </Campo>
        </div>
        {/* Barra de ação fixa: o formulário é longo e é preenchido durante a
            reunião — salvar e gerar a proposta ficam sempre ao alcance, sem
            precisar rolar até o fim. */}
        <div className="sticky bottom-0 z-20 -mx-5 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
          <EstadoSalvamento estado={estadoSalvar} sujo={sujo} em={salvoEm} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit">Salvar planejamento</Button>
            <Link to={`/proposta/${idCliente}`}>
              <Button type="button" variant="secondary"><Presentation size={16} /> Proposta</Button>
            </Link>
          </div>
        </div>
      </form>
    </Card>
  )
}

// Diz, em uma linha, se o trabalho está guardado. Como o formulário se salva
// sozinho, a consultora precisa ver isso sem ter que confiar na memória.
function EstadoSalvamento({ estado, sujo, em }) {
  const hora = em
    ? em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null
  if (estado === 'erro') {
    return (
      <span className="flex items-center gap-1 text-sm text-red-700">
        <AlertTriangle size={15} /> Não consegui salvar — clique em salvar para tentar de novo
      </span>
    )
  }
  if (estado === 'salvando') {
    return (
      <span className="flex items-center gap-1 text-sm text-slate-500">
        <RefreshCw size={15} className="animate-spin" /> Salvando…
      </span>
    )
  }
  if (sujo) {
    return (
      <span className="flex items-center gap-1 text-sm text-slate-400">
        <Clock3 size={15} /> Alterações não salvas — guardo sozinho em instantes
      </span>
    )
  }
  if (estado === 'salvo') {
    return (
      <span className="flex items-center gap-1 text-sm text-emerald-700">
        <Check size={15} /> Salvo{hora ? ` às ${hora}` : ''}
      </span>
    )
  }
  // nada mudou desde que a tela abriu — o que está aqui já está no banco
  return (
    <span className="flex items-center gap-1 text-sm text-slate-400">
      <Check size={15} /> Tudo salvo — o rascunho se guarda sozinho
    </span>
  )
}

// Cartão de leitura do estudo: um número com o contexto que o explica.
function Metrica({ rotulo, valor, detalhe, tom = 'neutro' }) {
  const cor = tom === 'bom' ? 'text-emerald-700' : tom === 'ruim' ? 'text-red-700' : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`font-display text-lg font-semibold tabular-nums ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-400">{detalhe}</p>}
    </div>
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
            <Select aria-label="Tipo de contato" value={tipo} onChange={(e) => setTipo(e.target.value)}>
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
                  <button onClick={() => excluir(i)} className="rounded p-1 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100" title="Excluir">
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
    // mesma conversão da Agenda: hora local do campo → instante em UTC
    const { error } = await supabase.from('reunioes')
      .insert({ id_cliente: idCliente, data_hora: localParaISO(form.data_hora), notas: form.notas || null })
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
                <button onClick={() => excluir(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" title="Excluir reunião">
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
                  <button onClick={() => onExcluir(a)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" title="Excluir">
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
    // Sem conferir o erro, a tela dizia "Apólice excluída." e recarregava com
    // a apólice ainda lá. Numa apólice já ligada a comissão importada, a
    // exclusão é BARRADA por chave estrangeira — e ela precisa saber disso,
    // não ver um aviso verde mentindo.
    const { error } = await supabase.from('apolices').delete().eq('id', a.id)
    if (error) {
      toast.erro(/foreign key|violates/i.test(error.message)
        ? 'Esta apólice já tem comissão lançada e não pode ser excluída. Cancele-a em vez de excluir.'
        : `Não consegui excluir: ${error.message}`)
      return
    }
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
  const toast = useToast()

  const carregar = useCallback(() =>
    supabase.from('documentos').select('*').eq('id_cliente', idCliente)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocs(data ?? [])), [idCliente])

  useEffect(() => { carregar() }, [carregar])

  // O bucket do Supabase recusa 50 MB por padrão, e a mensagem que ele devolve
  // não diz isso. No iPad, "escolher arquivo" oferece a galeria: um vídeo de
  // quatro minutos entra aqui sem querer e a tela fica minutos "enviando" para
  // terminar em erro incompreensível.
  const LIMITE_MB = 25

  // O nome vira CHAVE no Storage. Acento, espaço, `#` e `?` são rotina em
  // arquivo brasileiro ("Apólice João #2.pdf") e quebram a chave ou o link
  // assinado que a busca depois. O nome bonito continua na coluna `nome`; o
  // que é sanitizado é só o caminho.
  const nomeSeguro = (nome) => nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80) || 'arquivo'

  async function enviar(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite reenviar o mesmo arquivo depois
    if (!arquivo) return
    setErro(null)
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      setErro(`"${arquivo.name}" tem ${(arquivo.size / 1048576).toFixed(1)} MB. `
        + `O limite é ${LIMITE_MB} MB — comprima o PDF ou envie em partes.`)
      return
    }
    setEnviando(true)
    const caminho = `${idCliente}/${Date.now()}-${nomeSeguro(arquivo.name)}`
    const up = await supabase.storage.from('documentos').upload(caminho, arquivo)
    if (up.error) {
      setErro(`Falha no upload: ${up.error.message}`)
      setEnviando(false)
      return
    }
    const { error } = await supabase.from('documentos').insert({
      id_cliente: idCliente, nome: arquivo.name, categoria,
      caminho, tamanho_bytes: arquivo.size, tipo_mime: arquivo.type,
    })
    if (error) {
      // O arquivo subiu mas o registro não entrou: sem esta limpeza ele fica
      // órfão no Storage para sempre, invisível na tela e ocupando espaço —
      // e ela veria a lista igual, achando que o envio simplesmente sumiu.
      await supabase.storage.from('documentos').remove([caminho])
      setErro(`O arquivo subiu mas não ficou registrado: ${error.message}. Tente de novo.`)
      setEnviando(false)
      return
    }
    setEnviando(false)
    toast.ok(`"${arquivo.name}" anexado.`)
    carregar()
  }

  async function baixar(doc) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.caminho, 120)
    // Sem este aviso o botão simplesmente não fazia nada: ela clicava, clicava
    // de novo, e concluía que o sistema estava travado.
    if (error || !data?.signedUrl) {
      toast.erro(`Não consegui abrir "${doc.nome}". ${error?.message ?? 'O arquivo pode ter sido removido do armazenamento.'}`)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function excluir(doc) {
    if (!window.confirm(`Excluir "${doc.nome}"?`)) return
    // A ordem importa: apaga primeiro o REGISTRO. Se o arquivo sumisse do
    // Storage e o registro ficasse, sobraria uma linha na tela que não abre.
    const { error } = await supabase.from('documentos').delete().eq('id', doc.id)
    if (error) { toast.erro(`Não consegui excluir: ${error.message}`); return }
    await supabase.storage.from('documentos').remove([doc.caminho])
    toast.ok('Documento excluído.')
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
          <Select aria-label="Categoria do documento" value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: 'auto' }}>
            {CATEGORIAS_DOC.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${enviando ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            <Upload size={16} /> {enviando ? 'Enviando...' : 'Enviar arquivo'}
            <input type="file" className="hidden" onChange={enviar} disabled={enviando} />
          </label>
        </div>
      </div>

      {erro && <p className="mb-3 text-sm text-red-700">{erro}</p>}

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
                <button onClick={() => excluir(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" title="Excluir">
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
  const estudo = plano ? calcularEstudo(plano, { dataNascimento: cliente.data_nascimento }) : null
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
      <div class="celula"><p>Patrimônio bruto</p><b>${estudo.patrimonioBruto > 0 ? brlCompacto(estudo.patrimonioBruto) : '—'}</b></div>
      <div class="celula"><p>Dívidas</p><b>${estudo.dividas > 0 ? brlCompacto(estudo.dividas) : '—'}</b></div>
      <div class="celula"><p>Trava no inventário</p><b>${brlCompacto(estudo.bensInventariaveis)}</b></div>
      <div class="celula"><p>Custo do inventário</p><b>${brlCompacto(estudo.custoInventario)}</b></div>
      <div class="celula"><p>Déficit de liquidez</p><b>${estudo.deficitLiquidez > 0 ? brlCompacto(estudo.deficitLiquidez) : 'Coberto ✓'}</b></div>
      <div class="celula"><p>Gap vs atual</p><b>${estudo.gap > 0 ? brlCompacto(estudo.gap) : 'Coberto ✓'}</b></div>
    </div>
    <h2>Coberturas do plano (${brlCompacto(estudo.capitalTotal)} de importância segurada)</h2>
    <table><tr><th>Cobertura</th><th>Valor</th><th>O que resolve</th></tr>
      ${estudo.ativas.map((c) => `<tr>
        <td>${esc(c.curto)}</td>
        <td class="num">${c.tipo === 'diaria'
          ? `${brl(c.valor)}/dia${c.dias ? ` · até ${c.dias} diárias` : ''}`
          : brl(c.valor)}</td>
        <td>${esc(c.descricao)}</td></tr>`).join('')}
    </table>
    ${estudo.investimento ? `<p style="margin-top:6px"><strong>Investimento:</strong>
      ${brl(estudo.investimento.mensal)}/mês${estudo.investimento.temDescontoAnual
        ? ` · ou ${brl(estudo.investimento.anual)} à vista no ano (economia de ${brl(estudo.investimento.economiaAnual)})`
        : ''}${estudo.investimento.pctRenda != null ? ` · ${String(estudo.investimento.pctRenda).replace('.', ',')}% da renda` : ''}</p>` : ''}
    ${estudo.temPJ && estudo.pj.valuation > 0 ? `<p style="margin-top:3px"><strong>Empresa:</strong>
      ${esc(estudo.pj.razaoSocial || 'sociedade')} · valuation ${brlCompacto(estudo.pj.valuation)} ·
      participação ${estudo.pj.participacao}% (${brlCompacto(estudo.pj.quota)})${
        estudo.pj.dividaAval > 0 ? ` · aval de ${brlCompacto(estudo.pj.dividaAval)}` : ''}</p>` : ''}
    ${estudo.inconsistencias.length > 0 ? `<div class="aviso"><strong>Revisar antes da reunião:</strong>
      ${estudo.inconsistencias.map((i) => esc(i.texto)).join(' · ')}</div>` : ''}
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
                      <span className={v === 'sim' ? 'font-semibold text-red-700' : 'text-slate-700'}>
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
                <button onClick={() => excluir(t)} className="rounded p-1.5 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100" title="Excluir">
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
                <td className={`py-2.5 text-right font-semibold ${acc.total < 0 ? 'text-red-700' : 'text-slate-900'}`}>
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
