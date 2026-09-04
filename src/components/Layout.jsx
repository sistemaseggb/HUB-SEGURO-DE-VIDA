import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, LifeBuoy, Search, Keyboard, ChevronRight } from 'lucide-react'
import { supabase, MODO_DEMO } from '../lib/supabase'
import { SECOES, DESTINOS, DESTINOS_CELULAR, ABAS_CLIENTE } from '../lib/navegacao'
import PaletaComandos from './PaletaComandos'

// ─────────────────────────────────────────────────────────────────────────────
// O CHASSI DA NAVEGAÇÃO
//
// Três caminhos para o mesmo lugar, porque as três situações são diferentes:
//
//   · computador, com tempo   → menu lateral, tudo à vista;
//   · computador, com pressa  → Ctrl+K ou "g" + a inicial da tela;
//   · celular, em pé          → barra inferior, alcance do polegar.
//
// E, em todas elas, a trilha no topo respondendo "onde eu estou" — a pergunta
// que faz alguém desistir de um sistema quando não tem resposta.
// ─────────────────────────────────────────────────────────────────────────────

function itemClasse({ isActive }) {
  return `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
    isActive
      ? 'bg-white/10 text-white'
      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
  }`
}

// A trilha do topo: seção → página → aba. É o que substitui o "onde eu estou"
// que antes só existia na memória de quem clicou.
function useTrilha() {
  const { pathname } = useLocation()
  const destino = [...DESTINOS].sort((a, b) => b.para.length - a.para.length)
    .find((d) => (d.fim ? pathname === d.para : pathname.startsWith(d.para)))

  if (pathname.startsWith('/clientes/')) {
    const slug = pathname.split('/')[3]
    const aba = ABAS_CLIENTE.find((a) => a.slug === slug)
    return {
      secao: 'Operação',
      titulo: 'Clientes',
      voltarPara: '/clientes',
      folha: aba?.nome ?? null,
    }
  }
  if (pathname.startsWith('/assessores/')) {
    return { secao: 'Gestão', titulo: 'Assessores', voltarPara: '/cadastros', folha: null }
  }
  return {
    secao: destino?.secao ?? null,
    titulo: destino?.rotulo ?? 'Hub Seguros',
    voltarPara: null,
    folha: null,
  }
}

// ─── Atalhos de teclado ──────────────────────────────────────────────────────
// A sequência "g" + inicial é a convenção de quem usa sistema o dia inteiro
// (Gmail, GitHub, Linear). Ela nunca dispara sem querer porque exige as duas
// teclas em menos de um segundo e nunca funciona com o cursor num campo —
// digitar "gd" no nome de um cliente não pode teletransportar ninguém.
function useAtalhos({ abrirPaleta, abrirAjuda }) {
  const navigate = useNavigate()
  const aguardandoG = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    function digitando() {
      const el = document.activeElement
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
        || el.tagName === 'SELECT' || el.isContentEditable)
    }

    function onKey(e) {
      const combo = e.metaKey || e.ctrlKey
      if (combo && e.key.toLowerCase() === 'k') {
        e.preventDefault(); abrirPaleta(); return
      }
      if (combo || e.altKey) return
      if (digitando()) return

      if (e.key === '/') { e.preventDefault(); abrirPaleta(); return }
      if (e.key === '?') { e.preventDefault(); abrirAjuda(); return }

      if (aguardandoG.current) {
        aguardandoG.current = false
        clearTimeout(timer.current)
        const destino = DESTINOS.find((d) => d.atalho === e.key.toLowerCase())
        if (destino) { e.preventDefault(); navigate(destino.para) }
        return
      }
      if (e.key.toLowerCase() === 'g') {
        aguardandoG.current = true
        clearTimeout(timer.current)
        timer.current = setTimeout(() => { aguardandoG.current = false }, 1200)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer.current) }
  }, [navigate, abrirPaleta, abrirAjuda])
}

