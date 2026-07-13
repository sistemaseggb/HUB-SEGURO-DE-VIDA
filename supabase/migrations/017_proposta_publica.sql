-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 017: Proposta por link público
--
-- A proposta deixa de ser só uma apresentação de reunião: cada planejamento
-- ganha um token e a rota pública /p/<token> mostra os slides para o CLIENTE,
-- sem login — a consultora copia o link (ou manda direto pelo WhatsApp) e o
-- cliente revê o estudo em casa, no celular, na hora de decidir.
--
-- Segurança no mesmo padrão do formulário público (migração 002):
--   • o acesso anônimo NÃO lê a tabela — só a função RPC security definer;
--   • o token é um uuid aleatório: sem ele, nada aparece;
--   • a função expõe apenas o planejamento e o primeiro nome do cliente
--     (nenhum telefone, e-mail ou dado de outros clientes).
--
-- Como usar: rode APÓS a 016, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  add column if not exists token_proposta uuid not null default gen_random_uuid();

create unique index if not exists idx_planejamentos_token_proposta
  on public.planejamentos (token_proposta);

comment on column public.planejamentos.token_proposta is
  'Token do link público da proposta (/p/<token>) — o cliente vê os slides sem login';

create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*, c.nome as cliente_nome
    into r
    from public.planejamentos p
    join public.clientes c on c.id = p.id_cliente
   where p.token_proposta = p_token;

  if not found then
    return jsonb_build_object('erro', 'proposta_nao_encontrada');
  end if;

  return jsonb_build_object(
    'cliente_nome', r.cliente_nome,
    -- o plano inteiro, menos os identificadores internos
    'plano', to_jsonb(r) - 'cliente_nome' - 'id' - 'id_cliente' - 'token_proposta'
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;
