import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search, User, UserCog, CornerDownLeft, ArrowUp, ArrowDown, Command,
  Presentation, Plus, LogOut, Clock3,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { etapaLabel } from '../lib/constants'
import { DESTINOS, ABAS_CLIENTE, pontuar } from '../lib/navegacao'
import { lerRecentes } from '../lib/recentes'

// ─────────────────────────────────────────────────────────────────────────────
// PALETA DE COMANDOS — um campo que leva a qualquer lugar do sistema.
//
// A busca anterior fazia uma coisa só: achar cliente por nome. Se a consultora
// quisesse os Relatórios, precisava saber que "Relatórios" mora na seção
// "Gestão" do menu lateral, e que o menu lateral no celular está atrás de um
// hambúrguer. Isso é conhecimento de layout, e conhecimento de layout é
// exatamente o que ninguém quer ter que ter no meio de uma reunião.
//
// Aqui um campo só resolve tudo, e a ordem dos resultados é a ordem da
// probabilidade: cliente primeiro (é o que ela mais procura), depois as telas,
// depois as abas do cliente aberto, depois as ações.
//
// Abre com Ctrl/⌘+K ou com "/" — e o teclado inteiro funciona: setas para
// andar, Enter para ir, Esc para sair. Nada aqui exige o mouse.
// ─────────────────────────────────────────────────────────────────────────────

