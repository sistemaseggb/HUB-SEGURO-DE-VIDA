import { useState } from 'react'
import { ShieldCheck, TrendingUp, HeartHandshake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Campo, Input } from '../components/ui'

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
    <div className="flex min-h-screen">
      {/* Painel de marca (some no celular) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white/15 p-2 backdrop-blur">
            <ShieldCheck size={24} />
          </div>
          <span className="font-display text-lg font-semibold">Hub Seguros</span>
        </div>
        <div className="relative">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            A gestão completa da<br />sua consultoria de<br />seguro de vida.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Pipeline, pós-venda, comissões e relacionamento — tudo automatizado,
            para você focar no que importa: vender e cuidar dos clientes.
          </p>
          <div className="mt-8 flex gap-6 text-sm text-white/80">
            <span className="flex items-center gap-2"><TrendingUp size={17} className="text-gold-400" /> Mais conversão</span>
            <span className="flex items-center gap-2"><HeartHandshake size={17} className="text-gold-400" /> Menos trabalho</span>
          </div>
        </div>
        <p className="relative text-xs text-white/50">Natália Maschendorf · Consultoria de Seguro de Vida e Blindagem Patrimonial</p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-3 text-white shadow-sm">
              <ShieldCheck size={28} />
            </div>
            <h1 className="font-display text-xl font-semibold text-slate-900">Hub Seguros</h1>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-2xl font-semibold text-slate-900">Bem-vinda de volta 👋</h2>
            <p className="mt-1 text-sm text-slate-500">Entre com seus dados de acesso.</p>
          </div>

          <form onSubmit={entrar} className="space-y-4">
            <Campo label="E-mail" obrigatorio>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="voce@email.com" />
            </Campo>
            <Campo label="Senha" obrigatorio>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required placeholder="••••••••" />
            </Campo>
            {erro && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-100">{erro}</p>
            )}
            <Button type="submit" className="w-full py-2.5" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Acesso restrito. Usuários são criados pelo administrador no painel do Supabase.
          </p>
        </div>
      </div>
    </div>
  )
}
