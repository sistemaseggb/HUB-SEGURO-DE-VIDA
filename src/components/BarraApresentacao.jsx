import { useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, PenLine, Highlighter, Eraser, MousePointer2,
  Undo2, Redo2, Trash2, LayoutGrid, SlidersHorizontal, EyeOff, Eye, X, Check,
  Minimize2, RotateCcw, Save, Hand, MoveUpRight, ListChecks, Timer,
} from 'lucide-react'
import { brl } from '../lib/format'
import { ALAVANCAS, ESPESSURAS, TINTAS } from '../lib/apresentacao'

// ─────────────────────────────────────────────────────────────────────────────
// A BARRA DA APRESENTADORA — os controles que ficam ao alcance do polegar.
//
// Ela está de iPad na mão, compartilhando a tela, olhando o cliente. Isso
// governa cada decisão desta barra:
//
//   · EMBAIXO, não em cima. Segurando o iPad, o polegar alcança a base da
//     tela; o topo exige trocar a mão de posição no meio da frase.
//   · ALVOS GRANDES. Nada abaixo de 48px. Um botão de 32px acerta no mouse e
//     erra na terceira tentativa com o aparelho na mão.
//   · SOME QUANDO ELA QUER. Um toque recolhe tudo numa pastilha: a hora de
//     deixar o slide limpo é dela, não do programa.
//   · ESCURA E TRANSLÚCIDA. Funciona igual sobre os slides brancos e sobre a
//     capa escura, sem precisar de dois temas.
//
// O que NÃO tem aqui: nada que grave sozinho. Guardar desenho é decisão dela,
// e a barra pergunta uma vez, no fim, quando de fato há algo novo.
// ─────────────────────────────────────────────────────────────────────────────

const FERRAMENTAS = [
  { id: 'apontar', icone: Hand, rotulo: 'Passar', tecla: 'A', dica: 'A caneta volta a rolar a página e clicar nos botões' },
  { id: 'laser', icone: MousePointer2, rotulo: 'Apontar', tecla: 'L', dica: 'Rastro que apaga sozinho — para mostrar sem sujar' },
  { id: 'caneta', icone: PenLine, rotulo: 'Caneta', tecla: 'C', dica: 'Escreve e circula, com a pressão da Apple Pencil' },
  { id: 'marcador', icone: Highlighter, rotulo: 'Marcador', tecla: 'M', dica: 'Grifa por cima sem esconder o texto' },
  { id: 'seta', icone: MoveUpRight, rotulo: 'Seta', tecla: 'S', dica: 'Puxe de um ponto ao outro: sai reta, com a ponta fechada' },
  { id: 'borracha', icone: Eraser, rotulo: 'Borracha', tecla: 'E', dica: 'Encoste num traço e ele some inteiro' },
]

const DESENHA = new Set(['caneta', 'marcador', 'seta'])

