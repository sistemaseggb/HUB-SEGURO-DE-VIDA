// ─────────────────────────────────────────────────────────────────────────────
// O MAPA DO SISTEMA — um lugar só.
//
// Antes, a navegação estava espalhada: o menu tinha uma lista, o App.jsx tinha
// outra, as abas do cliente uma terceira, e a busca não sabia de nenhuma. Toda
// vez que uma tela nova entrava, era preciso lembrar de três arquivos — e
// esquecer um significava uma página existente que nada no sistema alcançava.
//
// Aqui está a fonte única: cada destino com o caminho, o rótulo, o ícone, os
// sinônimos que a consultora pode digitar procurando por ele e a explicação do
// que ele faz. Menu lateral, barra do celular, paleta de comandos e a ajuda de
// atalhos leem todos daqui — e a busca acha qualquer tela pelo nome que a
// pessoa usa, não pelo nome que o programador escolheu.
// ─────────────────────────────────────────────────────────────────────────────
import {
  LayoutDashboard, KanbanSquare, Users, HeartHandshake, Settings, CalendarDays,
  MessageSquareText, BarChart3, Upload, GraduationCap, ChartPie, ListChecks,
  FileAudio, MessageCircle, CalendarPlus, FileSignature, Wallet, FileText,
  ClipboardList, CheckCircle2, RefreshCw, Scale, Trophy,
} from 'lucide-react'

// ─── Destinos do menu ────────────────────────────────────────────────────────
// `atalho` é a segunda tecla da sequência "g …" (g de "go"): g+d vai ao
// Dashboard, g+p ao Pipeline. É o padrão que Gmail, Linear e GitHub usam, e
// quem não conhece nunca esbarra nele sem querer.
export const DESTINOS = [
  {
    secao: 'Operação', para: '/', rotulo: 'Dashboard', icone: LayoutDashboard,
    fim: true, atalho: 'd',
    descricao: 'Os números do mês e o que fazer hoje',
    termos: ['inicio', 'home', 'painel', 'principal', 'kpi', 'metas', 'hoje'],
  },
  {
    secao: 'Operação', para: '/pipeline', rotulo: 'Pipeline', icone: KanbanSquare,
    atalho: 'p',
    descricao: 'O funil em quadro, arrastando de etapa em etapa',
    termos: ['funil', 'kanban', 'quadro', 'etapas', 'negociacao', 'oportunidades'],
  },
  {
    secao: 'Operação', para: '/agenda', rotulo: 'Agenda', icone: CalendarDays,
    atalho: 'a',
    descricao: 'As reuniões marcadas, por dia',
    termos: ['reunioes', 'calendario', 'compromissos', 'hoje', 'semana'],
  },
  {
    secao: 'Operação', para: '/clientes', rotulo: 'Clientes', icone: Users,
    atalho: 'c',
    descricao: 'A lista completa, com busca e filtros',
    termos: ['carteira', 'lista', 'pessoas', 'leads', 'contatos', 'base'],
  },
  {
    secao: 'Relacionamento', para: '/pos-venda', rotulo: 'Pós-Venda', icone: HeartHandshake,
    atalho: 'v',
    descricao: 'Apólices ativas e a régua de relacionamento',
    termos: ['apolices', 'carteira ativa', 'retencao', 'renovacao', 'aniversarios'],
  },
  {
    secao: 'Relacionamento', para: '/mensagens', rotulo: 'Mensagens', icone: MessageSquareText,
    atalho: 'm',
    descricao: 'A fila de mensagens que o sistema escreveu sozinho',
    termos: ['whatsapp', 'fila', 'disparos', 'central', 'aniversario', 'lembretes'],
  },
  {
    secao: 'Gestão', para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3,
    atalho: 'r',
    descricao: 'Fechamento do mês, comissões e motivos de perda',
    termos: ['fechamento', 'comissao', 'financeiro', 'analise', 'numeros', 'csv'],
  },
  {
    secao: 'Gestão', para: '/gb-awards', rotulo: 'GB Awards', icone: Trophy,
    atalho: 'w',
    descricao: 'O ranking do ano: maior emissor e maior prêmio',
    termos: ['premiacao', 'premiação', 'ranking', 'awards', 'gb', 'troféu', 'trofeu', 'campanha',
      'concurso', 'maior emissor', 'maior premio', 'disputa', 'assessores', 'podio', 'pódio'],
  },
  {
    secao: 'Gestão', para: '/importar', rotulo: 'Importar', icone: Upload,
    atalho: 'i',
    descricao: 'Trazer planilhas de clientes, apólices e comissões',
    termos: ['planilha', 'excel', 'xlsx', 'carga', 'migrar', 'upload'],
  },
  {
    secao: 'Gestão', para: '/cadastros', rotulo: 'Cadastros', icone: Settings,
    atalho: 's',
    descricao: 'Assessores, seguradoras, divisão de comissão e metas',
    termos: ['configuracao', 'ajustes', 'seguradoras', 'assessores', 'metas', 'preferencias'],
  },
  {
    secao: 'Ajuda', para: '/guia', rotulo: 'Guia da consultoria', icone: GraduationCap,
    atalho: 'g',
    descricao: 'O método, e de onde sai cada número do estudo',
    // A paleta acha pelo nome que a consultora usa, e ela não procura por
    // "guia da consultoria" quando está com dúvida — procura pelo problema.
    // Os termos novos são as perguntas que trazem alguém até aqui.
    termos: ['ajuda', 'tutorial', 'manual', 'como fazer', 'duvida', 'aprender',
      'guia', 'passo a passo', 'de onde saiu', 'como calcula', 'treinamento',
      'objecao', 'objeções', 'metodo', 'capital de morte'],
  },
]

