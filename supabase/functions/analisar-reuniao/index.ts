// ============================================================================
// ANÁLISE AVANÇADA DA REUNIÃO  (Supabase Edge Function — OPCIONAL)
//
// A aba Transcrição já entrega tudo que importa sem internet e sem chave: o
// motor local (src/lib/transcricao.js) separa falantes, extrai os números,
// detecta objeções e monta o resumo. Esta função é a CAMADA A MAIS: manda a
// transcrição para o Claude e volta com a leitura que só um humano experiente
// faria — o perfil do cliente, por que cada dor importa, a resposta sob medida
// para cada objeção e a mensagem de follow-up pronta para enviar.
//
// Se a chave não estiver configurada, a função responde 501 e a tela continua
// funcionando com a análise local. Nada quebra por falta dela.
//
// SEGREDO (Supabase → Edge Functions → analisar-reuniao → Secrets):
//   ANTHROPIC_API_KEY — chave da API da Anthropic (NUNCA vai para o frontend!)
//
// Publicar:  supabase functions deploy analisar-reuniao
// ============================================================================

import Anthropic from 'npm:@anthropic-ai/sdk@0.70.0'

// Transcrição de uma reunião de 1h costuma ter ~60 mil caracteres. O teto
// protege contra colagens acidentais gigantes (a janela do modelo aguenta bem
// mais; o limite aqui é de custo, não de capacidade).
const LIMITE_CARACTERES = 400_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// O formato exato que a tela sabe desenhar. Structured outputs garante que a
// resposta chega neste shape — sem parser tolerante, sem retry de JSON quebrado.
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'resumo', 'perfil_cliente', 'momentos_decisivos', 'dores', 'objecoes',
    'riscos', 'proximos_passos', 'argumentos_para_proposta', 'mensagem_whatsapp',
  ],
  properties: {
    resumo: {
      type: 'string',
      description: 'Resumo executivo da reunião em 3 a 5 frases, em português do Brasil.',
    },
    perfil_cliente: {
      type: 'string',
      description: 'Como este cliente decide: o que o move, o que o trava, que tom funciona com ele.',
    },
    momentos_decisivos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['citacao', 'por_que_importa'],
        properties: {
          citacao: { type: 'string', description: 'Frase do cliente, palavra por palavra.' },
          por_que_importa: { type: 'string', description: 'O que essa frase revela e como usá-la na proposta.' },
        },
      },
    },
    dores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dor', 'evidencia', 'como_enderecar'],
        properties: {
          dor: { type: 'string' },
          evidencia: { type: 'string', description: 'O trecho da conversa que sustenta essa leitura.' },
          como_enderecar: { type: 'string', description: 'Qual cobertura ou argumento resolve, e como apresentar.' },
        },
      },
    },
    objecoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['objecao', 'resposta_sugerida'],
        properties: {
          objecao: { type: 'string' },
          resposta_sugerida: {
            type: 'string',
            description: 'Resposta consultiva usando as palavras e o contexto deste cliente.',
          },
        },
      },
    },
    riscos: {
      type: 'array',
      items: { type: 'string' },
      description: 'O que pode fazer esta venda esfriar ou cair.',
    },
    proximos_passos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['acao', 'prazo_sugerido', 'por_que'],
        properties: {
          acao: { type: 'string' },
          prazo_sugerido: { type: 'string' },
          por_que: { type: 'string' },
        },
      },
    },
    argumentos_para_proposta: {
      type: 'array',
      items: { type: 'string' },
      description: 'Frases prontas para usar na apresentação, ancoradas no que o cliente disse.',
    },
    mensagem_whatsapp: {
      type: 'string',
      description: 'Mensagem de follow-up pronta para enviar hoje: curta, pessoal, com um próximo passo claro.',
    },
  },
}

const SISTEMA = `Você é consultor sênior de seguro de vida e planejamento sucessório no Brasil,
com vinte anos de carreira. Está lendo a transcrição de uma reunião conduzida por uma
consultora para prepará-la para o próximo passo.

Como trabalhar:
- Baseie cada afirmação em algo que foi realmente dito. Cite as palavras do cliente.
- Se a conversa não sustenta uma conclusão, diga que não sustenta em vez de inventar.
- Escreva em português do Brasil, direto, do jeito que um colega experiente falaria.
- Nada de jargão de vendas nem de frases motivacionais.
- Nas respostas às objeções, use o contexto específico deste cliente (nome dos filhos,
  a empresa, o inventário do pai) — resposta genérica não serve para nada.
- Na mensagem de WhatsApp: no máximo 4 linhas, tom de pessoa e não de robô, com um
  próximo passo concreto. Sem emoji em excesso.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'use POST' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    // 501 = "não implementado aqui": a tela cai na análise local sem alarde
    return json({
      erro: 'sem_chave',
      mensagem: 'ANTHROPIC_API_KEY não configurada. A análise local continua funcionando.',
    }, 501)
  }

  let corpo: { texto?: string; cliente_nome?: string; contexto?: string }
  try {
    corpo = await req.json()
  } catch {
    return json({ erro: 'corpo_invalido' }, 400)
  }

  const texto = String(corpo.texto ?? '').slice(0, LIMITE_CARACTERES)
  if (texto.trim().length < 200) {
    return json({ erro: 'transcricao_curta', mensagem: 'Transcrição curta demais para analisar.' }, 400)
  }

  const client = new Anthropic({ apiKey })

  try {
    const resposta = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // O modelo pode recusar por classificador de segurança; o fallback
      // recomendado resolve sozinho em vez de devolver erro para a consultora.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SISTEMA,
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: ESQUEMA },
      },
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: [
            corpo.cliente_nome ? `Cliente: ${corpo.cliente_nome}` : '',
            corpo.contexto ? `Contexto do planejamento já levantado: ${corpo.contexto}` : '',
            '',
            'Transcrição da reunião:',
            '---',
            texto,
            '---',
            '',
            'Analise a reunião e devolva a leitura no formato pedido.',
          ].filter(Boolean).join('\n'),
        }],
      }],
    })

    // Classificador recusou a conversa inteira (a cadeia de fallback também):
    // devolvemos isso explicitamente para a tela avisar e seguir com o local.
    if (resposta.stop_reason === 'refusal') {
      return json({
        erro: 'recusado',
        mensagem: 'O modelo não pôde analisar esta transcrição. A análise local continua disponível.',
      }, 422)
    }

    const bloco = resposta.content.find((b) => b.type === 'text')
    if (!bloco || bloco.type !== 'text') {
      return json({ erro: 'resposta_vazia' }, 502)
    }

    return json({ ok: true, analise: JSON.parse(bloco.text), modelo: resposta.model })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('analisar-reuniao:', msg)
    return json({ erro: 'falha_na_analise', mensagem: msg }, 502)
  }
})
