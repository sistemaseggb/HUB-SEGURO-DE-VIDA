import { useEffect, useState } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, KanbanSquare, Users, HeartHandshake,
  Settings, LogOut, CalendarDays, MessageSquareText,
  BarChart3, Upload, Menu, X, GraduationCap, LifeBuoy,
} from 'lucide-react'
import { supabase, MODO_DEMO } from '../lib/supabase'
import { aoFalharConsulta } from '../lib/vigia'
import { useToast } from './toastContexto'
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
  {
    titulo: 'Ajuda',
    itens: [
      { para: '/guia', rotulo: 'Guia passo a passo', icone: GraduationCap },
    ],
  },
]

// Sidebar escura (grafite da marca): item ativo ganha fundo claro sutil e o
// filete laranja — o mesmo laranja da logo, usado como único acento.
function itemClasse({ isActive }) {
  return `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
    isActive
      ? 'bg-white/10 text-white'
      : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`
}

export default function Layout() {
  const [aberto, setAberto] = useState(false)
  const [email, setEmail] = useState('')
  const location = useLocation()
  const toast = useToast()

  useEffect(() => { setAberto(false) }, [location.pathname])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? ''))
  }, [])

  // Falha de banco vira aviso na tela, venha de onde vier. Sem isto, uma
  // consulta que falhou aparece como lista vazia — e "este cliente não tem
  // apólice" é uma frase que ela pode dizer na frente do cliente.
  //
  // Um aviso por vez, com pausa: quando a rede cai, DEZ consultas falham
  // juntas e dez avisos empilhados escondem a tela em vez de informar.
  useEffect(() => {
    let ultimo = 0
    return aoFalharConsulta(({ contexto, mensagem }) => {
      const agora = Date.now()
      if (agora - ultimo < 6000) return
      ultimo = agora
      toast.erro(`${mensagem} (em "${contexto}")`)
    })
  }, [toast])

  return (
    <div className="min-h-screen">
      {aberto && (
        <div className="fixed inset-0 z-40 bg-brand-900/50 backdrop-blur-sm lg:hidden" onClick={() => setAberto(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-900 transition-transform duration-200 lg:w-60 lg:translate-x-0 ${
        aberto ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-4 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-xl bg-white px-2 py-1.5 shadow-sm">
              <img src="/logo-gb.png" alt="GB" style={{ height: 30 }} />
            </span>
            <div>
              <p className="font-display text-[0.95rem] font-semibold leading-tight text-white">Hub Seguros</p>
              <p className="text-xs text-slate-300">Natália Maschendorf</p>
            </div>
          </div>
          <button onClick={() => setAberto(false)} className="rounded-lg p-1 text-slate-300 hover:bg-white/10 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1">
          {SECOES.map((secao) => (
            <div key={secao.titulo}>
              <p className="mb-1 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-300">{secao.titulo}</p>
              <div className="space-y-0.5">
                {secao.itens.map(({ para, rotulo, icone: Icone, fim }) => (
                  <NavLink key={para} to={para} end={fim} className={itemClasse}>
                    {({ isActive }) => (
                      <>
                        <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-laranja-500 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <Icone size={18} strokeWidth={isActive ? 2.2 : 2}
                          className={isActive ? 'text-laranja-400' : 'text-slate-300 group-hover:text-white'} />
                        {rotulo}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-1 flex items-center gap-2.5 px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-laranja-500/20 text-xs font-bold text-laranja-300">
              {(email[0] ?? 'U').toUpperCase()}
            </div>
            <p className="min-w-0 flex-1 truncate text-xs text-slate-300" title={email}>{email || 'Usuária'}</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} className="text-slate-300" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-md lg:px-8">
          <button onClick={() => setAberto(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Menu size={22} />
          </button>
          <BuscaGlobal />
          <Link to="/guia"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-laranja-300 hover:text-laranja-700"
            title="Guia passo a passo: como usar o Hub do começo ao fim">
            <LifeBuoy size={15} /> <span className="hidden sm:inline">Ajuda</span>
          </Link>
          {MODO_DEMO && (
            <span className="shrink-0 rounded-full border border-laranja-200 bg-laranja-50 px-3 py-1 text-xs font-semibold text-laranja-700"
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
