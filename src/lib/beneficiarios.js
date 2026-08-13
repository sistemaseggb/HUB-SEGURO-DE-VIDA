// ─────────────────────────────────────────────────────────────────────────────
// OS BENEFICIÁRIOS — quem recebe, quando recebe, e o que trava no caminho.
//
// A proposta inteira se apoia numa frase: "o seguro não passa por inventário,
// chega em dias". A frase é verdadeira e tem base legal — só que o sistema
// nunca guardou uma linha sobre a INDICAÇÃO de beneficiário, que é exatamente
// onde a promessa se cumpre ou se quebra na prática.
//
// ── A BASE LEGAL DA PROMESSA ─────────────────────────────────────────────────
// Código Civil, art. 794: o capital segurado NÃO é considerado herança para
// todos os efeitos de direito. Daí saem três consequências, e é isso que
// sustenta o capítulo de sucessão:
//   · não entra em inventário e não espera partilha;
//   · não integra a base do ITCMD;
//   · não responde pelas dívidas do segurado — os credores não o alcançam.
//
// Código Civil, art. 792: sem beneficiário indicado, ou se a indicação não
// prevalecer, o capital é pago METADE ao cônjuge não separado judicialmente, e
// o restante aos herdeiros do segurado, na ordem da vocação hereditária.
//
// Código Civil, art. 793: é válido indicar companheiro(a), desde que o segurado
// fosse separado judicialmente ou de fato ao tempo do contrato.
//
// Lei 7.713/88, art. 6º, XIII: o capital pago por morte é ISENTO de imposto de
// renda para o beneficiário.
//
// ── O QUE TRAVA NA PRÁTICA ───────────────────────────────────────────────────
// E aqui mora o motivo deste arquivo existir. A seguradora paga rápido; o
// dinheiro é que pode não ficar disponível.
//
// BENEFICIÁRIO MENOR é o caso clássico e o mais doloroso, porque acontece
// justamente com o cliente que fez tudo certo: o pai de família que indicou os
// filhos. O menor não administra o próprio patrimônio. Na prática, a quantia
// fica sob representação legal e o uso costuma depender de autorização judicial
// (alvará) — meses de espera pelo capital que existia precisamente para não
// haver espera. O seguro cumpriu o contrato e falhou no propósito.
//
// A correção é de dez segundos na proposta de contratação, e quase ninguém faz:
// indicar o cônjuge como beneficiário principal e os filhos como suplentes, ou
// prever quem administra. Este arquivo existe para essa pergunta ser feita
// ANTES da assinatura, e não descoberta no pior mês da vida daquela família.
//
// Nada aqui é parecer jurídico e o arquivo diz isso onde importa: cada
// afirmação carrega a referência para a consultora poder conferir e, quando o
// caso é sensível, o sistema manda consultar o jurídico da seguradora.
// ─────────────────────────────────────────────────────────────────────────────

import { idadeEm } from './estudo.js'

