import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy, Crown, CalendarClock, Download, MessageCircle, FileSignature,
  Wallet, AlertTriangle, TrendingUp, Users, Medal,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { brl, brlCompacto, dataBR, hojeLocal } from '../lib/format'
import { baixarCSV } from '../lib/csv'
import { CHART } from '../lib/constants'
import {
  apurarPremiacao, anosComEmissao, vantagemDoLider,
  MES_FECHAMENTO_PADRAO, MESES_CURTO,
} from '../lib/premiacao'
import {
  PageHeader, Card, Button, Select, Campo, Spinner, Badge, EmptyState, ComoFunciona, StatTile,
} from '../components/ui'

// ─────────────────────────────────────────────────────────────────────────────
// GB AWARDS — o ranking dos assessores na área de seguros.
//
// Dois prêmios do ano moram nesta tela: MAIOR EMISSOR (quantidade de apólices)
// e MAIOR PRÊMIO (volume somado). A premiação acontece em novembro, então a
// apuração vai de 1º de janeiro a 30 de novembro — e o que a tela mostra o ano
// inteiro é a corrida acontecendo, não só o resultado no fim.
//
// A base é a planilha geral que sobe todo mês em Importar. Ninguém digita
// ranking aqui: subiu a planilha, o pódio se move. E como o número decide
// quem sobe no palco, cada bloco mostra de onde ele veio — a janela, o
// critério de cancelada e o que ficou de fora aparecem na própria tela.
// ─────────────────────────────────────────────────────────────────────────────

// Busca uma tabela inteira em páginas de 1000 (o limite do Supabase por
// consulta). A carteira do escritório já passa disso, e um ranking que perde
// as últimas apólices premia a pessoa errada.
async function buscarTudo(tabela, colunas, colunasReserva = null) {
  const todas = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select(colunas).order('id').range(de, de + 999)
    if (error) {
      // coluna que só existe depois de uma migração: tenta o conjunto antigo
      if (colunasReserva && de === 0) return buscarTudo(tabela, colunasReserva)
      break
    }
    if (!data?.length) break
    todas.push(...data)
    if (data.length < 1000) break
  }
  return todas
}

const NOMES_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const primeiroNome = (n) => String(n ?? '').trim().split(/\s+/)[0] || '—'

// ─── Cartão de um prêmio ─────────────────────────────────────────────────────
// O troféu, quem está com ele agora e — o que mantém a disputa viva — por
// quanto ele lidera e quem vem logo atrás.
function CartaoPremio({ titulo, subtitulo, icone: Icone, cor, lideres, valorPrincipal, valorDetalhe, vantagem, formatoVantagem, projecao, encerrada }) {
  const vazio = !lideres || lideres.length === 0
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${cor.faixa}`} />
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-xl p-2.5 ${cor.icone}`}><Icone size={20} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{titulo}</h2>
          <p className="text-xs text-slate-400">{subtitulo}</p>
        </div>
        <Badge tom={encerrada ? 'green' : 'yellow'}>{encerrada ? 'resultado final' : 'em disputa'}</Badge>
      </div>

      {vazio ? (
        <p className="mt-5 text-sm text-slate-400">
          Ainda não há apólice emitida no período — o pódio abre com a primeira.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-display text-[1.7rem] font-semibold leading-none tracking-tight text-slate-900 tabular">
              {valorPrincipal}
            </p>
            <p className="text-sm text-slate-500">{valorDetalhe}</p>
          </div>
          <div className="mt-3 space-y-1">
            {lideres.map((l) => (
              <p key={l.id} className="flex flex-wrap items-center gap-2">
                <Link to={`/assessores/${l.id}`} className="font-semibold text-slate-900 hover:text-laranja-600 hover:underline">
                  {l.nome}
                </Link>
                {l.codigo && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{l.codigo}</span>}
              </p>
            ))}
            {lideres.length > 1 && (
              <p className="text-xs font-medium text-amber-700">Empate na liderança — {lideres.length} assessores no topo.</p>
            )}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {vantagem && !vantagem.semAdversario && (
              <p>
                Lidera por <strong className="text-slate-700">{formatoVantagem(vantagem.diferenca)}</strong>
                {vantagem.segundo ? <> sobre {primeiroNome(vantagem.segundo.nome)}</> : null}.
              </p>
            )}
            {vantagem?.semAdversario && <p>Único com produção no período — a disputa começa quando o segundo emitir.</p>}
            {projecao && !encerrada && <p>No ritmo de hoje, fecha a apuração em <strong className="text-slate-700">{projecao}</strong>.</p>}
          </div>
        </>
      )}
    </Card>
  )
}

