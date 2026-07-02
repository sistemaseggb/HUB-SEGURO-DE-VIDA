import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Tela provisória apenas para validar a conexão com o Supabase.
// Os módulos do Hub (Cadastros, Pipeline, Pós-Venda, Dashboard) entram nas próximas etapas.
function App() {
  const [status, setStatus] = useState('verificando...')

  useEffect(() => {
    supabase
      .from('assessores')
      .select('id', { count: 'exact', head: true })
      .then(({ error, count }) => {
        if (error) setStatus(`Erro na conexão: ${error.message}`)
        else setStatus(`Conectado! ${count ?? 0} assessor(es) cadastrado(s).`)
      })
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Hub Seguro de Vida</h1>
        <p className="mt-2 text-slate-600">Status do Supabase: {status}</p>
      </div>
    </main>
  )
}

export default App
