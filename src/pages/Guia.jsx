import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap, PhoneCall, CalendarDays, ListChecks, ChartPie, Presentation,
  FileSignature, HeartHandshake, ChevronDown, Sparkles, Lightbulb, Calculator,
  Users, KanbanSquare, Upload, MessageSquareText, BarChart3, Settings, ArrowRight,
  LayoutDashboard, Trophy, AlertTriangle, ShieldCheck, Stethoscope, Keyboard,
  MessageCircleQuestion, Equal, Plus, XCircle, CheckCircle2, Compass, TriangleAlert,
} from 'lucide-react'
import { PageHeader, Card, Badge } from '../components/ui'
import {
  CLIENTE_EXEMPLO, estudoDoExemplo, diagnosticoDoExemplo, estudoIncompleto,
  diagnosticoIncompleto, objecoesDoExemplo, parcelasDoCapitalDeMorte,
  TRAVAS_DO_MOTOR, ERROS_CAROS, moeda,
} from '../lib/tutorial'
import { IDADE_INDEPENDENCIA } from '../lib/estudo'

// ─────────────────────────────────────────────────────────────────────────────
// O GUIA — e a diferença entre saber onde clicar e saber defender o número.
//
// A versão anterior deste arquivo ensinava a NAVEGAÇÃO: a jornada em sete
// etapas, o que cada módulo faz, cinco dicas. Estava certa e resolvia a
// primeira semana. Só que "usar o Hub da melhor forma" não é achar a tela — é
// sustentar o que a tela diz quando o cliente pergunta "de onde saiu esse
// número?". Essa pergunta acontece em toda reunião, e o guia não respondia
// nenhuma vez.
//
// Então este guia ensina o RACIOCÍNIO do sistema, e faz isso com o motor
// ligado: Carlos é um cliente fictício em `src/lib/tutorial.js`, e cada número
// que aparece aqui sai de `calcularEstudo()` e `diagnosticar()` — as mesmas
// funções que atendem a aba Planejamento.
//
// Duas consequências que valem o desenho:
//
//   · O GUIA NÃO ENVELHECE. Mudou uma regra do motor, mudou o exemplo, no
//     mesmo instante. Um manual escrito à mão continuaria ensinando a conta
//     antiga com toda a confiança de quem foi escrito uma vez.
//
//   · O GUIA NÃO PODE MENTIR. `scripts/teste-tutorial.mjs` confere que as
//     AFIRMAÇÕES daqui continuam verdadeiras no motor — que as três parcelas
//     ainda somam o capital de morte, que a invalidez ainda acompanha a morte
//     quando há dependentes. Se alguém mudar o motor de um jeito que desminta
//     o guia, o teste quebra em vez de a consultora descobrir na reunião.
//
// A ordem das seções é a ordem em que as dúvidas aparecem de verdade: por onde
// começo → o que faço → de onde saiu esse número → o sistema está me avisando
// de algo → o cliente disse isso → o que posso prometer → como ir mais rápido.
// ─────────────────────────────────────────────────────────────────────────────

// ─── O índice ────────────────────────────────────────────────────────────────
// O guia é longo de propósito: é material de estudo, não cartão de referência.
// Longo sem índice, porém, é longo e inútil — e as âncoras moram na URL, como
// todo lugar navegável deste sistema, para o link colado no WhatsApp abrir na
// seção exata.
const SECOES = [
  { id: 'trilha', rotulo: 'Por onde começar', icone: Compass },
  { id: 'jornada', rotulo: 'As 7 etapas', icone: ListChecks },
  { id: 'numeros', rotulo: 'De onde saiu esse número', icone: Calculator },
  { id: 'conferencia', rotulo: 'A conferência', icone: AlertTriangle },
  { id: 'diagnostico', rotulo: 'O diagnóstico', icone: Stethoscope },
  { id: 'reuniao', rotulo: 'Quando o cliente resiste', icone: MessageCircleQuestion },
  { id: 'prometer', rotulo: 'O que dá para prometer', icone: ShieldCheck },
  { id: 'modulos', rotulo: 'Cada módulo', icone: LayoutDashboard },
  { id: 'velocidade', rotulo: 'Trabalhar rápido', icone: Keyboard },
  { id: 'erros', rotulo: 'Erros que custam caro', icone: TriangleAlert },
]

// ─── A trilha de aprendizado ─────────────────────────────────────────────────
// Ninguém aprende um sistema inteiro num dia, e tentar é o jeito mais rápido
// de não aprender nenhum pedaço. Três níveis, com um critério de "já sei este"
// que ela consegue conferir sozinha.
const TRILHA = [
  {
    nivel: 'Primeira semana',
    meta: 'Trabalhar 100% dentro do Hub, sem planilha paralela',
    tom: 'blue',
    passos: [
      'Cadastre (ou importe) todos os clientes ativos e ligue cada um ao assessor.',
      'Comece todo dia pela Central do Dia no Dashboard — ela já sabe o que é urgente.',
      'Registre TODA conversa em Interações, mesmo a ligação de dois minutos.',
      'Agende as reuniões dentro do Hub, não no calendário separado.',
    ],
    sei: 'Você abre o sistema de manhã e ele te diz o que fazer — em vez de você lembrar.',
  },
  {
    nivel: 'Primeiro mês',
    meta: 'Montar o estudo AO VIVO, com o cliente vendo',
    tom: 'yellow',
    passos: [
      'Conduza a reunião pela aba Roteiro, bloco a bloco, anotando ali mesmo.',
      'Preencha o Planejamento durante a call — patrimônio por classe, não só o total.',
      'Antes de gerar a proposta, zere os avisos GRAVES da conferência.',
      'Apresente pela tela cheia e mande o link para ele rever com a família.',
    ],
    sei: 'Você termina a reunião com o estudo pronto, não com anotações para passar a limpo.',
  },
  {
    nivel: 'Domínio',
    meta: 'Defender cada número e antecipar cada objeção',
    tom: 'green',
    passos: [
      'Saiba explicar de cabeça as três parcelas do capital de morte (veja abaixo).',
      'Leia o Diagnóstico antes da reunião: perfil, recomendações e o que falta perguntar.',
      'Abra as Objeções previstas e escolha a pergunta que você vai devolver.',
      'Confira a Subscrição antes de combinar qualquer prazo de emissão.',
    ],
    sei: 'O cliente pergunta "de onde saiu isso?" e você responde sem abrir o sistema.',
  },
]