export const SECOES = [...new Set(DESTINOS.map((d) => d.secao))]
  .map((titulo) => ({ titulo, itens: DESTINOS.filter((d) => d.secao === titulo) }))

// Os quatro destinos da barra inferior do celular. Mais que isso vira um
// teclado de calculadora e ninguém acerta com o polegar.
export const DESTINOS_CELULAR = ['/', '/pipeline', '/agenda', '/clientes']
  .map((p) => DESTINOS.find((d) => d.para === p))

// ─── Abas do Cliente 360 ─────────────────────────────────────────────────────
// `slug` é o que vai para a URL. Ele existe para a aba sobreviver ao F5, ao
// botão voltar e ao link colado no WhatsApp — antes disso a aba era estado de
// componente, e recarregar a página no meio de uma reunião jogava a consultora
// de volta para o Planejamento sem aviso.
//
// A ORDEM é a ordem da consultoria, não a ordem em que as telas foram escritas:
// primeiro o que se faz ANTES e DURANTE a reunião (planejar, comparar, roteiro,
// transcrever), depois o registro do relacionamento, depois o pós-venda.
export const ABAS_CLIENTE = [
  {
    slug: 'planejamento', nome: 'Planejamento', icone: ChartPie, grupo: 'Reunião',
    descricao: 'O estudo: renda, patrimônio, coberturas e o prêmio',
    termos: ['estudo', 'capital', 'coberturas', 'calculo', 'numeros', 'apolice sugerida',
      'preco', 'premio', 'niveis', 'objecoes', 'beneficiarios', 'subscricao',
      // é aqui que mora o link para o cliente preencher o estudo sozinho
      'link do cliente', 'sem reuniao', 'preencher sozinho', 'formulario do planejamento'],
  },
  {
    slug: 'comparador', nome: 'Comparador', icone: Scale, grupo: 'Reunião',
    descricao: 'Seguro resgatável × previdência, com o gráfico do cruzamento',
    termos: ['previdencia', 'vgbl', 'pgbl', 'investimento', 'grafico', 'rentabilidade'],
  },
  {
    slug: 'roteiro', nome: 'Roteiro', icone: ListChecks, grupo: 'Reunião',
    descricao: 'O playbook da conversa, bloco a bloco',
    termos: ['script', 'playbook', 'perguntas', 'conduzir', 'blocos'],
  },
  {
    slug: 'transcricao', nome: 'Transcrição', icone: FileAudio, grupo: 'Reunião',
    descricao: 'A gravação analisada: números ditos, objeções e compromissos',
    termos: ['gravacao', 'tactiq', 'audio', 'analise', 'reuniao gravada', 'objecoes'],
  },
  {
    slug: 'interacoes', nome: 'Interações', icone: MessageCircle, grupo: 'Relacionamento',
    descricao: 'As anotações de cada conversa',
    termos: ['anotacoes', 'notas', 'contatos', 'ligacoes', 'historico de conversa'],
  },
  {
    slug: 'reunioes', nome: 'Reuniões', icone: CalendarPlus, grupo: 'Relacionamento',
    descricao: 'Encontros marcados e realizados',
    termos: ['agendamento', 'encontros', 'marcar', 'calendario'],
  },
  {
    slug: 'tarefas', nome: 'Tarefas', icone: CheckCircle2, grupo: 'Relacionamento',
    descricao: 'O que ficou combinado e o que vence quando',
    termos: ['pendencias', 'to do', 'afazeres', 'follow up', 'lembretes'],
  },
  {
    slug: 'apolices', nome: 'Apólices', icone: FileSignature, grupo: 'Pós-venda',
    descricao: 'O que foi vendido e está em vigor',
    termos: ['vendas', 'contratos', 'vigente', 'produto', 'seguradora'],
  },
  {
    slug: 'comissoes', nome: 'Comissões', icone: Wallet, grupo: 'Pós-venda',
    descricao: 'Quanto este cliente gerou e como foi dividido',
    termos: ['ganhos', 'divisao', 'financeiro', 'remuneracao'],
  },
  {
    slug: 'formulario', nome: 'Formulário', icone: ClipboardList, grupo: 'Pós-venda',
    descricao: 'A DPS de onboarding e o link para o cliente preencher',
    termos: ['dps', 'declaracao de saude', 'onboarding', 'link', 'cadastro do cliente'],
  },
  {
    slug: 'documentos', nome: 'Documentos', icone: FileText, grupo: 'Pós-venda',
    descricao: 'Anexos: apólice, RG, comprovantes',
    termos: ['anexos', 'arquivos', 'pdf', 'upload', 'storage'],
  },
  {
    slug: 'historico', nome: 'Histórico', icone: RefreshCw, grupo: 'Pós-venda',
    descricao: 'A linha do tempo do funil, gravada automaticamente',
    termos: ['linha do tempo', 'mudancas', 'etapas', 'auditoria'],
  },
]

