import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
const arquivos = readdirSync('supabase/migrations')
  .filter((f) => /^(032|033|034|035|036)_/.test(f))
  .sort()
const preflight = `-- Atualização para instalação existente com migrações 001–031.
-- Faça backup e teste em staging antes. Execute o arquivo inteiro de uma vez.
-- O lote é atômico: qualquer erro desfaz todas as mudanças deste arquivo.
begin;
do $preflight$ begin
 if to_regprocedure('public.fn_plan_aplicar(uuid,jsonb)') is null
 or to_regclass('public.transcricoes') is null
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='planejamentos' and column_name='condicoes_declaradas') then
 raise exception 'Esta instalação precisa concluir as migrações 001–031 antes desta atualização'; end if;
 if not exists(select 1 from auth.users) then raise exception 'Crie a conta administrativa no Supabase antes da atualização'; end if;
end $preflight$;
`
const corpo = arquivos
  .map(
    (f) =>
      '\n-- ' +
      f +
      '\n' +
      readFileSync('supabase/migrations/' + f, 'utf8')
        .replace(/^begin;\s*$/im, '')
        .replace(/^commit;\s*$/im, '')
        .trim(),
  )
  .join('\n')
writeFileSync('supabase/atualizacao_consultoria.sql', preflight + corpo + '\ncommit;\n')
console.log('Gerado supabase/atualizacao_consultoria.sql (' + arquivos.length + ' migrações)')
