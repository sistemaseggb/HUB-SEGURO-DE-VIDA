// ─────────────────────────────────────────────────────────────────────────────
// O QUE O CLIENTE PODE VER — a fronteira de privacidade da proposta pública.
//
// A proposta pública (`/p/<token>`) abre SEM LOGIN. Tudo o que a RPC devolve
// chega ao navegador do cliente e é lido por qualquer um que abra o inspetor —
// mesmo o que a tela nunca desenha.
//
// A RPC devolvia o planejamento inteiro. Junto iam quatro campos que são a
// consultora falando consigo mesma: as notas da reunião, o roteiro com as
// observações de cada bloco, a leitura dela sobre quem decide, e o prazo de
// decisão — que é a urgência do cliente escrita nas palavras dela, ou seja,
// uma posição de negociação entregue para o outro lado da mesa.
//
// ── O que este teste faz de diferente ───────────────────────────────────────
//
// Ele FIXA o conjunto exato de chaves que a proposta pública entrega. Não
// verifica só os quatro campos conhecidos: qualquer coluna nova no
// planejamento quebra este teste, e alguém precisa decidir conscientemente de
// que lado ela fica.
//
// É esse travamento — e não a forma da lista no SQL — que impede o próximo
// vazamento. Um teste que só conferisse os quatro campos de hoje deixaria
// passar o quinto.
//
// Roda com `node scripts/teste-proposta-publica.mjs` (e junto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import { criarSupabaseDemo } from '../src/lib/demoDb.js'

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond || extra === undefined ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}

// ── O QUE A CONSULTORA ANOTOU PARA SI ───────────────────────────────────────
// Nenhum destes pode atravessar. Se um campo novo desta natureza for criado,
// ele entra aqui E na lista de exclusão da migração.
const PRIVADOS = [
  'observacoes_reuniao', // as notas dela sobre a reunião
  'roteiro',             // o roteiro, com a nota de cada bloco
  'quem_decide',         // a leitura dela sobre quem manda na decisão
  'prazo_decisao',       // a urgência dele, nas palavras dela
]

// Identificadores internos: não são segredo, mas não têm por que sair.
const INTERNOS = ['id', 'id_cliente', 'token_proposta', 'created_at', 'updated_at']

// ── O CONTRATO ──────────────────────────────────────────────────────────────
// Este é o conjunto EXATO de campos que a proposta pública entrega hoje.
// Mexeu no planejamento? Este teste falha, e é para falhar: a pergunta "esse
// campo pode ser lido pelo cliente?" precisa ser respondida por uma pessoa.
const PUBLICOS_ESPERADOS = [
  'aliquota_ir_cliente', 'anos_protecao', 'anotacoes_proposta', 'capital_aval',
  'capital_doencas_graves', 'capital_fraturas', 'capital_homem_chave',
  'capital_invalidez', 'capital_morte_acidental', 'capital_socios',
  'capital_sugerido', 'cobertura_atual', 'comparador_alternativa',
  'comparador_taxa_real', 'conjuge_nome', 'custas_pct', 'custo_vida_mensal',
  'dependentes', 'dih_diaria', 'dih_dias', 'dit_diaria', 'dit_dias',
  'dit_franquia_dias', 'dividas_total', 'estado_civil', 'filhos_idades', 'focos',
  'forma_pagamento', 'fumante', 'funeral_familiar', 'funeral_individual',
  'herdeiros_menores', 'idade_aposentadoria', 'itcmd_pct', 'num_dependentes',
  'objetivos', 'patrimonio_empresa', 'patrimonio_imoveis',
  'patrimonio_investimentos', 'patrimonio_outros', 'patrimonio_total',
  'patrimonio_veiculos', 'pj_divida_avalizada', 'pj_faturamento_anual',
  'pj_lucro_anual', 'pj_num_socios', 'pj_participacao_pct', 'pj_razao_social',
  'pj_valuation', 'premio_anual', 'premio_estimado', 'premio_temporario_mensal',
  'previdencia_aporte_mensal', 'previdencia_saldo', 'previdencia_tipo',
  'profissao', 'regime_bens', 'renda_desejada_aposentadoria', 'renda_mensal',
  'seguro_resgatavel', 'seguros_existentes', 'tem_holding', 'tem_testamento',
  'tipo_planejamento', 'verba_sucessoria',
].sort()

const db = criarSupabaseDemo()
const { data, error } = await db.rpc('fn_proposta_carregar', { p_token: 'demo-proposta-carlos' })

console.log('\n── A proposta pública carrega ──')
ok(!error && data && !data.erro, 'a RPC responde para um token válido', error?.message ?? data?.erro)
ok(typeof data.cliente_nome === 'string' && data.cliente_nome.length > 0,
  'o cliente vê o próprio nome', data.cliente_nome)
ok(typeof data.plano === 'object' && data.plano !== null, 'e o plano vem como objeto')

console.log('\n── NADA do que ela anotou para si atravessa ──')
{
  const chaves = Object.keys(data.plano)
  for (const k of PRIVADOS) {
    ok(!chaves.includes(k), `"${k}" NÃO chega ao navegador do cliente`,
      String(JSON.stringify(data.plano[k])).slice(0, 70))
  }
  for (const k of INTERNOS) {
    ok(!chaves.includes(k), `identificador interno "${k}" fica de fora`)
  }
  // e o texto das notas não pode aparecer escondido em nenhum outro campo
  const inteiro = JSON.stringify(data).toLowerCase()
  for (const trecho of ['muito receptivo', 'fim do mês', 'esposa não trabalha']) {
    ok(!inteiro.includes(trecho),
      `nem o TEXTO "${trecho}" aparece em lugar nenhum do retorno`)
  }
}

console.log('\n── O contrato do que é público ──')
{
  const chaves = Object.keys(data.plano).sort()
  const sobrando = chaves.filter((k) => !PUBLICOS_ESPERADOS.includes(k))
  const faltando = PUBLICOS_ESPERADOS.filter((k) => !chaves.includes(k))

  ok(sobrando.length === 0,
    'NENHUM campo novo escapou para a proposta pública sem decisão consciente',
    sobrando.join(', '))
  ok(faltando.length === 0,
    'e nenhum campo que a proposta precisa sumiu do retorno',
    faltando.join(', '))
  if (sobrando.length > 0) {
    console.log('\n  ⚠ Campo(s) novo(s) no planejamento. Decida de que lado ficam:')
    console.log('    · guarda o que a CONSULTORA pensa → exclua na migração e some a PRIVADOS aqui')
    console.log('    · guarda o que o CLIENTE tem ou quer → some a PUBLICOS_ESPERADOS aqui')
  }
  ok(chaves.length === PUBLICOS_ESPERADOS.length,
    `${PUBLICOS_ESPERADOS.length} campos públicos, nem um a mais`, chaves.length)
}

console.log('\n── Token inválido não vira porta ──')
{
  const r = await db.rpc('fn_proposta_carregar', { p_token: 'token-que-nao-existe' })
  ok(r.data?.erro === 'proposta_nao_encontrada',
    'token inexistente devolve "não encontrada", não os dados de outro cliente',
    JSON.stringify(r.data).slice(0, 80))
  ok(!r.data?.plano, 'e não vem plano nenhum junto')

  for (const torto of [null, '', '../../etc/passwd', "' or 1=1 --", '00000000-0000-0000-0000-000000000000']) {
    const x = await db.rpc('fn_proposta_carregar', { p_token: torto })
    ok(!x.data?.plano, `token ${JSON.stringify(torto)} não devolve plano`)
  }
}

console.log('\n── RESULTADO (proposta pública) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
