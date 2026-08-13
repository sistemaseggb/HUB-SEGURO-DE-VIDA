import { useState } from 'react'
import { Users, Plus, Trash2, AlertTriangle, Scale, ChevronDown } from 'lucide-react'
import { Campo, Input, Select } from './ui'
import { PARENTESCOS } from '../lib/beneficiarios'
import { brl, brlCompacto } from '../lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// QUEM RECEBE — e o que trava no caminho.
//
// A proposta inteira se apoia em "o seguro não passa por inventário, chega em
// dias". É verdade (CC art. 794) e o sistema nunca guardou uma linha sobre a
// indicação de beneficiário, que é exatamente onde a promessa se cumpre ou se
// quebra.
//
// O alerta que justifica a tela: beneficiário MENOR. A seguradora paga, mas o
// dinheiro fica sob representação legal e o uso costuma depender de alvará
// judicial — meses de espera pelo capital contratado justamente para não haver
// espera. Acontece com o cliente que fez tudo certo: o pai que indicou os
// filhos. A correção leva dez segundos na proposta de contratação.
// ─────────────────────────────────────────────────────────────────────────────

export default function PainelBeneficiarios({ analise, plano, setPlano }) {
  const [verBase, setVerBase] = useState(false)
  if (!analise) return null

  const lista = Array.isArray(plano.beneficiarios) ? plano.beneficiarios : []
  const setItem = (i, campo, valor) => setPlano({
    ...plano,
    beneficiarios: lista.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)),
  })
  const adicionar = () => setPlano({
    ...plano,
    beneficiarios: [...lista, { nome: '', parentesco: 'Cônjuge', pct: '', nascimento: '' }],
  })
  const remover = (i) => setPlano({
    ...plano, beneficiarios: lista.filter((_, j) => j !== i),
  })
  // Divide o que falta igualmente — o erro de soma é o motivo mais bobo de uma
  // proposta voltar da seguradora para correção.
  const dividirIgual = () => {
    if (lista.length === 0) return
    const base = Math.floor((100 / lista.length) * 10) / 10
    const resto = Math.round((100 - base * lista.length) * 10) / 10
    setPlano({
      ...plano,
      beneficiarios: lista.map((b, i) => ({ ...b, pct: i === 0 ? base + resto : base })),
    })
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Users size={15} className="text-laranja-600" /> Quem recebe o capital
        </p>
        <div className="flex items-center gap-2">
          {lista.length > 1 && (
            <button type="button" onClick={dividirIgual}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400">
              Dividir igual
            </button>
          )}
          <button type="button" onClick={adicionar}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800">
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        A indicação é feita na proposta de contratação — mas decidir isso aqui, com calma, é o que
        evita o erro mais caro da apólice. O sistema confere a soma dos percentuais e avisa quando
        a indicação cria o problema do beneficiário menor.
      </p>

      {lista.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
          Nenhum beneficiário registrado. Sem indicação válida, a lei paga metade ao cônjuge e o
          resto aos herdeiros (CC art. 792) — raramente é o desenho que o cliente descreveria.
        </p>
      )}

      {lista.map((b, i) => {
        const info = analise.itens[i]
        return (
          <div key={i}
            className="mb-2 grid items-end gap-2 rounded-lg border border-slate-200/70 bg-white p-3 sm:grid-cols-[1.4fr_1fr_150px_90px_auto]">
            <Campo label="Nome completo">
              <Input value={b.nome ?? ''} placeholder="Como está no documento"
                onChange={(e) => setItem(i, 'nome', e.target.value)} />
            </Campo>
            <Campo label="Parentesco">
              <Select value={b.parentesco ?? 'Outro'} onChange={(e) => setItem(i, 'parentesco', e.target.value)}>
                {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Campo>
            <Campo label="Nascimento" dica="Para o sistema saber quem ainda é menor">
              <Input type="date" value={b.nascimento ?? ''}
                onChange={(e) => setItem(i, 'nascimento', e.target.value)} />
            </Campo>
            <Campo label="%">
              <Input type="number" min="0" max="100" step="0.1" value={b.pct ?? ''}
                onChange={(e) => setItem(i, 'pct', e.target.value)} />
            </Campo>
            <button type="button" onClick={() => remover(i)} title="Remover beneficiário"
              className="mb-1 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:text-red-600">
              <Trash2 size={14} />
            </button>
            {info && analise.capital > 0 && info.pct > 0 && (
              <p className={`-mt-1 text-xs sm:col-span-5 ${info.menor ? 'text-red-700' : 'text-slate-400'}`}>
                Recebe <strong>{brl(Math.round((analise.capital * info.pct) / 100))}</strong>
                {info.idade != null && ` · ${info.idade} anos`}
                {info.menor && ' — MENOR de idade: o uso do dinheiro costuma depender de alvará judicial'}
              </p>
            )}
          </div>
        )
      })}

      {/* O rateio em dinheiro */}
      {analise.declarado && analise.capital > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Somam <strong className={Math.abs(analise.somaPct - 100) > 0.5 ? 'text-red-700' : 'text-emerald-700'}>
            {String(analise.somaPct).replace('.', ',')}%
          </strong> de {brlCompacto(analise.capital)} de capital de morte.
        </p>
      )}

      {/* Alertas */}
      {analise.alertas.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
          {analise.alertas.map((a) => (
            <li key={a.id}
              className={`rounded-lg border p-3 text-xs leading-relaxed ${a.grave
                ? 'border-red-200 bg-red-50/70 text-red-900' : 'border-amber-100 bg-amber-50/60 text-amber-900'}`}>
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={13} className={a.grave ? 'text-red-500' : 'text-amber-500'} />
                {a.titulo}
              </p>
              <p className="mt-1">{a.texto}</p>
            </li>
          ))}
        </ul>
      )}

      {/* A base legal, para consulta */}
      <button type="button" onClick={() => setVerBase((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-laranja-700 hover:text-laranja-800">
        <ChevronDown size={13} className={`transition-transform ${verBase ? 'rotate-180' : ''}`} />
        <Scale size={12} /> A base legal disso tudo
      </button>
      {verBase && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {analise.conhecimento.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200/70 bg-white p-3">
              <p className="text-sm font-semibold text-slate-800">{c.titulo}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-laranja-700">
                {c.referencia}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{c.texto}</p>
            </div>
          ))}
          <p className="text-xs text-slate-400 md:col-span-2">
            Referências para a consultora conferir e sustentar o que diz — não substituem o
            jurídico da seguradora nos casos sensíveis.
          </p>
        </div>
      )}
    </div>
  )
}
