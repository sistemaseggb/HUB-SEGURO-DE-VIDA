import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

// Logo do escritório (monograma GB). Os arquivos vivem em public/:
//   logo.png        → fundos claros
//   logo-branca.png → fundos escuros (capa da proposta, painel do login)
// Para trocar a marca, basta substituir os PNGs — nenhum código muda.
// Se os arquivos sumirem, um emblema neutro entra no lugar.
export default function Logo({ claro = false, tamanho = 44 }) {
  const [erro, setErro] = useState(false)
  if (!erro) {
    return <img src={claro ? '/logo-branca.png' : '/logo.png'} alt="Logo do escritório"
      style={{ height: tamanho }} onError={() => setErro(true)} />
  }
  return (
    <span className={`inline-flex items-center gap-2 ${claro ? 'text-white' : 'text-slate-900'}`}>
      <span className={`rounded-xl p-2 ring-1 ${claro ? 'bg-white/10 ring-white/25' : 'bg-brand-50 ring-brand-100 text-brand-700'}`}>
        <ShieldCheck size={Math.max(tamanho - 22, 16)} />
      </span>
      <span className="text-left leading-tight">
        <span className="block font-display text-sm font-semibold tracking-wide">GB Seguros</span>
        <span className={`block text-[10px] uppercase tracking-[0.22em] ${claro ? 'text-white/60' : 'text-slate-400'}`}>Vida & Patrimônio</span>
      </span>
    </span>
  )
}
