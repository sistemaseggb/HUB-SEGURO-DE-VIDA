-- ─────────────────────────────────────────────────────────────────────────────
-- 028 — O CLIENTE PERDIA TRÊS CAPÍTULOS AO ABRIR O PRÓPRIO LINK
--
-- A proposta pública (/p/<token>) existe para o cliente rever o estudo em casa
-- e mostrar para a família. A tela sempre leu `cliente_idade` da resposta desta
-- função — e a função nunca devolveu esse campo. Ninguém percebeu porque nada
-- quebra: a proposta abre bonita, só que MENOR.
--
-- Sem a idade, três capítulos simplesmente não são montados, e são justamente
-- os três que trabalham quando a consultora não está na sala:
--
--   · AS TRÊS FORMAS DE FAZER — a escada de planos, que troca a pergunta
--     "aceita?" por "qual dos três?". É o capítulo que o cliente reabre quando
--     senta com o cônjuge para decidir.
--   · O CUSTO DA ESPERA — quanto a mesma apólice custa daqui a 1, 3 e 5 anos.
--     É a resposta ao "depois eu vejo", e "depois" é exatamente o que acontece
--     entre a reunião e a releitura em casa.
--   · APOSENTADORIA — para quem veio por esse motivo, o capítulo do próprio
--     motivo dele.
--
-- Os três dependem da idade porque prêmio de risco é idade. A função passa a
-- devolvê-la calculada (nunca a data de nascimento em si, que não faz falta
-- nenhuma na tela), e o link do cliente volta a mostrar o estudo inteiro.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_proposta_carregar(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select p.*, c.nome as cliente_nome,
         -- idade em anos completos; nulo quando o cadastro não tem a data
         case when c.data_nascimento is null then null
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
    -- o plano inteiro, menos os identificadores internos
    'plano', to_jsonb(r) - 'cliente_nome' - 'cliente_idade' - 'id' - 'id_cliente' - 'token_proposta'
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;
