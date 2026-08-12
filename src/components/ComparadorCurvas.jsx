import { useState } from 'react'
import { brl, brlCompacto } from '../lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// O GRÁFICO DO CRUZAMENTO — a prova visual de que o seguro vale a pena.
//
// Três séries e uma área. A leitura acontece em dois segundos:
//
//   · a RETA laranja, cheia desde o primeiro mês, é o que o seguro entrega;
//   · a CURVA azul, subindo do zero, é o mesmo dinheiro investido, já líquido
//     de imposto de renda;
//   · a CURVA verde, mais baixa, é o valor de resgate do próprio seguro;
//   · a área hachurada entre a reta e a curva azul é o RISCO DESCOBERTO — o
//     dinheiro que faltaria à família se acontecesse naquele ano.
//
// A área é o argumento. Ela é enorme no começo e só fecha no ano do
// cruzamento — que pode não chegar nunca dentro do horizonte, e quando não
// chega, isso é dito com todas as letras.
//
// A honestidade que sustenta o resto: no fim do horizonte a curva azul passa
// da verde. O investimento acumula mais, e o gráfico mostra. Esconder isso
// seria o jeito mais rápido de perder a conversa para o assessor do cliente.
//
// Paleta validada no validador da skill dataviz (`--pairs all`, modo claro):
// laranja/azul/verde com ΔE 9,7 no pior par em deuteranopia, 18,5 em visão
// normal, croma e contraste ≥ 3:1 sobre superfície clara. A identidade de cada
// série NÃO depende da cor: cada linha tem rótulo direto na ponta, além da
// legenda.
// ─────────────────────────────────────────────────────────────────────────────

const COR = {
  seguro: '#d96527',       // laranja da marca — o que a família recebe
  investimento: '#1272a8', // azul — a alternativa
  resgate: '#0e9f6e',      // verde — o dinheiro que o seguro devolve em vida
  grid: '#ececee',
  eixo: '#cbccd2',
  texto: '#8f929b',
  tinta: '#334155',
}

