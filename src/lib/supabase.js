import { createClient } from '@supabase/supabase-js'
import { criarSupabaseDemo } from './demoDb'

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

export const supabase = MODO_DEMO
  ? criarSupabaseDemo()
  : createClient(supabaseUrl, supabaseAnonKey)
