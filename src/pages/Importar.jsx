import { useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle, Download, FileSpreadsheet, X, Table2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseCSV, acharColuna, normalizar, paraDataISO, paraNumero, baixarCSV } from '../lib/csv'
import {
  detectarPlanilha, normalizarComissoes, lerArquivoComissao,
  inferirSeguradora, inferirCompetencia,
} from '../lib/planilhasComissao'
import { lerPlanilhaGeral } from '../lib/planilhaGeral'
import { ETAPAS } from '../lib/constants'
import { brl } from '../lib/format'
import { PageHeader, Card, Button, Textarea, Campo, Input, Spinner, ComoFunciona, Badge } from '../components/ui'

// Importador de planilhas: cole o conteúdo (ou envie um .csv) e o sistema
// reconhece as colunas sozinho, mostra a prévia e importa em lote.
// Registros importados NÃO disparam as automações (tarefas/formulários) —
// o banco trata dados históricos de forma diferente de dados novos.

const MODELOS = {
  clientes: {
    rotulo: 'Clientes / Leads',
    colunas: {
      nome:        { apelidos: ['nome', 'cliente', 'segurado'], obrigatorio: true },
      codigo:      { apelidos: ['codigocliente', 'codcliente', 'codigo', 'cod'] },
      assessor:    { apelidos: ['assessor', 'indicou', 'consultor'], obrigatorio: true },
      cod_assessor:{ apelidos: ['codigoassessor', 'codassessor'] },
      telefone:    { apelidos: ['telefone', 'celular', 'whatsapp', 'fone'] },
      email:       { apelidos: ['email', 'e-mail'] },
      nascimento:  { apelidos: ['nascimento', 'aniversario', 'datanasc'] },
      etapa:       { apelidos: ['etapa', 'status', 'funil', 'fase'] },
      perfil:      { apelidos: ['perfil', 'necessidade', 'observac', 'obs'] },
    },
    exemplo: [
      ['Código', 'Nome', 'Telefone', 'Email', 'Nascimento', 'Código Assessor', 'Assessor', 'Etapa', 'Perfil'],
      ['CLI-1001', 'Maria Souza', '(41) 99999-0000', 'maria@email.com', '15/07/1985', 'ASS-01', 'João Pedro', 'Fechado', 'Médica, 2 filhos'],
    ],
  },
  assessores: {
    rotulo: 'Assessores (lista do escritório)',
    colunas: {
      nome:     { apelidos: ['nome'], obrigatorio: true },
      codigo:   { apelidos: ['codigo', 'cod'], obrigatorio: true },
      email:    { apelidos: ['email', 'e-mail'] },
      telefone: { apelidos: ['whatsapp', 'telefone', 'celular'] },
    },
    exemplo: [
      ['Nome', 'Código', 'E-mail', 'Whatsapp'],
      ['ARLISON SALGADO SOARES', 'A2157', 'arlison@escritorio.com', '(21)98685-1102'],
    ],
  },
  apolices: {
    rotulo: 'Apólices (vendas já feitas)',
    colunas: {
      cliente:     { apelidos: ['cliente', 'nome', 'segurado'], obrigatorio: true },
      cod_cliente: { apelidos: ['codigocliente', 'codcliente', 'codigo', 'cod'] },
      seguradora:  { apelidos: ['seguradora', 'cia', 'companhia'], obrigatorio: true },
      premio:     { apelidos: ['premio', 'mensalidade', 'valor'], obrigatorio: true },
      capital:    { apelidos: ['capital', 'cobertura', 'importancia'] },
      vigencia:   { apelidos: ['vigencia', 'inicio', 'emissao', 'data'], obrigatorio: true },
      percentual: { apelidos: ['percentual', 'comissao', '%'] },
      numero:     { apelidos: ['numero', 'apolice', 'contrato'] },
      tipo:       { apelidos: ['tipoproduto', 'produto', 'tipo'] },
      status:     { apelidos: ['status', 'situacao'] },
      motivo:     { apelidos: ['motivocancelamento', 'motivo'] },
    },
    exemplo: [
      ['Cliente', 'Seguradora', 'Prêmio mensal', 'Capital', 'Vigência', '% Comissão', 'Nº apólice', 'Tipo produto', 'Status', 'Motivo cancelamento'],
      ['Maria Souza', 'Prudential do Brasil', 'R$ 500,00', 'R$ 1.000.000,00', '01/03/2024', '40', 'AP-12345', 'Seguro Temporário', 'ATIVO', ''],
    ],
  },
}

