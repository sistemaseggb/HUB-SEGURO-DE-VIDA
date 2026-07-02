import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, ShieldCheck, Heart, Landmark, GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto } from '../lib/format'
import { Spinner, Button } from '../components/ui'

// Gerador de proposta: transforma o planejamento em uma apresentação limpa
// para a Natália abrir em tela cheia na reunião ou salvar em PDF (imprimir).
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

  const primeiroNome = cliente.nome.split(' ')[0]
  const capital = Number(plano.capital_sugerido ?? 0)
  const custoAnual = Number(plano.custo_vida_mensal ?? 0) * 12
  // Meses de padrão de vida garantidos pelo capital que sobra após quitar dívidas
  const rendaProtegida = plano.custo_vida_mensal
    ? Math.round((capital - Number(plano.dividas_total ?? 0)) / Number(plano.custo_vida_mensal))
    : null

  return (
    <div className="proposta">
      {/* barra de ações — some na impressão */}
      <div className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between bg-slate-900 px-4 py-2 print:hidden">
        <Link to={`/clientes/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
          <ArrowLeft size={15} /> Voltar ao cliente
        </Link>
        <Button onClick={() => window.print()}><Printer size={15} /> Salvar em PDF / Imprimir</Button>
      </div>

      {/* CAPA */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-8 text-center text-white print:min-h-0 print:py-24">
        <div className="rounded-2xl bg-blue-600 p-4"><ShieldCheck size={40} /></div>
        <p className="mt-8 text-sm uppercase tracking-[0.3em] text-blue-300">Planejamento de proteção</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Um plano feito para a vida de <span className="text-blue-400">{primeiroNome}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-slate-300">
          {plano.objetivos || 'Proteção financeira desenhada sob medida para o que importa para você.'}
        </p>
        <p className="mt-12 text-sm text-slate-400">Natália Maschendorf · Consultoria de Seguro de Vida e Blindagem Patrimonial</p>
      </section>

      {/* O NÚMERO */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center print:min-h-0 print:py-24">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">A proteção recomendada</p>
        <p className="mt-6 text-6xl font-bold text-slate-900 md:text-7xl">{brlCompacto(capital)}</p>
        <p className="mt-2 text-xl text-slate-500">{brl(capital)}</p>
        {rendaProtegida && (
          <p className="mt-8 max-w-lg text-lg text-slate-600">
            Isso garante o padrão de vida da sua família por{' '}
            <strong className="text-slate-900">{rendaProtegida} meses</strong>
            {' '}({plano.anos_protecao} anos de proteção planejada)
            {Number(plano.dividas_total) > 0 && ', já quitando todas as dívidas'}
            .
          </p>
        )}
      </section>

      {/* OS PILARES */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 print:min-h-0 print:py-24">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Por que esse número</p>
        <div className="mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
          <Pilar icone={Heart} titulo="Padrão de vida"
            valor={brlCompacto(custoAnual * Number(plano.anos_protecao ?? 10))}
            texto={`${brl(plano.custo_vida_mensal)} por mês, protegidos por ${plano.anos_protecao} anos.`} />
          <Pilar icone={Landmark} titulo="Dívidas zeradas"
            valor={brlCompacto(plano.dividas_total ?? 0)}
            texto="Nenhum compromisso financeiro fica para a família." />
          <Pilar icone={GraduationCap} titulo="Futuro garantido"
            valor={plano.num_dependentes > 0 ? `${plano.num_dependentes} dependente(s)` : 'Você no controle'}
            texto={plano.num_dependentes > 0
              ? 'Educação e projetos de quem depende de você, assegurados.'
              : 'Liberdade para seus projetos de longo prazo.'} />
        </div>
      </section>

      {/* FECHAMENTO */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-8 text-center text-white print:min-h-0 print:py-24">
        <h2 className="max-w-2xl text-3xl font-bold leading-snug md:text-4xl">
          O melhor dia para proteger sua família foi ontem.<br />
          <span className="text-blue-400">O segundo melhor é hoje.</span>
        </h2>
        <p className="mt-8 text-slate-300">Vamos ativar seu plano, {primeiroNome}?</p>
        <p className="mt-12 text-sm text-slate-500">
          Valores sujeitos à análise da seguradora. Proposta elaborada por Natália Maschendorf.
        </p>
      </section>
    </div>
  )
}

function Pilar({ icone: Icone, titulo, valor, texto }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto w-fit rounded-xl bg-blue-50 p-3 text-blue-600"><Icone size={26} /></div>
      <h3 className="mt-4 font-semibold text-slate-900">{titulo}</h3>
      <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
      <p className="mt-2 text-sm text-slate-500">{texto}</p>
    </div>
  )
}
