import { useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseCSV, acharColuna, normalizar, paraDataISO, paraNumero, baixarCSV } from '../lib/csv'
import { ETAPAS } from '../lib/constants'
import { PageHeader, Card, Button, Textarea, Campo, Spinner } from '../components/ui'

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
