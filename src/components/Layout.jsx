import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, KanbanSquare, Users, HeartHandshake,
  Settings, LogOut, ShieldCheck, CalendarDays, MessageSquareText,
  BarChart3, Upload, Menu, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import BuscaGlobal from './BuscaGlobal'

const MENU = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard, fim: true },
  { para: '/pipeline', rotulo: 'Pipeline', icone: KanbanSquare },
  { para: '/agenda', rotulo: 'Agenda', icone: CalendarDays },
  { para: '/clientes', rotulo: 'Clientes', icone: Users },
  { para: '/pos-venda', rotulo: 'Pós-Venda', icone: HeartHandshake },
  { para: '/mensagens', rotulo: 'Mensagens', icone: MessageSquareText },
  { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 },
  { para: '/importar', rotulo: 'Importar', icone: Upload },
  { para: '/cadastros', rotulo: 'Cadastros', icone: Settings },
]

export default function Layout() {
  const [aberto, setAberto] = useState(false)
  const location = useLocation()

  // Fecha a gaveta ao trocar de página (no celular)
  useEffect(() => { setAberto(false) }, [location.pathname])

  return (
    <div className="min-h-screen">
      {/* Overlay escuro no celular quando a gaveta está aberta */}
      {aberto && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setAberto(false)} />
      )}

      {/* Sidebar — gaveta no celular, fixa no desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:w-56 lg:translate-x-0 ${
        aberto ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-600 p-1.5 text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">Hub Seguros</p>
              <p className="text-xs text-slate-400">Natália Maschendorf</p>
            </div>
          </div>
          <button onClick={() => setAberto(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {MENU.map(({ para, rotulo, icone: Icone, fim }) => (
            <NavLink
              key={para}
              to={para}
              end={fim}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icone size={18} />
              {rotulo}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => supabase.auth.signOut()}
          className="mx-3 mb-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        >
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <div className="lg:ml-56">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <button onClick={() => setAberto(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Menu size={22} />
          </button>
          <BuscaGlobal />
        </header>
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
