import { useMemo, useState } from 'react'
import { brl, brlCompacto } from '../lib/format'
import { IDADE_INDEPENDENCIA } from '../lib/estudo'

// ─────────────────────────────────────────────────────────────────────────────
// Linha do tempo da proteção — o gráfico que conta a história do estudo:
// o custo mensal que o plano garante cai em degraus conforme cada filho
// completa 24 anos e quando o horizonte de proteção termina. É o argumento
// visual de que o capital é calculado sob medida (nem um real a mais).
//
// Área empilhada em degraus, 2 séries na ordem categórica fixa do app:
//   laranja (série 1) = gasto com os filhos  ·  azul (série 2) = família
// Par validado no validador da skill dataviz (luminosidade, croma, CVD 81+,
// contraste ≥ 3:1 sobre superfície clara).
// ─────────────────────────────────────────────────────────────────────────────

const COR = {
  filhos: '#d96527', // laranja da marca — a série em destaque
  base: '#1272a8',   // azul — padrão de vida da família
  grid: '#ececee',
  eixo: '#cbccd2',
  texto: '#8f929b',
  tinta: '#334155',
}

export default function LinhaProtecao({ estudo, altura = 200, titulo = true }) {
  const [hover, setHover] = useState(null)

  const dados = useMemo(() => {
    if (!estudo || estudo.custoVida <= 0) return null
    const filhos = estudo.filhos.filter((f) => f.custoMensal > 0)
    if (filhos.length === 0) return null
    const N = Math.min(Math.max(estudo.anos, ...filhos.map((f) => f.anosRestantes)), 40)
    if (!(N > 0)) return null

    // valor garantido por mês em cada ano t (0 = hoje)
    const serie = []
    for (let t = 0; t < N; t++) {
      serie.push({
        t,
        base: t < estudo.anos ? estudo.custoVidaBase : 0,
        filhos: filhos.filter((f) => f.anosRestantes > t).reduce((s, f) => s + f.custoMensal, 0),
      })
    }

    // os degraus: cada filho fazendo 24 e o fim do horizonte
    const porT = new Map()
    const somar = (t, rotulo, delta) => {
      const acc = porT.get(t)
      if (acc) { acc.rotulo += ` + ${rotulo}`; acc.delta += delta }
      else porT.set(t, { t, rotulo, delta })
    }
    for (const f of filhos) {
      if (f.anosRestantes > 0 && f.anosRestantes <= N) {
        somar(f.anosRestantes, `${f.nome || 'filho(a)'} faz ${IDADE_INDEPENDENCIA}`, -f.custoMensal)
      }
    }
    if (estudo.anos <= N && estudo.custoVidaBase > 0) {
      somar(estudo.anos, `fim do horizonte (${estudo.anos} anos)`, -estudo.custoVidaBase)
    }
    const eventos = [...porT.values()].sort((a, b) => a.t - b.t)
    return { N, serie, eventos, filhos }
  }, [estudo])

  if (!dados) return null
  const { N, serie, eventos } = dados

  // topo reserva uma linha de 12px por evento anotado (até 3 alturas)
  const W = 660, H = altura, TOPO = 22 + Math.min(eventos.length, 3) * 13, EIXO = 22, PADL = 8, PADR = 8
  const plotW = W - PADL - PADR
  const max = serie[0].base + serie[0].filhos
  const x = (t) => PADL + (t / N) * plotW
  const y = (v) => H - (v / max) * (H - TOPO)

  // caminho em degraus do topo de uma pilha (t=0..N)
  const degraus = (topo) => {
    let d = `M ${x(0)} ${y(topo(0))}`
    for (let t = 0; t < N; t++) {
      d += ` H ${x(t + 1)}`
      if (t + 1 < N && topo(t + 1) !== topo(t)) d += ` V ${y(topo(t + 1))}`
    }
    return d
  }
  const topoBase = (t) => serie[Math.min(t, N - 1)].base
  const topoTotal = (t) => { const s = serie[Math.min(t, N - 1)]; return s.base + s.filhos }

  const areaBase = `${degraus(topoBase)} V ${H} H ${x(0)} Z`
  // banda dos filhos: topo total, volta pelo topo da base (2px de respiro via stroke branco)
  const areaFilhos = (() => {
    let d = degraus(topoTotal)
    d += ` V ${y(topoBase(N - 1))}`
    for (let t = N - 1; t >= 0; t--) {
      d += ` H ${x(t)}`
      if (t > 0 && topoBase(t - 1) !== topoBase(t)) d += ` V ${y(topoBase(t - 1))}`
    }
    return d + ' Z'
  })()

  const anoAtual = new Date().getFullYear()
  const passoTick = Math.max(1, Math.ceil(N / 8))

  function aoMover(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const t = Math.max(0, Math.min(Math.floor(((px - PADL) / plotW) * N), N - 1))
    setHover(t)
  }

  const h = hover != null ? serie[hover] : null

  return (
    <div>
      {titulo && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: COR.filhos }} />
            Gasto com os filhos (até os {IDADE_INDEPENDENCIA})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: COR.base }} />
            Padrão de vida da família
          </span>
        </div>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + EIXO}`} className="w-full" onMouseMove={aoMover}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`Custo mensal garantido pelo plano ao longo de ${N} anos: começa em ${brl(max)} por mês e cai em degraus conforme cada filho completa ${IDADE_INDEPENDENCIA} anos.`}>
          <line x1={PADL} x2={W - PADR} y1={y(max * 0.5)} y2={y(max * 0.5)} stroke={COR.grid} strokeWidth="1" />
          <text x={W - PADR} y={y(max * 0.5) - 4} textAnchor="end" fontSize="10" fill={COR.texto}>
            {brlCompacto(max * 0.5)}/mês
          </text>
          <line x1={PADL} x2={W - PADR} y1={H} y2={H} stroke={COR.eixo} strokeWidth="1" />

          <path d={areaBase} fill={COR.base} />
          <path d={areaFilhos} fill={COR.filhos} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />

          {/* degraus anotados: quem faz 24 / fim do horizonte — uma altura por
              evento; perto da borda direita o texto ancora à esquerda da linha */}
          {eventos.map((ev, i) => {
            const yRotulo = 10 + (i % 3) * 13
            const pertoDaBorda = x(ev.t) > W * 0.62
            return (
              <g key={ev.t}>
                <line x1={x(ev.t)} x2={x(ev.t)} y1={yRotulo + 3} y2={H}
                  stroke={COR.eixo} strokeWidth="1" strokeDasharray="4 3" />
                <text x={pertoDaBorda ? x(ev.t) - 5 : x(ev.t) + 5} y={yRotulo}
                  textAnchor={pertoDaBorda ? 'end' : 'start'} fontSize="10.5"
                  fill={COR.tinta} fontWeight="600">
                  {ev.rotulo}
                  <tspan fill={COR.texto} fontWeight="400"> −{brlCompacto(Math.abs(ev.delta))}/mês</tspan>
                </text>
              </g>
            )
          })}

          {/* rótulo direto do ponto de partida */}
          <text x={x(0) + 5} y={y(max) + 15} fontSize="11" fontWeight="700" fill="#fff">
            {brlCompacto(max)}/mês hoje
          </text>

          {/* eixo dos anos (calendário) */}
          {Array.from({ length: N + 1 }, (_, t) => t).filter((t) => t % passoTick === 0).map((t) => (
            <text key={t} x={x(t)} y={H + 15}
              textAnchor={t === 0 ? 'start' : t >= N - passoTick / 2 ? 'end' : 'middle'}
              fontSize="10.5" fill={COR.texto}>
              {anoAtual + t}
            </text>
          ))}

          {/* crosshair do hover */}
          {h && (
            <line x1={x(h.t) + (x(1) - x(0)) / 2} x2={x(h.t) + (x(1) - x(0)) / 2}
              y1={TOPO - 4} y2={H} stroke={COR.tinta} strokeWidth="1" opacity="0.35" />
          )}
        </svg>

        {h && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{
              left: `${((h.t + 0.5) / N) * 100}%`,
              transform: `translateX(${h.t > N * 0.6 ? '-105%' : '5%'})`,
            }}>
            <p className="font-semibold text-slate-900">{anoAtual + h.t}{h.t > 0 && ` · daqui a ${h.t} ano(s)`}</p>
            <p className="mt-0.5 text-slate-500">
              <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COR.filhos }} />
              Filhos: <strong className="text-slate-700">{h.filhos > 0 ? `${brl(h.filhos)}/mês` : '—'}</strong>
            </p>
            <p className="text-slate-500">
              <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COR.base }} />
              Família: <strong className="text-slate-700">{h.base > 0 ? `${brl(h.base)}/mês` : '—'}</strong>
            </p>
            <p className="mt-0.5 border-t border-slate-100 pt-0.5 font-semibold text-slate-900">
              Total: {brl(h.base + h.filhos)}/mês
            </p>
          </div>
        )}
      </div>

      {/* Versão em texto para leitores de tela. O sr-only vai no <div>, não na
          <table>: tabela cresce até o conteúdo mesmo com width:1px e acabava
          empurrando a rolagem horizontal da página no celular. */}
      <div className="sr-only">
        <table>
          <caption>Custo mensal garantido pelo plano por ano</caption>
          <thead><tr><th>Ano</th><th>Família</th><th>Filhos</th></tr></thead>
          <tbody>
            {serie.filter((s) => s.t % passoTick === 0).map((s) => (
              <tr key={s.t}><td>{anoAtual + s.t}</td><td>{brl(s.base)}</td><td>{brl(s.filhos)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
