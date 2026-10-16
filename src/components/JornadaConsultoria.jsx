import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { conferir, mensagemErro } from '../lib/operacoes'
import { brl, dataBR, hojeLocal } from '../lib/format'
import { Button, Campo, Input, InputMoeda, Select, Textarea, Card } from './ui'
import ErroCarga from './ErroCarga'
import { useToast } from './toastContexto'

const FASES = [
  'preparacao',
  'diagnostico',
  'estudo',
  'proposta',
  'acompanhamento',
  'emissao',
  'revisao',
]
const NOMES = [
  'Preparar reunião',
  'Diagnóstico',
  'Conferir estudo',
  'Apresentar proposta',
  'Acompanhar decisão',
  'Emitir apólice',
  'Revisar proteção',
]
const ORIENTACAO = [
  'Confira cadastro, última conversa, objetivo da reunião e informações que faltam.',
  'Levante família, renda, compromissos e coberturas existentes. Confirme os números com o cliente.',
  'Revise premissas, pendências e recomendações. Compare cotações equivalentes antes de indicar.',
  'Confira o estudo e publique uma versão com prazo. Notas internas não acompanham o link.',
  'Registre o resultado do contato e uma próxima ação com data, inclusive quando o cliente preferir esperar.',
  'Acompanhe documentos, DPS e análise da seguradora. Aceite da proposta não significa proteção vigente.',
  'Revise renda, família, dívidas, empresa e beneficiários. Em sinistro, registre protocolo e pendências sem prometer aprovação.',
]

