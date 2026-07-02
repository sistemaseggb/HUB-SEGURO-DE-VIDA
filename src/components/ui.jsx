import { X } from 'lucide-react'

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ titulo, subtitulo, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const estilos = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilos[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Campo({ label, children, obrigatorio, dica }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
      </span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-400">{dica}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

export function Input(props) {
  return <input className={inputBase} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className={inputBase} {...props}>
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className={`w-full ${largura} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button onClick={onFechar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, tom = 'slate' }) {
  const tons = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    yellow: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tons[tom]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ icone: Icone, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {Icone && <Icone size={36} className="text-slate-300" />}
      <p className="font-medium text-slate-600">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-slate-400">{texto}</p>}
      {children}
    </div>
  )
}

export function StatTile({ rotulo, valor, detalhe, icone: Icone, corIcone = 'text-blue-600 bg-blue-50' }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{rotulo}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
          {detalhe && <p className="mt-1 text-xs text-slate-400">{detalhe}</p>}
        </div>
        {Icone && (
          <div className={`rounded-lg p-2.5 ${corIcone}`}>
            <Icone size={20} />
          </div>
        )}
      </div>
    </Card>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
    </div>
  )
}