export default function Importar() {
  const [modo, setModo] = useState('clientes')
  const [texto, setTexto] = useState('')
  const [analise, setAnalise] = useState(null) // { mapa, linhas, faltando }
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const modelo = MODELOS[modo]

  if (modo === 'comissoes') {
    return <ImportarComissoes onVoltar={(m) => setModo(m)} />
  }
  if (modo === 'planilha_geral') {
    return <ImportarPlanilhaGeral onVoltar={(m) => setModo(m)} />
  }

  function analisar(csvTexto) {
    setResultado(null)
    const { cabecalho, linhas } = parseCSV(csvTexto)
    if (!cabecalho.length || !linhas.length) return setAnalise(null)
    const mapa = {}
    const faltando = []
    for (const [campo, def] of Object.entries(modelo.colunas)) {
      const i = acharColuna(cabecalho, def.apelidos)
      if (i >= 0) mapa[campo] = i
      else if (def.obrigatorio) faltando.push(campo)
    }
    setAnalise({ cabecalho, linhas, mapa, faltando })
  }

  function lerArquivo(e) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => { setTexto(leitor.result); analisar(leitor.result) }
    leitor.readAsText(arquivo, 'utf-8')
  }

  async function importar() {
    setImportando(true)
    const r = modo === 'clientes' ? await importarClientes(analise)
      : modo === 'assessores' ? await importarAssessores(analise)
      : await importarApolices(analise)
    setResultado(r)
    setImportando(false)
  }

  return (
    <div>
      <PageHeader titulo="Importar Planilhas"
        subtitulo="Traga a base histórica: os dados entram sem disparar tarefas nem formulários" />

      <ComoFunciona id="importar">
        Traga seus clientes e apólices que já existem. Escolha o tipo, <strong>baixe a planilha modelo</strong> para
        ver o formato, e cole o conteúdo (ou envie um arquivo .csv). O sistema reconhece as colunas sozinho e mostra
        uma <strong>prévia</strong> antes de importar. Dados importados não disparam mensagens nem tarefas — entram
        apenas como histórico. Comece pelos <strong>clientes</strong>, depois as <strong>apólices</strong>.
      </ComoFunciona>

      <Card className="p-5">
        {/* Escolha do tipo */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {Object.entries(MODELOS).map(([id, m]) => (
            <button key={id}
              onClick={() => { setModo(id); setAnalise(null); setResultado(null); setTexto('') }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                modo === id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {m.rotulo}
            </button>
          ))}
          <button onClick={() => setModo('comissoes')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Comissões (planilhas das seguradoras)
          </button>
          <button onClick={() => setModo('planilha_geral')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-laranja-200 bg-laranja-50 px-4 py-2 text-sm font-semibold text-laranja-700 hover:bg-laranja-100">
            <Table2 size={15} /> Planilha geral (Seguros Fechados)
          </button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => baixarCSV(`modelo-${modo}.csv`, modelo.exemplo[0], [modelo.exemplo[1]])}>
            <Download size={15} /> Baixar planilha modelo
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label="Cole aqui o conteúdo da planilha (copie as células no Excel/Sheets e cole)"
            dica="Primeira linha deve ser o cabeçalho. Separador , ; ou TAB — detectado sozinho.">
            <Textarea rows={7} value={texto}
              onChange={(e) => { setTexto(e.target.value); analisar(e.target.value) }}
              placeholder={modelo.exemplo.map((l) => l.join(';')).join('\n')} />
          </Campo>
          <div>
            <Campo label="...ou envie um arquivo .csv">
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center transition-colors hover:border-laranja-300 hover:bg-laranja-50/40">
                <span className="rounded-xl bg-white p-2.5 text-laranja-600 shadow-sm"><Upload size={20} /></span>
                <span className="text-sm font-medium text-slate-700">Clique para escolher o arquivo</span>
                <span className="text-xs text-slate-400">.csv ou .txt — ou arraste para cá</span>
                <input type="file" accept=".csv,.txt" onChange={lerArquivo} className="hidden" />
              </label>
            </Campo>
            <p className="mt-2 text-xs text-slate-400">
              Se sua planilha é .xlsx, use "Arquivo → Salvar como → CSV" no Excel,
              ou copie e cole as células direto no campo ao lado.
            </p>
          </div>
        </div>

        {/* Análise e prévia */}
        {analise && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              {Object.entries(modelo.colunas).map(([campo, def]) => (
                <span key={campo} className={`rounded-full px-2.5 py-1 font-medium ${
                  analise.mapa[campo] !== undefined ? 'bg-emerald-50 text-emerald-700'
                    : def.obrigatorio ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
                  {campo}: {analise.mapa[campo] !== undefined
                    ? `"${analise.cabecalho[analise.mapa[campo]]}"`
                    : def.obrigatorio ? 'NÃO ENCONTRADA' : 'não usada'}
                </span>
              ))}
            </div>

            {analise.faltando.length > 0 ? (
              <p className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle size={15} />
                Colunas obrigatórias não encontradas: {analise.faltando.join(', ')}.
                Renomeie o cabeçalho da planilha e cole de novo.
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-500">
                  <strong>{analise.linhas.length}</strong> linha(s) prontas. Prévia das 5 primeiras:
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        {Object.keys(analise.mapa).map((campo) => (
                          <th key={campo} className="px-3 py-2 font-medium">{campo}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analise.linhas.slice(0, 5).map((l, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          {Object.values(analise.mapa).map((idx) => (
                            <td key={idx} className="px-3 py-2 text-slate-700">{l[idx]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <Button onClick={importar} disabled={importando}>
                    <Upload size={15} /> {importando ? 'Importando...' : `Importar ${analise.linhas.length} registro(s)`}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {importando && <Spinner />}

        {/* Resultado */}
        {resultado && (
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              <CheckCircle2 size={17} className="text-emerald-600" />
              {resultado.ok} importado(s) com sucesso
              {resultado.criados?.length > 0 && ` · criados automaticamente: ${resultado.criados.join(', ')}`}
            </p>
            {resultado.erros.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 flex items-center gap-1 text-sm font-medium text-amber-700">
                  <AlertTriangle size={14} /> {resultado.erros.length} linha(s) não importada(s):
                </p>
                <ul className="max-h-40 list-inside list-disc overflow-y-auto text-xs text-slate-500">
                  {resultado.erros.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Importação da PLANILHA GERAL (Seguros Fechados) ─────────────────────────
// A planilha-mestre do escritório, subida todo mês. Cria os assessores,
// seguradoras e clientes que faltam, e faz UPSERT das apólices: as que já
// existem têm prêmio/status/comissão ATUALIZADOS; as novas são inseridas.
// É assim que "atualizar os números do mês" funciona num clique.
async function importarPlanilhaGeral(registros) {
  const erros = []
  const criados = []
  if (!registros.length) {
    return { ok: 0, atualizados: 0, erros: ['Nenhuma apólice válida encontrada na planilha.'], criados }
  }

  const [{ data: assessores }, { data: seguradoras }, { data: clientes }] = await Promise.all([
    supabase.from('assessores').select('id, nome, codigo'),
    supabase.from('seguradoras').select('id, nome'),
    supabase.from('clientes').select('id, nome, codigo'),
  ])
  const assessorPorNome = new Map((assessores ?? []).map((a) => [normalizar(a.nome), a.id]))
  const assessorPorCod = new Map((assessores ?? []).filter((a) => a.codigo).map((a) => [normalizar(a.codigo), a.id]))
  const segPorNome = new Map((seguradoras ?? []).map((s) => [normalizar(s.nome), s.id]))
  const clientePorNome = new Map((clientes ?? []).map((c) => [normalizar(c.nome), c.id]))
  const clientePorCod = new Map((clientes ?? []).filter((c) => c.codigo).map((c) => [normalizar(c.codigo), c.id]))

  const acharAssessor = (r) => (r.codAssessor && assessorPorCod.get(normalizar(r.codAssessor)))
    || (r.assessor && assessorPorNome.get(normalizar(r.assessor)))
  const acharCliente = (r) => (r.codCliente && clientePorCod.get(normalizar(r.codCliente)))
    || clientePorNome.get(normalizar(r.cliente))

  // 1. Assessores que faltam
  const assessoresNovos = new Map()
  for (const r of registros) {
    if (r.assessor && !acharAssessor(r) && !assessoresNovos.has(normalizar(r.assessor))) {
      assessoresNovos.set(normalizar(r.assessor), { nome: r.assessor, codigo: r.codAssessor || null })
    }
  }
  if (assessoresNovos.size) {
    const { data, error } = await supabase.from('assessores').insert([...assessoresNovos.values()]).select('id, nome, codigo')
    if (error) return { ok: 0, atualizados: 0, erros: [`Falha ao criar assessores: ${error.message}`], criados }
    for (const a of data) { assessorPorNome.set(normalizar(a.nome), a.id); if (a.codigo) assessorPorCod.set(normalizar(a.codigo), a.id) }
    criados.push(`${data.length} assessor(es)`)
  }

  // 2. Seguradoras que faltam (comissão padrão = a % que a planilha trouxe)
  const segNovas = new Map()
  for (const r of registros) {
    if (!segPorNome.has(normalizar(r.seguradora)) && !segNovas.has(normalizar(r.seguradora))) {
      segNovas.set(normalizar(r.seguradora), { nome: r.seguradora, comissao_padrao_percentual: r.percentual ?? 40 })
    }
  }
  if (segNovas.size) {
    const { data, error } = await supabase.from('seguradoras').insert([...segNovas.values()]).select('id, nome')
    if (error) return { ok: 0, atualizados: 0, erros: [`Falha ao criar seguradoras: ${error.message}`], criados }
    for (const s of data) segPorNome.set(normalizar(s.nome), s.id)
    criados.push(`${data.length} seguradora(s)`)
  }

  // Assessor de reserva: para linhas cujo campo "assessor" veio vazio na
  // planilha, ninguém é perdido — entram sob "(sem assessor)" para a consultora
  // reatribuir depois. Só criamos se realmente for preciso.
  let idFallback = assessorPorNome.get(normalizar('(sem assessor)')) ?? null
  const precisaFallback = registros.some((r) => !acharCliente(r) && !acharAssessor(r))
  if (precisaFallback && !idFallback) {
    const { data } = await supabase.from('assessores').insert({ nome: '(sem assessor)' }).select('id').single()
    if (data) { idFallback = data.id; assessorPorNome.set(normalizar('(sem assessor)'), data.id); criados.push('assessor de reserva') }
  }

  // 3. Clientes que faltam (já fechados, marcados como importados)
  const clientesNovos = new Map()
  for (const r of registros) {
    if (acharCliente(r) || clientesNovos.has(normalizar(r.cliente))) continue
    const idAssessor = acharAssessor(r) || idFallback
    if (!idAssessor) { erros.push(`Cliente "${r.cliente}": sem assessor e sem reserva`); continue }
    clientesNovos.set(normalizar(r.cliente), {
      nome: r.cliente, codigo: r.codCliente || null, id_assessor: idAssessor,
      status_funil: 'fechado', importado: true,
    })
  }
  if (clientesNovos.size) {
    const lote = [...clientesNovos.values()]
    for (let i = 0; i < lote.length; i += 100) {
      const { data, error } = await supabase.from('clientes').insert(lote.slice(i, i + 100)).select('id, nome, codigo')
      if (error) { erros.push(`Falha ao criar clientes (lote ${i / 100 + 1}): ${error.message}`); continue }
      for (const c of data) { clientePorNome.set(normalizar(c.nome), c.id); if (c.codigo) clientePorCod.set(normalizar(c.codigo), c.id) }
    }
    criados.push(`${clientesNovos.size} cliente(s)`)
  }

  // 4. Apólices — UPSERT por (cliente + seguradora + nº da apólice)
  const { data: apExistentes } = await supabase.from('apolices')
    .select('id, id_cliente, id_seguradora, numero_apolice')
  const chaveAp = (idC, idS, num) => `${idC}|${idS}|${normalizar(num ?? '')}`
  const apMap = new Map((apExistentes ?? []).map((a) => [chaveAp(a.id_cliente, a.id_seguradora, a.numero_apolice), a.id]))
  // colunas opcionais (migrações 012/013) — só enviamos se o banco já as tiver
  const temTipo = (apExistentes ?? []).some((a) => 'tipo_produto' in a) || (apExistentes ?? []).length === 0
  const temMotivo = (apExistentes ?? []).some((a) => 'motivo_cancelamento' in a) || (apExistentes ?? []).length === 0

  let ok = 0, atualizados = 0
  const novas = []
  for (const r of registros) {
    const idCliente = acharCliente(r)
    const idSeg = segPorNome.get(normalizar(r.seguradora))
    if (!idCliente || !idSeg) { erros.push(`Apólice de "${r.cliente}" (${r.seguradora}): cliente/seguradora não resolvidos`); continue }
    if (!r.vigencia) { erros.push(`Apólice de "${r.cliente}": sem data de vigência`); continue }
    const patch = {
      valor_premio_mensal: r.premioMensal ?? 0,
      percentual_comissao: r.percentual,
      data_vigencia: r.vigencia,
      status: r.status,
      numero_apolice: r.numeroApolice,
      ...(temTipo && r.tipoProduto ? { tipo_produto: r.tipoProduto } : {}),
      ...(temMotivo ? { motivo_cancelamento: r.status === 'cancelada' ? (r.motivoCancelamento || null) : null } : {}),
    }
    const existenteId = apMap.get(chaveAp(idCliente, idSeg, r.numeroApolice))
    if (existenteId) {
      const { error } = await supabase.from('apolices').update(patch).eq('id', existenteId)
      if (error) erros.push(`Atualizar apólice de "${r.cliente}": ${error.message}`); else atualizados += 1
    } else {
      novas.push({ ...patch, id_cliente: idCliente, id_seguradora: idSeg, capital_segurado: 0, importada: true })
    }
  }
  for (let i = 0; i < novas.length; i += 100) {
    const { data, error } = await supabase.from('apolices').insert(novas.slice(i, i + 100)).select('id')
    if (error) erros.push(`Falha ao inserir apólices (lote ${i / 100 + 1}): ${error.message}`)
    else ok += data.length
  }

  return { ok, atualizados, erros, criados }
}

function ImportarPlanilhaGeral({ onVoltar }) {
  const [analise, setAnalise] = useState(null) // { aba, abas, registros, ignoradas }
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [lendo, setLendo] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [erroLeitura, setErroLeitura] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function receber(file) {
    if (!file) return
    setResultado(null); setErroLeitura(null); setAnalise(null); setLendo(true)
    setNomeArquivo(file.name)
    try {
      const buf = await file.arrayBuffer()
      const r = lerPlanilhaGeral(buf)
      if (!r.registros.length) {
        setErroLeitura(`Não encontrei apólices na aba "${r.aba ?? '—'}". Confira se subiu a planilha certa (abas: ${(r.abas ?? []).join(', ')}).`)
      } else {
        setAnalise(r)
      }
    } catch (e) {
      setErroLeitura(`Não consegui ler o arquivo: ${e.message}`)
    }
    setLendo(false)
  }

  async function importar() {
    setImportando(true)
    const r = await importarPlanilhaGeral(analise.registros)
    setResultado(r)
    setImportando(false)
  }

  const resumo = analise && (() => {
    const regs = analise.registros
    const ativas = regs.filter((x) => x.status === 'ativa').length
    const canceladas = regs.filter((x) => x.status === 'cancelada').length
    const premio = regs.filter((x) => x.status === 'ativa').reduce((s, x) => s + (x.premioMensal ?? 0), 0)
    const segs = [...new Set(regs.map((x) => x.seguradora))].sort()
    return { total: regs.length, ativas, canceladas, premio, segs }
  })()

  return (
    <div>
      <PageHeader titulo="Planilha geral (Seguros Fechados)"
        subtitulo="Suba o .xlsx do escritório — o Hub lê a aba de apólices e atualiza os números do mês">
        <Button variant="secondary" onClick={() => onVoltar('apolices')}>← Voltar</Button>
      </PageHeader>

      <ComoFunciona id="planilha_geral" titulo="Como funciona a planilha geral">
        Esta é a sua planilha-mestre de seguros fechados. Suba o arquivo <strong>.xlsx</strong> original
        (sem converter nada) — o Hub encontra a aba das apólices vigentes, entende as colunas sozinho,
        junta as grafias diferentes da mesma seguradora e importa tudo. <strong>Todo mês</strong> que você
        subir a planilha atualizada, as apólices que já existem têm o prêmio e o status atualizados, e as
        novas entram automaticamente. Assessores, seguradoras e clientes que faltarem são criados na hora.
      </ComoFunciona>

      <Card className="p-5">
        <label
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer.files?.[0]) }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            arrastando ? 'border-laranja-400 bg-laranja-50' : 'border-slate-300 bg-slate-50/50 hover:border-laranja-300 hover:bg-laranja-50/40'}`}>
          <span className="rounded-xl bg-white p-3 text-laranja-600 shadow-sm"><FileSpreadsheet size={24} /></span>
          <span className="text-sm font-medium text-slate-700">Arraste a planilha aqui, ou clique para escolher</span>
          <span className="text-xs text-slate-400">Arquivo .xlsx da planilha geral de seguros fechados</span>
          <input type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => receber(e.target.files?.[0])} />
        </label>

        {lendo && <div className="mt-4"><Spinner /></div>}
        {erroLeitura && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erroLeitura}
          </p>
        )}

        {resumo && !resultado && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="mb-3 text-sm text-slate-500">
              Li <strong>{nomeArquivo}</strong> · aba <strong>“{analise.aba}”</strong>
              {analise.ignoradas > 0 && <> · {analise.ignoradas} linha(s) incompleta(s) ignorada(s)</>}
            </p>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200/70 bg-white p-3">
                <p className="text-xs text-slate-400">Apólices na planilha</p>
                <p className="font-display text-xl font-semibold text-slate-900">{resumo.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <p className="text-xs text-emerald-600">Ativas</p>
                <p className="font-display text-xl font-semibold text-emerald-700">{resumo.ativas}</p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white p-3">
                <p className="text-xs text-slate-400">Canceladas</p>
                <p className="font-display text-xl font-semibold text-slate-500">{resumo.canceladas}</p>
              </div>
              <div className="rounded-xl border border-laranja-200/70 bg-laranja-50/50 p-3">
                <p className="text-xs text-laranja-600">Prêmio mensal ativo</p>
                <p className="font-display text-xl font-semibold text-slate-900">{brl(resumo.premio)}</p>
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              <strong>{resumo.segs.length} seguradoras</strong> (grafias unificadas): {resumo.segs.join(', ')}
            </p>
            <div className="mb-4 overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead><tr className="bg-slate-50 text-slate-500">
                  {['Cliente', 'Assessor', 'Seguradora', 'Apólice', 'Prêmio/mês', '% Com.', 'Vigência', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {analise.registros.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{r.cliente}</td>
                      <td className="px-3 py-2 text-slate-500">{r.assessor ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.seguradora}</td>
                      <td className="px-3 py-2 text-slate-500">{r.numeroApolice ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.premioMensal != null ? brl(r.premioMensal) : '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.percentual != null ? `${r.percentual}%` : '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.vigencia ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge tom={r.status === 'ativa' ? 'green' : r.status === 'cancelada' ? 'red' : 'yellow'}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={importar} disabled={importando}>
              {importando ? <><RefreshCw size={15} className="animate-spin" /> Importando...</>
                : <><Upload size={15} /> Importar / atualizar {resumo.total} apólice(s)</>}
            </Button>
          </div>
        )}

        {importando && !resultado && <div className="mt-4"><Spinner /></div>}

        {resultado && (
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
              <CheckCircle2 size={17} className="text-emerald-600" />
              {resultado.ok} apólice(s) nova(s) · {resultado.atualizados} atualizada(s)
              {resultado.criados?.length > 0 && ` · criados: ${resultado.criados.join(', ')}`}
            </p>
            {resultado.erros.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 flex items-center gap-1 text-sm font-medium text-amber-700">
                  <AlertTriangle size={14} /> {resultado.erros.length} aviso(s):
                </p>
                <ul className="max-h-40 list-inside list-disc overflow-y-auto text-xs text-slate-500">
                  {resultado.erros.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400">
              As apólices importadas aparecem na seção “Pré-sistema” de cada cliente e alimentam o Pós-Venda,
              a carteira e os relatórios. Suba a planilha de novo no próximo mês para atualizar os números.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Importação de COMISSÕES (planilhas mensais das seguradoras) ────────────
// Arraste os arquivos originais (.xlsx/.xls/.csv) — pode vários de uma vez.
// O sistema lê cada um, reconhece o formato (Azos/Icatu/MAG oficiais, internas
// ou o consolidado do Hub), adivinha seguradora e mês pelo nome do arquivo e
// importa tudo num clique. Reimportar o mesmo mês substitui os dados antigos.
const brlComissao = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function ImportarComissoes({ onVoltar }) {
  const [arquivos, setArquivos] = useState([]) // [{ id, nome, deteccao, seguradora, competencia, erro }]
  const [texto, setTexto] = useState('')       // alternativa: colar células
  const [lendo, setLendo] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function receberArquivos(lista) {
    if (!lista?.length) return
    setResultado(null)
    setLendo(true)
    const novos = []
    for (const file of lista) {
      const base = { id: `${file.name}-${Date.now()}-${Math.random()}`, nome: file.name }
      try {
        const conteudo = await lerArquivoComissao(file)
        const deteccao = detectarPlanilha(conteudo)
        novos.push({
          ...base,
          deteccao,
          seguradora: deteccao?.perfil.seguradora ?? inferirSeguradora(file.name),
          competencia: inferirCompetencia(file.name),
          erro: deteccao ? null : 'Formato não reconhecido — nenhuma aba bate com os formatos conhecidos',
        })
      } catch (e) {
        novos.push({ ...base, deteccao: null, seguradora: '', competencia: '', erro: `Não consegui ler: ${e.message}` })
      }
    }
    setArquivos((a) => [...a, ...novos])
    setLendo(false)
  }

  function adicionarColado() {
    const deteccao = detectarPlanilha(texto)
    setArquivos((a) => [...a, {
      id: `colado-${Date.now()}`,
      nome: '(células coladas)',
      deteccao,
      seguradora: deteccao?.perfil.seguradora ?? '',
      competencia: '',
      erro: deteccao ? null : 'Formato não reconhecido — confira se a linha de cabeçalho veio junto',
    }])
    setTexto('')
  }

  function atualizar(id, campos) {
    setArquivos((a) => a.map((x) => (x.id === id ? { ...x, ...campos } : x)))
  }

  // Analisa cada arquivo com os campos atuais (editáveis nos cards)
  const analises = arquivos.map((a) => {
    if (!a.deteccao) return { ...a, registros: [], avisos: [], pronto: false }
    const { registros, avisos } = normalizarComissoes(a.deteccao, {
      competenciaPadrao: a.competencia ? `${a.competencia}-01` : null,
      seguradora: (a.seguradora ?? '').trim() || 'Seguradora',
    })
    const porLinha = Boolean(a.deteccao.perfil.porLinha)
    const seguradoraOk = porLinha || Boolean((a.seguradora ?? '').trim())
    const mesOk = registros.every((r) => r.competencia)
    return {
      ...a, registros, avisos, porLinha,
      seguradoraFixa: Boolean(a.deteccao.perfil.seguradora),
      pronto: registros.length > 0 && seguradoraOk && mesOk,
      pendencia: !seguradoraOk ? 'informe a seguradora' : !mesOk ? 'informe o mês' : null,
    }
  })
  const prontos = analises.filter((x) => x.pronto)
  const registrosTotais = prontos.flatMap((x) => x.registros)
  const totalGeral = registrosTotais.reduce((s, r) => s + r.valor, 0)

  async function importarTudo() {
    setImportando(true)
    const r = await importarComissoes(registrosTotais)
    setResultado(r)
    if (!r.erros.length) setArquivos([])
    setImportando(false)
  }

  return (
    <div>
      <PageHeader titulo="Importar Planilhas"
        subtitulo="Comissões: arraste os arquivos das seguradoras — o sistema faz o resto" />

      <ComoFunciona id="importar-comissoes-v2">
        Arraste para a área abaixo os arquivos <strong>do jeito que chegam</strong> das seguradoras
        (.xlsx, .xls ou .csv) — pode soltar <strong>todos de uma vez</strong>. O sistema lê cada um,
        reconhece se é Azos, Icatu, MAG, Omint ou a planilha interna, e ainda adivinha a seguradora e o mês
        pelo nome do arquivo (confira e ajuste se precisar). Depois é um clique em <strong>Importar tudo</strong>.
        Reimportar o mesmo mês substitui os dados — nunca duplica. Nada do Bruno é excluído, só separado.
      </ComoFunciona>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {Object.entries(MODELOS).map(([id, m]) => (
            <button key={id} onClick={() => onVoltar(id)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              {m.rotulo}
            </button>
          ))}
          <button className="rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Comissões (planilhas das seguradoras)
          </button>
        </div>

        {/* Zona de arrastar e soltar */}
        <label
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); receberArquivos([...e.dataTransfer.files]) }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            arrastando ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/40'}`}>
          <FileSpreadsheet size={30} className={arrastando ? 'text-blue-600' : 'text-slate-400'} />
          <p className="font-medium text-slate-700">
            Arraste as planilhas do mês aqui — pode soltar todas de uma vez
          </p>
          <p className="text-xs text-slate-400">
            ou clique para escolher · aceita .xlsx, .xlsm, .xls e .csv, do jeito que chegam das seguradoras
          </p>
          <input type="file" multiple accept=".xlsx,.xlsm,.xls,.csv,.txt" className="hidden"
            onChange={(e) => { receberArquivos([...e.target.files]); e.target.value = '' }} />
        </label>

        {lendo && <Spinner />}

        {/* Um card por arquivo */}
        {analises.length > 0 && (
          <div className="mt-5 space-y-3">
            {analises.map((a) => {
              const porProducao = a.registros.reduce((acc, r) => {
                const k = r.producao || 'A classificar'
                acc[k] = (acc[k] ?? 0) + r.valor
                return acc
              }, {})
              return (
                <div key={a.id} className={`rounded-xl border p-4 ${
                  a.erro ? 'border-red-200 bg-red-50/50' : a.pronto ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/40'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.erro
                      ? <AlertTriangle size={16} className="shrink-0 text-red-500" />
                      : a.pronto
                        ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        : <AlertTriangle size={16} className="shrink-0 text-amber-500" />}
                    <span className="max-w-[280px] truncate text-sm font-medium text-slate-800" title={a.nome}>{a.nome}</span>
                    {a.deteccao && <Badge tom="green">{a.deteccao.perfil.rotulo}</Badge>}
                    {a.registros.length > 0 && (
                      <>
                        <Badge>{a.registros.length} lançamento(s)</Badge>
                        <Badge tom="blue">{brlComissao(a.registros.reduce((s, r) => s + r.valor, 0))}</Badge>
                        {Object.entries(porProducao).map(([p, v]) => (
                          <Badge key={p} tom={p === 'A classificar' ? 'yellow' : 'slate'}>{p}: {brlComissao(v)}</Badge>
                        ))}
                      </>
                    )}
                    <button onClick={() => setArquivos((arr) => arr.filter((x) => x.id !== a.id))}
                      className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="Remover">
                      <X size={16} />
                    </button>
                  </div>

                  {a.erro && <p className="mt-2 text-xs text-red-600">{a.erro}</p>}

                  {a.deteccao && !a.porLinha && (
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div className="w-44">
                        <Campo label="Seguradora" obrigatorio={!a.seguradoraFixa}>
                          <Input value={a.seguradora} disabled={a.seguradoraFixa}
                            onChange={(e) => atualizar(a.id, { seguradora: e.target.value })}
                            placeholder="Ex.: Azos, MAG..." />
                        </Campo>
                      </div>
                      <div className="w-44">
                        <Campo label="Mês de competência">
                          <Input type="month" value={a.competencia}
                            onChange={(e) => atualizar(a.id, { competencia: e.target.value })} />
                        </Campo>
                      </div>
                      {a.pendencia && <p className="pb-2 text-xs font-medium text-amber-700">← {a.pendencia}</p>}
                    </div>
                  )}
                  {a.porLinha && (
                    <p className="mt-2 text-xs text-emerald-700">Mês e seguradora vêm de cada linha do próprio arquivo.</p>
                  )}
                  {a.avisos.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-amber-700">
                      {a.avisos.slice(0, 3).map((av, i) => <li key={i}>{av}</li>)}
                    </ul>
                  )}
                </div>
              )
            })}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={importarTudo} disabled={importando || prontos.length === 0}>
                <Upload size={15} />
                {importando
                  ? 'Importando...'
                  : `Importar tudo (${prontos.length} arquivo(s), ${registrosTotais.length} lançamentos, ${brlComissao(totalGeral)})`}
              </Button>
              {analises.some((x) => !x.pronto) && (
                <p className="text-xs text-amber-700">
                  Arquivos com aviso ficam de fora — complete o que falta ou remova (✕).
                </p>
              )}
            </div>
          </div>
        )}

        {/* Alternativa: colar células */}
        {arquivos.length === 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
              Prefere copiar e colar as células? Clique aqui
            </summary>
            <div className="mt-3">
              <Textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder={'Cole aqui as células da planilha, com a linha de cabeçalho'} />
              <div className="mt-2">
                <Button variant="secondary" disabled={!texto.trim()} onClick={adicionarColado}>
                  Analisar o que colei
                </Button>
              </div>
            </div>
          </details>
        )}

        {importando && <Spinner />}

        {resultado && (
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              <CheckCircle2 size={17} className="text-emerald-600" />
              {resultado.ok} lançamento(s) importado(s)
              {resultado.substituidos > 0 && ` · ${resultado.substituidos} antigo(s) do mesmo mês substituído(s)`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Confira em <strong>Relatórios → Fechamento para o financeiro</strong> — a faixa verde confirma que os totais batem.
            </p>
            {resultado.erros.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-red-600">
                {resultado.erros.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

async function importarComissoes(registros) {
  const erros = []

  // vincula assessor (por código) e cliente (por código ou nome) quando existem
  const [{ data: assessores }, { data: clientes }] = await Promise.all([
    supabase.from('assessores').select('id, codigo'),
    supabase.from('clientes').select('id, nome, codigo'),
  ])
  const assessorPorCod = new Map((assessores ?? []).filter((a) => a.codigo).map((a) => [normalizar(a.codigo), a.id]))
  const clientePorCod = new Map((clientes ?? []).filter((c) => c.codigo).map((c) => [normalizar(c.codigo), c.id]))
  const clientePorNome = new Map((clientes ?? []).map((c) => [normalizar(c.nome), c.id]))

  const linhas = registros.map((r) => ({
    ...r,
    id_assessor: (r.codigo_assessor && assessorPorCod.get(normalizar(r.codigo_assessor))) ?? null,
    id_cliente: (r.codigo_cliente && clientePorCod.get(normalizar(r.codigo_cliente)))
      ?? clientePorNome.get(normalizar(r.cliente_nome)) ?? null,
    origem: 'importador',
  }))

  // Substitui o que já existia para as mesmas competência+seguradora+segmento.
  // O segmento PRECISA fazer parte da chave: comissões e campanhas da Azos (ou
  // Icatu individual e empresarial) do mesmo mês convivem — importar um não
  // pode apagar o outro.
  const pares = [...new Set(linhas.map((l) => `${l.competencia}|${l.seguradora}|${l.segmento}`))]
  let substituidos = 0
  for (const par of pares) {
    const [comp, seg, segmento] = par.split('|')
    const { count, error } = await supabase.from('comissoes_importadas')
      .delete({ count: 'exact' }).eq('competencia', comp).eq('seguradora', seg).eq('segmento', segmento)
    if (error) return { ok: 0, substituidos: 0, erros: [`Falha ao limpar dados antigos: ${error.message}`] }
    substituidos += count ?? 0
  }

  let ok = 0
  for (let i = 0; i < linhas.length; i += 200) {
    const lote = linhas.slice(i, i + 200)
    const { error, data } = await supabase.from('comissoes_importadas').insert(lote).select('id')
    if (error) erros.push(`Lote ${i / 200 + 1}: ${error.message}`)
    else ok += data.length
  }
  return { ok, substituidos, erros }
}

// ─── Importação de ASSESSORES (lista oficial do escritório) ─────────────────
// Upsert por código: quem já existe é atualizado (nome/e-mail/telefone), quem
// não existe é criado. Depois religa os lançamentos de comissão que estavam
// com código sem cadastro — os nomes aparecem no fechamento na hora.
async function importarAssessores({ linhas, mapa }) {
  const erros = []
  const { data: existentes } = await supabase.from('assessores').select('id, nome, codigo')
  const porCod = new Map((existentes ?? []).filter((a) => a.codigo).map((a) => [normalizar(a.codigo), a]))
  const porNome = new Map((existentes ?? []).map((a) => [normalizar(a.nome), a]))

  let criadosN = 0, atualizados = 0
  const finais = []
  for (const [i, l] of linhas.entries()) {
    const nome = (l[mapa.nome] ?? '').trim()
    const codigo = (l[mapa.codigo] ?? '').trim()
    if (!nome) { erros.push(`Linha ${i + 2}: sem nome`); continue }
    const payload = {
      nome,
      ...(codigo && { codigo }),
      ...(mapa.email !== undefined && l[mapa.email]?.trim() && { email: l[mapa.email].trim().toLowerCase() }),
      ...(mapa.telefone !== undefined && l[mapa.telefone]?.trim() && { telefone: l[mapa.telefone].trim() }),
    }
    const alvo = (codigo && porCod.get(normalizar(codigo))) || porNome.get(normalizar(nome))
    if (alvo) {
      const { error } = await supabase.from('assessores').update(payload).eq('id', alvo.id)
      if (error) erros.push(`Linha ${i + 2} (${nome}): ${error.message}`)
      else { atualizados += 1; finais.push({ id: alvo.id, codigo: codigo || alvo.codigo }) }
    } else {
      const { data, error } = await supabase.from('assessores').insert(payload).select('id').single()
      if (error) erros.push(`Linha ${i + 2} (${nome}): ${error.message}`)
      else { criadosN += 1; finais.push({ id: data.id, codigo }) }
    }
  }

  // religa lançamentos importados antes deste cadastro (id_assessor vazio)
  let vinculados = 0
  for (const a of finais) {
    if (!a.codigo) continue
    const { count } = await supabase.from('comissoes_importadas')
      .update({ id_assessor: a.id }, { count: 'exact' })
      .is('id_assessor', null).ilike('codigo_assessor', a.codigo)
    vinculados += count ?? 0
  }

  const criados = [`${criadosN} novo(s) · ${atualizados} atualizado(s)`]
  if (vinculados) criados.push(`${vinculados} lançamento(s) de comissão religado(s) ao nome`)
  return { ok: criadosN + atualizados, erros, criados }
}

// ─── Importação de CLIENTES ──────────────────────────────────────────────────
async function importarClientes({ linhas, mapa }) {
  const erros = []
  const criados = []

  // assessores existentes (indexados por nome E por código)
  const { data: assessores } = await supabase.from('assessores').select('id, nome, codigo')
  const porNome = new Map((assessores ?? []).map((a) => [normalizar(a.nome), a.id]))
  const porCod = new Map((assessores ?? []).filter((a) => a.codigo).map((a) => [normalizar(a.codigo), a.id]))

  const acharAssessor = (l) => {
    const cod = mapa.cod_assessor !== undefined ? normalizar(l[mapa.cod_assessor]) : ''
    if (cod && porCod.has(cod)) return porCod.get(cod)
    return porNome.get(normalizar((l[mapa.assessor] ?? '').trim()))
  }

  // cria assessores que faltam (por nome, já com código se a planilha tiver)
  const faltantes = new Map()
  linhas.forEach((l) => {
    const nome = (l[mapa.assessor] ?? '').trim()
    if (nome && acharAssessor(l) === undefined) {
      const cod = mapa.cod_assessor !== undefined ? (l[mapa.cod_assessor] || null) : null
      faltantes.set(normalizar(nome), { nome, codigo: cod })
    }
  })
  if (faltantes.size) {
    const { data: novos, error } = await supabase.from('assessores')
      .insert([...faltantes.values()]).select('id, nome, codigo')
    if (error) return { ok: 0, erros: [`Falha ao criar assessores: ${error.message}`], criados }
    for (const a of novos) {
      porNome.set(normalizar(a.nome), a.id)
      if (a.codigo) porCod.set(normalizar(a.codigo), a.id)
    }
    criados.push(`${novos.length} assessor(es)`)
  }

  const mapaEtapa = new Map(ETAPAS.flatMap((e) => [
    [normalizar(e.id), e.id], [normalizar(e.label), e.id],
  ]))

  // Proteção contra duplicação: quem já existe (mesmo nome ou mesmo código)
  // é PULADO — reimportar a planilha nunca cria o cliente duas vezes.
  const { data: jaExistem } = await supabase.from('clientes').select('nome, codigo')
  const nomesExistentes = new Set((jaExistem ?? []).map((c) => normalizar(c.nome)))
  const codigosExistentes = new Set((jaExistem ?? []).filter((c) => c.codigo).map((c) => normalizar(c.codigo)))
  let pulados = 0

  const registros = []
  linhas.forEach((l, i) => {
    const nome = (l[mapa.nome] ?? '').trim()
    const assessor = (l[mapa.assessor] ?? '').trim()
    const idAssessor = acharAssessor(l)
    if (!nome) return erros.push(`Linha ${i + 2}: sem nome`)
    const codigo = mapa.codigo !== undefined ? normalizar(l[mapa.codigo]) : ''
    if (nomesExistentes.has(normalizar(nome)) || (codigo && codigosExistentes.has(codigo))) {
      pulados += 1
      return
    }
    nomesExistentes.add(normalizar(nome)) // evita duplicar dentro da própria planilha
    if (idAssessor === undefined) return erros.push(`Linha ${i + 2} (${nome}): assessor "${assessor}" inválido`)
    const etapaBruta = mapa.etapa !== undefined ? normalizar(l[mapa.etapa]) : ''
    registros.push({
      nome,
      codigo: mapa.codigo !== undefined ? l[mapa.codigo] || null : null,
      id_assessor: idAssessor,
      telefone: mapa.telefone !== undefined ? l[mapa.telefone] || null : null,
      email: mapa.email !== undefined ? l[mapa.email] || null : null,
      data_nascimento: mapa.nascimento !== undefined ? paraDataISO(l[mapa.nascimento]) : null,
      status_funil: mapaEtapa.get(etapaBruta) ?? 'lead_recebido',
      perfil_necessidade: mapa.perfil !== undefined ? l[mapa.perfil] || null : null,
      importado: true,
    })
  })

  let ok = 0
  for (let i = 0; i < registros.length; i += 100) {
    const lote = registros.slice(i, i + 100)
    const { error, data } = await supabase.from('clientes').insert(lote).select('id')
    if (error) erros.push(`Lote ${i / 100 + 1}: ${error.message}`)
    else ok += data.length
  }
  if (pulados > 0) criados.push(`${pulados} cliente(s) já existiam e foram pulados (sem duplicar)`)
  return { ok, erros, criados }
}

// ─── Importação de APÓLICES ──────────────────────────────────────────────────
async function importarApolices({ linhas, mapa }) {
  const erros = []
  const criados = []

  const [{ data: clientes }, { data: seguradoras }] = await Promise.all([
    supabase.from('clientes').select('id, nome, codigo'),
    supabase.from('seguradoras').select('id, nome'),
  ])
  const clientePorNome = new Map((clientes ?? []).map((c) => [normalizar(c.nome), c.id]))
  const clientePorCod = new Map((clientes ?? []).filter((c) => c.codigo).map((c) => [normalizar(c.codigo), c.id]))
  const segPorNome = new Map((seguradoras ?? []).map((s) => [normalizar(s.nome), s.id]))

  // cria seguradoras que não existem (comissão 0% — ajustar depois em Cadastros)
  const segNovas = [...new Set(
    linhas.map((l) => (l[mapa.seguradora] ?? '').trim()).filter((n) => n && !segPorNome.has(normalizar(n)))
  )]
  if (segNovas.length) {
    const { data: novas, error } = await supabase.from('seguradoras')
      .insert(segNovas.map((nome) => ({ nome, comissao_padrao_percentual: 0 }))).select('id, nome')
    if (error) return { ok: 0, erros: [`Falha ao criar seguradoras: ${error.message}`], criados }
    for (const s of novas) segPorNome.set(normalizar(s.nome), s.id)
    criados.push(`${novas.length} seguradora(s) com comissão 0% — ajuste em Cadastros!`)
  }

  // Proteção contra duplicação: apólice do mesmo cliente + seguradora com o
  // mesmo nº (ou, sem nº, com a mesma vigência e prêmio) é PULADA no reimport.
  const { data: apExistentes } = await supabase.from('apolices')
    .select('id_cliente, id_seguradora, numero_apolice, data_vigencia, valor_premio_mensal')
  const chaveAp = (a) => a.numero_apolice
    ? `${a.id_cliente}|${a.id_seguradora}|n:${normalizar(a.numero_apolice)}`
    : `${a.id_cliente}|${a.id_seguradora}|v:${a.data_vigencia}|${Number(a.valor_premio_mensal)}`
  const apolicesExistentes = new Set((apExistentes ?? []).map(chaveAp))
  let pulados = 0

  const registros = []
  linhas.forEach((l, i) => {
    const nomeCliente = (l[mapa.cliente] ?? '').trim()
    const codCliente = mapa.cod_cliente !== undefined ? normalizar(l[mapa.cod_cliente]) : ''
    const idCliente = (codCliente && clientePorCod.get(codCliente)) || clientePorNome.get(normalizar(nomeCliente))
    if (!idCliente) return erros.push(`Linha ${i + 2}: cliente "${nomeCliente}" não encontrado — importe os clientes primeiro`)
    const premio = paraNumero(l[mapa.premio])
    // capital é opcional: planilhas históricas (como a geral) não trazem —
    // entra 0 e pode ser completado depois na apólice do cliente
    const capital = mapa.capital !== undefined ? paraNumero(l[mapa.capital]) : null
    const vigencia = paraDataISO(l[mapa.vigencia])
    if (premio == null || !vigencia)
      return erros.push(`Linha ${i + 2} (${nomeCliente}): prêmio ou vigência inválidos`)
    // Histórico completo: a planilha geral traz INATIVO + motivo do
    // cancelamento — entram como 'cancelada' (as automações de pós-venda só
    // olham apólices ativas, então nada dispara para elas).
    const statusBruto = mapa.status !== undefined ? normalizar(l[mapa.status]) : ''
    const status = /inativ|cancel/.test(statusBruto) ? 'cancelada'
      : /suspens/.test(statusBruto) ? 'suspensa' : 'ativa'
    const candidata = {
      id_cliente: idCliente,
      id_seguradora: segPorNome.get(normalizar(l[mapa.seguradora])),
      numero_apolice: mapa.numero !== undefined ? l[mapa.numero] || null : null,
      data_vigencia: vigencia, valor_premio_mensal: premio,
    }
    if (apolicesExistentes.has(chaveAp(candidata))) { pulados += 1; return }
    apolicesExistentes.add(chaveAp(candidata))
    registros.push({
      id_cliente: idCliente,
      id_seguradora: segPorNome.get(normalizar(l[mapa.seguradora])),
      valor_premio_mensal: premio,
      capital_segurado: capital ?? 0,
      data_vigencia: vigencia,
      percentual_comissao: mapa.percentual !== undefined ? paraNumero(l[mapa.percentual]) : null,
      numero_apolice: mapa.numero !== undefined ? l[mapa.numero] || null : null,
      status,
      // coluna da migração 012 — só entra se a planilha trouxer motivo
      ...(mapa.motivo !== undefined && (l[mapa.motivo] ?? '').trim() !== ''
        && { motivo_cancelamento: l[mapa.motivo].trim() }),
      // coluna da migração 013 — só entra se a planilha trouxer o produto
      ...(mapa.tipo !== undefined && (l[mapa.tipo] ?? '').trim() !== ''
        && { tipo_produto: l[mapa.tipo].trim() }),
      importada: true,
    })
  })

  let ok = 0
  for (let i = 0; i < registros.length; i += 100) {
    const lote = registros.slice(i, i + 100)
    const { error, data } = await supabase.from('apolices').insert(lote).select('id')
    if (error) erros.push(`Lote ${i / 100 + 1}: ${error.message}`)
    else ok += data.length
  }
  if (pulados > 0) criados.push(`${pulados} apólice(s) já existiam e foram puladas (sem duplicar)`)
  return { ok, erros, criados }
}