// ─── A corrida ───────────────────────────────────────────────────────────────
// Barras proporcionais ao líder: a distância aparece como distância, e não
// como uma coluna de números que ninguém compara de cabeça.
function Corrida({ titulo, icone: Icone, lista, valorDe, formato, cor, posicaoDe }) {
  const topo = valorDe(lista[0] ?? {}) || 1
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <Icone size={14} /> {titulo}
      </p>
      <div className="space-y-2.5">
        {lista.map((l) => {
          const v = valorDe(l)
          const pos = posicaoDe(l)
          return (
            <div key={l.id} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                pos === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {pos}º
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link to={`/assessores/${l.id}`} className="truncate text-sm font-medium text-slate-800 hover:text-laranja-600 hover:underline">
                    {l.nome}
                  </Link>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formato(v)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-slate-100">
                  <div className="h-1.5 rounded" style={{ width: `${Math.max((v / topo) * 100, 3)}%`, background: cor }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Premiacao() {
  const [dados, setDados] = useState(null)
  const [ano, setAno] = useState(() => Number(hojeLocal().slice(0, 4)))
  const [mesFechamento, setMesFechamento] = useState(MES_FECHAMENTO_PADRAO)
  const [incluirCanceladas, setIncluirCanceladas] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([
      // `id_assessor` na apólice é da migração 026 — quando o banco ainda não a
      // tem, a busca cai para o conjunto antigo de colunas e o ranking usa o
      // assessor do cliente, como antes. Uma tela de premiação não pode ficar
      // em branco porque falta rodar uma migração.
      buscarTudo('apolices', 'id, id_cliente, id_seguradora, id_assessor, valor_premio_mensal, data_vigencia, status',
        'id, id_cliente, id_seguradora, valor_premio_mensal, data_vigencia, status'),
      buscarTudo('clientes', 'id, nome, id_assessor'),
      buscarTudo('assessores', 'id, nome, codigo, ativo'),
      buscarTudo('seguradoras', 'id, nome'),
    ]).then(([apolices, clientes, assessores, seguradoras]) => {
      if (vivo) setDados({ apolices, clientes, assessores, seguradoras })
    })
    return () => { vivo = false }
  }, [])

  const anos = useMemo(() => anosComEmissao(dados?.apolices ?? [], new Date()), [dados])

  const r = useMemo(
    () => apurarPremiacao(dados ?? {}, { ano, mesFechamento, incluirCanceladas, hoje: hojeLocal() }),
    [dados, ano, mesFechamento, incluirCanceladas],
  )

  const vantQtd = useMemo(() => vantagemDoLider(r, 'quantidade'), [r])
  const vantPremio = useMemo(() => vantagemDoLider(r, 'premio'), [r])

  const fimBR = dataBR(r.janela.fim)
  const encerrada = r.prazo.encerrada

  function exportarCSV() {
    const num = (v) => Number(v ?? 0).toFixed(2).replace('.', ',')
    baixarCSV(`gb-awards-${r.ano}.csv`,
      ['Pos. emissor', 'Pos. prêmio', 'Cód. assessor', 'Assessor', 'Apólices emitidas',
        'Prêmio mensal somado', 'Prêmio anualizado', 'Ticket médio', 'Clientes',
        'Seguradoras', 'Primeira emissão', 'Última emissão',
        'Faltam apólices p/ o líder', 'Falta prêmio mensal p/ o líder'],
      r.porQuantidade.map((l) => [
        l.posQuantidade, l.posPremio, l.codigo ?? '', l.nome, l.apolices,
        num(l.premioMensal), num(l.premioAnual), num(l.ticketMedio), l.clientes,
        // de onde veio a produção — é por aqui que uma contestação começa
        l.seguradoras.map((s) => `${s.seguradora} (${s.apolices})`).join(' · '),
        l.primeiraEmissao ? dataBR(l.primeiraEmissao) : '', l.ultimaEmissao ? dataBR(l.ultimaEmissao) : '',
        l.faltamApolices, num(l.faltamPremioMensal),
      ]))
  }

  // O recado que a Natália manda no grupo dos assessores todo mês: o pódio,
  // a distância de quem está atrás e quanto tempo ainda tem.
  function enviarWhatsApp() {
    const linhas = [
      `*GB Awards ${r.ano} — área de seguros*`,
      `Apuração de 01/01 a ${fimBR}${encerrada ? ' · ENCERRADA' : ` · faltam ${r.prazo.diasRestantes} dias`}`,
      '',
      '🏆 *Maior emissor (quantidade de apólices)*',
      ...r.porQuantidade.slice(0, 5).map((l) => `${l.posQuantidade}º ${l.nome} — ${l.apolices} apólice(s)`),
      '',
      '💰 *Maior prêmio (volume no ano)*',
      ...r.porPremio.slice(0, 5).map((l) => `${l.posPremio}º ${l.nome} — ${brl(l.premioAnual)} anualizados (${brl(l.premioMensal)}/mês)`),
      '',
      `Total do escritório: ${r.totais.apolices} apólice(s) · ${brl(r.totais.premioAnual)} anualizados`,
      '',
      '_Apurado pelo Hub Seguro de Vida a partir da planilha geral_',
    ]
    window.open(`https://wa.me/?text=${encodeURIComponent(linhas.join('\n'))}`, '_blank', 'noreferrer')
  }

  if (!dados) return <Spinner />

  const maxMes = Math.max(...r.porMes.map((m) => m.apolices), 1)

  return (
    <div>
      <PageHeader titulo="GB Awards"
        subtitulo={`Ranking dos assessores na área de seguros — maior emissor e maior prêmio de ${r.ano}`}>
        <div className="w-28">
          <Campo label="Ano">
            <Select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Campo>
        </div>
        <div className="w-40">
          <Campo label="Apuração até">
            <Select value={mesFechamento} onChange={(e) => setMesFechamento(Number(e.target.value))}>
              {NOMES_MES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </Campo>
        </div>
      </PageHeader>

      <ComoFunciona id="gb-awards" titulo="Como o ranking é apurado">
        Dois prêmios saem daqui: <strong>maior emissor</strong> (quem emitiu mais apólices) e{' '}
        <strong>maior prêmio</strong> (quem somou mais volume). A base é a <strong>planilha geral</strong> que
        você sobe todo mês em <Link to="/importar" className="font-medium text-laranja-700 underline">Importar</Link> —
        nada é digitado aqui. Conta a <strong>data de emissão</strong> da apólice (a vigência), de 1º de janeiro
        até o mês de fechamento escolhido aí em cima (novembro, o mês da premiação). Apólice cancelada fica de
        fora, a menos que você ligue a opção abaixo. O assessor vem da <strong>linha da apólice</strong> na
        planilha — então um mesmo cliente pode render para dois assessores diferentes, e reimportar a planilha
        move a atribuição junto com os números.
      </ComoFunciona>

      {/* Prazo da apuração */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-laranja-50 p-2.5 text-laranja-600"><CalendarClock size={20} /></div>
            <div>
              <p className="font-semibold text-slate-900">
                Apuração de 01/01/{r.ano} a {fimBR}
              </p>
              <p className="text-xs text-slate-500">
                {encerrada
                  ? `Período encerrado — este é o resultado final de ${r.ano}.`
                  : r.prazo.naoComecou
                    ? 'O período ainda não começou.'
                    : `Faltam ${r.prazo.diasRestantes} dia(s) para o fechamento — ${r.prazo.progressoPct}% do período já passou.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <input type="checkbox" className="h-4 w-4 accent-laranja-500"
                checked={incluirCanceladas} onChange={(e) => setIncluirCanceladas(e.target.checked)} />
              Contar apólices canceladas
            </label>
            <Button variant="secondary" onClick={exportarCSV} disabled={r.linhas.length === 0}>
              <Download size={15} /> Exportar CSV
            </Button>
            <Button variant="success" onClick={enviarWhatsApp} disabled={r.linhas.length === 0}>
              <MessageCircle size={15} /> Mandar no grupo
            </Button>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-laranja-400 transition-all"
            style={{ width: `${Math.min(Math.max(r.prazo.progressoPct, 0), 100)}%` }} />
        </div>
      </Card>

      {/* Os dois troféus */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CartaoPremio
          titulo="Maior emissor" subtitulo="Quantidade de apólices emitidas no período"
          icone={Trophy} cor={{ faixa: 'bg-amber-400', icone: 'bg-amber-50 text-amber-600' }}
          lideres={r.lideresQuantidade}
          valorPrincipal={`${r.liderQuantidade?.apolices ?? 0}`}
          valorDetalhe={`apólice(s) · ${brl(r.liderQuantidade?.premioAnual ?? 0)} anualizados`}
          vantagem={vantQtd} formatoVantagem={(d) => `${d} apólice(s)`}
          projecao={r.liderQuantidade?.projecaoApolices != null
            ? `≈ ${Math.round(r.liderQuantidade.projecaoApolices)} apólices` : null}
          encerrada={encerrada}
        />
        <CartaoPremio
          titulo="Maior prêmio" subtitulo="Volume de prêmio somado no período"
          icone={Crown} cor={{ faixa: 'bg-laranja-400', icone: 'bg-laranja-50 text-laranja-600' }}
          lideres={r.lideresPremio}
          valorPrincipal={brlCompacto(r.liderPremio?.premioAnual ?? 0)}
          valorDetalhe={`anualizados · ${brl(r.liderPremio?.premioMensal ?? 0)}/mês`}
          vantagem={vantPremio} formatoVantagem={(d) => `${brl(d * 12)} anualizados`}
          projecao={r.liderPremio?.projecaoPremioMensal != null
            ? `≈ ${brlCompacto(r.liderPremio.projecaoPremioMensal * 12)} anualizados` : null}
          encerrada={encerrada}
        />
      </div>

      {r.duploLider && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Medal size={16} className="shrink-0" />
          <span>
            <strong>{r.liderQuantidade.nome}</strong> lidera os dois prêmios ao mesmo tempo — emitiu mais e somou mais.
          </span>
        </p>
      )}

      {/* Números do escritório no período */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile rotulo="Apólices no período" valor={r.totais.apolices} icone={FileSignature}
          detalhe={`${r.totais.assessores} assessor(es) com produção`} corIcone="text-emerald-600 bg-emerald-50" />
        <StatTile rotulo="Prêmio somado (anualizado)" valor={brlCompacto(r.totais.premioAnual)} icone={Wallet}
          detalhe={`${brl(r.totais.premioMensal)}/mês`} corIcone="text-laranja-600 bg-laranja-50" />
        <StatTile rotulo="Ticket médio do período"
          valor={brl(r.totais.apolices > 0 ? r.totais.premioMensal / r.totais.apolices : 0)}
          icone={TrendingUp} detalhe="prêmio mensal por apólice" corIcone="text-blue-600 bg-blue-50" />
        <StatTile rotulo={encerrada ? 'Período encerrado' : 'Dias até o fechamento'}
          valor={encerrada ? fimBR : r.prazo.diasRestantes} icone={CalendarClock}
          detalhe={encerrada ? 'resultado final' : `fecha em ${fimBR}`} corIcone="text-amber-600 bg-amber-50" />
      </div>

      {r.linhas.length === 0 ? (
        <Card>
          <EmptyState icone={Trophy} titulo={`Nenhuma apólice emitida em ${r.ano}`}
            texto="Suba a planilha geral do mês em Importar — o ranking se monta sozinho a partir dela.">
            <Link to="/importar"><Button variant="secondary">Ir para Importar</Button></Link>
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* A corrida, lado a lado */}
          <Card className="mb-6 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <Trophy size={17} className="text-amber-500" /> A corrida do ano
            </h2>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Corrida titulo="Por quantidade de apólices" icone={FileSignature}
                lista={r.porQuantidade} valorDe={(l) => l.apolices} posicaoDe={(l) => l.posQuantidade}
                formato={(v) => `${v}`} cor={CHART.serie2} />
              <Corrida titulo="Por prêmio anualizado" icone={Wallet}
                lista={r.porPremio} valorDe={(l) => l.premioAnual} posicaoDe={(l) => l.posPremio}
                formato={brlCompacto} cor={CHART.serie1} />
            </div>
          </Card>

          {/* O quadro completo */}
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">Quadro completo — {r.ano}</h2>
                <p className="text-xs text-slate-400">
                  Ordenado pelo maior emissor · a coluna “falta para o líder” é a distância de cada um até o topo
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="px-5 py-3 font-medium">Pos.</th>
                    <th className="px-3 py-3 font-medium">Assessor</th>
                    <th className="px-3 py-3 text-right font-medium">Apólices</th>
                    <th className="px-3 py-3 text-right font-medium">Prêmio/mês</th>
                    <th className="px-3 py-3 text-right font-medium">Prêmio anualizado</th>
                    <th className="px-3 py-3 text-right font-medium">Ticket médio</th>
                    <th className="px-3 py-3 text-right font-medium">Última emissão</th>
                    <th className="px-3 py-3 text-right font-medium">Falta para o líder</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porQuantidade.map((l) => (
                    <tr key={l.id} className={`border-b border-slate-50 ${
                      l.posQuantidade === 1 || l.posPremio === 1 ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-5 py-3">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          l.posQuantidade === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {l.posQuantidade}º
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link to={`/assessores/${l.id}`} className="font-medium text-slate-900 hover:text-laranja-600 hover:underline">
                          {l.nome}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {l.codigo && <span className="font-mono text-[11px] text-slate-400">{l.codigo}</span>}
                          {l.posQuantidade === 1 && <Badge tom="yellow">🏆 maior emissor</Badge>}
                          {l.posPremio === 1 && <Badge tom="gold">👑 maior prêmio</Badge>}
                          {l.posPremio !== 1 && l.posQuantidade !== 1 && (
                            <span className="text-[11px] text-slate-400">{l.posPremio}º em prêmio · {l.clientes} cliente(s)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{l.apolices}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{brl(l.premioMensal)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{brl(l.premioAnual)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-500">{brl(l.ticketMedio)}</td>
                      <td className="px-3 py-3 text-right text-xs text-slate-500">
                        {l.ultimaEmissao ? dataBR(l.ultimaEmissao) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-xs">
                        {l.faltamApolices === 0 && l.faltamPremioMensal === 0 ? (
                          <span className="font-semibold text-emerald-700">na liderança dos dois</span>
                        ) : (
                          <span className="text-slate-500">
                            {l.faltamApolices > 0 && <>{l.faltamApolices} apólice(s)</>}
                            {l.faltamApolices > 0 && l.faltamPremioMensal > 0 && ' · '}
                            {l.faltamPremioMensal > 0 && <>{brlCompacto(l.faltamPremioAnual)} de prêmio</>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/60">
                    <td className="px-5 py-3" />
                    <td className="px-3 py-3 text-xs uppercase text-slate-400">Total do escritório</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">{r.totais.apolices}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{brl(r.totais.premioMensal)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">{brl(r.totais.premioAnual)}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Ritmo do escritório mês a mês */}
          <Card className="mb-6 p-5">
            <h2 className="mb-1 font-semibold text-slate-900">Emissões mês a mês</h2>
            <p className="mb-4 text-xs text-slate-400">
              O ritmo do escritório dentro da janela da premiação — a barra é a quantidade, o valor é o prêmio anualizado do mês
            </p>
            <div className="flex items-end gap-1.5 sm:gap-3">
              {r.porMes.map((m) => (
                <div key={m.mes} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 tabular-nums">{m.apolices || ''}</span>
                  <div className="flex h-24 w-full items-end">
                    <div className="w-full rounded-t"
                      title={`${MESES_CURTO[m.mes - 1]}: ${m.apolices} apólice(s) · ${brl(m.premioMensal * 12)} anualizados`}
                      style={{
                        height: `${Math.max((m.apolices / maxMes) * 100, m.apolices > 0 ? 6 : 2)}%`,
                        background: m.mes === r.prazo.mesCorrente ? CHART.serie1 : CHART.sequencial[3],
                      }} />
                  </div>
                  <span className="text-[11px] text-slate-400">{MESES_CURTO[m.mes - 1]}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* O que ficou de fora — a parte que evita prêmio dado por engano */}
      {(r.semAssessor.apolices > 0 || r.canceladasIgnoradas > 0) && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <AlertTriangle size={17} className="text-amber-500" /> O que ficou de fora da apuração
          </h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {r.semAssessor.apolices > 0 && (
              <li className="flex items-start gap-2">
                <Users size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <strong>{r.semAssessor.apolices} apólice(s)</strong> ({brl(r.semAssessor.premioMensal * 12)} anualizados)
                  {' '}sem assessor identificado — não entram no ranking de ninguém. Corrija o assessor desses clientes
                  em <Link to="/clientes" className="font-medium text-laranja-700 underline">Clientes</Link> antes
                  do fechamento, senão essa produção fica sem dono na premiação.
                </span>
              </li>
            )}
            {r.canceladasIgnoradas > 0 && (
              <li className="flex items-start gap-2">
                <FileSignature size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  <strong>{r.canceladasIgnoradas} apólice(s) canceladas</strong> emitidas no período não foram
                  contadas. Se a regra do escritório for premiar a emissão mesmo assim, ligue
                  “contar apólices canceladas” acima.
                </span>
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  )
}
