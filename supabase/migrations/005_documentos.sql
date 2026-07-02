-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 005: Documentos e Anexos
--
-- Guarda arquivos por cliente (apólice em PDF, documentos, propostas...).
-- Os arquivos ficam no Storage do Supabase (bucket privado "documentos");
-- esta tabela guarda os metadados e o vínculo com o cliente.
--
-- Como usar: rode APÓS as migrações 001–004.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELA DE METADADOS DOS DOCUMENTOS
-- ----------------------------------------------------------------------------

create table public.documentos (
  id             uuid primary key default gen_random_uuid(),
  id_cliente     uuid not null references public.clientes(id) on delete cascade,
  nome           text not null,                    -- nome original do arquivo
  categoria      text not null default 'geral',    -- 'apolice' | 'documento' | 'proposta' | 'geral'
  caminho        text not null,                    -- caminho do arquivo no Storage
  tamanho_bytes  bigint,
  tipo_mime      text,
  created_at     timestamptz not null default now()
);

create index idx_documentos_cliente on public.documentos (id_cliente);

alter table public.documentos enable row level security;
create policy "acesso_total_autenticado" on public.documentos
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 2. BUCKET DE STORAGE + POLÍTICAS (específico do Supabase)
--    Envolvido em bloco protegido: se o schema "storage" não existir (ex.: ao
--    testar em Postgres puro) ou as políticas já existirem, apenas avisa.
-- ----------------------------------------------------------------------------

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('documentos', 'documentos', false)
  on conflict (id) do nothing;

  execute $p$ create policy "hub_docs_select" on storage.objects
             for select to authenticated using (bucket_id = 'documentos') $p$;
  execute $p$ create policy "hub_docs_insert" on storage.objects
             for insert to authenticated with check (bucket_id = 'documentos') $p$;
  execute $p$ create policy "hub_docs_delete" on storage.objects
             for delete to authenticated using (bucket_id = 'documentos') $p$;

  raise notice 'Bucket "documentos" e políticas de acesso criados.';
exception
  when duplicate_object then
    raise notice 'Políticas de storage já existiam — ok.';
  when others then
    raise notice 'Storage indisponível aqui (%). No Supabase real isso funciona; se precisar, crie o bucket privado "documentos" pelo painel Storage.', sqlerrm;
end $$;
