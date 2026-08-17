import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Printer, Heart, GraduationCap, Activity,
  Stethoscope, CalendarClock, Scale, ClipboardCheck, Search, FileSignature, Handshake,
  Hourglass, Coffee, Link2, Check, MessageCircle, ShieldCheck,
  BedDouble, Bone, Ambulance, Flower2, Building2, Briefcase, Landmark,
  PiggyBank, Lock, Wallet, Users, Presentation, SlidersHorizontal, Scissors,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto, whatsapp } from '../lib/format'
import {
  calcularEstudo, IDADE_INDEPENDENCIA, MESES_VITALICIO, GRUPOS_COBERTURA, focoRotulo,
} from '../lib/estudo'
import { compararSeguroComInvestimento, DIMENSOES_COMPARACAO } from '../lib/comparador.js'
import { montarNiveis, ancorarNaCotacao } from '../lib/niveis.js'
import { diagnosticar } from '../lib/diagnostico.js'
import { responderObjecoes } from '../lib/objecoes.js'
import { montarRoteiro } from '../lib/roteiroApresentacao.js'
import {
  TINTAS, agora, anotacoesIguais, aplicarSimulacao, comTracos, contarTracos,
  descreverSimulacao, desfazerHist, novoHistorico, podeDesfazer, podeRefazer,
  proximoCapitulo, refazerHist, registrar, sanitizarAnotacoes, simulacaoAtiva,
  slidesAnotados,
} from '../lib/apresentacao'
import { entrarTelaCheia, manterAcordado, sairTelaCheia } from '../lib/telaDeApresentacao'
import ComparadorCurvas from '../components/ComparadorCurvas'
import QuadroDesenho from '../components/QuadroDesenho'
import BarraApresentacao, {
  PainelSimulacao, PainelRoteiro, PerguntaDesenhos,
} from '../components/BarraApresentacao'
import { Spinner, Button } from '../components/ui'
import LinhaProtecao from '../components/LinhaProtecao'
import MapaPatrimonio from '../components/MapaPatrimonio'

import Logo from '../components/Logo'

// ─────────────────────────────────────────────────────────────────────────────
// O QUADRO DE CADA SLIDE
//
// Todo capítulo da proposta é um <Slide>: uma <section> com o nome estável no
// `data-slide` e uma camada de desenho por cima. O contexto existe para não
// arrastar oito props pelos vinte e um capítulos — o que o <Slide> precisa
// saber (se está apresentando, qual ferramenta, quais traços são dele) chega
// por aqui, e cada capítulo continua sendo só o seu conteúdo.
//
// O nome do slide é a CHAVE das anotações — nunca o índice. Um cliente que
// ganha o capítulo da empresa empurraria todos os índices para frente e o
// círculo do déficit de liquidez apareceria no capítulo errado.
// ─────────────────────────────────────────────────────────────────────────────
const ContextoQuadro = createContext(null)

// Atalhos de ferramenta, para quem apresenta pelo computador ligado na TV:
// no iPad ela usa a barra, mas na sala de reunião com teclado isto vale ouro.
const ATALHO_FERRAMENTA = {
  a: 'apontar', A: 'apontar',
  l: 'laser', L: 'laser',
  c: 'caneta', C: 'caneta',
  m: 'marcador', M: 'marcador',
  s: 'seta', S: 'seta',
  e: 'borracha', E: 'borracha',
}

// ─────────────────────────────────────────────────────────────────────────────
// REVELAÇÃO POR ETAPAS
//
// Um slide que abre com tudo escrito já entregou o final. O cliente lê antes
// de ela falar, e a conversa vira legenda do slide. Marcando o bloco com
// <Revelar>, os cartões aparecem um a um conforme ela avança — o primeiro
// junto com o título, os outros no ritmo dela.
//
// O truque é o `data-etapa`: o CSS esconde os filhos além da etapa atual (ver
// `index.css`). Nada de embrulhar cada filho num <div>, que quebraria os
// `grid` de todos os capítulos, e nada de mexer no DOM por fora do React.
// Fora da apresentação o atributo nem existe, então a proposta impressa e o
// link do cliente mostram tudo, sempre.
// ─────────────────────────────────────────────────────────────────────────────
const ContextoSlide = createContext('')

// `como` preserva o elemento original do bloco: a linha do tempo do inventário
// é uma <ol> de <li>, e trocá-la por <div> deixaria itens de lista soltos fora
// de uma lista — HTML inválido e leitor de tela perdido.
function Revelar({ como: Elemento = 'div', className = '', children, ...resto }) {
  const q = useContext(ContextoQuadro)
  const meuSlide = useContext(ContextoSlide)
  // só o capítulo em que ela está revela por etapas; os outros ficam inteiros,
  // senão o slide seguinte aparece pela metade durante a rolagem
  const ligado = !!q?.apresentando && q.revelando && q.slideAtivo === meuSlide
  return (
    <Elemento className={className} data-revelar=""
      data-etapa={ligado ? Math.min(q.etapa, 8) : undefined} {...resto}>
      {children}
    </Elemento>
  )
}

// A POSIÇÃO DE CADA CAPÍTULO VEM DO ROTEIRO, NÃO DO ARQUIVO.
//
// Quem veio tratar do inventário da holding não deve ver o capítulo da
// autonomia da família antes do capítulo da sucessão — e reescrever este
// arquivo inteiro para cada público seria produzir cinco apresentações
// diferentes para manter.
//
// A saída é o `order` do flexbox: o JSX continua na ordem em que se lê melhor,
// e `roteiroApresentacao.js` decide em que ordem os capítulos APARECEM. O
// índice, as bolinhas e o avanço leem a ordem visual (por `offsetTop`), então
// tudo continua concordando entre si.
function Slide({ nome, className = '', children }) {
  const q = useContext(ContextoQuadro)
  const tracos = q?.anotacoes?.[nome]
  // Fora da apresentação a camada continua desenhada, só que sem receber
  // ponteiro: é assim que o cliente vê, no link, o que foi rabiscado para ele.
  const ativo = !!q?.apresentando && q.slideAtivo === nome && q.ferramenta.tipo !== 'apontar'
  return (
    <section data-slide={nome} className={`relative ${className}`}
      style={{ order: q?.ordemDe?.(nome) ?? 900 }}>
      <ContextoSlide.Provider value={nome}>{children}</ContextoSlide.Provider>
      {(ativo || (tracos && tracos.length > 0)) && (
        <QuadroDesenho
          slide={nome} tracos={tracos} ativo={ativo} ferramenta={q.ferramenta}
          aoMudarTracos={(novos, opcoes) => q.definirTracos(nome, novos, opcoes)} />
      )}
    </section>
  )
}

// Gerador de proposta: transforma o estudo numa apresentação de tela cheia
// para a reunião (ou PDF pela impressão — cada slide vira uma página A4
// paisagem, com cores preservadas).
//
// ── O QUE ENTRA (e é o motor que decide) ─────────────────────────────────────
// Capítulos entram e saem conforme os DADOS: o de empresa só com PJ, o de
// aposentadoria só para quem marcou esse foco, o do custo da espera só com a
// data de nascimento no cadastro, o da proteção em vida só quando há cobertura
// que paga com o cliente aqui, e o das três formas só com prêmio cotado — os
// valores dos outros níveis são proporcionais à cotação real, e sem ela seriam
// estimativa impressa ao lado do nome do cliente.
//
// ── EM QUE ORDEM, E O QUE SE FALA (e é o roteiro que decide) ─────────────────
// A ordem, os títulos e as notas da consultora vêm de `roteiroApresentacao.js`,
// a partir do PÚBLICO deste cliente (o perfil que o diagnóstico já classificava
// e que a apresentação ignorava). O arco consultivo é sempre o mesmo — primeiro
// o cliente se enxerga, depois entende o risco, e só então vê o preço —, mas
// quem carrega a consciência muda: sucessão e patrimônio para uns, proteção em
// vida para outros, a empresa para os sócios.
//
//   capa → diagnóstico → reenquadramento → [os capítulos da tese deste
//   público] → o número → filhos → gap → o plano completo → investimento →
//   as três formas → as provas → o custo da espera → passos → fechamento
//
// Todo número vem de calcularEstudo(): a tela do planejamento e o slide
// mostram exatamente a mesma conta, sempre.
const ICONE_COBERTURA = {
  morte: Heart, invalidez: Activity, doencas_graves: Stethoscope,
  cirurgias: Scissors, dit: CalendarClock, dih: BedDouble,
  morte_acidental: Ambulance, fraturas: Bone,
  funeral_individual: Flower2, funeral_familiar: Flower2,
  sucessao: Scale, socios: Handshake, homem_chave: Briefcase, aval: Landmark,
}

// Nome curto de cada capítulo, para o índice da apresentação. O h2 do slide
// serve de reserva, mas ele é uma FRASE ("A proteção atual não cobre o plano")
// e num índice de 21 linhas isso vira parede de texto.
const TITULO_SLIDE = {
  capa: 'Capa', diagnostico: 'Onde você está', reenquadramento: 'O que o plano resolve',
  'em-vida': 'O que paga em vida',
  autonomia: 'Autonomia da família', numero: 'O número', filhos: 'Futuro dos filhos',
  patrimonio: 'Raio-X do patrimônio', sucessao: 'Sucessão',
  'linha-inventario': 'Linha do inventário', empresa: 'A empresa',
  aposentadoria: 'Aposentadoria', gap: 'O que falta', plano: 'O plano completo',
  investimento: 'O investimento', niveis: 'Três formas de fazer',
  'se-acontecer': 'Se acontecer amanhã',
  'investir-ou-proteger': 'Investir ou proteger', cruzamento: 'O cruzamento',
  dimensoes: 'Cada coisa serve para uma coisa', 'custo-espera': 'O custo da espera',
  passos: 'Próximos passos', fechamento: 'Fechamento',
}

// "36 meses" / "vitalícia" — o mesmo texto em todos os slides
const meses = (m) => {
  if (m == null) return '—'
  if (m >= MESES_VITALICIO) return 'por toda a vida'
  if (m >= 24) return `${Math.floor(m / 12)} anos`
  return `${m} ${m === 1 ? 'mês' : 'meses'}`
}
const mesesNum = (m) => (m == null ? '—' : m >= MESES_VITALICIO ? '∞' : m)

