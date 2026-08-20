// ─────────────────────────────────────────────────────────────────────────────
// O PLANEJAMENTO QUE O CLIENTE PREENCHE SOZINHO, POSTO À PROVA.
//
// Este formulário é o único lugar do sistema onde alguém DE FORA escreve nos
// números do estudo. Não há consultora ao lado para notar que a renda saiu com
// um zero a mais, e não há segunda chance: se o envio falhar no último passo,
// o cliente não volta. Então tudo aqui é testado pelo pior caso — texto onde
// devia haver número, negativo, valor absurdo, id inventado, lista com linha
// em branco, campo que ele simplesmente pulou.
//
// A checagem mais importante do arquivo é a última: a lista de colunas que o
// JavaScript grava tem que ser EXATAMENTE a que a função SQL da migração 029
// grava. As duas implementam a mesma regra em lugares diferentes (a do banco é
// a que vale em produção; a do JavaScript serve à revisão do cliente, ao painel
// da consultora e ao modo demonstração), e nada as manteria juntas além disto.
//
// Roda com `node scripts/teste-planejamento-publico.mjs` (e junto do resto em
// `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import {
  ETAPAS_PLANO, etapasVisiveis, camposVisiveis, validarEtapa, aplicarAoPlano,
  resumoRespostas, normalizarRespostas, numero, limparBeneficiarios, limparFilhos,
  limparSeguros, COLUNAS_DO_CLIENTE, FAIXAS,
} from '../src/lib/planejamentoPublico.js'
import { calcularEstudo } from '../src/lib/estudo.js'

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}
const etapaPorId = (id) => ETAPAS_PLANO.find((e) => e.id === id)

// ── 1. NÚMERO: o que o celular manda e o que vira conta ─────────────────────
console.log('\n── Lendo número como ele chega do formulário ──')
for (const [entrada, esperado] of [
  ['12000', 12000], [12000, 12000], ['12.000,50', 12000.5], ['12000.5', 12000.5],
  ['1.234.567,89', 1234567.89], ['', 0], ['   ', 0], ['abc', 0], [null, 0],
  [undefined, 0], [true, 0], [NaN, 0], [Infinity, 0], ['-500', -500],
]) {
  const saiu = numero(entrada)
  ok(saiu === esperado, `numero(${JSON.stringify(entrada)}) = ${esperado}`, saiu)
}

// ── 2. AS COLUNAS QUE O CLIENTE ALIMENTA ────────────────────────────────────
console.log('\n── Um estudo completo, preenchido pelo cliente ──')
const completo = {
  tipo_planejamento: 'pf_pj',
  focos: ['renda', 'sucessao', 'empresarial'],
  profissao: '  Arquiteta  ',
  estado_civil: 'Casado(a)', conjuge_nome: 'Bruno Lima', regime_bens: 'Comunhão parcial',
  uf: 'pr',
  dependentes: [
    { nome: 'Alice', idade: '7', custo_mensal: '2.500,00' },
    { nome: '', idade: '', custo_mensal: '' },
    { nome: 'Theo', idade: 21, custo_mensal: 1800 },
  ],
  renda_mensal: '32.000,00', custo_vida_mensal: 18000,
  dividas_total: '450000', dividas_prazo_anos: '12',
  patrimonio_imoveis: 1200000, patrimonio_investimentos: '350000.50',
  previdencia_saldo: 210000, previdencia_tipo: 'PGBL', previdencia_aporte_mensal: 3000,
  tem_holding: false, tem_testamento: true,
  pj_razao_social: 'Lima Arquitetura Ltda', pj_valuation: 4000000,
  pj_participacao_pct: '40', pj_num_socios: 3, pj_lucro_anual: 900000,
  pj_divida_avalizada: 600000,
  renda_desejada_aposentadoria: 20000, idade_aposentadoria: 60,
  seguros_existentes: [
    { origem: 'empresa', descricao: 'Vida em grupo', capital: '500000', custeio: 'empresa' },
    { origem: 'banco', descricao: 'Prestamista', capital: 300000, custeio: 'proprio' },
  ],
  altura_cm: '168', peso_kg: '62', fumante: false,
  atividades_risco: ['moto'], condicoes_declaradas: 'Nenhuma.',
  beneficiarios: [
    { nome: 'Bruno Lima', parentesco: 'Cônjuge', pct: 50, nascimento: '1984-05-02' },
    { nome: 'Alice Lima', parentesco: 'Filho(a)', pct: '25' },
    { nome: 'Theo Lima', parentesco: 'Filho(a)', pct: 25 },
  ],
  objetivos_chips: ['Deixar um legado'],
  objetivos: 'Que a Alice termine a faculdade.',
}
const p = aplicarAoPlano(completo)

