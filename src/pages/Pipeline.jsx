import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, GripVertical } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS } from '../lib/constants'
import { PageHeader, Badge, Spinner, Modal, Campo, Textarea, Button } from '../components/ui'

// Kanban do funil: arraste o card para a nova etapa — o banco cuida do resto
// (contador de dias, histórico). Mover para "Perdido" pede o motivo.
export default function Pipeline() {
  const [cards, setCards] = useState(null)
  const [config, setConfig] = useState({ dias_alerta_amarelo: 5, dias_alerta_vermelho: 10 })
  const [arrastando, setArrastando] = useState(null)
  const [colunaAlvo, setColunaAlvo] = useState(null)
  const [modalPerda, setModalPerda] = useState(null) // card sendo perdido
  const [motivoPerda, setMotivoPerda] = useState('')

  async function carregar() {
    const [p, c] = await Promise.all([
      supabase.from('vw_pipeline').select('*').order('data_entrada_etapa'),
      supabase.from('configuracoes').select('dias_alerta_amarelo, dias_alerta_vermelho').single(),
    ])
    setCards(p.data ?? [])
    if (c.data) setConfig(c.data)
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

      <div className="flex gap-3 overflow-x-auto pb-4">
        {ETAPAS.map((etapa) => {
          const daEtapa = cards.filter((c) => c.status_funil === etapa.id)
          return (
            <div
              key={etapa.id}
              onDragOver={(e) => { e.preventDefault(); setColunaAlvo(etapa.id) }}
              onDragLeave={() => setColunaAlvo(null)}
              onDrop={() => soltar(etapa.id)}
              className={`flex w-64 shrink-0 flex-col rounded-xl border p-2 transition-colors ${
                colunaAlvo === etapa.id ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-100/60'
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: etapa.cor }} />
                  {etapa.label}
                </span>
                <span className="text-xs font-medium text-slate-400">{daEtapa.length}</span>
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {daEtapa.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setArrastando(card)}
                    onDragEnd={() => setArrastando(null)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300 active:cursor-grabbing"
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
                    <div className="mt-2">
                      <Badge tom={tomDias(card.dias_na_etapa, card.status_funil)}>
                        <Clock size={11} />
                        {card.dias_na_etapa === 0 ? 'hoje' : `${card.dias_na_etapa} dia(s) parado`}
                      </Badge>
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
