import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { guardarRascunho, lerRascunho, apagarRascunho } from '../lib/rascunhos'
import { Button } from './ui'
export default function RascunhoProtegido({ cliente, valor, sujo, restaurar }) {
  const [usuario, setUsuario] = useState(null),
    [ativo, setAtivo] = useState(false),
    [oferta, setOferta] = useState(null),
    [erro, setErro] = useState('')
  const sequencia = useRef(Promise.resolve()),
    versao = useRef(0)
  useEffect(() => {
    let vivo = true
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const user = data?.session?.user?.id || data?.session?.user?.email
        if (!user) return
        const r = await lerRascunho(user, cliente)
        if (vivo) {
          setUsuario(user)
          setOferta(r)
          setAtivo(!!r)
        }
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [cliente])
  useEffect(() => {
    if (!ativo || !usuario || !sujo) return
    const geracao = ++versao.current
    const timer = setTimeout(() => {
      sequencia.current = sequencia.current
        .catch(() => {})
        .then(async () => {
          if (geracao === versao.current) await guardarRascunho(usuario, cliente, valor)
        })
        .catch(() =>
          setErro('Não foi possível guardar o rascunho neste navegador. Salve no sistema.'),
        )
    }, 300)
    return () => clearTimeout(timer)
  }, [ativo, usuario, cliente, valor, sujo])
  return (
    <div className="my-3 rounded-lg border p-3 text-xs text-slate-600">
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={ativo}
          disabled={!usuario}
          onChange={(e) => {
            setAtivo(e.target.checked)
            if (!e.target.checked) {
              versao.current++
              sequencia.current = sequencia.current
                .catch(() => {})
                .then(() => apagarRascunho(usuario, cliente))
              setOferta(null)
            }
          }}
        />
        Guardar rascunho cifrado neste dispositivo privado por até 24h, enquanto a sessão do
        navegador estiver disponível.
      </label>
      <p className="mt-1">
        Não use em computador compartilhado. Sair da conta remove os rascunhos. O rascunho não
        confirma gravação no banco.
      </p>
      {oferta && (
        <div className="mt-2">
          <p>Existe um rascunho recuperável. Compare com os dados do sistema antes de salvar.</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              restaurar(oferta)
              setOferta(null)
            }}
          >
            Recuperar rascunho
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOferta(null)
              apagarRascunho(usuario, cliente)
            }}
          >
            Manter dados do sistema
          </Button>
        </div>
      )}
      {erro && <p role="alert">{erro}</p>}
    </div>
  )
}
