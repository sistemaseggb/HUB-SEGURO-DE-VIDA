import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileAudio, Upload, Sparkles, Copy, Check, Trash2, Clock3, MessageSquareQuote,
  ShieldAlert, Flame, ListChecks, CalendarPlus, Wand2, RefreshCw, ChevronDown,
  Users2, AlertTriangle, Wallet,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  analisarTranscricao, resumoExecutivo, resumoParaCliente, perguntasQueFaltaram,
} from '../lib/transcricao.js'
import { calcularEstudo } from '../lib/estudo.js'
import { brl, dataBR, hojeLocal } from '../lib/format'
import { Button, Card, Input, Select, Spinner, ComoFunciona, Badge } from '../components/ui'
import { useToast } from '../components/toastContexto'

// ─────────────────────────────────────────────────────────────────────────────
// ABA TRANSCRIÇÃO — a reunião vira material de trabalho.
//
// A consultora grava com o Tactiq e sai com 40 minutos de texto. Aqui ela cola
// (ou solta o arquivo) e recebe, na hora: o resumo executivo pronto para as
// notas, os números que o cliente disse em voz alta prontos para entrar no
// planejamento sem redigitar, as objeções com a resposta sugerida, os
// compromissos virando tarefa e um diagnóstico de como a reunião foi conduzida.
//
// A análise roda no navegador (src/lib/transcricao.js) e não depende de
// internet nem de chave de API. Nada é gravado no planejamento sem ela
// conferir: cada número extraído vem com o trecho que serve de prova.
// ─────────────────────────────────────────────────────────────────────────────

const CONSULTORA = 'Natália Maschendorf'

// Rótulo de cada campo que a análise sabe devolver para o planejamento.
const ROTULO_CAMPO = {
  renda_mensal: 'Renda mensal',
  custo_vida_mensal: 'Custo de vida mensal',
  dividas_total: 'Dívidas totais',
  patrimonio_total: 'Patrimônio total',
  patrimonio_imoveis: 'Imóveis',
  patrimonio_investimentos: 'Investimentos',
  patrimonio_veiculos: 'Veículos',
  previdencia_saldo: 'Previdência',
  premio_estimado: 'Prêmio mensal',
  premio_anual: 'Prêmio anual',
  pj_faturamento_anual: 'Faturamento da empresa',
  pj_valuation: 'Valor da empresa',
  pj_participacao_pct: 'Participação societária',
  estado_civil: 'Estado civil',
  conjuge_nome: 'Cônjuge',
  profissao: 'Profissão',
  dependentes: 'Filhos',
}

// Colunas que só existem depois da migração 019
const CAMPOS_019 = new Set([
  'patrimonio_imoveis', 'patrimonio_investimentos', 'patrimonio_veiculos',
  'previdencia_saldo', 'premio_anual', 'pj_faturamento_anual', 'pj_valuation',
  'pj_participacao_pct',
])

