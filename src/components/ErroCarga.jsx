import { Button } from './ui'
export default function ErroCarga({ erro, tentar }) {
  return (
    <div
      role="alert"
      className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
    >
      <p className="font-semibold">Não foi possível carregar os dados</p>
      <p className="mt-1">Os dados não foram apagados. {erro?.message || String(erro)}</p>
      <Button className="mt-3" variant="secondary" onClick={tentar}>
        Tentar novamente
      </Button>
    </div>
  )
}
