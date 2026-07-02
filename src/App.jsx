import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import PosVenda from './pages/PosVenda'
import Cadastros from './pages/Cadastros'
import Proposta from './pages/Proposta'
import FormularioPublico from './pages/FormularioPublico'
import { Spinner } from './components/ui'

export default function App() {
  const [sessao, setSessao] = useState(undefined) // undefined = ainda verificando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota PÚBLICA: formulário do cliente, sem login */}
        <Route path="/f/:token" element={<FormularioPublico />} />

        {/* Rotas internas: exigem login */}
        {sessao === undefined ? (
          <Route path="*" element={<Spinner />} />
        ) : !sessao ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            <Route path="/proposta/:id" element={<Proposta />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/pos-venda" element={<PosVenda />} />
              <Route path="/cadastros" element={<Cadastros />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
