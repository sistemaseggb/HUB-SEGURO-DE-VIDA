// ─────────────────────────────────────────────────────────────────────────────
// A ANÁLISE DA TRANSCRIÇÃO CONTRA REUNIÕES DE VERDADE.
//
// O fuzz do motor prova que a análise não explode com texto qualquer. Isso não
// é a mesma coisa que provar que ela extrai CERTO — um parser que devolve
// sempre uma lista vazia passa em qualquer teste de robustez.
//
// Aqui cada caso é um pedaço de reunião escrito do jeito que as pessoas falam,
// com o resultado ESPERADO declarado ao lado. Quando o parser regride, o teste
// diz exatamente qual frase parou de ser entendida.
//
// Roda com `node scripts/teste-transcricao.mjs` (e junto do resto em `npm test`).
// ─────────────────────────────────────────────────────────────────────────────
import {
  analisarTranscricao, normalizarNumeraisFalados, resumoParaCliente, perguntasQueFaltaram,
} from '../src/lib/transcricao.js'

const falhas = []
const ok = (cond, msg, extra) => {
  console.log(cond ? '✓' : '✗', msg + (cond ? '' : ` → ${extra}`))
  if (!cond) falhas.push(msg)
}

const analisar = (linhas) => analisarTranscricao(
  Array.isArray(linhas) ? linhas.join('\n') : linhas,
  { nomeCliente: 'Carlos Eduardo Menezes', nomeConsultora: 'Natália Maschendorf' },
)
const valorDe = (a, campo) => a?.valores.find((v) => v.campo === campo)?.valor ?? null

// ── 1. NÚMEROS FALADOS ──────────────────────────────────────────────────────
console.log('\n── Números como as pessoas falam ──')
for (const [texto, esperado] of [
  ['quinhentos reais', '500 reais'],
  ['dois mil reais', '2 mil reais'],
  ['vinte e cinco mil', '25 mil'],
  ['cento e vinte mil', '120 mil'],
  ['um milhão e meio', '1,5 milhão'],
  ['dois milhões e meio', '2,5 milhões'],
  ['três filhos', '3 filhos'],
  ['R$ 1.234.567,89', 'R$ 1.234.567,89'],   // dígito não pode ser tocado
  ['quarenta e oito mil por mês', '48 mil por mês'],
]) {
  const saiu = normalizarNumeraisFalados(texto)
  ok(saiu === esperado, `"${texto}" vira "${esperado}"`, `saiu "${saiu}"`)
}

// ── 2. EXTRAÇÃO DE VALORES ──────────────────────────────────────────────────
console.log('\n── Os números que o cliente disse em voz alta ──')
{
  const a = analisar([
    '00:00:10 Natália: Qual a sua renda hoje?',
    '00:00:14 Carlos: Ganho uns quarenta e oito mil por mês.',
    '00:00:25 Natália: E quanto a família gasta?',
    '00:00:29 Carlos: O custo de vida fica em vinte e sete mil.',
    '00:00:40 Carlos: Tenho R$ 2,3 milhões em imóveis e 700 mil investidos.',
    '00:00:55 Carlos: Devo 200 mil de financiamento.',
    '00:01:10 Carlos: Na previdência tenho 450 mil, é PGBL.',
    '00:01:30 Carlos: A clínica fatura 4,2 milhões por ano.',
  ])
  ok(valorDe(a, 'renda_mensal') === 48000, 'renda por extenso: 48.000', valorDe(a, 'renda_mensal'))
  ok(valorDe(a, 'custo_vida_mensal') === 27000, 'custo de vida por extenso: 27.000', valorDe(a, 'custo_vida_mensal'))
  ok(valorDe(a, 'patrimonio_imoveis') === 2_300_000, 'imóveis: 2,3 milhões', valorDe(a, 'patrimonio_imoveis'))
  ok(valorDe(a, 'patrimonio_investimentos') === 700_000, 'investimentos: 700 mil', valorDe(a, 'patrimonio_investimentos'))
  ok(valorDe(a, 'dividas_total') === 200_000, 'dívidas: 200 mil', valorDe(a, 'dividas_total'))
  ok(valorDe(a, 'previdencia_saldo') === 450_000, 'previdência: 450 mil', valorDe(a, 'previdencia_saldo'))
  ok(valorDe(a, 'pj_faturamento_anual') === 4_200_000, 'faturamento: 4,2 milhões', valorDe(a, 'pj_faturamento_anual'))
}

