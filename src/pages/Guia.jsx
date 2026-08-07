import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap, PhoneCall, CalendarDays, ListChecks, ChartPie, Presentation,
  FileSignature, HeartHandshake, ChevronDown, Sparkles, Rocket, Lightbulb,
  Users, KanbanSquare, Upload, MessageSquareText, BarChart3, Settings, ArrowRight,
  LayoutDashboard,
} from 'lucide-react'
import { PageHeader, Card } from '../components/ui'

// ─────────────────────────────────────────────────────────────────────────────
// GUIA PASSO A PASSO — o manual vivo do Hub.
//
// Foi pensado para a consultora que abre o sistema pela primeira vez e para o
// dia a dia: a jornada completa do cliente (do primeiro contato ao pós-venda),
// o guia de cada módulo e as dicas de ouro. Tudo com links diretos para agir.
// ─────────────────────────────────────────────────────────────────────────────

// As 7 etapas da jornada — o coração do método. Cada uma diz O QUE fazer,
// ONDE no sistema, e POR QUÊ importa.
const JORNADA = [
  {
    n: 1, icone: PhoneCall, cor: 'text-blue-600 bg-blue-50',
    titulo: 'Pré-venda: capte e organize o lead',
    onde: 'Clientes · Pipeline',
    para: '/clientes',
    o_que: 'Cadastre o novo lead (ou importe sua base inteira) e ligue-o a um assessor. Ele entra no funil como "Lead Recebido".',
    porque: 'Todo cliente começa aqui. O assessor define a divisão de comissão, e o funil passa a monitorar sozinho quem está parado tempo demais.',
    acoes: ['Novo lead → preencha nome, telefone e assessor', 'Já tem uma planilha? Use Importar → Clientes'],
  },
  {
    n: 2, icone: CalendarDays, cor: 'text-violet-600 bg-violet-50',
    titulo: 'Agende a reunião',
    onde: 'Agenda · aba Reuniões do cliente',
    para: '/agenda',
    o_que: 'Marque a data e a hora. O cliente avança sozinho para "Agendamento" no funil, e você pode confirmar por WhatsApp com um clique.',
    porque: 'Agendar dentro do Hub mantém tudo num lugar só — e a confirmação automática reduz o "esqueci da reunião".',
    acoes: ['Agendar reunião → escolha o cliente e a data', 'Clique no ícone de WhatsApp para confirmar'],
  },
  {
    n: 3, icone: ListChecks, cor: 'text-laranja-600 bg-laranja-50',
    titulo: 'Conduza a reunião com o roteiro',
    onde: 'Cliente · aba Roteiro',
    para: '/clientes',
    o_que: 'Siga o script consultivo bloco a bloco (abertura → descoberta → dores → educação → solução → fechamento) e anote o que o cliente diz em cada etapa.',
    porque: 'O roteiro garante que você faça as perguntas certas na ordem certa. As anotações viram matéria-prima do estudo — nada se perde.',
    acoes: ['Abra a aba Roteiro e marque cada bloco conforme avança', 'Ao fim, "Levar anotações para as Notas da reunião"'],
  },
  {
    n: 4, icone: ChartPie, cor: 'text-emerald-600 bg-emerald-50',
    titulo: 'Monte o planejamento financeiro',
    onde: 'Cliente · aba Planejamento',
    para: '/clientes',
    o_que: 'Escolha o tipo de estudo (PF, PJ ou os dois), preencha renda, custo de vida, dívidas, os filhos e cada classe do patrimônio. O sistema calcula sozinho todas as coberturas da apólice, o custo do inventário e o déficit de liquidez.',
    porque: 'É o cérebro do estudo. Cada número que você digita alimenta a proposta — o raio-X do patrimônio, a linha do tempo dos filhos até os 24 e as duas formas de pagar o prêmio.',
    acoes: ['Escolha o tipo e os focos do planejamento', 'Detalhe o patrimônio por classe (previdência não passa por inventário)', 'Cote o prêmio mensal e o anual — o cliente escolhe', 'Confira a Inteligência do estudo e os avisos de número que não fecha'],
  },
  {
    n: 5, icone: Presentation, cor: 'text-blue-600 bg-blue-50',
    titulo: 'Apresente a proposta',
    onde: 'Cliente · botão Gerar proposta',
    para: '/clientes',
    o_que: 'Abra a apresentação em tela cheia e conduza slide a slide. Ao final, envie o link para o cliente rever em casa, ou salve em PDF.',
    porque: 'A proposta transforma números em significado. O cliente entende o valor — não o preço. E o link permite que ele mostre para a família.',
    acoes: ['Gerar proposta → navegue com as setas', 'Copiar link do cliente ou Enviar ao cliente (WhatsApp)'],
  },
  {
    n: 6, icone: FileSignature, cor: 'text-amber-600 bg-amber-50',
    titulo: 'Feche a venda e a DPS',
    onde: 'Cliente · abas Formulário e Apólices',
    para: '/clientes',
    o_que: 'Envie o link do formulário de saúde (DPS) para o cliente preencher. Registre a venda na aba Apólices — o sistema calcula a comissão e agenda o pós-venda.',
    porque: 'Registrar a venda fecha o cliente no funil, divide a comissão automaticamente e dispara toda a esteira de pós-venda. Zero trabalho manual.',
    acoes: ['Formulário → Gerar link e enviar pelo WhatsApp', 'Apólices → Registrar venda'],
  },
  {
    n: 7, icone: HeartHandshake, cor: 'text-rose-600 bg-rose-50',
    titulo: 'Cuide do cliente no pós-venda',
    onde: 'Pós-Venda · Mensagens',
    para: '/pos-venda',
    o_que: 'Acompanhe a saúde da carteira, os aniversários e os clientes esquecidos. As mensagens de relacionamento são escritas sozinhas — você só envia.',
    porque: 'A renovação e a indicação nascem do relacionamento. O pós-venda é onde a carteira cresce sem prospecção nova.',
    acoes: ['Pós-Venda → régua de relacionamento e clientes a reativar', 'Mensagens → envie os textos prontos com 1 clique'],
  },
]

