import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Scale, Check, AlertTriangle, TrendingUp, Sparkles, Table2, Info,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  compararSeguroComInvestimento, lerTabelaColada, conferirComparador,
  DIMENSOES_COMPARACAO,
} from '../lib/comparador.js'
import { calcularEstudo, TAXA_REAL_ANUAL } from '../lib/estudo.js'
import { brl, brlCompacto } from '../lib/format'
import { Button, Card, Input, Select, Campo, Spinner, ComoFunciona, Badge } from '../components/ui'
import ComparadorCurvas from '../components/ComparadorCurvas'
import { useToast } from '../components/toastContexto'

// ─────────────────────────────────────────────────────────────────────────────
// ABA COMPARADOR — a prova numérica de que o seguro vale a pena.
//
// "Não seria melhor investir esse dinheiro?" é a objeção que decide a venda de
// um seguro resgatável, e é a única em que o cliente costuma chegar com um
// profissional do lado. Aqui a consultora monta a resposta com a conta na mão.
//
// A regra da casa neste assunto: a comparação tem que ser JUSTA. O sistema
// credita a dedução do PGBL, usa a tabela regressiva de IR de verdade e diz em
// voz alta que num horizonte longo e sem sinistro o investimento acumula mais.
// É por mostrar isso que o resto do argumento fica de pé.
//
// O valor de resgate não é estimado: a consultora cola a tabela da cotação e o
// motor interpola só o meio. Número da seguradora, não do sistema.
// ─────────────────────────────────────────────────────────────────────────────

const EXEMPLO_TABELA = `5    12.500
10   41.200
15   78.900
20   124.000
30   215.000`

