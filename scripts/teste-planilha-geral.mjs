// ─────────────────────────────────────────────────────────────────────────────
// TESTE DO LEITOR DA PLANILHA GERAL — a porta de entrada dos números.
//
// Tudo o que o Hub sabe sobre a carteira entra por aqui. Se este leitor
// interpreta uma coluna errada, o erro não fica nele: vira prêmio de campanha
// para a pessoa errada, comissão conferida contra um número inventado e
// carteira com o dobro do tamanho que tem.
//
// Os casos deste arquivo não são hipóteses — são os defeitos REAIS encontrados
// na planilha de julho/2026, reproduzidos em miniatura:
//
//   · a coluna PRÊMIO MES com o valor ANUAL colado dentro (12× errado);
//   · a fórmula da mensal apontando para a linha de OUTRO cliente;
//   · células #REF! sobrando de uma reordenação;
//   · o código de um assessor aparecendo na apólice de outro;
//   · a mesma pessoa ora com código, ora sem;
//   · "não é cliente" digitado no campo de código.
//
// A pergunta que o arquivo responde: depois de tudo isso, o número que sai do
// leitor ainda é o número que está no contrato?
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx'
import { lerPlanilhaGeral, conferir, TOLERANCIA_PREMIO } from '../src/lib/planilhaGeral.js'
import { parseCSV, acharColuna } from '../src/lib/csv.js'
import { limparCodigo } from '../src/lib/planilhasComissao.js'
import { apurarPremiacao } from '../src/lib/premiacao.js'