// Guia de cada módulo — o "para que serve" e as ações principais.
const MODULOS = [
  {
    icone: LayoutDashboard, nome: 'Dashboard',
    resumo: 'Sua tela inicial: o que fazer hoje, as metas do mês e a saúde do negócio.',
    itens: [
      'A Central do Dia lista tarefas, aniversários e leads parados — comece o dia por aqui.',
      'O Foco de Hoje ordena os leads pela prioridade que o sistema calcula sozinho.',
      'As barras de meta mostram o quanto falta para bater o mês.',
    ],
  },
  {
    icone: KanbanSquare, nome: 'Pipeline',
    resumo: 'O funil visual. Arraste o cliente de uma etapa para a outra.',
    itens: [
      'Cada coluna mostra o capital em estudo somado — quanto negócio está parado ali.',
      'Cards amarelos e vermelhos avisam quem está parado tempo demais.',
      'Arrastar para "Perdido" pede o motivo — isso alimenta seus relatórios.',
    ],
  },
  {
    icone: Users, nome: 'Clientes',
    resumo: 'A ficha 360° de cada pessoa: planejamento, roteiro, apólices, documentos e histórico.',
    itens: [
      'Filtre por situação (em andamento, fechados, perdidos) e chame no WhatsApp direto da lista.',
      'Dentro do cliente, cada aba é uma parte do trabalho — do roteiro à comissão.',
      'O cabeçalho mostra o valor que o cliente representa: prêmio, capital e comissão.',
    ],
  },
  {
    icone: Upload, nome: 'Importar',
    resumo: 'Traga sua base antiga de uma vez: clientes, apólices e comissões.',
    itens: [
      'Cole a planilha ou envie um CSV — o sistema reconhece as colunas sozinho.',
      'Sempre mostra uma prévia antes de importar, e nunca duplica quem já existe.',
      'Dados importados não disparam mensagens automáticas (entram como histórico).',
    ],
  },
  {
    icone: MessageSquareText, nome: 'Mensagens',
    resumo: 'As mensagens de relacionamento escritas automaticamente pelo sistema.',
    itens: [
      'Aniversários, aniversário de apólice e reativação de leads — tudo com texto pronto.',
      'Você revisa e clica em "Enviar no WhatsApp" — a conversa abre com a mensagem.',
      'Personalize os textos em Cadastros → Mensagens automáticas.',
    ],
  },
  {
    icone: BarChart3, nome: 'Relatórios',
    resumo: 'O fechamento mensal e a análise das comissões recebidas das seguradoras.',
    itens: [
      'Importe a planilha de comissões do mês e veja a quebra por assessor e seguradora.',
      'O fechamento para o financeiro sai pronto — confere centavo a centavo.',
      'Acompanhe a evolução mês a mês e a concentração de receita.',
    ],
  },
  {
    icone: Settings, nome: 'Cadastros',
    resumo: 'A base de tudo: seguradoras, assessores, divisão de comissão e metas.',
    itens: [
      'Cadastre as seguradoras com o % de comissão de cada uma.',
      'Defina a divisão da comissão (Natália / assessor / escritório) — soma 100%.',
      'Configure as metas do mês para o Dashboard acompanhar.',
    ],
  },
]