// ─── A jornada ───────────────────────────────────────────────────────────────
// Mantida da versão anterior porque estava certa, com uma coluna nova: o erro
// que se comete em cada etapa. Saber o passo não é o mesmo que saber a
// armadilha do passo.
const JORNADA = [
  {
    n: 1, icone: PhoneCall, cor: 'text-blue-600 bg-blue-50',
    titulo: 'Capte e organize o lead', onde: 'Clientes · Pipeline', para: '/clientes',
    o_que: 'Cadastre o lead (ou importe a base inteira) e ligue-o a um assessor. Ele entra no funil como "Lead Recebido".',
    erro: 'Deixar sem assessor. O assessor define a divisão da comissão — sem ele, o fechamento sai errado e o GB Awards não conta a apólice para ninguém.',
  },
  {
    n: 2, icone: CalendarDays, cor: 'text-violet-600 bg-violet-50',
    titulo: 'Agende a reunião', onde: 'Agenda', para: '/agenda',
    o_que: 'Marque data e hora. O cliente avança sozinho para "Agendamento" e entra na fila do lembrete de confirmação.',
    erro: 'Agendar fora do Hub. O lembrete de confirmação da véspera só nasce se a reunião existir aqui.',
  },
  {
    n: 3, icone: ListChecks, cor: 'text-laranja-600 bg-laranja-50',
    titulo: 'Conduza pela aba Roteiro', onde: 'Cliente · Roteiro', para: '/clientes',
    o_que: 'Siga os seis blocos (abertura → descoberta → consciência → educação → solução → fechamento) e anote o que ele diz em cada um.',
    erro: 'Pular a descoberta para chegar logo ao produto. É na descoberta que saem os números que dão peso à apresentação — sem eles o estudo vira tabela genérica.',
  },
  {
    n: 4, icone: ChartPie, cor: 'text-emerald-600 bg-emerald-50',
    titulo: 'Monte o planejamento', onde: 'Cliente · Planejamento', para: '/clientes',
    o_que: 'Renda, custo de vida, dívidas, filhos e cada classe do patrimônio. O sistema calcula as coberturas, o custo do inventário e o déficit de liquidez.',
    erro: 'Informar só o patrimônio TOTAL. Sem a composição por classe o estudo não separa o que trava do que é líquido — e o capítulo de sucessão perde o argumento principal.',
  },
  {
    n: 5, icone: Presentation, cor: 'text-blue-600 bg-blue-50',
    titulo: 'Apresente a proposta', onde: 'Cliente · Gerar proposta', para: '/clientes',
    o_que: 'Tela cheia, capítulo a capítulo, na ordem montada para o público DESTE cliente. Ao final, mande o link ou salve em PDF.',
    erro: 'Apresentar com a conferência acesa. Um aviso grave ignorado vira um número que não se sustenta quando o contador da família perguntar.',
  },
  {
    n: 6, icone: FileSignature, cor: 'text-amber-600 bg-amber-50',
    titulo: 'Feche a venda e a DPS', onde: 'Cliente · Formulário e Apólices', para: '/clientes',
    o_que: 'Mande o link da DPS, registre a venda em Apólices. A comissão se divide sozinha e o pós-venda é agendado.',
    erro: 'Combinar prazo de emissão de cabeça. Abra a Subscrição: ela diz o que a seguradora vai exigir neste capital e nesta idade.',
  },
  {
    n: 7, icone: HeartHandshake, cor: 'text-rose-600 bg-rose-50',
    titulo: 'Cuide no pós-venda', onde: 'Pós-Venda · Mensagens', para: '/pos-venda',
    o_que: 'Régua de relacionamento, aniversários e clientes esquecidos. As mensagens são escritas sozinhas — você revisa e envia.',
    erro: 'Sumir depois da emissão. Renovação e indicação nascem do relacionamento, e é no pós-venda que a carteira cresce sem prospecção nova.',
  },
]

