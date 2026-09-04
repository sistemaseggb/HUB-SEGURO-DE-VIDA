import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ShieldCheck, ArrowRight, ArrowLeft, PartyPopper, Trash2, Plus, CloudUpload,
  Check, Pencil, AlertCircle, Scale,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { InputMoeda } from '../components/ui'
import { ORIGENS_SEGURO } from '../lib/estudo'
import { PARENTESCOS } from '../lib/beneficiarios'
import {
  ETAPAS_PLANO, etapasVisiveis, camposVisiveis, validarEtapa, resumoRespostas,
  normalizarRespostas, limparBeneficiarios, LIMITE_TEXTO,
} from '../lib/planejamentoPublico'

// ─────────────────────────────────────────────────────────────────────────────
// O PLANEJAMENTO PREENCHIDO PELO PRÓPRIO CLIENTE — `/pl/<token>`
//
// O irmão do formulário de DPS (`/f/<token>`), para o cliente que compra e não
// vai a reunião. Mesma promessa: etapas curtas, progresso salvo sozinho, sem
// login, funciona no celular. As perguntas e as regras moram em
// `src/lib/planejamentoPublico.js`; esta tela é só a conversa.
//
// Três coisas aqui existem porque ele está SOZINHO — não há consultora ao lado
// para explicar nada:
//
//   · NADA SEGUE COM ERRO. Cada etapa é conferida antes de avançar, e o erro
//     aparece embaixo do campo, com o que fazer. O envio final reconfere TUDO
//     de novo: o cliente não pode descobrir no último clique que algo quebrou.
//   · TEM REVISÃO NO FIM. Ele lê o que respondeu e pode voltar a qualquer
//     bloco. Um zero a mais na renda vira um estudo inteiro errado, e o único
//     momento barato de pegar isso é antes de enviar.
//   · SALVA SOZINHO ENQUANTO DIGITA. Não só ao trocar de etapa: o celular
//     toca, ele sai do navegador, e vinte minutos de formulário não podem ir
//     junto.
// ─────────────────────────────────────────────────────────────────────────────

const ESPERA_AUTOSALVAR = 1800

// Quantos blocos prometer na abertura. Dois deles só existem para quem tem
// patrimônio ou empresa, então o número exato ainda não é conhecido: dizer
// "10" para quem vai ver 12 é pequeno, mas é o tipo de coisa que faz alguém
// desconfiar do resto do formulário na metade do caminho.
const MENOS_BLOCOS = etapasVisiveis({}).length
const MAIS_BLOCOS = ETAPAS_PLANO.length
const QUANTOS_BLOCOS = MENOS_BLOCOS === MAIS_BLOCOS
  ? `${MAIS_BLOCOS} blocos curtos`
  : `${MENOS_BLOCOS} a ${MAIS_BLOCOS} blocos curtos`