console.log('\n── O que NÃO pode virar dinheiro ──')
{
  const a = analisar([
    'Carlos: Tenho 41 anos e trabalho há 15 anos na clínica.',
    'Carlos: A reunião é às 14 horas do dia 20.',
    'Carlos: Somos 3 sócios.',
  ])
  ok(a.valores.length === 0, 'idade, horário e nº de sócios não viram valores', a.valores.map((v) => v.rotulo).join(', '))
}

// ── 3. FAMÍLIA ──────────────────────────────────────────────────────────────
console.log('\n── Os filhos, do jeito que se fala ──')
for (const [linha, esperado] of [
  ['Carlos: Tenho dois filhos, a Alice tem 6 e o Lucas 9.', 'Alice:6, Lucas:9'],
  ['Carlos: Meus filhos são a Alice de 6 anos e o Lucas de 9 anos.', 'Alice:6, Lucas:9'],
  ['Carlos: Tenho três filhos: Ana 4, Bruno 8 e Carla 12.', 'Ana:4, Bruno:8, Carla:12'],
  ['Carlos: Meu filho Pedro tem 15.', 'Pedro:15'],
]) {
  const a = analisar([linha])
  const saiu = (a?.familia.filhos ?? []).map((f) => `${f.nome || '?'}:${f.idade}`).join(', ')
  ok(saiu === esperado, `${esperado} ← "${linha.slice(8, 62)}"`, `saiu "${saiu}"`)
}
{
  const a = analisar(['Carlos: A Natália tem 40 anos de experiência no mercado.'])
  ok((a?.familia.filhos ?? []).length === 0, 'sócia com 40 anos de experiência não vira filha',
    JSON.stringify(a?.familia.filhos))
}
{
  const a = analisar(['Carlos: Sou casado, minha esposa Mariana não trabalha fora. Sou médico cardiologista.'])
  ok(a.familia.estadoCivil === 'Casado(a)', 'estado civil', a.familia.estadoCivil)
  ok(a.familia.conjuge === 'Mariana', 'nome do cônjuge', a.familia.conjuge)
  ok(/m[ée]dico/i.test(a.familia.profissao ?? ''), 'profissão', a.familia.profissao)
}

// ── 4. PERFIL ───────────────────────────────────────────────────────────────
console.log('\n── O perfil que decide a venda ──')
{
  const a = analisar([
    '00:00:05 Natália: O que te fez aceitar essa conversa?',
    '00:00:10 Carlos: Meu pai morreu ano passado e o inventário travou tudo.',
    '00:00:30 Carlos: Tenho 41 anos. Não fumo, nunca fumei.',
    '00:00:45 Carlos: Tenho pressão alta e tomo remédio.',
    '00:01:00 Carlos: Já tenho um seguro pela empresa, e o prestamista do financiamento.',
    '00:01:25 Carlos: Eu e minha esposa decidimos junto. Quero resolver ainda esse mês.',
    '00:01:40 Carlos: Posso pagar uns 2 mil por mês.',
    '00:02:00 Carlos: Na clínica somos 3 sócios. Ajudo meus pais todo mês.',
  ])
  const p = a.perfil
  ok(p.idade?.valor === 41, 'idade', p.idade?.valor)
  ok(p.fumante?.valor === false, 'não fumante (e não o contrário)', JSON.stringify(p.fumante))
  ok(p.saude != null, 'condição de saúde sinalizada para a DPS', 'nada')
  ok(p.seguros.map((s) => s.origem).sort().join(',') === 'consignado,empresa',
    'seguros existentes: empresa e consignado', p.seguros.map((s) => s.origem).join(','))
  ok(p.seguros.every((s) => s.trecho), 'todo seguro vem com o trecho de prova', 'faltou trecho')
  ok(p.quemDecide?.valor === 'Ele e o cônjuge, juntos', 'quem decide', p.quemDecide?.valor)
  ok(p.prazoDecisao?.valor === 'Até o fim do mês', 'prazo de decisão', p.prazoDecisao?.valor)
  ok(p.orcamento?.valor === 2000, 'orçamento declarado', p.orcamento?.valor)
  ok(p.motivo != null, 'motivo da busca', 'nada')
  ok(p.outrosDependentes != null, 'ajuda os pais', 'nada')
  ok(p.numSocios?.valor === 3, 'nº de sócios', p.numSocios?.valor)
}
{
  // o contrário não pode ser confundido
  const a = analisar(['Carlos: Eu fumo desde os 20 anos, uns 10 cigarros por dia.'])
  ok(a.perfil.fumante?.valor === true, 'fumante detectado quando é o caso', JSON.stringify(a.perfil.fumante))
}

