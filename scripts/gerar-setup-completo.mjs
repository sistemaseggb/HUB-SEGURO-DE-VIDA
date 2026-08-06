// Gera supabase/setup_completo.sql juntando TODAS as migrações na ordem.
// Rode depois de criar uma migração nova:  node scripts/gerar-setup-completo.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'supabase/migrations'
const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const cabecalho = `-- ============================================================================
-- HUB SEGURO DE VIDA — SETUP COMPLETO (arquivo único)
--
-- Este arquivo junta TODAS as ${arquivos.length} migrações na ordem certa. Rode UMA vez, num
-- projeto Supabase NOVO (vazio), colando tudo no SQL Editor e clicando em Run.
-- Cria todas as tabelas, o cálculo de comissão, o bucket de documentos e tudo
-- mais que o Hub precisa para funcionar.
--
-- Gerado automaticamente a partir de supabase/migrations/*.sql
-- ============================================================================

`

const corpo = arquivos.map((f) => [
  '',
  '-- ############################################################################',
  `-- ### ${f}`,
  '-- ####################################################################################',
  '',
  readFileSync(join(dir, f), 'utf8').trimEnd(),
  '',
].join('\n')).join('\n')

writeFileSync('supabase/setup_completo.sql', cabecalho + corpo + '\n')
console.log(`setup_completo.sql gerado com ${arquivos.length} migrações`)
