import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, GripVertical, MessageCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS } from '../lib/constants'
import { brlCompacto, whatsapp } from '../lib/format'
import { PageHeader, Badge, Spinner, Modal, Campo, Textarea, Button, ComoFunciona } from '../components/ui'

// Kanban do funil: arraste o card para a nova etapa — o banco cuida do resto
// (contador de dias, histórico). Mover para "Perdido" pede o motivo.
export default function Pipeline() {
  const [cards, setCards] = useState(null)
  const [config, setConfig] = useState({ dias_alerta_amarelo: 5, dias_alerta_vermelho: 10 })
  const [planos, setPlanos] = useState(new Map()) // id_cliente → {capital, premio}
  const [arrastando, setArrastando] = useState(null)
  const [colunaAlvo, setColunaAlvo] = useState(null)
  const [modalPerda, setModalPerda] = useState(null) // card sendo perdido
  const [motivoPerda, setMotivoPerda] = useState('')

  async function carregar() {
    const [p, c, pl] = await Promise.all([
      supabase.from('vw_pipeline').select('*').order('data_entrada_etapa'),
      supabase.from('configuracoes').select('dias_alerta_amarelo, dias_alerta_vermelho').single(),
      // '*' para funcionar mesmo sem a migração 015 (premio_estimado)
      supabase.from('planejamentos').select('*'),
    ])
    setCards(p.data ?? [])
    if (c.data) setConfig(c.data)
    setPlanos(new Map((pl.data ?? []).map((x) => [x.id_cliente, {
      capital: Number(x.capital_sugerido || 0),
      premio: Number(x.premio_estimado || 0),
    }])))
  }

  useEffect(() => { carregar() }, [])

  async function mover(card, etapa, motivo = null) {
    if (card.status_funil === etapa) return
    const patch = { status_funil: etapa }
    if (motivo) patch.motivo_perda = motivo
    // Atualização otimista: o card muda de coluna na hora
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status_funil: etapa, dias_na_etapa: 0 } : c)))
    const { error } = await supabase.from('clientes').update(patch).eq('id', card.id)
    if (error) carregar()
  }

  function soltar(etapa) {
    setColunaAlvo(null)
    if (!arrastando) return
    if (etapa === 'perdido') {
      setModalPerda(arrastando)
      setMotivoPerda('')
    } else {
      mover(arrastando, etapa)
    }
    setArrastando(null)
  }

  if (!cards) return <Spinner />

  const tomDias = (dias, etapa) => {
    if (etapa === 'fechado' || etapa === 'perdido') return 'slate'
    if (dias >= config.dias_alerta_vermelho) return 'red'
    if (dias >= config.dias_alerta_amarelo) return 'yellow'
    return 'slate'
  }

  return (
    <div>
      <PageHeader titulo="Pipeline de Vendas"
        subtitulo="Arraste os cards entre as etapas. O tempo parado é monitorado automaticamente." />

      <ComoFunciona id="pipeline">
        Cada cliente é um <strong>card</strong> que caminha da esquerda (novo lead) para a direita (fechado).
        Arraste com o mouse para mudar de etapa — o sistema registra o histórico e conta os dias parados sozinho.
        Cards que ficam tempo demais numa etapa ficam <span className="text-amber-700">amarelos</span> e depois
        <span className="text-red-700"> vermelhos</span>, para você não esquecer ninguém.
      </ComoFunciona>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {ETAPAS.map((etapa) => {
          const daEtapa = cards.filter((c) => c.status_funil === etapa.id)
          // potencial da coluna: capital sugerido dos estudos já feitos
          const potencial = daEtapa.reduce((s, c) => s + (planos.get(c.id)?.capital ?? 0), 0)
          return (
            <div
              key={etapa.id}
              onDragOver={(e) => { e.preventDefault(); setColunaAlvo(etapa.id) }}
              onDragLeave={() => setColunaAlvo(null)}
              onDrop={() => soltar(etapa.id)}
              className={`flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border transition-colors ${
                colunaAlvo === etapa.id ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200/70 bg-slate-100/50'
              }`}
            >
              <div className="h-1" style={{ background: etapa.cor }} />
              <div className="flex items-center justify-between px-3 pb-0.5 pt-2.5">
                <span className="text-sm font-semibold text-slate-700">{etapa.label}</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{daEtapa.length}</span>
              </div>
              <p className="mb-1 px-3 pb-1 text-[11px] text-slate-400">
                {potencial > 0 && !['fechado', 'perdido'].includes(etapa.id)
                  ? <>capital em estudo: <strong className="tabular text-slate-500">{brlCompacto(potencial)}</strong></>
                  : ' '}
              </p>

              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {daEtapa.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setArrastando(card)}
                    onDragEnd={() => setArrastando(null)}
                    className="cursor-grab rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <Link to={`/clientes/${card.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-700 hover:underline">
                        {card.nome}
                      </Link>
                      <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300" />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      Assessor: {card.nome_assessor}
                    </p>
                    {card.perfil_necessidade && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.perfil_necessidade}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tom={tomDias(card.dias_na_etapa, card.status_funil)}>
                        <Clock size={11} />
                        {card.dias_na_etapa === 0 ? 'hoje' : `${card.dias_na_etapa} dia(s) parado`}
                      </Badge>
                      {(planos.get(card.id)?.capital ?? 0) > 0 && (
                        <Badge tom="blue">
                          <ShieldCheck size={11} /> {brlCompacto(planos.get(card.id).capital)}
                        </Badge>
                      )}
                      {whatsapp(card.telefone) && (
                        <a href={whatsapp(card.telefone)} target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()} draggable={false}
                          className="ml-auto rounded p-1 text-emerald-700 hover:bg-emerald-50" title="WhatsApp">
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Modal aberto={!!modalPerda} titulo="Marcar como perdido" onFechar={() => setModalPerda(null)}>
        <p className="mb-3 text-sm text-slate-600">
          Registrar o motivo ajuda a entender onde o funil perde clientes.
        </p>
        <Campo label={`Por que ${modalPerda?.nome ?? ''} não fechou?`} obrigatorio>
          <Textarea value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)} autoFocus
            placeholder="Ex.: achou o prêmio alto, vai decidir ano que vem, fechou com concorrente..." />
        </Campo>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalPerda(null)}>Cancelar</Button>
          <Button variant="danger" disabled={!motivoPerda.trim()}
            onClick={() => { mover(modalPerda, 'perdido', motivoPerda.trim()); setModalPerda(null) }}>
            Confirmar perda
          </Button>
        </div>
      </Modal>
    </div>
  )
}
