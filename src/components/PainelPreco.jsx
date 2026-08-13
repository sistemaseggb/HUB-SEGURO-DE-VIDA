import { useState } from 'react'
import {
  Coins, Layers, Scale, AlertTriangle, Info, ChevronDown, Check, Minus,
} from 'lucide-react'
import { brl, brlCompacto } from '../lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// O PAINEL DO PREÇO — quanto custa cada pedaço, e quais planos cabem.
//
// Três blocos, na ordem em que a consultora precisa deles dentro da reunião:
//
//   1. A FAIXA — a resposta imediata a "quanto custa?", que antes só existia
//      dias depois, quando a cotação voltava. Com a fatia de cada cobertura ao
//      lado, porque a segunda pergunta é sempre "e se tirar essa daqui?".
//
//   2. OS NÍVEIS — a escada que muda a pergunta de "quer ou não quer" para
//      "qual dos três". Cada degrau mostra também o que NÃO tem: um comparativo
//      que só lista o que cada coluna inclui é folheto, não é decisão.
//
//   3. O QUE CABE — quando o prêmio passa da sobra do cliente, o corte feito
//      pela ordem do risco em vez de pelo que é mais fácil de tirar.
//
// A etiqueta de ESTIMATIVA está em todo bloco, e não é decoração jurídica: o
// número aqui dimensiona a conversa e a cotação manda. Quando a cotação chega,
// é ela que aparece em todo o resto do sistema.
// ─────────────────────────────────────────────────────────────────────────────

function Etiqueta() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <Info size={11} /> estimativa, não cotação
    </span>
  )
}

