import { useState } from 'react'

// Logo oficial do escritório (GB | XP).
//
// Arquivos (gerados dos originais em docs/marca/):
//   public/logo.png     → lockup completo "GB | XP" (login, proposta, impressos)
//   public/logo-gb.png  → monograma GB quadrado (sidebar, ícones, favicon)
//
// `claro` = uso sobre fundo escuro: a marca é preta, então entra num selo
// branco arredondado — o mesmo arquivo serve em qualquer fundo.
export default function Logo({ claro = false, tamanho = 44, variante = 'lockup' }) {
  const [erro, setErro] = useState(false)
  const src = variante === 'monograma' ? '/logo-gb.png' : '/logo.png'

  if (erro) {
    return <span className={`font-display text-sm font-bold ${claro ? 'text-white' : 'text-slate-900'}`}>GB | XP</span>
  }

  const img = (
    <img src={src} alt="GB | XP" style={{ height: claro ? tamanho * 0.78 : tamanho }}
      onError={() => setErro(true)} />
  )
  return claro
    ? <span className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-pop">{img}</span>
    : img
}
