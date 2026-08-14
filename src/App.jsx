import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { Spinner } from './components/ui'
import { ToastProvider } from './components/Toast'

// ─── O que desce na primeira abertura, e o que espera ────────────────────────
// O sistema inteiro vinha num pacote só: abrir o Dashboard no celular baixava
// também o importador de planilhas, a proposta com o quadro de desenho, os
// relatórios e o comparador — telas que aquela sessão talvez nem visite. Isso
// custa segundos numa reunião que começa em pé, com 4G ruim.
//
// Ficam no pacote principal só o Login e o Dashboard: é onde a consultora
// entra todo dia, e uma tela de carregando ali seria pior do que o peso. O
// resto desce quando ela navega — em milissegundos, e uma vez só por versão.
//
// `Layout` também fica: é a moldura de todas as rotas internas, então
// adiá-lo só adicionaria um piscar de tela a cada navegação.
const Pipeline = lazy(() => import('./pages/Pipeline'))
const Clientes = lazy(() => import('./pages/Clientes'))
const ClienteDetalhe = lazy(() => import('./pages/ClienteDetalhe'))
const PosVenda = lazy(() => import('./pages/PosVenda'))
const Cadastros = lazy(() => import('./pages/Cadastros'))
const Proposta = lazy(() => import('./pages/Proposta'))
const FormularioPublico = lazy(() => import('./pages/FormularioPublico'))
const Agenda = lazy(() => import('./pages/Agenda'))
const AssessorDetalhe = lazy(() => import('./pages/AssessorDetalhe'))
const Mensagens = lazy(() => import('./pages/Mensagens'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const Premiacao = lazy(() => import('./pages/Premiacao'))
const Importar = lazy(() => import('./pages/Importar'))
const Guia = lazy(() => import('./pages/Guia'))

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
      {/* Um Suspense só, na raiz: a tela de espera é a mesma do carregamento
          da sessão, então a troca de rota não muda de aparência. */}
      <Suspense fallback={<Spinner />}>
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
              <Route path="/gb-awards" element={<Premiacao />} />
              <Route path="/importar" element={<Importar />} />
              <Route path="/guia" element={<Guia />} />
              <Route path="/assessores/:id" element={<AssessorDetalhe />} />
              <Route path="/cadastros" element={<Cadastros />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </>
        )}
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
  )
}