const m = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`

// ─── O que a consultora precisa saber, com a fonte ───────────────────────────
// Aparece na tela como cartões de consulta. Referência junto de propósito:
// afirmação jurídica sem artigo é opinião, e ela vai repetir isso na frente de
// um cliente que às vezes tem advogado.
export const CONHECIMENTO = [
  {
    id: 'nao-e-heranca',
    titulo: 'O capital do seguro não é herança',
    referencia: 'Código Civil, art. 794',
    texto: 'O capital segurado não é considerado herança para todos os efeitos de direito. '
      + 'Não entra em inventário, não integra a base do ITCMD e não responde pelas dívidas do '
      + 'segurado. É o alicerce de todo o capítulo de sucessão da proposta — e é por isso que '
      + 'o dinheiro do seguro chega enquanto os bens ainda estão travados.',
  },
  {
    id: 'sem-indicacao',
    titulo: 'Sem beneficiário indicado, a lei decide',
    referencia: 'Código Civil, art. 792',
    texto: 'Faltando indicação, ou não prevalecendo a que foi feita, o capital é pago metade '
      + 'ao cônjuge não separado judicialmente e o restante aos herdeiros, na ordem da vocação '
      + 'hereditária. Não é o fim do mundo, mas é a lei escolhendo por ele — e raramente é o '
      + 'desenho que ele descreveria se alguém perguntasse.',
  },
  {
    id: 'companheiro',
    titulo: 'Companheiro(a) pode ser beneficiário',
    referencia: 'Código Civil, art. 793',
    texto: 'A indicação de companheiro(a) é válida se o segurado era separado judicialmente ou '
      + 'de fato ao tempo do contrato. Em união estável não formalizada, vale documentar a '
      + 'situação junto à proposta: é o tipo de detalhe que só é cobrado no sinistro.',
  },
  {
    id: 'menor',
    titulo: 'Beneficiário menor de idade recebe — mas não usa',
    referencia: 'Prática de mercado e representação legal do menor',
    texto: 'A seguradora paga, e o dinheiro fica sob representação legal. O uso costuma depender '
      + 'de autorização judicial, o que leva meses — exatamente o contrário do que o seguro foi '
      + 'contratado para fazer. Indicar o cônjuge como principal e os filhos como suplentes '
      + 'resolve na proposta de contratação, em dez segundos.',
  },
  {
    id: 'ir-isento',
    titulo: 'O beneficiário não paga imposto de renda',
    referencia: 'Lei 7.713/88, art. 6º, XIII',
    texto: 'O capital pago por morte é isento de IR para quem recebe. Diferente da previdência, '
      + 'em que o resgate é tributado — e é uma das comparações mais fortes da conversa de '
      + 'sucessão, porque o cliente costuma achar que os dois funcionam igual.',
  },
  {
    id: 'divorcio',
    titulo: 'A indicação não se atualiza sozinha',
    referencia: 'Revisão periódica da apólice',
    texto: 'Divórcio, novo casamento, filho novo: nada disso muda a indicação feita anos atrás. '
      + 'O ex-cônjuge continua beneficiário até alguém trocar o papel. É a revisão de cinco '
      + 'minutos que evita o pior desencontro possível, e cabe na conversa anual de pós-venda.',
  },
]

// ─── A indicação deste cliente ───────────────────────────────────────────────
// Formato da coluna `beneficiarios` (migração 025):
//   [{ nome, parentesco, pct, nascimento }]
export const PARENTESCOS = [
  'Cônjuge', 'Companheiro(a)', 'Filho(a)', 'Pai', 'Mãe',
  'Irmão(ã)', 'Neto(a)', 'Outro', 'Herdeiros legais',
]

const num = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

export function analisarBeneficiarios(plano, estudo, { hoje = new Date() } = {}) {
  const brutos = Array.isArray(plano?.beneficiarios) ? plano.beneficiarios : []
  const itens = brutos
    .filter((b) => b && (String(b.nome ?? '').trim() !== '' || num(b.pct) > 0))
    .map((b) => {
      const idade = idadeEm(b.nascimento, hoje)
      return {
        nome: String(b.nome ?? '').trim(),
        parentesco: b.parentesco || 'Outro',
        pct: Math.min(Math.max(num(b.pct), 0), 100),
        nascimento: b.nascimento || null,
        idade,
        // Sem data de nascimento não dá para afirmar que é menor. "Filho(a)"
        // sem idade fica em dúvida declarada, que é diferente de "está tudo bem".
        menor: idade != null ? idade < 18 : null,
      }
    })

  const declarado = itens.length > 0
  const somaPct = Math.round(itens.reduce((s, b) => s + b.pct, 0) * 10) / 10
  const capital = estudo?.valores?.morte ?? 0

  const menores = itens.filter((b) => b.menor === true)
  const idadeDesconhecida = itens.filter((b) => b.menor === null && /filho|neto/i.test(b.parentesco))
  const capitalParaMenores = menores.reduce((s, b) => s + (capital * b.pct) / 100, 0)

  // ── Os alertas ────────────────────────────────────────────────────────────
  const alertas = []

  if (!declarado && capital > 0) {
    alertas.push({
      id: 'sem-indicacao', grave: false,
      titulo: 'Nenhum beneficiário indicado no estudo',
      texto: `São ${m(capital)} sem destinatário registrado aqui. A indicação é feita na proposta `
        + 'de contratação, mas decidir isso na reunião — e não na pressa da assinatura — é o que '
        + 'evita o erro mais caro da apólice. Sem indicação válida, a lei paga metade ao cônjuge '
        + 'e o resto aos herdeiros (CC art. 792).',
    })
  }

  if (declarado && Math.abs(somaPct - 100) > 0.5) {
    alertas.push({
      id: 'soma', grave: true,
      titulo: `Os percentuais somam ${String(somaPct).replace('.', ',')}%, não 100%`,
      texto: somaPct < 100
        ? `Faltam ${String(Math.round((100 - somaPct) * 10) / 10).replace('.', ',')}% sem destinatário. `
          + 'A parte não indicada segue a regra legal (CC art. 792) — normalmente não é o que o cliente imagina.'
        : 'A soma passa de 100%. A seguradora vai recusar a indicação e pedir correção, atrasando a emissão.',
    })
  }

  if (menores.length > 0) {
    alertas.push({
      id: 'menor', grave: true,
      titulo: `${menores.length} beneficiário(s) menor(es) de idade`,
      texto: `${menores.map((b) => b.nome || 'sem nome').join(', ')} — ${m(capitalParaMenores)} do capital. `
        + 'A seguradora paga, mas o dinheiro fica sob representação legal e o uso costuma depender '
        + 'de autorização judicial: meses de espera, exatamente o contrário do que este seguro foi '
        + 'contratado para fazer. Considere indicar o cônjuge como beneficiário principal e os '
        + 'filhos como suplentes, ou prever quem administra. É uma decisão de dez segundos agora, '
        + 'e de meses depois.',
    })
  }

  if (idadeDesconhecida.length > 0) {
    alertas.push({
      id: 'idade-desconhecida', grave: false,
      titulo: 'Falta a data de nascimento de beneficiário filho/neto',
      texto: `${idadeDesconhecida.map((b) => b.nome || 'sem nome').join(', ')}: sem a data, o sistema `
        + 'não consegue avisar se a indicação cria o problema do beneficiário menor. A seguradora '
        + 'vai pedir a data de qualquer forma — melhor agora do que travando a emissão.',
    })
  }

  // Casado sem o cônjuge na lista: pode ser deliberado, e por isso é pergunta,
  // não acusação. O que não pode é ser esquecimento descoberto no sinistro.
  const temConjugeNaLista = itens.some((b) => /c[ôo]njuge|companheir/i.test(b.parentesco))
  if (declarado && estudo?.temConjuge && !temConjugeNaLista) {
    alertas.push({
      id: 'sem-conjuge', grave: false,
      titulo: 'Cliente casado(a) e o cônjuge não está entre os beneficiários',
      texto: 'Pode ser exatamente o que ele quer — e nesse caso está certo assim. Só vale confirmar '
        + 'em voz alta, porque é o tipo de omissão que ninguém descobre até o pior momento. Se houver '
        + 'filhos menores na lista, o cônjuge como principal também resolve o problema do alvará.',
    })
  }

  if (declarado && itens.some((b) => /companheir/i.test(b.parentesco))) {
    alertas.push({
      id: 'companheiro', grave: false,
      titulo: 'Beneficiário companheiro(a): vale documentar',
      texto: 'A indicação é válida (CC art. 793) se o segurado era separado judicialmente ou de fato '
        + 'ao tempo do contrato. Em união estável não formalizada, anexe o que comprove a situação '
        + 'junto à proposta — é detalhe que só é cobrado no sinistro, quando ninguém pode mais resolver.',
    })
  }

  if (declarado && itens.some((b) => String(b.nome ?? '').trim() === '')) {
    alertas.push({
      id: 'sem-nome', grave: false,
      titulo: 'Beneficiário sem nome preenchido',
      texto: 'A seguradora exige nome completo, CPF e data de nascimento de cada beneficiário. '
        + 'Indicação incompleta volta para correção e atrasa a emissão.',
    })
  }

  return {
    declarado,
    itens,
    somaPct,
    capital,
    menores,
    capitalParaMenores,
    alertas,
    conhecimento: CONHECIMENTO,
    // O quadro que vira conversa: quanto cada um recebe, em dinheiro
    rateio: capital > 0
      ? itens.map((b) => ({ ...b, valor: Math.round((capital * b.pct) / 100) }))
      : itens.map((b) => ({ ...b, valor: 0 })),
  }
}
