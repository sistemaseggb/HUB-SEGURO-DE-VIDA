import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { conferir, mensagemErro } from '../lib/operacoes'
import { Button, Campo, Select } from './ui'
import { useToast } from './toastContexto'
export default function ConsolidarClientes({ clientes, aoSalvar }) {
  const [aberto, setAberto] = useState(false)
  const toast = useToast(),
    [origem, setOrigem] = useState(''),
    [destino, setDestino] = useState(''),
    [ocupado, setOcupado] = useState(false)
  async function consolidar(e) {
    e.preventDefault()
    if (ocupado || origem === destino) return
    const de = clientes.find((c) => c.id === origem),
      para = clientes.find((c) => c.id === destino)
    if (
      !window.confirm(
        `Consolidar ${de?.nome} em ${para?.nome}? O cadastro e assessor do destino serão mantidos. A origem será arquivada. Estudos conflitantes impedem a operação. Esta consolidação precisa de revisão administrativa para ser desfeita.`,
      )
    )
      return
    setOcupado(true)
    try {
      conferir(
        await supabase.rpc('fn_hub_mesclar_clientes', { p_origem: origem, p_destino: destino }),
      )
      toast.ok('Cadastros consolidados com histórico preservado.')
      setOrigem('')
      setDestino('')
      aoSalvar()
    } catch (e) {
      toast.erro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }
  return (
    <details
      onToggle={(e) => setAberto(e.currentTarget.open)}
      className="mb-4 rounded-lg border bg-white p-3"
    >
      <summary className="cursor-pointer text-sm font-medium">
        Conferir e consolidar cadastros duplicados · administração
      </summary>
      <p className="my-2 text-xs text-slate-500">
        Compare telefone, e-mail e código. Não consolide pessoas diferentes apenas porque
        compartilham o mesmo telefone.
      </p>
      {aberto && (
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={consolidar}>
          {[
            ['Cadastro de origem (será arquivado)', origem, setOrigem],
            ['Cadastro a manter (destino)', destino, setDestino],
          ].map(([l, v, set]) => (
            <Campo key={l} label={l}>
              <Select required value={v} onChange={(e) => set(e.target.value)}>
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · {c.codigo || 'sem código'} · {c.telefone || 'sem telefone'}
                  </option>
                ))}
              </Select>
            </Campo>
          ))}
          <Button type="submit" disabled={ocupado || !origem || !destino || origem === destino}>
            Consolidar após conferência
          </Button>
        </form>
      )}
    </details>
  )
}
