import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { conferir, paginasCompletas, mensagemErro } from '../lib/operacoes'
import { brl } from '../lib/format'
import { baixarCSV } from '../lib/csv'
import { Card, Button, Campo, Select, InputMoeda } from './ui'
import ErroCarga from './ErroCarga'
import { useToast } from './toastContexto'
export default function ConciliacaoFinanceira({ mes }) {
  const [aberto, setAberto] = useState(false)
  const toast = useToast(),
    [apolices, setApolices] = useState([]),
    [linhas, setLinhas] = useState([]),
    [fechamentos, setFechamentos] = useState([]),
    [erro, setErro] = useState(null),
    [ocupado, setOcupado] = useState(false)
  const [apolice, setApolice] = useState(''),
    [previsto, setPrevisto] = useState(''),
    [repassado, setRepassado] = useState('')
  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const [ap, c] = await Promise.all([
        supabase
          .from('apolices')
          .select('id,id_cliente,numero_apolice,clientes(nome)')
          .order('created_at'),
        supabase
          .from('conciliacoes_mensais')
          .select('*')
          .eq('competencia', mes + '-01'),
      ])
      conferir(ap, c)
      const rows = await paginasCompletas((a, b) =>
        supabase
          .from('comissoes_importadas')
          .select('id,id_cliente,id_apolice,cliente_nome,valor,origem')
          .eq('competencia', mes + '-01')
          .order('id')
          .range(a, b),
      )
      setApolices(ap.data || [])
      setFechamentos(c.data || [])
      setLinhas(rows)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }, [mes])
  useEffect(() => {
    if (aberto) carregar()
  }, [carregar, aberto])
  async function vincular(l, id) {
    if (ocupado) return
    setOcupado(true)
    try {
      conferir(
        await supabase
          .from('comissoes_importadas')
          .update({ id_apolice: id || null })
          .eq('id', l.id)
          .select('id')
          .single(),
      )
      await carregar()
    } catch (e) {
      toast.erro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }
  async function salvar(e) {
    e.preventDefault()
    if (ocupado) return
    setOcupado(true)
    try {
      conferir(
        await supabase
          .from('conciliacoes_mensais')
          .upsert(
            {
              id_apolice: apolice,
              competencia: mes + '-01',
              previsto: Number(previsto),
              repassado: Number(repassado || 0),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id_apolice,competencia' },
          ),
      )
      await carregar()
      toast.ok('Conciliação salva.')
    } catch (e) {
      toast.erro(mensagemErro(e))
    } finally {
      setOcupado(false)
    }
  }
  const resumo = fechamentos.map((c) => {
    const rows = linhas.filter((l) => l.id_apolice === c.id_apolice),
      recebida = rows.reduce((a, l) => a + Math.max(Number(l.valor), 0), 0),
      estornos = rows.reduce((a, l) => a + Math.min(Number(l.valor), 0), 0)
    return {
      ...c,
      nome: apolices.find((a) => a.id === c.id_apolice)?.clientes?.nome || 'Apólice',
      recebida,
      estornos,
      saldo: recebida + estornos,
      diferenca: Math.round((recebida + estornos - Number(c.previsto)) * 100) / 100,
    }
  })
  return (
    <Card className="my-5 p-5">
      <details onToggle={(e) => setAberto(e.currentTarget.open)}>
        <summary className="cursor-pointer font-semibold">Conciliação por apólice · {mes}</summary>
        <p className="my-3 text-sm text-slate-500">
          Vincule lançamentos conferidos e informe o previsto nesta competência. Comissão estimada
          na venda não é necessariamente exigível neste mês. Repasse confirmado deve ser informado
          pelo financeiro.
        </p>
        {aberto &&
          (erro ? (
            <ErroCarga erro={erro} tentar={carregar} />
          ) : (
            <>
              <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-3">
                <Campo label="Apólice">
                  <Select
                    required
                    value={apolice}
                    onChange={(e) => {
                      setApolice(e.target.value)
                      const f = fechamentos.find((c) => c.id_apolice === e.target.value)
                      setPrevisto(f?.previsto ?? '')
                      setRepassado(f?.repassado ?? '')
                    }}
                  >
                    <option value="">Selecione...</option>
                    {apolices.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.clientes?.nome} · {a.numero_apolice || 'sem número'}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo label="Comissão bruta prevista neste mês">
                  <InputMoeda
                    required
                    value={previsto}
                    onChange={(e) => setPrevisto(e.target.value)}
                  />
                </Campo>
                <Campo label="Repasse confirmado neste mês">
                  <InputMoeda value={repassado} onChange={(e) => setRepassado(e.target.value)} />
                </Campo>
                <Button type="submit" disabled={ocupado}>
                  Salvar conciliação
                </Button>
              </form>
              <div className="my-4 overflow-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        'Apólice',
                        'Previsto',
                        'Recebido bruto',
                        'Estornos',
                        'Saldo',
                        'Diferença',
                        'Repassado',
                      ].map((x) => (
                        <th className="p-2" key={x}>
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.map((c) => (
                      <tr key={c.id} className={c.diferenca ? 'bg-amber-50' : 'bg-emerald-50'}>
                        <td className="p-2">{c.nome}</td>
                        {[
                          'previsto',
                          'recebida',
                          'estornos',
                          'saldo',
                          'diferenca',
                          'repassado',
                        ].map((k) => (
                          <td className="p-2" key={k}>
                            {brl(c[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  baixarCSV(
                    'conciliacao-' + mes + '.csv',
                    [
                      'Cliente',
                      'Apólice',
                      'Competência',
                      'Previsto',
                      'Recebido',
                      'Estornos',
                      'Saldo',
                      'Diferença',
                      'Repassado',
                    ],
                    resumo.map((c) => [
                      c.nome,
                      c.id_apolice,
                      mes,
                      c.previsto,
                      c.recebida,
                      c.estornos,
                      c.saldo,
                      c.diferenca,
                      c.repassado,
                    ]),
                  )
                }
              >
                Exportar conciliação
              </Button>
              <details className="mt-4">
                <summary>
                  Conferir vínculos dos lançamentos ({linhas.filter((l) => !l.id_apolice).length}{' '}
                  sem apólice)
                </summary>
                <div className="max-h-96 overflow-auto">
                  {linhas.map((l) => (
                    <div key={l.id} className="grid gap-2 border-t py-3 text-sm sm:grid-cols-2">
                      <span>
                        {l.cliente_nome} · {brl(l.valor)} · {l.origem}
                      </span>
                      <Select
                        aria-label={`Apólice do lançamento ${l.cliente_nome}`}
                        disabled={ocupado || !l.id_cliente}
                        value={l.id_apolice || ''}
                        onChange={(e) => vincular(l, e.target.value)}
                      >
                        <option value="">
                          {l.id_cliente ? 'Não vinculado' : 'Primeiro identifique o cliente'}
                        </option>
                        {apolices
                          .filter((a) => a.id_cliente === l.id_cliente)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.numero_apolice || 'Sem número'}
                            </option>
                          ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ))}
      </details>
    </Card>
  )
}