export function AtendimentoRapido({ idCliente, aoSalvar }) {
  const toast = useToast()
  const [form, setForm] = useState({ tipo: 'whatsapp', resultado: '', acao: '', data: hojeLocal() })
  const [salvando, setSalvando] = useState(false)
  const chave = useRef(crypto.randomUUID())
  const trava = useRef(false)
  const campo = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  async function salvar(e) {
    e.preventDefault()
    if (trava.current) return
    trava.current = true
    setSalvando(true)
    try {
      conferir(
        await supabase.rpc('fn_registrar_atendimento', {
          p_id: chave.current,
          p_cliente: idCliente,
          p_tipo: form.tipo,
          p_resultado: form.resultado.trim(),
          p_acao: form.acao.trim(),
          p_data: form.data,
        }),
      )
      chave.current = crypto.randomUUID()
      toast.ok('Contato registrado e próxima ação agendada.')
      setForm((f) => ({ ...f, resultado: '', acao: '' }))
      aoSalvar?.()
    } catch (e) {
      toast.erro(mensagemErro(e))
    } finally {
      trava.current = false
      setSalvando(false)
    }
  }
  return (
    <form onSubmit={salvar} className="space-y-3">
      <Campo label="Canal">
        <Select value={form.tipo} onChange={(e) => campo('tipo', e.target.value)}>
          {['whatsapp', 'ligacao', 'email', 'reuniao', 'nota'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
      </Campo>
      <Campo label="Resultado da conversa" obrigatorio>
        <Textarea
          required
          maxLength={5000}
          value={form.resultado}
          onChange={(e) => campo('resultado', e.target.value)}
        />
      </Campo>
      <Campo label="Próxima ação" obrigatorio>
        <Input
          required
          maxLength={300}
          placeholder="Ex.: confirmar cotação com a seguradora"
          value={form.acao}
          onChange={(e) => campo('acao', e.target.value)}
        />
      </Campo>
      <Campo label="Data da próxima ação" obrigatorio>
        <Input
          type="date"
          required
          value={form.data}
          onChange={(e) => campo('data', e.target.value)}
        />
      </Campo>
      <Button disabled={salvando} type="submit">
        {salvando ? 'Registrando...' : 'Registrar contato e próximo passo'}
      </Button>
    </form>
  )
}

const NOVA_COTACAO = {
  seguradora: '',
  produto: '',
  premio: '',
  capital: '',
  coberturas: '',
  exclusoes: '',
  carencias: '',
  franquias: '',
  reajuste: '',
  validade: '',
  data_cotacao: hojeLocal(),
  id_documento: '',
  recomendacao: '',
}
export default function JornadaConsultoria({ idCliente }) {
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [estado, setEstado] = useState({
    fase: 'diagnostico',
    emissao: 'nao_iniciada',
    pagamento_confirmado: false,
  })
  const [cotacoes, setCotacoes] = useState([])
  const [versoes, setVersoes] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [apolices, setApolices] = useState([])
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const [cotacao, setCotacao] = useState(NOVA_COTACAO)
  const trava = useRef(false)
  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const [a, c, p, d, ap] = await Promise.all([
        supabase.from('acompanhamentos').select('*').eq('id_cliente', idCliente).maybeSingle(),
        supabase
          .from('cotacoes')
          .select('*')
          .eq('id_cliente', idCliente)
          .order('created_at', { ascending: false }),
        supabase
          .from('propostas_versoes')
          .select('id,versao,token,validade,revogada_em,created_at,decisao')
          .eq('id_cliente', idCliente)
          .order('versao', { ascending: false }),
        supabase.from('documentos').select('id,nome').eq('id_cliente', idCliente),
        supabase.from('apolices').select('id,numero_apolice,status').eq('id_cliente', idCliente),
      ])
      conferir(a, c, p, d, ap)
      setEstado(
        a.data ?? { fase: 'diagnostico', emissao: 'nao_iniciada', pagamento_confirmado: false },
      )
      setCotacoes(c.data ?? [])
      setVersoes(p.data ?? [])
      setDocumentos(d.data ?? [])
      setApolices(ap.data ?? [])
      setCarregado(true)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }, [idCliente])
  useEffect(() => {
    if (aberto) carregar()
  }, [carregar, aberto])
  const alterar = (k, v) => setEstado((s) => ({ ...s, [k]: v }))
  async function executar(fn, sucesso) {
    if (trava.current) return
    trava.current = true
    setOcupado(true)
    try {
      await fn()
      toast.ok(sucesso)
      await carregar()
    } catch (e) {
      toast.erro(mensagemErro(e))
    } finally {
      trava.current = false
      setOcupado(false)
    }
  }
  async function salvarJornada(e) {
    e.preventDefault()
    await executar(async () => {
      const payload = { ...estado, id_cliente: idCliente, updated_at: new Date().toISOString() }
      for (const k of ['prazo', 'revisao_em', 'id_apolice']) payload[k] ||= null
      conferir(await supabase.rpc('fn_hub_salvar_acompanhamento', { p_dados: payload }))
    }, 'Jornada salva; lembretes atualizados.')
  }
  async function salvarCotacao(e) {
    e.preventDefault()
    await executar(async () => {
      conferir(
        await supabase
          .from('cotacoes')
          .insert({ ...cotacao, id_documento: cotacao.id_documento || null, id_cliente: idCliente })
          .select('id')
          .single(),
      )
      setCotacao({ ...NOVA_COTACAO, data_cotacao: hojeLocal() })
    }, 'Cotação registrada. Confira equivalência das coberturas antes de recomendar.')
  }
  const indice = Math.max(0, FASES.indexOf(estado.fase))
  return (
    <Card className="mb-5 p-4">
      <details onToggle={(e) => setAberto(e.currentTarget.open)}>
        <summary className="cursor-pointer font-semibold text-slate-900">
          Jornada da consultoria · {NOMES[indice]}
        </summary>
        {aberto &&
          (erro ? (
            <ErroCarga erro={erro} tentar={carregar} />
          ) : !carregado ? (
            <p role="status">Carregando acompanhamento...</p>
          ) : (
            <div className="mt-4 space-y-5">
              <p className="rounded-lg bg-blue-50 p-3 text-sm">{ORIENTACAO[indice]}</p>
              <details>
                <summary className="cursor-pointer font-medium">
                  Registrar atendimento e próximo passo
                </summary>
                <div className="mt-3">
                  <AtendimentoRapido idCliente={idCliente} aoSalvar={carregar} />
                </div>
              </details>
              <form onSubmit={salvarJornada} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Fase do atendimento">
                    <Select value={estado.fase} onChange={(e) => alterar('fase', e.target.value)}>
                      {FASES.map((f, i) => (
                        <option key={f} value={f}>
                          {NOMES[i]}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo label="Situação da emissão">
                    <Select
                      value={estado.emissao}
                      onChange={(e) => alterar('emissao', e.target.value)}
                    >
                      {[
                        ['nao_iniciada', 'Não iniciada'],
                        ['documentacao', 'Conferir documentação'],
                        ['dps', 'DPS'],
                        ['analise', 'Em análise na seguradora'],
                        ['pendencia', 'Com pendência'],
                        ['emitida', 'Emitida, confirmar vigência'],
                        ['vigente', 'Vigente e pagamento confirmado'],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo label="Apólice vinculada">
                    <Select
                      required={estado.emissao === 'vigente'}
                      value={estado.id_apolice || ''}
                      onChange={(e) => alterar('id_apolice', e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {apolices.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.numero_apolice || 'Sem número'} · {a.status}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo label="Responsável pelo próximo retorno">
                    <Input
                      maxLength={150}
                      value={estado.responsavel || ''}
                      onChange={(e) => alterar('responsavel', e.target.value)}
                    />
                  </Campo>
                  <Campo label="Pendência ou protocolo">
                    <Input
                      required={estado.emissao === 'pendencia'}
                      maxLength={1000}
                      value={estado.pendencia || ''}
                      onChange={(e) => alterar('pendencia', e.target.value)}
                    />
                  </Campo>
                  <Campo label="Prazo do retorno">
                    <Input
                      type="date"
                      value={estado.prazo || ''}
                      onChange={(e) => alterar('prazo', e.target.value)}
                    />
                  </Campo>
                </div>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!estado.pagamento_confirmado}
                    onChange={(e) => alterar('pagamento_confirmado', e.target.checked)}
                  />
                  Pagamento confirmado com a seguradora
                </label>
                <details>
                  <summary className="cursor-pointer font-medium">
                    Revisão da proteção e mudanças de vida
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Campo label="Próxima revisão">
                      <Input
                        type="date"
                        value={estado.revisao_em || ''}
                        onChange={(e) => alterar('revisao_em', e.target.value)}
                      />
                    </Campo>
                    <Campo label="Mudança ou motivo da revisão">
                      <Input
                        maxLength={1000}
                        placeholder="Filhos, casamento, renda, dívidas, empresa..."
                        value={estado.motivo_revisao || ''}
                        onChange={(e) => alterar('motivo_revisao', e.target.value)}
                      />
                    </Campo>
                    {[
                      ['renda_revisada', 'Renda, dívidas e empresa conferidas'],
                      ['familia_revisada', 'Família e dependentes conferidos'],
                      ['beneficiarios_revisados', 'Beneficiários conferidos'],
                      ['coberturas_revisadas', 'Coberturas e exclusões conferidas'],
                    ].map(([k, l]) => (
                      <label key={k} className="flex gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!estado[k]}
                          onChange={(e) => alterar(k, e.target.checked)}
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Em sinistro: confirme canal da seguradora, protocolo, documentos solicitados e
                    prazo de retorno. Não registre documentação médica em mensagens públicas.
                  </p>
                </details>
                <Button disabled={ocupado} type="submit">
                  Salvar jornada e lembretes
                </Button>
              </form>
              <details>
                <summary className="cursor-pointer font-medium">
                  Cotações reais · {cotacoes.length}
                </summary>
                <p className="my-3 text-sm text-slate-500">
                  Valores da seguradora, sujeitos à análise. Uma estimativa do motor não substitui
                  estas cotações. Compare as mesmas coberturas e condições.
                </p>
                {cotacoes.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead>
                        <tr>
                          {[
                            'Seguradora / produto',
                            'Prêmio / capital',
                            'Condições',
                            'Validade',
                            'Recomendação',
                          ].map((x) => (
                            <th key={x} className="p-2">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cotacoes.map((c) => (
                          <tr key={c.id} className="border-t">
                            <td className="p-2">
                              {c.seguradora}
                              <br />
                              {c.produto}
                              <br />
                              Cotada em {dataBR(c.data_cotacao)}
                            </td>
                            <td className="p-2">
                              {brl(c.premio)}/mês
                              <br />
                              {brl(c.capital)}
                            </td>
                            <td className="p-2">
                              <details>
                                <summary>Ver condições</summary>
                                <p>Coberturas: {c.coberturas}</p>
                                <p>Exclusões: {c.exclusoes}</p>
                                <p>Carências: {c.carencias}</p>
                                <p>Franquias: {c.franquias}</p>
                                <p>Reajuste: {c.reajuste}</p>
                              </details>
                            </td>
                            <td className="p-2">
                              {dataBR(c.validade)}
                              {c.validade < hojeLocal() && (
                                <strong className="block text-red-700">Vencida</strong>
                              )}
                            </td>
                            <td className="p-2">
                              {c.recomendacao}
                              <Button
                                variant="secondary"
                                disabled={ocupado || c.validade < hojeLocal()}
                                onClick={() =>
                                  executar(
                                    async () =>
                                      conferir(
                                        await supabase.rpc('fn_cotacao_aplicar', { p_id: c.id }),
                                      ),
                                    'Cotação vinculada. Reabra o planejamento para conferir o prêmio.',
                                  )
                                }
                              >
                                Usar prêmio cotado
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <form onSubmit={salvarCotacao} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['seguradora', 'Seguradora'],
                      ['produto', 'Produto'],
                      ['coberturas', 'Coberturas e capitais por cobertura'],
                      ['exclusoes', 'Exclusões relevantes'],
                      ['carencias', 'Carências'],
                      ['franquias', 'Franquias'],
                      ['reajuste', 'Regra de reajuste'],
                    ].map(([k, l]) => (
                      <Campo key={k} label={l} obrigatorio>
                        <Input
                          required
                          maxLength={3000}
                          value={cotacao[k]}
                          onChange={(e) => setCotacao((c) => ({ ...c, [k]: e.target.value }))}
                        />
                      </Campo>
                    ))}
                    {['premio', 'capital'].map((k) => (
                      <Campo
                        key={k}
                        label={k === 'premio' ? 'Prêmio mensal cotado' : 'Capital total cotado'}
                        obrigatorio
                      >
                        <InputMoeda
                          required
                          value={cotacao[k]}
                          onChange={(e) => setCotacao((c) => ({ ...c, [k]: e.target.value }))}
                        />
                      </Campo>
                    ))}
                    {['data_cotacao', 'validade'].map((k) => (
                      <Campo
                        key={k}
                        label={k === 'validade' ? 'Válida até' : 'Data da cotação'}
                        obrigatorio
                      >
                        <Input
                          type="date"
                          required
                          min={k === 'validade' ? cotacao.data_cotacao : undefined}
                          value={cotacao[k]}
                          onChange={(e) => setCotacao((c) => ({ ...c, [k]: e.target.value }))}
                        />
                      </Campo>
                    ))}
                  </div>
                  <Campo label="Documento da cotação">
                    <Select
                      value={cotacao.id_documento}
                      onChange={(e) => setCotacao((c) => ({ ...c, id_documento: e.target.value }))}
                    >
                      <option value="">Anexe antes na aba Documentos</option>
                      {documentos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo label="Justificativa da recomendação">
                    <Textarea
                      maxLength={3000}
                      value={cotacao.recomendacao}
                      onChange={(e) => setCotacao((c) => ({ ...c, recomendacao: e.target.value }))}
                    />
                  </Campo>
                  <Button disabled={ocupado} type="submit">
                    Registrar cotação real
                  </Button>
                </form>
              </details>
              <details>
                <summary className="cursor-pointer font-medium">
                  Versões de propostas compartilhadas · {versoes.length}
                </summary>
                <p className="my-2 text-sm">
                  Publique uma versão na tela de proposta depois de conferir os dados. A versão
                  enviada não muda quando você editar o estudo.
                </p>
                {versoes.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center gap-3 border-t py-3 text-sm"
                  >
                    <span>
                      Versão {v.versao} · até {dataBR(v.validade)} ·{' '}
                      {v.revogada_em
                        ? 'Revogada'
                        : new Date(v.validade) < new Date()
                          ? 'Expirada'
                          : 'Disponível'}
                      {v.decisao && ` · Cliente: ${v.decisao}`}
                    </span>
                    {!v.revogada_em && (
                      <Button
                        variant="danger"
                        disabled={ocupado}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Revogar este link? O cliente não poderá mais abrir esta versão.',
                            )
                          )
                            executar(
                              async () =>
                                conferir(await supabase.rpc('fn_proposta_revogar', { p_id: v.id })),
                              'Link revogado.',
                            )
                        }}
                      >
                        Revogar link
                      </Button>
                    )}
                  </div>
                ))}
              </details>
            </div>
          ))}
      </details>
    </Card>
  )
}
