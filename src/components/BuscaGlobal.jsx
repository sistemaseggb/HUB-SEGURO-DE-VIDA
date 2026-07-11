import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, UserCog } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { etapaLabel } from '../lib/constants'

// Busca global do topo: acha clientes e assessores por nome, código ou telefone.
// Atalhos: "/" ou Ctrl+K (⌘K no Mac) focam a busca de qualquer lugar.
export default function BuscaGlobal() {
  const navigate = useNavigate()
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState([])
  const [aberto, setAberto] = useState(false)
  const [indice, setIndice] = useState(0)
  const inputRef = useRef(null)
  const caixaRef = useRef(null)

  // Atalho "/" para focar a busca
  useEffect(() => {
    function onKey(e) {
      const ehCampo = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
      if ((e.key === '/' && !ehCampo) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fecha ao clicar fora
  useEffect(() => {
    function onClick(e) {
      if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Busca com debounce
  useEffect(() => {
    const q = termo.trim()
    if (q.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('vw_busca_global')
        .select('*')
        .or(`nome.ilike.%${q}%,codigo.ilike.%${q}%,telefone.ilike.%${q}%`)
        .limit(8)
      setResultados(data ?? [])
      setIndice(0)
      setAberto(true)
    }, 220)
    return () => clearTimeout(t)
  }, [termo])

  function abrir(item) {
    setAberto(false)
    setTermo('')
    if (item.tipo === 'cliente') navigate(`/clientes/${item.id}`)
    else navigate(`/assessores/${item.id}`)
  }

  function onKeyDown(e) {
    if (!aberto || resultados.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => (i + 1) % resultados.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => (i - 1 + resultados.length) % resultados.length) }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(resultados[indice]) }
    else if (e.key === 'Escape') setAberto(false)
  }

  return (
    <div ref={caixaRef} className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
      <input
        ref={inputRef}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => resultados.length && setAberto(true)}
        placeholder="Buscar cliente ou assessor por nome, código ou telefone…"
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-14 text-sm text-slate-700 placeholder:text-slate-400 focus:border-laranja-400 focus:outline-none focus:ring-2 focus:ring-laranja-500/15"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 sm:block">
        Ctrl K
      </kbd>

      {aberto && resultados.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {resultados.map((item, i) => (
            <button
              key={`${item.tipo}-${item.id}`}
              onMouseEnter={() => setIndice(i)}
              onClick={() => abrir(item)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                i === indice ? 'bg-laranja-50' : 'hover:bg-slate-50'
              }`}
            >
              {item.tipo === 'cliente'
                ? <User size={16} className="shrink-0 text-laranja-600" />
                : <UserCog size={16} className="shrink-0 text-slate-500" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">
                  {item.nome} {item.codigo && <span className="text-xs text-slate-400">· {item.codigo}</span>}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {item.tipo === 'cliente' ? etapaLabel(item.detalhe) : `Assessor · ${item.detalhe}`}
                  {item.telefone && ` · ${item.telefone}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {aberto && termo.trim().length >= 2 && resultados.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-400 shadow-lg">
          Nada encontrado para “{termo}”.
        </div>
      )}
    </div>
  )
}
