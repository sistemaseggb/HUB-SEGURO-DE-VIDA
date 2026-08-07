import { createContext, useContext } from 'react'

// O contexto e o hook moram fora do Toast.jsx de propósito: um arquivo que
// exporta componente E função quebra o hot reload do Vite (o React Fast
// Refresh só remonta arquivos que exportam apenas componentes).
export const ToastContext = createContext(null)

// Dispare avisos de qualquer lugar: const toast = useToast(); toast.ok('Salvo!')
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