// ─── Seções dentro do Planejamento ───────────────────────────────────────────
// A aba de planejamento tem quase cem campos e virou a tela mais longa do
// sistema. Achá-la não é mais o problema: o problema é achar o BLOCO certo
// dentro dela no meio de uma reunião, rolando com o polegar.
//
// Cada seção aqui é um destino de verdade — a paleta oferece, o link leva
// direto (`/clientes/<id>/planejamento#sec-beneficiarios`) e o navegador
// devolve com o botão voltar. A âncora é a mesma que os atalhos do roteiro já
// usavam no topo do formulário; ela só passou a ter nome e endereço.
export const SECOES_PLANEJAMENTO = [
  { id: 'sec-tipo', rotulo: 'Tipo e focos',
    descricao: 'Que planejamento estamos construindo e o que ele veio resolver',
    termos: ['foco', 'pf', 'pj', 'empresarial', 'objetivo do estudo'] },
  { id: 'sec-familia', rotulo: 'Família e perfil',
    descricao: 'Profissão, estado civil, regime de bens e filhos',
    termos: ['filhos', 'conjuge', 'dependentes', 'casado', 'regime', 'profissao'] },
  { id: 'sec-financeira', rotulo: 'Vida financeira',
    descricao: 'Renda, custo de vida, dívidas e o que ele já tem de seguro',
    termos: ['renda', 'custo de vida', 'dividas', 'cobertura atual', 'seguro que ja tem'] },
  { id: 'sec-patrimonio', rotulo: 'Patrimônio',
    descricao: 'O raio-X por classe de bem e a previdência',
    termos: ['imoveis', 'investimentos', 'previdencia', 'vgbl', 'pgbl', 'bens'] },
  { id: 'sec-empresa', rotulo: 'Empresa',
    descricao: 'Valuation, sócios, homem-chave e dívidas avalizadas',
    termos: ['pj', 'socios', 'valuation', 'aval', 'homem chave', 'buy sell'] },
  { id: 'sec-sucessao', rotulo: 'Sucessão',
    descricao: 'ITCMD, custas, holding e o rito do inventário',
    termos: ['itcmd', 'inventario', 'holding', 'testamento', 'imposto', 'uf'] },
  { id: 'sec-coberturas', rotulo: 'Coberturas da apólice',
    descricao: 'Cada cobertura com o valor sugerido e o porquê',
    termos: ['morte', 'invalidez', 'doencas graves', 'dit', 'dih', 'funeral', 'capital'] },
  { id: 'sec-beneficiarios', rotulo: 'Beneficiários',
    descricao: 'Quem recebe o capital — e o que trava no caminho',
    termos: ['quem recebe', 'beneficiario', 'menor', 'alvara', 'rateio', 'esposa', 'filhos'] },
  { id: 'sec-subscricao', rotulo: 'Subscrição',
    descricao: 'O que a seguradora vai exigir, o prazo e o que pode ter agravo',
    termos: ['exame', 'dps', 'prazo', 'agravo', 'imc', 'risco', 'aceitacao', 'emissao'] },
  { id: 'sec-aposentadoria', rotulo: 'Aposentadoria',
    descricao: 'A meta, o que a previdência entrega e a lacuna',
    termos: ['acumulo', 'renda futura', 'aposentar', 'reserva'] },
  { id: 'sec-decisao', rotulo: 'Decisão',
    descricao: 'Quem decide a contratação e até quando',
    termos: ['quem decide', 'prazo', 'esposa', 'socio', 'follow up'] },
  { id: 'sec-investimento', rotulo: 'Investimento',
    descricao: 'O prêmio mensal, o anual e a forma de pagamento',
    termos: ['premio', 'preco', 'mensal', 'anual', 'quanto custa', 'cotacao', 'desconto'] },
]

export const abaPorSlug = (slug) =>
  ABAS_CLIENTE.find((a) => a.slug === slug) ?? ABAS_CLIENTE[0]

export const ABA_PADRAO = ABAS_CLIENTE[0].slug

// ─── Busca sem acento e sem cobrar ortografia ────────────────────────────────
// A consultora digita "relatorio", "propos", "sucessao" — e quase nunca com
// acento, porque o teclado do celular atrapalha. A busca precisa achar de
// qualquer jeito, senão ela conclui que a tela não existe.
export const chave = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// Pontua o quanto um destino combina com o que foi digitado. Devolve 0 quando
// não combina — e a ordem do resultado é por pontuação, então o que a pessoa
// provavelmente quis vem primeiro em vez de vir em ordem alfabética.
export function pontuar(termo, { rotulo, descricao = '', termos = [] }) {
  const q = chave(termo)
  if (!q) return 0
  const alvo = chave(rotulo)
  if (alvo === q) return 100
  if (alvo.startsWith(q)) return 80
  if (alvo.includes(q)) return 60
  for (const t of termos) {
    const k = chave(t)
    if (k.startsWith(q)) return 45
    if (k.includes(q)) return 30
  }
  if (chave(descricao).includes(q)) return 20
  return 0
}