// ── Cronômetro da reunião ────────────────────────────────────────────────────
// Componente próprio, com o relógio dele: se o tempo morasse no estado da
// proposta, os 21 capítulos e as telas de desenho seriam redesenhados a cada
// segundo. Aqui só este número pisca.
function Cronometro({ desde }) {
  const [, tique] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tique((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const seg = Math.max(0, Math.floor((Date.now() - desde) / 1000))
  const mm = String(Math.floor(seg / 60)).padStart(2, '0')
  const ss = String(seg % 60).padStart(2, '0')
  return (
    <span className="inline-flex items-center gap-1.5 px-2 text-xs tabular text-slate-400"
      title="Tempo desde o início da apresentação">
      <Timer size={14} /> {mm}:{ss}
    </span>
  )
}

function Botao({ icone: Icone, rotulo, ativo, aviso, onClick, title, desabilitado, soIcone }) {
  return (
    <button type="button" onClick={onClick} title={title ?? rotulo} disabled={desabilitado}
      aria-label={rotulo}
      aria-pressed={ativo === undefined ? undefined : ativo}
      className={`flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5
        text-[10px] font-medium transition-colors disabled:opacity-30
        ${ativo ? 'bg-laranja-500 text-white'
          : aviso ? 'bg-gold-400 text-slate-900 hover:bg-gold-500'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
      <Icone size={20} />
      {!soIcone && <span className="hidden sm:block">{rotulo}</span>}
    </button>
  )
}

export default function BarraApresentacao({
  slideAtual, totalSlides, nomes, irPara, avancar, alternarPulado,
  etapa, etapasDoSlide, revelando, alternarRevelacao, inicioReuniao,
  ferramenta, mudarFerramenta,
  desfazer, podeDesfazer, refazer, podeRefazer, limparSlide, temTracosNoSlide,
  desenhosPendentes, guardarDesenhos,
  simulando, alternarSimulacao,
  escuro, alternarEscuro,
  sair, children,
}) {
  const [recolhida, setRecolhida] = useState(false)
  const [indice, setIndice] = useState(false)

  if (recolhida) {
    return (
      <button type="button" onClick={() => setRecolhida(false)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900/80 px-5 py-2.5
          text-xs font-medium text-slate-200 shadow-lg backdrop-blur transition hover:bg-slate-900
          print:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        {slideAtual + 1} / {totalSlides} · mostrar controles
      </button>
    )
  }

  return (
    <>
      {/* índice: pular para qualquer capítulo sem passar por todos */}
      {indice && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden"
          onClick={() => setIndice(false)}>
          <div className="mb-24 max-h-[70vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-slate-900 p-3 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}>
            <p className="px-2 pb-2 text-xs text-slate-400">
              Toque para ir ao capítulo. No olho, você tira um capítulo desta reunião —
              nada é apagado do estudo, ele só deixa de aparecer ao avançar.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {nomes.map((n, i) => (
                <div key={n.slide + i}
                  className={`flex min-h-12 items-center gap-1 rounded-xl pr-1 transition-colors
                    ${i === slideAtual ? 'bg-laranja-500 text-white' : 'text-slate-300 hover:bg-white/10'}`}>
                  <button type="button" onClick={() => { irPara(i); setIndice(false) }}
                    className={`flex min-h-12 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm
                      ${n.pulado ? 'line-through opacity-40' : ''}`}>
                    <span className="w-6 shrink-0 text-xs tabular opacity-60">{i + 1}</span>
                    <span className="flex-1 truncate">{n.titulo}</span>
                    {n.anotado && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-400" title="tem anotação" />}
                  </button>
                  {/* Nem todo cliente merece o deck inteiro: um solteiro sem
                      filhos não precisa do capítulo de sucessão, e passar por
                      ele "porque está no roteiro" é o que torna a apresentação
                      chata. Aqui ela desliga e a navegação passa por cima. */}
                  <button type="button" onClick={() => alternarPulado(i)}
                    aria-label={n.pulado ? `Trazer de volta: ${n.titulo}` : `Pular nesta reunião: ${n.titulo}`}
                    aria-pressed={!!n.pulado}
                    title={n.pulado ? 'Trazer este capítulo de volta' : 'Pular este capítulo nesta reunião'}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg opacity-60 hover:bg-white/10 hover:opacity-100">
                    {n.pulado ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tudo o que a apresentadora opera fica EMPILHADO no mesmo canto de
          baixo. Painel, tintas e controles em posições fixas independentes se
          atropelavam no iPad em pé, onde a barra quebra em duas linhas e
          escondia a caixa de canetas — o defeito só aparecia de pé. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {children}

        {/* tintas e espessura — só aparecem quando há o que pintar */}
        {DESENHA.has(ferramenta.tipo) && (
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 rounded-full bg-slate-900/92 px-3 py-2 shadow-xl backdrop-blur">
            {TINTAS.map((t, i) => (
              <button key={t.id} type="button" title={`${t.rotulo} (tecla ${i + 1})`}
                onClick={() => mudarFerramenta({ ...ferramenta, cor: t.cor })}
                aria-label={`Tinta ${t.rotulo}`}
                aria-pressed={ferramenta.cor === t.cor}
                className={`h-10 w-10 rounded-full border-2 transition-transform
                  ${ferramenta.cor === t.cor ? 'scale-110 border-white' : 'border-white/25 hover:border-white/60'}`}
                style={{ background: t.cor }} />
            ))}
            <span className="mx-0.5 h-7 w-px bg-white/15" />
            {/* Fino para escrever um número no meio do texto, grosso para
                circular um título de longe. O disco mostra a espessura de
                verdade, em vez de exigir que ela leia "médio". */}
            {ESPESSURAS.map((e) => (
              <button key={e.id} type="button" title={`Traço ${e.rotulo.toLowerCase()}`}
                onClick={() => mudarFerramenta({ ...ferramenta, espessura: e.id })}
                aria-label={`Espessura ${e.rotulo}`}
                aria-pressed={(ferramenta.espessura ?? 'medio') === e.id}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors
                  ${(ferramenta.espessura ?? 'medio') === e.id
                    ? 'border-white bg-white/15' : 'border-transparent hover:bg-white/10'}`}>
                <span className="block rounded-full bg-white"
                  style={{ width: `${4 + e.fator * 5}px`, height: `${4 + e.fator * 5}px` }} />
              </button>
            ))}
          </div>
        )}

        <div className="flex w-full max-w-6xl flex-wrap items-center justify-center gap-0.5 bg-slate-900/92 px-2 py-2
            shadow-[0_-8px_30px_rgba(2,6,23,0.35)] backdrop-blur sm:mx-3 sm:mb-3 sm:w-auto sm:rounded-2xl">

          {/* navegação */}
          <Botao icone={ChevronLeft} rotulo="Voltar" soIcone onClick={() => avancar(-1)}
            desabilitado={slideAtual === 0 && etapa === 0} title="Voltar um passo (←)" />
          <button type="button" onClick={() => setIndice(true)}
            className="flex h-12 items-center gap-2 rounded-xl px-3 text-slate-200 hover:bg-white/10"
            title="Índice dos capítulos">
            <LayoutGrid size={18} />
            <span className="text-sm tabular">
              {slideAtual + 1}<span className="opacity-50">/{totalSlides}</span>
              {revelando && etapasDoSlide > 0 && (
                <span className="ml-1 text-[10px] opacity-60">·{etapa}/{etapasDoSlide}</span>
              )}
            </span>
          </button>
          <Botao icone={ChevronRight} rotulo="Avançar" soIcone onClick={() => avancar(1)}
            desabilitado={slideAtual >= totalSlides - 1 && etapa >= etapasDoSlide}
            title="Avançar um passo (→ ou espaço)" />

          <span className="mx-1 h-8 w-px bg-white/10" />

          {/* ferramentas */}
          {FERRAMENTAS.map((f) => (
            <Botao key={f.id} icone={f.icone} rotulo={f.rotulo}
              title={`${f.rotulo} (${f.tecla}) — ${f.dica}`}
              ativo={ferramenta.tipo === f.id}
              onClick={() => mudarFerramenta({ ...ferramenta, tipo: f.id })} />
          ))}
          <Botao icone={Undo2} rotulo="Desfazer" onClick={desfazer} desabilitado={!podeDesfazer}
            title="Desfazer — vale para traço, borracha e limpar (Ctrl+Z)" />
          <Botao icone={Redo2} rotulo="Refazer" onClick={refazer} desabilitado={!podeRefazer}
            title="Refazer o que acabou de ser desfeito (Ctrl+Shift+Z)" />
          <Botao icone={Trash2} rotulo="Limpar" onClick={limparSlide} desabilitado={!temTracosNoSlide}
            title="Apagar tudo que foi desenhado neste slide" />

          <span className="mx-1 h-8 w-px bg-white/10" />

          {/* a reunião */}
          <Botao icone={ListChecks} rotulo="Partes" ativo={revelando} onClick={alternarRevelacao}
            title="Revelar o capítulo por partes, no seu ritmo, em vez de abrir tudo de uma vez" />
          <Botao icone={SlidersHorizontal} rotulo="Simular" ativo={simulando} onClick={alternarSimulacao}
            title='Mexer nos números na frente do cliente — sem alterar o planejamento' />
          <Botao icone={escuro ? Eye : EyeOff} rotulo={escuro ? 'Voltar' : 'Apagar'} onClick={alternarEscuro}
            title="Tela preta: a atenção volta para a conversa (tecla B)" />
          {desenhosPendentes && (
            <Botao icone={Save} rotulo="Guardar" aviso onClick={guardarDesenhos}
              title="Guardar os desenhos deste cliente" />
          )}

          <span className="mx-1 h-8 w-px bg-white/10" />
          {inicioReuniao && <Cronometro desde={inicioReuniao} />}
          <Botao icone={Minimize2} rotulo="Sair" onClick={sair} title="Sair da apresentação" />
          <Botao icone={X} rotulo="Ocultar" soIcone onClick={() => setRecolhida(true)}
            title="Ocultar — esconde os controles e deixa o slide limpo" />
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// O PAINEL DA SIMULAÇÃO — "e se fosse mil e duzentos?"
//
// Até aqui a resposta honesta era "eu refaço e te mando". Agora ela mexe no
// número na frente do cliente e a proposta inteira se recalcula: capital,
// gráficos, comparador. O que ela NÃO faz é gravar — e a tela diz isso o tempo
// todo, em amarelo, porque um número de hipótese passando por definitivo seria
// o pior defeito que esta tela poderia ter.
// ─────────────────────────────────────────────────────────────────────────────
export function PainelSimulacao({ plano, simulacao, mudar, limpar, fechar }) {
  const valorDe = (campo) => {
    const s = simulacao[campo]
    if (s != null) return Number(s)
    const p = Number(plano?.[campo] ?? 0)
    return Number.isFinite(p) ? p : 0
  }

  return (
    // Sem posição própria: quem empilha é a barra, para o painel nunca cobrir
    // os controles nem sumir atrás deles quando a barra quebra em duas linhas.
    //
    // E BAIXO de propósito. A primeira versão tinha um cartão alto, com barra
    // deslizante em cada alavanca, e cobria dois terços do slide: ela mexia no
    // prêmio e o cliente não via o número mudar — que é a coisa inteira.
    <div className="mb-2 w-[min(64rem,calc(100vw-1rem))] rounded-2xl border border-white/10
        bg-slate-900 p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
          Simulação ao vivo · nada aqui é salvo
        </p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={limpar}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white">
            <RotateCcw size={14} /> Voltar ao planejamento
          </button>
          <button type="button" onClick={fechar} aria-label="Fechar a simulação"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ALAVANCAS.map((a) => {
          const v = valorDe(a.campo)
          const original = Number(plano?.[a.campo] ?? 0)
          const mexido = simulacao[a.campo] != null && Number(simulacao[a.campo]) !== original
          const passo = (dir) => mudar(a.campo, Math.min(a.max, Math.max(a.min, v + dir * a.passo)))
          return (
            <div key={a.campo} title={a.ajuda}
              className={`flex items-center gap-2 rounded-xl p-2 ${mexido ? 'bg-gold-400/15' : 'bg-white/5'}`}>
              <button type="button" onClick={() => passo(-1)} aria-label={`Diminuir ${a.rotulo}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg text-white hover:bg-white/20">−</button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-[10px] uppercase tracking-wide text-slate-400">{a.curto ?? a.rotulo}</p>
                <p className="truncate font-display text-base font-semibold tabular text-white">
                  {a.prefixo ? brl(v) : `${v} ${a.sufixo ?? ''}`.trim()}
                </p>
                {mexido && (
                  <p className="truncate text-[10px] tabular text-gold-400">
                    era {a.prefixo ? brl(original) : original}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => passo(1)} aria-label={`Aumentar ${a.rotulo}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg text-white hover:bg-white/20">+</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// A PERGUNTA DO FIM — guardar ou descartar.
//
// A consultora pediu explicitamente liberdade para decidir. Então o sistema
// não guarda sozinho (ela acabaria com meses de rabisco em cima das propostas)
// nem joga fora sozinho (ela perderia o desenho que sustentou a conversa).
// Pergunta uma vez, na saída, e só quando existe de fato algo novo.
// ─────────────────────────────────────────────────────────────────────────────
export function PerguntaDesenhos({ quantos, slides, guardar, descartar, cancelar, salvando }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Guardar os desenhos desta reunião?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Você desenhou em <strong className="text-slate-900">{slides} {slides === 1 ? 'capítulo' : 'capítulos'}</strong>
          {' '}({quantos} {quantos === 1 ? 'traço' : 'traços'}). Guardando, eles reaparecem quando você abrir a
          proposta de novo — e o cliente também os vê pelo link.
        </p>
        <div className="mt-6 space-y-2">
          <button type="button" onClick={guardar} disabled={salvando}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-laranja-500 px-4
              font-medium text-white transition hover:bg-laranja-600 disabled:opacity-60">
            <Check size={18} /> {salvando ? 'Guardando…' : 'Guardar os desenhos'}
          </button>
          <button type="button" onClick={descartar} disabled={salvando}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200
              px-4 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
            <Trash2 size={18} /> Descartar
          </button>
          <button type="button" onClick={cancelar} disabled={salvando}
            className="min-h-11 w-full rounded-xl px-4 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-60">
            Voltar à apresentação
          </button>
        </div>
      </div>
    </div>
  )
}
