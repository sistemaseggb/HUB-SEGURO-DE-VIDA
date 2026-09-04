// ─────────────────────────────────────────────────────────────────────────────
// O GUIA NÃO PODE MENTIR SOBRE O MOTOR.
//
// O guia ensina a consultora a DEFENDER os números do estudo: de onde sai o
// capital de morte, por que o filho some da conta aos 24, por que a apólice da
// empresa não abate o gap. Ela vai repetir isso na frente do cliente.
//
// Um manual escrito à mão começa certo e envelhece sozinho — alguém ajusta uma
// regra e o texto segue ensinando a conta antiga com toda a confiança de quem
// foi escrito uma vez. Por isso o guia roda `calcularEstudo()` de verdade, e
// por isso este teste existe: ele confere que as AFIRMAÇÕES do guia continuam
// verdadeiras no motor.
//
// A regra é simples: toda frase do guia que afirma uma relação entre números
// tem uma linha aqui. Se alguém mudar o motor de um jeito que desminta o guia,
// isto quebra — em vez de a consultora descobrir na reunião.
//
// Roda com `npm run test:tutorial` (e junto de `npm test`).
// ─────────────────────────────────────────────────────────────────────────────

import { IDADE_INDEPENDENCIA, LIMITES_MERCADO } from '../src/lib/estudo.js'
import {
  PLANO_EXEMPLO, CLIENTE_EXEMPLO, estudoDoExemplo, diagnosticoDoExemplo,
  estudoIncompleto, diagnosticoIncompleto, parcelasDoCapitalDeMorte,
  TRAVAS_DO_MOTOR, ERROS_CAROS, moeda, moedaCurta, objecoesDoExemplo,
} from '../src/lib/tutorial.js'

