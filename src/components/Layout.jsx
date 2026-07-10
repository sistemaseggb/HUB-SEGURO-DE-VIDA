import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, KanbanSquare, Users, HeartHandshake,
  Settings, LogOut, ShieldCheck, CalendarDays, MessageSquareText,
  BarChart3, Upload, Menu, X,
} from 'lucide-react'
import { supabase, MODO_DEMO } from '../lib/supabase'
import BuscaGlobal from './BuscaGlobal'

// Menu agrupado por seções — mais didático e organizado
const SECOES = [
  {
    titulo: 'Operação',
    itens: [
      { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard, fim: true },
      { para: '/pipeline', rotulo: 'Pipeline', icone: KanbanSquare },
      { para: '/agenda', rotulo: 'Agenda', icone: CalendarDays },
      { para: '/clientes', rotulo: 'Clientes', icone: Users },
    ],
  },
  {
    titulo: 'Relacionamento',
    itens: [
      { para: '/pos-venda', rotulo: 'Pós-Venda', icone: HeartHandshake },
      { para: '/mensagens', rotulo: 'Mensagens', icone: MessageSquareText },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 },
      { para: '/importar', rotulo: 'Importar', icone: Upload },
      { para: '/cadastros', rotulo: 'Cadastros', icone: Settings },
    ],
  },
]

function itemClasse({ isActive }) {
  return `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
  }`
}

export default function Layout() {
  const [aberto, setAberto] = useState(false)
  const [email, setEmail] = useState('')
  const location = useLocation()

  useEffect(() => { setAberto(false) }, [location.pathname])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? ''))
  }, [])

  return (
    <div className="min-h-screen">
      {aberto && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setAberto(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:w-60 lg:translate-x-0 ${
        aberto ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-2 text-white shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-display text-[0.95rem] font-semibold leading-tight text-slate-900">Hub Seguros</p>
              <p className="text-xs text-slate-400">Natália Maschendorf</p>
            </div>
          </div>
          <button onClick={() => setAberto(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {SECOES.map((secao) => (
            <div key={secao.titulo}>
              <p className="mb-1 px-3 text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">{secao.titulo}</p>
              <div className="space-y-0.5">
                {secao.itens.map(({ para, rotulo, icone: Icone, fim }) => (
                  <NavLink key={para} to={para} end={fim} className={itemClasse}>
                    {({ isActive }) => (
                      <>
                        <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <Icone size={18} className={isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'} />
                        {rotulo}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="mb-1 flex items-center gap-2.5 px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {(email[0] ?? 'U').toUpperCase()}
            </div>
            <p className="min-w-0 flex-1 truncate text-xs text-slate-500" title={email}>{email || 'Usuária'}</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <LogOut size={18} className="text-slate-400" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <button onClick={() => setAberto(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Menu size={22} />
          </button>
          <BuscaGlobal />
          {MODO_DEMO && (
            <span className="ml-auto shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
              title="Banco simulado com dados fictícios — nada é salvo. Configure o .env para conectar ao banco real.">
              ✨ Demonstração
            </span>
          )}
        </header>
        <main className="mx-auto max-w-[1400px] p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