export default function AbaComparador({ idCliente, cliente }) {
  const toast = useToast()
  const [plano, setPlano] = useState(null)
  const [temColunas, setTemColunas] = useState(null)
  const [colado, setColado] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    // A 022 é aplicada à mão no Supabase: perguntamos ao banco se as colunas
    // já existem antes de oferecer o comparador. Instalação atrasada mostra o
    // aviso em vez de quebrar.
    Promise.all([
      supabase.from('planejamentos').select('*').eq('id_cliente', idCliente).maybeSingle(),
      supabase.from('planejamentos').select('seguro_resgatavel').limit(1).then(({ error }) => !error),
    ]).then(([{ data }, tem022]) => {
      setTemColunas(tem022)
      setPlano(data)
      const tabela = Array.isArray(data?.seguro_resgatavel) ? data.seguro_resgatavel : []
      if (tabela.length > 0) {
        setColado(tabela.map((p) => `${p.ano}\t${Number(p.resgate).toLocaleString('pt-BR')}`).join('\n'))
      }
    })
  }, [idCliente])

  useEffect(() => { carregar() }, [carregar])

  const estudo = useMemo(
    () => (plano ? calcularEstudo(plano, { dataNascimento: cliente?.data_nascimento }) : null),
    [plano, cliente?.data_nascimento])

  // O que o motor entendeu da tabela colada — mostrado para ela conferir antes
  // de qualquer número aparecer no gráfico.
  const tabelaLida = useMemo(() => lerTabelaColada(colado), [colado])

  const comp = useMemo(() => {
    if (!estudo || !plano) return null
    return compararSeguroComInvestimento({
      capital: estudo.valores?.morte ?? 0,
      premioMensal: estudo.investimento?.mensal ?? 0,
      resgates: tabelaLida,
      alternativa: plano.comparador_alternativa ?? 'vgbl',
      taxaReal: plano.comparador_taxa_real != null
        ? Number(plano.comparador_taxa_real) / 100 : TAXA_REAL_ANUAL,
      aliquotaIR: plano.aliquota_ir_cliente != null ? Number(plano.aliquota_ir_cliente) / 100 : 0,
      rendaMensal: estudo.renda,
      anos: Math.max(estudo.anos, 30),
      premioTemporarioMensal: plano.premio_temporario_mensal,
    })
  }, [estudo, plano, tabelaLida])

  const avisos = useMemo(
    () => (plano ? conferirComparador({ ...plano, seguro_resgatavel: tabelaLida }, comp) : []),
    [plano, tabelaLida, comp])

  const mudar = (campo, valor) => setPlano((p) => ({ ...p, [campo]: valor }))

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.from('planejamentos').upsert({
      id_cliente: idCliente,
      seguro_resgatavel: tabelaLida,
      comparador_alternativa: plano.comparador_alternativa || 'vgbl',
      comparador_taxa_real: plano.comparador_taxa_real === '' || plano.comparador_taxa_real == null
        ? null : Number(plano.comparador_taxa_real),
      aliquota_ir_cliente: plano.aliquota_ir_cliente === '' || plano.aliquota_ir_cliente == null
        ? null : Number(plano.aliquota_ir_cliente),
      premio_temporario_mensal: plano.premio_temporario_mensal === '' || plano.premio_temporario_mensal == null
        ? null : Number(plano.premio_temporario_mensal),
    }, { onConflict: 'id_cliente' })
    setSalvando(false)
    if (error) return toast.erro(`Erro ao salvar: ${error.message}`)
    toast.ok('Comparador salvo — os capítulos entram na proposta.')
  }

  if (plano === null && temColunas === null) return <Spinner />

  if (temColunas === false) {
    return (
      <Card className="p-5">
        <p className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          Rode a migração <strong>022_comparador.sql</strong> no Supabase para liberar o comparador
          (seguro resgatável contra VGBL/PGBL, com o gráfico do cruzamento e o quadro das dimensões).
        </p>
      </Card>
    )
  }

  if (!plano || !estudo) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-500">
          Preencha o <strong>planejamento</strong> primeiro: o comparador usa o capital de morte e o
          prêmio cotado como ponto de partida.
        </p>
      </Card>
    )
  }

  const alternativa = plano.comparador_alternativa ?? 'vgbl'
  const rotuloAlternativa = alternativa === 'pgbl' ? 'PGBL' : 'VGBL'

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <ComoFunciona id="comparador" titulo="Como usar o comparador">
          Cole a <strong>tabela de resgate da cotação</strong> (ano e valor, uma linha por par) e
          escolha contra o que comparar. O sistema monta a curva dos dois lados com a tributação
          certa de cada um e mostra o <strong>ano do cruzamento</strong> — quando o investimento
          finalmente alcança o capital do seguro. Até lá, a área hachurada é o que faltaria à
          família. A comparação é de propósito justa com o outro lado: ela credita a dedução do
          PGBL e admite onde o investimento ganha. É isso que a torna difícil de derrubar.
        </ComoFunciona>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div>
            <Campo label="Tabela de resgate da cotação"
              dica="Uma linha por par: ano e valor. Cole direto da cotação — R$, ponto, vírgula, ponto-e-vírgula ou tabulação, tanto faz.">
              <textarea
                value={colado}
                onChange={(e) => setColado(e.target.value)}
                rows={8}
                placeholder={EXEMPLO_TABELA}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-300 focus:border-laranja-400 focus:outline-none focus:ring-4 focus:ring-laranja-500/15" />
            </Campo>
            {colado.trim() !== '' && (
              <p className="mt-2 text-xs text-slate-500">
                {tabelaLida.length > 0 ? (
                  <>
                    <Check size={13} className="mr-1 inline text-emerald-700" />
                    Entendi <strong>{tabelaLida.length}</strong> ponto(s):{' '}
                    {tabelaLida.map((p) => `ano ${p.ano} = ${brlCompacto(p.resgate)}`).join(' · ')}
                  </>
                ) : (
                  <>
                    <AlertTriangle size={13} className="mr-1 inline text-amber-700" />
                    Não achei nenhum par ano/valor. Cada linha precisa de dois números — o ano e o
                    valor de resgate.
                  </>
                )}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Campo label="Comparar com" dica="O concorrente direto do resgatável na conversa">
              <Select value={alternativa} onChange={(e) => mudar('comparador_alternativa', e.target.value)}>
                <option value="vgbl">VGBL — IR só sobre o rendimento</option>
                <option value="pgbl">PGBL — IR sobre o total, mas deduz no ano</option>
              </Select>
            </Campo>
            {alternativa === 'pgbl' && (
              <Campo label="Alíquota de IR do cliente (%)"
                dica="Sem ela a dedução de até 12% da renda não é creditada — e a comparação fica injusta com o PGBL">
                <Input type="number" step="0.5" min="0" max="50"
                  placeholder="27,5"
                  value={plano.aliquota_ir_cliente ?? ''}
                  onChange={(e) => mudar('aliquota_ir_cliente', e.target.value)} />
              </Campo>
            )}
            <Campo label="Taxa real de juros (% ao ano)"
              dica={`Acima da inflação. Em branco usa ${(TAXA_REAL_ANUAL * 100).toFixed(0)}% — a premissa do estudo.`}>
              <Input type="number" step="0.25" min="-5" max="20"
                placeholder={(TAXA_REAL_ANUAL * 100).toFixed(0)}
                value={plano.comparador_taxa_real ?? ''}
                onChange={(e) => mudar('comparador_taxa_real', e.target.value)} />
            </Campo>
            <Campo label="Prêmio de um temporário do mesmo capital"
              dica="Opcional. Se você cotou, o custo da proteção ganha a comparação mais justa que existe.">
              <Input type="number" step="10" min="0"
                value={plano.premio_temporario_mensal ?? ''}
                onChange={(e) => mudar('premio_temporario_mensal', e.target.value)} />
            </Campo>
            <Button onClick={salvar} disabled={salvando} className="w-full">
              {salvando ? 'Salvando…' : 'Salvar comparador'}
            </Button>
          </div>
        </div>

        {avisos.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
            {avisos.map((a, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs ${a.grave ? 'text-red-700' : 'text-amber-800'}`}>
                <AlertTriangle size={13} className={`mt-0.5 shrink-0 ${a.grave ? 'text-red-700' : 'text-amber-700'}`} />
                {a.texto}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {comp ? (
        <>
          <Card className="p-5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <TrendingUp size={13} className="text-laranja-600" /> O gráfico do cruzamento
            </p>
            <p className="mb-4 text-xs text-slate-400">
              Projeção a {(comp.premissas.taxaReal * 100).toFixed(2).replace('.', ',')}% ao ano acima da
              inflação, comparando com {rotuloAlternativa}
              {alternativa === 'pgbl' && comp.premissas.deducaoAnual > 0
                && `, creditando ${brl(comp.premissas.deducaoAnual)}/ano de dedução no IR`}.
              Em valores de hoje.
            </p>
            <ComparadorCurvas comp={comp} />
          </Card>

          <Card className="p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles size={13} className="text-laranja-600" /> Os números que saem daí
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Numero
                rotulo="O investimento alcança o seguro"
                valor={comp.anoDoCruzamento ? `no ano ${comp.anoDoCruzamento}` : 'nunca, no horizonte'}
                detalhe={comp.anoDoCruzamento
                  ? `até lá a família fica descoberta`
                  : `em ${comp.premissas.anos} anos não chega ao capital`}
                tom="ruim" />
              <Numero
                rotulo="O maior buraco"
                valor={brlCompacto(comp.descobertoMaximo)}
                detalhe={`no ano ${comp.anoDoPiorDescoberto} — o que faltaria à família`}
                tom="ruim" />
              <Numero
                rotulo="Cada R$ 1 de prêmio protege"
                valor={brl(comp.alavancagemInicial)}
                detalhe="no primeiro mês, sem esperar nada" tom="bom" />
              <Numero
                rotulo="Custo real da proteção"
                valor={comp.custoPorMilPorAno != null
                  ? `${brl(comp.custoPorMilPorAno)}` : '—'}
                detalhe="por mil de capital, por ano"
                tom="neutro" />
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600">
              <p>
                <strong className="text-slate-800">Como esse custo se lê:</strong> em{' '}
                {comp.premissas.anos} anos o mesmo dinheiro investido chegaria a{' '}
                <strong>{brlCompacto(comp.investidoNoFim)}</strong>, e o seguro devolve{' '}
                <strong>{brlCompacto(comp.resgateNoFim)}</strong> de resgate. A diferença —{' '}
                <strong>{brlCompacto(comp.custoRealDaProtecao)}</strong> — foi o preço de ter
                carregado {brlCompacto(comp.premissas.capital)} de cobertura o tempo todo.
                {comp.custoTemporarioNoPeriodo != null && (
                  <> Um temporário do mesmo capital custaria{' '}
                  <strong>{brlCompacto(comp.custoTemporarioNoPeriodo)}</strong> no período —
                  {comp.custoTemporarioNoPeriodo < comp.custoRealDaProtecao
                    ? ' é a comparação honesta a fazer com o cliente.'
                    : ' o resgatável sai à frente até aqui.'}</>
                )}
              </p>
              {comp.investimentoGanhaNoFim && (
                <p className="border-t border-slate-200/70 pt-2">
                  <Info size={13} className="mr-1 inline text-blue-600" />
                  <strong className="text-slate-800">E é verdade:</strong> passado o horizonte inteiro
                  sem sinistro, o investimento acumula mais que o resgate. Diga isso antes que ele
                  diga — é o que dá credibilidade a todo o resto, e leva direto ao ponto: o seguro
                  não existe para render mais, existe para o dinheiro estar lá no dia em que não
                  houve tempo de acumular.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Table2 size={13} className="text-laranja-600" /> Cada coisa serve para uma coisa
            </p>
            <p className="mb-4 text-xs text-slate-400">
              O gráfico responde "quanto". Este quadro responde "o quê" — e é onde entram os motivos
              que nenhuma taxa de juros alcança.
            </p>
            <ul className="space-y-2">
              {DIMENSOES_COMPARACAO.map((d) => (
                <li key={d.id} className="rounded-xl border border-slate-200/70 bg-white p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{d.pergunta}</p>
                    <Badge tom={d.vencedor === 'seguro' ? 'emerald'
                      : d.vencedor === 'empate' ? 'slate' : 'amber'}>
                      {d.vencedor === 'seguro' ? 'seguro' : d.vencedor === 'empate' ? 'empate'
                        : d.vencedor === 'pgbl' ? 'PGBL' : 'investimento'}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                    <Lado rotulo="Seguro" valor={d.seguro} destaque={d.vencedor === 'seguro'} />
                    <Lado rotulo="VGBL" valor={d.vgbl} destaque={d.vencedor === 'investimento'} />
                    <Lado rotulo="PGBL" valor={d.pgbl}
                      destaque={d.vencedor === 'pgbl' || d.vencedor === 'investimento'} />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{d.nota}</p>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <Card className="p-5">
          <p className="flex items-start gap-2 text-sm text-slate-500">
            <Scale size={16} className="mt-0.5 shrink-0 text-slate-400" />
            O comparador precisa do <strong>capital de morte</strong> e do{' '}
            <strong>prêmio mensal cotado</strong> — os dois vêm da aba Planejamento. Com eles
            preenchidos, o gráfico aparece aqui mesmo sem a tabela de resgate; a tabela só acrescenta
            a curva do que o seguro devolve em vida.
          </p>
        </Card>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, detalhe, tom = 'neutro' }) {
  const cor = tom === 'bom' ? 'text-emerald-700' : tom === 'ruim' ? 'text-red-700' : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={`font-display text-lg font-semibold tabular-nums ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-400">{detalhe}</p>}
    </div>
  )
}

function Lado({ rotulo, valor, destaque }) {
  return (
    <div className={`rounded-lg border p-2 ${destaque
      ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className="text-slate-700">{valor}</p>
    </div>
  )
}
