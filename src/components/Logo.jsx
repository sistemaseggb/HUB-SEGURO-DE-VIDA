import { useState } from 'react'

// Logo oficial do escritório (GB | XP).
//
// Arquivos (gerados dos originais em docs/marca/):
//   public/logo.png     → lockup completo "GB | XP" (login, proposta, impressos)
//   public/logo-gb.png  → monograma GB quadrado (sidebar, ícones, favicon)
//
// ── O ARQUIVO GRANDE FICA, MAS SÓ DESCE QUANDO PRECISA ──────────────────────
// Os dois originais são de impressão: 1400×520 e 800×800, 100 kB cada. Na tela
// eles nunca passam de 64 px de altura — o navegador baixava 200 kB para
// desenhar um logo do tamanho de uma unha. Isso pesa em toda página do sistema
// (o monograma está na barra lateral) e, pior, nas páginas do CLIENTE, que ele
// abre no celular, à noite, no 4G: o formulário e o planejamento por link
// começam com o logo, antes de qualquer outra coisa.
//
// `srcSet` resolve sem escolher por ele: as versões pequenas atendem a tela,
// e o original continua ali para quem tem retina ou está imprimindo a
// proposta. O navegador pega uma só, e `sizes` diz qual. Nada foi
// re-encodado: os originais estão intactos.
const LOCKUP = { largura: 1400, altura: 520 }
const FONTES = {
  lockup: '/logo-256.png 256w, /logo-512.png 512w, /logo.png 1400w',
  monograma: '/logo-gb-96.png 96w, /logo-gb-192.png 192w, /logo-gb.png 800w',
}
//
// `claro` = uso sobre fundo escuro: a marca é preta, então entra num selo
// branco arredondado — o mesmo arquivo serve em qualquer fundo.
export default function Logo({ claro = false, tamanho = 44, variante = 'lockup' }) {
  const [erro, setErro] = useState(false)
  const src = variante === 'monograma' ? '/logo-gb.png' : '/logo.png'

  if (erro) {
    return <span className={`font-display text-sm font-bold ${claro ? 'text-white' : 'text-slate-900'}`}>GB | XP</span>
  }

  const altura = claro ? tamanho * 0.78 : tamanho
  // O `sizes` é declarado em LARGURA, mas a marca é dimensionada pela ALTURA:
  // sem converter pela proporção, o navegador escolheria a versão errada.
  const largura = variante === 'monograma'
    ? altura : Math.round(altura * (LOCKUP.largura / LOCKUP.altura))
  const img = (
    <img src={src} srcSet={FONTES[variante] ?? FONTES.lockup} sizes={`${Math.round(largura)}px`}
      alt="GB | XP" style={{ height: altura }}
      onError={() => setErro(true)} />
  )
  return claro
    ? <span className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-pop">{img}</span>
    : img
}
