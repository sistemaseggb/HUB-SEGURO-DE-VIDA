import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, MODO_DEMO } from '../lib/supabase'
import { conferir, mensagemErro } from '../lib/operacoes'
import { Button, Campo, Input, Card } from '../components/ui'
export default function RecuperarAcesso() {
  const [email, setEmail] = useState(''),
    [senha, setSenha] = useState(''),
    [confirmacao, setConfirmacao] = useState('')
  const [sessao, setSessao] = useState(false),
    [ocupado, setOcupado] = useState(false),
    [aviso, setAviso] = useState(''),
    [erro, setErro] = useState('')
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSessao(!!data?.session))
      .catch(() => setSessao(false))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(!!s))
    return () => data.subscription.unsubscribe()
  }, [])
  async function enviar(e) {
    e.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setErro('')
    setAviso('')
    try {
      if (MODO_DEMO)
        throw new Error('Recuperação de acesso está disponível somente para contas reais.')
      if (sessao) {
        if (senha.length < 12 || senha !== confirmacao)
          throw new Error('Use pelo menos 12 caracteres e confirme a mesma senha.')
        conferir(await supabase.auth.updateUser({ password: senha }))
        setSenha('')
        setConfirmacao('')
        setAviso('Senha atualizada. Você já pode voltar ao sistema.')
      } else {
        conferir(
          await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin + '/recuperar-acesso',
          }),
        )
        setAviso(
          'Se este e-mail tiver uma conta, você receberá instruções. Confira também a caixa de spam.',
        )
      }
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-3 text-xl font-semibold">
          {sessao ? 'Definir nova senha' : 'Recuperar acesso'}
        </h1>
        <form onSubmit={enviar} className="space-y-4">
          {sessao ? (
            <>
              <Campo label="Nova senha">
                <Input
                  autoComplete="new-password"
                  type="password"
                  minLength={12}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </Campo>
              <Campo label="Confirme a nova senha">
                <Input
                  autoComplete="new-password"
                  type="password"
                  required
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                />
              </Campo>
            </>
          ) : (
            <Campo label="E-mail da sua conta">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>
          )}
          {erro && (
            <p role="alert" className="text-sm text-red-700">
              {erro}
            </p>
          )}
          {aviso && (
            <p role="status" className="text-sm text-emerald-800">
              {aviso}
            </p>
          )}
          <Button disabled={ocupado} type="submit">
            {ocupado ? 'Aguarde...' : sessao ? 'Salvar nova senha' : 'Enviar instruções'}
          </Button>
        </form>
        <Link className="mt-4 block text-sm underline" to="/">
          Voltar ao sistema
        </Link>
      </Card>
    </div>
  )
}
