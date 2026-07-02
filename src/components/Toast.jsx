import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(() => {})

// Hook para disparar avisos de qualquer lugar: const toast = useToast(); toast.ok('Salvo!')
export function useToast() {
  return useContext(ToastContext)
}

const ICONE = {
  ok: { Icone: CheckCircle2, cor: 'text-emerald-600', anel: 'ring-emerald-100' },
  erro: { Icone: AlertTriangle, cor: 'text-red-600', anel: 'ring-red-100' },
  info: { Icone: Info, cor: 'text-brand-600', anel: 'ring-brand-100' },
}

export function ToastProvider({ children }) {
  const [itens, setItens] = useState([])

  const remover = useCallback((id) => setItens((xs) => xs.filter((x) => x.id !== id)), [])

  const push = useCallback((tipo, texto) => {
    const id = Date.now() + Math.random()
    setItens((xs) => [...xs, { id, tipo, texto }])
    setTimeout(() => remover(id), 3500)
  }, [remover])

  // API: toast.ok(...), toast.erro(...), toast.info(...)
  const toast = {
    ok: (t) => push('ok', t),
    erro: (t) => push('erro', t),
    info: (t) => push('info', t),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {itens.map(({ id, tipo, texto }) => {
          const { Icone, cor, anel } = ICONE[tipo] ?? ICONE.info
          return (
            <div key={id}
              className={`animar-surgir pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-pop ring-1 ${anel}`}>
              <Icone size={18} className={`mt-0.5 shrink-0 ${cor}`} />
              <p className="min-w-0 flex-1 text-sm text-slate-700">{texto}</p>
              <button onClick={() => remover(id)} className="rounded p-0.5 text-slate-300 hover:text-slate-500">
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