const DICAS = [
  'Comece todo dia pela Central do Dia no Dashboard — ela já sabe o que é urgente.',
  'Preencha o Planejamento durante a reunião, com o cliente vendo os números aparecerem.',
  'Sempre envie a proposta pelo link: o cliente revê em casa e mostra para a família.',
  'Registre cada ligação e conversa em Interações — o histórico é o que constrói confiança.',
  'Use o roteiro até decorar. Vender proteção é fazer as perguntas certas, não falar mais.',
]

export default function Guia() {
  const [aberto, setAberto] = useState(null)

  return (
    <div>
      <PageHeader titulo="Guia passo a passo"
        subtitulo="Tudo o que você precisa para trabalhar 100% dentro do Hub — do primeiro contato ao pós-venda." />

      {/* Hero */}
      <Card className="risco-marca mb-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-laranja-50 px-3 py-1 text-xs font-semibold text-laranja-700">
              <Sparkles size={13} /> Bem-vinda ao seu Hub
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              Todo o trabalho do seguro, num lugar só.
            </h2>
            <p className="mt-3 max-w-xl text-slate-600">
              Este sistema acompanha você em cada passo: captar o lead, agendar, conduzir a reunião
              com um roteiro, montar o planejamento financeiro, apresentar uma proposta que emociona
              e cuidar do cliente depois da venda. Siga a jornada abaixo — e nunca fique na dúvida
              sobre o próximo passo.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/clientes" className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <Rocket size={15} /> Ir para meus clientes
              </Link>
              <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Ver o Dashboard
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 p-6 text-white">
            <GraduationCap size={26} className="text-laranja-400" />
            <p className="mt-3 font-display text-lg font-semibold">Em 7 etapas você domina o Hub</p>
            <p className="mt-1 text-sm text-white/70">
              Cada etapa abaixo diz o que fazer, onde no sistema e por que importa. É o método
              completo da consultoria — do "oi" ao cliente fiel.
            </p>
          </div>
        </div>
      </Card>

      {/* A jornada — timeline numerada */}
      <h2 className="mb-1 font-display text-lg font-semibold text-slate-900">A jornada completa do cliente</h2>
      <p className="mb-4 text-sm text-slate-500">Do primeiro contato à fidelização — sete etapas, sempre na mesma ordem.</p>

      <div className="mb-8 space-y-3">
        {JORNADA.map((e) => {
          const Icone = e.icone
          return (
            <Card key={e.n} className="overflow-hidden">
              <div className="flex flex-col gap-4 p-5 sm:flex-row">
                <div className="flex sm:flex-col sm:items-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-900 font-display text-lg font-bold text-white">
                    {e.n}
                  </span>
                  <span className="ml-3 hidden w-px flex-1 bg-slate-100 sm:ml-0 sm:mt-2 sm:block sm:w-px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${e.cor}`}>
                      <Icone size={17} />
                    </span>
                    <h3 className="font-semibold text-slate-900">{e.titulo}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{e.onde}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600"><strong className="font-semibold text-slate-800">O que fazer:</strong> {e.o_que}</p>
                  <p className="mt-1 text-sm text-slate-500"><strong className="font-semibold text-slate-700">Por que importa:</strong> {e.porque}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.acoes.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                        <ArrowRight size={12} className="text-laranja-500" /> {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Guia por módulo — accordion */}
      <h2 className="mb-1 font-display text-lg font-semibold text-slate-900">Guia de cada módulo</h2>
      <p className="mb-4 text-sm text-slate-500">Clique para expandir e entender o que cada área faz.</p>

      <div className="mb-8 grid gap-3 md:grid-cols-2">
        {MODULOS.map((m, i) => {
          const Icone = m.icone
          const ativo = aberto === i
          return (
            <Card key={m.nome} className="overflow-hidden">
              <button onClick={() => setAberto(ativo ? null : i)}
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
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-laranja-400" /> {it}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Dicas de ouro */}
      <Card className="mb-2 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
          <Lightbulb size={20} className="text-laranja-500" /> Dicas de ouro
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DICAS.map((d, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-laranja-500 text-xs font-bold text-white">{i + 1}</span>
              <p className="text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
