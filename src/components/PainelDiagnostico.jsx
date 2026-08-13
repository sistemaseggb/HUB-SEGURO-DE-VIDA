import { useState } from 'react'
import {
  Sparkles, AlertTriangle, HelpCircle, Wand2, ChevronDown, MessageSquareQuote,
  CheckCircle2, Target, ArrowRight,
} from 'lucide-react'
import { Card, Button, Badge } from './ui'

// ─────────────────────────────────────────────────────────────────────────────
// O PAINEL DO DIAGNÓSTICO — a inteligência do estudo, em três blocos.
//
// A regra de desenho: NADA É APLICADO SOZINHO. O sistema pode estar errado
// sobre esse cliente específico — a consultora esteve na reunião e o sistema
// não. Cada palpite mostra o número, a conta que o gerou e um botão; quem
// decide é ela.
//
// A ordem dos blocos é a ordem em que ela precisa deles:
//   1. o que FALTA perguntar   (antes de apresentar);
//   2. o que o estudo RECOMENDA (com o porquê e a frase para dizer);
//   3. o veredito              (pronto para apresentar, ou não).
// ─────────────────────────────────────────────────────────────────────────────

const CORES_TIPO = {
  bloqueia: { faixa: 'border-red-200 bg-red-50/60', ponto: 'bg-red-500', rotulo: 'Impede a apresentação', tom: 'red' },
  corrige: { faixa: 'border-amber-200 bg-amber-50/50', ponto: 'bg-amber-500', rotulo: 'Corrigir', tom: 'yellow' },
  reforca: { faixa: 'border-slate-200 bg-white', ponto: 'bg-laranja-500', rotulo: 'Reforça a venda', tom: 'blue' },
  refina: { faixa: 'border-slate-200 bg-white', ponto: 'bg-slate-300', rotulo: 'Refinamento', tom: 'slate' },
}

function Recomendacao({ r, onAplicar }) {
  const [aberto, setAberto] = useState(false)
  const cor = CORES_TIPO[r.tipo] ?? CORES_TIPO.refina
  const podeAplicar = r.campo && Number.isFinite(r.valor) && r.valor > 0

  return (
    <div className={`rounded-xl border p-3.5 ${cor.faixa}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cor.ponto}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-800">{r.titulo}</p>
            <Badge tom={cor.tom}>{cor.rotulo}</Badge>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{r.porque}</p>

          {r.dizerAssim && (
            <>
              <button onClick={() => setAberto((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-laranja-700 hover:text-laranja-800">
                <MessageSquareQuote size={13} />
                Como dizer isso na reunião
                <ChevronDown size={13} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
              </button>
              {aberto && (
                <p className="mt-1.5 rounded-lg border-l-[3px] border-laranja-300 bg-white/80 px-3 py-2 text-sm italic text-slate-600">
                  “{r.dizerAssim}”
                </p>
              )}
            </>
          )}

          {podeAplicar && (
            <div className="mt-3">
              <Button variant="secondary" onClick={() => onAplicar(r)}
                className="px-3 py-1.5 text-xs">
                <Wand2 size={13} />
                Aplicar {Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PainelDiagnostico({ diagnostico, onAplicar, onIrParaCampo }) {
  const [verTudo, setVerTudo] = useState(false)
  if (!diagnostico) return null

  const { perfil, resumo, recomendacoes, pendencias, pronto } = diagnostico
  const visiveis = verTudo ? recomendacoes : recomendacoes.slice(0, 4)

  return (
    <Card className="mb-6 overflow-hidden">
      {/* Cabeçalho: quem é este cliente e como o estudo está lendo o caso */}
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-xl bg-laranja-50 p-2 text-laranja-600">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">
                Leitura do estudo
                {perfil && <span className="ml-2 font-normal text-slate-400">· {perfil.rotulo}</span>}
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{resumo}</p>
            </div>
          </div>
          <span className="shrink-0">
            {pronto
              ? <Badge tom="green"><CheckCircle2 size={12} /> Pronto para apresentar</Badge>
              : <Badge tom="yellow"><AlertTriangle size={12} /> Revisar antes de apresentar</Badge>}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* ── O que ainda falta perguntar ── */}
        {pendencias.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <HelpCircle size={15} className="text-slate-400" />
              Perguntas que ainda faltam
              <span className="text-xs font-normal text-slate-400">({pendencias.length})</span>
            </h3>
            <ul className="space-y-1.5">
              {pendencias.map((p) => (
                <li key={p.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    p.critico ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-slate-50/60'
                  }`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${p.critico ? 'bg-amber-500' : 'bg-slate-300'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-600">{p.texto}</p>
                      {p.perguntaAoCliente && (
                        <p className="mt-1 text-slate-500 italic">Pergunte: “{p.perguntaAoCliente}”</p>
                      )}
                    </div>
                    {p.campo && onIrParaCampo && (
                      <button onClick={() => onIrParaCampo(p.campo)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-laranja-700 hover:bg-laranja-50"
                        title="Ir para o campo no formulário">
                        preencher <ArrowRight size={11} className="inline -mt-px" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── O que o estudo recomenda ── */}
        {recomendacoes.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Target size={15} className="text-slate-400" />
              O que este estudo pede
              <span className="text-xs font-normal text-slate-400">
                (em ordem de peso: gravidade, probabilidade e dinheiro em jogo)
              </span>
            </h3>
            <div className="space-y-2">
              {visiveis.map((r) => (
                <Recomendacao key={r.id} r={r} onAplicar={onAplicar} />
              ))}
            </div>
            {recomendacoes.length > 4 && (
              <button onClick={() => setVerTudo((v) => !v)}
                className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800">
                {verTudo
                  ? 'Mostrar menos'
                  : `Ver as outras ${recomendacoes.length - 4} recomendações`}
              </button>
            )}
          </section>
        )}

        <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
          Nada aqui é aplicado sozinho: cada número entra no estudo só quando você
          clicar. O sistema não esteve na reunião — você esteve.
        </p>
      </div>
    </Card>
  )
}