ok(p.profissao === 'Arquiteta', 'espaços das pontas somem do texto', JSON.stringify(p.profissao))
ok(p.uf === 'PR', 'UF sobe para maiúsculo (a constraint do banco exige)', p.uf)
ok(p.renda_mensal === 32000, 'renda em pt-BR vira número', p.renda_mensal)
ok(p.patrimonio_investimentos === 350000.5, 'decimal com ponto é preservado', p.patrimonio_investimentos)

console.log('\n── O que é DERIVADO (e nunca perguntado duas vezes) ──')
ok(p.dependentes.length === 2, 'linha em branco de filho não vai para o banco', p.dependentes.length)
ok(p.num_dependentes === 2, 'num_dependentes sai da lista de filhos', p.num_dependentes)
ok(p.filhos_idades === '7, 21 anos', 'filhos_idades é montado das idades', p.filhos_idades)
ok(p.patrimonio_total === 1550000.5, 'patrimonio_total = soma das classes de bens', p.patrimonio_total)
ok(p.cobertura_atual === 800000, 'cobertura_atual = soma dos seguros declarados', p.cobertura_atual)
ok(p.herdeiros_menores === true, 'filho de 7 anos já responde "herdeiro menor"', p.herdeiros_menores)
ok(p.objetivos === 'Deixar um legado. Que a Alice termine a faculdade.',
  'chips e texto livre viram um parágrafo só', p.objetivos)

console.log('\n── O que o cliente NÃO decide ──')
for (const proibida of [
  'capital_sugerido', 'capital_invalidez', 'capital_doencas_graves', 'dit_diaria',
  'premio_estimado', 'premio_anual', 'verba_sucessoria', 'anos_protecao',
  'itcmd_pct', 'custas_pct', 'token_proposta', 'id', 'id_cliente',
]) {
  ok(!(proibida in p), `${proibida} não é escrito pelo formulário do cliente`)
}
// e nem forçando a barra
const forcado = aplicarAoPlano({
  ...completo, capital_sugerido: 99999999, premio_estimado: 1, anos_protecao: 99,
  token_proposta: 'roubado', id_cliente: 'outro-cliente',
})
ok(!('capital_sugerido' in forcado) && !('token_proposta' in forcado) && !('id_cliente' in forcado),
  'chave extra enviada na marra é ignorada')

// ── 3. BRANCO NÃO APAGA ─────────────────────────────────────────────────────
console.log('\n── Branco não apaga o que a consultora já tinha anotado ──')
const soCusto = aplicarAoPlano({ custo_vida_mensal: 25000 })
ok(soCusto.custo_vida_mensal === 25000, 'o que ele respondeu entra')
ok(!('renda_mensal' in soCusto), 'o que ele não respondeu não vira nulo', JSON.stringify(soCusto))
ok(Object.keys(soCusto).length === 1, 'nada mais é tocado', Object.keys(soCusto).join(','))
ok(aplicarAoPlano({ dividas_total: '0' }).dividas_total === 0,
  'zero digitado é resposta, e vale zero')
ok(!('dividas_total' in aplicarAoPlano({ dividas_total: '' })),
  'campo em branco não é o mesmo que zero')