function BarraFatia({ pct, destaque }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${destaque ? 'bg-laranja-500' : 'bg-brand-500'}`}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ─── 1. A faixa e o custo de cada cobertura ──────────────────────────────────
function Faixa({ premio, conferencia }) {
  const [aberto, setAberto] = useState(true)
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Coins size={15} className="text-laranja-600" /> Quanto deve custar
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Estimado pela idade ({premio.idade} anos{premio.fumante ? ', fumante' : ''}) e pelo
            desenho da apólice. A cotação da seguradora manda — isto serve para a conversa
            não parar em “vou te mandar depois”.
          </p>
        </div>
        <Etiqueta />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-xs text-slate-400">Faixa mensal</p>
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {brl(premio.min)} <span className="text-base font-medium text-slate-400">a</span> {brl(premio.max)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Centro da faixa</p>
          <p className="text-lg font-semibold text-slate-700">{brl(premio.mensal)}/mês</p>
        </div>
        {premio.pctRenda != null && (
          <div>
            <p className="text-xs text-slate-400">Peso na renda</p>
            <p className={`text-lg font-semibold ${premio.pctRenda > 10 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {String(premio.pctRenda).replace('.', ',')}%
            </p>
          </div>
        )}
        {premio.cabeNaSobra != null && (
          <div>
            <p className="text-xs text-slate-400">Sobra do cliente</p>
            <p className={`text-lg font-semibold ${premio.cabeNaSobra ? 'text-emerald-700' : 'text-red-700'}`}>
              {premio.cabeNaSobra ? 'cabe' : 'não cabe'}
            </p>
          </div>
        )}
      </div>

      {conferencia && conferencia.situacao !== 'dentro' && (
        <p className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-xs ${
          conferencia.situacao === 'acima'
            ? 'border-amber-100 bg-amber-50 text-amber-800'
            : 'border-red-100 bg-red-50 text-red-800'}`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{conferencia.texto}</span>
        </p>
      )}
      {conferencia && conferencia.situacao === 'dentro' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
          <Check size={13} /> {conferencia.texto}
        </p>
      )}

      {premio.avisos.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-3">
          {premio.avisos.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setAberto((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-laranja-700 hover:text-laranja-800">
        <ChevronDown size={13} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
        {aberto ? 'Esconder' : 'Ver'} o custo de cada cobertura
      </button>

      {aberto && (
        <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
          {premio.itens.map((i, k) => (
            <div key={i.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-slate-700">{i.rotulo}</span>
                <span className="shrink-0 text-xs text-slate-400">{brlCompacto(i.valor)}</span>
                {i.foraDaIdadeDeEmissao && (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                    fora da idade
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-slate-800">{brl(i.mensal)}</span>
                <span className="ml-1.5 text-xs text-slate-400">
                  {String(i.pctDoTotal).replace('.', ',')}%
                </span>
              </div>
              <div className="col-span-2">
                <BarraFatia pct={i.pctDoTotal} destaque={k === 0} />
              </div>
            </div>
          ))}
          <p className="pt-1 text-xs text-slate-400">
            A cobertura mais cara costuma ser a primeira a ser cortada quando o preço trava a
            conversa. Com a fatia à vista, o corte vira decisão em vez de chute.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── 2. Os três níveis ───────────────────────────────────────────────────────
function Niveis({ niveis }) {
  const [descobertoAberto, setDescobertoAberto] = useState(null)
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Layers size={15} className="text-laranja-600" /> Três formas de fazer isso
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Com uma opção só, o cliente escolhe entre sim e não — e o preço vira o único assunto.
            Com três, ele escolhe entre menos e mais, que é uma decisão que ele toma na hora.
          </p>
        </div>
        <Etiqueta />
      </div>

      <div className={`mt-4 grid gap-3 ${niveis.niveis.length === 2 ? 'sm:grid-cols-2' : 'lg:grid-cols-3'}`}>
        {niveis.niveis.map((n) => {
          const defendido = n.id === niveis.recomendadoId
          return (
            <div key={n.id}
              className={`rounded-xl border p-3.5 ${defendido
                ? 'border-laranja-300 bg-laranja-50/40 ring-1 ring-laranja-200'
                : 'border-slate-200/70 bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-bold ${defendido ? 'text-laranja-800' : 'text-slate-800'}`}>
                  {n.rotulo}
                </p>
                {defendido && (
                  <span className="rounded-full bg-laranja-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    o que eu recomendo
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{n.tese}</p>

              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                {brl(n.mensal)}<span className="text-sm font-medium text-slate-400">/mês</span>
              </p>
              <p className="text-xs text-slate-400">
                {brlCompacto(n.capital)} de capital · {n.itens.length} cobertura(s)
              </p>

              <ul className="mt-3 space-y-1 border-t border-slate-200/70 pt-2.5">
                {n.itens.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                      <Check size={12} className="shrink-0 text-emerald-600" />
                      <span className="truncate">{i.rotulo}</span>
                    </span>
                    <span className="shrink-0 text-slate-400">{brlCompacto(i.valor)}</span>
                  </li>
                ))}
              </ul>

              {n.descoberto.length > 0 && (
                <>
                  <button type="button"
                    onClick={() => setDescobertoAberto((v) => (v === n.id ? null : n.id))}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                    <ChevronDown size={12}
                      className={`transition-transform ${descobertoAberto === n.id ? 'rotate-180' : ''}`} />
                    O que fica de fora ({n.descoberto.length})
                  </button>
                  {descobertoAberto === n.id && (
                    <ul className="mt-1.5 space-y-1.5">
                      {n.descoberto.map((x) => (
                        <li key={x.id} className="flex items-start gap-1.5 text-xs text-slate-500">
                          <Minus size={12} className="mt-0.5 shrink-0 text-red-400" />
                          <span><strong className="text-slate-600">{x.rotulo}</strong>
                            {x.risco ? ` — ${x.risco}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 3. O plano que cabe ─────────────────────────────────────────────────────
function Cabe({ cabe, onUsarTeto }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Scale size={15} className="text-laranja-600" /> O plano que cabe em {brl(cabe.teto)}/mês
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Montado na ordem do risco deste cliente. Cortar no chute derruba primeiro a invalidez —
            que é a mais provável de todas e a que ele entende menos.
          </p>
        </div>
        <Etiqueta />
      </div>

      {cabe.vazio ? (
        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800">
          Nem a cobertura mais barata do estudo cabe em {brl(cabe.teto)}/mês. Antes de reduzir mais,
          vale tratar o orçamento com o cliente — um plano que não cabe cancela em poucos meses e
          devolve a comissão.
        </p>
      ) : cabe.completo ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
          <Check size={14} /> O estudo inteiro cabe nesse teto — não há corte a fazer.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-slate-400">Custa</p>
              <p className="text-xl font-bold text-slate-900">{brl(cabe.mensal)}/mês</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Entrega</p>
              <p className="text-xl font-bold text-emerald-700">{brlCompacto(cabe.capital)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Sobra do teto</p>
              <p className="text-sm font-semibold text-slate-600">{brl(cabe.sobra)}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">Entra</p>
              <ul className="space-y-1">
                {cabe.dentro.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                      <Check size={12} className="shrink-0 text-emerald-600" />
                      <span className="truncate">{i.rotulo}</span>
                    </span>
                    <span className="shrink-0 text-slate-400">{brl(i.mensal)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fica de fora
              </p>
              <ul className="space-y-1.5">
                {cabe.fora.map((i) => (
                  <li key={i.id} className="text-xs text-slate-500">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Minus size={12} className="shrink-0 text-red-400" />
                        <span className="truncate font-medium text-slate-600">{i.rotulo}</span>
                      </span>
                      <span className="shrink-0">+{brl(i.faltam)} para entrar</span>
                    </span>
                    {i.risco && <span className="ml-[18px] block text-slate-400">{i.risco}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {onUsarTeto && (
        <p className="mt-3 text-xs text-slate-400">
          O teto vem da sobra mensal do cliente (renda menos custo de vida). Ajuste renda ou custo
          de vida no formulário para simular outro orçamento.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function PainelPreco({ premio, niveis, cabe, conferencia }) {
  if (!premio && !niveis && !cabe) return null
  return (
    <div className="mb-5 space-y-3">
      {premio && <Faixa premio={premio} conferencia={conferencia} />}
      {niveis && <Niveis niveis={niveis} />}
      {cabe && <Cabe cabe={cabe} onUsarTeto />}
    </div>
  )
}
