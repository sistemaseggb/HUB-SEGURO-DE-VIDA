import { Component } from 'react'

// Rede de segurança: se qualquer erro inesperado estourar na interface,
// o usuário vê uma tela amigável com botão de recarregar — nunca uma
// página branca. O erro vai para o console para diagnóstico.
export default class ErroFatal extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('[Hub] Erro inesperado na interface:', erro, info)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-8 text-center">
        <img src="/logo-gb.png" srcSet="/logo-gb-96.png 96w, /logo-gb-192.png 192w, /logo-gb.png 800w" sizes="56px"
          alt="GB" className="h-14 opacity-90" />
        <h1 className="font-display text-xl font-semibold text-slate-900">Algo deu errado por aqui</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Aconteceu um erro inesperado. Seus dados estão seguros — recarregue a
          página para continuar de onde parou.
        </p>
        <button onClick={() => window.location.reload()}
          className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          Recarregar a página
        </button>
        <p className="mt-2 max-w-md truncate text-xs text-slate-400" title={String(this.state.erro)}>
          Detalhe técnico: {String(this.state.erro?.message ?? this.state.erro)}
        </p>
      </div>
    )
  }
}