export default function PaletaComandos({ aberta, onFechar }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [termo, setTermo] = useState('')
  const [clientes, setClientes] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [indice, setIndice] = useState(0)
  const inputRef = useRef(null)
  const listaRef = useRef(null)

  // O id do cliente aberto agora: com ele a paleta oferece as abas DESTE
  // cliente ("ir para Apólices"), que é o pulo de navegação mais frequente
  // dentro de uma reunião.
  const clienteAberto = location.pathname.match(/^\/clientes\/([^/]+)/)?.[1] ?? null

  useEffect(() => {
    if (!aberta) return
    setTermo('')
    setIndice(0)
    // o autoFocus do input não basta: o modal acabou de montar
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [aberta])

  // Busca de cliente no banco, com folga para a digitação
  useEffect(() => {
    const q = termo.trim()
    if (!aberta || q.length < 2) { setClientes([]); setBuscando(false); return }
    setBuscando(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('vw_busca_global')
        .select('*')
        .or(`nome.ilike.%${q}%,codigo.ilike.%${q}%,telefone.ilike.%${q}%`)
        .limit(6)
      setClientes(data ?? [])
      setBuscando(false)
    }, 200)
    return () => clearTimeout(t)
  }, [termo, aberta])

  const recentes = useMemo(() => (aberta ? lerRecentes() : []), [aberta])

  // ── A lista, montada por grupos e já ordenada ──
  const grupos = useMemo(() => {
    const q = termo.trim()
    const out = []

    if (clientes.length > 0) {
      out.push({
        titulo: 'Clientes e assessores',
        itens: clientes.map((c) => ({
          chaveItem: `${c.tipo}-${c.id}`,
          icone: c.tipo === 'cliente' ? User : UserCog,
          rotulo: c.nome,
          detalhe: [c.codigo, c.tipo === 'cliente' ? etapaLabel(c.detalhe) : `Assessor · ${c.detalhe}`, c.telefone]
            .filter(Boolean).join(' · '),
          ir: () => navigate(c.tipo === 'cliente' ? `/clientes/${c.id}` : `/assessores/${c.id}`),
        })),
      })
    }

    // Sem nada digitado, a paleta abre útil: os últimos clientes visitados.
    if (!q && recentes.length > 0) {
      out.push({
        titulo: 'Vistos recentemente',
        itens: recentes.map((c) => ({
          chaveItem: `rec-${c.id}`,
          icone: Clock3,
          rotulo: c.nome,
          detalhe: c.codigo ?? 'cliente',
          ir: () => navigate(`/clientes/${c.id}`),
        })),
      })
    }

    const telas = (q
      ? DESTINOS.map((d) => ({ d, p: pontuar(q, d) })).filter((x) => x.p > 0)
        .sort((a, b) => b.p - a.p).map((x) => x.d)
      : DESTINOS)
    if (telas.length > 0) {
      out.push({
        titulo: 'Ir para',
        itens: telas.map((d) => ({
          chaveItem: `tela-${d.para}`,
          icone: d.icone,
          rotulo: d.rotulo,
          detalhe: d.descricao,
          atalho: `G ${d.atalho.toUpperCase()}`,
          ir: () => navigate(d.para),
        })),
      })
    }

    if (clienteAberto) {
      const abas = q
        ? ABAS_CLIENTE.map((a) => ({ a, p: pontuar(q, { ...a, rotulo: a.nome }) }))
          .filter((x) => x.p > 0).sort((x, y) => y.p - x.p).map((x) => x.a)
        : []
      if (abas.length > 0) {
        out.push({
          titulo: 'Neste cliente',
          itens: abas.map((a) => ({
            chaveItem: `aba-${a.slug}`,
            icone: a.icone,
            rotulo: a.nome,
            detalhe: a.descricao,
            ir: () => navigate(`/clientes/${clienteAberto}/${a.slug}`),
          })),
        })
      }
    }

    const acoes = [
      {
        chaveItem: 'acao-novo-cliente', icone: Plus, rotulo: 'Cadastrar novo cliente',
        detalhe: 'Abre a lista de clientes com o formulário pronto',
        termos: ['novo', 'criar', 'adicionar', 'lead', 'cadastrar'],
        ir: () => navigate('/clientes?novo=1'),
      },
      ...(clienteAberto ? [{
        chaveItem: 'acao-proposta', icone: Presentation, rotulo: 'Gerar proposta deste cliente',
        detalhe: 'Abre a apresentação em tela cheia',
        termos: ['proposta', 'apresentar', 'slides', 'deck', 'reuniao'],
        ir: () => navigate(`/proposta/${clienteAberto}`),
      }] : []),
      {
        chaveItem: 'acao-sair', icone: LogOut, rotulo: 'Sair da conta',
        detalhe: 'Encerra a sessão neste navegador',
        termos: ['logout', 'deslogar', 'encerrar', 'trocar de usuario'],
        ir: () => supabase.auth.signOut(),
      },
    ].filter((a) => !q || pontuar(q, { rotulo: a.rotulo, descricao: a.detalhe, termos: a.termos }) > 0)
    if (acoes.length > 0) out.push({ titulo: 'Ações', itens: acoes })

    return out
  }, [termo, clientes, recentes, clienteAberto, navigate])

  const planos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos])

  useEffect(() => { setIndice(0) }, [termo])

  const executar = useCallback((item) => {
    if (!item) return
    onFechar()
    item.ir()
  }, [onFechar])

  function aoTeclar(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndice((i) => (planos.length ? (i + 1) % planos.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndice((i) => (planos.length ? (i - 1 + planos.length) % planos.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      executar(planos[indice])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onFechar()
    }
  }

  // Mantém o item selecionado visível quando se anda com o teclado
  useEffect(() => {
    const el = listaRef.current?.querySelector('[data-ativo="1"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [indice])

  if (!aberta) return null

  let contador = -1

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-900/50 p-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
      role="dialog" aria-modal="true" aria-label="Buscar e navegar"
    >
      <div className="animar-surgir w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Buscar cliente, tela ou ação…"
            className="w-full bg-transparent text-[0.95rem] text-slate-800 placeholder:text-slate-400 focus:outline-none"
            aria-label="Buscar cliente, tela ou ação"
          />
          {buscando && <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-laranja-500" />}
          <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listaRef} className="max-h-[55vh] overflow-y-auto py-2">
          {planos.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Nada encontrado para “{termo}”. Tente o nome do cliente, o telefone
              ou o nome da tela.
            </p>
          )}
          {grupos.map((g) => (
            <div key={g.titulo} className="mb-1">
              <p className="px-4 pb-1 pt-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {g.titulo}
              </p>
              {g.itens.map((item) => {
                contador += 1
                const i = contador
                const ativo = i === indice
                const Icone = item.icone
                return (
                  <button
                    key={item.chaveItem}
                    data-ativo={ativo ? '1' : '0'}
                    onMouseEnter={() => setIndice(i)}
                    onClick={() => executar(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                      ativo ? 'bg-laranja-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Icone size={16} className={`shrink-0 ${ativo ? 'text-laranja-600' : 'text-slate-400'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{item.rotulo}</span>
                      {item.detalhe && (
                        <span className="block truncate text-xs text-slate-400">{item.detalhe}</span>
                      )}
                    </span>
                    {item.atalho && (
                      <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 sm:block">
                        {item.atalho}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> navegar</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft size={11} /> abrir</span>
          <span className="ml-auto inline-flex items-center gap-1"><Command size={11} /> K a qualquer momento</span>
        </div>
      </div>
    </div>
  )
}