// `anotar` desliga a frase dentro do gráfico quando o contexto em volta já a
// diz — no slide o título é exatamente ela, e repetir rouba a atenção do
// desenho, que é o que precisa ser olhado.
export default function ComparadorCurvas({ comp, altura = 260, titulo = true, anotar = true }) {
  const [hover, setHover] = useState(null)
  if (!comp || !comp.serie || comp.serie.length < 2) return null

  const serie = comp.serie
  const N = serie.length
  const capital = comp.premissas.capital
  const temResgate = comp.premissas.temTabelaResgate

  // A escala é a do capital: é ele que a curva do investimento persegue, e é
  // contra ele que o descoberto se mede.
  const max = Math.max(capital, ...serie.map((p) => p.investidoLiquido)) * 1.06
  const W = 720
  const H = altura
  const TOPO = 26
  const EIXO = 24
  const PADL = 10
  const PADR = 70 // espaço para o rótulo direto na ponta das curvas ("R$ 840 mil" cabe)
  const plotW = W - PADL - PADR

  const x = (ano) => PADL + ((ano - 1) / Math.max(N - 1, 1)) * plotW
  const y = (v) => H - (Math.max(v, 0) / max) * (H - TOPO)

  const linha = (campo) => serie
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.ano).toFixed(1)} ${y(p[campo]).toFixed(1)}`)
    .join(' ')

  // A área do descoberto: por cima a reta do seguro, por baixo o investimento.
  const areaDescoberto = (() => {
    const porCima = serie.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.ano).toFixed(1)} ${y(p.seguroMorte).toFixed(1)}`).join(' ')
    const porBaixo = [...serie].reverse()
      .map((p) => `L ${x(p.ano).toFixed(1)} ${y(Math.min(p.investidoLiquido, p.seguroMorte)).toFixed(1)}`).join(' ')
    return `${porCima} ${porBaixo} Z`
  })()

  const passoTick = Math.max(1, Math.ceil(N / 8))
  const cruzamento = comp.anoDoCruzamento
  const ultimo = serie[N - 1]

  function aoMover(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const bruto = Math.round(((px - PADL) / plotW) * (N - 1)) + 1
    setHover(Math.max(1, Math.min(bruto, N)))
  }
  const h = hover != null ? serie[hover - 1] : null

  const series = [
    { id: 'seguro', rotulo: 'O seguro entrega', cor: COR.seguro, campo: 'seguroMorte' },
    { id: 'investimento', rotulo: 'Investindo o mesmo valor', cor: COR.investimento, campo: 'investidoLiquido' },
    ...(temResgate ? [{ id: 'resgate', rotulo: 'Resgate do seguro', cor: COR.resgate, campo: 'seguroResgate' }] : []),
  ]

  return (
    <div>
      {titulo && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {series.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.cor }} />
              {s.rotulo}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-slate-300"
              style={{ background: 'repeating-linear-gradient(45deg, #d9652733 0 3px, transparent 3px 6px)' }} />
            O que faltaria à família
          </span>
        </div>
      )}

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + EIXO}`} className="w-full" onMouseMove={aoMover}
          onMouseLeave={() => setHover(null)} role="img"
          aria-label={`Comparação ano a ano: o seguro entrega ${brl(capital)} desde o primeiro mês, `
            + `enquanto o mesmo valor investido chega a ${brl(ultimo.investidoLiquido)} no ano ${N}. `
            + (cruzamento
              ? `O investimento só alcança o capital do seguro no ano ${cruzamento}.`
              : `Em ${N} anos o investimento não alcança o capital do seguro.`)}>
          <defs>
            {/* textura em 45°: o descoberto não depende só da cor para ser lido
                — funciona em daltonismo, impressão e alto contraste */}
            <pattern id="hachuraDescoberto" width="9" height="9" patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="9" stroke={COR.seguro} strokeWidth="1.6" opacity="0.16" />
            </pattern>
          </defs>

          {/* grade discreta em metade e no capital */}
          <line x1={PADL} x2={W - PADR} y1={y(max * 0.5)} y2={y(max * 0.5)} stroke={COR.grid} strokeWidth="1" />
          <text x={PADL + 2} y={y(max * 0.5) - 4} fontSize="10" fill={COR.texto}>{brlCompacto(max * 0.5)}</text>
          <line x1={PADL} x2={W - PADR} y1={H} y2={H} stroke={COR.eixo} strokeWidth="1" />

          {/* o buraco */}
          <path d={areaDescoberto} fill="url(#hachuraDescoberto)" />

          {/* as curvas: 2px, o seguro por cima porque é a leitura principal */}
          {[...series].reverse().map((s) => (
            <g key={s.id}>
              {/* anel de superfície de 2px: a linha continua legível mesmo
                  quando cruza a hachura ou passa colada na vizinha */}
              <path d={linha(s.campo)} fill="none" stroke="#fcfcfb" strokeWidth="4"
                strokeLinejoin="round" strokeLinecap="round" />
              <path d={linha(s.campo)} fill="none" stroke={s.cor} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}

          {/* rótulo direto na ponta de cada curva — identidade sem depender da cor */}
          {series.map((s) => {
            const v = ultimo[s.campo]
            return (
              <text key={s.id} x={W - PADR + 6} y={y(v) + 3.5} fontSize="10.5" fontWeight="600" fill={s.cor}>
                {brlCompacto(v)}
              </text>
            )
          })}

          {/* o ano do cruzamento, anotado */}
          {cruzamento && (
            <g>
              <line x1={x(cruzamento)} x2={x(cruzamento)} y1={TOPO - 6} y2={H}
                stroke={COR.tinta} strokeWidth="1" strokeDasharray="4 3" opacity="0.55" />
              {anotar && (
                <text x={x(cruzamento) + 5} y={TOPO - 10} fontSize="10.5" fontWeight="600" fill={COR.tinta}>
                  ano {cruzamento} — só aqui o investimento alcança
                </text>
              )}
            </g>
          )}
          {!cruzamento && anotar && (
            <text x={PADL + 4} y={TOPO - 10} fontSize="10.5" fontWeight="600" fill={COR.tinta}>
              em {N} anos o investimento não alcança o capital do seguro
            </text>
          )}

          {/* eixo dos anos */}
          {serie.filter((p) => p.ano === 1 || p.ano % passoTick === 0).map((p) => (
            <text key={p.ano} x={x(p.ano)} y={H + 15}
              textAnchor={p.ano === 1 ? 'start' : p.ano >= N - passoTick / 2 ? 'end' : 'middle'}
              fontSize="10.5" fill={COR.texto}>
              {p.ano === 1 ? 'ano 1' : p.ano}
            </text>
          ))}

          {h && <line x1={x(h.ano)} x2={x(h.ano)} y1={TOPO - 6} y2={H} stroke={COR.tinta} strokeWidth="1" opacity="0.35" />}
        </svg>

        {h && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{
              left: `${((h.ano - 1) / Math.max(N - 1, 1)) * 100}%`,
              transform: `translateX(${h.ano > N * 0.6 ? '-105%' : '5%'})`,
            }}>
            <p className="font-semibold text-slate-900">Se acontecesse no ano {h.ano}</p>
            {series.map((s) => (
              <p key={s.id} className="mt-0.5 whitespace-nowrap text-slate-500">
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: s.cor }} />
                {s.rotulo}: <strong className="text-slate-700">{brl(h[s.campo])}</strong>
              </p>
            ))}
            <p className="mt-1 whitespace-nowrap border-t border-slate-100 pt-1 font-semibold"
              style={{ color: h.descoberto > 0 ? COR.seguro : COR.resgate }}>
              {h.descoberto > 0
                ? `Faltariam ${brl(h.descoberto)}`
                : 'O investimento já cobre o capital'}
            </p>
          </div>
        )}
      </div>

      {/* Versão em texto para leitores de tela. O sr-only vai no <div>, não na
          <table>: tabela cresce até o conteúdo mesmo com width:1px e acabava
          empurrando a rolagem horizontal da página no celular. */}
      <div className="sr-only">
        <table>
          <caption>Comparação ano a ano entre o seguro e o mesmo valor investido</caption>
          <thead>
            <tr>
              <th>Ano</th><th>O seguro entrega</th><th>Investido líquido</th>
              <th>Resgate do seguro</th><th>O que faltaria</th>
            </tr>
          </thead>
          <tbody>
            {serie.filter((p) => p.ano === 1 || p.ano % passoTick === 0).map((p) => (
              <tr key={p.ano}>
                <td>{p.ano}</td><td>{brl(p.seguroMorte)}</td><td>{brl(p.investidoLiquido)}</td>
                <td>{brl(p.seguroResgate)}</td><td>{brl(p.descoberto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