export default function Proposta({ publica = false }) {
  const { id, token } = useParams()
  const [dados, setDados] = useState(null)
  const [slideAtual, setSlideAtual] = useState(0)
  const [capitulos, setCapitulos] = useState([])
  const [copiado, setCopiado] = useState(false)

  // ── Estado da apresentação ────────────────────────────────────────────────
  const [apresentando, setApresentando] = useState(false)
  const [ferramenta, setFerramenta] = useState({
    tipo: 'apontar', cor: TINTAS[1].cor, espessura: 'medio',
  })
  // Histórico de estados em vez de "tira o último traço": só assim a BORRACHA
  // e o "limpar capítulo" têm volta. Ela encostar sem querer num traço que
  // sustentava o argumento e perdê-lo para sempre era o pior defeito possível
  // aqui — acontece no meio da reunião e não tem conserto.
  const [historico, setHistorico] = useState(() => novoHistorico({}))
  const [anotacoesSalvas, setAnotacoesSalvas] = useState({})
  const [simulacao, setSimulacao] = useState({})
  const [painelSimulacao, setPainelSimulacao] = useState(false)
  const [escuro, setEscuro] = useState(false)
  const [perguntando, setPerguntando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [pulados, setPulados] = useState(() => new Set())
  const [revelando, setRevelando] = useState(true)
  // A etapa é ANCORADA ao nome do capítulo, nunca guardada solta. A rolagem
  // suave atravessa todos os slides do caminho, então qualquer regra baseada
  // em "de qual slide eu vim" se confunde: pular do capítulo 16 para o 2 pelo
  // índice passa por 15, 14, 13… e o último passo parece um "voltar um".
  // Com a âncora, qualquer capítulo que não seja o marcado começa do zero, e
  // só a navegação que quer o contrário diz isso explicitamente.
  const [etapaPor, setEtapaPor] = useState({ slide: '', n: 0 })
  const [inicioReuniao, setInicioReuniao] = useState(null)
  // O painel do roteiro: o que dizer neste capítulo, para este cliente. Começa
  // FECHADO de propósito — a tela dela está compartilhada, e quem decide o que
  // aparece nela é ela.
  const [painelRoteiro, setPainelRoteiro] = useState(false)

  const anotacoes = agora(historico)
  const totalSlides = capitulos.length
  const etapasDoSlide = capitulos[slideAtual]?.etapas ?? 0
  const slideDoIndice = capitulos[slideAtual]?.slide ?? ''
  const etapa = etapaPor.slide === slideDoIndice ? Math.min(etapaPor.n, etapasDoSlide) : 0

  // Os capítulos são reordenados pelo roteiro com o `order` do flexbox, então a
  // ordem do DOM não é mais a ordem da tela. Tudo que navega — as setas, as
  // bolinhas, o índice e a detecção de onde ela está — lê a ordem VISUAL, por
  // `offsetTop`. Ler o DOM aqui faria a seta "avançar" pular para trás.
  const secoesEmOrdem = useCallback(() => (
    [...document.querySelectorAll('.proposta section')].sort((a, b) => a.offsetTop - b.offsetTop)
  ), [])

  const irPara = useCallback((i) => {
    const slides = secoesEmOrdem()
    if (slides.length === 0) return
    slides[Math.max(0, Math.min(i, slides.length - 1))]
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [secoesEmOrdem])

  // Tudo o que a navegação precisa saber vive numa referência: o ouvinte de
  // teclado é montado uma vez e leria valores congelados se dependesse do
  // fechamento — a seta pararia de andar depois do primeiro slide.
  const navRef = useRef({})
  navRef.current = {
    irPara, slideAtual, etapa, etapasDoSlide, revelando, pulados, totalSlides,
    apresentando, capitulos, slideDoIndice,
  }

  // Um passo para frente na apresentação: primeiro revela o que falta DESTE
  // capítulo, só depois vira o slide. É como todo apresentador espera que a
  // barra de espaço se comporte — e é o que faz um slide virar conversa em vez
  // de parede de texto.
  const avancar = useCallback((direcao) => {
    const n = navRef.current
    if (n.revelando && direcao > 0 && n.etapa < n.etapasDoSlide) {
      setEtapaPor({ slide: n.slideDoIndice, n: n.etapa + 1 }); return
    }
    if (n.revelando && direcao < 0 && n.etapa > 0) {
      setEtapaPor({ slide: n.slideDoIndice, n: n.etapa - 1 }); return
    }
    const destino = proximoCapitulo(n.slideAtual, direcao, n.totalSlides, n.pulados)
    if (destino === n.slideAtual) return
    // Voltando um capítulo, ele aparece INTEIRO: é um capítulo que ela já
    // explicou, e vê-lo recomeçar do primeiro cartão a obrigaria a reconstruir
    // o argumento só para chegar de novo onde já estava.
    if (direcao < 0) {
      setEtapaPor({ slide: n.capitulos[destino]?.slide ?? '', n: n.capitulos[destino]?.etapas ?? 0 })
    }
    n.irPara(destino)
  }, [])

  // Navegação: setas/PageUp-Down/espaço avançam; as bolinhas laterais mostram
  // onde está e pulam direto ao clicar. O índice de capítulos da barra sai
  // daqui também — a lista é lida do DOM porque é o DOM que sabe quais
  // capítulos este cliente ganhou, e quantas etapas cada um tem.
  useEffect(() => {
    setCapitulos(secoesEmOrdem().map((s) => ({
      slide: s.dataset.slide ?? '',
      titulo: TITULO_SLIDE[s.dataset.slide] ?? s.querySelector('h2')?.textContent?.trim() ?? 'Capítulo',
      // um bloco marcado para revelar tem uma etapa por filho, menos a
      // primeira, que já entra visível junto com o título
      etapas: Math.max(0, (s.querySelector('[data-revelar]')?.children.length ?? 1) - 1),
    })))
    function atual() {
      const y = window.scrollY + window.innerHeight / 2
      return Math.max(secoesEmOrdem().findLastIndex((s) => s.offsetTop <= y), 0)
    }
    function onScroll() { setSlideAtual(atual()) }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [dados, secoesEmOrdem])


  // Atalhos. Montados uma vez só e lendo tudo por referência.
  useEffect(() => {
    function onKey(e) {
      // digitando num campo (o painel de simulação tem controles), as setas
      // são do campo, não da apresentação
      const alvo = e.target
      if (alvo?.tagName === 'INPUT' || alvo?.tagName === 'TEXTAREA' || alvo?.isContentEditable) return
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault()
          setHistorico((h) => (e.shiftKey ? refazerHist(h) : desfazerHist(h)))
        }
        return
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); avancar(1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); avancar(-1) }
      else if (e.key === 'Home') { e.preventDefault(); navRef.current.irPara(0) }
      else if (e.key === 'End') { e.preventDefault(); navRef.current.irPara(navRef.current.totalSlides - 1) }
      else if (!navRef.current.apresentando) return
      // daqui para baixo, só durante a apresentação: quem folheia a proposta
      // sem apresentar não deve ver a tela apagar ao digitar "b"
      else if (e.key === 'b' || e.key === 'B') setEscuro((v) => !v)
      else if (ATALHO_FERRAMENTA[e.key]) setFerramenta((f) => ({ ...f, tipo: ATALHO_FERRAMENTA[e.key] }))
      else if (/^[1-5]$/.test(e.key)) setFerramenta((f) => ({ ...f, cor: TINTAS[Number(e.key) - 1].cor }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [avancar])

  // Fechar a aba com desenho não guardado apagaria a reunião inteira sem
  // pergunta nenhuma. O navegador só deixa avisar a partir de um `preventDefault`
  // no beforeunload, e só quando há de fato o que perder.
  const pendenteRef = useRef(false)
  useEffect(() => {
    const aoFechar = (e) => {
      if (!pendenteRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aoFechar)
    return () => window.removeEventListener('beforeunload', aoFechar)
  }, [])

  // As anotações que já estavam guardadas para este cliente. A coluna só existe
  // depois da migração 023: sem ela, a proposta continua inteira, apenas sem
  // memória dos desenhos (detecção por coluna, como no resto do sistema).
  useEffect(() => {
    const plano = dados?.plano
    const guardadas = sanitizarAnotacoes(plano?.anotacoes_proposta)
    setHistorico(novoHistorico(guardadas))
    setAnotacoesSalvas(guardadas)
  }, [dados])

  // Modo apresentação: a classe no <html> prende a rolagem em um slide por vez
  // (scroll-snap) e esconde o que não é conteúdo. A tela acordada evita o iPad
  // apagar no meio do argumento e derrubar o compartilhamento de tela.
  useEffect(() => {
    if (!apresentando) return undefined
    document.documentElement.classList.add('apresentando')
    const soltar = manterAcordado()
    // o Safari do iPad sai da tela cheia sozinho ao girar o aparelho; o estado
    // precisa acompanhar o navegador, não o contrário
    const aoSair = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        // sair da tela cheia não encerra a apresentação: ela continua com a
        // rolagem presa e a barra na mão dela
      }
    }
    document.addEventListener('fullscreenchange', aoSair)
    document.addEventListener('webkitfullscreenchange', aoSair)
    return () => {
      document.documentElement.classList.remove('apresentando')
      document.removeEventListener('fullscreenchange', aoSair)
      document.removeEventListener('webkitfullscreenchange', aoSair)
      soltar()
    }
  }, [apresentando])

  useEffect(() => {
    if (publica) {
      // Rota pública /p/<token>: o cliente vê a proposta sem login — a RPC
      // security definer (migração 017) devolve só o plano e o nome dele
      supabase.rpc('fn_proposta_carregar', { p_token: token }).then(({ data, error }) => {
        if (error || !data || data.erro) setDados({ naoEncontrada: true })
        else setDados({ cliente: { nome: data.cliente_nome, idade: data.cliente_idade }, plano: data.plano })
      })
    } else {
      Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase.from('planejamentos').select('*').eq('id_cliente', id).maybeSingle(),
      ]).then(([c, p]) => setDados(c.data
        ? { cliente: c.data, plano: p.data }
        // cliente inexistente cairia em cliente.nome.split() na primeira linha
        // do slide de capa — melhor cair no estado de "não encontrada"
        : { naoEncontrada: true }))
    }
  }, [id, token, publica])

  if (!dados) return <Spinner />
  const { cliente, plano } = dados

  if (dados.naoEncontrada) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 text-center">
        <Logo tamanho={48} />
        <p className="mt-6 text-lg font-semibold text-slate-800">Proposta não encontrada</p>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Este link não está mais disponível. Fale com a sua consultora para receber um link atualizado.
        </p>
      </div>
    )
  }

  if (!plano) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Preencha o planejamento do cliente antes de gerar a proposta.</p>
        <Link to={`/clientes/${id}`} className="mt-3 inline-block text-blue-600 hover:underline">← Voltar ao cliente</Link>
      </div>
    )
  }

  const linkPublico = plano.token_proposta ? `${window.location.origin}/p/${plano.token_proposta}` : null

  // ── A apresentação ────────────────────────────────────────────────────────
  const slideAtivo = capitulos[slideAtual]?.slide ?? ''
  const tracosDoSlide = anotacoes[slideAtivo] ?? []
  const desenhosPendentes = !anotacoesIguais(anotacoes, anotacoesSalvas)
  // A coluna só existe depois da migração 023. Sem ela a consultora ainda
  // desenha na reunião inteira — só não tem onde guardar, e o sistema diz isso
  // em vez de oferecer um botão que falharia.
  const podeGuardar = !publica && 'anotacoes_proposta' in plano
  pendenteRef.current = desenhosPendentes && podeGuardar

  const definirTracos = (nome, novos, { continuando = false } = {}) =>
    setHistorico((h) => registrar(h, comTracos(agora(h), nome, novos), { substituir: continuando }))
  const desfazer = () => setHistorico(desfazerHist)
  const refazer = () => setHistorico(refazerHist)
  const limparSlide = () => setHistorico((h) => registrar(h, comTracos(agora(h), slideAtivo, [])))

  function abrirApresentacao() {
    // O pedido de tela cheia tem que sair DIRETO do clique: depois de um await
    // ou dentro de um setTimeout o navegador recusa em silêncio.
    entrarTelaCheia(document.documentElement)
    setApresentando(true)
    setFerramenta((f) => ({ ...f, tipo: 'apontar' }))
    // a tecla B funciona em qualquer momento; sem zerar aqui, quem digitou um
    // "b" folheando a proposta entraria na apresentação com a tela preta
    setEscuro(false)
    setEtapaPor({ slide: '', n: 0 })
    setInicioReuniao(Date.now())
    // O ROTEIRO SE APLICA AQUI, e só aqui. Os capítulos que este público não
    // precisa ouvir saem do caminho de avançar NESTA reunião — o estudo
    // continua inteiro, o índice mostra por que cada um saiu e um toque traz
    // qualquer um de volta. O PDF e o link do cliente nunca perdem nada.
    setPulados(new Set(
      capitulos.map((c, i) => (roteiro?.estaFora(c.slide) ? i : -1)).filter((i) => i >= 0),
    ))
  }

  function tentarSair() {
    if (desenhosPendentes && podeGuardar) { setPerguntando(true); return }
    encerrar()
  }

  function encerrar() {
    sairTelaCheia()
    setApresentando(false)
    setPerguntando(false)
    setEscuro(false)
    setPainelSimulacao(false)
    // a simulação é temporária por definição: sair da apresentação devolve os
    // números do planejamento, que é a fonte da verdade
    setSimulacao({})
  }

  async function guardarDesenhos({ saindo = false } = {}) {
    setSalvando(true)
    setErroSalvar(null)
    const { error } = await supabase.from('planejamentos')
      .update({ anotacoes_proposta: anotacoes }).eq('id_cliente', id)
    setSalvando(false)
    if (error) { setErroSalvar('Não foi possível guardar os desenhos. Tente de novo.'); return }
    setAnotacoesSalvas(anotacoes)
    setPerguntando(false)
    if (saindo) encerrar()
  }

  function descartarDesenhos() {
    // volta ao que está no banco, mas o histórico guarda o passo: se ela
    // clicar em descartar sem querer, um Ctrl+Z devolve o desenho
    setHistorico((h) => registrar(h, anotacoesSalvas))
    encerrar()
  }

  function alternarPulado(i) {
    setPulados((p) => {
      const novo = new Set(p)
      if (novo.has(i)) novo.delete(i)
      else novo.add(i)
      return novo
    })
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkPublico)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // O plano que a tela mostra é o do banco, com as alavancas da simulação por
  // cima quando ela está mexendo nos números na frente do cliente. Nada disso
  // é gravado: `simulacao` morre com a apresentação, e o planejamento continua
  // sendo a fonte da verdade.
  const planoEfetivo = aplicarSimulacao(plano, simulacao)
  const simulando = simulacaoAtiva(simulacao)
  const mudancasSimuladas = descreverSimulacao(simulacao, plano)

  const e = calcularEstudo(planoEfetivo, { dataNascimento: cliente.data_nascimento, idade: cliente.idade })

  // ── QUEM ESTÁ DO OUTRO LADO DA MESA ───────────────────────────────────────
  // O diagnóstico já classificava o perfil deste cliente e a apresentação
  // nunca usou isso para nada: o deck saía igual para o pai de família de 34
  // anos e para o empresário de 61 que veio tratar do inventário. Aqui o perfil
  // vira PÚBLICO, e o público decide a ordem dos capítulos, os títulos que o
  // cliente lê e a fala de cada momento.
  //
  // As objeções entram no roteiro porque objeção tem HORA: "está caro" nasce no
  // capítulo do investimento, "já tenho plano de saúde" nasce no da proteção em
  // vida. A barra mostra a resposta já calculada para este cliente no capítulo
  // em que a pergunta costuma aparecer — e não depois, quando ela já virou não.
  const diag = diagnosticar(e, { cliente })
  const objecoes = responderObjecoes(e, { diagnostico: diag, cliente })
  const roteiro = montarRoteiro(e, {
    diagnostico: diag, cliente, objecoes, objetivos: plano.objetivos,
  })
  const textoDe = (slide) => roteiro?.textoDe(slide) ?? {}

  const primeiroNome = cliente.nome.split(' ')[0]
  const temPatrimonio = e.patrimonioBruto > 0
  const temGap = e.tem014 && e.coberturaAtual > 0
  const temEmpresa = e.temPJ && e.capitalPJ > 0
  const temRaioX = e.tem019 && e.detalhado && temPatrimonio
  const inv = e.investimento
  // O que a apólice paga com o cliente aqui — a lista vem do roteiro para o
  // capítulo e a fala da consultora nunca discordarem sobre o que está na tela.
  const emVida = roteiro?.emVida ?? null

  // O comparador só entra quando há capital e prêmio; a tabela de resgate é
  // opcional (sem ela a curva verde some, o resto continua valendo).
  const comp = compararSeguroComInvestimento({
    capital: e.valores.morte,
    premioMensal: inv?.mensal ?? 0,
    resgates: plano.seguro_resgatavel,
    alternativa: plano.comparador_alternativa ?? 'vgbl',
    taxaReal: plano.comparador_taxa_real != null
      ? Number(plano.comparador_taxa_real) / 100 : e.taxaReal,
    aliquotaIR: plano.aliquota_ir_cliente != null ? Number(plano.aliquota_ir_cliente) / 100 : 0,
    rendaMensal: e.renda,
    anos: Math.max(e.anos, 30),
    premioTemporarioMensal: plano.premio_temporario_mensal,
  })
  const anoUm = comp?.serie?.[0] ?? null

  // ── As três formas de fazer isso ──────────────────────────────────────────
  // O capítulo que muda a pergunta do fim da reunião de "aceita?" para "qual
  // dos três?". Só entra ANCORADO na cotação de verdade: sem prêmio cotado,
  // os valores seriam estimativa por idade, e estimativa impressa ao lado do
  // nome do cliente é lida como preço. A proporção entre os níveis vem do
  // estimador; o valor absoluto, da seguradora.
  const escada = ancorarNaCotacao(montarNiveis(e, { perfil: diag?.perfil }), e)

  // Coberturas agrupadas — o quadro da apólice, na ordem do catálogo
  const grupos = GRUPOS_COBERTURA
    .map((g) => ({ ...g, itens: e.ativas.filter((c) => c.grupo === g.id) }))
    .filter((g) => g.itens.length > 0)
  // Uma apólice completa passa de 8 coberturas e não cabe numa coluna só
  const denso = e.ativas.length > 8
  const temTresCenarios = e.mesesLiquidos != null

  const rotuloSecao = 'text-sm font-medium uppercase tracking-[0.3em] text-gold-500'

  // O slide de reenquadramento fala do que ELE veio resolver. Os três cartões
  // são escolhidos pelos focos marcados no planejamento e, na falta deles, pelo
  // eixo do público — quem veio por sucessão não ouve primeiro sobre educação
  // dos filhos, e quem não tem dependentes não ouve sobre família nenhuma.
  // A escolha mora no roteiro; aqui ficam só os textos.
  const CARTOES = {
    vida: { id: 'vida', icone: Activity, titulo: 'A maior parte paga em vida',
      texto: <>Invalidez, doenças graves, internação e afastamento pagam <strong className="text-slate-700">enquanto você está aqui</strong> — justamente quando os custos explodem e a renda para.</> },
    renda: { id: 'renda', icone: Heart, titulo: 'Substitui a sua renda',
      texto: <>O plano transforma anos de trabalho em um capital que <strong className="text-slate-700">sustenta a família</strong> e realiza os sonhos que você prometeu — com ou sem você.</> },
    educacao: { id: 'educacao', icone: GraduationCap, titulo: 'Garante a formação dos filhos',
      texto: <>A faculdade não espera o inventário nem a recuperação de ninguém. O capital <strong className="text-slate-700">chega em dias</strong> e o estudo dos filhos segue como estava planejado.</> },
    dividas: { id: 'dividas', icone: Wallet, titulo: 'A dívida não passa para eles',
      texto: <>Financiamento e consignado <strong className="text-slate-700">não morrem com o titular</strong>: viram dívida do espólio. O plano quita e a família herda o bem, não a parcela.</> },
    sucessao: { id: 'sucessao', icone: ShieldCheck, titulo: 'Protege o que você construiu',
      texto: <>Dá <strong className="text-slate-700">liquidez imediata</strong> para o inventário — o patrimônio não trava, a família não vende bens às pressas para pagar imposto.</> },
    blindagem: { id: 'blindagem', icone: Lock, titulo: 'O patrimônio fica inteiro',
      texto: <>Sem liquidez, o que sustenta a família é a venda do que você construiu. Com o plano, <strong className="text-slate-700">o patrimônio não é consumido</strong> — ele continua rendendo para eles.</> },
    empresarial: { id: 'empresarial', icone: Briefcase, titulo: 'A empresa continua de pé',
      texto: <>Os sócios compram a quota da família à vista e <strong className="text-slate-700">ninguém vira sócio de herdeiro</strong>. A empresa segue, e a família recebe em dinheiro.</> },
    aposentadoria: { id: 'aposentadoria', icone: PiggyBank, titulo: 'O plano de longo prazo sobrevive',
      texto: <>O aporte da aposentadoria sai da renda. Protegendo a renda, <strong className="text-slate-700">o plano de acúmulo continua</strong> mesmo se você não puder mais trabalhar.</> },
  }
  const cartoesReenquadramento = (roteiro?.cartoes ?? ['vida', 'renda', 'sucessao'])
    .map((id) => CARTOES[id]).filter(Boolean).slice(0, 3)

  return (
    <ContextoQuadro.Provider
      value={{
        apresentando, ferramenta, anotacoes, definirTracos, slideAtivo, revelando, etapa,
        ordemDe: (nome) => roteiro?.ordemDe(nome) ?? 900,
      }}>
    <div className="proposta">
      {/* barra de ações — some na impressão e durante a apresentação */}
      <div className={`fixed left-0 right-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-slate-900/95 px-4 py-2.5 backdrop-blur print:hidden ${apresentando ? 'hidden' : ''}`}>
        {publica ? (
          <span className="text-sm text-slate-300">
            Estudo preparado por <strong className="text-white">Natália Maschendorf</strong>
          </span>
        ) : (
          <Link to={`/clientes/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
            <ArrowLeft size={15} /> Voltar ao cliente
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-xs text-slate-400 lg:block">
            slide {slideAtual + 1} de {totalSlides} · use as setas ← →
          </span>
          {!publica && (
            // O botão que muda a reunião: tela cheia, controles ao alcance do
            // polegar e a Apple Pencil escrevendo por cima do slide.
            <Button variant="primary" onClick={abrirApresentacao}
              title="Tela cheia, caneta e simulação ao vivo — para apresentar pelo iPad">
              <Presentation size={15} /> Apresentar
            </Button>
          )}
          {!publica && linkPublico && (
            <>
              <Button variant="secondary" onClick={copiarLink}
                title="O cliente abre a proposta no celular, sem login — só quem tem o link acessa">
                {copiado ? <><Check size={15} /> Link copiado!</> : <><Link2 size={15} /> Copiar link do cliente</>}
              </Button>
              {whatsapp(cliente.telefone) && (
                <a target="_blank" rel="noreferrer"
                  href={whatsapp(cliente.telefone,
                    `Olá ${primeiroNome}! Preparei o seu estudo de proteção personalizado. `
                    + `Você pode ver com calma por aqui: ${linkPublico}`)}>
                  <Button variant="success"><MessageCircle size={15} /> Enviar ao cliente</Button>
                </a>
              )}
            </>
          )}
          <Button variant="gold" onClick={() => window.print()}><Printer size={15} /> Salvar em PDF / Imprimir</Button>
        </div>
      </div>

      {/* bolinhas de navegação (somem na impressão e na apresentação, onde a
          barra de baixo já mostra a posição e o índice) */}
      <div className={`fixed right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 print:hidden ${apresentando ? 'hidden' : ''}`}>
        {capitulos.map((c, i) => (
          <button key={c.slide + i} aria-label={`Ir ao slide ${i + 1}: ${c.titulo}`} title={c.titulo}
            onClick={() => irPara(i)}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              i === slideAtual ? 'scale-125 bg-laranja-500' : 'bg-slate-400/40 hover:bg-slate-400/70'}`} />
        ))}
      </div>

      {apresentando && (
        <>
          {/* Tela preta: no meio da reunião a tela às vezes atrapalha. Um toque
              e a atenção volta para a conversa, sem perder o lugar no roteiro. */}
          {escuro && (
            <button type="button" onClick={() => setEscuro(false)}
              aria-label="Voltar do modo tela preta"
              className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950 pb-28 text-xs text-slate-600 print:hidden">
              toque para voltar ao slide
            </button>
          )}

          {/* Enquanto a simulação está ligada, a tela diz isso o tempo todo: um
              número de hipótese não pode passar por definitivo na frente do
              cliente. */}
          {simulando && !escuro && (
            <div className="pointer-events-none fixed left-1/2 top-3 z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-gold-400/95 px-4 py-1.5 text-xs font-medium text-slate-900 shadow-lg print:hidden">
              <span className="inline-flex items-center gap-1.5"><SlidersHorizontal size={13} /> Simulação — não salva</span>
              {mudancasSimuladas.map((m) => (
                <span key={m.campo} className="tabular opacity-80">
                  {m.rotulo}: {m.sufixo ? `${m.de} → ${m.para} ${m.sufixo}` : `${brl(m.de)} → ${brl(m.para)}`}
                </span>
              ))}
            </div>
          )}

          <BarraApresentacao
            slideAtual={slideAtual} totalSlides={totalSlides} irPara={irPara} avancar={avancar}
            nomes={capitulos.map((c, i) => ({
              ...c, anotado: (anotacoes[c.slide] ?? []).length > 0, pulado: pulados.has(i),
              foraDoRoteiro: !!roteiro?.estaFora(c.slide),
              motivoFora: roteiro?.motivoFora(c.slide) ?? null,
              momento: roteiro?.momentoDe(c.slide) ?? null,
            }))}
            alternarPulado={alternarPulado}
            publico={roteiro?.publico ?? null}
            momento={roteiro?.momentoDe(slideAtivo) ?? null}
            temRoteiro={!!roteiro?.falaDe(slideAtivo)}
            roteiroAberto={painelRoteiro}
            // Um painel por vez. Os dois abertos empilham e cobrem dois terços
            // do slide — e ela usa um OU outro: ou está montando a frase que
            // vai dizer, ou está mexendo no número na frente do cliente.
            alternarRoteiro={() => {
              setPainelRoteiro((v) => !v)
              setPainelSimulacao(false)
            }}
            etapa={etapa} etapasDoSlide={etapasDoSlide}
            revelando={revelando} alternarRevelacao={() => setRevelando((v) => !v)}
            inicioReuniao={inicioReuniao}
            ferramenta={ferramenta} mudarFerramenta={setFerramenta}
            desfazer={desfazer} podeDesfazer={podeDesfazer(historico)}
            refazer={refazer} podeRefazer={podeRefazer(historico)}
            limparSlide={limparSlide} temTracosNoSlide={tracosDoSlide.length > 0}
            desenhosPendentes={desenhosPendentes && podeGuardar}
            guardarDesenhos={() => guardarDesenhos()}
            simulando={painelSimulacao || simulando}
            alternarSimulacao={() => {
              setPainelSimulacao((v) => !v)
              setPainelRoteiro(false)
            }}
            escuro={escuro} alternarEscuro={() => setEscuro((v) => !v)}
            sair={tentarSair}>
            {erroSalvar && (
              <p className="mb-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">{erroSalvar}</p>
            )}
            {painelRoteiro && !escuro && (
              <PainelRoteiro fala={roteiro?.falaDe(slideAtivo)} publico={roteiro?.publico}
                titulo={capitulos[slideAtual]?.titulo}
                fechar={() => setPainelRoteiro(false)} />
            )}
            {painelSimulacao && !escuro && (
              <PainelSimulacao plano={plano} simulacao={simulacao}
                mudar={(campo, valor) => setSimulacao((s) => ({ ...s, [campo]: valor }))}
                limpar={() => setSimulacao({})}
                fechar={() => setPainelSimulacao(false)} />
            )}
          </BarraApresentacao>

          {perguntando && (
            <PerguntaDesenhos
              quantos={contarTracos(anotacoes)} slides={slidesAnotados(anotacoes).length}
              salvando={salvando}
              guardar={() => guardarDesenhos({ saindo: true })}
              descartar={descartarDesenhos}
              cancelar={() => setPerguntando(false)} />
          )}
        </>
      )}

      {/* 1 · CAPA */}
      <Slide nome="capa" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-slate-900 p-5 sm:p-8 text-center text-white print:min-h-0 print:py-24">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-laranja-500/10 blur-3xl print:hidden" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl print:hidden" />
        <div className="relative"><Logo claro tamanho={64} /></div>
        {/* A etiqueta diz, em cinco palavras, de que estudo se trata — e é a
            primeira coisa que o cliente lê. Ela vem do público: "estudo de
            sucessão" para quem veio por isso, "da sua renda e da sua saúde"
            para quem não tem dependentes. */}
        <p className="relative mt-10 text-sm font-medium uppercase tracking-[0.3em] text-gold-400">
          {textoDe('capa').etiqueta
            ?? (e.temPJ ? 'Estudo de proteção pessoal e empresarial' : 'Estudo de proteção e blindagem patrimonial')}
        </p>
        <h1 className="relative mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Um plano feito para a vida de <span className="text-laranja-400">{primeiroNome}</span>
        </h1>
        <p className="relative mt-6 max-w-xl text-lg text-white/70">
          {plano.objetivos || 'Proteção financeira desenhada sob medida para o que importa para você.'}
        </p>
        {e.focos.length > 0 && (
          <div className="relative mt-7 flex flex-wrap justify-center gap-2">
            {e.focos.map((f) => (
              <span key={f} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">
                {focoRotulo(f)}
              </span>
            ))}
          </div>
        )}
        <p className="relative mt-12 text-sm text-white/50">
          Natália Maschendorf · Consultoria de Seguro de Vida e Blindagem Patrimonial · {new Date().toLocaleDateString('pt-BR')}
        </p>
      </Slide>

      {/* 2 · DIAGNÓSTICO — onde você está hoje */}
      <Slide nome="diagnostico" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
        <p className={rotuloSecao}>O ponto de partida</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">A vida de {primeiroNome} hoje</h2>
        <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Dado rotulo="Renda mensal" valor={e.renda > 0 ? brl(e.renda) : '—'} />
          <Dado rotulo="Custo de vida" valor={e.custoVida > 0 ? `${brl(e.custoVida)}/mês` : '—'} />
          <Dado rotulo="Patrimônio construído" valor={temPatrimonio ? brlCompacto(e.patrimonioBruto) : '—'} />
          <Dado rotulo="Dívidas e compromissos" valor={e.dividas > 0 ? brlCompacto(e.dividas) : 'Nenhuma'} />
          <Dado rotulo="Família" valor={[
            plano.conjuge_nome ? `cônjuge ${plano.conjuge_nome.split(' ')[0]}` : null,
            plano.num_dependentes > 0 ? `${plano.num_dependentes} dependente(s)` : null,
          ].filter(Boolean).join(' · ') || (plano.estado_civil || '—')} />
          <Dado rotulo="Proteção que já existe" valor={e.coberturaAtual > 0 ? brlCompacto(e.coberturaAtual) : 'Nenhuma'}
            destaque={!(e.coberturaAtual > 0)} />
        </div>
        {(e.filhos.length > 0 || plano.filhos_idades) && (
          <p className="mt-6 text-slate-500">
            Filhos: {e.filhos.length > 0
              ? e.filhos.map((f) => `${f.nome || 'filho(a)'}${f.idade != null ? ` (${f.idade})` : ''}`).join(' · ')
              : plano.filhos_idades}
          </p>
        )}
        {e.temPJ && e.pj.valuation > 0 && (
          <p className="mt-2 text-slate-500">
            Empresa: {e.pj.razaoSocial || 'sociedade'} · participação de {e.pj.participacao}%
            {' '}({brlCompacto(e.pj.quota)})
          </p>
        )}
        <p className="mt-10 max-w-xl text-center text-lg text-slate-600">
          Tudo isso depende de uma única coisa continuar existindo: <strong className="text-slate-900">a sua capacidade de gerar renda</strong>.
        </p>
      </Slide>

      {/* 3 · REENQUADRAMENTO — o slide que muda a cabeça do cliente */}
      <Slide nome="reenquadramento" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
        <p className={rotuloSecao}>{textoDe('reenquadramento').etiqueta ?? 'Antes de tudo, uma verdade'}</p>
        {/* O reenquadramento é o slide que muda a cabeça do cliente — e a frase
            que faz isso depende de quem ele é. "Não é sobre morrer, é sobre
            continuar cuidando" é perfeita para um provedor e vazia para quem
            não tem quem cuidar. */}
        <h2 className="mt-3 max-w-3xl text-center text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {textoDe('reenquadramento').titulo ?? 'Seguro de vida não é sobre morrer.'}<br />
          <span className="text-laranja-600">
            {textoDe('reenquadramento').destaque ?? 'É sobre continuar cuidando.'}
          </span>
        </h2>
        <Revelar className="mt-12 grid w-full max-w-4xl gap-5 md:grid-cols-3">
          {cartoesReenquadramento.map((c) => (
            <Cartao key={c.id} icone={c.icone} titulo={c.titulo}>{c.texto}</Cartao>
          ))}
        </Revelar>
        <p className="mt-10 max-w-xl text-center text-lg text-slate-600">
          {textoDe('reenquadramento').remate
            ?? 'É o único ativo que se multiplica exatamente na hora que você mais precisa.'}
        </p>
      </Slide>

      {/* 4 · QUANTO TEMPO — a pergunta que abre os olhos */}
      {e.mesesComPlano != null && e.mesesVendendoTudo != null && (
        <Slide nome="autonomia" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>A pergunta central</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            {textoDe('autonomia').titulo
              ?? 'Se a renda parasse hoje, por quanto tempo a família manteria o padrão de vida?'}
          </h2>
          {/* Três cenários quando o patrimônio está detalhado por classe; sem
              isso não dá para separar o líquido do ilíquido e mostramos dois. */}
          <Revelar className={`mt-12 grid w-full gap-5 ${temTresCenarios ? 'max-w-5xl md:grid-cols-3' : 'max-w-3xl md:grid-cols-2'}`}>
            {temTresCenarios && (
              <Cenario tom="ruim" icone={Hourglass} etiqueta="Hoje, sem vender nada"
                numero={mesesNum(e.mesesLiquidos)} unidade={e.mesesLiquidos === 1 ? 'mês' : 'meses'}>
                É o que a família acessa de imediato: reservas, previdência e o seguro que já existe.
                Depois disso, começa a vender o que você construiu.
              </Cenario>
            )}
            <Cenario tom="alerta" icone={Lock} etiqueta="Hoje, vendendo tudo"
              numero={mesesNum(e.mesesVendendoTudo)} unidade={e.mesesVendendoTudo === 1 ? 'mês' : 'meses'}
              rodape={e.patrimonioBruto > 0 ? 'no fim: R$ 0 de patrimônio' : null}>
              Só que os bens <strong>ficam travados no inventário</strong> e, quando destravam, são
              vendidos com pressa e deságio — este prazo custa <strong>tudo que você construiu</strong>.
            </Cenario>
            <Cenario tom="bom" icone={Heart}
              etiqueta={temTresCenarios ? 'Com o plano, sem vender nada' : 'Com o plano'}
              numero={mesesNum(e.mesesComPlano)} unidade="meses"
              rodape={e.patrimonioBruto > 0
                ? `no fim: ${brlCompacto(e.patrimonioBruto)} de patrimônio` : null}>
              O capital chega em dias, direto aos beneficiários, e sustenta a casa sem que ninguém
              precise vender nada — <strong>o patrimônio fica inteiro para a família</strong>.
            </Cenario>
          </Revelar>
          <p className="mt-10 max-w-2xl text-center text-lg text-slate-600">
            {temTresCenarios && (
              <>A comparação justa é a primeira coluna com a última: <strong className="text-slate-900">sem
              vender nada</strong>, a família sai de {meses(e.mesesLiquidos)} para {meses(e.mesesComPlano)}.{' '}</>
            )}
            O plano não substitui o que você construiu — <strong className="text-slate-900">ele impede que seja consumido</strong>.
          </p>
        </Slide>
      )}

      {/* 4b · A PROTEÇÃO EM VIDA — o capítulo que faltava.
          A objeção mais comum da categoria ("isso só serve depois que eu
          morro") nascia aqui e não tinha slide: as coberturas que pagam com o
          cliente vivo só apareciam diluídas no quadro da apólice, entre outras
          dez linhas. Reunidas, elas são a maior parte da apólice e a parte que
          mais é acionada — e é onde a cobertura de CIRURGIAS mora, que é o
          furo que este estudo tinha.

          Só entra com pelo menos duas dessas coberturas: uma cobertura só não
          sustenta um capítulo, e o quadro da apólice já a mostra. */}
      {emVida && emVida.itens.length >= 2 && (
        <Slide nome="em-vida" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>{textoDe('em-vida').etiqueta ?? 'Proteção em vida'}</p>
          <h2 className="mt-3 max-w-3xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            {textoDe('em-vida').titulo ?? 'A maior parte deste plano paga com você aqui'}
          </h2>
          <p className="mt-3 max-w-2xl text-center text-slate-500">
            Elas pagam <strong className="text-slate-700">no diagnóstico, na cirurgia, no dia de
            afastamento</strong> — com você aqui para decidir o que fazer com o dinheiro.
          </p>

          <Revelar className={`mt-7 grid w-full gap-4 ${
            emVida.itens.length >= 4 ? 'max-w-5xl md:grid-cols-3' : 'max-w-4xl md:grid-cols-2'}`}>
            {emVida.itens.map((c) => {
              const Icone = ICONE_COBERTURA[c.id] ?? Activity
              return (
                <div key={c.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
                  <div className="w-fit rounded-xl bg-white p-2.5 text-emerald-600 shadow-card"><Icone size={22} /></div>
                  <h3 className="mt-3 font-semibold text-slate-900">{c.curto}</h3>
                  <p className="mt-1 font-display text-2xl font-semibold tabular text-emerald-700">
                    {c.tipo === 'diaria' ? `${brl(c.valor)}/dia` : brlCompacto(c.valor)}
                  </p>
                  {c.tipo === 'diaria' && c.dias > 0 && (
                    <p className="text-xs text-emerald-800/70">
                      até {c.dias} diárias · {brlCompacto(c.total)}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-slate-600">{c.descricao}</p>
                </div>
              )
            })}
          </Revelar>

          <p className="mt-7 max-w-2xl text-center text-lg text-slate-600">
            {textoDe('em-vida').remate}
          </p>
          {emVida.maior > 0 && (
            <p className="mt-2.5 max-w-2xl text-center text-sm text-slate-400">
              Somadas, estas coberturas alcançam {brlCompacto(emVida.total)} — e a maior indenização
              única em vida é de {brlCompacto(emVida.maior)}. Elas se acionam por acontecimentos
              diferentes, e mais de uma pode ser usada ao longo da vida da apólice.
            </p>
          )}
        </Slide>
      )}

      {/* 5 · O NÚMERO */}
      <Slide nome="numero" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 text-center print:min-h-0 print:py-24">
        <p className={rotuloSecao}>{textoDe('numero').etiqueta ?? 'A proteção recomendada'}</p>
        <p className="mt-6 font-display text-6xl font-semibold tracking-tight text-slate-900 tabular md:text-8xl">{brlCompacto(e.valores.morte)}</p>
        <p className="mt-3 text-xl text-slate-400 tabular">{brl(e.valores.morte)}</p>
        {/* Sem dependentes o motor NÃO projeta reposição de renda — o capital
            cobre a dívida e o que a morte dele deixa em aberto. Dizer aqui
            "sustenta a família por X meses" descreveria uma conta que o estudo
            não fez, e o cliente que faz a conta de cabeça percebe. */}
        {textoDe('numero').legenda && (
          <p className="mt-8 max-w-lg text-lg text-slate-600">{textoDe('numero').legenda}</p>
        )}
        {e.mesesProtegidos > 0 && e.temDependentes && (
          <p className="mt-8 max-w-lg text-lg text-slate-600">
            Sustenta o padrão de vida da família por{' '}
            <strong className="font-semibold text-slate-900">{meses(e.mesesProtegidos)}</strong>
            {e.dividas > 0 && <>, já quitando as dívidas de {brlCompacto(e.dividas)}</>}
            {' '}— o horizonte planejado é de {e.anos} anos.
          </p>
        )}
        {e.capitalFilhos > 0 && (
          <p className="mt-3 max-w-lg text-sm text-slate-400">
            Já inclui {brlCompacto(e.capitalFilhos)} reservados para os filhos — calculados
            até cada um completar {IDADE_INDEPENDENCIA} anos, e nem um dia a mais.
          </p>
        )}
      </Slide>

      {/* 6 · O FUTURO DOS FILHOS — o gasto de hoje tem data para acabar */}
      {e.filhos.some((f) => f.custoMensal > 0) && (
        <Slide nome="filhos" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
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
          <div className="mt-8 w-full max-w-3xl rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
            <LinhaProtecao estudo={e} altura={165} />
          </div>
          <p className="mt-6 max-w-xl text-center text-base text-slate-600">
            Esse gasto tem prazo: quando cada um completa {IDADE_INDEPENDENCIA}, ele sai da conta.
            O plano reserva <strong className="text-slate-900">{brlCompacto(e.capitalFilhos)}</strong> — exatamente
            o necessário, <strong className="text-slate-900">nem um real a mais</strong>.
          </p>
        </Slide>
      )}

      {/* 7 · RAIO-X DO PATRIMÔNIO — o que a família consegue usar de verdade */}
      {temRaioX && (
        <Slide nome="patrimonio" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Raio-X do patrimônio</p>
          <h2 className="mt-3 max-w-3xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            Você construiu {brlCompacto(e.patrimonioBruto)}.
            {' '}<span className="text-laranja-600">Quanto disso a sua família usaria na segunda-feira?</span>
          </h2>
          <div className="mt-9 w-full max-w-4xl rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
            <MapaPatrimonio estudo={e} />
          </div>
          <div className="mt-6 grid w-full max-w-4xl gap-4 md:grid-cols-3">
            <Placar icone={Wallet} tom="neutro" rotulo="Patrimônio líquido"
              valor={brlCompacto(e.patrimonioLiquido)}
              texto={e.dividas > 0 ? `já descontadas as dívidas de ${brlCompacto(e.dividas)}` : 'sem dívidas a descontar'} />
            <Placar icone={Lock} tom="ruim" rotulo="Travado no inventário"
              valor={brlCompacto(e.bensInventariaveis)}
              texto="indisponível até o ITCMD ser pago — de meses a anos" />
            <Placar icone={PiggyBank} tom="bom" rotulo="Chega em dias"
              valor={brlCompacto(e.liquidezImediata)}
              texto={e.previdencia > 0
                ? 'previdência e seguro vão direto ao beneficiário'
                : 'só o seguro escapa do inventário'} />
          </div>
          <p className="mt-8 max-w-2xl text-center text-lg text-slate-600">
            {e.pctIliquido != null && e.pctIliquido >= 50 ? (
              <><strong className="text-slate-900">{e.pctIliquido}% do que você construiu</strong> não vira
              dinheiro rápido. Patrimônio grande e liquidez pequena é exatamente o perfil que
              obriga a família a vender bem abaixo do valor.</>
            ) : (
              <>Patrimônio não é liquidez. O que a família precisa no primeiro mês é <strong className="text-slate-900">dinheiro
              disponível</strong> — e é isso que o seguro entrega.</>
            )}
          </p>
        </Slide>
      )}

      {/* 8 · SUCESSÃO — o custo do inventário e o déficit de liquidez */}
      {e.tem014 && temPatrimonio && e.custoInventario > 0 && (
        <Slide nome="sucessao" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Sucessão e blindagem patrimonial</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            O inventário custa caro — e só libera os bens depois de pago
          </h2>
          <Revelar className="mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-red-100 bg-red-50/60 p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-500">A família precisa pagar</p>
              <p className="mt-3 font-display text-4xl font-semibold text-red-600 tabular">{brlCompacto(e.custoInventario)}</p>
              <p className="mt-1 text-sm font-semibold text-red-700">e espera de meses a anos pelos bens</p>
              <p className="mt-2 text-sm text-red-800/80">
                ITCMD ({e.itcmd.toFixed(1).replace('.', ',')}%) + custas e honorários
                {' '}({e.sucessao.custasEfetivas.toFixed(1).replace('.', ',')}%)
                sobre os {brlCompacto(e.sucessao.baseInventario)} que passam por inventário — pagos
                {' '}<strong>à vista, em dinheiro</strong>, antes de a família acessar qualquer bem.
                {e.sucessao.inventarioJudicial && ' Com herdeiro menor de idade o inventário é judicial por lei: mais lento e mais caro.'}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">O seguro entrega</p>
              <p className="mt-3 font-display text-4xl font-semibold text-emerald-600 tabular">{brlCompacto(e.valores.sucessao)}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">em dias, direto aos beneficiários</p>
              <p className="mt-2 text-sm text-emerald-900/80">
                O capital do seguro <strong>não entra em inventário</strong> e é livre de ITCMD na maioria
                dos estados.{' '}
                {Math.abs(e.valores.sucessao - e.custoInventario) < 1 ? (
                  <>O valor é o mesmo da conta ao lado de propósito:{' '}
                  <strong>o plano cobre o custo exato</strong>, sem sobra e sem falta.</>
                ) : e.valores.sucessao >= e.custoInventario ? (
                  <>Cobre a conta ao lado inteira e ainda deixa{' '}
                  <strong>{brlCompacto(e.valores.sucessao - e.custoInventario)}</strong> de folga para
                  a família se organizar.</>
                ) : (
                  <>Cobre <strong>{Math.round((e.valores.sucessao / e.custoInventario) * 100)}%</strong> da
                  conta ao lado — o restante ({brlCompacto(e.custoInventario - e.valores.sucessao)}) sai
                  do bolso da família.</>
                )}
              </p>
            </div>
          </Revelar>

          {/* O déficit: a conta que ninguém tinha feito */}
          {e.tem019 && (
            <div className="mt-6 w-full max-w-4xl rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">A conta do primeiro mês</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Conta rotulo="A família precisa pagar" valor={brlCompacto(e.custoInventario)} />
                <Conta rotulo="Tem disponível em dias" valor={brlCompacto(e.liquidezImediata)} sinal="−" />
                <Conta rotulo="Falta" valor={brlCompacto(e.deficitLiquidez)} sinal="="
                  destaque={e.deficitLiquidez > 0} ok={e.deficitLiquidez <= 0} />
              </div>
              <p className="mt-4 text-sm text-slate-500">
                {e.deficitLiquidez > 0 ? (
                  <>Sem esse dinheiro, a saída é vender um bem com pressa — e quem compra sabe disso.
                  {e.bensIliquidos > 0 && (
                    <> Um imóvel vendido com a urgência do inventário costuma sair 20% a 30% abaixo do
                    valor de mercado: para levantar {brlCompacto(e.deficitLiquidez)} líquidos, a família
                    entrega perto de <strong>{brlCompacto(e.deficitLiquidez / 0.75)}</strong> em bens.</>
                  )}
                  {e.sucessao.temHolding && ' A holding organiza a partilha e corta as custas, mas o ITCMD continua sendo pago em dinheiro.'}</>
                ) : (
                  <>A liquidez atual já cobre o inventário. O seguro entra para <strong>preservar essa reserva</strong> em
                  vez de consumi-la logo no primeiro mês.</>
                )}
              </p>
            </div>
          )}
        </Slide>
      )}

      {/* 8b · A LINHA DO TEMPO DO INVENTÁRIO — o que acontece mês a mês */}
      {e.tem019 && temPatrimonio && e.custoInventario > 0 && (
        <Slide nome="linha-inventario" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>O que acontece de verdade</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            A conta não espera o inventário terminar
          </h2>
          <p className="mt-4 max-w-2xl text-center text-slate-500">
            Este é o calendário que a família enfrenta —{' '}
            {e.sucessao.inventarioJudicial
              ? <>e como há <strong className="text-slate-700">herdeiro menor de idade</strong>, o rito
                é judicial por lei: cartório não resolve.</>
              : <>com todos os herdeiros maiores e de acordo, pelo rito mais rápido, o extrajudicial.</>}
          </p>

          <Revelar como="ol" className="mt-10 w-full max-w-3xl space-y-3">
            <Etapa marco="Semana 1" tom="ruim"
              titulo="As contas continuam chegando"
              texto={`Escola, condomínio, financiamento, plano de saúde. Some ${brl(e.custoVida)} por mês que
                     não param — e a renda de ${brl(e.renda)} parou.`} />
            <Etapa marco="Mês 1 a 3" tom="ruim"
              titulo={`ITCMD: ${brlCompacto(e.custoInventario)} à vista`}
              texto="O imposto vence antes de qualquer bem ser liberado. Sem ele pago, nada anda — e ele
                     se paga em dinheiro, não em imóvel." />
            <Etapa marco={`Até o mês ${e.sucessao.prazoInventarioMeses}`} tom="alerta"
              titulo={`Os ${brlCompacto(e.bensInventariaveis)} seguem travados`}
              texto={e.sucessao.inventarioJudicial
                ? 'Inventário judicial: audiências, prazos e a agenda do fórum. A média fica entre um ano e meio e dois anos.'
                : 'Inventário extrajudicial, o caminho rápido: ainda assim são meses até a escritura de partilha sair.'} />
            <Etapa marco="Enquanto isso" tom="ruim"
              titulo="A saída vira vender com pressa"
              texto="Quem compra de família com inventário aberto sabe que ela precisa vender. O deságio é a
                     conta invisível — e ela costuma ser maior que o próprio imposto." />
            <Etapa marco="Com o plano" tom="bom"
              titulo={`${brlCompacto(e.valores.sucessao)} em dias, direto aos beneficiários`}
              texto="O capital do seguro não entra em inventário e é livre de ITCMD na maioria dos estados.
                     A família paga o imposto no prazo, mantém o padrão de vida e não vende nada." />
          </Revelar>
        </Slide>
      )}

      {/* 9 · PLANEJAMENTO EMPRESARIAL */}
      {temEmpresa && (
        <Slide nome="empresa" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Planejamento empresarial</p>
          <h2 className="mt-3 max-w-3xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            A empresa não pode parar — e a sua família não pode virar sócia de ninguém
          </h2>
          <div className="mt-10 grid w-full max-w-5xl gap-5 md:grid-cols-3">
            {e.ativas.filter((c) => c.grupo === 'empresarial').map((c) => {
              const Icone = ICONE_COBERTURA[c.id] ?? Building2
              return (
                <div key={c.id} className="rounded-2xl border border-slate-200/70 bg-white p-7 shadow-card">
                  <div className="w-fit rounded-2xl bg-laranja-50 p-3.5 text-laranja-600"><Icone size={26} /></div>
                  <h3 className="mt-4 font-semibold text-slate-900">{c.curto}</h3>
                  <p className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular">{brlCompacto(c.valor)}</p>
                  <p className="mt-2 text-sm text-slate-500">{c.descricao}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-3 text-center">
            {e.pj.valuation > 0 && (
              <Placar icone={Building2} tom="neutro" rotulo="Valuation da empresa"
                valor={brlCompacto(e.pj.valuation)}
                texto={`sua participação: ${e.pj.participacao}%`} />
            )}
            {e.pj.faturamento > 0 && (
              <Placar icone={Briefcase} tom="neutro" rotulo="Faturamento anual"
                valor={brlCompacto(e.pj.faturamento)}
                texto={e.pj.lucro > 0 ? `lucro de ${brlCompacto(e.pj.lucro)}` : 'base do capital de homem-chave'} />
            )}
            {e.pj.dividaAval > 0 && (
              <Placar icone={Landmark} tom="ruim" rotulo="Dívidas avalizadas"
                valor={brlCompacto(e.pj.dividaAval)}
                texto="o aval não morre com o sócio: alcança o patrimônio da família" />
            )}
          </div>
          <p className="mt-8 max-w-2xl text-center text-lg text-slate-600">
            Sem capital, os sócios precisam comprar a sua quota do próprio bolso — ou conviver com
            herdeiros na sociedade. <strong className="text-slate-900">O seguro resolve isso à vista</strong>,
            no mês seguinte, sem discussão e sem processo.
          </p>
        </Slide>
      )}

      {/* 9b · APOSENTADORIA — só para quem veio por esse motivo */}
      {e.aposentadoria && e.focos.includes('aposentadoria') && (
        <Slide nome="aposentadoria" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Aposentadoria e acúmulo</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            Parar de trabalhar aos {e.aposentadoria.idadeAlvo} sem baixar o padrão de vida
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-canvas p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">A meta</p>
              <p className="mt-2 font-display text-3xl font-semibold text-slate-900 tabular">
                {brlCompacto(e.aposentadoria.capitalNecessario)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                é o capital que paga {brl(e.aposentadoria.alvoMensal)} por mês sem acabar
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">O caminho de hoje leva a</p>
              <p className="mt-2 font-display text-3xl font-semibold text-amber-700 tabular">
                {brlCompacto(e.aposentadoria.projetadoLiquido)}
              </p>
              <p className="mt-1 text-sm text-amber-900/80">
                em {e.aposentadoria.anos} anos, já descontado o imposto de renda —
                {' '}{brl(e.aposentadoria.rendaProjetada)} por mês
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-canvas p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Para chegar lá</p>
              <p className="mt-2 font-display text-3xl font-semibold text-slate-900 tabular">
                {e.aposentadoria.aporteNecessario != null
                  ? `${brl(e.aposentadoria.aporteNecessario)}` : '—'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                por mês, contra os {brl(e.aposentadoria.aporteAtual)} de hoje
              </p>
            </div>
          </div>
          <p className="mt-10 max-w-2xl text-center text-lg text-slate-600">
            Esse aporte sai da sua renda todo mês. Se a renda parar —
            {' '}<strong className="text-slate-900">e é justamente disso que este estudo trata</strong> —
            {' '}o plano de aposentadoria para no mesmo dia.{' '}
            {e.valores.invalidez > 0
              ? <>Com {brlCompacto(e.valores.invalidez)} de invalidez na apólice, ele continua de pé mesmo
                que você não possa mais trabalhar.</>
              : <>Proteger a renda é o que mantém o plano de aposentadoria vivo.</>}
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Projeção a {(e.aposentadoria.taxaReal * 100).toFixed(0)}% ao ano acima da inflação, em valores de hoje.
          </p>
        </Slide>
      )}

      {/* 10 · O GAP — quanto falta */}
      {temGap && (
        <Slide nome="gap" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>O que falta</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {e.gap > 0 ? 'A proteção atual não cobre o plano' : 'A proteção atual está no alvo'}
          </h2>
          <Revelar className="mt-12 w-full max-w-2xl space-y-6">
            <Barra rotulo="Você tem hoje" valor={e.coberturaAtual} max={Math.max(e.valores.morte, e.coberturaAtual)} cor="bg-slate-300" />
            <Barra rotulo="O plano recomenda" valor={e.valores.morte} max={Math.max(e.valores.morte, e.coberturaAtual)} cor="bg-laranja-500" />
          </Revelar>
          {e.gap > 0 && (
            <>
              <p className="mt-12 text-xl text-slate-600">
                Gap de proteção: <strong className="font-display text-3xl font-semibold text-red-600 tabular">{brlCompacto(e.gap)}</strong>
              </p>
              {e.recursosLiquidos > 0 && (
                <p className="mt-3 max-w-lg text-center text-sm text-slate-400">
                  Mesmo somando os {brlCompacto(e.recursosLiquidos)} de reservas e previdência,
                  ainda faltariam {brlCompacto(e.gapReal)} — e a reserva teria sido consumida.
                </p>
              )}
            </>
          )}
        </Slide>
      )}

      {/* 11 · O PLANO COMPLETO — o quadro da apólice, logo antes do preço */}
      <Slide nome="plano" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
        <p className={rotuloSecao}>{textoDe('plano').etiqueta ?? 'Seu plano completo'}</p>
        <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-slate-900">
          Tudo que {primeiroNome} passa a ter
        </h2>
        <div className={`mt-9 grid w-full gap-6 ${denso ? 'max-w-7xl lg:grid-cols-[2fr_1fr]' : 'max-w-6xl lg:grid-cols-[1.45fr_1fr]'}`}>
          {/* Quadro de coberturas, agrupado. Com muitas coberturas o quadro vira
              duas colunas e some com a descrição de cada linha — num slide, a
              lista precisa caber inteira na tela sem rolagem. */}
          {/* as duas colunas só a partir de sm: no celular cada cartão precisa
              da largura inteira, senão a lista empurra a página para o lado */}
          <div className={denso ? 'gap-5 sm:columns-2 [&>div]:break-inside-avoid' : 'space-y-4'}>
            {grupos.map((g) => (
              <div key={g.id} className={denso ? 'mb-4' : ''}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.rotulo}</p>
                <div className={denso ? 'space-y-1.5' : 'space-y-2'}>
                  {g.itens.map((c) => {
                    const Icone = ICONE_COBERTURA[c.id] ?? ShieldCheck
                    return (
                      <div key={c.id} className={`flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white shadow-card ${denso ? 'p-2.5' : 'gap-3.5 p-3.5'}`}>
                        <div className={`flex shrink-0 items-center justify-center rounded-xl bg-laranja-50 text-laranja-600 ${denso ? 'h-8 w-8' : 'h-10 w-10'}`}>
                          <Icone size={denso ? 16 : 18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{c.curto}</p>
                          {!denso && <p className="text-xs text-slate-400">{c.descricao}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-display text-base font-semibold tabular text-slate-900">
                            {c.tipo === 'diaria' ? `${brl(c.valor)}/dia` : brlCompacto(c.valor)}
                          </p>
                          {c.tipo === 'diaria' && c.dias > 0 && (
                            <p className="text-[11px] text-slate-400">até {c.dias} diárias · {brlCompacto(c.total)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Painel de significado — o total e o porquê */}
          <div className="relative flex flex-col justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-900 p-7 text-white">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-laranja-500/10 blur-3xl print:hidden" />
            <p className="relative text-xs font-semibold uppercase tracking-wide text-gold-400">Importância segurada total</p>
            <p className="relative mt-2 font-display text-4xl font-semibold tabular md:text-5xl">{brlCompacto(e.capitalTotal)}</p>
            {e.renda > 0 && (
              <p className="relative mt-1 text-sm font-medium text-gold-400">
                {Math.round(e.capitalTotal / (e.renda * 12))} anos da sua renda atual
              </p>
            )}
            <p className="relative mt-2 text-sm text-white/70">
              A amplitude total da sua proteção — capital que a família recebe conforme a necessidade
              de cada momento.
              {e.totalDiarias > 0 && <> Além disso, até <strong className="text-white">{brlCompacto(e.totalDiarias)}</strong> em diárias de afastamento e internação.</>}
            </p>
            {e.capitalMaximoEvento > 0 && e.capitalMaximoEvento < e.capitalTotal && (
              <p className="relative mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/70">
                As coberturas se acionam conforme o que acontece — morte e invalidez, por exemplo,
                nunca pagam juntas. Em um único acontecimento, a família recebe até{' '}
                <strong className="text-white">{brlCompacto(e.capitalMaximoEvento)}</strong>.
              </p>
            )}
            {e.temPJ && e.capitalPJ > 0 && (
              <div className="relative mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-white/60">Pessoal</p>
                  <p className="font-display text-lg font-semibold tabular">{brlCompacto(e.capitalPF)}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-white/60">Empresa</p>
                  <p className="font-display text-lg font-semibold tabular">{brlCompacto(e.capitalPJ)}</p>
                </div>
              </div>
            )}
            {plano.objetivos && (
              <div className="relative mt-5 rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">O que isso garante</p>
                <p className="mt-1 text-sm text-white/90">{plano.objetivos}</p>
              </div>
            )}
            {inv && (
              <p className="relative mt-5 text-sm text-white/80">
                Tudo isso por <strong className="font-display text-2xl font-semibold text-white">{brl(inv.mensal)}</strong>
                <span className="text-white/60">/mês</span>
                {inv.temDescontoAnual && (
                  <span className="text-white/60"> · ou {brl(inv.anual)} à vista no ano</span>
                )}
              </p>
            )}
          </div>
        </div>
      </Slide>

      {/* 12 · O INVESTIMENTO — mensal ou anual, a escolha é do cliente */}
      {inv && (
        <Slide nome="investimento" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>O investimento</p>
          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-slate-900">
            Quanto custa proteger tudo isso?
          </h2>
          <p className="mt-3 max-w-xl text-center text-slate-500">
            Você escolhe como pagar. As duas formas dão exatamente a mesma proteção.
          </p>

          {/* As duas formas, lado a lado */}
          <div className="mt-9 grid w-full max-w-3xl gap-5 md:grid-cols-2">
            <Opcao titulo="Mensal" escolhida={inv.formaPagamento === 'mensal'}
              valor={brl(inv.mensal)} unidade="/mês"
              linhas={[
                `${brl(inv.doze)} ao longo de 12 meses`,
                'débito ou cartão, sem alterar o fluxo do mês',
              ]} />
            <Opcao titulo="Anual à vista" escolhida={inv.formaPagamento === 'anual'}
              destaque={inv.temDescontoAnual}
              valor={brl(inv.anual)} unidade="/ano"
              selo={inv.descontoPct != null ? `${String(inv.descontoPct).replace('.', ',')}% de desconto` : null}
              linhas={[
                `equivale a ${brl(inv.mensalEquivalente)} por mês`,
                inv.economiaAnual > 0
                  ? `economia de ${brl(inv.economiaAnual)} por ano`
                  : 'pagamento único, sem cobrança mensal',
              ]} />
          </div>

          {/* O que esse valor significa */}
          <div className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card">
              <Coffee size={22} className="mx-auto text-laranja-600" />
              <p className="mt-2 font-display text-2xl font-semibold tabular text-slate-900">{brl(inv.diario)}</p>
              <p className="mt-1 text-sm text-slate-500">por dia — menos que um café com pão de queijo</p>
            </div>
            {inv.pctRenda != null && (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-card">
                <Scale size={22} className="mx-auto text-laranja-600" />
                <p className="mt-2 font-display text-2xl font-semibold tabular text-slate-900">{String(inv.pctRenda).replace('.', ',')}%</p>
                <p className="mt-1 text-sm text-slate-500">da renda mensal — o resto continua livre</p>
              </div>
            )}
            {inv.alavancagem != null && (
              <div className="rounded-2xl border border-laranja-200/70 bg-laranja-50/50 p-6 text-center shadow-card">
                <Heart size={22} className="mx-auto text-laranja-600" />
                <p className="mt-2 whitespace-nowrap font-display text-2xl font-semibold tabular text-slate-900">
                  {inv.alavancagem.toLocaleString('pt-BR')}×
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  cada R$ 1 investido protege R$ {inv.alavancagem.toLocaleString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          <p className="mt-8 max-w-xl text-center text-lg text-slate-600">
            {inv.pctRenda != null ? (
              <>Menos de <strong className="text-slate-900">{String(inv.pctRenda).replace('.', ',')}%</strong> da
              sua renda colocam até <strong className="text-slate-900">{brlCompacto(e.capitalMaximoEvento)}</strong> na
              mão da família</>
            ) : (
              <>Até <strong className="text-slate-900">{brlCompacto(e.capitalMaximoEvento)}</strong> na mão da família</>
            )}
            {' '}no momento em que ela mais precisar.
          </p>
          {e.previdenciaAporte > 0 && inv && (
            <p className="mt-8 max-w-2xl text-center text-lg text-slate-600">
              Para comparar: você já destina{' '}
              <strong className="text-slate-900">{brl(e.previdenciaAporte)}</strong> por mês à
              previdência, que só vale o valor cheio lá na frente. O plano custa{' '}
              <strong className="text-slate-900">
                {Math.round((inv.mensal / e.previdenciaAporte) * 100)}%
              </strong>{' '}
              disso — e vale o valor cheio já no mês que vem.
            </p>
          )}
          <p className="mt-6 max-w-lg text-center text-sm text-slate-400">
            Valores de referência cotados nas seguradoras para o plano completo — sujeitos à análise da proposta.
          </p>
        </Slide>
      )}

      {/* 12b · AS TRÊS FORMAS — a escolha que substitui o sim-ou-não.
          Só existe com cotação na mão: os valores dos outros níveis são
          proporcionais ao que a seguradora cotou, e isso está escrito no
          rodapé do slide. Um preço estimado impresso ao lado do nome do
          cliente seria lido como preço — e um preço que a apólice não cumpre
          é a pior forma de começar uma relação de vinte anos. */}
      {escada && escada.niveis.length >= 2 && (
        <Slide nome="niveis" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Como começar</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            {escada.niveis.length === 2 ? 'Duas formas' : 'Três formas'} de fazer isso
          </h2>
          <p className="mt-4 max-w-2xl text-center text-slate-500">
            Não é uma escolha entre proteger e não proteger. É entre começar por tudo ou começar
            pelo que mais pesa — e subir depois, quando fizer sentido.
          </p>

          <Revelar className={`mt-10 grid w-full gap-5 ${
            escada.niveis.length === 2 ? 'max-w-3xl md:grid-cols-2' : 'max-w-6xl lg:grid-cols-3'}`}>
            {escada.niveis.map((n) => {
              const defendido = n.id === escada.recomendadoId
              return (
                <div key={n.id}
                  className={`flex flex-col rounded-3xl border p-6 shadow-card ${defendido
                    ? 'border-laranja-300 bg-white ring-2 ring-laranja-300'
                    : 'border-slate-200/70 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-semibold text-slate-900">{n.rotulo}</p>
                    {defendido && (
                      <span className="rounded-full bg-laranja-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                        recomendado
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{n.tese}</p>

                  <p className="mt-5 font-display text-4xl font-semibold tabular text-slate-900">
                    {brl(n.mensal)}<span className="text-base font-medium text-slate-400">/mês</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-laranja-700">
                    {brlCompacto(n.capital)} de proteção
                  </p>

                  <div className="mt-5 space-y-1.5 border-t border-slate-200/70 pt-4">
                    {n.itens.map((i) => (
                      <p key={i.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-700">
                          <Check size={14} className="shrink-0 text-emerald-600" />
                          <span className="truncate">{i.rotulo}</span>
                        </span>
                        <span className="shrink-0 tabular text-slate-400">{brlCompacto(i.valor)}</span>
                      </p>
                    ))}
                  </div>

                  {n.descoberto.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Fica de fora
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {n.descoberto.map((x) => x.rotulo).join(' · ')}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </Revelar>

          <p className="mt-8 max-w-2xl text-center text-sm text-slate-400">
            O plano {escada.niveis.find((n) => n.id === escada.recomendadoId)?.rotulo.toLowerCase()} está
            cotado nas seguradoras. Os demais são proporcionais a ele, para dimensionar a escolha —
            a cotação final de cada desenho sai em minutos.
          </p>
        </Slide>
      )}

      {/* 12a · SE ACONTECER AMANHÃ — a comparação que decide */}
      {comp && anoUm && (
        <Slide nome="se-acontecer" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>A pergunta que ninguém faz</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            E se acontecesse no ano que vem?
          </h2>
          <p className="mt-4 max-w-2xl text-center text-slate-500">
            O mesmo dinheiro, os dois caminhos, no primeiro ano. É aqui que a diferença aparece —
            e ela não é de percentual, é de ordem de grandeza.
          </p>
          <Revelar className="mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-2">
            <Cenario tom="ruim" icone={Hourglass} etiqueta="Investindo o mesmo valor"
              numero={brlCompacto(anoUm.investidoLiquido)} unidade=""
              rodape={`${brl(inv.mensal)}/mês × 12, já descontado o imposto`}>
              É o que estaria na conta depois de um ano de aportes. Correto, disciplinado — e
              longe do que a sua família precisaria para manter tudo de pé.
            </Cenario>
            <Cenario tom="bom" icone={ShieldCheck} etiqueta="Com o plano"
              numero={brlCompacto(anoUm.seguroMorte)} unidade=""
              rodape="disponível desde a primeira parcela paga">
              O capital não espera acumular. Ele existe inteiro no dia seguinte ao da assinatura —
              e é isso que um plano de proteção faz que um plano de acúmulo não faz.
            </Cenario>
          </Revelar>
          <p className="mt-10 max-w-2xl text-center text-lg text-slate-600">
            A diferença no primeiro ano é de{' '}
            <strong className="text-slate-900">{brlCompacto(anoUm.descoberto)}</strong>.
            {comp.anoDoCruzamento
              ? <> Investindo, esse buraco só fecha no <strong className="text-slate-900">ano {comp.anoDoCruzamento}</strong> —
                e o risco não combinou de esperar até lá.</>
              : <> Investindo, esse buraco não fecha nem em {comp.premissas.anos} anos.</>}
          </p>
        </Slide>
      )}

      {/* 12b · INVESTIR OU PROTEGER — a objeção mais comum, respondida com conta */}
      {e.acumularEmVezDeSegurar && (
        <Slide nome="investir-ou-proteger" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Uma pergunta justa</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            “Não seria melhor investir esse dinheiro?”
          </h2>
          <p className="mt-4 max-w-2xl text-center text-slate-500">
            É a pergunta certa — e a resposta não é escolher um dos dois. É olhar o prazo.
          </p>
          <div className="mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-7 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Investindo os mesmos</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900 tabular">
                {brl(e.acumularEmVezDeSegurar.aporteMensal)}<span className="text-base font-normal text-slate-400">/mês</span>
              </p>
              <p className="mt-4 font-display text-5xl font-semibold text-slate-900 tabular">
                {e.acumularEmVezDeSegurar.anos != null
                  ? `${String(e.acumularEmVezDeSegurar.anos).replace('.', ',')}`
                  : '∞'}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-700">
                {e.acumularEmVezDeSegurar.anos != null ? 'anos até chegar ao capital' : 'não chega'}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                {e.acumularEmVezDeSegurar.partindoDe > 0 && (
                  <>Partindo dos {brlCompacto(e.acumularEmVezDeSegurar.partindoDe)} que você já tem
                  aplicados, </>
                )}
                a {(e.acumularEmVezDeSegurar.taxaReal * 100).toFixed(0)}% ao ano acima da inflação.
                {' '}<strong>E o risco não espera esse prazo.</strong>
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-7 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Com o plano</p>
              <p className="mt-2 font-display text-2xl font-semibold text-emerald-700 tabular">
                {brl(e.acumularEmVezDeSegurar.aporteMensal)}<span className="text-base font-normal text-emerald-600/70">/mês</span>
              </p>
              <p className="mt-4 font-display text-5xl font-semibold text-emerald-600 tabular">1</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">mês até valer o capital inteiro</p>
              <p className="mt-3 text-sm text-emerald-900/80">
                Da primeira parcela paga, os {brlCompacto(e.acumularEmVezDeSegurar.alvo)} já estão
                garantidos. É a única aplicação que vale o valor cheio no dia seguinte.
              </p>
            </div>
          </div>
          <p className="mt-10 max-w-2xl text-center text-lg text-slate-600">
            Investimento e seguro <strong className="text-slate-900">não competem</strong> — o seguro é
            justamente o que impede o seu investimento de ser consumido no pior momento.
          </p>
        </Slide>
      )}

      {/* 12b2 · O GRÁFICO DO CRUZAMENTO — a prova, ano a ano */}
      {comp && (
        <Slide nome="cruzamento" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>A conta, ano a ano</p>
          <h2 className="mt-3 max-w-3xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            {comp.anoDoCruzamento
              ? `O investimento só alcança o seguro no ano ${comp.anoDoCruzamento}`
              : `Em ${comp.premissas.anos} anos, o investimento não alcança o seguro`}
          </h2>
          <div className="mt-8 w-full max-w-5xl">
            <ComparadorCurvas comp={comp} altura={300} anotar={false} />
          </div>
          <p className="mt-8 max-w-3xl text-center text-lg text-slate-600">
            A área riscada é <strong className="text-slate-900">o que faltaria à sua família</strong>{' '}
            se acontecesse naquele ano. Ela é maior justamente no começo — quando a reserva ainda não
            existe, os filhos são menores e o financiamento está no início.
          </p>
          <p className="mt-4 max-w-3xl text-center text-sm text-slate-400">
            Projeção a {(comp.premissas.taxaReal * 100).toFixed(1).replace('.', ',')}% ao ano acima da
            inflação, comparando com {comp.premissas.alternativa === 'pgbl' ? 'PGBL' : 'VGBL'}, com a
            tabela regressiva de imposto de renda
            {comp.premissas.deducaoAnual > 0 && ` e creditando ${brl(comp.premissas.deducaoAnual)} por ano de dedução no IR`}.
            Em valores de hoje.
          </p>
        </Slide>
      )}

      {/* 12b3 · CADA COISA SERVE PARA UMA COISA — inclusive onde o outro ganha */}
      {comp && (
        <Slide nome="dimensoes" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>Lado a lado, sem torcida</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            Cada coisa serve para uma coisa
          </h2>
          <Revelar className="mt-9 grid w-full max-w-5xl gap-3 md:grid-cols-2">
            {DIMENSOES_COMPARACAO.map((d) => {
              const ganhaSeguro = d.vencedor === 'seguro'
              const ganhaOutro = d.vencedor === 'investimento' || d.vencedor === 'pgbl'
              return (
                <div key={d.id}
                  className={`rounded-2xl border p-5 ${ganhaSeguro ? 'border-emerald-200 bg-emerald-50/40'
                    : ganhaOutro ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200/70 bg-white'}`}>
                  <p className="text-sm font-semibold text-slate-900">{d.pergunta}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p className={ganhaSeguro ? 'font-semibold text-emerald-800' : 'text-slate-600'}>
                      <span className="text-xs uppercase tracking-wide text-slate-400">Seguro · </span>
                      {d.seguro}
                    </p>
                    <p className={ganhaOutro ? 'font-semibold text-blue-800' : 'text-slate-600'}>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {comp.premissas.alternativa === 'pgbl' ? 'PGBL · ' : 'VGBL · '}
                      </span>
                      {comp.premissas.alternativa === 'pgbl' ? d.pgbl : d.vgbl}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{d.nota}</p>
                </div>
              )
            })}
          </Revelar>
          <p className="mt-9 max-w-3xl text-center text-lg text-slate-600">
            Repare que <strong className="text-slate-900">o investimento ganha duas linhas dessa
            tabela</strong> — e é para ganhar mesmo. Ele acumula mais no longo prazo e você tira o
            dinheiro quando quiser. O seguro não está aqui para render mais que ele:
            {' '}<strong className="text-slate-900">está para o dinheiro existir no dia em que não
            houve tempo de acumular</strong>. Os dois continuam no seu plano.
          </p>
        </Slide>
      )}

      {/* 12c · O CUSTO DA ESPERA — a resposta ao "depois eu contrato" */}
      {e.custoDaEspera && (
        <Slide nome="custo-espera" className="flex min-h-screen flex-col items-center justify-center bg-white p-5 sm:p-8 print:min-h-0 print:py-24">
          <p className={rotuloSecao}>O preço de deixar para depois</p>
          <h2 className="mt-3 max-w-2xl text-center text-3xl font-semibold tracking-tight text-slate-900">
            Esperar não é neutro. Esperar tem preço.
          </h2>
          <p className="mt-4 max-w-2xl text-center text-slate-500">
            O prêmio acompanha a idade. Este é o mesmo plano, contratado mais tarde:
          </p>
          <div className={`mt-10 grid w-full gap-5 ${e.custoDaEspera.cenarios.length > 2 ? 'max-w-5xl md:grid-cols-4' : 'max-w-3xl md:grid-cols-3'}`}>
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 p-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Hoje · {e.custoDaEspera.idade} anos
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-emerald-600 tabular">
                {brl(e.custoDaEspera.mensalHoje)}
              </p>
              <p className="mt-1 text-sm text-emerald-700">por mês</p>
            </div>
            {e.custoDaEspera.cenarios.map((c) => (
              <div key={c.daquiAAnos} className="rounded-2xl border border-slate-200/70 bg-canvas p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Em {c.daquiAAnos} ano{c.daquiAAnos > 1 ? 's' : ''} · {c.idadeNaEpoca} anos
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-slate-900 tabular">
                  {brl(c.mensal)}
                </p>
                <p className="mt-1 text-sm text-red-600">
                  +{String(c.aMaisPct).replace('.', ',')}% · {brl(c.aMaisPorAno)} a mais por ano
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-center text-lg text-slate-600">
            E o preço é a parte menor.{' '}
            <strong className="text-slate-900">A sua saúde de hoje é o melhor ativo que você tem
            na análise da seguradora</strong> — e ela não volta. Um exame alterado no meio do caminho
            muda a conversa de lugar: deixa de ser quanto custa e passa a ser se ainda dá para contratar.
          </p>
          <p className="mt-6 text-xs text-slate-400">
            Estimativa pela curva de agravamento por idade{e.custoDaEspera.fumante && ', com o agravo de fumante'}.
            A cotação definitiva vem da seguradora.
          </p>
        </Slide>
      )}

      {/* 13 · PRÓXIMOS PASSOS */}
      <Slide nome="passos" className="flex min-h-screen flex-col items-center justify-center bg-canvas p-5 sm:p-8 print:min-h-0 print:py-24">
        <p className={rotuloSecao}>Como ativamos o plano</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Quatro passos simples</h2>
        <Revelar className="mt-10 grid max-w-4xl gap-5 md:grid-cols-4">
          <Passo n={1} icone={ClipboardCheck} titulo="Declaração de saúde"
            texto="Você responde a DPS pelo link que eu envio — leva poucos minutos." />
          <Passo n={2} icone={Search} titulo="Análise da seguradora"
            texto="A seguradora avalia o perfil e confirma as condições." />
          <Passo n={3} icone={FileSignature} titulo="Emissão da apólice"
            texto="Assinatura digital e proteção ativa desde o primeiro pagamento." />
          <Passo n={4} icone={Handshake} titulo="Acompanhamento"
            texto="Revisão anual do plano — a proteção acompanha a sua vida." />
        </Revelar>
        {(plano.conjuge_nome || e.filhos.length > 0) && (
          <p className="mt-9 flex items-center gap-2 text-sm text-slate-500">
            <Users size={15} className="text-laranja-600" />
            Na emissão indicamos os beneficiários — é o que faz o capital chegar em dias, fora do inventário.
          </p>
        )}
      </Slide>

      {/* 14 · FECHAMENTO */}
      <Slide nome="fechamento" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-slate-900 p-5 sm:p-8 text-center text-white print:min-h-0 print:py-24">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold-400/10 blur-3xl print:hidden" />
        <div className="relative mb-10"><Logo claro tamanho={52} /></div>
        <h2 className="relative max-w-2xl text-3xl font-semibold leading-snug tracking-tight md:text-4xl">
          {textoDe('fechamento').titulo ?? 'O melhor dia para proteger sua família foi ontem.'}<br />
          <span className="text-gold-400">
            {textoDe('fechamento').destaque ?? 'O segundo melhor é hoje.'}
          </span>
        </h2>
        {plano.objetivos && (
          <p className="relative mt-6 max-w-xl text-white/70">
            Você me disse o que quer garantir: <span className="text-white">“{plano.objetivos}”</span>.
            Esse plano existe exatamente para isso acontecer — com ou sem você por perto.
          </p>
        )}
        <p className="relative mt-8 text-lg text-white/80">Vamos ativar seu plano, {primeiroNome}?</p>
        <p className="relative mt-12 text-sm text-white/50">
          Valores sujeitos à análise da seguradora. Estudo elaborado por Natália Maschendorf em {new Date().toLocaleDateString('pt-BR')}.
        </p>
      </Slide>
    </div>
    </ContextoQuadro.Provider>
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

function Cartao({ icone: Icone, titulo, children }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-7 text-center shadow-card">
      <div className="mx-auto w-fit rounded-2xl bg-laranja-50 p-3.5 text-laranja-600"><Icone size={26} /></div>
      <h3 className="mt-4 font-semibold text-slate-900">{titulo}</h3>
      <p className="mt-2 text-sm text-slate-500">{children}</p>
    </div>
  )
}

// Coluna do slide de autonomia: um número grande com o cenário que o explica
const TOM_CENARIO = {
  ruim: { caixa: 'border-red-100 bg-red-50/60', etiqueta: 'text-red-500', numero: 'text-red-600', texto: 'text-red-900/70', icone: 'text-red-400' },
  alerta: { caixa: 'border-amber-100 bg-amber-50/60', etiqueta: 'text-amber-600', numero: 'text-amber-600', texto: 'text-amber-900/70', icone: 'text-amber-500' },
  bom: { caixa: 'border-emerald-100 bg-emerald-50/60', etiqueta: 'text-emerald-600', numero: 'text-emerald-600', texto: 'text-emerald-900/70', icone: 'text-emerald-500' },
}

function Cenario({ tom, icone: Icone, etiqueta, numero, unidade, rodape, children }) {
  const c = TOM_CENARIO[tom]
  return (
    <div className={`flex flex-col rounded-2xl border p-7 text-center ${c.caixa}`}>
      <Icone size={26} className={`mx-auto ${c.icone}`} />
      <p className={`mt-3 text-xs font-semibold uppercase tracking-wide ${c.etiqueta}`}>{etiqueta}</p>
      <p className={`mt-2 font-display text-5xl font-semibold tabular ${c.numero}`}>{numero}</p>
      <p className={`text-sm ${c.texto}`}>{unidade}</p>
      <p className={`mt-2 flex-1 text-sm ${c.texto}`}>{children}</p>
      {/* O tempo sozinho engana: vender tudo dura muito e termina em nada.
          O rodapé diz o que sobra no fim, que é a comparação que importa. */}
      {rodape && (
        <p className={`mt-4 border-t pt-3 text-xs font-semibold uppercase tracking-wide ${c.etiqueta} ${
          tom === 'bom' ? 'border-emerald-200' : tom === 'alerta' ? 'border-amber-200' : 'border-red-200'}`}>
          {rodape}
        </p>
      )}
    </div>
  )
}

const TOM_PLACAR = {
  neutro: 'border-slate-200/70 bg-white text-slate-900',
  bom: 'border-emerald-100 bg-emerald-50/60 text-emerald-700',
  ruim: 'border-red-100 bg-red-50/60 text-red-700',
}

function Placar({ icone: Icone, tom, rotulo, valor, texto }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-card ${TOM_PLACAR[tom]}`}>
      <div className="flex items-center gap-2">
        <Icone size={16} className="opacity-70" />
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{rotulo}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular">{valor}</p>
      <p className="mt-1 text-sm text-slate-500">{texto}</p>
    </div>
  )
}

// Linha da conta do inventário: precisa pagar − tem disponível = falta
// Um degrau da linha do tempo do inventário: quando, o que acontece e por quê.
function Etapa({ marco, titulo, texto, tom = 'neutro' }) {
  const cor = tom === 'ruim' ? 'border-red-200 bg-red-50/50'
    : tom === 'alerta' ? 'border-amber-200 bg-amber-50/50'
      : tom === 'bom' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200/70 bg-white'
  const marca = tom === 'ruim' ? 'text-red-600'
    : tom === 'alerta' ? 'text-amber-700' : tom === 'bom' ? 'text-emerald-600' : 'text-slate-400'
  return (
    <li className={`flex flex-col gap-1 rounded-2xl border p-5 sm:flex-row sm:gap-5 ${cor}`}>
      <p className={`shrink-0 text-xs font-semibold uppercase tracking-wide sm:w-32 ${marca}`}>{marco}</p>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{titulo}</p>
        <p className="mt-0.5 text-sm text-slate-600">{texto}</p>
      </div>
    </li>
  )
}

function Conta({ rotulo, valor, sinal, destaque, ok }) {
  const caixa = destaque ? 'border-red-200 bg-red-50/60'
    : ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200/70 bg-slate-50/60'
  const tinta = destaque ? 'text-red-600' : ok ? 'text-emerald-600' : 'text-slate-900'
  return (
    <div className={`rounded-xl border p-4 ${caixa}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {sinal && <span className="mr-1 font-semibold text-slate-300">{sinal}</span>}{rotulo}
      </p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular ${tinta}`}>{valor}</p>
    </div>
  )
}

// Forma de pagamento: as duas com o mesmo peso visual, a escolhida em destaque
function Opcao({ titulo, valor, unidade, linhas, selo, escolhida, destaque }) {
  return (
    <div className={`relative rounded-3xl border p-7 text-center shadow-card ${
      escolhida ? 'border-laranja-300 bg-laranja-50/40 ring-2 ring-laranja-200'
        : destaque ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200/70 bg-white'}`}>
      {escolhida && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-laranja-500 px-3 py-0.5 text-xs font-semibold text-white">
          sua escolha
        </span>
      )}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-slate-900 tabular">
        {valor}<span className="text-lg font-normal text-slate-400">{unidade}</span>
      </p>
      {selo && (
        <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          {selo}
        </span>
      )}
      <ul className="mt-4 space-y-1.5 text-sm text-slate-500">
        {linhas.filter(Boolean).map((l) => (
          <li key={l} className="flex items-start justify-center gap-1.5">
            <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" /> {l}
          </li>
        ))}
      </ul>
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
