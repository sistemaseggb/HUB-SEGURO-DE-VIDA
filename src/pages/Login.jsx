import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Campo, Input, Card } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha inválidos.')
    setCarregando(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="rounded-xl bg-blue-600 p-3 text-white">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Hub Seguro de Vida</h1>
          <p className="text-sm text-slate-500">Acesso restrito da equipe</p>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <Campo label="E-mail" obrigatorio>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Campo>
          <Campo label="Senha" obrigatorio>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </Campo>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Usuários são criados pelo administrador no painel do Supabase
          (Authentication → Users).
        </p>
      </Card>
    </div>
  )
}
