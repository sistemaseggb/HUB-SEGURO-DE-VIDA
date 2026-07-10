import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

// Logo do escritório (monograma GB).
//
// COMO TROCAR PELA LOGO REAL: basta substituir UM arquivo — public/logo.png.
// Ele é usado em todo o sistema. Em fundos escuros (capa da proposta, login),
// a logo aparece dentro de um selo branco arredondado, então o MESMO arquivo
// serve para fundo claro e escuro — não precisa de versão branca.
// Opcional: se existir public/logo-branca.png, ela é usada direto no escuro
// (sem o selo). Se logo.png não existir, um emblema neutro entra no lugar.
export default function Logo({ claro = false, tamanho = 44 }) {
  const [erroBranca, setErroBranca] = useState(false)
  const [erroPng, setErroPng] = useState(false)

  // Fundo escuro: tenta a versão branca; senão, a logo normal num selo branco
  if (claro && !erroBranca) {
    return <img src="/logo-branca.png" alt="Logo do escritório"
      style={{ height: tamanho }} onError={() => setErroBranca(true)} />
  }

  if (!erroPng) {
    const img = <img src="/logo.png" alt="Logo do escritório"
      style={{ height: claro ? tamanho * 0.82 : tamanho }} onError={() => setErroPng(true)} />
    return claro
      ? <span className="inline-flex items-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm">{img}</span>
      : img
  }

  // Fallback: emblema neutro (só aparece se não houver nenhum arquivo de logo)
  return (
    <span className={`inline-flex items-center gap-2 ${claro ? 'text-white' : 'text-slate-900'}`}>
      <span className={`rounded-xl p-2 ring-1 ${claro ? 'bg-white/10 ring-white/25' : 'bg-brand-50 ring-brand-100 text-brand-700'}`}>
        <ShieldCheck size={Math.max(tamanho - 22, 16)} />
      </span>
      <span className="text-left leading-tight">
        <span className="block font-display text-sm font-semibold tracking-wide">GB Seguros</span>
        <span className={`block text-[10px] uppercase tracking-[0.22em] ${claro ? 'text-white/60' : 'text-slate-400'}`}>Vida &amp; Patrimônio</span>
      </span>
    </span>
  )
}