// ── 4. ENTRADA HOSTIL ───────────────────────────────────────────────────────
console.log('\n── Entrada hostil: texto, negativo, absurdo, id inventado ──')
const hostil = aplicarAoPlano({
  tipo_planejamento: 'hacker',
  focos: ['renda', 'INVENTADO', 'renda'],
  estado_civil: 'Alienígena',
  regime_bens: 'Comunhão universal',
  uf: 'Paraná',
  renda_mensal: 'muito dinheiro',
  patrimonio_imoveis: -900000,
  patrimonio_veiculos: '999999999999999999999',
  altura_cm: '5000', peso_kg: '0.2',
  idade_aposentadoria: 3,
  dividas_prazo_anos: 900,
  pj_participacao_pct: '150',
  atividades_risco: ['teleporte'],
  beneficiarios: [{ nome: 'X', parentesco: 'Imperador', pct: 999, nascimento: 'ontem' }],
  dependentes: [{ nome: 'Y', idade: 900, custo_mensal: -5 }],
  seguros_existentes: [{ origem: 'cripto', descricao: 'algo', capital: -1 }],
})
ok(!('tipo_planejamento' in hostil), 'tipo de planejamento inventado é descartado')
ok(hostil.focos.join() === 'renda', 'foco inventado sai e repetido não duplica', hostil.focos.join())
ok(!('estado_civil' in hostil), 'estado civil fora da lista é descartado')
ok(!('regime_bens' in hostil), 'regime de bens só vale para quem é casado/união')
ok(!('uf' in hostil), 'UF por extenso não passa (a constraint exige 2 letras)')
ok(!('renda_mensal' in hostil), 'texto no campo de dinheiro não vira número', hostil.renda_mensal)
ok(hostil.patrimonio_imoveis === 0, 'negativo vira zero, nunca patrimônio negativo', hostil.patrimonio_imoveis)
ok(hostil.patrimonio_veiculos === 1e12, 'valor absurdo para no teto de R$ 1 tri', hostil.patrimonio_veiculos)
ok(hostil.altura_cm === FAIXAS.altura_cm[1], 'altura é aparada na faixa do banco', hostil.altura_cm)
ok(hostil.peso_kg === FAIXAS.peso_kg[0], 'peso é aparado na faixa do banco', hostil.peso_kg)
ok(hostil.idade_aposentadoria === FAIXAS.idade_aposentadoria[0], 'idade-alvo entra na faixa', hostil.idade_aposentadoria)
ok(hostil.dividas_prazo_anos === 60, 'prazo de dívida entra na faixa', hostil.dividas_prazo_anos)
ok(!('pj_participacao_pct' in hostil), 'campo de PJ não entra num planejamento sem PJ')
ok(hostil.atividades_risco.length === 0, 'atividade de risco inventada é descartada')
ok(hostil.beneficiarios[0].parentesco === 'Outro', 'parentesco inventado vira "Outro"')
ok(hostil.beneficiarios[0].pct === 100, 'percentual acima de 100 é aparado', hostil.beneficiarios[0].pct)
ok(hostil.beneficiarios[0].nascimento === null, 'data que não é data vira nulo')
ok(hostil.dependentes[0].idade === FAIXAS.idade_filho[1], 'idade de filho entra na faixa')
ok(hostil.seguros_existentes[0].origem === 'individual', 'origem de seguro inventada cai no padrão')
ok(hostil.cobertura_atual === 0, 'capital negativo de seguro não vira cobertura', hostil.cobertura_atual)

// Nenhum número inválido pode sair daqui — é o que a tela e a proposta leem.
const numerosRuins = Object.entries(hostil)
  .filter(([, v]) => typeof v === 'number' && (!Number.isFinite(v) || v < 0))
ok(numerosRuins.length === 0, 'nenhum NaN, Infinity ou negativo escapa', JSON.stringify(numerosRuins))

console.log('\n── Nada quebra com entrada vazia ou sem sentido ──')
for (const entrada of [undefined, null, {}, { focos: 'nao-e-lista' }, { dependentes: 'x' },
  { beneficiarios: null }, { seguros_existentes: 42 }]) {
  let quebrou = null
  try { aplicarAoPlano(entrada); resumoRespostas(entrada); normalizarRespostas(entrada) } catch (e) { quebrou = e.message }
  ok(quebrou === null, `aplicar/resumir/normalizar ${JSON.stringify(entrada)} não estoura`, quebrou)
}

// ── 5. LISTA VAZIA É RESPOSTA ───────────────────────────────────────────────
console.log('\n── "Não tenho nenhum" é uma resposta, e é diferente de não responder ──')
const semNada = aplicarAoPlano({ dependentes: [], seguros_existentes: [], beneficiarios: [] })
ok(Array.isArray(semNada.dependentes) && semNada.dependentes.length === 0, 'lista vazia grava vazia')
ok(semNada.num_dependentes === 0, 'sem filhos, zero dependentes')
ok(semNada.cobertura_atual === 0, 'sem seguro, cobertura atual zero')
ok(!('dependentes' in aplicarAoPlano({})), 'quem não chegou na etapa não zera nada')