function AjudaAtalhos({ aberta, onFechar }) {
  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-900/50 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="animar-surgir w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Atalhos do teclado</h2>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Nenhum deles funciona enquanto você está digitando num campo — pode
          escrever à vontade.
        </p>
        <dl className="space-y-2 text-sm">
          {[
            ['Ctrl K  ou  /', 'Abrir a busca — cliente, tela ou ação'],
            ['?', 'Esta lista'],
            ...DESTINOS.map((d) => [`G  ${d.atalho.toUpperCase()}`, `Ir para ${d.rotulo}`]),
          ].map(([tecla, oque]) => (
            <div key={tecla} className="flex items-center gap-3">
              <kbd className="min-w-[5.5rem] shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center font-sans text-[11px] font-semibold text-slate-500">
                {tecla}
              </kbd>
              <dd className="text-slate-600">{oque}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export default function Layout() {
  const [aberto, setAberto] = useState(false)
  const [paleta, setPaleta] = useState(false)
  const [ajuda, setAjuda] = useState(false)
  const [email, setEmail] = useState('')
  const location = useLocation()
  const trilha = useTrilha()

  const abrirPaleta = useCallback(() => setPaleta(true), [])
  const abrirAjuda = useCallback(() => setAjuda(true), [])
  useAtalhos({ abrirPaleta, abrirAjuda })

  useEffect(() => { setAberto(false) }, [location.pathname])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? ''))
  }, [])

  return (
    <div className="min-h-screen">
      <PaletaComandos aberta={paleta} onFechar={() => setPaleta(false)} />
      <AjudaAtalhos aberta={ajuda} onFechar={() => setAjuda(false)} />

      {/* Pular para o conteúdo: quem navega por teclado não deveria ter que
          passar por 10 itens de menu em toda página */}
      <a href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-800 focus:shadow-pop">
        Pular para o conteúdo
      </a>

      {aberto && (
        <div className="fixed inset-0 z-40 bg-brand-900/50 backdrop-blur-sm lg:hidden" onClick={() => setAberto(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-900 transition-transform duration-200 lg:w-60 lg:translate-x-0 ${
        aberto ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-4 pb-4 pt-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-xl bg-white px-2 py-1.5 shadow-sm">
              <img src="/logo-gb.png" srcSet="/logo-gb-96.png 96w, /logo-gb-192.png 192w, /logo-gb.png 800w" sizes="30px"
                alt="GB" style={{ height: 30 }} />
            </span>
            <span>
              <span className="block font-display text-[0.95rem] font-semibold leading-tight text-white">Hub Seguros</span>
              <span className="block text-xs text-slate-400">Natália Maschendorf</span>
            </span>
          </Link>
          <button onClick={() => setAberto(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 lg:hidden"
            aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1" aria-label="Menu principal">
          {SECOES.map((secao) => (
            <div key={secao.titulo}>
              <p className="mb-1 px-3 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{secao.titulo}</p>
              <div className="space-y-0.5">
                {secao.itens.map(({ para, rotulo, icone: Icone, fim, atalho, descricao }) => (
                  <NavLink key={para} to={para} end={fim} className={itemClasse} title={descricao}>
                    {({ isActive }) => (
                      <>
                        <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-laranja-500 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <Icone size={18} strokeWidth={isActive ? 2.2 : 2}
                          className={isActive ? 'text-laranja-400' : 'text-slate-500 group-hover:text-slate-300'} />
                        <span className="flex-1">{rotulo}</span>
                        <kbd className="rounded border border-white/10 px-1 py-px font-sans text-[9px] font-semibold text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                          G{atalho.toUpperCase()}
                        </kbd>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button onClick={abrirAjuda}
            className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300">
            <Keyboard size={16} /> Atalhos do teclado
            <kbd className="ml-auto rounded border border-white/10 px-1.5 py-px font-sans text-[10px] font-semibold">?</kbd>
          </button>
          <div className="mb-1 flex items-center gap-2.5 px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-laranja-500/20 text-xs font-bold text-laranja-300">
              {(email[0] ?? 'U').toUpperCase()}
            </div>
            <p className="min-w-0 flex-1 truncate text-xs text-slate-400" title={email}>{email || 'Usuária'}</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} className="text-slate-500" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-md lg:px-8">
          <button onClick={() => setAberto(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menu">
            <Menu size={22} />
          </button>

          {/* Trilha: seção → página → aba. No celular fica só a folha, que é o
              que importa quando o espaço é de um polegar. */}
          <nav aria-label="Trilha" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              {trilha.secao && (
                <li className="hidden shrink-0 items-center gap-1.5 text-slate-400 sm:flex">
                  {trilha.secao}
                  <ChevronRight size={13} className="text-slate-300" />
                </li>
              )}
              <li className="shrink-0">
                {trilha.voltarPara
                  ? <Link to={trilha.voltarPara} className="font-semibold text-slate-600 hover:text-laranja-700">{trilha.titulo}</Link>
                  : <span className="font-semibold text-slate-800">{trilha.titulo}</span>}
              </li>
              {trilha.folha && (
                <li className="flex min-w-0 items-center gap-1.5">
                  <ChevronRight size={13} className="shrink-0 text-slate-300" />
                  <span className="truncate text-slate-500">{trilha.folha}</span>
                </li>
              )}
            </ol>
          </nav>

          {/* O gatilho da paleta. É um botão de verdade e não um campo falso:
              no celular abre o mesmo diálogo em tela cheia, com o teclado
              subindo no lugar certo. */}
          <button onClick={abrirPaleta}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-sm transition-colors hover:border-laranja-300 hover:text-slate-600 lg:w-72 lg:justify-start"
            aria-label="Buscar cliente, tela ou ação">
            <Search size={16} />
            <span className="hidden lg:inline">Buscar…</span>
            <kbd className="ml-auto hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 lg:block">
              Ctrl K
            </kbd>
          </button>

          {/* No celular a Ajuda sai do topo: ela já mora na barra de baixo e no
              menu, e o espaço aqui vale mais para a trilha e o selo de demo. */}
          <Link to="/guia"
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-laranja-300 hover:text-laranja-700 sm:inline-flex"
            title="Guia passo a passo: como usar o Hub do começo ao fim">
            <LifeBuoy size={15} /> Ajuda
          </Link>
          {/* O selo de demonstração NUNCA se esconde, nem no celular: ele é o
              que diz que nada está sendo salvo. Um aviso desses só vale se
              estiver sempre à vista — no telefone ele encolhe, não some. */}
          {MODO_DEMO && (
            <span className="shrink-0 rounded-full border border-laranja-200 bg-laranja-50 px-2 py-1 text-[10px] font-semibold text-laranja-700 sm:px-3 sm:text-xs"
              title="Banco simulado com dados fictícios — nada é salvo. Configure o .env para conectar ao banco real.">
              ✨ Demonstração
            </span>
          )}
        </header>

        {/* pb-20 no celular: a barra inferior não pode tapar o último botão da
            página, que costuma ser justamente o "Salvar" */}
        <main id="conteudo" className="mx-auto max-w-[1400px] p-4 pb-24 lg:p-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ── Barra inferior do celular ──
          O menu lateral atrás de um hambúrguer custa dois toques e exige que a
          pessoa lembre que ele existe. Os quatro destinos do dia a dia ficam
          aqui, na altura do polegar, sempre visíveis. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
        aria-label="Navegação rápida">
        {DESTINOS_CELULAR.map(({ para, rotulo, icone: Icone, fim }) => (
          <NavLink key={para} to={para} end={fim}
            className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-laranja-600' : 'text-slate-400'
            }`}>
            {({ isActive }) => (
              <>
                <Icone size={20} strokeWidth={isActive ? 2.3 : 2} />
                {rotulo}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={abrirPaleta}
          className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-slate-400">
          <Search size={20} />
          Buscar
        </button>
      </nav>
    </div>
  )
}
