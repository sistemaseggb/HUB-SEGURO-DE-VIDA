import { createClient } from '@supabase/supabase-js'
import { criarSupabaseDemo } from './demoDb.js'
import { vigiar } from './vigia.js'

// As credenciais vêm do arquivo .env (nunca commitado no git).
// Use SEMPRE a chave "anon / publishable" aqui — jamais a secret key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// MODO DEMONSTRAÇÃO: sem credenciais (ou com VITE_DEMO=1), o Hub roda com um
// banco simulado e dados fictícios — perfeito para apresentar o sistema a
// interessados e treinar usuários sem tocar em dados reais. Nada é salvo.
export const MODO_DEMO = import.meta.env.VITE_DEMO === '1' || !supabaseUrl || !supabaseAnonKey

if (MODO_DEMO) {
  console.info('[Hub] Rodando em MODO DEMONSTRAÇÃO — dados fictícios, nada é persistido.')
}

// O cliente sai daqui já OBSERVADO. As telas continuam escrevendo consulta
// como sempre — a maioria ignorando o `error`, porque tratar 161 lugares à mão
// seria irreal — e o vigia converte cada falha silenciosa num aviso na tela.
// Sem ele, uma consulta que falha vira "este cliente não tem apólice".
// Detalhes e a lista do que NÃO é defeito: `vigia.js`.
export const supabase = vigiar(MODO_DEMO
  ? criarSupabaseDemo()
  : createClient(supabaseUrl, supabaseAnonKey))