// ── 6. VALIDAÇÃO: nada segue com erro ───────────────────────────────────────
console.log('\n── A validação de cada etapa ──')
{
  const erros = validarEtapa(etapaPorId('objetivo'), {})
  ok(erros.some((e) => e.campo === 'tipo_planejamento'), 'tipo de planejamento é obrigatório')
  ok(erros.some((e) => e.campo === 'focos'), 'pelo menos um foco é obrigatório')
  ok(validarEtapa(etapaPorId('objetivo'), { tipo_planejamento: 'pf', focos: ['renda'] }).length === 0,
    'respondido, a etapa passa')
}
{
  const base = { profissao: 'Dentista', estado_civil: 'Solteiro(a)', uf: 'SC' }
  ok(validarEtapa(etapaPorId('familia'), base).length === 0, 'família mínima passa')
  ok(validarEtapa(etapaPorId('familia'), { ...base, uf: '' }).some((e) => e.campo === 'uf'),
    'sem estado não passa (o ITCMD depende dele)')
}
{
  const e = etapaPorId('financeira')
  ok(validarEtapa(e, {}).length === 2, 'renda e custo de vida são obrigatórios', validarEtapa(e, {}).length)
  ok(validarEtapa(e, { renda_mensal: 20000, custo_vida_mensal: 12000 }).length === 0, 'renda e custo bastam')
  ok(validarEtapa(e, { renda_mensal: 20000, custo_vida_mensal: 900000 })
    .some((x) => x.campo === 'custo_vida_mensal'), 'gasto absurdamente acima da renda é questionado')
  ok(validarEtapa(e, { renda_mensal: 20000, custo_vida_mensal: 12000, dividas_total: 5000, dividas_prazo_anos: 900 })
    .some((x) => x.campo === 'dividas_prazo_anos'), 'prazo fora da faixa é barrado antes do banco')
}
{
  const e = etapaPorId('beneficiarios')
  ok(validarEtapa(e, {}).length === 0, 'não indicar beneficiário nenhum é permitido')
  const meio = { beneficiarios: [{ nome: 'A', pct: 50 }, { nome: 'B', pct: 30 }] }
  ok(validarEtapa(e, meio).some((x) => x.campo === 'beneficiarios'), '80% não fecha e é barrado')
  const cem = { beneficiarios: [{ nome: 'A', pct: 50 }, { nome: 'B', pct: 50 }] }
  ok(validarEtapa(e, cem).length === 0, '50 + 50 passa')
  const tercos = { beneficiarios: [{ nome: 'A', pct: 33.34 }, { nome: 'B', pct: 33.33 }, { nome: 'C', pct: 33.33 }] }
  ok(validarEtapa(e, tercos).length === 0, 'divisão em três (33,34 + 33,33 + 33,33) passa')
  const semNome = { beneficiarios: [{ nome: '', pct: 100 }] }
  ok(validarEtapa(e, semNome).some((x) => x.campo === 'beneficiarios.0.nome'), 'beneficiário sem nome é barrado')
}
{
  const e = etapaPorId('perfil')
  ok(validarEtapa(e, { altura_cm: '5000' }).some((x) => x.campo === 'altura_cm'), 'altura impossível é barrada')
  ok(validarEtapa(e, { peso_kg: '78' }).length === 0, 'peso normal passa')
  ok(validarEtapa(e, {}).length === 0, 'a etapa de perfil inteira é opcional')
}
{
  const e = etapaPorId('filhos')
  ok(validarEtapa(e, { dependentes: [{ nome: 'Alice', idade: 7 }] }).length === 0, 'filho completo passa')
  ok(validarEtapa(e, { dependentes: [{ nome: 'Alice' }] }).some((x) => x.campo === 'dependentes.0.idade'),
    'filho sem idade é barrado (o cálculo até os 24 depende dela)')
  ok(validarEtapa(e, { dependentes: [{ nome: '', idade: '', custo_mensal: '' }] }).length === 0,
    'linha em branco não vira erro — ela simplesmente não conta')
}

