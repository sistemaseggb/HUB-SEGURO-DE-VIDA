import { useState } from 'react'
import { MessageSquareWarning, ChevronDown, Ban, HelpCircle, Quote } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// AS OBJEÇÕES — o que ELE vai dizer, e o que responder com os números dele.
//
// Duas decisões de desenho valem o componente:
//
// 1. AS ESPERADAS VÊM ABERTAS, o resto vem fechado. A consultora costuma ter
//    cinco minutos antes da reunião, não meia hora. Se tudo estivesse aberto,
//    ela leria a primeira e fecharia a tela; se tudo estivesse fechado, ela não
//    saberia por onde começar. O estudo sabe quais vão aparecer — a tela abre
//    justamente essas.
//
// 2. O "NÃO DIGA" TEM O MESMO PESO VISUAL DO ARGUMENTO. É a parte que nenhum
//    material de treinamento escreve e a que mais decide a conversa: a resposta
//    errada para "vou pensar" não é uma resposta fraca, é uma que fecha a porta.
// ─────────────────────────────────────────────────────────────────────────────

const CORES = {
  certa: { faixa: 'border-laranja-300 bg-laranja-50/50', etiqueta: 'bg-laranja-600 text-white' },
  provavel: { faixa: 'border-amber-200 bg-amber-50/40', etiqueta: 'bg-amber-500 text-white' },
  possivel: { faixa: 'border-slate-200 bg-white', etiqueta: 'bg-slate-200 text-slate-600' },
  improvavel: { faixa: 'border-slate-200 bg-white', etiqueta: 'bg-slate-100 text-slate-400' },
}

function Objecao({ o, abertaInicial }) {
  const [aberta, setAberta] = useState(abertaInicial)
  const cor = CORES[o.nivel] ?? CORES.possivel

  return (
    <div className={`rounded-xl border ${cor.faixa}`}>
      <button type="button" onClick={() => setAberta((v) => !v)}
        className="flex w-full items-start gap-2.5 p-3.5 text-left">
        <ChevronDown size={15}
          className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${aberta ? 'rotate-180' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">“{o.rotulo}”</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cor.etiqueta}`}>
              {o.nivelRotulo}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-slate-400">Como costuma soar: {o.comoSoa}</span>
        </span>
      </button>

      {aberta && (
        <div className="space-y-3 border-t border-slate-200/60 px-3.5 pb-3.5 pt-3">
          <ul className="space-y-1.5">
            {o.argumentos.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {a}
              </li>
            ))}
          </ul>

          <p className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50/70 p-2.5 text-xs leading-relaxed text-red-900">
            <Ban size={13} className="mt-0.5 shrink-0 text-red-500" />
            <span><strong>Não diga:</strong> {o.naoDiga}</span>
          </p>

          <p className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/60 p-2.5 text-sm leading-relaxed text-brand-900">
            <HelpCircle size={14} className="mt-0.5 shrink-0 text-brand-600" />
            <span><strong>Devolva com esta pergunta:</strong> “{o.pergunta}”</span>
          </p>
        </div>
      )}
    </div>
  )
}

export default function PainelObjecoes({ respostas }) {
  const [verTodas, setVerTodas] = useState(false)
  if (!respostas?.lista?.length) return null

  const esperadas = respostas.esperadas
  const mostradas = verTodas ? respostas.lista : (esperadas.length > 0 ? esperadas : respostas.lista.slice(0, 3))

  return (
    <div className="mb-5 rounded-2xl border border-slate-200/70 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <MessageSquareWarning size={15} className="text-laranja-600" />
            O que ele vai dizer — e o que responder
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            As objeções que ESTE estudo torna prováveis, cada uma respondida com os números dele.
            Objeção não se vence com retórica: se vence com uma conta que o cliente consegue conferir.
          </p>
        </div>
        {esperadas.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-laranja-200 bg-laranja-50 px-2.5 py-1 text-xs font-semibold text-laranja-800">
            <Quote size={11} /> {esperadas.length} esperada(s) nesta reunião
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {mostradas.map((o) => (
          <Objecao key={o.id} o={o} abertaInicial={o.nivel === 'certa'} />
        ))}
      </div>

      {respostas.lista.length > mostradas.length && (
        <button type="button" onClick={() => setVerTodas(true)}
          className="mt-3 text-xs font-semibold text-laranja-700 hover:text-laranja-800">
          Ver as {respostas.lista.length - mostradas.length} objeções restantes
        </button>
      )}
      {verTodas && (
        <button type="button" onClick={() => setVerTodas(false)}
          className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-700">
          Mostrar só as esperadas
        </button>
      )}
    </div>
  )
}