export default function PlanejamentoPublico() {
  const { token } = useParams()
  const [estado, setEstado] = useState('carregando') // carregando | ativo | concluido | erro
  const [nome, setNome] = useState('')
  const [etapa, setEtapa] = useState(-1) // -1 = boas-vindas; length = revisão
  const [respostas, setRespostas] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [falhaEnvio, setFalhaEnvio] = useState(null)
  // Uma gravação que falhou no metrô não pode continuar dizendo "salvo ✓": o
  // cliente fecharia a aba confiando num recado falso.
  const [semGravar, setSemGravar] = useState(false)

  const visiveis = useMemo(() => etapasVisiveis(respostas), [respostas])
  // A lista de etapas encolhe quando o cliente muda de ideia (tirou a empresa
  // do planejamento, por exemplo). Sem esta trava ele ficaria num índice que
  // não existe mais — tela em branco no meio do formulário.
  const totalEtapas = visiveis.length
  const etapaSegura = Math.min(etapa, totalEtapas)
  const definicao = etapaSegura >= 0 && etapaSegura < totalEtapas ? visiveis[etapaSegura] : null
  const naRevisao = etapaSegura === totalEtapas && estado === 'ativo' && etapa >= 0

  useEffect(() => {
    let vivo = true
    supabase.rpc('fn_plan_carregar', { p_token: token }).then(({ data, error }) => {
      if (!vivo) return
      if (error || !data || data.erro) return setEstado('erro')
      const salvas = data.respostas ?? {}
      setNome(data.primeiro_nome ?? '')
      setRespostas(salvas)
      if (data.status === 'concluido') return setEstado('concluido')
      const max = etapasVisiveis(salvas).length
      const retomar = Number(data.etapa_atual) || 0
      setEtapa(retomar > 0 ? Math.min(retomar, max) : -1)
      setEstado('ativo')
    })
    return () => { vivo = false }
  }, [token])

  const gravar = useCallback(async (novasRespostas, novaEtapa, { concluir = false } = {}) => {
    const corpo = concluir ? normalizarRespostas(novasRespostas) : novasRespostas
    const { data, error } = await supabase.rpc('fn_plan_salvar', {
      p_token: token,
      p_respostas: corpo,
      p_etapa: Math.max(novaEtapa, 0),
      p_concluido: concluir,
    })
    // A RPC devolve `{erro}` em vez de estourar quando o token já foi usado.
    if (error) return { ok: false, motivo: error.message }
    if (data?.erro) return { ok: false, motivo: data.erro }
    return { ok: true }
  }, [token])

  // ── Salva sozinho pouco depois que ele para de digitar ────────────────────
  useEffect(() => {
    if (estado !== 'ativo' || etapa < 0) return undefined
    const t = setTimeout(async () => {
      setSalvando(true)
      const r = await gravar(respostas, etapa)
      setSalvando(false)
      // Link já concluído noutra aba não é falha de rede: aí a tela de
      // agradecimento é a resposta certa, não um aviso de conexão.
      if (r.motivo === 'planejamento_nao_encontrado_ou_concluido') return setEstado('concluido')
      setSemGravar(!r.ok)
    }, ESPERA_AUTOSALVAR)
    return () => clearTimeout(t)
  }, [respostas, etapa, estado, gravar])

  // Fechar a aba com algo pendente pede confirmação — e o navegador ainda
  // consegue disparar a última gravação.
  useEffect(() => {
    const aviso = (e) => {
      if (estado !== 'ativo' || etapa < 0) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [estado, etapa])

  const setCampo = useCallback((id, valor) => {
    setRespostas((atual) => ({ ...atual, [id]: valor }))
    // o erro daquele campo some assim que ele mexe: manter o vermelho aceso
    // enquanto a pessoa corrige é castigo, não ajuda
    setErros((atuais) => atuais.filter((e) => e.campo !== id && !e.campo.startsWith(`${id}.`)))
  }, [])

  async function irPara(destino, { validar = true } = {}) {
    if (validar && definicao) {
      const problemas = validarEtapa(definicao, respostas)
      if (problemas.length > 0) {
        setErros(problemas)
        focarPrimeiroErro(problemas[0].campo)
        return
      }
    }
    setErros([])
    setSalvando(true)
    const r = await gravar(respostas, destino)
    setSalvando(false)
    setSemGravar(!r.ok)
    setEtapa(destino)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── O envio final ─────────────────────────────────────────────────────────
  // Reconfere TODAS as etapas visíveis, não só a última. Se alguma coisa não
  // fecha, ele é levado de volta ao bloco exato em vez de receber um "erro ao
  // enviar" que não diz nada.
  async function enviar() {
    const pendencias = visiveis
      .map((e, i) => ({ etapa: e, indice: i, problemas: validarEtapa(e, respostas) }))
      .filter((x) => x.problemas.length > 0)

    if (pendencias.length > 0) {
      const primeira = pendencias[0]
      setErros(primeira.problemas)
      setEtapa(primeira.indice)
      setFalhaEnvio(`Falta ajustar algo em "${primeira.etapa.titulo}".`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setEnviando(true)
    setFalhaEnvio(null)
    const r = await gravar(respostas, totalEtapas, { concluir: true })
    setEnviando(false)
    if (!r.ok) {
      setFalhaEnvio('Não conseguimos enviar agora. Confira sua conexão e tente de novo — '
        + 'suas respostas estão salvas.')
      return
    }
    setSemGravar(false)
    setEstado('concluido')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Telas de estado ───────────────────────────────────────────────────────
  if (estado === 'carregando') {
    return (
      <TelaCentro>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </TelaCentro>
    )
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
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-200">
          <PartyPopper size={44} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-slate-900">
          Recebido{nome ? `, ${nome}` : ''}! 🎉
        </h1>
        <p className="mt-3 max-w-md text-lg text-slate-600">
          A Natália já tem tudo o que precisa para montar o seu estudo. Ela volta com a
          proposta pronta — <strong>e você não precisa marcar nada.</strong>
        </p>
        <p className="mt-8 flex items-center gap-2 text-sm text-slate-400">
          <ShieldCheck size={16} className="text-emerald-500" /> Seus dados estão protegidos.
        </p>
      </TelaCentro>
    )
  }

  // ── Boas-vindas ───────────────────────────────────────────────────────────
  if (etapa === -1) {
    return (
      <TelaCentro>
        <div className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-lg shadow-brand-200">
          <img src="/logo.png" srcSet="/logo-256.png 256w, /logo-512.png 512w, /logo.png 1400w" sizes="130px"
            alt="GB | XP" className="h-12 object-contain" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-brand-600">
          Natália Maschendorf · Seguro de Vida
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-900">
          {nome ? `Olá, ${nome}!` : 'Olá!'} 👋
        </h1>
        <p className="mt-4 max-w-md text-lg text-slate-600">
          Sem reunião, sem apresentação: você responde aqui, no seu tempo, e a Natália
          monta o seu planejamento a partir do que você contar. São{' '}
          <strong>{QUANTOS_BLOCOS}</strong> — cerca de 10 minutos — e tudo é
          salvo automaticamente.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[['🔒', 'Confidencial'], ['⏱️', '~10 minutos'], ['💾', 'Salva sozinho'], ['📱', 'Pelo celular']]
            .map(([e, t]) => (
              <span key={t} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-card ring-1 ring-slate-200/70">
                {e} {t}
              </span>
            ))}
        </div>
        <p className="mt-5 max-w-md text-sm text-slate-400">
          Valores aproximados já servem. Nada aqui é compromisso de compra — é o
          diagnóstico que define quanta proteção faz sentido para você.
        </p>
        <button onClick={() => irPara(0, { validar: false })}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700 active:scale-[0.98]">
          Começar <ArrowRight size={20} />
        </button>
      </TelaCentro>
    )
  }

  const progresso = Math.round(((etapaSegura + 1) / (totalEtapas + 1)) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/50 to-white">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 pt-3">
          <img src="/logo-gb.png" srcSet="/logo-gb-96.png 96w, /logo-gb-192.png 192w, /logo-gb.png 800w" sizes="24px"
            alt="GB" className="h-6 w-6 object-contain" />
          <span className="font-display text-sm font-semibold text-slate-800">Hub Seguros</span>
          <span className="text-xs text-slate-400">· Natália Maschendorf</span>
        </div>
        <div className="mx-auto mt-3 max-w-xl px-4">
          <div className="h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-laranja-500 to-laranja-400 transition-all duration-500"
              style={{ width: `${progresso}%` }} />
          </div>
        </div>
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2 text-xs text-slate-400">
          <span>{naRevisao ? 'Revisão final' : `Bloco ${etapaSegura + 1} de ${totalEtapas}`}</span>
          <span className="flex items-center gap-1">
            {salvando
              ? <><CloudUpload size={13} className="animate-pulse" /> salvando...</>
              : semGravar
                ? <span className="flex items-center gap-1 font-medium text-amber-600">
                    <AlertCircle size={13} /> sem conexão — tentando de novo
                  </span>
                : 'progresso salvo ✓'}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-8">
        {naRevisao ? (
          <Revisao respostas={respostas} visiveis={visiveis}
            onEditar={(i) => irPara(i, { validar: false })}
            onEnviar={enviar} enviando={enviando} falha={falhaEnvio}
            onVoltar={() => irPara(totalEtapas - 1, { validar: false })} />
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              {definicao.titulo}
            </h1>
            <p className="mt-1 text-slate-500">{definicao.descricao}</p>

            {falhaEnvio && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {falhaEnvio}
              </p>
            )}

            <div className="mt-6 space-y-6">
              {camposVisiveis(definicao, respostas).map((campo) => (
                <CampoPlano key={campo.id} campo={campo} respostas={respostas}
                  erros={erros} onChange={setCampo} />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button type="button" onClick={() => irPara(etapaSegura - 1, { validar: false })}
                disabled={etapaSegura === 0 || salvando}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                <ArrowLeft size={16} /> Voltar
              </button>
              <button type="button" onClick={() => irPara(etapaSegura + 1)} disabled={salvando}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white shadow-md shadow-brand-200 transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60">
                {etapaSegura === totalEtapas - 1 ? 'Revisar tudo' : 'Continuar'} <ArrowRight size={18} />
              </button>
            </div>

            {erros.length > 0 && (
              <p className="mt-3 text-right text-sm text-red-600">
                Ajuste o que está em vermelho para continuar.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Rola até o campo com problema. Sem isto, num formulário longo o erro pode
// estar acima da dobra e a pessoa clica em "continuar" achando que travou.
function focarPrimeiroErro(campo) {
  setTimeout(() => {
    const alvo = document.querySelector(`[data-campo="${CSS.escape(String(campo).split('.')[0])}"]`)
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 60)
}

function TelaCentro({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50/60 to-white p-6 text-center">
      {children}
    </div>
  )
}

// ─── Aparência dos campos ────────────────────────────────────────────────────
const inputWizard = (erro) =>
  `w-full rounded-xl border-2 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-300 focus:outline-none ${
    erro ? 'border-red-400' : 'border-slate-200 focus:border-brand-500'}`

const inputMenor = 'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 focus:border-brand-500 focus:outline-none'

function Rotulo({ campo, erro }) {
  return (
    <span className={`mb-2 block font-medium ${erro ? 'text-red-600' : 'text-slate-700'}`}>
      {campo.rotulo}{campo.obrigatorio && ' *'}
    </span>
  )
}

function Dica({ children }) {
  if (!children) return null
  return <span className="mt-1.5 block text-sm text-slate-400">{children}</span>
}

function Erro({ mensagem }) {
  if (!mensagem) return null
  return (
    <span className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-600">
      <AlertCircle size={14} className="mt-0.5 shrink-0" /> {mensagem}
    </span>
  )
}

// ─── UM CAMPO ────────────────────────────────────────────────────────────────
function CampoPlano({ campo, respostas, erros, onChange }) {
  const valor = respostas[campo.id]
  const erro = erros.find((e) => e.campo === campo.id)?.mensagem
  const mudar = (v) => onChange(campo.id, v)
  const errosDaLista = erros.filter((e) => e.campo.startsWith(`${campo.id}.`))

  const corpo = () => {
    switch (campo.tipo) {
      case 'escolha':
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            {campo.opcoes.map((o) => {
              const ativo = valor === o.valor
              return (
                <button key={o.valor} type="button" onClick={() => mudar(o.valor)}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    ativo ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <span className={`block font-semibold ${ativo ? 'text-brand-700' : 'text-slate-700'}`}>
                    {o.rotulo}
                  </span>
                  {o.nota && <span className="mt-1 block text-sm text-slate-500">{o.nota}</span>}
                </button>
              )
            })}
          </div>
        )

      case 'chips':
        return (
          <div className="grid gap-2.5">
            {campo.opcoes.map((o) => {
              const lista = Array.isArray(valor) ? valor : []
              const ativo = lista.includes(o.valor)
              return (
                <button key={o.valor} type="button"
                  onClick={() => mudar(ativo ? lista.filter((x) => x !== o.valor) : [...lista, o.valor])}
                  className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                    ativo ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    ativo ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                    {ativo && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span>
                    <span className={`block font-medium ${ativo ? 'text-brand-700' : 'text-slate-700'}`}>
                      {o.rotulo}
                    </span>
                    {o.nota && <span className="block text-sm text-slate-500">{o.nota}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )

      case 'simnao':
        return (
          <div className="flex gap-3">
            {[[true, 'Sim'], [false, 'Não']].map(([v, r]) => (
              <button key={r} type="button" onClick={() => mudar(v)}
                className={`flex-1 rounded-xl border-2 py-3 font-medium transition ${
                  valor === v ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                {r}
              </button>
            ))}
          </div>
        )

      case 'select':
        return (
          <select className={inputWizard(!!erro)} value={valor ?? ''} onChange={(e) => mudar(e.target.value)}>
            <option value="">Selecione...</option>
            {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )

      case 'moeda':
        return <InputMoeda value={valor ?? ''} onChange={(e) => mudar(e.target.value)}
          className={`${inputWizard(!!erro)} pl-11 tabular`} />

      case 'inteiro':
      case 'decimal':
      case 'percentual':
        return (
          <div className="relative">
            <input type="text" inputMode={campo.tipo === 'inteiro' ? 'numeric' : 'decimal'}
              className={`${inputWizard(!!erro)} tabular ${campo.sufixo ? 'pr-16' : ''}`}
              placeholder={campo.placeholder} value={valor ?? ''}
              onChange={(e) => mudar(e.target.value.replace(/[^\d,.]/g, ''))} />
            {campo.sufixo && (
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-400">
                {campo.sufixo}
              </span>
            )}
          </div>
        )

      case 'textarea':
        return <textarea rows={3} className={inputWizard(!!erro)} value={valor ?? ''}
          maxLength={campo.limite} placeholder={campo.placeholder}
          onChange={(e) => mudar(e.target.value)} />

      case 'filhos':
        return <ListaFilhos lista={valor} erros={errosDaLista} onChange={mudar} />

      case 'seguros':
        return <ListaSeguros lista={valor} onChange={mudar} />

      case 'beneficiarios':
        return <ListaBeneficiarios lista={valor} erros={errosDaLista} onChange={mudar} />

      default:
        return <input type="text" className={inputWizard(!!erro)} value={valor ?? ''}
          maxLength={campo.limite} placeholder={campo.placeholder}
          onChange={(e) => mudar(e.target.value)} />
    }
  }

  // As listas trazem o próprio rótulo dentro e não o repetem aqui. E só os
  // campos de digitação viram <label>: envolver botões (sim/não, chips) num
  // label faria o clique disparar duas vezes.
  const semRotulo = ['filhos', 'seguros', 'beneficiarios'].includes(campo.tipo)
  const Caixa = ['escolha', 'chips', 'simnao', 'filhos', 'seguros', 'beneficiarios']
    .includes(campo.tipo) ? 'div' : 'label'

  return (
    <Caixa data-campo={campo.id} className="block">
      {!semRotulo && <Rotulo campo={campo} erro={!!erro} />}
      {corpo()}
      <Erro mensagem={erro} />
      <Dica>{campo.dica}</Dica>
    </Caixa>
  )
}

// ─── LISTAS ──────────────────────────────────────────────────────────────────
function CartaoLista({ titulo, onRemover, children }) {
  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">{titulo}</p>
        <button type="button" onClick={onRemover}
          className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">
          <Trash2 size={16} />
        </button>
      </div>
      {children}
    </div>
  )
}

function BotaoAdicionar({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600">
      <Plus size={18} /> {children}
    </button>
  )
}

function ListaFilhos({ lista, erros, onChange }) {
  const itens = Array.isArray(lista) ? lista : []
  const atualizar = (i, k, v) => onChange(itens.map((f, j) => (j === i ? { ...f, [k]: v } : f)))
  const erroDe = (i, k) => erros.find((e) => e.campo === `dependentes.${i}.${k}`)?.mensagem

  return (
    <div className="space-y-3">
      {itens.map((f, i) => (
        <CartaoLista key={i} titulo={`Filho ou dependente ${i + 1}`}
          onRemover={() => onChange(itens.filter((_, j) => j !== i))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Nome</span>
              <input className={inputMenor} placeholder="Como você o chama" value={f.nome ?? ''}
                maxLength={LIMITE_TEXTO.nome_filho}
                onChange={(e) => atualizar(i, 'nome', e.target.value)} />
              <Erro mensagem={erroDe(i, 'nome')} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Idade</span>
              <input className={`${inputMenor} tabular`} inputMode="numeric" placeholder="anos"
                value={f.idade ?? ''}
                onChange={(e) => atualizar(i, 'idade', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              <Erro mensagem={erroDe(i, 'idade')} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Quanto custa por mês hoje (escola, saúde, atividades)
              </span>
              <InputMoeda value={f.custo_mensal ?? ''} className={`${inputMenor} pl-9 tabular`}
                onChange={(e) => atualizar(i, 'custo_mensal', e.target.value)} />
            </label>
          </div>
        </CartaoLista>
      ))}
      <BotaoAdicionar onClick={() => onChange([...itens, { nome: '', idade: '', custo_mensal: '' }])}>
        Adicionar filho ou dependente
      </BotaoAdicionar>
    </div>
  )
}

function ListaSeguros({ lista, onChange }) {
  const itens = Array.isArray(lista) ? lista : []
  const atualizar = (i, k, v) => onChange(itens.map((s, j) => (j === i ? { ...s, [k]: v } : s)))

  return (
    <div className="space-y-3">
      {itens.map((s, i) => (
        <CartaoLista key={i} titulo={`Seguro ${i + 1}`}
          onRemover={() => onChange(itens.filter((_, j) => j !== i))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">De onde vem</span>
              <select className={inputMenor} value={s.origem ?? 'individual'}
                onChange={(e) => atualizar(i, 'origem', e.target.value)}>
                {ORIGENS_SEGURO.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Seguradora ou apelido</span>
              <input className={inputMenor} placeholder="Ex.: vida em grupo da empresa"
                maxLength={LIMITE_TEXTO.descricao_seguro}
                value={s.descricao ?? ''} onChange={(e) => atualizar(i, 'descricao', e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Valor coberto</span>
              <InputMoeda value={s.capital ?? ''} className={`${inputMenor} pl-9 tabular`}
                onChange={(e) => atualizar(i, 'capital', e.target.value)} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 sm:col-span-2">
              <input type="checkbox" checked={s.custeio === 'empresa'}
                onChange={(e) => atualizar(i, 'custeio', e.target.checked ? 'empresa' : 'proprio')}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Quem paga é a empresa
            </label>
          </div>
        </CartaoLista>
      ))}
      <BotaoAdicionar onClick={() => onChange([...itens, { origem: 'individual', descricao: '', capital: '', custeio: 'proprio' }])}>
        Adicionar seguro que já tenho
      </BotaoAdicionar>
    </div>
  )
}

function ListaBeneficiarios({ lista, erros, onChange }) {
  const itens = Array.isArray(lista) ? lista : []
  const atualizar = (i, k, v) => onChange(itens.map((b, j) => (j === i ? { ...b, [k]: v } : b)))
  const erroDe = (i, k) => erros.find((e) => e.campo === `beneficiarios.${i}.${k}`)?.mensagem
  const soma = limparBeneficiarios(itens).reduce((s, b) => s + b.pct, 0)
  const fecha = itens.length === 0 || Math.abs(soma - 100) <= 0.05

  // Dividir em partes iguais é o pedido mais comum e o mais chato de fazer no
  // celular. A sobra da divisão vai para o primeiro, para a soma fechar 100 —
  // três beneficiários dão 33,34 + 33,33 + 33,33.
  const dividirIgual = () => {
    if (itens.length === 0) return
    const base = Math.floor((100 / itens.length) * 100) / 100
    const sobra = Math.round((100 - base * itens.length) * 100) / 100
    onChange(itens.map((b, i) => ({ ...b, pct: i === 0 ? base + sobra : base })))
  }

  return (
    <div className="space-y-3">
      {itens.map((b, i) => (
        <CartaoLista key={i} titulo={`Beneficiário ${i + 1}`}
          onRemover={() => onChange(itens.filter((_, j) => j !== i))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">Nome completo</span>
              <input className={inputMenor} value={b.nome ?? ''}
                maxLength={LIMITE_TEXTO.nome_beneficiario}
                onChange={(e) => atualizar(i, 'nome', e.target.value)} />
              <Erro mensagem={erroDe(i, 'nome')} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Parentesco</span>
              <select className={inputMenor} value={b.parentesco ?? ''}
                onChange={(e) => atualizar(i, 'parentesco', e.target.value)}>
                <option value="">Selecione...</option>
                {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Percentual do capital</span>
              <div className="relative">
                <input className={`${inputMenor} tabular pr-8`} inputMode="decimal" value={b.pct ?? ''}
                  onChange={(e) => atualizar(i, 'pct', e.target.value.replace(/[^\d,.]/g, ''))} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">%</span>
              </div>
              <Erro mensagem={erroDe(i, 'pct')} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Data de nascimento <span className="text-slate-300">(opcional)</span>
              </span>
              <input type="date" className={inputMenor} value={b.nascimento ?? ''}
                onChange={(e) => atualizar(i, 'nascimento', e.target.value)} />
            </label>
          </div>
        </CartaoLista>
      ))}

      {itens.length > 0 && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-3.5 ${
          fecha ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`flex items-center gap-2 text-sm font-medium ${fecha ? 'text-emerald-700' : 'text-amber-800'}`}>
            <Scale size={15} />
            Soma: <span className="tabular font-bold">{Number(soma.toFixed(2)).toLocaleString('pt-BR')}%</span>
            {!fecha && ' — precisa fechar 100%'}
          </p>
          {itens.length > 1 && (
            <button type="button" onClick={dividirIgual}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400">
              Dividir igualmente
            </button>
          )}
        </div>
      )}

      <BotaoAdicionar onClick={() => onChange([...itens, { nome: '', parentesco: '', pct: '', nascimento: '' }])}>
        Adicionar beneficiário
      </BotaoAdicionar>

      {itens.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-sm text-slate-400">
          Não indicou ninguém? Sem problema — por lei o capital vai para os herdeiros legais.
        </p>
      )}
    </div>
  )
}

// ─── REVISÃO FINAL ───────────────────────────────────────────────────────────
// O último passo antes de enviar. Um zero a mais na renda vira um estudo
// inteiro errado, e este é o único momento barato de pegar isso.
function Revisao({ respostas, visiveis, onEditar, onEnviar, enviando, falha, onVoltar }) {
  const blocos = resumoRespostas(respostas)
  const indiceDe = (id) => visiveis.findIndex((e) => e.id === id)

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
        Confira antes de enviar
      </h1>
      <p className="mt-1 text-slate-500">
        Dê uma última olhada. É a partir disto que o seu estudo é montado — se algo
        estiver errado, é só tocar em "editar".
      </p>

      {falha && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {falha}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {blocos.map((b) => {
          const indice = indiceDe(b.etapa)
          return (
            <div key={b.etapa} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-display font-semibold text-slate-800">{b.titulo}</p>
                {indice >= 0 && (
                  <button type="button" onClick={() => onEditar(indice)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50">
                    <Pencil size={12} /> editar
                  </button>
                )}
              </div>
              <dl className="space-y-1">
                {b.linhas.map(([rotulo, valor], i) => (
                  <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-50 py-1 last:border-0">
                    <dt className="text-sm text-slate-400">{rotulo}</dt>
                    <dd className="tabular text-right text-sm font-medium text-slate-700">{valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>

      <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Ao enviar, estas informações vão direto para a Natália montar o seu planejamento.
        A declaração de saúde para a seguradora vem depois, em um link próprio — aqui
        nada é contratado.
      </p>

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={onVoltar} disabled={enviando}
          className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">
          <ArrowLeft size={16} /> Voltar
        </button>
        <button type="button" onClick={onEnviar} disabled={enviando}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 font-semibold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60">
          {enviando ? 'Enviando...' : 'Enviar para a Natália 🎉'}
        </button>
      </div>
    </>
  )
}
