import { useEffect, useState } from 'react'
import { supabase, MODO_DEMO } from '../lib/supabase'
import { conferir } from '../lib/operacoes'
import { Spinner, Button } from './ui'
import ErroCarga from './ErroCarga'
export default function PortaPerfil({ children }) {
  const [perfil, setPerfil] = useState(MODO_DEMO ? 'admin' : undefined),
    [erro, setErro] = useState(null),
    [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    if (MODO_DEMO) return
    let vivo = true
    supabase
      .rpc('fn_hub_papel')
      .then((r) => {
        conferir(r)
        if (vivo) setPerfil(r.data)
      })
      .catch((e) => {
        if (vivo) setErro(e)
      })
    return () => {
      vivo = false
    }
  }, [tentativa])
  if (erro)
    return (
      <ErroCarga
        erro="Não foi possível verificar as permissões da conta. Tente novamente ou fale com a administração."
        tentar={() => {
          setErro(null)
          setTentativa((x) => x + 1)
        }}
      />
    )
  if (perfil === undefined) return <Spinner />
  if (!perfil)
    return (
      <div role="alert" className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold">Acesso ainda não autorizado</h1>
        <p className="my-4">
          Peça à administração para atribuir um perfil à sua conta. Os dados da carteira não foram
          carregados.
        </p>
        <Button onClick={() => supabase.auth.signOut()}>Sair da conta</Button>
      </div>
    )
  return (
    <>
      {perfil === 'leitura' && (
        <div role="status" className="bg-blue-50 p-3 text-center text-sm">
          Seu acesso é somente leitura. Alterações precisam de uma consultora ou administradora.
        </div>
      )}
      {children}
    </>
  )
}
