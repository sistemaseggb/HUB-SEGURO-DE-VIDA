import { useState } from 'react'
import { X, Lightbulb } from 'lucide-react'

// Faixa didática "Como funciona" — explica o módulo e pode ser dispensada
// (a escolha fica lembrada no navegador). O grande diferencial de um HUB é
// se explicar sozinho.
export function ComoFunciona({ id, titulo = 'Como funciona', children }) {
  const chave = `hub_help_${id}`
  const [fechado, setFechado] = useState(() => {
    try { return localStorage.getItem(chave) === '1' } catch { return false }
  })
  if (fechado) return null

  function dispensar() {
    try { localStorage.setItem(chave, '1') } catch { /* ignora */ }
    setFechado(true)
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="mt-0.5 shrink-0 rounded-lg bg-brand-100 p-1.5 text-brand-600">
        <Lightbulb size={16} />
      </div>
      <div className="min-w-0 flex-1 text-sm text-slate-600">
        <p className="mb-0.5 font-semibold text-slate-800">{titulo}</p>
        {children}
      </div>
      <button onClick={dispensar} className="shrink-0 rounded-lg p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-600" title="Entendi, não mostrar de novo">
        <X size={16} />
      </button>
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white shadow-card ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ titulo, subtitulo, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.7rem] font-semibold tracking-tight text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const estilos = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
    success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
    gold: 'bg-gold-500 text-white shadow-sm hover:bg-gold-600',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${estilos[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Campo({ label, children, obrigatorio, dica }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
      </span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-400">{dica}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12'

export function Input(props) {
  return <input className={inputBase} {...props} />
}

export function Select({ children, className = '', ...props }) {
  return (
    <select className={`${inputBase} cursor-pointer ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Textarea(props) {
  return <textarea rows={3} className={inputBase} {...props} />
}

export function Modal({ aberto, titulo, onFechar, children, largura = 'max-w-lg' }) {
  if (!aberto) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-16 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className={`animar-surgir w-full ${largura} rounded-2xl bg-white shadow-pop`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, tom = 'slate' }) {
  const tons = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    blue: 'bg-brand-50 text-brand-700 ring-brand-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    yellow: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    gold: 'bg-gold-400/15 text-gold-600 ring-gold-400/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tons[tom]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ icone: Icone, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {Icone && (
        <div className="mb-1 rounded-2xl bg-slate-100 p-3.5 text-slate-400">
          <Icone size={26} />
        </div>
      )}
      <p className="font-semibold text-slate-700">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-slate-400">{texto}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

export function StatTile({ rotulo, valor, detalhe, icone: Icone, corIcone = 'text-brand-600 bg-brand-50' }) {
  return (
    <div className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm leading-snug text-slate-500">{rotulo}</p>
          <p className="mt-1.5 font-display text-[1.7rem] font-semibold leading-none tracking-tight text-slate-900 tabular">{valor}</p>
          {detalhe && <p className="mt-2 text-xs text-slate-400">{detalhe}</p>}
        </div>
        {Icone && (
          <div className={`shrink-0 rounded-xl p-2.5 ${corIcone}`}>
            <Icone size={20} />
          </div>
        )}
      </div>
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
    </div>
  )
}
