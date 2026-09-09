// Executa as migrações de correção em PostgreSQL local (PGlite).
// Tabelas mínimas isolam o contrato das RPCs; não substitui staging Supabase.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create type public.status_formulario as enum ('pendente', 'em_andamento', 'concluido');
    create table public.formularios_onboarding (
      id uuid primary key, id_cliente uuid, token uuid unique,
      status status_formulario default 'pendente', respostas jsonb,
      etapa_atual int, concluido_em timestamptz
    );
    create table public.formularios_planejamento (like public.formularios_onboarding including all);
    alter table public.formularios_planejamento add column aplicado_em timestamptz, add column erro_aplicacao text;
    create table public.tarefas (id_cliente uuid, titulo text, tipo text, automatica boolean);
    create table public.aplicacoes (id_cliente uuid, respostas jsonb);
  `)
  const permissoes = readFileSync('supabase/migrations/031_permissoes_rpc_internas.sql', 'utf8')
  const assinaturas = [...permissoes.matchAll(/revoke all on function (.*?) from/g)].map(m => m[1])
  // Dependências preexistentes; o conteúdo de negócio é testado nas suítes do motor.
  for (const assinatura of assinaturas) {
    await db.exec(`create function ${assinatura} returns void language sql as $$ select $$;`)
  }
  await db.exec(`create or replace function public.fn_plan_aplicar(uuid, jsonb)
    returns void language sql as $$ insert into public.aplicacoes values ($1, $2) $$;
    grant execute on all functions in schema public to anon, authenticated, service_role;`)
  await db.exec(readFileSync('supabase/migrations/030_formularios_concorrencia.sql', 'utf8'))
  await db.exec(permissoes)
  // Reaplicar precisa continuar seguro.
  await db.exec(readFileSync('supabase/migrations/030_formularios_concorrencia.sql', 'utf8'))
  await db.exec(permissoes)
  for (const assinatura of assinaturas) {
    const { rows } = await db.query('select has_function_privilege($1, $2, $3) as permitido', ['anon', assinatura, 'EXECUTE'])
    assert.equal(rows[0].permitido, false, assinatura)
  }
  const permitido = await db.query("select has_function_privilege('authenticated', 'public.fn_vincular_evento(uuid,uuid)', 'EXECUTE') as ok")
  assert.equal(permitido.rows[0].ok, true)
  console.log('✓ Migrações reaplicáveis; RPCs internas bloqueadas para anon; vínculo autenticado preservado')

  const cliente = '00000000-0000-4000-8000-000000000001'
  const token = '00000000-0000-4000-8000-000000000002'
  for (const [tabela, funcao] of [['formularios_onboarding', 'fn_form_salvar'], ['formularios_planejamento', 'fn_plan_salvar']]) {
    await db.query(`insert into public.${tabela}(id, id_cliente, token) values ($1,$1,$2)`, [cliente, token])
    const chamar = (respostas, fim) => db.query(`select public.${funcao}($1, $2::jsonb, 1, $3) as resposta`, [token, JSON.stringify(respostas), fim])
    assert.equal((await chamar({ renda: 100 }, false)).rows[0].resposta.ok, true)
    assert.equal((await chamar({ renda: 200 }, true)).rows[0].resposta.ok, true)
    assert.ok((await chamar({ renda: 1 }, false)).rows[0].resposta.erro)
    assert.ok((await chamar({ renda: 1 }, true)).rows[0].resposta.erro)
    const { rows } = await db.query(`select status, respostas from public.${tabela}`)
    assert.equal(rows[0].status, 'concluido')
    assert.deepEqual(rows[0].respostas, { renda: 200 })
    console.log(`✓ ${funcao}: conclusão preservada, autosave tardio e reenvio rejeitados`)
  }
  assert.equal((await db.query('select count(*)::int as n from public.tarefas')).rows[0].n, 2)
  assert.equal((await db.query('select count(*)::int as n from public.aplicacoes')).rows[0].n, 1)
  console.log('✓ Uma tarefa por formulário e uma aplicação do planejamento')
} finally {
  await db.close()
}