const MODULOS = [
  {
    icone: LayoutDashboard, nome: 'Dashboard',
    resumo: 'O que fazer hoje, as metas do mês e a saúde do negócio.',
    itens: [
      'A Central do Dia lista tarefas, aniversários e leads parados — comece o dia por aqui.',
      'O Foco de Hoje ordena os leads pelo score de prioridade que o banco calcula sozinho.',
      'As barras de meta mostram o quanto falta para bater o mês.',
    ],
  },
  {
    icone: KanbanSquare, nome: 'Pipeline',
    resumo: 'O funil visual. Arraste o cliente de uma etapa para a outra.',
    itens: [
      'Cada coluna soma o capital em estudo — quanto negócio está parado ali.',
      'Cards amarelos e vermelhos avisam quem está parado tempo demais.',
      'Arrastar para "Perdido" pede o motivo, e é isso que alimenta seus relatórios.',
    ],
  },
  {
    icone: Users, nome: 'Clientes',
    resumo: 'A ficha 360° de cada pessoa, em treze abas agrupadas pelo momento da consultoria.',
    itens: [
      'A aba mora na URL: F5 no meio da reunião mantém o lugar, e o link abre onde você estava.',
      'A bolinha na aba marca as que já têm conteúdo — dá para ver onde tem coisa sem abrir uma por uma.',
      'O cabeçalho mostra o que o cliente representa: prêmio, capital e comissão.',
    ],
  },
  {
    icone: Upload, nome: 'Importar',
    resumo: 'Traga a base antiga de uma vez: clientes, apólices, comissões e a planilha geral.',
    itens: [
      'Cole a planilha ou envie o arquivo — o sistema reconhece as colunas sozinho.',
      'Sempre mostra a prévia antes de importar, e nunca duplica quem já existe.',
      'Dados importados entram como histórico: não disparam tarefa nem mensagem automática.',
    ],
  },
  {
    icone: MessageSquareText, nome: 'Mensagens',
    resumo: 'As mensagens de relacionamento escritas pelo próprio banco, todo dia às 8h.',
    itens: [
      'Aniversário, aniversário de apólice e reativação de lead parado — texto pronto.',
      'Você revisa e clica: a conversa do WhatsApp abre com a mensagem escrita.',
      'Personalize os textos em Cadastros → Mensagens automáticas.',
    ],
  },
  {
    icone: BarChart3, nome: 'Relatórios',
    resumo: 'O fechamento mensal e as comissões recebidas das seguradoras.',
    itens: [
      'Importe a planilha do mês e veja a quebra por assessor e por seguradora.',
      'Reimportar o mesmo mês substitui, não duplica.',
      'O fechamento para o financeiro sai pronto, conferido centavo a centavo.',
    ],
  },
  {
    icone: Trophy, nome: 'GB Awards',
    resumo: 'O ranking do ano: quem emitiu mais apólices e quem somou mais prêmio.',
    itens: [
      'Sai sozinho da planilha geral — subiu o arquivo do mês, o pódio se move.',
      'Vale a data de EMISSÃO, de 1º de janeiro até novembro (o mês da premiação).',
      'Apólice cancelada não premia, e apólice sem assessor não entra: volta separada para você corrigir.',
    ],
  },
  {
    icone: Settings, nome: 'Cadastros',
    resumo: 'A base de tudo: seguradoras, assessores, divisão de comissão e metas.',
    itens: [
      'Cadastre cada seguradora com o percentual de comissão dela.',
      'A divisão Natália / assessor / escritório precisa somar 100% — o salvar fica bloqueado se não somar.',
      'As metas do mês alimentam as barras do Dashboard.',
    ],
  },
]

// ─── Atalhos ─────────────────────────────────────────────────────────────────
// Existem desde sempre e quase ninguém usa, porque nunca estiveram escritos
// num lugar em que se procura por eles.
const ATALHOS = [
  { tecla: 'Ctrl K', o_que: 'Abre a paleta: acha cliente, tela e ação pelo nome que você usa' },
  { tecla: '?', o_que: 'A lista completa de atalhos, de qualquer tela' },
  { tecla: 'g d', o_que: 'Dashboard' },
  { tecla: 'g p', o_que: 'Pipeline' },
  { tecla: 'g c', o_que: 'Clientes' },
  { tecla: 'g a', o_que: 'Agenda' },
  { tecla: 'g v', o_que: 'Pós-venda' },
  { tecla: 'g m', o_que: 'Mensagens' },
]

const TOM_TRILHA = {
  blue: 'border-blue-200 bg-blue-50/50',
  yellow: 'border-amber-200 bg-amber-50/50',
  green: 'border-emerald-200 bg-emerald-50/50',
}

