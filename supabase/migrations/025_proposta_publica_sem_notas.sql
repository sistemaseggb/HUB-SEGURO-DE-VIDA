-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 025: o cliente não pode ler as anotações dela
--
-- ── O vazamento ─────────────────────────────────────────────────────────────
--
-- A proposta pública (`/p/<token>`) carrega pela RPC `fn_proposta_carregar`,
-- que devolvia o planejamento INTEIRO menos três identificadores:
--
--     'plano', to_jsonb(r) - 'id' - 'id_cliente' - 'token_proposta'
--
-- Junto iam quatro campos que são a consultora falando consigo mesma:
--
--   observacoes_reuniao  "Preocupado com sucessão da clínica. Esposa não
--                         trabalha fora. Quer revisar previdência no 2º sem."
--   roteiro              as notas por bloco da reunião — "Muito receptivo",
--                         "Esposa não trabalha fora"
--   quem_decide          a leitura dela sobre quem manda na decisão
--   prazo_decisao        "Quer decidir até o fim do mês"
--
-- A tela nunca mostrou nada disso. Mas o dado ia inteiro para o navegador do
-- cliente, e qualquer um que abrisse o inspetor lia tudo.
--
-- O `prazo_decisao` é o pior: é a urgência dele nas palavras dela — uma
-- posição de negociação entregue para o outro lado da mesa.
--
-- ── A correção, e por que ela é feita assim ─────────────────────────────────
--
-- A lista de campos que NÃO saem fica explícita e nomeada. É uma lista de
-- exclusão, não de inclusão, por um motivo prático: das 74 colunas do
-- planejamento, 65 são dados do próprio cliente que a proposta precisa
-- mostrar, e várias são lidas dinamicamente pelo catálogo de coberturas. Uma
-- lista de inclusão teria que ser atualizada a cada cobertura nova, e quando
-- alguém esquecesse, o slide simplesmente sumiria — em silêncio.
--
-- O que protege contra o esquecimento não é a forma da lista: é o teste
-- `scripts/teste-proposta-publica.mjs`, que FIXA o conjunto exato de chaves
-- que a proposta pública devolve. Qualquer coluna nova quebra o teste e
-- obriga uma decisão consciente sobre de que lado ela fica.
--
-- REGRA para quem mexer aqui depois: se a coluna guarda o que a CONSULTORA
-- pensa (nota, leitura, avaliação, estratégia), ela entra nesta lista. Se
-- guarda o que o CLIENTE tem ou quer, ela sai na proposta.
--
-- Como usar: rode APÓS a 024, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*,
         c.nome as cliente_nome,
         case
           when c.data_nascimento is null then null
           else extract(year from age(current_date, c.data_nascimento))::int
         end as cliente_idade
    into r
    from public.planejamentos p
    join public.clientes c on c.id = p.id_cliente
   where p.token_proposta = p_token;

  if not found then
    return jsonb_build_object('erro', 'proposta_nao_encontrada');
  end if;

  return jsonb_build_object(
    'cliente_nome', r.cliente_nome,
    'cliente_idade', r.cliente_idade,
    'plano', to_jsonb(r)
             -- identificadores internos
             - 'cliente_nome' - 'cliente_idade'
             - 'id' - 'id_cliente' - 'token_proposta'
             - 'created_at' - 'updated_at'
             -- ── O QUE A CONSULTORA ANOTOU PARA SI ─────────────────────────
             -- Nada aqui pode chegar ao navegador do cliente.
             - 'observacoes_reuniao'   -- notas dela sobre a reunião
             - 'roteiro'               -- o roteiro com as notas de cada bloco
             - 'quem_decide'           -- a leitura dela sobre quem decide
             - 'prazo_decisao'         -- a urgência dele, nas palavras dela
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;

comment on function public.fn_proposta_carregar(uuid) is
  'Proposta pública por token. NÃO devolve observacoes_reuniao, roteiro, quem_decide nem prazo_decisao — são anotações da consultora, não do cliente.';
