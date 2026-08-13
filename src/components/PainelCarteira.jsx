import { ShieldOff, ShieldCheck, Landmark, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Campo, Input, InputMoeda, Select } from './ui'
import { ORIGENS_SEGURO } from '../lib/estudo'
import { brl, brlCompacto } from '../lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// A CARTEIRA QUE ELE JÁ TEM — a objeção mais comum da categoria, respondida
// com o documento em vez de com argumento.
//
// "Já tenho seguro pela empresa" encerrava a conversa. O sistema concordava:
// `cobertura_atual` era um número só, abatido inteiro do capital de morte.
//
// Aqui cada apólice é listada com a ORIGEM, e a origem decide tudo:
//   · individual custeada por ele → é dele, acompanha-o, e o estudo deve mesmo
//     abater (senão vende duas vezes a mesma proteção);
//   · vida em grupo da empresa   → acaba com o vínculo, e o vínculo costuma
//     acabar no pior momento possível;
//   · prestamista do banco       → o cheque é do banco: quita a dívida e não
//     entrega um real à família.
//
// O quadro de baixo é o que a consultora vira para o cliente. Ele não discute:
// é a soma das apólices dele, separada por quem paga e quem recebe.
// ─────────────────────────────────────────────────────────────────────────────

function Coluna({ icone: Icone, tom, rotulo, valor, texto }) {
  const cores = {
    bom: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
    aviso: 'border-amber-200 bg-amber-50/60 text-amber-900',
    ruim: 'border-red-200 bg-red-50/60 text-red-800',
  }[tom]
  const iconeCor = { bom: 'text-emerald-600', aviso: 'text-amber-600', ruim: 'text-red-500' }[tom]
  return (
    <div className={`rounded-xl border p-3 ${cores}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <Icone size={13} className={iconeCor} /> {rotulo}
      </p>
      <p className="mt-1 text-xl font-bold tracking-tight">{brlCompacto(valor)}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{texto}</p>
    </div>
  )
}

export default function PainelCarteira({ estudo, plano, setPlano, setValor }) {
  const lista = Array.isArray(plano.seguros_existentes) ? plano.seguros_existentes : []
  const k = estudo.carteira

  const setItem = (i, campo, valor) => setPlano({
    ...plano,
    seguros_existentes: lista.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)),
  })
  const adicionar = () => setPlano({
    ...plano,
    seguros_existentes: [...lista, { origem: 'individual', descricao: '', capital: '', custeio: 'proprio' }],
  })
  const remover = (i) => setPlano({
    ...plano,
    seguros_existentes: lista.filter((_, j) => j !== i),
  })

  return (
    <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <ShieldCheck size={15} className="text-laranja-600" />
          O que ele já tem — e o que disso é realmente dele
        </p>
        <button type="button" onClick={adicionar}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800">
          <Plus size={13} /> Adicionar apólice
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        “Já tenho seguro pela empresa” é a objeção mais comum da categoria — e a única que se
        responde com o documento na mão. Liste cada apólice com a origem: o estudo separa o que
        acompanha o cliente do que acaba com o emprego e do que nem chega à família.
      </p>

      {lista.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
          {estudo.coberturaAtual > 0
            ? `Nenhuma apólice detalhada. Os ${brl(estudo.coberturaAtual)} de cobertura atual estão
               abatendo o capital de morte inteiros, como se fossem apólice própria e permanente.`
            : 'Nenhuma apólice cadastrada — o estudo assume que ele não tem cobertura nenhuma hoje.'}
        </p>
      )}

      {lista.map((s, i) => {
        const origem = ORIGENS_SEGURO.find((o) => o.id === (s.origem || 'individual'))
        const emprestada = s.custeio === 'empresa' || origem?.portatil === false
        return (
          <div key={i}
            className="mb-2 grid items-end gap-2 rounded-lg border border-slate-200/70 bg-white p-3 sm:grid-cols-[1.2fr_1fr_120px_1fr_auto]">
            <Campo label="Descrição">
              <Input value={s.descricao ?? ''} placeholder="Ex.: vida em grupo da empresa"
                onChange={(e) => setItem(i, 'descricao', e.target.value)} />
            </Campo>
            <Campo label="Origem">
              <Select value={s.origem || 'individual'} onChange={(e) => setItem(i, 'origem', e.target.value)}>
                {ORIGENS_SEGURO.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
              </Select>
            </Campo>
            <Campo label="Capital">
              <InputMoeda value={s.capital ?? ''} onChange={(e) => setItem(i, 'capital', e.target.value)} />
            </Campo>
            <Campo label="Quem paga">
              <Select value={s.custeio || 'proprio'} onChange={(e) => setItem(i, 'custeio', e.target.value)}>
                <option value="proprio">Ele mesmo</option>
                <option value="empresa">A empresa</option>
              </Select>
            </Campo>
            <button type="button" onClick={() => remover(i)} title="Remover apólice"
              className="mb-1 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:text-red-600">
              <Trash2 size={14} />
            </button>
            {origem && (
              <p className={`sm:col-span-5 -mt-1 text-xs ${emprestada ? 'text-amber-700' : 'text-slate-400'}`}>
                {emprestada && <AlertTriangle size={11} className="mr-1 inline align-[-1px]" />}
                {s.custeio === 'empresa' && origem.portatil
                  ? 'Apólice individual custeada pela empresa: na prática acaba com o vínculo, como a vida em grupo.'
                  : origem.nota}
              </p>
            )}
          </div>
        )
      })}

      {/* O quadro que ela vira para o cliente */}
      {k.detalhado && k.total > 0 && (
        <div className="mt-3 border-t border-slate-200/70 pt-3">
          <p className="mb-2 text-xs text-slate-500">
            Dos <strong className="text-slate-700">{brl(k.total)}</strong> que ele chama de “seguro
            que já tenho”:
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Coluna icone={ShieldCheck} tom="bom" rotulo="É dele mesmo" valor={k.portavel}
              texto="Apólice própria: acompanha o cliente e paga a quem ele indicou. É a única que o estudo pode abater com segurança." />
            <Coluna icone={ShieldOff} tom="aviso" rotulo="Acaba com o emprego" valor={k.condicionada}
              texto="Vida em grupo: existe enquanto o vínculo existir — e o vínculo raramente acaba num bom momento." />
            <Coluna icone={Landmark} tom="ruim" rotulo="É do banco" valor={k.quitaDivida}
              texto="Prestamista: quita o financiamento e não entrega um real em dinheiro para a família." />
          </div>

          {estudo.capitalQueEvapora > 0 && estudo.valores.morte > 0 && (
            <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <strong>O número da conversa:</strong> hoje falta {brl(estudo.gap)} de proteção. No dia
              em que ele sair da empresa, faltam <strong>{brl(estudo.gapPortavel)}</strong> — e a
              recontratação sai pelo preço da idade que ele tiver na hora
              {estudo.idade != null ? `, não pelos ${estudo.idade} de hoje` : ''}.
            </p>
          )}

          {Math.abs(k.divergencia) > 1 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>
                A soma das apólices ({brl(k.total)}) não bate com a cobertura atual declarada
                ({brl(k.declarado)}) — e é a declarada que abate o capital de morte.
                <button type="button" onClick={() => setValor('cobertura_atual', Math.round(k.total))}
                  className="ml-1.5 font-semibold text-blue-600 hover:underline">
                  corrigir para {brlCompacto(k.total)}
                </button>
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