// ── 5. OBJEÇÕES, SINAIS E COMPROMISSOS ──────────────────────────────────────
console.log('\n── A leitura da conversa ──')
{
  const a = analisar([
    '00:10:00 Carlos: Achei um pouco caro, sinceramente.',
    '00:10:20 Carlos: Vou pensar e te retorno.',
    '00:11:00 Carlos: Como faço para contratar? Tem carência?',
    '00:12:00 Natália: Vou te mandar a proposta até sexta.',
    '00:12:30 Carlos: Fico de te mandar os documentos amanhã.',
  ])
  const ids = a.objecoes.map((o) => o.id)
  ok(ids.includes('preco'), 'objeção de preço', ids.join(','))
  ok(ids.includes('pensar'), 'objeção "vou pensar"', ids.join(','))
  ok(a.objecoes.every((o) => o.responder), 'toda objeção vem com a resposta sugerida', 'faltou resposta')
  const sinais = a.sinais.map((s) => s.id)
  ok(sinais.includes('como_contrata'), 'sinal: perguntou como contratar', sinais.join(','))
  ok(sinais.includes('quando_vale'), 'sinal: perguntou sobre carência', sinais.join(','))
  ok(a.compromissos.length >= 2, 'os dois compromissos foram capturados', a.compromissos.length)
  ok(a.compromissos.some((c) => c.prazo), 'pelo menos um com prazo', 'nenhum com prazo')
}

// ── 6. NOTAS E ROTEIRO ──────────────────────────────────────────────────────
console.log('\n── A régua da condução ──')
{
  // Reunião consultiva de verdade: quem fala é o cliente, os números aparecem,
  // o roteiro é percorrido e ela sai com o próximo passo marcado.
  const boa = analisar([
    '00:00:05 Natália: Bom dia Carlos, obrigada pelo tempo. Me conta um pouco de você?',
    '00:00:30 Carlos: Sou médico cardiologista, casado com a Mariana. Tenho a Alice de 6 e o Lucas de 9.'
      + ' Trabalho na clínica há doze anos e é de lá que vem praticamente toda a renda de casa.'
      + ' Ganho 48 mil por mês e o custo de vida da família fica em 27 mil.',
    '00:02:00 Natália: Se a renda parasse hoje, por quanto tempo a família manteria o padrão de vida?',
    '00:02:30 Carlos: Olha, sinceramente, uns seis meses no máximo. Nunca pensei nisso e me preocupa.'
      + ' Tenho 2,3 milhões em imóveis, mas isso não paga escola no mês seguinte.'
      + ' Meu pai morreu e o inventário dele travou tudo por dois anos — eu vi de perto.',
    '00:05:00 Natália: Vou te explicar invalidez, doenças graves e a diária de internação.',
    '00:06:00 Carlos: Doenças graves eu nem sabia que existia. Isso paga com a pessoa viva mesmo?'
      + ' E se eu não puder trabalhar, como fica? Devo uns 200 mil de financiamento ainda.',
    '00:09:00 Natália: Esse é o estudo com o capital e a importância segurada da apólice.',
    '00:10:00 Carlos: Faz sentido. Como faço para contratar? Precisa de exame?',
    '00:14:00 Natália: O próximo passo é a declaração de saúde. Te mando o link hoje.',
  ])
  ok(boa.nota >= 60, 'reunião bem conduzida tira nota alta', boa.nota)
  ok(boa.roteiro.filter((r) => r.cobriu).length >= 4, 'pelo menos 4 blocos do roteiro cobertos',
    boa.roteiro.filter((r) => r.cobriu).map((r) => r.id).join(','))

  const fraca = analisar(['Natália: Oi. Então é isso, qualquer coisa me avisa.'])
  ok(fraca.nota < boa.nota, 'conversa vazia tira nota menor que a boa', `${fraca.nota} vs ${boa.nota}`)
  ok(fraca.nota >= 0 && fraca.nota <= 100, 'nota dentro de 0..100', fraca.nota)
}

