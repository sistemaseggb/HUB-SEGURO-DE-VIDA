import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Printer, Heart, Landmark, GraduationCap, Activity,
  Stethoscope, CalendarClock, Scale, ClipboardCheck, Search, FileSignature, Handshake,
  Hourglass, Coffee,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto } from '../lib/format'
import { calcularEstudo, IDADE_INDEPENDENCIA } from '../lib/estudo'
import { Spinner, Button } from '../components/ui'

import Logo from '../components/Logo'

// Gerador de proposta: transforma o estudo por pilares numa apresentação de
// tela cheia para a reunião (ou PDF pela impressão — cada slide vira uma
// página A4 paisagem, com cores preservadas). Slides:
// capa → diagnóstico → autonomia → o número → futuro dos filhos → 5 pilares →
// blindagem patrimonial → gap de cobertura → investimento → passos → fechamento.
export default function Proposta() {
  const { id } = useParams()
  const [dados, setDados] = useState(null)
  const [slideAtual, setSlideAtual] = useState(0)
  const [totalSlides, setTotalSlides] = useState(0)

  // Navegação de apresentação: setas/PageUp-Down/espaço avançam os slides;
  // as bolinhas laterais mostram onde está e pulam direto ao clicar.
  useEffect(() => {
    const slides = () => [...document.querySelectorAll('.proposta section')]
    setTotalSlides(slides().length)
    function atual() {
      const y = window.scrollY + window.innerHeight / 2
      return Math.max(slides().findLastIndex((s) => s.offsetTop <= y), 0)
    }
    function irPara(i) {
      const alvo = slides()[Math.max(0, Math.min(i, slides().length - 1))]
      alvo?.scrollIntoView({ behavior: 'smooth' })
    }
    function onKey(e) {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); irPara(atual() + 1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); irPara(atual() - 1) }
    }
    function onScroll() { setSlideAtual(atual()) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll) }
  }, [dados])

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
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 sm:block">
            slide {slideAtual + 1} de {totalSlides} · use as setas ← →
          </span>
          <Button variant="gold" onClick={() => window.print()}><Printer size={15} /> Salvar em PDF / Imprimir</Button>
        </div>
      </div>

      {/* bolinhas de navegação (somem na impressão) */}
      <div className="fixed right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 print:hidden">
        {[...Array(totalSlides)].map((_, i) => (
          <button key={i} aria-label={`Ir ao slide ${i + 1}`}
            onClick={() => document.querySelectorAll('.proposta section')[i]?.scrollIntoView({ behavior: 'smooth' })}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              i === slideAtual ? 'scale-125 bg-laranja-500' : 'bg-slate-400/40 hover:bg-slate-400/70'}`} />
        ))}
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
        {(e.filhos.length > 0 || plano.filhos_idades) && (
          <p className="mt-6 text-slate-500">
            Filhos: {e.filhos.length > 0
              ? e.filhos.map((f) => `${f.nome || 'filho(a)'}${f.idade != null ? ` (${f.idade})` : ''}`).join(' · ')
              : plano.filhos_idades}
          </p>
        )}
        <p className="mt-10 max-w-xl text-center text-lg text-slate-600">
          Tudo isso depende de uma única coisa continuar existindo: <strong className="text-slate-900">a sua capacidade de gerar renda</strong>.
        </p>
      </section>

      {/* 3 · QUANTO TEMPO — a pergunta que abre os olhos */}
      {e.autonomiaAtualMeses != null && e.mesesProtegidos > 0 && (
        <section className="flex min-h-screen flex-col items-center justify-center bg-white p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>A pergunta central</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            Se a renda parasse hoje, por quanto tempo a família manteria o padrão de vida?
          </h2>
          <div className="mt-12 grid w-full max-w-3xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-red-100 bg-red-50/60 p-8 text-center">
              <Hourglass size={26} className="mx-auto text-red-400" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-500">Hoje, sem o plano</p>
              <p className="mt-2 font-display text-5xl font-semibold tabular text-red-600">
                {e.autonomiaAtualMeses >= 1200 ? '∞' : e.autonomiaAtualMeses}
              </p>
              <p className="mt-1 text-sm text-red-800/70">
                {e.autonomiaAtualMeses === 1 ? 'mês' : 'meses'} — <strong>consumindo o patrimônio
                que você construiu</strong>, até acabar
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-8 text-center">
              <Heart size={26} className="mx-auto text-emerald-500" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-600">Com o plano</p>
              <p className="mt-2 font-display text-5xl font-semibold tabular text-emerald-600">
                {e.autonomiaAtualMeses + e.mesesProtegidos >= 1200 ? '∞' : e.autonomiaAtualMeses + e.mesesProtegidos}
              </p>
              <p className="mt-1 text-sm text-emerald-900/70">
                meses — o seguro sustenta a família <strong>e o patrimônio fica preservado</strong>
              </p>
            </div>
          </div>
          <p className="mt-10 max-w-lg text-center text-lg text-slate-600">
            O plano não substitui o que você construiu — <strong className="text-slate-900">ele impede que seja consumido</strong>.
          </p>
        </section>
      )}

      {/* 4 · O NÚMERO */}
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
        {e.capitalFilhos > 0 && (
          <p className="mt-3 max-w-lg text-sm text-slate-400">
            Já inclui {brlCompacto(e.capitalFilhos)} reservados para os filhos — calculados
            até cada um completar {IDADE_INDEPENDENCIA} anos, e nem um dia a mais.
          </p>
        )}
      </section>

      {/* 5 · O FUTURO DOS FILHOS — o gasto de hoje tem data para acabar */}
      {e.filhos.some((f) => f.custoMensal > 0) && (
        <section className="flex min-h-screen flex-col items-center justify-center bg-white p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>O futuro dos filhos</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            Cada filho protegido até os {IDADE_INDEPENDENCIA} anos — nem um dia a menos
          </h2>
          <div className={`mt-10 grid w-full max-w-4xl gap-5 ${e.filhos.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {e.filhos.map((f, i) => (
              <div key={i} className="rounded-2xl border border-slate-200/70 bg-white p-7 text-center shadow-card">
                <div className="mx-auto w-fit rounded-2xl bg-laranja-50 p-3.5 text-laranja-600"><GraduationCap size={26} /></div>
                <h3 className="mt-4 font-semibold text-slate-900">
                  {f.nome || 'Filho(a)'}{f.idade != null && <span className="font-normal text-slate-400"> · {f.idade} anos</span>}
                </h3>
                {f.custoMensal > 0 && (
                  <p className="mt-2 font-display text-2xl font-semibold tabular text-slate-900">{brl(f.custoMensal)}<span className="text-sm font-normal text-slate-400">/mês</span></p>
                )}
                <p className="mt-2 text-sm text-slate-500">
                  {f.anosRestantes > 0
                    ? <>garantido por <strong className="text-slate-700">{f.anosRestantes} anos</strong>, até os {IDADE_INDEPENDENCIA} — {brlCompacto(f.capitalAte24)} reservados no plano</>
                    : <>já alcançou a independência — não entra no capital</>}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-xl text-center text-lg text-slate-600">
            Esse gasto tem prazo: quando cada um completa {IDADE_INDEPENDENCIA}, ele sai da conta.
            O plano reserva <strong className="text-slate-900">{brlCompacto(e.capitalFilhos)}</strong> — exatamente
            o necessário, <strong className="text-slate-900">nem um real a mais</strong>.
          </p>
        </section>
      )}

      {/* 6 · OS PILARES */}
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

      {/* 7 · BLINDAGEM PATRIMONIAL — o custo do inventário */}
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

      {/* 8 · O GAP — quanto falta */}
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

      {/* 9 · O INVESTIMENTO — quando há cotação, o fechamento fala de valor */}
      {e.investimento && (
        <section className="flex min-h-screen flex-col items-center justify-center bg-white p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>O investimento</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Quanto custa proteger tudo isso?
          </h2>
          <p className="mt-8 font-display text-6xl font-semibold tracking-tight text-slate-900 tabular md:text-7xl">
            {brl(e.investimento.mensal)}<span className="text-2xl font-normal text-slate-400">/mês</span>
          </p>
          <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card">
              <Coffee size={22} className="mx-auto text-laranja-600" />
              <p className="mt-2 font-display text-2xl font-semibold tabular text-slate-900">{brl(e.investimento.diario)}</p>
              <p className="mt-1 text-sm text-slate-500">por dia — menos que um café com pão de queijo</p>
            </div>
            {e.investimento.pctRenda != null && (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card">
                <Scale size={22} className="mx-auto text-laranja-600" />
                <p className="mt-2 font-display text-2xl font-semibold tabular text-slate-900">{String(e.investimento.pctRenda).replace('.', ',')}%</p>
                <p className="mt-1 text-sm text-slate-500">da renda mensal — o resto continua livre</p>
              </div>
            )}
            {e.investimento.alavancagem != null && (
              <div className="rounded-2xl border border-laranja-200/70 bg-laranja-50/50 p-6 text-center shadow-card">
                <Heart size={22} className="mx-auto text-laranja-600" />
                <p className="mt-2 font-display text-2xl font-semibold tabular text-slate-900">R$ 1 → R$ {e.investimento.alavancagem.toLocaleString('pt-BR')}</p>
                <p className="mt-1 text-sm text-slate-500">cada real investido protege {e.investimento.alavancagem.toLocaleString('pt-BR')} reais</p>
              </div>
            )}
          </div>
          <p className="mt-10 max-w-lg text-center text-sm text-slate-400">
            Valor de referência cotado nas seguradoras para o plano completo — sujeito à análise da proposta.
          </p>
        </section>
      )}

      {/* 10 · PRÓXIMOS PASSOS */}
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

      {/* 11 · FECHAMENTO */}
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
