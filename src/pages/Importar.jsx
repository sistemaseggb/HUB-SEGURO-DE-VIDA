import { useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle, Download, Landmark } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseCSV, acharColuna, normalizar, paraDataISO, paraNumero, baixarCSV } from '../lib/csv'
import { detectarPlanilha, normalizarComissoes } from '../lib/planilhasComissao'
import { ETAPAS } from '../lib/constants'
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
  apolices: {
    rotulo: 'Apólices (vendas já feitas)',
    colunas: {
      cliente:     { apelidos: ['cliente', 'nome', 'segurado'], obrigatorio: true },
      cod_cliente: { apelidos: ['codigocliente', 'codcliente', 'codigo', 'cod'] },
      seguradora:  { apelidos: ['seguradora', 'cia', 'companhia'], obrigatorio: true },
      premio:     { apelidos: ['premio', 'mensalidade', 'valor'], obrigatorio: true },
      capital:    { apelidos: ['capital', 'cobertura', 'importancia'], obrigatorio: true },
      vigencia:   { apelidos: ['vigencia', 'inicio', 'emissao', 'data'], obrigatorio: true },
      percentual: { apelidos: ['percentual', 'comissao', '%'] },
      numero:     { apelidos: ['numero', 'apolice', 'contrato'] },
    },
    exemplo: [
      ['Cliente', 'Seguradora', 'Prêmio mensal', 'Capital', 'Vigência', '% Comissão', 'Nº apólice'],
      ['Maria Souza', 'Prudential do Brasil', 'R$ 500,00', 'R$ 1.000.000,00', '01/03/2024', '40', 'AP-12345'],
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
    const r = modo === 'clientes'
      ? await importarClientes(analise)
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
        <div className="mb-4 flex gap-2">
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
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => baixarCSV(`modelo-${modo}.csv`, modelo.exemplo[0], [modelo.exemplo[1]])}>
            <Download size={15} /> Baixar planilha modelo
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Cole aqui o conteúdo da planilha (copie as células no Excel/Sheets e cole)"
            dica="Primeira linha deve ser o cabeçalho. Separador , ; ou TAB — detectado sozinho.">
            <Textarea rows={7} value={texto}
              onChange={(e) => { setTexto(e.target.value); analisar(e.target.value) }}
              placeholder={modelo.exemplo.map((l) => l.join(';')).join('\n')} />
          </Campo>
          <div>
            <Campo label="...ou envie um arquivo .csv">
              <input type="file" accept=".csv,.txt" onChange={lerArquivo}
                className="w-full rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500" />
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

// ─── Importação de COMISSÕES (planilhas mensais das seguradoras) ────────────
// Detecta sozinho o formato (Azos/Icatu/MAG oficiais ou a planilha interna
// com Produção/Cód. assessor), normaliza valores e competência e grava em
// comissoes_importadas. Reimportar o mesmo mês substitui os dados antigos.
function ImportarComissoes({ onVoltar }) {
  const [texto, setTexto] = useState('')
  const [deteccao, setDeteccao] = useState(null) // { perfil, cabecalho, linhas }
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [seguradora, setSeguradora] = useState('')
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  function analisar(t) {
    setResultado(null)
    const d = detectarPlanilha(t)
    setDeteccao(d)
    if (d?.perfil.seguradora) setSeguradora(d.perfil.seguradora)
  }

  const seguradoraFixa = Boolean(deteccao?.perfil.seguradora)
  const { registros, avisos } = deteccao
    ? normalizarComissoes(deteccao, {
        competenciaPadrao: competencia ? `${competencia}-01` : null,
        seguradora: seguradora.trim() || 'Seguradora',
      })
    : { registros: [], avisos: [] }
  const total = registros.reduce((s, r) => s + r.valor, 0)
  const porProducao = registros.reduce((acc, r) => {
    const k = r.producao || 'A classificar'
    acc[k] = (acc[k] ?? 0) + r.valor
    return acc
  }, {})
  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function importar() {
    setImportando(true)
    setResultado(await importarComissoes(registros))
    setImportando(false)
  }

  return (
    <div>
      <PageHeader titulo="Importar Planilhas"
        subtitulo="Comissões: cole a planilha da seguradora e o sistema reconhece o formato sozinho" />

      <ComoFunciona id="importar-comissoes">
        Abra a planilha do mês (da seguradora ou a sua interna), selecione as células <strong>com o cabeçalho</strong>,
        copie e cole abaixo. O sistema reconhece sozinho se é Azos, Icatu, MAG ou a planilha interna com
        <strong> Produção (Nati/Bruno)</strong> — nada do Bruno é excluído, só separado. Estornos entram como valor
        negativo. Importar o mesmo mês de novo <strong>substitui</strong> os dados anteriores (pode repetir sem medo).
        Os totais aparecem em <strong>Relatórios</strong>.
      </ComoFunciona>

      <Card className="p-5">
        <div className="mb-4 flex gap-2">
          <button onClick={() => onVoltar('clientes')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Clientes / Leads
          </button>
          <button onClick={() => onVoltar('apolices')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Apólices (vendas já feitas)
          </button>
          <button className="rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Comissões (planilhas das seguradoras)
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Campo label="Cole aqui as células da planilha (com a linha de cabeçalho)"
              dica="Funciona com as planilhas oficiais (Azos, Icatu, MAG) e com as internas mensais.">
              <Textarea rows={8} value={texto}
                onChange={(e) => { setTexto(e.target.value); analisar(e.target.value) }}
                placeholder={'Nome do Segurado\tCódigo assessor\tProdução\tParcela\tComissão Bruta\n...'} />
            </Campo>
            <Campo label="...ou envie o arquivo .csv (ex.: relatório da MAG)">
              <input type="file" accept=".csv,.txt"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  if (!arquivo) return
                  const leitor = new FileReader()
                  leitor.onload = () => { setTexto(leitor.result); analisar(leitor.result) }
                  leitor.readAsText(arquivo, 'utf-8')
                }}
                className="w-full rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500" />
            </Campo>
          </div>
          <div className="space-y-3">
            <Campo label="Mês de competência" obrigatorio
              dica="Usado quando a planilha não traz o mês (Icatu/Omint internas).">
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </Campo>
            <Campo label="Seguradora" obrigatorio={!seguradoraFixa}
              dica={seguradoraFixa ? 'Identificada pelo formato da planilha.' : 'Ex.: Azos, Icatu, MAG, Omint...'}>
              <Input value={seguradora} disabled={seguradoraFixa}
                onChange={(e) => setSeguradora(e.target.value)} placeholder="Nome da seguradora" />
            </Campo>
          </div>
        </div>

        {texto.trim() && !deteccao && (
          <p className="mt-4 flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle size={15} />
            Formato não reconhecido. Confira se a <strong>linha de cabeçalho</strong> veio junto na colagem.
          </p>
        )}

        {deteccao && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tom="green"><Landmark size={12} /> {deteccao.perfil.rotulo}</Badge>
              <Badge>{registros.length} lançamento(s)</Badge>
              <Badge tom="blue">Total {brl(total)}</Badge>
              {Object.entries(porProducao).map(([p, v]) => (
                <Badge key={p} tom={p === 'A classificar' ? 'yellow' : 'slate'}>{p}: {brl(v)}</Badge>
              ))}
            </div>

            {avisos.length > 0 && (
              <ul className="mb-3 list-inside list-disc text-xs text-amber-700">
                {avisos.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    {['Cliente', 'Competência', 'Produção', 'Cód. assessor', 'Parcela', 'Receita', 'Valor'].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registros.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{r.cliente_nome}</td>
                      <td className="px-3 py-2">{r.competencia ?? '—'}</td>
                      <td className="px-3 py-2">{r.producao ?? '—'}</td>
                      <td className="px-3 py-2">{r.codigo_assessor ?? '—'}</td>
                      <td className="px-3 py-2">{r.parcela ?? '—'}</td>
                      <td className="px-3 py-2">{r.tipo_receita}</td>
                      <td className={`px-3 py-2 font-medium ${r.valor < 0 ? 'text-red-600' : 'text-slate-800'}`}>{brl(r.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <Button onClick={importar}
                disabled={importando || registros.length === 0 || !seguradora.trim() || registros.some((r) => !r.competencia)}>
                <Upload size={15} /> {importando ? 'Importando...' : `Importar ${registros.length} lançamento(s)`}
              </Button>
            </div>
          </div>
        )}

        {importando && <Spinner />}

        {resultado && (
          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              <CheckCircle2 size={17} className="text-emerald-600" />
              {resultado.ok} lançamento(s) importado(s)
              {resultado.substituidos > 0 && ` · ${resultado.substituidos} antigo(s) do mesmo mês substituído(s)`}
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

  // substitui o que já existia para as mesmas competência+seguradora
  const pares = [...new Set(linhas.map((l) => `${l.competencia}|${l.seguradora}`))]
  let substituidos = 0
  for (const par of pares) {
    const [comp, seg] = par.split('|')
    const { count, error } = await supabase.from('comissoes_importadas')
      .delete({ count: 'exact' }).eq('competencia', comp).eq('seguradora', seg)
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

  const registros = []
  linhas.forEach((l, i) => {
    const nome = (l[mapa.nome] ?? '').trim()
    const assessor = (l[mapa.assessor] ?? '').trim()
    const idAssessor = acharAssessor(l)
    if (!nome) return erros.push(`Linha ${i + 2}: sem nome`)
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

  const registros = []
  linhas.forEach((l, i) => {
    const nomeCliente = (l[mapa.cliente] ?? '').trim()
    const codCliente = mapa.cod_cliente !== undefined ? normalizar(l[mapa.cod_cliente]) : ''
    const idCliente = (codCliente && clientePorCod.get(codCliente)) || clientePorNome.get(normalizar(nomeCliente))
    if (!idCliente) return erros.push(`Linha ${i + 2}: cliente "${nomeCliente}" não encontrado — importe os clientes primeiro`)
    const premio = paraNumero(l[mapa.premio])
    const capital = paraNumero(l[mapa.capital])
    const vigencia = paraDataISO(l[mapa.vigencia])
    if (premio == null || capital == null || !vigencia)
      return erros.push(`Linha ${i + 2} (${nomeCliente}): prêmio, capital ou vigência inválidos`)
    registros.push({
      id_cliente: idCliente,
      id_seguradora: segPorNome.get(normalizar(l[mapa.seguradora])),
      valor_premio_mensal: premio,
      capital_segurado: capital,
      data_vigencia: vigencia,
      percentual_comissao: mapa.percentual !== undefined ? paraNumero(l[mapa.percentual]) : null,
      numero_apolice: mapa.numero !== undefined ? l[mapa.numero] || null : null,
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
  return { ok, erros, criados }
}