// ── 7. AS DUAS SAÍDAS ───────────────────────────────────────────────────────
console.log('\n── O que ela leva da reunião ──')
{
  const a = analisar([
    '00:00:10 Carlos: Ganho 48 mil por mês e gasto 27 mil. Tenho a Alice de 6 anos.',
    '00:05:00 Carlos: Achei caro, vou pensar.',
    '00:06:00 Natália: Vou te mandar a proposta até sexta.',
  ])
  const cliente = resumoParaCliente(a, { nomeCliente: 'Carlos Eduardo Menezes' })
  ok(cliente.startsWith('Carlos,'), 'resumo do cliente chama ele pelo primeiro nome', cliente.slice(0, 30))
  ok(!/objeç|nota de condução|temperatura|caro/i.test(cliente),
    'resumo do cliente NÃO leva objeção nem nota de condução', 'vazou estratégia interna')
  ok(cliente.includes('Alice'), 'resumo do cliente cita a família', 'não citou')
  ok(/proposta/i.test(cliente), 'resumo do cliente traz o compromisso da consultora', 'não trouxe')

  const perguntas = perguntasQueFaltaram(a)
  ok(perguntas.length > 0, 'a lista de perguntas que faltaram não vem vazia', perguntas.length)
  ok(perguntas.every((q) => q.includes('?') || q.includes('(')),
    'as perguntas estão escritas como pergunta, não como nome de campo', perguntas.join(' | '))
}

// ── 8. ENTRADAS QUE NÃO PODEM QUEBRAR ───────────────────────────────────────
console.log('\n── O que a consultora pode colar sem querer ──')
for (const [rotulo, entrada] of [
  ['texto vazio', ''],
  ['só espaços', '     \n\n   '],
  ['só emoji', '🙂💥'],
  ['WebVTT do Zoom', 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nCarlos: Ganho 48 mil por mês.'],
  ['texto corrido sem falante', 'ganho uns 48 mil por mês e gasto 27 mil com a familia'],
  ['linha gigante', 'Carlos: ' + 'palavra '.repeat(5000)],
]) {
  let a, erro = null
  try { a = analisarTranscricao(entrada) } catch (e) { erro = e.message }
  ok(erro === null, `${rotulo}: não explode`, erro)
  if (a) {
    ok(a.nota >= 0 && a.nota <= 100, `${rotulo}: nota válida`, a.nota)
  }
}
{
  const a = analisarTranscricao('WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nCarlos: Ganho 48 mil por mês.')
  ok(valorDe(a, 'renda_mensal') === 48000, 'WebVTT: a renda é extraída mesmo assim', valorDe(a, 'renda_mensal'))
}

console.log('\n── RESULTADO (transcrição) ──')
console.log(falhas.length ? `Falhas: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : 'Falhas: nenhuma 🎉')
process.exit(falhas.length ? 1 : 0)
