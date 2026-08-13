import { Stethoscope, Clock3, AlertTriangle, FileCheck2, CircleHelp, TrendingUp, Check } from 'lucide-react'
import { Campo, Input, Textarea } from './ui'
import { ATIVIDADES_RISCO } from '../lib/subscricao'
import { brl } from '../lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// A SUBSCRIÇÃO NA TELA — "isso sai, e em quanto tempo?"
//
// O bloco existe para uma frase que a consultora vai dizer no fim da reunião:
// "quando é que está valendo?". Antes ela chutava, e o chute virava promessa.
//
// A ordem dos elementos é a ordem em que ela precisa deles:
//   1. o combinado — a frase pronta para dizer ao cliente;
//   2. o que a seguradora vai exigir, e em quanto tempo;
//   3. o que encarece e o que pode NÃO estar coberto (coisas diferentes);
//   4. o que separar ainda hoje, com o cliente na frente dela.
//
// O item 4 é o mais valioso e o mais chato de lembrar: o processo quase nunca
// trava por decisão do cliente, trava por um PDF que ele tinha no celular no
// dia em que disse sim.
// ─────────────────────────────────────────────────────────────────────────────

export default function PainelSubscricao({ analise, plano, setPlano, setValor }) {
  if (!analise) return null

  const atividades = Array.isArray(plano.atividades_risco) ? plano.atividades_risco : []
  const alternar = (id) => setValor('atividades_risco',
    atividades.includes(id) ? atividades.filter((a) => a !== id) : [...atividades, id])

  const [diasMin, diasMax] = analise.prazoDias

  return (
    <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <Stethoscope size={15} className="text-laranja-600" /> Vai sair? E em quanto tempo?
      </p>
      <p className="mb-3 mt-0.5 text-xs text-slate-400">
        O que a seguradora vai exigir para emitir este capital, o prazo real e o que pode vir com
        agravo ou restrição. Não é a política de nenhuma companhia — é o mapa do terreno, para
        combinar prazo com o cliente olhando para a realidade em vez de para o otimismo.
      </p>

      {/* A frase pronta */}
      <div className={`rounded-xl border p-3.5 ${analise.automatico
        ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Clock3 size={12} /> O que dizer quando ele perguntar “quando começa a valer?”
        </p>
        <p className={`mt-1 text-sm font-medium ${analise.automatico ? 'text-emerald-900' : 'text-amber-900'}`}>
          {analise.combinado}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          <span><strong className="text-slate-800">{diasMin} a {diasMax} dias</strong> até a emissão</span>
          <span>capital analisado: <strong className="text-slate-800">{brl(analise.capitalAnalisado)}</strong></span>
          {analise.agravoRelevante && (
            <span className="text-amber-800">
              agravo estimado: <strong>{String(analise.agravoEstimado).replace('.', ',')}×</strong> sobre o prêmio de risco
            </span>
          )}
        </div>
      </div>

      {/* Exigências */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/70 bg-white p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FileCheck2 size={12} /> O que a seguradora vai pedir
          </p>
          <ul className="mt-2 space-y-1">
            {analise.exigencias.map((x) => (
              <li key={x} className="flex items-start gap-1.5 text-sm text-slate-600">
                <Check size={13} className="mt-0.5 shrink-0 text-slate-400" /> {x}
              </li>
            ))}
          </ul>
          {analise.acimaDaRetencao && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Capital acima do limite de retenção do mercado: o caso vai a resseguro facultativo,
              que tem prazo próprio e independe da agilidade da seguradora.
            </p>
          )}
        </div>

        {/* O que separar hoje */}
        <div className="rounded-xl border border-slate-200/70 bg-white p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FileCheck2 size={12} /> Peça ainda hoje, com ele na sua frente
          </p>
          <ul className="mt-2 space-y-1">
            {analise.documentos.map((d) => (
              <li key={d} className="flex items-start gap-1.5 text-sm text-slate-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-laranja-400" /> {d}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            O processo raramente trava por decisão do cliente. Trava por um documento que ele tinha
            no celular no dia em que disse sim.
          </p>
        </div>
      </div>

      {/* O que encarece */}
      {analise.fatores.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <TrendingUp size={12} /> O que deve encarecer o prêmio
          </p>
          <ul className="mt-2 space-y-2">
            {analise.fatores.map((f) => (
              <li key={f.id} className="text-sm">
                <span className="font-medium text-slate-700">{f.rotulo}</span>
                <span className="ml-1.5 rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">
                  ×{String(f.agravo).replace('.', ',')}
                </span>
                {f.nota && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{f.nota}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Seguradora não multiplica agravos assim — ela soma pontos de mortalidade. Isto serve
            para preparar o cliente para um prêmio acima da faixa, não para prever o número.
          </p>
        </div>
      )}

      {/* Restrições — o pior tipo de surpresa */}
      {analise.restricoes.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700">
            <AlertTriangle size={12} /> Pode NÃO estar coberto — diga isso na reunião
          </p>
          <ul className="mt-2 space-y-2">
            {analise.restricoes.map((r) => (
              <li key={r.id} className="text-sm leading-relaxed text-red-900">
                <strong>{r.rotulo}:</strong> {r.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Perguntas que a análise vai fazer */}
      {analise.perguntar.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <CircleHelp size={12} /> Pergunte antes que a análise pergunte
          </p>
          <ul className="mt-2 space-y-1">
            {analise.perguntar.map((p) => (
              <li key={p.id} className="text-sm text-slate-600">
                <strong className="text-slate-700">{p.rotulo}:</strong> {p.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Entradas ─────────────────────────────────────────────────────── */}
      <div className="mt-4 border-t border-slate-200/70 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          O que muda a análise
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Campo label="Altura (cm)" dica="Com o peso, forma o IMC — que a seguradora calcula sozinha">
            <Input type="number" min="100" max="250" value={plano.altura_cm ?? ''}
              onChange={(e) => setValor('altura_cm', e.target.value)} />
          </Campo>
          <Campo label="Peso (kg)">
            <Input type="number" min="20" max="400" step="0.1" value={plano.peso_kg ?? ''}
              onChange={(e) => setValor('peso_kg', e.target.value)} />
          </Campo>
          <div className="flex items-end pb-1">
            {analise.imc ? (
              <p className={`text-sm ${analise.imc.faixa === 'normal' ? 'text-emerald-700' : 'text-amber-800'}`}>
                IMC <strong>{String(analise.imc.imc).replace('.', ',')}</strong>
                {analise.imc.faixa === 'normal' && ' — faixa tranquila para subscrição'}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Preencha os dois para o sistema calcular o IMC.</p>
            )}
          </div>
        </div>

        <p className="mb-1.5 mt-3 text-xs text-slate-400">
          Atividades de risco — mudam o agravo e podem excluir a cobertura de acidente durante a
          prática. Perguntar agora evita a surpresa depois.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ATIVIDADES_RISCO.map((a) => {
            const ativo = atividades.includes(a.id)
            return (
              <button key={a.id} type="button" onClick={() => alternar(a.id)} title={a.nota}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  ativo ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-laranja-300 hover:text-laranja-700'}`}>
                {ativo ? '✓ ' : '+ '}{a.rotulo}
              </button>
            )
          })}
        </div>

        <div className="mt-3">
          <Campo label="Condições de saúde declaradas"
            dica="Texto livre — não entra em conta nenhuma, serve para antecipar o que a análise vai pedir">
            <Textarea rows={2} value={plano.condicoes_declaradas ?? ''}
              onChange={(e) => setPlano({ ...plano, condicoes_declaradas: e.target.value })}
              placeholder="Ex.: hipertensão controlada com medicação, cirurgia de joelho em 2023..." />
          </Campo>
        </div>
      </div>
    </div>
  )
}
