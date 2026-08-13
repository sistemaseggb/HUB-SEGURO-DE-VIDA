import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Send, Trash2, Check, Clock3, AlertTriangle, User, Building2, UserCheck,
  MessageCircle, FileSignature,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto, dataBR, hojeLocal, whatsapp } from '../lib/format'
import {
  DE_QUEM, SITUACOES, conferirProposta, diagnosticarProposta, situacaoInfo,
} from '../lib/propostas'
import {
  Button, Card, Input, InputMoeda, Select, Textarea, Campo, Modal, Badge, Spinner,
  EmptyState, ComoFunciona,
} from '../components/ui'
import { useToast } from '../components/toastContexto'

// ─────────────────────────────────────────────────────────────────────────────
// EM ANÁLISE — o vão entre "o cliente disse sim" e "a apólice existe".
//
// O funil sempre teve esta etapa e ela sempre foi uma caixa preta: o Kanban
// mostrava o cliente parado em "Em Análise" há 23 dias e mais nada. Não dizia
// se falta um exame, se o cliente não respondeu a DPS, se já foi aprovada e
// falta emitir, ou se foi recusada há três semanas.
//
// É o lugar mais caro para perder um cliente, porque o trabalho já foi todo
// feito: as reuniões, o estudo, a apresentação, a objeção respondida, o sim.
//
// A tela é organizada por UMA pergunta — com quem está a bola — porque é ela
// que decide a ação. Cobrar a seguradora quando a pendência é do cliente é
// perder o dia; cobrar o cliente quando a bola é da seguradora é irritar quem
// já fez a parte dele.
// ─────────────────────────────────────────────────────────────────────────────

const ICONE_DONO = { cliente: User, seguradora: Building2, consultora: UserCheck }
const TOM_ACAO = { bom: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  alerta: 'text-amber-800 bg-amber-50 border-amber-200',
  ruim: 'text-red-700 bg-red-50 border-red-200',
  neutro: 'text-slate-600 bg-slate-50 border-slate-200' }

const VAZIA = {
  id_seguradora: '', numero_proposta: '', data_envio: hojeLocal(),
  capital: '', premio_mensal: '', situacao: 'enviada', motivo_recusa: '', observacoes: '',
}