// Cabeçalho de seção, com a âncora que mora na URL.
function Secao({ id, icone: Icone, titulo, chamada, children }) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-white">
          <Icone size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">{titulo}</h2>
          {chamada && <p className="mt-1 text-sm text-slate-500">{chamada}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

// Uma afirmação que a consultora vai repetir em voz alta. Destacada porque é
// o que ela precisa levar da página.
function Frase({ children }) {
  return (
    <blockquote className="my-4 border-l-[3px] border-laranja-400 bg-laranja-50/40 py-2 pl-4 pr-3 text-sm italic text-slate-700">
      {children}
    </blockquote>
  )
}

export default function Guia() {
  const [aberto, setAberto] = useState(null)

  // O motor de verdade, rodando sobre o cliente do guia. Menos de um décimo de
  // milissegundo por chamada — não há o que memoizar aqui.
  const e = estudoDoExemplo()
  const d = diagnosticoDoExemplo(e)
  const parcelas = parcelasDoCapitalDeMorte(e)
  const objecoes = objecoesDoExemplo(e, d)?.lista?.slice(0, 3) ?? []
  const dIncompleto = diagnosticoIncompleto(estudoIncompleto())
  const graves = e.inconsistencias.filter((i) => i.grave)
  const leves = e.inconsistencias.filter((i) => !i.grave)

  return (
    <div>
      <PageHeader
        titulo="Guia da consultoria"
        subtitulo="Não é onde clicar — é como defender cada número que o sistema mostra." />

      {/* ── Abertura: o que este guia é ─────────────────────────────────── */}
      <Card className="risco-marca mb-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1.5fr_1fr] md:p-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-laranja-50 px-3 py-1 text-xs font-semibold text-laranja-700">
              <Sparkles size={13} /> O guia calcula os próprios exemplos
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              A pergunta que decide a reunião é <span className="italic">“de onde saiu esse número?”</span>
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Achar a tela é a parte fácil, e você aprende sozinha em dois dias. O que separa
              uma apresentação de uma consultoria é sustentar o número quando o cliente —
              ou o contador dele — pergunta de onde ele veio. Este guia ensina isso.
            </p>
            <p className="mt-3 max-w-2xl text-sm text-slate-500">
              Todo número daqui é calculado <strong className="font-semibold text-slate-700">agora</strong>,
              pelo mesmo motor que atende a aba Planejamento, sobre um cliente de exemplo.
              Nada aqui foi digitado à mão — então nada aqui pode ficar desatualizado em
              relação ao sistema.
            </p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 p-6 text-white">
            <GraduationCap size={26} className="text-laranja-400" />
            <p className="mt-3 font-display text-lg font-semibold">Carlos, o cliente do guia</p>
            <p className="mt-1 text-sm text-white/70">{CLIENTE_EXEMPLO.resumo}</p>
            <p className="mt-3 text-xs text-white/50">
              Ele foi desenhado para acender de uma vez as situações que mais confundem:
              filhos que saem da conta, patrimônio travado no inventário, uma sociedade com
              aval e duas apólices que ele acha que são dele.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Índice ──────────────────────────────────────────────────────── */}
      <nav aria-label="Seções do guia" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          {SECOES.map((s) => {
            const Icone = s.icone
            return (
              <li key={s.id}>
                <a href={`#${s.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-laranja-300 hover:text-laranja-700">
                  <Icone size={13} className="text-laranja-500" /> {s.rotulo}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── 1. Trilha ───────────────────────────────────────────────────── */}
      <Secao id="trilha" icone={Compass} titulo="Por onde começar"
        chamada="Ninguém aprende o sistema inteiro num dia — e tentar é o jeito mais rápido de não aprender nenhum pedaço.">
        <div className="grid gap-3 md:grid-cols-3">
          {TRILHA.map((t) => (
            <Card key={t.nivel} className={`border ${TOM_TRILHA[t.tom]} p-5`}>
              <p className="font-display text-base font-semibold text-slate-900">{t.nivel}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{t.meta}</p>
              <ul className="mt-3 space-y-2">
                {t.passos.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-laranja-400" />
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-slate-200/70 pt-3 text-xs text-slate-500">
                <strong className="font-semibold text-slate-700">Já domino quando:</strong> {t.sei}
              </p>
            </Card>
          ))}
        </div>
      </Secao>

      {/* ── 2. Jornada ──────────────────────────────────────────────────── */}
      <Secao id="jornada" icone={ListChecks} titulo="As sete etapas, e a armadilha de cada uma"
        chamada="Saber o passo não é o mesmo que saber onde se tropeça nele.">
        <div className="space-y-3">
          {JORNADA.map((et) => {
            const Icone = et.icone
            return (
              <Card key={et.n} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-900 font-display text-base font-bold text-white">
                    {et.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${et.cor}`}>
                        <Icone size={16} />
                      </span>
                      <h3 className="font-semibold text-slate-900">{et.titulo}</h3>
                      <Link to={et.para}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-laranja-50 hover:text-laranja-700">
                        {et.onde} <ArrowRight size={10} className="inline" />
                      </Link>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{et.o_que}</p>
                    <p className="mt-2 flex gap-2 rounded-lg bg-red-50/60 p-2.5 text-sm text-slate-600">
                      <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                      <span className="min-w-0">
                        <strong className="font-semibold text-red-700">O erro comum:</strong> {et.erro}
                      </span>
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </Secao>

      {/* ── 3. De onde saiu esse número (o centro do guia) ───────────────── */}
      <Secao id="numeros" icone={Calculator} titulo="De onde saiu esse número"
        chamada={`Tudo abaixo é o estudo de Carlos, calculado agora. Os mesmos números que apareceriam na aba Planejamento dele.`}>

        {/* O capital de morte, aberto */}
        <Card className="mb-4 p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            O capital de morte, parcela a parcela
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            É o número que abre a proposta e o primeiro que o cliente questiona. Ele nunca é
            um chute: são três parcelas somadas, e cada uma tem um motivo que se explica em
            uma frase.
          </p>

          <div className="mt-4 space-y-2">
            {parcelas.map((p, i) => (
              <div key={p.id} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-slate-800">
                    {i > 0 && <Plus size={14} className="text-laranja-500" />}
                    {p.rotulo}
                  </span>
                  <span className="font-display text-lg font-semibold tabular text-slate-900">
                    {moeda(p.valor)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">{p.conta}</p>
                <p className="mt-2 text-sm text-slate-600">{p.porque}</p>
              </div>
            ))}
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-brand-900 p-4 text-white">
              <span className="flex items-center gap-2 font-semibold">
                <Equal size={16} className="text-laranja-400" /> Capital de morte sugerido
              </span>
              <span className="font-display text-2xl font-semibold tabular">
                {moeda(e.valores.morte)}
              </span>
            </div>
          </div>

          <Frase>
            “Esse número não é o que eu acho que você precisa. É o que a sua casa consome por
            mês, pelos anos em que a família ainda depende de você, mais o que cada filho
            ainda vai custar até se formar, mais o que você deve hoje.”
          </Frase>
        </Card>

        {/* Os filhos */}
        <Card className="mb-4 p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            Por que o filho sai da conta aos {IDADE_INDEPENDENCIA}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            O custo de vida que você digita <strong>já inclui os filhos</strong>. Se o estudo
            projetasse esse total pelo horizonte inteiro, estaria cobrando o gasto de duas
            crianças por {e.anos} anos — inclusive nos anos em que elas já estão formadas e
            trabalhando. Por isso o motor separa: o padrão de vida da casa vai pelo horizonte
            todo, e cada filho entra só pelos anos que faltam até os {IDADE_INDEPENDENCIA}.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {e.filhos.map((f) => (
              <div key={f.nome} className="rounded-xl border border-slate-200/70 p-3.5">
                <p className="font-semibold text-slate-800">{f.nome}, {f.idade} anos</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {moeda(f.custoMensal)}/mês × 12 × {f.anosRestantes} anos que faltam
                </p>
                <p className="mt-1.5 font-display text-lg font-semibold tabular text-slate-900">
                  {moeda(f.capitalAte24)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Repare que os dois custam quase o mesmo por mês, e mesmo assim{' '}
            <strong className="text-slate-700">{e.filhos[0]?.nome}</strong> pesa mais: ela tem
            mais anos pela frente. É a diferença que o cliente entende na hora — e que uma
            tabela de capital por faixa de renda nunca captaria.
          </p>
        </Card>

        {/* Invalidez */}
        <Card className="mb-4 p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            Invalidez: quando é igual à morte, e quando não é
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
              <Badge tom="blue">Com dependentes — o caso de Carlos</Badge>
              <p className="mt-2 text-sm text-slate-600">
                A renda para exatamente do mesmo jeito, e a família precisa do mesmo capital.
                Por isso a sugestão é a mesma:
              </p>
              <p className="mt-2 font-display text-lg font-semibold tabular text-slate-900">
                {moeda(e.sugestoes.invalidez)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
              <Badge tom="yellow">Sem dependentes</Badge>
              <p className="mt-2 text-sm text-slate-600">
                Aí a conta muda, e muda para <strong>cima</strong>. Se ele morre, não deixa
                ninguém desamparado — sobra a dívida. Se fica inválido, ele mesmo precisa
                viver décadas sem trabalhar, e ainda com o custo do tratamento. Para o
                solteiro, a invalidez é a maior exposição que existe.
              </p>
            </div>
          </div>
          <Frase>
            “A chance de você ficar sem poder trabalhar antes dos 65 é bem maior que a de
            morrer no mesmo período. Um plano que só paga se você morrer cobre o risco menor
            e cobra o prêmio inteiro.”
          </Frase>
        </Card>

        {/* Sucessão */}
        <Card className="mb-4 p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            O inventário: o que trava, e o que passa direto
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Esta é a distinção que sustenta o capítulo de sucessão inteiro, e a que quase
            nenhum cliente conhece.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <p className="font-semibold text-slate-800">Trava no inventário</p>
              <p className="mt-1 text-sm text-slate-600">
                Imóveis, investimentos, empresa, veículos. Ficam parados até o imposto ser
                pago — e o imposto se paga em <strong>dinheiro</strong>, não em imóvel.
              </p>
              <p className="mt-2 font-display text-lg font-semibold tabular text-slate-900">
                {moeda(e.bensInventariaveis)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="font-semibold text-slate-800">Passa direto</p>
              <p className="mt-1 text-sm text-slate-600">
                Previdência (VGBL/PGBL) e seguro de vida vão ao beneficiário indicado, em
                dias, sem inventário e fora da base do ITCMD.
              </p>
              <p className="mt-2 font-display text-lg font-semibold tabular text-slate-900">
                {moeda(e.previdencia)}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Para Carlos, destravar aquele patrimônio custa{' '}
              <strong className="text-slate-900">{moeda(e.custoInventario)}</strong> —
              ITCMD de {String(e.itcmd).replace('.', ',')}% (a alíquota do {e.uf}, não uma
              média nacional), mais custas e honorários, mais o que os bens continuam
              cobrando de IPTU, condomínio e contador enquanto o processo corre. E como há
              herdeiro menor, o rito é judicial por lei:{' '}
              <strong className="text-slate-900">{e.sucessao.prazoInventarioMeses} meses</strong>.
            </p>
            {e.deficitLiquidez > 0 && (
              <p className="mt-2 text-sm text-slate-600">
                Do que ele tem líquido hoje, faltam{' '}
                <strong className="text-red-700">{moeda(e.deficitLiquidez)}</strong> em
                dinheiro para pagar isso. É o número que vende sozinho.
              </p>
            )}
          </div>
        </Card>

        {/* Carteira existente */}
        <Card className="mb-4 p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            “Já tenho seguro pela empresa” — a lição mais cara do sistema
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Carlos declarou {moeda(e.carteira.total)} de cobertura. Um estudo comum abateria
            isso do capital de morte e pronto. Mas <strong>a origem decide tudo</strong>, e
            nenhuma das duas apólices dele é o que parece:
          </p>
          <ul className="mt-3 space-y-2">
            {e.carteira.itens.map((it, i) => (
              <li key={i} className="rounded-xl border border-slate-200/70 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-800">{it.descricao}</span>
                  <span className="font-display font-semibold tabular text-slate-900">{moeda(it.capital)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tom={it.portatil ? 'green' : 'red'}>
                    {it.portatil ? 'Acompanha o cliente' : 'Acaba com o vínculo'}
                  </Badge>
                  <Badge tom={it.paraFamilia ? 'green' : 'red'}>
                    {it.paraFamilia ? 'Paga a família' : 'Paga o banco'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{it.nota}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Gap aparente</p>
              <p className="mt-1 font-display text-xl font-semibold tabular text-slate-700">{moeda(e.gap)}</p>
              <p className="mt-1 text-xs text-slate-500">descontando tudo o que ele declarou</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-red-500">Gap real</p>
              <p className="mt-1 font-display text-xl font-semibold tabular text-red-700">{moeda(e.gapPortavel)}</p>
              <p className="mt-1 text-xs text-red-600/80">descontando só o que é dele mesmo</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            O salto entre os dois tem <strong>duas</strong> causas, e vale dizer as duas:{' '}
            {moeda(e.capitalQueEvapora)} de vida em grupo que somem no dia em que ele sair da
            clínica, e {moeda(e.carteira.quitaDivida)} de prestamista que nunca foram dinheiro
            da família — o beneficiário é o banco, e o estudo já desconta essa dívida à parte.
          </p>
          <Frase>
            “Hoje faltam {moeda(e.gap)}. No dia em que você sair da clínica, faltam{' '}
            {moeda(e.gapPortavel)} — e você recontrata pelo preço da idade que tiver na hora,
            com a saúde que tiver na hora.”
          </Frase>
        </Card>

        {/* As três travas */}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            As três travas que impedem uma proposta impossível
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            O motor não sugere o que a seguradora recusa. Saber as três evita a pior
            sequência possível: apresentar um número, o cliente se acostumar com ele, e a
            cotação voltar menor.
          </p>
          <div className="mt-3 space-y-2">
            {TRAVAS_DO_MOTOR.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200/70 p-4">
                <p className="font-semibold text-slate-800">{t.titulo}</p>
                <p className="mt-1 text-sm text-slate-600">{t.texto}</p>
                <p className="mt-2 flex gap-2 text-sm text-slate-500">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0">{t.naPratica}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
      </Secao>

      {/* ── 4. Conferência ──────────────────────────────────────────────── */}
      <Secao id="conferencia" icone={AlertTriangle} titulo="A conferência é a sua fila de trabalho"
        chamada="Ela não é um enfeite de validação: é a lista do que ainda não fecha, escrita antes de o cliente perceber.">
        <Card className="p-5">
          <p className="text-sm text-slate-600">
            O estudo de Carlos está bem preenchido e ainda assim levanta{' '}
            <strong className="text-slate-900">{e.inconsistencias.length} avisos</strong>.
            Isso é normal e é o sistema funcionando. O que muda é o que você faz com cada um.
          </p>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle size={15} /> Graves ({graves.length}) — resolva antes de apresentar
            </p>
            <ul className="space-y-2">
              {graves.map((i, k) => (
                <li key={k} className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 text-sm text-slate-700">
                  {i.texto}
                </li>
              ))}
            </ul>
          </div>

          {leves.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
                <Lightbulb size={15} /> Para conferir ({leves.length}) — você decide se valem uma pergunta
              </p>
              <ul className="space-y-2">
                {leves.map((i, k) => (
                  <li key={k} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-sm text-slate-700">
                    {i.texto}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3.5">
              <p className="text-sm font-semibold text-slate-800">Aviso com botão de corrigir</p>
              <p className="mt-1 text-xs text-slate-500">
                O sistema já sabe o valor certo e aplica com um clique. Confira antes de
                aceitar — ele não esteve na reunião, você esteve.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <p className="text-sm font-semibold text-slate-800">Aviso com pergunta</p>
              <p className="mt-1 text-xs text-slate-500">
                Falta um dado que só o cliente tem. A pergunta pronta está ali — normalmente
                são dez segundos de conversa.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <p className="text-sm font-semibold text-slate-800">Aviso sem ação</p>
              <p className="mt-1 text-xs text-slate-500">
                É contexto para você saber antes do cliente. Não some sozinho porque não há
                nada para corrigir — há algo para saber.
              </p>
            </div>
          </div>

          <Frase>
            Regra de bolso: se você não consegue explicar um aviso grave em voz alta, ele não
            está pronto para ir à reunião — nem o estudo.
          </Frase>
        </Card>
      </Secao>

      {/* ── 5. Diagnóstico ──────────────────────────────────────────────── */}
      <Secao id="diagnostico" icone={Stethoscope} titulo="O diagnóstico: três perguntas depois do “quanto”"
        chamada="O motor responde quanto. O diagnóstico responde para quem, o que fazer, e o que ainda falta perguntar.">

        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">1. Quem é este cliente</p>
            <p className="mt-1 font-display text-lg font-semibold text-slate-900">{d.perfil?.rotulo}</p>
            <p className="mt-2 text-sm text-slate-600">{d.perfil?.tese}</p>
            <p className="mt-2 text-xs text-slate-500">
              O perfil não é rótulo de marketing: ele define a <strong>ordem</strong> em que as
              coberturas entram e por qual capítulo a proposta abre.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">2. O que fazer com este estudo</p>
            <p className="mt-1 font-display text-lg font-semibold text-slate-900">
              {d.recomendacoes.length} recomendações
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Ordenadas por um peso explícito: gravidade × probabilidade × dinheiro em jogo ×
              alinhamento com o foco que ele declarou.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Recomendação sem conta atrás não é gerada — silêncio é melhor que confiança
              inventada.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">3. O que falta perguntar</p>
            <p className="mt-1 font-display text-lg font-semibold text-slate-900">
              {d.pendencias.length === 0 ? 'Nada — está pronto' : `${d.pendencias.length} pendências`}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Separadas das recomendações de propósito: recomendação é <strong>decisão</strong>,
              pendência é <strong>dado que falta</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Misturar as duas faz você apresentar um estudo achando que ele está pronto.
            </p>
          </Card>
        </div>

        <Card className="mb-3 p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            As quatro gravidades, e o que fazer com cada uma
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ['bloqueia', 'Bloqueia', 'red', 'Não apresente assim. É um número que se desmonta sozinho na frente do cliente.'],
              ['corrige', 'Corrige', 'yellow', 'O estudo está errado em algo concreto. Ajuste antes de gerar a proposta.'],
              ['reforca', 'Reforça', 'blue', 'O estudo está certo e pode ficar mais forte. É oportunidade, não defeito.'],
              ['refina', 'Refina', 'slate', 'Acabamento: ordem dos capítulos, foco da abertura. Melhora a conversa.'],
            ].map(([id, rotulo, tom, texto]) => (
              <div key={id} className="rounded-xl border border-slate-200/70 p-3.5">
                <Badge tom={tom}>{rotulo}</Badge>
                <p className="mt-2 text-sm text-slate-600">{texto}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 mb-2 text-sm font-semibold text-slate-800">
            As três primeiras recomendações de Carlos, como aparecem no sistema:
          </p>
          <ul className="space-y-2">
            {d.recomendacoes.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tom={r.tipo === 'bloqueia' ? 'red' : r.tipo === 'corrige' ? 'yellow' : r.tipo === 'reforca' ? 'blue' : 'slate'}>
                    {r.tipo}
                  </Badge>
                  <span className="font-semibold text-slate-800">{r.titulo}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{r.porque}</p>
                {r.dizerAssim && (
                  <p className="mt-2 border-l-2 border-laranja-300 pl-3 text-sm italic text-slate-600">
                    “{r.dizerAssim}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold text-slate-900">
            E o mesmo cliente, no meio da reunião
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Com só o que dá para anotar nos primeiros dez minutos, o diagnóstico vira outra
            coisa: ele para de recomendar e passa a <strong>perguntar</strong>. Cada pendência
            explica por que aquele dado importa, e as críticas já trazem a frase pronta.
          </p>
          <ul className="mt-3 space-y-2">
            {dIncompleto.pendencias.slice(0, 4).map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200/70 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  {p.critico
                    ? <Badge tom="red">Crítica</Badge>
                    : <Badge tom="slate">Vale perguntar</Badge>}
                  <span className="text-sm font-medium text-slate-700">{p.campo}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{p.texto}</p>
                {p.perguntaAoCliente && (
                  <p className="mt-1.5 text-sm italic text-laranja-700">“{p.perguntaAoCliente}”</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </Secao>

      {/* ── 6. Objeções ─────────────────────────────────────────────────── */}
      <Secao id="reuniao" icone={MessageCircleQuestion} titulo="Quando o cliente resiste"
        chamada="O sistema prevê as objeções DESTE cliente antes de elas acontecerem, e responde com a aritmética dele — não com retórica.">
        <Card className="mb-3 p-5">
          <p className="text-sm text-slate-600">
            Objeção não se vence com convicção, se vence com uma conta que o cliente consegue
            conferir. Repare no formato das três abaixo, porque ele se repete em todas:{' '}
            <strong>o argumento com número</strong>,{' '}
            <strong className="text-red-700">o que NÃO dizer</strong> — a parte que nenhum
            treinamento escreve e que decide a conversa — e{' '}
            <strong className="text-laranja-700">a pergunta que devolve a palavra a ele</strong>.
          </p>
        </Card>

        <div className="space-y-3">
          {objecoes.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tom={o.nivel === 'certa' ? 'red' : o.nivel === 'provavel' ? 'yellow' : 'slate'}>
                  {o.nivelRotulo}
                </Badge>
                <h3 className="font-semibold text-slate-900">“{o.rotulo}”</h3>
              </div>
              {o.comoSoa && <p className="mt-1 text-xs text-slate-400">Soa como: {o.comoSoa}</p>}
              <ul className="mt-3 space-y-1.5">
                {o.argumentos.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="min-w-0">{a}</span>
                  </li>
                ))}
              </ul>
              {o.naoDiga && (
                <p className="mt-3 flex gap-2 rounded-lg bg-red-50/60 p-3 text-sm text-slate-600">
                  <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                  <span className="min-w-0"><strong className="font-semibold text-red-700">Não diga:</strong> {o.naoDiga}</span>
                </p>
              )}
              {o.pergunta && (
                <p className="mt-2 border-l-[3px] border-laranja-400 bg-laranja-50/40 py-2 pl-3 pr-2 text-sm italic text-slate-700">
                  {o.pergunta}
                </p>
              )}
            </Card>
          ))}
        </div>
      </Secao>

      {/* ── 7. O que dá para prometer ───────────────────────────────────── */}
      <Secao id="prometer" icone={ShieldCheck} titulo="O que dá para prometer"
        chamada="Cliente perdoa preço. Não perdoa surpresa — e a venda já ganha morre entre o aperto de mão e a emissão.">
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">Prazo de emissão</h3>
            <p className="mt-2 text-sm text-slate-600">
              A pergunta que vem logo depois do “fechado” é <em>“quando está valendo?”</em>, e
              a resposta de cabeça é sempre otimista demais. A aba Subscrição diz o que a
              seguradora vai exigir <strong>neste capital e nesta idade</strong>, o prazo
              típico de verdade, e o que provavelmente vem com agravo.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ela também lista o que dá para separar <strong>ainda na reunião</strong>. O
              processo raramente trava por falta de decisão do cliente: trava por falta de um
              PDF que ele tinha no celular no dia em que disse sim. Pedir na hora é a
              diferença entre 10 e 40 dias.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">Beneficiário menor de idade</h3>
            <p className="mt-2 text-sm text-slate-600">
              O erro que acontece com quem fez tudo certo: o pai de família que indica os
              filhos. A seguradora paga, e o dinheiro fica sob representação legal — o uso
              costuma depender de alvará judicial. Meses de espera pelo capital que existia
              exatamente para não haver espera.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              <strong>A correção leva dez segundos na proposta de contratação:</strong> cônjuge
              como beneficiário principal, filhos como suplentes.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              O sistema avisa sempre que houver menor na indicação. Esse alerta nunca deve ser
              ignorado.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">O que a estimativa de prêmio é</h3>
            <p className="mt-2 text-sm text-slate-600">
              Um <strong>dimensionador</strong>, para a conversa ter ordem de grandeza em vez
              de silêncio. Sai sempre em faixa, nunca em número seco, e é assimétrica para
              cima — agravo médico só empurra o preço nessa direção.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Sem data de nascimento no cadastro ela devolve nada, em vez de chutar uma idade
              e produzir um número convincente e falso.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">Quando o preço trava a conversa</h3>
            <p className="mt-2 text-sm text-slate-600">
              Não corte no olho. Use os <strong>três níveis do plano</strong> (Essencial,
              Recomendado, Completo): o cliente para de escolher entre “sim” e “não” e passa a
              escolher entre “menos” e “mais”, que é uma decisão que ele consegue tomar na hora.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              E o <strong>plano que cabe no orçamento</strong> monta a apólice na ordem do
              risco dentro do teto que ele deu, listando o que ficou de fora com quanto
              faltaria para entrar. Muitas vezes a diferença são vinte reais.
            </p>
          </Card>
        </div>
      </Secao>

      {/* ── 8. Módulos ──────────────────────────────────────────────────── */}
      <Secao id="modulos" icone={LayoutDashboard} titulo="Cada módulo, em três linhas"
        chamada="A referência rápida — clique para abrir.">
        <div className="grid gap-3 md:grid-cols-2">
          {MODULOS.map((m, i) => {
            const Icone = m.icone
            const ativo = aberto === i
            return (
              <Card key={m.nome} className="overflow-hidden">
                <button onClick={() => setAberto(ativo ? null : i)}
                  aria-expanded={ativo}
                  aria-label={`${ativo ? 'Fechar' : 'Abrir'} o guia do módulo ${m.nome}`}
                  className="flex w-full items-center gap-3 p-4 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-laranja-50 text-laranja-600">
                    <Icone size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{m.nome}</p>
                    <p className="truncate text-xs text-slate-500">{m.resumo}</p>
                  </div>
                  <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${ativo ? 'rotate-180' : ''}`} />
                </button>
                {ativo && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    <ul className="space-y-2">
                      {m.itens.map((it, j) => (
                        <li key={j} className="flex gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-laranja-400" />
                          <span className="min-w-0">{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </Secao>

      {/* ── 9. Velocidade ───────────────────────────────────────────────── */}
      <Secao id="velocidade" icone={Keyboard} titulo="Trabalhar rápido"
        chamada="Tudo isto já existe e quase ninguém usa — porque nunca esteve escrito num lugar onde se procura.">
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">Atalhos de teclado</h3>
            <ul className="mt-3 space-y-1.5">
              {ATALHOS.map((a) => (
                <li key={a.tecla} className="flex items-baseline gap-3 text-sm">
                  <kbd className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600">
                    {a.tecla}
                  </kbd>
                  <span className="min-w-0 text-slate-600">{a.o_que}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Nenhum deles dispara enquanto você digita num campo — pode escrever à vontade.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">A paleta abre com o trabalho do dia</h3>
            <p className="mt-2 text-sm text-slate-600">
              Sem digitar nada, o primeiro grupo é <strong>“Precisam de você hoje”</strong>: os
              cinco clientes de maior score, cada um com a próxima ação escrita ao lado. Quem
              você visitou por último é história; quem está esperando é trabalho.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Ela acha pelo nome que você usa, não pelo nome técnico: “funil” leva ao Pipeline,
              “whatsapp” às Mensagens, “planilha” ao Importar, “dps” à aba Formulário.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              E alcança o <strong>interior do planejamento</strong>: digitar “benefici” com um
              cliente aberto leva direto ao bloco dos beneficiários — útil no meio da reunião,
              rolando com o polegar.
            </p>
          </Card>
        </div>
      </Secao>

      {/* ── 10. Erros caros ─────────────────────────────────────────────── */}
      <Secao id="erros" icone={TriangleAlert} titulo="Os erros que custam caro"
        chamada="Nenhum deles quebra o sistema. Todos custam uma venda ou a credibilidade do estudo.">
        <div className="space-y-2">
          {ERROS_CAROS.map((x, i) => (
            <Card key={i} className="p-5">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <XCircle size={16} className="shrink-0 text-red-500" /> {x.erro}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                <strong className="font-semibold text-slate-700">O que custa:</strong> {x.custa}
              </p>
              <p className="mt-2 flex gap-2 text-sm text-slate-600">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                <span className="min-w-0">
                  <strong className="font-semibold text-emerald-700">Faça assim:</strong> {x.faca}
                </span>
              </p>
            </Card>
          ))}
        </div>

        <Card className="mt-4 bg-brand-900 p-6 text-white">
          <p className="font-display text-lg font-semibold">A regra que resume o guia inteiro</p>
          <p className="mt-2 text-white/80">
            O sistema não esteve na reunião — você esteve. Ele calcula, avisa e sugere; nada
            entra no estudo sozinho. Cada número que ele mostra vem com o porquê ao lado
            justamente para você poder <strong className="text-white">discordar dele com
            argumento</strong>, e não só aceitar ou ignorar.
          </p>
        </Card>
      </Secao>
    </div>
  )
}