// ── 7. ETAPAS QUE APARECEM E SOMEM ──────────────────────────────────────────
console.log('\n── O formulário encolhe para quem não tem empresa ──')
{
  const pf = etapasVisiveis({ tipo_planejamento: 'pf' }).map((e) => e.id)
  const pj = etapasVisiveis({ tipo_planejamento: 'pf_pj' }).map((e) => e.id)
  ok(!pf.includes('empresa'), 'pessoa física não vê as perguntas de empresa')
  ok(pj.includes('empresa'), 'planejamento com PJ vê as perguntas de empresa')
  ok(pj.length === pf.length + 1, 'a diferença é exatamente um bloco', `${pf.length} vs ${pj.length}`)
  const semBens = etapasVisiveis({}).map((e) => e.id)
  ok(!semBens.includes('sucessao'), 'sem patrimônio, não perguntamos sobre inventário')
  ok(etapasVisiveis({ patrimonio_imoveis: 500000 }).map((e) => e.id).includes('sucessao'),
    'com patrimônio, a sucessão aparece')
}
{
  const campos = camposVisiveis(etapaPorId('familia'), { estado_civil: 'Solteiro(a)' }).map((c) => c.id)
  ok(!campos.includes('conjuge_nome'), 'solteiro não vê campo de cônjuge')
  ok(camposVisiveis(etapaPorId('familia'), { estado_civil: 'Casado(a)' }).map((c) => c.id).includes('regime_bens'),
    'casado vê o regime de bens')
}
{
  // toda etapa e todo campo precisam de rótulo — um formulário público não
  // pode mostrar "dps_xyz" para o cliente
  const semRotulo = ETAPAS_PLANO.flatMap((e) => e.campos)
    .filter((c) => !c.rotulo || !c.tipo)
  ok(semRotulo.length === 0, 'todo campo tem rótulo e tipo', semRotulo.map((c) => c.id).join(','))
  const ids = ETAPAS_PLANO.flatMap((e) => e.campos.map((c) => c.id))
  ok(new Set(ids).size === ids.length, 'nenhum campo aparece em duas etapas')
}

// ── 8. A REVISÃO FINAL ──────────────────────────────────────────────────────
console.log('\n── A tela de revisão: sem lixo, sem vazio ──')
{
  const blocos = resumoRespostas(completo)
  const texto = JSON.stringify(blocos)
  ok(!/NaN|Infinity|undefined|null/.test(texto), 'nenhum NaN/undefined/null chega à revisão do cliente')
  ok(blocos.every((b) => b.linhas.length > 0), 'bloco sem resposta não aparece')
  ok(blocos.some((b) => b.etapa === 'empresa'), 'com PJ, a empresa aparece na revisão')
  ok(!resumoRespostas({ tipo_planejamento: 'pf', renda_mensal: 100 }).some((b) => b.etapa === 'empresa'),
    'sem PJ, a empresa não aparece na revisão')
  ok(resumoRespostas({}).length === 0, 'formulário em branco não gera revisão nenhuma')
}

// ── 9. O QUE VAI PARA O BANCO NO ENVIO ──────────────────────────────────────
console.log('\n── Normalização do jsonb enviado ──')
{
  const n = normalizarRespostas(completo)
  ok(n.renda_mensal === 32000, 'moeda vira número no jsonb', n.renda_mensal)
  ok(n.dependentes.length === 2, 'linha em branco não é enviada')
  ok(n.altura_cm === 168, 'inteiro vira número', n.altura_cm)
  ok(!('vazio' in normalizarRespostas({ vazio: '' })), 'campo vazio não é enviado')
  ok(JSON.stringify(aplicarAoPlano(n)) === JSON.stringify(aplicarAoPlano(completo)),
    'normalizar não muda o que chega ao planejamento')
}