let falhas = 0
let feitos = 0
const ok = (cond, nome, detalhe = '') => {
  feitos += 1
  if (cond) { console.log(`✓ ${nome}`); return true }
  falhas += 1
  console.log(`✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  return false
}

const e = estudoDoExemplo()
const d = diagnosticoDoExemplo(e)

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O exemplo existe e está completo o bastante para ensinar ──')
// ─────────────────────────────────────────────────────────────────────────────
// Um exemplo pela metade ensinaria um sistema pela metade: sem PJ não há
// capítulo empresarial, sem filhos não há a lição dos 24, sem apólice
// existente não há a objeção mais comum da categoria.
{
  ok(e != null && d != null, 'o motor e o diagnóstico rodam sobre o cliente do guia')
  ok(e.idade === 42, 'Carlos tem os 42 anos que o texto do guia diz', `idade=${e.idade}`)
  ok(CLIENTE_EXEMPLO.resumo.includes('42 anos'), 'e o resumo escrito concorda com a data de nascimento')
  ok(e.filhos.length === 2 && e.filhos.every((f) => f.idade != null),
    'os dois filhos entram com idade — sem idade não há a lição dos 24')
  ok(e.temPJ && e.pj.valuation > 0, 'o bloco empresarial tem substância')
  ok(e.carteira.detalhado, 'a carteira existente está detalhada por origem')
  ok(e.investimento?.mensal > 0, 'há prêmio cotado — sem ele metade dos capítulos fica vazia')
  ok(e.inconsistencias.length > 0, 'a conferência tem itens para o guia explicar')
  ok(d.recomendacoes.length >= 3, 'o diagnóstico produz recomendações para o guia mostrar',
    `${d.recomendacoes.length}`)
  ok(d.perfil != null, 'e classifica um perfil')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── "O capital de morte é a soma destas três parcelas" ──')
// ─────────────────────────────────────────────────────────────────────────────
// É a conta que abre a proposta e a primeira que o cliente questiona. O guia
// mostra as parcelas somadas na tela; se elas deixarem de somar o total, a
// consultora apresenta uma conta que não fecha.
{
  const partes = parcelasDoCapitalDeMorte(e)
  ok(partes.length === 3, 'as três parcelas aparecem (padrão de vida, filhos, dívidas)',
    partes.map((p) => p.id).join(', '))
  const soma = partes.reduce((s, p) => s + p.valor, 0)
  ok(Math.abs(soma - e.valores.morte) < 1,
    'e somam EXATAMENTE o capital de morte do estudo',
    `parcelas ${moeda(soma)} contra motor ${moeda(e.valores.morte)}`)

  // a primeira parcela usa o custo de vida SEM os filhos — é a lição inteira
  ok(Math.abs(e.custoVidaBase - (e.custoVida - e.custoFilhosMensal)) < 1,
    'a parcela do padrão de vida exclui o gasto dos filhos')
  ok(e.custoVidaBase < e.custoVida,
    'e por isso é menor que o custo de vida informado',
    `${moeda(e.custoVidaBase)} contra ${moeda(e.custoVida)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n── "O filho sai da conta aos ${IDADE_INDEPENDENCIA}" ──`)
// ─────────────────────────────────────────────────────────────────────────────
{
  const [alice, lucas] = e.filhos
  ok(alice.anosRestantes === IDADE_INDEPENDENCIA - alice.idade,
    'os anos restantes de cada filho vão até a independência')
  ok(alice.anosRestantes > lucas.anosRestantes,
    'o filho mais novo tem mais anos pela frente')
  ok(alice.capitalAte24 > lucas.capitalAte24,
    'e por isso pesa mais no capital, mesmo com custo mensal parecido',
    `${moeda(alice.capitalAte24)} contra ${moeda(lucas.capitalAte24)}`)
  ok(Math.abs(e.capitalFilhos - e.filhos.reduce((s, f) => s + f.capitalAte24, 0)) < 1,
    'o total dos filhos é a soma dos dois')

  // e o horizonte precisa alcançar o mais novo — senão o guia estaria
  // ensinando com um exemplo que o próprio sistema acusaria
  ok(e.anos >= IDADE_INDEPENDENCIA - alice.idade,
    'o horizonte do exemplo cobre até a filha mais nova virar adulta')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── "Com dependentes, a invalidez acompanha a morte" ──')
// ─────────────────────────────────────────────────────────────────────────────
// O guia afirma isso em texto. Se o motor voltar a projetar o gasto dos filhos
// pelo horizonte inteiro na invalidez (o defeito que já existiu), a frase vira
// mentira e a consultora explica uma diferença que não sabe justificar.
{
  ok(e.temDependentes, 'Carlos tem dependentes')
  ok(e.sugestoes.invalidez === e.sugestoes.morte,
    'e a sugestão de invalidez é igual à de morte',
    `${moeda(e.sugestoes.invalidez)} contra ${moeda(e.sugestoes.morte)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── "Previdência e seguro não passam por inventário" ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  ok(e.bensInventariaveis > 0 && e.previdencia > 0, 'o exemplo tem bens e previdência')
  const classesNoInventario = e.classes.filter((c) => c.inventario).map((c) => c.id)
  ok(!classesNoInventario.includes('previdencia'),
    'a previdência fica FORA das classes que passam por inventário')
  ok(Math.abs(e.patrimonioBruto - (e.bensInventariaveis + e.previdencia)) < 1,
    'o patrimônio bruto é bens inventariáveis + previdência')
  ok(e.custoInventario > 0 && e.custoInventario < e.bensInventariaveis,
    'o custo do inventário é positivo e menor que o patrimônio que trava')
  ok(e.itcmdOrigem === 'uf' && e.uf === 'PR',
    'o ITCMD do exemplo vem do estado do cliente, não do padrão nacional',
    `origem=${e.itcmdOrigem} uf=${e.uf}`)
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── "Já tenho seguro pela empresa" — a lição central do guia ──')
// ─────────────────────────────────────────────────────────────────────────────
// As duas apólices de Carlos existem no exemplo exatamente para ensinar isto.
// Se a decomposição parar de funcionar, o guia perde o capítulo que responde à
// objeção mais comum da categoria.
{
  ok(e.carteira.total === 500_000, 'as duas apólices somam o que ele declarou')
  ok(e.carteira.portavel === 0,
    'NADA da carteira dele é portátil: uma é da empresa, a outra é do banco',
    `portavel=${moeda(e.carteira.portavel)}`)
  ok(e.capitalQueEvapora === 300_000,
    'os 300 mil da vida em grupo somem no dia em que o vínculo acabar')
  ok(e.carteira.quitaDivida === 200_000,
    'e os 200 mil da prestamista pagam o banco, não a família')
  ok(e.gapPortavel > e.gap,
    'por isso o gap portátil é MAIOR que o gap simples — é a frase que abre a conversa',
    `${moeda(e.gapPortavel)} contra ${moeda(e.gap)}`)
  // A distância entre os dois tem DUAS causas, e o guia precisa dizer as duas:
  // a vida em grupo que evapora com o vínculo E a prestamista que nunca foi
  // dinheiro da família. Somar só a primeira explica metade do salto.
  ok(e.gapPortavel - e.gap === e.capitalQueEvapora + e.carteira.quitaDivida,
    'e o salto entre os dois é a vida em grupo MAIS a prestamista',
    `salto ${moeda(e.gapPortavel - e.gap)} contra `
      + `${moeda(e.capitalQueEvapora)} + ${moeda(e.carteira.quitaDivida)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── As três travas que o guia ensina ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  ok(TRAVAS_DO_MOTOR.length === 3, 'são três travas')
  ok(TRAVAS_DO_MOTOR.every((t) => t.titulo && t.texto && t.naPratica),
    'e nenhuma sai sem título, explicação e o que fazer na prática')
  // os números citados no texto da trava saem das constantes do motor
  const textoTeto = TRAVAS_DO_MOTOR.find((t) => t.id === 'teto').texto
  ok(textoTeto.includes(moedaCurta(LIMITES_MERCADO.morte)),
    'o teto de morte citado no guia é o teto de verdade do motor')
  ok(textoTeto.includes(moedaCurta(LIMITES_MERCADO.doencas_graves)),
    'e o de doenças graves também')
  ok(textoTeto.includes(moeda(LIMITES_MERCADO.diaria_dit)),
    'e o da diária também')

  // a trava de doenças graves só pode ser ensinada se o motor a aplicar
  ok(e.valores.doencas_graves <= e.valores.morte,
    'no exemplo, doenças graves respeita o capital de morte')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A conferência que o guia mostra é a conferência de verdade ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  const graves = e.inconsistencias.filter((i) => i.grave)
  ok(graves.length >= 2, 'o exemplo produz avisos graves para o guia explicar',
    `${graves.length} graves de ${e.inconsistencias.length}`)
  ok(e.inconsistencias.every((i) => typeof i.texto === 'string' && i.texto.trim() !== ''),
    'nenhum aviso sai sem texto')
  ok(e.inconsistencias.every((i) => i.corrigir == null || Number.isFinite(i.valor)),
    'todo aviso que oferece correção traz um número válido')
  // o guia ensina que existem os dois tipos: o que corrige sozinho e o que
  // manda perguntar ao cliente
  const temCorrigir = e.inconsistencias.some((i) => i.corrigir)
  ok(temCorrigir || graves.length > 0, 'há pelo menos um aviso acionável no exemplo')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── "Recomendação é decisão; pendência é dado que falta" ──')
// ─────────────────────────────────────────────────────────────────────────────
// O guia separa as duas de propósito, porque misturá-las faz a consultora
// apresentar um estudo achando que ele está pronto.
{
  ok(Array.isArray(d.recomendacoes) && Array.isArray(d.pendencias),
    'o diagnóstico devolve as duas listas separadas')
  ok(d.recomendacoes.every((r) => r.porque && r.porque.length >= 20),
    'toda recomendação carrega o porquê com números — palpite sem conta atrás não é gerado')
  ok(d.recomendacoes.every((r) => r.tipo), 'e toda recomendação tem um tipo (a gravidade)')

  // o estudo completo não deve ter pendências críticas: é o exemplo do que
  // "pronto" parece
  ok(d.pendencias.length === 0,
    'o estudo completo do exemplo não tem pendência nenhuma — é o retrato do "pronto"',
    d.pendencias.map((p) => p.id).join(', '))

  // e o mesmo cliente no meio da reunião tem, o que é o outro lado da lição
  const dIncompleto = diagnosticoIncompleto(estudoIncompleto())
  ok(dIncompleto.pendencias.length >= 4,
    'e o mesmo cliente no meio da reunião tem várias pendências',
    `${dIncompleto.pendencias.length}`)
  ok(dIncompleto.pendencias.some((p) => p.critico),
    'incluindo pelo menos uma crítica')
  ok(dIncompleto.pendencias.every((p) => p.texto && p.texto.trim() !== ''),
    'e cada pendência explica por que aquele dado importa')
  ok(dIncompleto.pendencias.filter((p) => p.critico).every((p) => p.perguntaAoCliente),
    'toda pendência crítica traz a pergunta pronta para fazer ao cliente')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── As objeções que o guia mostra vêm do motor, não de um roteiro ──')
// ─────────────────────────────────────────────────────────────────────────────
// O guia mostra as três objeções mais prováveis de Carlos já respondidas. O
// valor está no formato: argumento com conta atrás, o que NÃO dizer, e a
// pergunta que devolve a palavra ao cliente. Se qualquer uma das três partes
// sumir, a lição some junto — meia resposta é dita com a mesma confiança da
// inteira.
{
  const obj = objecoesDoExemplo(e, d)
  ok(obj?.lista?.length >= 3, 'o exemplo levanta pelo menos três objeções previstas',
    `${obj?.lista?.length ?? 0}`)
  const tres = obj.lista.slice(0, 3)
  ok(tres.every((o) => o.argumentos?.length > 0),
    'cada uma vem com argumento pronto')
  ok(tres.every((o) => o.naoDiga && o.naoDiga.trim() !== ''),
    'e com o que NÃO dizer — a parte que nenhum treinamento escreve')
  ok(tres.every((o) => o.pergunta && o.pergunta.trim() !== ''),
    'e com a pergunta que devolve a palavra ao cliente')
  ok(tres.every((o) => o.rotulo && o.nivelRotulo),
    'e identificada, com o quanto é provável neste caso')
  // a objeção central do exemplo precisa estar entre as prováveis: é ela que o
  // guia usa para amarrar a lição da carteira emprestada
  ok(obj.lista.some((o) => o.id === 'ja_tem'),
    '"já tenho seguro pela empresa" está entre as previstas para Carlos')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Os erros que custam caro ──')
// ─────────────────────────────────────────────────────────────────────────────
{
  ok(ERROS_CAROS.length >= 5, 'a lista tem substância', `${ERROS_CAROS.length} itens`)
  ok(ERROS_CAROS.every((x) => x.erro && x.custa && x.faca),
    'e cada erro diz o que custa E o que fazer no lugar — acusar sem alternativa não ensina')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O exemplo não muda de número com o passar dos dias ──')
// ─────────────────────────────────────────────────────────────────────────────
// A data é fixa de propósito: o guia explica a idade de Carlos em texto, e o
// texto não pode discordar da conta porque alguém abriu a página amanhã.
{
  const a = estudoDoExemplo()
  const b = estudoDoExemplo()
  ok(a.valores.morte === b.valores.morte && a.idade === b.idade,
    'duas chamadas seguidas dão o mesmo resultado')
  ok(PLANO_EXEMPLO.anos_protecao === 20, 'o horizonte do exemplo é o que o texto do guia cita')
}

console.log('\n── RESULTADO (guia) ──')
console.log(falhas === 0 ? `Falhas: nenhuma 🎉  (${feitos} conferências)` : `Falhas: ${falhas} de ${feitos}`)
process.exit(falhas ? 1 : 0)
