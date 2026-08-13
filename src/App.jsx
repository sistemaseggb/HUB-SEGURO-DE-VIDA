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
import Agenda from './pages/Agenda'
import AssessorDetalhe from './pages/AssessorDetalhe'
import Mensagens from './pages/Mensagens'
import Relatorios from './pages/Relatorios'
import Importar from './pages/Importar'
import Guia from './pages/Guia'
import { Spinner } from './components/ui'
import { ToastProvider } from './components/Toast'

export default function App() {
  const [sessao, setSessao] = useState(undefined) // undefined = ainda verificando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        {/* Rotas PÚBLICAS: formulário e proposta do cliente, sem login */}
        <Route path="/f/:token" element={<FormularioPublico />} />
        <Route path="/p/:token" element={<Proposta publica />} />

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
              {/* A aba mora na URL: F5 no meio da reunião não joga a consultora
                  de volta para o Planejamento, o botão voltar funciona e o link
                  colado no WhatsApp abre exatamente onde ela estava. */}
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/clientes/:id/:aba" element={<ClienteDetalhe />} />
              <Route path="/pos-venda" element={<PosVenda />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/mensagens" element={<Mensagens />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/importar" element={<Importar />} />
              <Route path="/guia" element={<Guia />} />
              <Route path="/assessores/:id" element={<AssessorDetalhe />} />
              <Route path="/cadastros" element={<Cadastros />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </>
        )}
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}