let falhas = 0
let feitos = 0
const ok = (cond, nome, detalhe = '') => {
  feitos += 1
  if (cond) { console.log(`✓ ${nome}`); return true }
  falhas += 1
  console.log(`✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  return false
}

const CABECALHO = ['NOME / RAZÃO SOCIAL', 'CÓD. CLIENTE', 'ESPECIALISTA', 'COMISSÃO', 'ASSESSOR',
  'COD. AI', 'APÓLICE', 'SEGURADORA', 'PRÊMIO ANUAL', '', 'PRÊMIO MES', 'DATA', 'TIPO', '',
  'STATUS', 'MOTIVO CANCELAMENTO']

// Monta uma planilha igual à do escritório e a devolve como ArrayBuffer
async function planilha(linhas) {
  const ws = XLSX.utils.aoa_to_sheet([CABECALHO, ...linhas])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Propostas fechadas')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return lerPlanilhaGeral(buf)
}

// cliente, cod, assessor, codAI, seguradora, anual, mes, data, status
const linha = (cliente, assessor, codAI, anual, mes, data = '01/03/2026', status = 'ATIVO') =>
  [cliente, '', 'Nati', 0.4, assessor, codAI, '', 'MAG', anual, '', mes, data, 'SEGURO TEMPORÁRIO', '', status, '']

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Qual coluna de prêmio manda ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = await planilha([
    // 1. coerente: 1.200 no ano, 100 no mês
    linha('Coerente', 'Ana', 'A100', 1200, 100),
    // 2. o valor ANUAL colado dentro da coluna mensal — o defeito que multiplica por 12
    linha('Anual colado na mensal', 'Ana', 'A100', 1200, 1200),
    // 3. a fórmula apontando para a linha de outro cliente
    linha('Fórmula de outra linha', 'Ana', 'A100', 1200, 350.75),
    // 4. #REF! sobrando
    linha('Celula com #REF!', 'Ana', 'A100', 1200, '#REF!'),
    // 5. sem anual: só a mensal existe, e aí ela vale
    linha('Só mensal', 'Ana', 'A100', '', 100),
    // 6. arredondamento do ÷12 (2.671,20 ÷ 12 = 222,60 e a planilha diz 222,26)
    linha('Arredondamento', 'Ana', 'A100', 2671.20, 222.26),
  ])
  const por = (nome) => r.registros.find((x) => x.cliente === nome)

  ok(por('Coerente').premioAnual === 1200 && por('Coerente').premioMensal === 100,
    'linha coerente entra como está (R$ 1.200/ano, R$ 100/mês)')
  ok(por('Coerente').premioIncoerente === false, 'e não é acusada de nada')

  const colado = por('Anual colado na mensal')
  ok(colado.premioAnual === 1200 && colado.premioMensal === 100,
    `anual colado na coluna mensal NÃO multiplica por 12 (R$ ${colado.premioAnual}/ano)`,
    'era o defeito que somava R$ 2,36 mi onde havia R$ 436 mil')
  ok(colado.premioIncoerente === true, 'e a divergência é reportada para conferência')

  const formula = por('Fórmula de outra linha')
  ok(formula.premioAnual === 1200 && formula.premioMensal === 100,
    'fórmula apontando para outra linha não contamina o valor (o anual manda)')
  ok(formula.premioIncoerente === true, 'e também aparece na conferência')

  const ref = por('Celula com #REF!')
  ok(ref != null && ref.premioAnual === 1200 && ref.premioMensal === 100,
    '#REF! na mensal não derruba a linha — o anual resolve')
  ok(ref.premioIncoerente === false, 'e #REF! não vira divergência (não há dois números para comparar)')

  const soMensal = por('Só mensal')
  ok(soMensal.premioAnual === 1200 && soMensal.premioMensal === 100,
    'sem PRÊMIO ANUAL, a mensal vira a fonte e é anualizada (×12)')

  const arred = por('Arredondamento')
  ok(arred.premioAnual === 2671.20, 'arredondamento do ÷12 não muda o valor do contrato')
  ok(arred.premioIncoerente === false,
    `diferença de arredondamento (${((Math.abs(2671.2 - 222.26 * 12) / 2671.2) * 100).toFixed(2)}%) não vira alarme`,
    `tolerância é ${TOLERANCIA_PREMIO * 100}%`)

  ok(r.conferencia.premioIncoerente.length === 2,
    `a conferência conta exatamente as 2 linhas divergentes (${r.conferencia.premioIncoerente.length})`)
  ok(r.conferencia.premioIncoerente.every((x) => x.premioAnualPlanilha != null && x.premioMesPlanilha != null),
    'e cada uma carrega os DOIS valores da planilha, para a consultora decidir olhando')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O código de um na apólice de outro ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const r = await planilha([
    linha('C1', 'Ikaro', 'A35623', 1200, 100),
    linha('C2', 'ikaro', 'A35623', 1200, 100),        // só grafia
    linha('C3', 'Carine', 'A35623', 8227.44, 685.62), // ← apólice da Carine com o código do Ikaro
    linha('C4', 'Romário', 'A54805', 1200, 100),
    linha('C5', 'Romário Almeida', 'A54805', 1200, 100), // primeiro nome × nome completo
    linha('C6', 'Carine', 'A99858', 1200, 100),
    linha('C7', 'Patric', '', 1200, 100),             // a mesma pessoa, uma vez sem código
    linha('C8', 'Patric', 'A21990', 1200, 100),
    linha('C9', 'Natália', 'não é cliente', 1200, 100),
    linha('C10', '', '', 1200, 100),                  // sem assessor nenhum
  ])
  const c = r.conferencia

  const compartilhado = c.codigoCompartilhado.find((x) => x.codigo === 'A35623')
  ok(compartilhado != null, 'código usado por duas PESSOAS diferentes é acusado (A35623)')
  ok(compartilhado?.nomes.length === 2, `e diz quais são as duas (${compartilhado?.nomes.join(' | ')})`)

  ok(!c.codigoCompartilhado.some((x) => x.codigo === 'A54805'),
    '"Romário" e "Romário Almeida" NÃO são acusados — é a mesma pessoa')
  ok(!c.codigoCompartilhado.some((x) => x.nomes.some((n) => n === 'ikaro')),
    '"Ikaro" e "ikaro" também não — diferença de grafia não é conflito')

  const varios = c.nomeComVariosCodigos.find((x) => x.nome === 'CARINE')
  ok(varios != null && varios.codigos.length === 2,
    `a mesma pessoa com dois códigos é acusada (Carine → ${varios?.codigos.join(' | ')})`)
  const semCod = c.nomeComVariosCodigos.find((x) => x.nome === 'PATRIC')
  ok(semCod != null && semCod.codigos.includes('(sem código)'),
    'linha sem código da mesma pessoa também conta — é o que divide a produção dela em duas')

  ok(c.codigoSuspeito.length === 1 && c.codigoSuspeito[0].codigo === 'não é cliente',
    'anotação humana no campo de código é acusada como código inválido')
  ok(c.semAssessor.length === 1 && c.semAssessor[0].cliente === 'C10',
    'apólice sem assessor nenhum volta separada')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A prova que interessa: o ranking sai igual ao contrato ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  // Ana: 3 apólices de R$ 1.200/ano = R$ 3.600 — uma delas com o anual colado
  //      na coluna mensal, o defeito real.
  // Beto: 1 apólice de R$ 10.000/ano — mais prêmio, menos apólices.
  const r = await planilha([
    linha('A1', 'Ana', 'A100', 1200, 100),
    linha('A2', 'Ana', 'A100', 1200, 1200, '02/04/2026'),
    linha('A3', 'Ana', 'A100', 1200, '#REF!', '03/05/2026'),
    linha('B1', 'Beto', 'B200', 10000, 833.33, '04/06/2026'),
    linha('X1', 'Ana', 'A100', 5000, 416.67, '01/12/2026'), // fora da janela (dezembro)
    linha('X2', 'Beto', 'B200', 5000, 416.67, '01/07/2026', 'CANCELADO'),
  ])

  // monta o mesmo modelo que o importador grava no banco
  const assessores = [], clientes = [], apolices = []
  const idPorCod = new Map()
  r.registros.forEach((reg, i) => {
    const cod = reg.codAssessor ?? reg.assessor ?? '(sem assessor)'
    if (!idPorCod.has(cod)) {
      idPorCod.set(cod, `ass${idPorCod.size}`)
      assessores.push({ id: `ass${idPorCod.size - 1}`, nome: reg.assessor, codigo: reg.codAssessor, ativo: true })
    }
    clientes.push({ id: `cli${i}`, nome: reg.cliente, id_assessor: idPorCod.get(cod) })
    apolices.push({
      id: `ap${i}`, id_cliente: `cli${i}`, id_seguradora: 'seg1',
      valor_premio_mensal: reg.premioMensal, data_vigencia: reg.vigencia, status: reg.status,
    })
  })
  const ap = apurarPremiacao({ apolices, clientes, assessores, seguradoras: [{ id: 'seg1', nome: 'MAG' }] },
    { ano: 2026, hoje: '2026-08-14' })

  const ana = ap.linhas.find((l) => l.nome === 'Ana')
  const beto = ap.linhas.find((l) => l.nome === 'Beto')
  ok(ana.apolices === 3, `Ana com 3 apólices na janela (${ana.apolices}) — dezembro fica de fora`)
  ok(Math.abs(ana.premioAnual - 3600) < 0.5,
    `o prêmio da Ana é o do contrato: R$ 3.600 (${ana.premioAnual.toFixed(2)})`,
    'com o defeito antigo daria R$ 16.800')
  ok(beto.apolices === 1 && Math.abs(beto.premioAnual - 10000) < 0.5,
    `Beto com 1 apólice e R$ 10.000 (${beto.premioAnual.toFixed(2)}) — a cancelada não conta`)

  ok(ap.liderQuantidade.nome === 'Ana', `maior emissor é a Ana (${ap.liderQuantidade.nome})`)
  ok(ap.liderPremio.nome === 'Beto', `maior prêmio é o Beto (${ap.liderPremio.nome})`)
  ok(Math.abs(ap.totais.premioAnual - 13600) < 0.5,
    `o total do escritório fecha com a soma dos contratos: R$ 13.600 (${ap.totais.premioAnual.toFixed(2)})`)
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── conferir() sozinha, sem planilha ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const vazio = conferir([])
  ok(vazio.premioIncoerente.length === 0 && vazio.codigoCompartilhado.length === 0,
    'lista vazia não inventa problema nenhum')
  ok(conferir().semAssessor.length === 0, 'e chamar sem argumento nenhum também não quebra')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A porta de entrada aguenta o que chega errado ──')
// ─────────────────────────────────────────────────────────────────────────────
// `parseCSV` e `acharColuna` recebem o que vier de três caminhos diferentes:
// `FileReader`, colagem no textarea e leitura de .xlsx. Os três devolvem
// string quase sempre — e `null` quando a leitura falha. Aí a tela de Importar
// quebrava com "Cannot read properties of null" em vez de dizer que o arquivo
// não deu para ler. Para quem está importando, planilha vazia e planilha
// ilegível são a mesma resposta: não veio nada.
{
  let semQuebrar = true
  for (const lixo of [null, undefined, 0, -1, NaN, true, false, {}, [], 1e20]) {
    try {
      const r = parseCSV(lixo)
      if (!Array.isArray(r?.cabecalho) || !Array.isArray(r?.linhas)) {
        semQuebrar = false
        console.log(`   ✗ parseCSV(${JSON.stringify(lixo)}) devolveu ${JSON.stringify(r)}`)
      }
    } catch (e) {
      semQuebrar = false
      console.log(`   ✗ parseCSV(${JSON.stringify(lixo)}) explodiu: ${e.message}`)
    }
  }
  ok(semQuebrar, 'parseCSV devolve planilha vazia em vez de explodir com o que não é texto')

  let colunaOk = true
  for (const lixo of [null, undefined, '', 'abc', 0, {}, 1e20]) {
    try {
      if (acharColuna(lixo, ['nome']) !== -1) colunaOk = false
      if (acharColuna(['Nome'], lixo) !== -1) colunaOk = false
    } catch (e) {
      colunaOk = false
      console.log(`   ✗ acharColuna(${JSON.stringify(lixo)}) explodiu: ${e.message}`)
    }
  }
  ok(colunaOk, 'acharColuna responde "não achei" (-1) em vez de explodir')

  // e o caminho normal continua funcionando
  const { cabecalho, linhas } = parseCSV('Nome;Prêmio\nMaria;R$ 500,00\nJoão;R$ 300,00')
  ok(cabecalho.length === 2 && linhas.length === 2, 'o CSV de verdade continua sendo lido')
  ok(acharColuna(cabecalho, ['premio']) === 1, 'e a coluna continua sendo achada pelo apelido')
}

{
  // `??` só apara null e undefined: um NaN atravessava e virava o código
  // literal "NaN". No agrupamento por assessor, isso junta linhas de gente
  // diferente sob um código que não existe — e o troféu vai para ninguém.
  ok(limparCodigo(NaN) === '', 'código NaN vira vazio, não o texto "NaN"')
  ok(limparCodigo(Infinity) === '', 'e infinito também')
  ok(limparCodigo(null) === '' && limparCodigo(undefined) === '', 'nulo continua virando vazio')
  ok(limparCodigo({}) === '' && limparCodigo([]) === '', 'objeto não vira "[object Object]"')
  ok(limparCodigo(' CS8868 ') === 'CS8868', 'e o código de verdade continua saindo limpo')
  ok(limparCodigo('12345.0') === '12345', 'o ".0" que o Excel gruda continua sendo tirado')
}

console.log('\n── RESULTADO (leitor da planilha geral) ──')
console.log(`${feitos} verificações · ${falhas ? `${falhas} FALHA(S)` : 'nenhuma falha 🎉'}`)
process.exit(falhas ? 1 : 0)