const TOM_TEMPERATURA = {
  quente: { texto: 'Oportunidade quente', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  morna: { texto: 'Oportunidade morna', cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  fria: { texto: 'Oportunidade fria', cor: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export default function AbaTranscricao({ idCliente, cliente }) {
  const toast = useToast()
  const [lista, setLista] = useState(null)
  const [texto, setTexto] = useState('')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeLocal)
  const [origem, setOrigem] = useState('tactiq')
  const [editando, setEditando] = useState(null)
  const [plano, setPlano] = useState(null)
  const [colunas, setColunas] = useState({ tem019: false })
  const [aceitos, setAceitos] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [semTabela, setSemTabela] = useState(false)
  const [avancada, setAvancada] = useState(null)
  const [pensando, setPensando] = useState(false)
  const arquivoRef = useRef(null)

  const carregar = useCallback(async () => {
    const [t, p, probe] = await Promise.all([
      supabase.from('transcricoes').select('*').eq('id_cliente', idCliente)
        .order('data_reuniao', { ascending: false }),
      supabase.from('planejamentos').select('*').eq('id_cliente', idCliente).maybeSingle(),
      supabase.from('planejamentos').select('tipo_planejamento').limit(1),
    ])
    // a migração 020 pode ainda não ter sido aplicada
    if (t.error) { setSemTabela(true); setLista([]) } else setLista(t.data ?? [])
    setPlano(p.data ?? {})
    setColunas({ tem019: !probe.error })
  }, [idCliente])

  useEffect(() => { carregar() }, [carregar])

  // A análise é derivada do texto: recalcula sozinha a cada colagem.
  const analise = useMemo(() => {
    if (texto.trim().length < 40) return null
    try {
      return analisarTranscricao(texto, {
        nomeCliente: cliente?.nome ?? '', nomeConsultora: CONSULTORA,
      })
    } catch { return null }
  }, [texto, cliente?.nome])

  const resumo = useMemo(
    () => (analise ? resumoExecutivo(analise, { nomeCliente: cliente?.nome, data }) : ''),
    [analise, cliente?.nome, data])
  // O resumo interno tem nota de condução, objeções e estratégia. O do cliente
  // é só o "combinamos isso" — mandar o errado seria constrangedor.
  const resumoCliente = useMemo(
    () => (analise ? resumoParaCliente(analise, { nomeCliente: cliente?.nome }) : ''),
    [analise, cliente?.nome])
  const [versaoResumo, setVersaoResumo] = useState('interno')
  const resumoVisivel = versaoResumo === 'cliente' ? resumoCliente : resumo

  // Quando a análise muda, pré-marcamos só o que o planejamento ainda não tem:
  // o trabalho já feito pela consultora nunca é sobrescrito por padrão.
  useEffect(() => {
    if (!analise || !plano) return
    const marcas = {}
    for (const v of analise.valores) {
      if (!(v.campo in ROTULO_CAMPO)) continue
      if (CAMPOS_019.has(v.campo) && !colunas.tem019) continue
      const atual = Number(plano[v.campo])
      marcas[v.campo] = !(atual > 0)
    }
    const f = analise.familia
    if (f.estadoCivil) marcas.estado_civil = !plano.estado_civil
    if (f.conjuge) marcas.conjuge_nome = !plano.conjuge_nome
    if (f.profissao) marcas.profissao = !plano.profissao
    if (f.filhos.length > 0) marcas.dependentes = !(Array.isArray(plano.dependentes) && plano.dependentes.length > 0)
    if (f.participacaoPJ != null && colunas.tem019) marcas.pj_participacao_pct = !(Number(plano.pj_participacao_pct) > 0)
    setAceitos(marcas)
  }, [analise, plano, colunas.tem019])

  function abrirArquivo(arquivo) {
    if (!arquivo) return
    if (arquivo.size > 5_000_000) return toast.erro('Arquivo muito grande (máximo 5 MB).')
    const leitor = new FileReader()
    leitor.onload = () => {
      setTexto(String(leitor.result ?? ''))
      if (!titulo) setTitulo(arquivo.name.replace(/\.[^.]+$/, ''))
      toast.ok('Transcrição carregada. Confira a análise abaixo.')
    }
    leitor.onerror = () => toast.erro('Não consegui ler o arquivo.')
    leitor.readAsText(arquivo, 'utf-8')
  }

  async function salvar() {
    if (!analise) return toast.erro('Cole a transcrição antes de salvar.')
    setSalvando(true)
    const payload = {
      id_cliente: idCliente,
      titulo: titulo.trim() || `Reunião de ${dataBR(data)}`,
      data_reuniao: data,
      origem,
      texto,
      analise,
      resumo,
    }
    const q = editando
      ? supabase.from('transcricoes').update(payload).eq('id', editando)
      : supabase.from('transcricoes').insert(payload)
    const { error } = await q
    setSalvando(false)
    if (error) return toast.erro(`Erro ao salvar: ${error.message}`)
    toast.ok(editando ? 'Transcrição atualizada.' : 'Transcrição salva.')
    setEditando(null)
    carregar()
  }

  async function aplicarNoPlanejamento() {
    if (!analise) return
    const payload = { id_cliente: idCliente }
    let quantos = 0

    for (const v of analise.valores) {
      if (!aceitos[v.campo]) continue
      if (CAMPOS_019.has(v.campo) && !colunas.tem019) continue
      payload[v.campo] = v.valor
      quantos += 1
    }
    const f = analise.familia
    if (aceitos.estado_civil && f.estadoCivil) { payload.estado_civil = f.estadoCivil; quantos += 1 }
    if (aceitos.conjuge_nome && f.conjuge) { payload.conjuge_nome = f.conjuge; quantos += 1 }
    if (aceitos.profissao && f.profissao) { payload.profissao = f.profissao; quantos += 1 }
    if (aceitos.pj_participacao_pct && f.participacaoPJ != null && colunas.tem019) {
      payload.pj_participacao_pct = f.participacaoPJ; quantos += 1
    }
    if (aceitos.dependentes && f.filhos.length > 0) {
      payload.dependentes = f.filhos.map((x) => ({
        nome: x.nome || '', idade: x.idade, custo_mensal: null,
      }))
      payload.num_dependentes = f.filhos.length
      quantos += 1
    }

    if (quantos === 0) return toast.info('Nenhum campo marcado para aplicar.')
    const { error } = await supabase.from('planejamentos')
      .upsert(payload, { onConflict: 'id_cliente' })
    if (error) return toast.erro(`Erro ao aplicar: ${error.message}`)
    toast.ok(`${quantos} campo(s) aplicados no planejamento.`)
    carregar()
  }

  async function criarTarefa(compromisso) {
    const { error } = await supabase.from('tarefas').insert({
      id_cliente: idCliente,
      titulo: compromisso.texto.slice(0, 120),
      descricao: `Compromisso assumido na reunião de ${dataBR(data)}${compromisso.prazo ? ` · prazo citado: ${compromisso.prazo}` : ''}`,
      tipo: 'contato',
      automatica: false,
    })
    if (error) return toast.erro(`Erro ao criar tarefa: ${error.message}`)
    toast.ok('Tarefa criada na aba Tarefas.')
  }

  async function anexarAsNotas() {
    const atual = plano?.observacoes_reuniao ? `${plano.observacoes_reuniao}\n\n` : ''
    const { error } = await supabase.from('planejamentos')
      .upsert({ id_cliente: idCliente, observacoes_reuniao: atual + resumo }, { onConflict: 'id_cliente' })
    if (error) return toast.erro(`Erro: ${error.message}`)
    toast.ok('Resumo anexado às Notas da reunião (aba Planejamento).')
    carregar()
  }

  function copiarResumo() {
    navigator.clipboard.writeText(versaoResumo === 'cliente' ? resumoCliente : resumo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // Camada opcional: manda a transcrição para o Claude pela Edge Function e
  // volta com a leitura mais fina. Sem a chave configurada, a função responde
  // 501 e a tela segue com a análise local — nada aqui é pré-requisito.
  async function analiseAvancada() {
    if (!analise) return
    if (typeof supabase.functions?.invoke !== 'function') {
      return toast.info('A análise avançada precisa do Supabase conectado (não funciona no modo demonstração).')
    }
    setPensando(true)
    // Mandamos o estudo já calculado, não um resumo em prosa: com os números na
    // mão o modelo critica os capitais em vez de adivinhar pelo texto.
    const estudo = plano ? calcularEstudo(plano, { dataNascimento: cliente?.data_nascimento }) : null
    const resumoEstudo = estudo && {
      idade: estudo.idade,
      renda_mensal: estudo.renda,
      custo_vida_mensal: estudo.custoVida,
      dividas: estudo.dividas,
      patrimonio_bruto: estudo.patrimonioBruto,
      custo_inventario: estudo.custoInventario,
      deficit_liquidez: estudo.deficitLiquidez,
      anos_protecao: estudo.anos,
      focos: estudo.focos,
      coberturas: estudo.ativas.map((c) => ({ nome: c.curto, valor: c.valor })),
      importancia_segurada_total: estudo.capitalTotal,
      premio_mensal: estudo.investimento?.mensal ?? null,
      falta_preencher: estudo.completude.faltando,
      conferencias_abertas: estudo.inconsistencias.map((i) => i.texto),
    }
    const { data, error } = await supabase.functions.invoke('analisar-reuniao', {
      body: { texto, cliente_nome: cliente?.nome, estudo: resumoEstudo },
    })
    setPensando(false)
    if (error || !data?.ok) {
      const motivo = data?.erro === 'sem_chave'
        ? 'A análise avançada não está configurada (falta a chave da Anthropic no Supabase). O resumo abaixo continua valendo.'
        : data?.mensagem || 'Não consegui rodar a análise avançada agora. O resumo abaixo continua valendo.'
      return toast.erro(motivo)
    }
    setAvancada(data.analise)
    toast.ok('Análise avançada pronta.')
  }

  function abrirSalva(t) {
    setEditando(t.id)
    setTexto(t.texto)
    setTitulo(t.titulo ?? '')
    setData(t.data_reuniao)
    setOrigem(t.origem ?? 'tactiq')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta transcrição? O texto e a análise serão perdidos.')) return
    const { error } = await supabase.from('transcricoes').delete().eq('id', id)
    if (error) return toast.erro(`Erro ao excluir: ${error.message}`)
    if (editando === id) { setEditando(null); setTexto('') }
    toast.ok('Transcrição excluída.')
    carregar()
  }

  function limpar() {
    setEditando(null); setTexto(''); setTitulo('')
    setData(hojeLocal())
  }

  if (lista === null) return <Spinner />

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <ComoFunciona id="transcricao" titulo="Como usar a transcrição da reunião">
          Termine a reunião, abra o <strong>Tactiq</strong> e copie a transcrição (ou baixe o arquivo e
          solte aqui). O sistema lê a conversa e devolve na hora: o <strong>resumo executivo</strong>,
          os <strong>números que o cliente falou</strong> prontos para entrar no planejamento, as{' '}
          <strong>objeções com a resposta sugerida</strong>, os compromissos assumidos e um raio-X de
          como a reunião foi conduzida. Nada vai para o planejamento sem você conferir.
        </ComoFunciona>

        {semTabela && (
          <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
            Rode a migração <strong>020_transcricoes_reuniao.sql</strong> no Supabase para salvar as
            transcrições. Até lá, a análise funciona normalmente aqui na tela — só não fica guardada.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_170px_170px]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Título da reunião</span>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder={`Reunião com ${cliente?.nome?.split(' ')[0] ?? 'o cliente'}`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Data</span>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Origem</span>
            <Select value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="tactiq">Tactiq</option>
              <option value="meet">Google Meet</option>
              <option value="zoom">Zoom</option>
              <option value="manual">Digitada / outra</option>
            </Select>
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-600">Transcrição</span>
            <div className="flex items-center gap-2">
              <input ref={arquivoRef} type="file" className="hidden"
                accept=".txt,.vtt,.srt,.md,.csv,text/plain"
                onChange={(e) => { abrirArquivo(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" onClick={() => arquivoRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800">
                <Upload size={13} /> Subir arquivo
              </button>
              {texto && (
                <button type="button" onClick={limpar}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:text-slate-700">
                  Limpar
                </button>
              )}
            </div>
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); abrirArquivo(e.dataTransfer.files?.[0]) }}
            rows={texto ? 8 : 6}
            spellCheck={false}
            placeholder={'Cole aqui a transcrição do Tactiq — ou arraste o arquivo para esta área.\n\n'
              + 'Funciona com os formatos:\n'
              + '  00:01:23 Natália Maschendorf: Qual a sua renda hoje?\n'
              + '  Carlos: Ganho R$ 20 mil por mês.\n'
              + '  WEBVTT (Zoom) e texto corrido também.'}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-laranja-400 focus:ring-2 focus:ring-laranja-100" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {texto ? `${texto.length.toLocaleString('pt-BR')} caracteres` : 'Nada colado ainda'}
              {analise && ` · ${analise.falas} falas · ${analise.palavras.toLocaleString('pt-BR')} palavras`}
            </span>
            <div className="flex items-center gap-2">
              {editando && <Badge tom="yellow">editando uma transcrição salva</Badge>}
              <Button onClick={salvar} disabled={!analise || salvando || semTabela}>
                {salvando ? 'Salvando...' : editando ? 'Atualizar transcrição' : 'Salvar transcrição'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {texto.trim().length >= 40 && !analise && (
        <Card className="p-5">
          <p className="text-sm text-slate-500">
            Não consegui separar as falas desse texto. Cole a transcrição completa do Tactiq —
            com os nomes dos participantes — para a análise funcionar.
          </p>
        </Card>
      )}

      {analise && (
        <>
          <PainelLeitura a={analise} />
          <PainelExtracao
            a={analise} plano={plano} aceitos={aceitos} setAceitos={setAceitos}
            tem019={colunas.tem019} aoAplicar={aplicarNoPlanejamento} />
          <PainelPerfil a={analise} />
          <PainelConversa a={analise} aoCriarTarefa={criarTarefa} />
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Sparkles size={13} className="text-laranja-600" />
                {versaoResumo === 'cliente' ? 'Resumo para mandar ao cliente' : 'Resumo executivo'}
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="flex overflow-hidden rounded-xl border border-slate-300">
                  {[['interno', 'Para você'], ['cliente', 'Para o cliente']].map(([id, rot]) => (
                    <button key={id} type="button" onClick={() => setVersaoResumo(id)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        versaoResumo === id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                      {rot}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" onClick={copiarResumo}>
                  {copiado ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar</>}
                </Button>
                <Button variant="secondary" onClick={anexarAsNotas}>
                  <Wand2 size={15} /> Anexar às notas da reunião
                </Button>
                <Button onClick={analiseAvancada} disabled={pensando}>
                  <Sparkles size={15} /> {pensando ? 'Analisando...' : 'Aprofundar com IA'}
                </Button>
              </div>
            </div>
            {versaoResumo === 'cliente' && (
              <p className="mb-2 text-xs text-slate-400">
                Sem nota de condução, sem objeções, sem estratégia — só o que combinaram.
                Pronto para colar no WhatsApp ou no e-mail.
              </p>
            )}
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 text-xs leading-relaxed text-slate-700">
              {resumoVisivel}
            </pre>
          </Card>
          {avancada && <PainelAvancado a={avancada} />}
        </>
      )}

      {lista.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Clock3 size={13} className="text-laranja-600" /> Reuniões transcritas ({lista.length})
          </p>
          <ul className="divide-y divide-slate-100">
            {lista.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <FileAudio size={16} className="shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {t.titulo || 'Sem título'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {dataBR(t.data_reuniao)} · {t.origem}
                    {t.analise?.nota != null && ` · nota ${t.analise.nota}/100`}
                    {t.analise?.temperatura && ` · ${t.analise.temperatura}`}
                    {t.analise?.duracaoMin ? ` · ${t.analise.duracaoMin} min` : ''}
                  </p>
                </div>
                <button onClick={() => abrirSalva(t)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-laranja-300 hover:text-laranja-700">
                  <RefreshCw size={12} className="mr-1 inline" /> Abrir e reanalisar
                </button>
                <button onClick={() => excluir(t.id)} title="Excluir"
                  className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ─── O que a conversa revelou além dos números ───────────────────────────────
// Idade e tabagismo mudam o prêmio. O seguro que ele já tem muda o argumento.
// Quem decide e em quanto tempo muda o follow-up. Nada disso é número, e tudo
// isso decide a venda — a consultora relia a transcrição atrás dessas frases.
function PainelPerfil({ a }) {
  const p = a.perfil ?? {}
  const faltam = perguntasQueFaltaram(a)
  const itens = [
    p.idade && { icone: Clock3, rotulo: 'Idade', valor: `${p.idade.valor} anos`, trecho: p.idade.trecho },
    p.fumante && {
      icone: AlertTriangle,
      rotulo: 'Tabagismo',
      valor: p.fumante.valor ? 'Fumante — o prêmio sobe' : 'Não fumante',
      trecho: p.fumante.trecho,
      alerta: p.fumante.valor,
    },
    p.saude && {
      icone: AlertTriangle, rotulo: 'Saúde', valor: p.saude.termo,
      trecho: p.saude.trecho, alerta: true,
      nota: 'Vai aparecer na DPS. Levante os detalhes antes de cotar.',
    },
    p.motivo && { icone: MessageSquareQuote, rotulo: 'Por que ele veio', valor: p.motivo.termo, trecho: p.motivo.trecho },
    p.quemDecide && { icone: Users2, rotulo: 'Quem decide', valor: p.quemDecide.valor, trecho: p.quemDecide.trecho },
    p.prazoDecisao && { icone: Clock3, rotulo: 'Prazo', valor: p.prazoDecisao.valor, trecho: p.prazoDecisao.trecho },
    p.orcamento && { icone: Wallet, rotulo: 'Orçamento declarado', valor: `${brl(p.orcamento.valor)}/mês`, trecho: p.orcamento.trecho },
    p.outrosDependentes && {
      icone: Users2, rotulo: 'Também depende dele', valor: 'Ajuda os pais',
      trecho: p.outrosDependentes.trecho,
      nota: 'Entra no custo de vida e no capital de morte.',
    },
    p.numSocios && { icone: Users2, rotulo: 'Sócios', valor: `${p.numSocios.valor} na sociedade`, trecho: p.numSocios.trecho },
  ].filter(Boolean)

  if (itens.length === 0 && p.seguros?.length === 0 && faltam.length === 0) return null

  return (
    <Card className="p-5">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Users2 size={13} className="text-laranja-600" /> O perfil que a conversa revelou
      </p>

      {itens.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((it) => {
            const Icone = it.icone
            return (
              <div key={it.rotulo}
                className={`rounded-xl border p-3 ${it.alerta ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200/70 bg-white'}`}>
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
                  <Icone size={12} className={it.alerta ? 'text-amber-600' : 'text-slate-400'} /> {it.rotulo}
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{it.valor}</p>
                {it.nota && <p className="mt-1 text-xs text-amber-800">{it.nota}</p>}
                {it.trecho && (
                  <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-xs italic text-slate-400">
                    “{it.trecho}”
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {p.seguros?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            O que ele já tem — e por que não basta
          </p>
          <ul className="space-y-2">
            {p.seguros.map((seg) => (
              <li key={seg.origem} className="rounded-xl border border-slate-200/70 bg-white p-3">
                <p className="text-sm font-medium capitalize text-slate-800">{seg.origem}</p>
                {seg.trecho && <p className="mt-0.5 text-xs italic text-slate-400">“{seg.trecho}”</p>}
                {seg.alerta && <p className="mt-1.5 text-xs text-slate-600">{seg.alerta}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {faltam.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            O que ainda falta perguntar
          </p>
          <ul className="space-y-1">
            {faltam.map((q) => (
              <li key={q} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 text-laranja-500">▹</span> {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

// ─── Como a reunião foi conduzida ────────────────────────────────────────────
function PainelLeitura({ a }) {
  const temp = TOM_TEMPERATURA[a.temperatura] ?? TOM_TEMPERATURA.fria
  const notas = [
    ['Roteiro percorrido', a.notas.roteiro, 25],
    ['Escuta (o cliente falou)', a.notas.escuta, 25],
    ['Descoberta (números)', a.notas.descoberta, 25],
    ['Avanço (próximo passo)', a.notas.avanco, 25],
  ]
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
                stroke={a.nota >= 75 ? '#0e9f6e' : a.nota >= 50 ? '#d96527' : '#dc2626'}
                strokeDasharray={`${(a.nota / 100) * 97.4} 97.4`} />
            </svg>
            <span className="absolute font-display text-sm font-bold text-slate-700">{a.nota}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Como esta reunião foi conduzida</p>
            <p className="text-xs text-slate-500">
              {a.duracaoMin ? `${a.duracaoMin} minutos · ` : ''}
              {a.perguntasConsultora} perguntas · o cliente falou {a.pctCliente}% do tempo
            </p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${temp.cor}`}>
          <Flame size={12} className="mr-1 inline" />{temp.texto}
        </span>
      </div>

      {/* quem falou quanto */}
      <div className="mt-4 space-y-2">
        {a.falantes.map((f) => (
          <div key={f.nome}>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span className="text-slate-600">
                {f.nome}
                {f.papel && <span className="ml-1.5 text-slate-400">
                  ({f.papel === 'cliente' ? 'cliente' : 'consultora'})</span>}
              </span>
              <span className="tabular text-slate-500">{f.pct}% · {f.perguntas} perguntas</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${f.papel === 'cliente' ? 'bg-emerald-500' : 'bg-laranja-500'}`}
                style={{ width: `${Math.max(f.pct, 1)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {notas.map(([rotulo, valor, max]) => (
          <div key={rotulo} className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
            <p className={`font-display text-lg font-semibold tabular-nums ${
              valor >= max * 0.75 ? 'text-emerald-600' : valor >= max * 0.4 ? 'text-slate-900' : 'text-red-600'}`}>
              {valor}<span className="text-sm font-normal text-slate-400">/{max}</span>
            </p>
          </div>
        ))}
      </div>

      {/* blocos do roteiro */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {a.roteiro.map((r) => (
          <span key={r.id} title={r.objetivo}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              r.cobriu ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
            {r.cobriu ? '✓ ' : '○ '}{r.titulo}
          </span>
        ))}
      </div>

      {a.recomendacoes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
          {a.recomendacoes.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="mt-0.5 text-laranja-500">▹</span> {r}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ─── O que o cliente contou, pronto para virar planejamento ──────────────────
function PainelExtracao({ a, plano, aceitos, setAceitos, tem019, aoAplicar }) {
  const [abrirProva, setAbrirProva] = useState(null)
  const marcar = (campo) => setAceitos((x) => ({ ...x, [campo]: !x[campo] }))

  const linhas = []
  for (const v of a.valores) {
    if (!(v.campo in ROTULO_CAMPO)) continue
    const bloqueado = CAMPOS_019.has(v.campo) && !tem019
    linhas.push({
      campo: v.campo, rotulo: ROTULO_CAMPO[v.campo], novo: brl(v.valor),
      atual: Number(plano?.[v.campo]) > 0 ? brl(Number(plano[v.campo])) : null,
      trecho: v.trecho, bloqueado,
    })
  }
  const f = a.familia
  if (f.estadoCivil) linhas.push({ campo: 'estado_civil', rotulo: 'Estado civil', novo: f.estadoCivil, atual: plano?.estado_civil ?? null })
  if (f.conjuge) linhas.push({ campo: 'conjuge_nome', rotulo: 'Cônjuge', novo: f.conjuge, atual: plano?.conjuge_nome ?? null })
  if (f.profissao) linhas.push({ campo: 'profissao', rotulo: 'Profissão', novo: f.profissao, atual: plano?.profissao ?? null })
  if (f.participacaoPJ != null) {
    linhas.push({
      campo: 'pj_participacao_pct', rotulo: 'Participação societária', novo: `${f.participacaoPJ}%`,
      atual: Number(plano?.pj_participacao_pct) > 0 ? `${plano.pj_participacao_pct}%` : null,
      bloqueado: !tem019,
    })
  }
  if (f.filhos.length > 0) {
    linhas.push({
      campo: 'dependentes', rotulo: 'Filhos',
      novo: f.filhos.map((x) => `${x.nome || 'filho(a)'} (${x.idade})`).join(', '),
      atual: Array.isArray(plano?.dependentes) && plano.dependentes.length > 0
        ? `${plano.dependentes.length} já cadastrado(s)` : null,
    })
  }

  if (linhas.length === 0) {
    return (
      <Card className="p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ListChecks size={13} className="text-laranja-600" /> O que dá para aplicar no planejamento
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Nenhum número ou dado de família apareceu nesta conversa. Retome pelo bloco{' '}
          <strong>Descoberta</strong> do roteiro: renda, custo de vida, patrimônio, dívidas e as
          idades dos filhos são a base do estudo.
        </p>
      </Card>
    )
  }

  const marcados = linhas.filter((l) => aceitos[l.campo] && !l.bloqueado).length

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ListChecks size={13} className="text-laranja-600" /> O que dá para aplicar no planejamento
        </p>
        <Button onClick={aoAplicar} disabled={marcados === 0}>
          <Wand2 size={15} /> Aplicar {marcados > 0 ? `${marcados} campo(s)` : ''}
        </Button>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Vêm marcados apenas os campos que o planejamento ainda não tem — o que você já preencheu
        continua como está. Clique no trecho para ver onde o cliente disse cada número.
      </p>
      <ul className="divide-y divide-slate-100">
        {linhas.map((l) => (
          <li key={l.campo} className="py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <input type="checkbox" checked={!!aceitos[l.campo] && !l.bloqueado} disabled={l.bloqueado}
                onChange={() => marcar(l.campo)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-laranja-600 focus:ring-laranja-500 disabled:opacity-40" />
              <span className="min-w-0 flex-1 text-sm text-slate-700">{l.rotulo}</span>
              {/* "hoje: X → X" é ruído: quando o valor bate, o que importa é
                  saber que a conversa confirmou o que já estava lá */}
              {l.atual === l.novo ? (
                <span className="text-xs text-emerald-600">✓ confirma o planejamento</span>
              ) : l.atual ? (
                <span className="text-xs text-slate-400">
                  hoje: <span className="tabular">{l.atual}</span> →
                </span>
              ) : null}
              <span className={`font-display text-sm font-semibold tabular ${
                l.atual === l.novo ? 'text-slate-400' : 'text-slate-900'}`}>{l.novo}</span>
              {l.bloqueado && <Badge tom="yellow">requer migração 019</Badge>}
              {l.trecho && (
                <button type="button" onClick={() => setAbrirProva(abrirProva === l.campo ? null : l.campo)}
                  className="rounded p-1 text-slate-300 hover:text-slate-600" title="Ver onde foi dito">
                  <ChevronDown size={14} className={abrirProva === l.campo ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
              )}
            </div>
            {abrirProva === l.campo && l.trecho && (
              <p className="ml-7 mt-1.5 rounded-lg bg-slate-50 p-2 text-xs italic text-slate-500">
                “{l.trecho}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ─── Leitura aprofundada (opcional, vem da Edge Function) ────────────────────
function PainelAvancado({ a }) {
  const [copiado, setCopiado] = useState(false)
  const bloco = (titulo, itens, render) => (itens?.length > 0 ? (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <ul className="space-y-2">{itens.map(render)}</ul>
    </div>
  ) : null)

  return (
    <Card className="border-laranja-200/70 p-5">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-laranja-700">
        <Sparkles size={13} /> Leitura aprofundada da reunião
      </p>

      <div className="space-y-4">
        {a.resumo && <p className="text-sm leading-relaxed text-slate-700">{a.resumo}</p>}

        {a.temperatura && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/70 bg-white p-3">
            <Badge tom={a.temperatura === 'quente' ? 'red' : a.temperatura === 'morna' ? 'amber' : 'slate'}>
              oportunidade {a.temperatura}
            </Badge>
            {a.por_que_essa_temperatura && (
              <span className="min-w-0 flex-1 text-sm text-slate-700">{a.por_que_essa_temperatura}</span>
            )}
          </div>
        )}

        {a.perfil_cliente && (
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Como este cliente decide</p>
            <p className="mt-1 text-sm text-slate-700">{a.perfil_cliente}</p>
          </div>
        )}

        {bloco('Momentos decisivos', a.momentos_decisivos, (m, i) => (
          <li key={i} className="rounded-xl border border-slate-200/70 bg-white p-3">
            <p className="text-sm italic text-slate-600">“{m.citacao}”</p>
            <p className="mt-1 text-sm text-slate-700">{m.por_que_importa}</p>
          </li>
        ))}

        {bloco('Dores identificadas', a.dores, (d, i) => (
          <li key={i} className="rounded-xl border border-slate-200/70 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">{d.dor}</p>
            {d.evidencia && <p className="mt-0.5 text-xs italic text-slate-500">“{d.evidencia}”</p>}
            <p className="mt-1 text-sm text-slate-700">{d.como_enderecar}</p>
          </li>
        ))}

        {a.leitura_do_estudo && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              O que a conversa diz sobre o estudo
            </p>
            <p className="mt-1 text-sm text-slate-700">{a.leitura_do_estudo}</p>
          </div>
        )}

        {bloco('Coberturas para enfatizar com ele', a.coberturas_a_enfatizar, (c, i) => (
          <li key={i} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="text-sm font-semibold text-emerald-900">{c.cobertura}</p>
            <p className="mt-1 text-sm text-slate-700">{c.por_que_para_ele}</p>
          </li>
        ))}

        {bloco('Perguntas que ficaram para a próxima', a.perguntas_que_faltaram, (q, i) => (
          <li key={i} className="rounded-xl border border-slate-200/70 bg-white p-3 text-sm text-slate-700">{q}</li>
        ))}

        {bloco('Objeções e resposta sob medida', a.objecoes, (o, i) => (
          <li key={i} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
            <p className="text-sm font-semibold text-amber-900">{o.objecao}</p>
            <p className="mt-1 text-sm text-slate-700">{o.resposta_sugerida}</p>
          </li>
        ))}

        {bloco('Próximos passos', a.proximos_passos, (p, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-2 rounded-xl border border-slate-200/70 bg-white p-3">
            <span className="flex-1 text-sm text-slate-800">{p.acao}</span>
            {p.prazo_sugerido && <Badge tom="slate">{p.prazo_sugerido}</Badge>}
            <span className="w-full text-xs text-slate-500">{p.por_que}</span>
          </li>
        ))}

        {bloco('Riscos', a.riscos, (r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-500" /> {r}
          </li>
        ))}

        {bloco('Para usar na proposta', a.argumentos_para_proposta, (x, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-0.5 text-laranja-500">▹</span> {x}
          </li>
        ))}

        {a.mensagem_whatsapp && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Follow-up pronto para enviar
              </p>
              <button type="button"
                onClick={() => {
                  navigator.clipboard.writeText(a.mensagem_whatsapp)
                  setCopiado(true)
                  setTimeout(() => setCopiado(false), 2000)
                }}
                className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-300">
                {copiado ? '✓ Copiado' : 'Copiar mensagem'}
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{a.mensagem_whatsapp}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Objeções, sinais, citações e compromissos ───────────────────────────────
function PainelConversa({ a, aoCriarTarefa }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {a.momentos.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <MessageSquareQuote size={13} className="text-laranja-600" /> Para citar na proposta
          </p>
          <ul className="space-y-2.5">
            {a.momentos.map((m, i) => (
              <li key={i} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 text-sm italic text-slate-600">
                “{m.texto}”
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Ancore o estudo nas palavras dele: “lembra que você falou disso? É exatamente o que esse
            plano resolve”.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ShieldAlert size={13} className="text-laranja-600" /> Objeções e como responder
        </p>
        {a.objecoes.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma objeção clássica apareceu. Se o cliente não colocou nenhuma barreira, o que falta
            é o próximo passo — combine data e hora antes que a proposta esfrie.
          </p>
        ) : (
          <ul className="space-y-3">
            {a.objecoes.map((o) => (
              <li key={o.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                <p className="text-sm font-semibold text-amber-900">{o.rotulo}</p>
                <p className="mt-0.5 text-xs italic text-slate-500">“{o.trecho}”</p>
                <p className="mt-1.5 text-sm text-slate-700">{o.responder}</p>
              </li>
            ))}
          </ul>
        )}
        {a.sinais.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Sinais de compra
            </p>
            <div className="flex flex-wrap gap-1.5">
              {a.sinais.map((s) => (
                <span key={s.id} title={s.trecho}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                  ✓ {s.rotulo}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 lg:col-span-2">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <CalendarPlus size={13} className="text-laranja-600" /> Compromissos assumidos
        </p>
        {a.compromissos.length === 0 ? (
          <p className="text-sm text-slate-500">
            A reunião terminou sem compromisso combinado. Ligue hoje e marque a data de retorno —
            proposta sem próximo passo agendado esfria em 72 horas.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {a.compromissos.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  c.papel === 'cliente' ? 'bg-emerald-50 text-emerald-700' : 'bg-laranja-50 text-laranja-700'}`}>
                  {c.papel === 'cliente' ? 'cliente' : 'você'}
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-700">{c.texto}</span>
                {c.prazo && <Badge tom="slate">{c.prazo}</Badge>}
                <button onClick={() => aoCriarTarefa(c)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-laranja-300 hover:text-laranja-700">
                  <CalendarPlus size={12} className="mr-1 inline" /> Criar tarefa
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
