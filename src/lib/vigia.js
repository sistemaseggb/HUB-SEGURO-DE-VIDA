// ─────────────────────────────────────────────────────────────────────────────
// O VIGIA DAS CONSULTAS — nenhuma falha de banco passa despercebida.
//
// ── O defeito que este arquivo existe para matar ─────────────────────────────
//
// O sistema faz 161 consultas ao banco espalhadas pelas telas, e a esmagadora
// maioria está escrita assim:
//
//     supabase.from('apolices').select('*').then(({ data }) => setApolices(data ?? []))
//
// O `error` é ignorado. Quando a consulta falha — rede caindo no meio da
// reunião, sessão expirada, política de acesso, coluna que ainda não existe —
// `data` vem nulo e a tela mostra uma LISTA VAZIA. Do lado de cá, isso é
// indistinguível de "este cliente não tem apólice nenhuma".
//
// Num CRM de seguros isso não é um incômodo: é a consultora abrindo o cliente
// na frente dele e dizendo "você não tem cobertura hoje" quando tem. Ou o
// contrário: o fechamento do mês some do relatório e ela acha que não vendeu.
//
// A outra metade do mesmo defeito são as telas que fazem `setCfg(data)` sem o
// `?? []`: ali a falha vira um SPINNER ETERNO, e a tela nunca carrega.
//
// ── Por que aqui e não em cada tela ─────────────────────────────────────────
//
// Corrigir 161 lugares à mão seria um mês de trabalho, quebraria coisa no
// caminho e não protegeria a consulta 162. O cliente do Supabase é exportado
// de um lugar só (`supabase.js`), então basta observá-lo ali: cada consulta
// continua funcionando exatamente como antes, e quando o resultado traz
// `error`, o vigia avisa quem estiver ouvindo.
//
// O vigia NÃO engole, NÃO reescreve e NÃO atrasa resultado nenhum. Ele só
// observa de passagem. Se ele quebrasse, quebraria o sistema inteiro — por
// isso é pequeno, tem teste próprio e devolve o objeto original em todo
// caminho que não seja `then`.
// ─────────────────────────────────────────────────────────────────────────────

const ouvintes = new Set()

export function aoFalharConsulta(fn) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

// Erros que NÃO são defeito e não podem virar aviso na tela:
//
//   PGRST116  `.single()` sem encontrar linha. Metade das telas usa isso de
//             propósito para perguntar "existe?" — avisar aqui encheria a tela
//             de alarme falso a cada cliente novo.
//   42703 / 42P01  coluna ou tabela que ainda não existe. O sistema detecta
//             migração por sondagem (`'coluna' in plano`), e essas consultas
//             falhando é o mecanismo funcionando, não quebrando.
//   PGRST202  função RPC ausente — mesma história.
const ESPERADOS = new Set(['PGRST116', 'PGRST202', '42703', '42P01', '42883'])

export function falhaEsperada(erro) {
  if (!erro) return true
  if (ESPERADOS.has(erro.code)) return true
  // o Supabase às vezes só manda a mensagem
  return /does not exist|no rows|not found/i.test(erro.message ?? '')
}

// Uma falha de banco tem três causas com CONSERTOS DIFERENTES, e mandar a
// mensagem errada faz a pessoa caçar o problema errado. Dizer "verifique a
// conexão" para quem só precisa entrar de novo é pior do que não dizer nada.
export function tipoDaFalha(erro) {
  const codigo = String(erro?.code ?? '')
  const msg = String(erro?.message ?? '')
  if (codigo === 'PGRST301' || /jwt|token|expired|not authenticated/i.test(msg)) return 'sessao'
  if (codigo === '42501' || /permission denied|row-level security|violates row/i.test(msg)) return 'permissao'
  if (/failed to fetch|networkerror|load failed|timeout|aborted/i.test(msg)) return 'rede'
  return 'banco'
}

export const MENSAGEM_FALHA = {
  sessao: 'Sua sessão expirou. Entre de novo para continuar — o que estava na tela pode estar desatualizado.',
  permissao: 'Sem permissão para ler estes dados. A tela pode estar mostrando menos do que existe.',
  rede: 'Sem conexão com o servidor. O que está na tela pode estar incompleto.',
  banco: 'O servidor recusou a consulta. O que está na tela pode estar incompleto.',
}

function avisar(contexto, erro) {
  if (falhaEsperada(erro)) return
  // O console guarda o detalhe técnico; a tela recebe só o que dá para agir.
  console.error(`[Hub] falha em ${contexto}:`, erro)
  const tipo = tipoDaFalha(erro)
  for (const fn of ouvintes) {
    try { fn({ contexto, erro, tipo, mensagem: MENSAGEM_FALHA[tipo] }) } catch { /* um ouvinte torto não derruba o resto */ }
  }
}

// Um construtor de consulta do Supabase (e o da demonstração) é um objeto
// "thenable": encadeia métodos devolvendo a si mesmo e só executa no `await`.
// Envolvemos os dois pontos: o encadeamento, para o embrulho não se perder no
// meio, e o `then`, que é onde o resultado finalmente aparece.
function envolver(alvo, contexto) {
  const proxy = new Proxy(alvo, {
    get(obj, prop) {
      // `obj` como receptor (e não o proxy): getters internos do Supabase usam
      // `this` e quebrariam com "Illegal invocation" se recebessem o proxy
      const valor = Reflect.get(obj, prop, obj)

      if (prop === 'then') {
        return (aoOk, aoErro) => Promise.resolve(valor.call(obj, (r) => r))
          .then((r) => {
            if (r && typeof r === 'object' && r.error) avisar(contexto, r.error)
            return r
          })
          .then(aoOk, aoErro)
      }

      if (typeof valor !== 'function') return valor

      return (...args) => {
        const r = valor.apply(obj, args)
        // encadeamento devolve o próprio construtor: seguimos embrulhados
        if (r === obj) return proxy
        // alguns métodos devolvem um construtor NOVO (ex.: `.select()` depois
        // de `.insert()`). Promessa nativa fica de fora — ela já terminou, e
        // embrulhá-la avisaria duas vezes pelo mesmo erro.
        if (r && typeof r === 'object' && typeof r.then === 'function' && !(r instanceof Promise)) {
          return envolver(r, contexto)
        }
        return r
      }
    },
  })
  return proxy
}

// Devolve o mesmo cliente, com `from` e `rpc` observados. Storage e auth ficam
// de fora de propósito: são poucos pontos, cada um com o seu tratamento
// próprio escrito à mão, e uma falha de upload já tem mensagem específica.
export function vigiar(cliente) {
  return new Proxy(cliente, {
    get(obj, prop) {
      const valor = Reflect.get(obj, prop, obj)
      // A checagem de tipo não é zelo à toa: um cliente sem `rpc` (uma versão
      // futura, um duble de teste) derrubaria o sistema inteiro aqui dentro.
      if (prop === 'from' && typeof valor === 'function') {
        return (tabela) => envolver(valor.call(obj, tabela), tabela)
      }
      if (prop === 'rpc' && typeof valor === 'function') {
        return (nome, ...args) => envolver(valor.call(obj, nome, ...args), `função ${nome}`)
      }
      return typeof valor === 'function' ? valor.bind(obj) : valor
    },
  })
}