// ── 10. O ELO FINAL: as respostas viram estudo ──────────────────────────────
console.log('\n── O estudo montado a partir do que o cliente respondeu ──')
{
  const plano = aplicarAoPlano(completo)
  const estudo = calcularEstudo(plano, { idade: 41 })
  const texto = JSON.stringify(estudo)
  ok(!/null,"NaN"|NaN|Infinity/.test(texto), 'o estudo sai sem NaN nem Infinity')
  ok(estudo.renda === 32000, 'a renda respondida chega ao motor', estudo.renda)
  ok(estudo.detalhado === true, 'o patrimônio por classe liga o raio-X do inventário')
  ok(estudo.temPJ === true, 'o estudo entende que há empresa')
  ok(estudo.custoInventario > 0, 'com patrimônio, o custo do inventário é calculado', estudo.custoInventario)
  ok(estudo.completude.feitos > 0, 'a prontidão da proposta anda sozinha', 
    `${estudo.completude.feitos}/${estudo.completude.total}`)
  ok(estudo.sugestoes.morte > 0, 'o motor já sugere o capital de morte', estudo.sugestoes.morte)

  // o cliente que respondeu o mínimo não pode derrubar o estudo
  const magro = calcularEstudo(aplicarAoPlano({ renda_mensal: 8000, custo_vida_mensal: 6000 }), { idade: 30 })
  ok(!/NaN|Infinity/.test(JSON.stringify(magro)), 'estudo do preenchimento mínimo também sai limpo')
}

// ── 11. PARIDADE ENTRE O JAVASCRIPT E O SQL ─────────────────────────────────
// As duas implementações da mesma regra vivem em arquivos diferentes. Nada as
// mantém juntas além desta checagem.
console.log('\n── As colunas do JavaScript e as da migração 029 ──')
{
  const sql = readFileSync('supabase/migrations/029_planejamento_por_link.sql', 'utf8')
  const bloco = sql.slice(sql.indexOf('on conflict (id_cliente) do update set'))
  const noSql = [...bloco.matchAll(/^\s{4}([a-z_]+)\s*=\s*coalesce\(/gm)].map((m) => m[1])

  ok(noSql.length > 0, 'a função SQL de aplicação foi encontrada', noSql.length)
  const soNoJs = COLUNAS_DO_CLIENTE.filter((c) => !noSql.includes(c))
  const soNoSql = noSql.filter((c) => !COLUNAS_DO_CLIENTE.includes(c))
  ok(soNoJs.length === 0, 'toda coluna do JavaScript é gravada pela migração', soNoJs.join(', '))
  ok(soNoSql.length === 0, 'toda coluna da migração está declarada no JavaScript', soNoSql.join(', '))

  // e a lista declarada tem que bater com o que aplicarAoPlano realmente grava
  const gravadas = new Set()
  for (const entrada of [completo, hostil, semNada, { dividas_total: 0 },
    { estado_civil: 'Casado(a)', conjuge_nome: 'X', regime_bens: 'Comunhão universal' }]) {
    Object.keys(aplicarAoPlano(entrada)).forEach((k) => gravadas.add(k))
  }
  const naoDeclaradas = [...gravadas].filter((c) => !COLUNAS_DO_CLIENTE.includes(c))
  ok(naoDeclaradas.length === 0, 'nada é gravado fora da lista declarada', naoDeclaradas.join(', '))

  // as opções fechadas da tela precisam existir também na migração
  for (const valor of ['Comunhão parcial', 'Participação final nos aquestos', 'Herdeiros legais',
    'caca_submarina', 'aposentadoria', 'consignado', 'Deixar um legado']) {
    ok(sql.includes(valor), `a migração conhece a opção "${valor}"`)
  }
}

// ── 12. LIMPEZA DAS LISTAS ──────────────────────────────────────────────────
console.log('\n── Limpeza das listas ──')
ok(limparFilhos([{ nome: '  ', idade: '', custo_mensal: '' }]).length === 0, 'filho totalmente vazio some')
ok(limparFilhos([{ nome: '', idade: '', custo_mensal: '300' }]).length === 1, 'filho com só o custo fica')
ok(limparSeguros([{ descricao: '', capital: 0 }]).length === 0, 'seguro vazio some')
ok(limparBeneficiarios([{ nome: '', pct: 0 }]).length === 0, 'beneficiário vazio some')
ok(limparBeneficiarios([{ nome: 'A', pct: 100 }])[0].parentesco === 'Outro',
  'beneficiário sem parentesco cai em "Outro"')

console.log(falhas.length === 0
  ? '\n✅ Planejamento por link: tudo certo.\n'
  : `\n❌ ${falhas.length} falha(s):\n${falhas.map((f) => `  · ${f}`).join('\n')}\n`)
process.exit(falhas.length === 0 ? 1 - 1 : 1)
