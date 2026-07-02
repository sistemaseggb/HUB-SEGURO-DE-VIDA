import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, KanbanSquare, Users, HeartHandshake,
  Settings, LogOut, ShieldCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const MENU = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard, fim: true },
  { para: '/pipeline', rotulo: 'Pipeline', icone: KanbanSquare },
  { para: '/clientes', rotulo: 'Clientes', icone: Users },
  { para: '/pos-venda', rotulo: 'Pós-Venda', icone: HeartHandshake },
  { para: '/cadastros', rotulo: 'Cadastros', icone: Settings },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="rounded-lg bg-blue-600 p-1.5 text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">Hub Seguros</p>
            <p className="text-xs text-slate-400">Natália Maschendorf</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {MENU.map(({ para, rotulo, icone: Icone, fim }) => (
            <NavLink
              key={para}
              to={para}
              end={fim}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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

      <main className="ml-56 flex-1 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
