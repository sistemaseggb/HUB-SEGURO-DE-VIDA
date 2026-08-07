import { useState } from 'react'
import { brl, brlCompacto } from '../lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// Raio-X do patrimônio — a figura que sustenta a conversa de sucessão.
//
// A pergunta que o desenho responde não é "quanto você tem", é "quanto disso a
// sua família consegue usar na segunda-feira depois". Por isso a cor NÃO
// identifica a classe do bem (seriam 6 matizes, e 6 matizes não sobrevivem a
// um teste de daltonismo): a cor codifica o único corte que decide o assunto —
//
//   azul  = passa por inventário (fica travado até o ITCMD ser pago)
//   verde = fora do inventário (previdência e seguro vão direto ao beneficiário)
//
// A identidade de cada classe vem do rótulo direto na lista abaixo da barra,
// nunca da cor sozinha. Dentro do bloco azul os degraus são uma rampa
// sequencial (mais escuro = maior), separados por 2px de respiro.
//
// Par azul/verde validado no validador da skill dataviz: ΔE 18,5 em visão
// normal e 17,7 em deuteranopia, croma e contraste ≥ 3:1 sobre superfície clara.
// ─────────────────────────────────────────────────────────────────────────────

const RAMPA_INVENTARIO = ['#0b4f75', '#1272a8', '#3f9bd0', '#6aaed6', '#9ccbe6']
const COR_LIVRE = '#0e9f6e'
const TINTA_CLARA = new Set(['#6aaed6', '#9ccbe6'])

export default function MapaPatrimonio({ estudo, titulo = true, compacto = false }) {
  const [hover, setHover] = useState(null)

  // Sem a composição por classe não há o que desenhar: as fatias somariam
  // menos que o patrimônio e todos os percentuais sairiam errados.
  if (!estudo || !estudo.detalhado || estudo.patrimonioBruto <= 0) return null

  // Ordena: o que passa por inventário primeiro (do maior para o menor),
  // depois o que fica de fora. A leitura vai do travado para o livre.
  const comValor = estudo.classes.filter((c) => c.valor > 0)
  const travadas = comValor.filter((c) => c.inventario).sort((a, b) => b.valor - a.valor)
  const livres = comValor.filter((c) => !c.inventario).sort((a, b) => b.valor - a.valor)
  const segmentos = [
    ...travadas.map((c, i) => ({ ...c, cor: RAMPA_INVENTARIO[Math.min(i, RAMPA_INVENTARIO.length - 1)] })),
    ...livres.map((c) => ({ ...c, cor: COR_LIVRE })),
  ]
  if (segmentos.length === 0) return null

  const total = estudo.patrimonioBruto
  const pct = (v) => (v / total) * 100
  const pctTravado = Math.round(pct(estudo.bensInventariaveis))

  return (
    <div>
      {titulo && (
        <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: RAMPA_INVENTARIO[1] }} />
            Passa por inventário — travado até o imposto ser pago
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: COR_LIVRE }} />
            Fora do inventário — vai direto ao beneficiário
          </span>
        </div>
      )}

      {/* A barra: cada classe é um degrau, com 2px de respiro entre elas */}
      <div className="relative">
        <div className={`flex w-full gap-0.5 overflow-hidden ${compacto ? 'h-9' : 'h-12'}`}>
          {segmentos.map((s) => (
            <div key={s.id}
              onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
              className="relative flex min-w-0 items-center justify-center rounded transition-opacity first:rounded-l-lg last:rounded-r-lg"
              style={{
                width: `${pct(s.valor)}%`,
                background: s.cor,
                opacity: hover && hover !== s.id ? 0.55 : 1,
              }}
              title={`${s.rotulo}: ${brl(s.valor)} (${Math.round(pct(s.valor))}%)`}>
              {pct(s.valor) >= 14 && (
                <span className={`truncate px-1.5 text-[11px] font-semibold tabular ${
                  TINTA_CLARA.has(s.cor) ? 'text-slate-800' : 'text-white'}`}>
                  {Math.round(pct(s.valor))}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Régua: onde termina o que fica travado */}
        {livres.length > 0 && travadas.length > 0 && (
          <div className="mt-1">
            {/* A régua é só o traço, na proporção exata do que trava e do que
                fica livre. Os rótulos vão numa linha própria, nas pontas: se
                ficassem dentro dos blocos, um bloco estreito com texto sem
                quebra empurraria a rolagem horizontal da página no celular. */}
            <div className="flex w-full gap-0.5">
              <div style={{ width: `${pct(estudo.bensInventariaveis)}%` }}
                className="min-w-0 border-t border-slate-200" />
              <div style={{ width: `${pct(total - estudo.bensInventariaveis)}%` }}
                className="min-w-0 border-t border-emerald-200" />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-wide">
              <span className="min-w-0 truncate text-slate-400">
                travado · {brlCompacto(estudo.bensInventariaveis)}
              </span>
              <span className="min-w-0 truncate text-emerald-600">
                livre · {brlCompacto(total - estudo.bensInventariaveis)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rótulos diretos: a identidade de cada classe não depende da cor */}
      <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {segmentos.map((s) => (
          <div key={s.id}
            onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
            className={`flex items-baseline gap-2 rounded px-1 py-0.5 text-sm transition-colors ${
              hover === s.id ? 'bg-slate-50' : ''}`}>
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.cor }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{s.rotulo}</span>
            <span className="shrink-0 font-medium tabular text-slate-900">{brlCompacto(s.valor)}</span>
            <span className="w-9 shrink-0 text-right text-xs tabular text-slate-400">{Math.round(pct(s.valor))}%</span>
          </div>
        ))}
      </div>

      {!compacto && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
          <strong className="text-slate-800">{pctTravado}% do patrimônio</strong> fica travado até
          o inventário terminar
          {estudo.pctIliquido != null && (
            <> — e <strong className="text-slate-800">{estudo.pctIliquido}%</strong> só vira dinheiro
              com a venda de algum bem</>
          )}.
          {estudo.previdencia > 0 && (
            <> A previdência de <strong className="text-emerald-700">{brlCompacto(estudo.previdencia)}</strong> é
              a única parte que a família recebe em dias, sem inventário.</>
          )}
        </p>
      )}

      {/* Versão em texto para leitores de tela. O sr-only vai no <div>, não na
          <table>: tabela cresce até o conteúdo mesmo com width:1px e acabava
          empurrando a rolagem horizontal da página no celular. */}
      <div className="sr-only">
      <table>
        <caption>Composição do patrimônio por classe</caption>
        <thead><tr><th>Classe</th><th>Valor</th><th>Participação</th><th>Inventário</th></tr></thead>
        <tbody>
          {segmentos.map((s) => (
            <tr key={s.id}>
              <td>{s.rotulo}</td><td>{brl(s.valor)}</td><td>{Math.round(pct(s.valor))}%</td>
              <td>{s.inventario ? 'passa por inventário' : 'fora do inventário'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