export default function AbaAnalise({ idCliente, cliente, onMudanca }) {
  const toast = useToast()
  const [propostas, setPropostas] = useState(null)
  const [seguradoras, setSeguradoras] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIA)
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState(null)
  // a coluna só existe depois da migração 024
  const [semTabela, setSemTabela] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('propostas_seguradora')
      .select('*, seguradoras(nome)').eq('id_cliente', idCliente)
      .order('data_envio', { ascending: false })
    if (error && /does not exist|relation/i.test(error.message ?? '')) {
      setSemTabela(true)
      setPropostas([])
      return
    }
    setPropostas(data ?? [])
  }, [idCliente])

  useEffect(() => {
    carregar()
    supabase.from('seguradoras').select('id, nome').order('nome')
      .then(({ data }) => setSeguradoras(data ?? []))
  }, [carregar])

  function abrirNova() { setEditando(null); setForm(VAZIA); setErro(null); setModal(true) }
  function abrirEdicao(p) {
    setEditando(p.id)
    setForm({
      id_seguradora: p.id_seguradora ?? '', numero_proposta: p.numero_proposta ?? '',
      data_envio: String(p.data_envio ?? '').slice(0, 10), capital: p.capital ?? '',
      premio_mensal: p.premio_mensal ?? '', situacao: p.situacao,
      motivo_recusa: p.motivo_recusa ?? '', observacoes: p.observacoes ?? '',
    })
    setErro(null); setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro(null)
    const payload = {
      id_cliente: idCliente,
      id_seguradora: form.id_seguradora || null,
      numero_proposta: form.numero_proposta || null,
      data_envio: form.data_envio || hojeLocal(),
      capital: form.capital === '' ? null : Number(form.capital),
      premio_mensal: form.premio_mensal === '' ? null : Number(form.premio_mensal),
      situacao: form.situacao,
      motivo_recusa: form.motivo_recusa || null,
      observacoes: form.observacoes || null,
    }
    const { error } = editando
      ? await supabase.from('propostas_seguradora').update(payload).eq('id', editando)
      : await supabase.from('propostas_seguradora').insert(payload)
    if (error) return setErro(error.message)
    setModal(false)
    toast.ok(editando ? 'Proposta atualizada.' : 'Proposta registrada.')
    carregar(); onMudanca?.()
  }

  async function mudarSituacao(p, situacao) {
    const { error } = await supabase.from('propostas_seguradora')
      .update({ situacao }).eq('id', p.id)
    if (error) return toast.erro(`Não consegui atualizar: ${error.message}`)
    toast.ok(`Agora: ${situacaoInfo(situacao).rotulo}.`)
    carregar(); onMudanca?.()
  }

  async function gravarExigencias(p, exigencias) {
    const { error } = await supabase.from('propostas_seguradora')
      .update({ exigencias }).eq('id', p.id)
    if (error) return toast.erro(`Não consegui salvar a pendência: ${error.message}`)
    carregar()
  }

  async function excluir(p) {
    if (!window.confirm('Excluir esta proposta e as pendências dela?')) return
    const { error } = await supabase.from('propostas_seguradora').delete().eq('id', p.id)
    if (error) return toast.erro(`Não consegui excluir: ${error.message}`)
    toast.ok('Proposta excluída.')
    carregar(); onMudanca?.()
  }

  if (!propostas) return <Spinner />

  if (semTabela) {
    return (
      <Card className="p-5">
        <p className="font-semibold text-slate-900">Acompanhamento de proposta ainda não instalado</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Rode a migração <code className="rounded bg-slate-100 px-1">024_propostas_em_analise.sql</code> no
          SQL Editor do Supabase para acompanhar aqui o que falta para a apólice sair — exigências,
          de quem depende cada uma e há quantos dias está parada.
        </p>
      </Card>
    )
  }

  const diagnosticos = propostas.map((p) => diagnosticarProposta(p))
  const abertas = diagnosticos.filter((d) => d.aberta)

  return (
    <div className="space-y-5">
      <ComoFunciona id="analise">
        Depois que o cliente diz <strong>sim</strong>, a proposta entra na seguradora e some do radar por
        semanas. Aqui você registra <strong>o que falta</strong> e, principalmente, <strong>de quem
        depende</strong> — porque a ação é outra conforme a bola esteja com o cliente, com a seguradora
        ou com você. É a etapa mais cara para perder um cliente: o trabalho já foi todo feito.
      </ComoFunciona>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">
            Propostas na seguradora
            {abertas.length > 0 && <span className="ml-2 text-sm font-normal text-slate-400">
              {abertas.length} em aberto</span>}
          </h2>
        </div>
        <Button onClick={abrirNova}><Plus size={15} /> Registrar proposta</Button>
      </div>

      {diagnosticos.length === 0 && (
        <EmptyState icone={Send} titulo="Nenhuma proposta registrada"
          texto="Quando o cliente aceitar e você enviar a proposta para a seguradora, registre aqui — o sistema passa a cobrar o que está parado.">
          <Button onClick={abrirNova}><Plus size={15} /> Registrar proposta</Button>
        </EmptyState>
      )}

      {diagnosticos.map((d) => (
        <CartaoProposta key={d.id} d={d} cliente={cliente}
          aoEditar={() => abrirEdicao(d)} aoExcluir={() => excluir(d)}
          aoMudarSituacao={(s) => mudarSituacao(d, s)}
          aoGravarExigencias={(ex) => gravarExigencias(d, ex)} />
      ))}

      <Modal aberto={modal} titulo={editando ? 'Editar proposta' : 'Registrar proposta na seguradora'}
        onFechar={() => setModal(false)} largura="max-w-2xl">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Seguradora">
              <Select value={form.id_seguradora} onChange={(e) => setForm({ ...form, id_seguradora: e.target.value })}>
                <option value="">Selecione…</option>
                {seguradoras.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Select>
            </Campo>
            <Campo label="Nº da proposta" dica="O protocolo da seguradora">
              <Input value={form.numero_proposta} onChange={(e) => setForm({ ...form, numero_proposta: e.target.value })} />
            </Campo>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Campo label="Enviada em" obrigatorio>
              <Input type="date" required value={form.data_envio}
                onChange={(e) => setForm({ ...form, data_envio: e.target.value })} />
            </Campo>
            <Campo label="Capital">
              <InputMoeda value={form.capital} onChange={(e) => setForm({ ...form, capital: e.target.value })} />
            </Campo>
            <Campo label="Prêmio mensal" dica="Entra na conta do que está em risco">
              <InputMoeda value={form.premio_mensal} onChange={(e) => setForm({ ...form, premio_mensal: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Situação">
            <Select value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value })}>
              {SITUACOES.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
            </Select>
            <p className="mt-1 text-xs text-slate-400">{situacaoInfo(form.situacao).ajuda}</p>
          </Campo>
          {form.situacao === 'recusada' && (
            <Campo label="Motivo da recusa" dica="É o que orienta a próxima tentativa, em outra seguradora">
              <Textarea rows={2} value={form.motivo_recusa}
                onChange={(e) => setForm({ ...form, motivo_recusa: e.target.value })}
                placeholder="Histórico cardíaco, agravo recusado, sobreposição de capital…" />
            </Campo>
          )}
          <Campo label="Observações">
            <Textarea rows={2} value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Campo>
          {erro && <p className="text-sm text-red-700">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Um cartão por proposta ──────────────────────────────────────────────────
function CartaoProposta({ d, cliente, aoEditar, aoExcluir, aoMudarSituacao, aoGravarExigencias }) {
  const [nova, setNova] = useState({ o_que: '', de_quem: 'cliente' })
  const [abrindo, setAbrindo] = useState(false)
  const avisos = conferirProposta(d)
  const IconeDono = d.comQuem ? ICONE_DONO[d.comQuem] : null

  function adicionar(e) {
    e.preventDefault()
    if (!nova.o_que.trim()) return
    aoGravarExigencias([
      ...(Array.isArray(d.exigencias) ? d.exigencias.map(limpar) : []),
      { o_que: nova.o_que.trim(), de_quem: nova.de_quem, pedida_em: hojeLocal(), resolvida_em: null },
    ])
    setNova({ o_que: '', de_quem: 'cliente' })
    setAbrindo(false)
  }
  // o diagnóstico enriquece cada exigência com campos calculados; o que volta
  // ao banco tem que ser só o que o banco guarda
  const limpar = (e) => ({
    o_que: e.o_que, de_quem: e.de_quem, pedida_em: e.pedida_em, resolvida_em: e.resolvida_em ?? null,
  })

  function alternar(i) {
    const lista = d.exigencias.map(limpar)
    lista[i] = { ...lista[i], resolvida_em: lista[i].resolvida_em ? null : hojeLocal() }
    aoGravarExigencias(lista)
  }
  function remover(i) {
    aoGravarExigencias(d.exigencias.map(limpar).filter((_, j) => j !== i))
  }

  return (
    <Card className={`p-5 ${d.travada ? 'ring-1 ring-red-200' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tom={d.info.tom}>{d.info.rotulo}</Badge>
            <span className="text-sm font-medium text-slate-800">
              {d.seguradoras?.nome ?? 'Seguradora não informada'}
            </span>
            {d.numero_proposta && <span className="font-mono text-xs text-slate-400">nº {d.numero_proposta}</span>}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Enviada em {dataBR(d.data_envio)}
            {d.diasNaSeguradora != null && ` · há ${d.diasNaSeguradora} ${d.diasNaSeguradora === 1 ? 'dia' : 'dias'}`}
            {d.premio_mensal > 0 && ` · ${brl(d.premio_mensal)}/mês`}
            {d.capital > 0 && ` · ${brlCompacto(d.capital)} de capital`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={aoEditar} title="Editar proposta"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><FileSignature size={16} /></button>
          <button onClick={aoExcluir} title="Excluir proposta"
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>
        </div>
      </div>

      {/* A frase que diz o que fazer, com o número de dias dentro dela */}
      <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${TOM_ACAO[d.proximaAcao.tom]}`}>
        {d.travada ? <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          : <Clock3 size={16} className="mt-0.5 shrink-0" />}
        <span className="min-w-0">{d.proximaAcao.texto}</span>
      </div>

      {/* Com quem está a bola — e o atalho para cobrar quem precisa ser cobrado */}
      {d.comQuem && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {IconeDono && <IconeDono size={14} />}
          <span>
            A bola está {d.comQuem === 'cliente' ? 'com o cliente'
              : d.comQuem === 'seguradora' ? 'com a seguradora' : 'com você'}.
          </span>
          {d.comQuem === 'cliente' && whatsapp(cliente?.telefone) && d.maisAntiga && (
            <a target="_blank" rel="noreferrer"
              href={whatsapp(cliente.telefone,
                `Olá ${String(cliente.nome ?? '').split(' ')[0]}! Passando para lembrar de "${d.maisAntiga.o_que}" — `
                + 'é o que falta para a sua apólice ser emitida. Qualquer dúvida me chame. — Natália')}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100">
              <MessageCircle size={13} /> Cobrar pelo WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Pendências */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            O que falta {d.abertas.length > 0 && `(${d.abertas.length})`}
          </p>
          <button onClick={() => setAbrindo((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
            <Plus size={13} /> Pendência
          </button>
        </div>

        {abrindo && (
          <form onSubmit={adicionar} className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
            <div className="min-w-[12rem] flex-1">
              <Campo label="O que falta">
                <Input autoFocus value={nova.o_que} onChange={(e) => setNova({ ...nova, o_que: e.target.value })}
                  placeholder="Exame de sangue, DPS assinada, parecer médico…" />
              </Campo>
            </div>
            <Campo label="Depende de quem">
              <Select value={nova.de_quem} onChange={(e) => setNova({ ...nova, de_quem: e.target.value })}>
                {DE_QUEM.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
              </Select>
            </Campo>
            <Button type="submit">Adicionar</Button>
          </form>
        )}

        {d.exigencias.length === 0 && !abrindo && (
          <p className="mt-2 text-sm text-slate-400">Nenhuma pendência registrada.</p>
        )}

        <ul className="mt-2 divide-y divide-slate-100">
          {d.exigencias.map((e, i) => {
            const Dono = ICONE_DONO[e.de_quem] ?? User
            return (
              <li key={`${e.o_que}-${i}`} className="flex items-center gap-3 py-2">
                <button onClick={() => alternar(i)}
                  title={e.aberta ? 'Marcar como resolvida' : 'Reabrir'}
                  aria-label={e.aberta ? `Marcar "${e.o_que}" como resolvida` : `Reabrir "${e.o_que}"`}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    e.aberta ? 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50'
                      : 'border-emerald-500 bg-emerald-500 text-white'}`}>
                  {!e.aberta && <Check size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${e.aberta ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                    {e.o_que}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Dono size={12} />
                    {DE_QUEM.find((x) => x.id === e.de_quem)?.rotulo ?? 'Do cliente'}
                    {e.aberta && e.diasParada != null && (
                      <span className={e.atrasada ? 'font-medium text-red-700' : ''}>
                        · parada há {e.diasParada} {e.diasParada === 1 ? 'dia' : 'dias'}
                        {e.atrasada && ` (prazo ${e.limite})`}
                      </span>
                    )}
                    {!e.aberta && e.resolvida_em && ` · resolvida em ${dataBR(e.resolvida_em)}`}
                  </p>
                </div>
                <button onClick={() => remover(i)} aria-label={`Remover "${e.o_que}"`}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-700">
                  <Trash2 size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Mudar de situação sem abrir o formulário: é o gesto mais frequente */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <span className="mr-1 text-xs text-slate-400">Mudar para:</span>
        {SITUACOES.filter((s) => s.id !== d.situacao).map((s) => (
          <button key={s.id} onClick={() => aoMudarSituacao(s.id)} title={s.ajuda}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50">
            {s.rotulo}
          </button>
        ))}
      </div>

      {avisos.length > 0 && (
        <ul className="mt-3 space-y-1">
          {avisos.map((a, i) => (
            <li key={i} className={`text-xs ${a.nivel === 'alerta' ? 'text-amber-700' : 'text-slate-400'}`}>
              {a.nivel === 'alerta' ? '⚠ ' : '· '}{a.texto}
            </li>
          ))}
        </ul>
      )}

      {d.observacoes && <p className="mt-3 whitespace-pre-line text-sm text-slate-500">{d.observacoes}</p>}
    </Card>
  )
}
