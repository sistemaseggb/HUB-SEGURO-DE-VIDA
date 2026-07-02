import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck, ArrowRight, ArrowLeft, PartyPopper, Trash2, Plus, CloudUpload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS_FORM } from '../lib/formularioConfig'

// Formulário público de onboarding — o cliente acessa pelo link /f/<token>.
// Uma etapa curta por vez, progresso visível e salvamento automático:
// se fechar o navegador, continua exatamente de onde parou.
export default function FormularioPublico() {
  const { token } = useParams()
  const [estado, setEstado] = useState('carregando') // carregando | ativo | concluido | erro
  const [nome, setNome] = useState('')
  const [etapa, setEtapa] = useState(-1) // -1 = tela de boas-vindas
  const [respostas, setRespostas] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [erroCampo, setErroCampo] = useState(null)

  useEffect(() => {
    supabase.rpc('fn_form_carregar', { p_token: token }).then(({ data, error }) => {
      if (error || data?.erro) return setEstado('erro')
      setNome(data.primeiro_nome ?? '')
      setRespostas(data.respostas ?? {})
      if (data.status === 'concluido') return setEstado('concluido')
      setEtapa(data.etapa_atual > 0 ? Math.min(data.etapa_atual, ETAPAS_FORM.length - 1) : -1)
      setEstado('ativo')
    })
  }, [token])

  const definicao = etapa >= 0 ? ETAPAS_FORM[etapa] : null
  const progresso = useMemo(
    () => Math.round(((etapa + 1) / (ETAPAS_FORM.length + 1)) * 100),
    [etapa]
  )

  async function salvar(novaEtapa, concluido = false) {
    setSalvando(true)
    await supabase.rpc('fn_form_salvar', {
      p_token: token, p_respostas: respostas, p_etapa: Math.max(novaEtapa, 0), p_concluido: concluido,
    })
    setSalvando(false)
    if (concluido) setEstado('concluido')
    else setEtapa(novaEtapa)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function validarEtapa() {
    for (const campo of definicao.campos) {
      if (!campo.obrigatorio) continue
      const v = respostas[campo.id]
      if (v === undefined || v === null || v === '') {
        setErroCampo(campo.id)
        return false
      }
    }
    setErroCampo(null)
    return true
  }

  function avancar() {
    if (!validarEtapa()) return
    const ultima = etapa === ETAPAS_FORM.length - 1
    salvar(ultima ? etapa : etapa + 1, ultima)
  }

  // ── telas de estado ──
  if (estado === 'carregando') {
    return <TelaCentro><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" /></TelaCentro>
  }
  if (estado === 'erro') {
    return (
      <TelaCentro>
        <p className="text-lg font-semibold text-slate-800">Link inválido ou expirado</p>
        <p className="mt-2 text-sm text-slate-500">Fale com a Natália para receber um novo link.</p>
      </TelaCentro>
    )
  }
  if (estado === 'concluido') {
    return (
      <TelaCentro>
        <PartyPopper size={48} className="text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Tudo certo{nome ? `, ${nome}` : ''}! 🎉</h1>
        <p className="mt-2 max-w-md text-slate-600">
          Recebemos seus dados. A Natália vai cuidar de todo o resto e te avisa
          assim que sua apólice estiver emitida. Você não precisa fazer mais nada!
        </p>
      </TelaCentro>
    )
  }

  // ── boas-vindas ──
  if (etapa === -1) {
    return (
      <TelaCentro>
        <div className="rounded-2xl bg-blue-600 p-4 text-white"><ShieldCheck size={36} /></div>
        <h1 className="mt-5 text-3xl font-bold text-slate-900">
          {nome ? `Olá, ${nome}!` : 'Olá!'} 👋
        </h1>
        <p className="mt-3 max-w-md text-lg text-slate-600">
          Falta pouco para sua proteção estar ativa. São <strong>{ETAPAS_FORM.length} etapas rápidas</strong> —
          cerca de 5 minutos — e tudo é salvo automaticamente: pode parar e voltar quando quiser.
        </p>
        <button onClick={() => salvar(0)}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">
          Começar <ArrowRight size={20} />
        </button>
        <p className="mt-4 text-xs text-slate-400">Seus dados são confidenciais e usados só para a emissão da apólice.</p>
      </TelaCentro>
    )
  }

  // ── wizard ──
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 to-white">
      {/* barra de progresso */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur">
        <div className="h-1.5 bg-slate-100">
          <div className="h-1.5 rounded-r-full bg-blue-600 transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2 text-xs text-slate-400">
          <span>Etapa {etapa + 1} de {ETAPAS_FORM.length}</span>
          <span className="flex items-center gap-1">
            {salvando ? <><CloudUpload size={13} className="animate-pulse" /> salvando...</> : 'progresso salvo ✓'}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">{definicao.titulo}</h1>
        <p className="mt-1 text-slate-500">{definicao.descricao}</p>

        <div className="mt-6 space-y-5">
          {definicao.campos.map((campo) => (
            <CampoWizard key={campo.id} campo={campo} respostas={respostas}
              erro={erroCampo === campo.id}
              onChange={(v) => setRespostas({ ...respostas, [campo.id]: v })} />
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={() => salvar(etapa - 1)} disabled={etapa === 0 || salvando}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            <ArrowLeft size={16} /> Voltar
          </button>
          <button onClick={avancar} disabled={salvando}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-60">
            {etapa === ETAPAS_FORM.length - 1 ? 'Enviar tudo 🎉' : 'Continuar'} <ArrowRight size={18} />
          </button>
        </div>
        {erroCampo && <p className="mt-3 text-right text-sm text-red-600">Preencha os campos destacados para continuar.</p>}
      </div>
    </div>
  )
}

function TelaCentro({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50/60 to-white p-6 text-center">
      {children}
    </div>
  )
}

const inputWizard = (erro) =>
  `w-full rounded-xl border-2 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-300 focus:outline-none ${
    erro ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'}`

function CampoWizard({ campo, respostas, onChange, erro }) {
  const valor = respostas[campo.id] ?? ''

  // campo condicional: só aparece se a pergunta da qual depende foi "sim"
  if (campo.dependeDe && respostas[campo.dependeDe] !== 'sim') return null

  if (campo.tipo === 'simnao') {
    return (
      <div>
        <p className={`mb-2 font-medium ${erro ? 'text-red-600' : 'text-slate-700'}`}>
          {campo.rotulo} {campo.obrigatorio && '*'}
        </p>
        <div className="flex gap-3">
          {[['sim', 'Sim'], ['nao', 'Não']].map(([v, r]) => (
            <button key={v} type="button" onClick={() => onChange(v)}
              className={`flex-1 rounded-xl border-2 py-3 font-medium transition ${
                valor === v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (campo.tipo === 'select') {
    return (
      <label className="block">
        <span className={`mb-2 block font-medium ${erro ? 'text-red-600' : 'text-slate-700'}`}>
          {campo.rotulo} {campo.obrigatorio && '*'}
        </span>
        <select className={inputWizard(erro)} value={valor} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione...</option>
          {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    )
  }

  if (campo.tipo === 'textarea') {
    return (
      <label className="block">
        <span className={`mb-2 block font-medium ${erro ? 'text-red-600' : 'text-slate-700'}`}>
          {campo.rotulo} {campo.obrigatorio && '*'}
        </span>
        <textarea rows={3} className={inputWizard(erro)} value={valor}
          onChange={(e) => onChange(e.target.value)} placeholder={campo.placeholder} />
      </label>
    )
  }

  if (campo.tipo === 'beneficiarios') {
    const lista = Array.isArray(respostas.beneficiarios) ? respostas.beneficiarios : []
    const atualizar = (i, k, v) => {
      const nova = lista.map((b, j) => (j === i ? { ...b, [k]: v } : b))
      onChange(nova)
    }
    return (
      <div className="space-y-3">
        {lista.map((b, i) => (
          <div key={i} className="rounded-xl border-2 border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">Beneficiário {i + 1}</p>
              <button type="button" onClick={() => onChange(lista.filter((_, j) => j !== i))}
                className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputWizard(false)} placeholder="Nome completo" value={b.nome ?? ''}
                onChange={(e) => atualizar(i, 'nome', e.target.value)} />
              <input className={inputWizard(false)} placeholder="Parentesco (ex.: filho)" value={b.relacao ?? ''}
                onChange={(e) => atualizar(i, 'relacao', e.target.value)} />
              <input className={inputWizard(false)} placeholder="CPF (se tiver)" value={b.cpf ?? ''}
                onChange={(e) => atualizar(i, 'cpf', e.target.value)} />
              <input className={inputWizard(false)} type="number" placeholder="% do capital" value={b.percentual ?? ''}
                onChange={(e) => atualizar(i, 'percentual', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...lista, {}])}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600">
          <Plus size={18} /> Adicionar beneficiário
        </button>
      </div>
    )
  }

  return (
    <label className="block">
      <span className={`mb-2 block font-medium ${erro ? 'text-red-600' : 'text-slate-700'}`}>
        {campo.rotulo} {campo.obrigatorio && '*'}
      </span>
      <input type={campo.tipo} className={inputWizard(erro)} value={valor}
        onChange={(e) => onChange(e.target.value)} placeholder={campo.placeholder} />
    </label>
  )
}
