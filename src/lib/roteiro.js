// ─────────────────────────────────────────────────────────────────────────────
// Roteiro consultivo da reunião de seguro de vida.
//
// É o playbook que a consultora segue DURANTE o encontro — não um formulário
// rígido, e sim um guia de conversa. Cada bloco tem um propósito, perguntas e
// falas prontas, e sinais de que a etapa foi bem feita. A consultora marca o
// que cumpriu e anota o que ouviu — as anotações viram matéria-prima do estudo.
//
// A estrutura segue a venda consultiva clássica: primeiro entender, depois
// educar, só então apresentar o número. Vender proteção é vender significado.
// ─────────────────────────────────────────────────────────────────────────────

export const BLOCOS_ROTEIRO = [
  {
    id: 'abertura',
    titulo: 'Abertura e conexão',
    objetivo: 'Criar confiança e combinar como será a conversa. Ninguém compra de quem não confia.',
    tempo: '5 min',
    falas: [
      'Agradeça o tempo e reforce que é uma conversa, não uma venda.',
      'Combine a agenda: "vou te fazer algumas perguntas para entender seu momento, depois te mostro um estudo feito sob medida".',
      'Pergunte algo pessoal genuíno (família, trabalho, o que anda tirando o sono).',
    ],
    perguntas: [
      'Me conta um pouco de você e da sua família?',
      'O que te fez aceitar essa conversa hoje?',
    ],
  },
  {
    id: 'descoberta',
    titulo: 'Descoberta — o retrato da vida',
    objetivo: 'Levantar os números e as pessoas. É aqui que você preenche o Planejamento.',
    tempo: '15 min',
    falas: [
      'Investigue renda, custo de vida, patrimônio e dívidas — sem pressa.',
      'Mapeie quem depende dessa renda: cônjuge, filhos (idades!), pais.',
      'Descubra os sonhos: faculdade dos filhos, aposentadoria, um imóvel.',
    ],
    perguntas: [
      'Se a sua renda parasse hoje, por quanto tempo a família se manteria?',
      'Quem depende financeiramente de você hoje?',
      'Quais são os sonhos que você quer garantir que aconteçam, com ou sem você?',
    ],
    dica: 'Preencha a aba Planejamento junto com o cliente — os números aparecem na hora.',
  },
  {
    id: 'dores',
    titulo: 'Consciência — a dor que dorme',
    objetivo: 'Fazer o cliente sentir o risco que hoje ele ignora. Sem dor, não há decisão.',
    tempo: '10 min',
    falas: [
      'Traga o cenário real: "imagine que amanhã você não possa mais trabalhar".',
      'Mostre a autonomia atual da família (o número que o estudo calcula).',
      'Fale do inventário: os bens travam, a família paga imposto à vista.',
    ],
    perguntas: [
      'Você já parou para pensar em como ficaria o padrão de vida deles?',
      'Se precisasse de R$ X em dinheiro amanhã, de onde viria?',
    ],
  },
  {
    id: 'educacao',
    titulo: 'Educação — os pilares da proteção',
    objetivo: 'Ensinar que seguro de vida é muito mais que morte. Cliente educado decide melhor.',
    tempo: '10 min',
    falas: [
      'Explique os 5 pilares: morte, invalidez, doenças graves, DIT e sucessão.',
      'Doenças graves e invalidez pagam EM VIDA — desmonta o "só serve se eu morrer".',
      'Reforce: o seguro não substitui o patrimônio, ele impede que seja consumido.',
    ],
    perguntas: [
      'Você sabia que o seguro paga em vida no diagnóstico de uma doença grave?',
    ],
  },
  {
    id: 'solucao',
    titulo: 'Solução — a apresentação do estudo',
    objetivo: 'Mostrar a proposta sob medida. Aqui o número faz sentido porque veio das dores dele.',
    tempo: '10 min',
    falas: [
      'Abra a proposta (botão "Gerar proposta") e conduza slide a slide.',
      'Ancore no que ele disse: "lembra que você falou da faculdade da Alice? É isso aqui".',
      'Chegue no investimento por último — depois do valor, o preço parece pequeno.',
    ],
    perguntas: [
      'Faz sentido para você o que esse plano protege?',
      'Tem alguma parte que você gostaria que eu explicasse melhor?',
    ],
    dica: 'Envie a proposta pelo link (botão "Enviar ao cliente") para ele rever em casa.',
  },
  {
    id: 'fechamento',
    titulo: 'Fechamento e próximos passos',
    objetivo: 'Conduzir à decisão e deixar o caminho claro. Um "sim" sem próximo passo esfria.',
    tempo: '10 min',
    falas: [
      'Trate objeções com perguntas, não com defesas ("o que te deixaria seguro?").',
      'Combine o próximo passo concreto: preencher a DPS pelo link.',
      'Defina data de retorno e registre tudo nas anotações.',
    ],
    perguntas: [
      'O que falta para você começar a proteger sua família ainda esse mês?',
      'Podemos já deixar a declaração de saúde encaminhada?',
    ],
    dica: 'Gere o link do formulário (aba Formulário) e envie pelo WhatsApp na hora.',
  },
]
