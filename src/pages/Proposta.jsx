import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Printer, Heart, Landmark, GraduationCap, Activity,
  Stethoscope, CalendarClock, Scale, ClipboardCheck, Search, FileSignature, Handshake,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto } from '../lib/format'
import { calcularEstudo } from '../lib/estudo'
import { Spinner, Button } from '../components/ui'

import Logo from '../components/Logo'

// Gerador de proposta: transforma o estudo por pilares numa apresentação de
// tela cheia para a reunião (ou PDF pela impressão). Slides:
// capa → diagnóstico → o número → 5 pilares → blindagem patrimonial →
// gap de cobertura → próximos passos → fechamento.
export default function Proposta() {
  const { id } = useParams()
  const [dados, setDados] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('planejamentos').select('*').eq('id_cliente', id).maybeSingle(),
    ]).then(([c, p]) => setDados({ cliente: c.data, plano: p.data }))
  }, [id])

  if (!dados) return <Spinner />
  const { cliente, plano } = dados

  if (!plano) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Preencha o planejamento do cliente antes de gerar a proposta.</p>
        <Link to={`/clientes/${id}`} className="mt-3 inline-block text-blue-600 hover:underline">← Voltar ao cliente</Link>
      </div>
    )
  }

  const e = calcularEstudo(plano)
  const primeiroNome = cliente.nome.split(' ')[0]
  const tem014 = 'capital_invalidez' in plano
  const temPatrimonio = e.patrimonio > 0
  const temGap = tem014 && e.coberturaAtual > 0

  const rotuloSecao = 'text-sm font-medium uppercase tracking-[0.3em] text-gold-500'

  return (
    <div className="proposta">
      {/* barra de ações — some na impressão */}
      <div className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between bg-slate-900/95 px-4 py-2.5 backdrop-blur print:hidden">
        <Link to={`/clientes/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
          <ArrowLeft size={15} /> Voltar ao cliente
        </Link>
        <Button variant="gold" onClick={() => window.print()}><Printer size={15} /> Salvar em PDF / Imprimir</Button>
      </div>

      {/* 1 · CAPA */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-slate-900 p-8 text-center text-white print:min-h-0 print:py-24">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-laranja-500/10 blur-3xl print:hidden" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl print:hidden" />
        <div className="relative"><Logo claro tamanho={64} /></div>
        <p className="relative mt-10 text-sm font-medium uppercase tracking-[0.3em] text-gold-400">Estudo de proteção e blindagem patrimonial</p>
        <h1 className="relative mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Um plano feito para a vida de <span className="text-laranja-400">{primeiroNome}</span>
        </h1>
        <p className="relative mt-6 max-w-xl text-lg text-white/70">
          {plano.objetivos || 'Proteção financeira desenhada sob medida para o que importa para você.'}
        </p>
        <p className="relative mt-12 text-sm text-white/50">
          Natália Maschendorf · Consultoria de Seguro de Vida e Blindagem Patrimonial · {new Date().toLocaleDateString('pt-BR')}
        </p>
      </section>

      {/* 2 · DIAGNÓSTICO — onde você está hoje */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-white p-8 print:min-h-0 print:py-24">
        <p className={rotuloSecao}>O ponto de partida</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">A vida de {primeiroNome} hoje</h2>
        <div className="mt-10 grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
          <Dado rotulo="Renda mensal" valor={e.renda > 0 ? brl(e.renda) : '—'} />
          <Dado rotulo="Custo de vida" valor={e.custoVida > 0 ? `${brl(e.custoVida)}/mês` : '—'} />
          <Dado rotulo="Patrimônio construído" valor={temPatrimonio ? brlCompacto(e.patrimonio) : '—'} />
          <Dado rotulo="Dívidas e compromissos" valor={e.dividas > 0 ? brlCompacto(e.dividas) : 'Nenhuma'} />
          <Dado rotulo="Família" valor={[
            plano.conjuge_nome ? `cônjuge ${plano.conjuge_nome.split(' ')[0]}` : null,
            plano.num_dependentes > 0 ? `${plano.num_dependentes} dependente(s)` : null,
          ].filter(Boolean).join(' · ') || (plano.estado_civil || '—')} />
          <Dado rotulo="Proteção que já existe" valor={tem014 && e.coberturaAtual > 0 ? brlCompacto(e.coberturaAtual) : 'Nenhuma'}
            destaque={!(tem014 && e.coberturaAtual > 0)} />
        </div>
        {plano.filhos_idades && (
          <p className="mt-6 text-slate-500">Filhos: {plano.filhos_idades}</p>
        )}
        <p className="mt-10 max-w-xl text-center text-lg text-slate-600">
          Tudo isso depende de uma única coisa continuar existindo: <strong className="text-slate-900">a sua capacidade de gerar renda</strong>.
        </p>
      </section>

      {/* 3 · O NÚMERO */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-canvas p-8 text-center print:min-h-0 print:py-24">
        <p className={rotuloSecao}>A proteção recomendada</p>
        <p className="mt-6 font-display text-6xl font-semibold tracking-tight text-slate-900 tabular md:text-8xl">{brlCompacto(e.valores.morte)}</p>
        <p className="mt-3 text-xl text-slate-400 tabular">{brl(e.valores.morte)}</p>
        {e.mesesProtegidos > 0 && (
          <p className="mt-8 max-w-lg text-lg text-slate-600">
            Garante o padrão de vida da família por{' '}
            <strong className="font-semibold text-slate-900">{e.mesesProtegidos} meses</strong>
            {' '}({e.anos} anos de proteção planejada)
            {e.dividas > 0 && ', já quitando todas as dívidas'}.
          </p>
        )}
      </section>

      {/* 4 · OS PILARES */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-white p-8 print:min-h-0 print:py-24">
        <p className={rotuloSecao}>As camadas da proteção</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Um plano, {tem014 ? 'cinco' : 'três'} proteções</h2>
        <div className="mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
          <Pilar icone={Heart} titulo="Proteção da família"
            valor={brlCompacto(e.valores.morte)}
            texto={e.custoVida > 0
              ? `${brl(e.custoVida)} por mês, protegidos por ${e.anos} anos${e.dividas > 0 ? ', com as dívidas zeradas' : ''}.`
              : 'O padrão de vida de quem depende de você, garantido.'} />
          {tem014 ? (
            <>
              <Pilar icone={Activity} titulo="Invalidez permanente"
                valor={brlCompacto(e.valores.invalidez)}
                texto="Se um acidente ou doença impedir de trabalhar, a renda não para." />
              <Pilar icone={Stethoscope} titulo="Doenças graves"
                valor={brlCompacto(e.valores.doencas_graves)}
                texto="Dinheiro em vida no diagnóstico — tratamento sem tocar no patrimônio." />
              {e.valores.dit > 0 && (
                <Pilar icone={CalendarClock} titulo="Incapacidade temporária"
                  valor={`${brl(e.valores.dit)}/dia`}
                  texto="Renda diária durante o afastamento. Essencial para quem vive do próprio trabalho." />
              )}
              {e.valores.sucessao > 0 && (
                <Pilar icone={Scale} titulo="Sucessão e inventário"
                  valor={brlCompacto(e.valores.sucessao)}
                  texto="Liquidez imediata para o inventário — o patrimônio não fica travado." />
              )}
            </>
          ) : (
            <>
              <Pilar icone={Landmark} titulo="Dívidas zeradas"
                valor={brlCompacto(e.dividas)}
                texto="Nenhum compromisso financeiro fica para a família." />
              <Pilar icone={GraduationCap} titulo="Futuro garantido"
                valor={plano.num_dependentes > 0 ? `${plano.num_dependentes} dependente(s)` : 'Você no controle'}
                texto={plano.num_dependentes > 0
                  ? 'Educação e projetos de quem depende de você, assegurados.'
                  : 'Liberdade para seus projetos de longo prazo.'} />
            </>
          )}
        </div>
      </section>

      {/* 5 · BLINDAGEM PATRIMONIAL — o custo do inventário */}
      {tem014 && temPatrimonio && (
        <section className="flex min-h-screen flex-col items-center justify-center bg-canvas p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Blindagem patrimonial</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            O inventário custa caro — e só libera os bens depois de pago
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-red-100 bg-red-50/60 p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Sem planejamento</p>
              <p className="mt-3 font-display text-4xl font-semibold text-red-600 tabular">{brlCompacto(e.custoInventario)}</p>
              <p className="mt-2 text-sm text-red-800/80">
                ITCMD ({e.itcmd.toFixed(1).replace('.', ',')}%) + custas e honorários ({e.custas.toFixed(1).replace('.', ',')}%)
                sobre {brlCompacto(e.patrimonio)} — pagos <strong>à vista, em dinheiro</strong>, antes de a família
                acessar qualquer bem. Inventários levam de meses a anos.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Com o seguro</p>
              <p className="mt-3 font-display text-4xl font-semibold text-emerald-600 tabular">{brlCompacto(e.valores.sucessao)}</p>
              <p className="mt-2 text-sm text-emerald-900/80">
                O capital do seguro <strong>não entra em inventário</strong>: é pago direto aos beneficiários,
                em dias, livre de ITCMD na maioria dos estados. É a liquidez que destrava tudo.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 6 · O GAP — quanto falta */}
      {temGap && (
        <section className="flex min-h-screen flex-col items-center justify-center bg-white p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>O que falta</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {e.gap > 0 ? 'A proteção atual não cobre o plano' : 'A proteção atual está no alvo'}
          </h2>
          <div className="mt-12 w-full max-w-2xl space-y-6">
            <Barra rotulo="Você tem hoje" valor={e.coberturaAtual} max={Math.max(e.valores.morte, e.coberturaAtual)} cor="bg-slate-300" />
            <Barra rotulo="O plano recomenda" valor={e.valores.morte} max={Math.max(e.valores.morte, e.coberturaAtual)} cor="bg-laranja-500" />
          </div>
          {e.gap > 0 && (
            <p className="mt-12 text-xl text-slate-600">
              Gap de proteção: <strong className="font-display text-3xl font-semibold text-red-600 tabular">{brlCompacto(e.gap)}</strong>
            </p>
          )}
        </section>
      )}

      {/* 7 · PRÓXIMOS PASSOS */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-canvas p-8 print:min-h-0 print:py-24">
        <p className={rotuloSecao}>Como ativamos o plano</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Quatro passos simples</h2>
        <div className="mt-10 grid max-w-4xl gap-5 md:grid-cols-4">
          <Passo n={1} icone={ClipboardCheck} titulo="Declaração de saúde"
            texto="Você responde a DPS pelo link que eu envio — leva poucos minutos." />
          <Passo n={2} icone={Search} titulo="Análise da seguradora"
            texto="A seguradora avalia o perfil e confirma as condições." />
          <Passo n={3} icone={FileSignature} titulo="Emissão da apólice"
            texto="Assinatura digital e proteção ativa desde o primeiro pagamento." />
          <Passo n={4} icone={Handshake} titulo="Acompanhamento"
            texto="Revisão anual do plano — a proteção acompanha a sua vida." />
        </div>
      </section>

      {/* 8 · FECHAMENTO */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-slate-900 p-8 text-center text-white print:min-h-0 print:py-24">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold-400/10 blur-3xl print:hidden" />
        <div className="relative mb-10"><Logo claro tamanho={52} /></div>
        <h2 className="relative max-w-2xl text-3xl font-semibold leading-snug tracking-tight md:text-4xl">
          O melhor dia para proteger sua família foi ontem.<br />
          <span className="text-gold-400">O segundo melhor é hoje.</span>
        </h2>
        <p className="relative mt-8 text-lg text-white/80">Vamos ativar seu plano, {primeiroNome}?</p>
        <p className="relative mt-12 text-sm text-white/50">
          Valores sujeitos à análise da seguradora. Estudo elaborado por Natália Maschendorf em {new Date().toLocaleDateString('pt-BR')}.
        </p>
      </section>
    </div>
  )
}

function Barra({ rotulo, valor, max, cor }) {
  const pct = max > 0 ? Math.max((valor / max) * 100, 2) : 2
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-600">{rotulo}</span>
        <span className="font-display text-lg font-semibold text-slate-900 tabular">{brlCompacto(valor)}</span>
      </div>
      <div className="h-5 rounded-full bg-slate-100">
        <div className={`h-5 rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Dado({ rotulo, valor, destaque }) {
  return (
    <div className={`rounded-2xl border p-5 text-left ${destaque ? 'border-gold-400/40 bg-gold-400/5' : 'border-slate-200/70 bg-white shadow-card'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className="mt-1.5 font-display text-xl font-semibold text-slate-900 tabular">{valor}</p>
    </div>
  )
}

function Pilar({ icone: Icone, titulo, valor, texto }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card">
      <div className="mx-auto w-fit rounded-2xl bg-laranja-50 p-3.5 text-laranja-600"><Icone size={26} /></div>
      <h3 className="mt-4 font-semibold text-slate-900">{titulo}</h3>
      <p className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular">{valor}</p>
      <p className="mt-2 text-sm text-slate-500">{texto}</p>
    </div>
  )
}

function Passo({ n, icone: Icone, titulo, texto }) {
  return (
    <div className="relative rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card">
      <span className="absolute -top-3 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-gold-400 font-display text-sm font-bold text-slate-900">{n}</span>
      <div className="mx-auto mt-2 w-fit rounded-2xl bg-laranja-50 p-3 text-laranja-600"><Icone size={22} /></div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{titulo}</h3>
      <p className="mt-1.5 text-xs text-slate-500">{texto}</p>
    </div>
  )
}
