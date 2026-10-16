import { useEffect, useState } from 'react'
export default function EstadoConexao() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine)
    window.addEventListener('online', atualizar)
    window.addEventListener('offline', atualizar)
    return () => {
      window.removeEventListener('online', atualizar)
      window.removeEventListener('offline', atualizar)
    }
  }, [])
  return online ? null : (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[90] bg-amber-100 p-3 text-center text-sm text-amber-950"
    >
      Sem conexão. Alterações ainda não confirmadas podem não estar salvas. Mantenha esta janela
      aberta e tente novamente ao reconectar.
    </div>
  )
}
