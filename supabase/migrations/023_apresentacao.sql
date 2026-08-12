-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 023: A apresentação que interage
--
-- A consultora apresenta pelo iPad, compartilhando a tela na reunião. Até aqui
-- a proposta era um deck: bonito, correto e MUDO. Ela passava slide, o cliente
-- assistia, e a conversa acontecia apesar da tela, não por causa dela.
--
-- Uma reunião de seguro de vida não é uma palestra. É um cliente perguntando
-- "e se fosse mil e duzentos?", é a consultora circulando um número com a
-- canetinha e dizendo "é ESTE aqui que muda tudo", é riscar o que não importa
-- para sobrar o que importa. Nada disso cabe num deck.
--
-- O que esta migração guarda:
--
--   ANOTAÇÕES POR SLIDE
--   O que ela desenha por cima de cada capítulo, guardado por cliente. Ela
--   reabre a proposta uma semana depois e o círculo que fez em volta do
--   déficit de liquidez ainda está lá — junto com a conversa que ele sustentou.
--
--   Os traços são gravados em coordenadas RELATIVAS (0 a 1) ao slide, não em
--   pixels: o mesmo desenho feito no iPad em pé aparece certo no iPad deitado,
--   no computador da consultora e no celular do cliente. Guardar pixel seria
--   guardar o desenho de um aparelho só.
--
--   A chave é o NOME do slide ('sucessao', 'cruzamento'), não a posição. Um
--   cliente que ganha o capítulo da empresa empurraria todos os índices para
--   frente, e as anotações apareceriam no capítulo errado — que é pior do que
--   não ter anotação nenhuma.
--
-- O que NÃO entra no banco: as simulações que ela faz durante a conversa
-- ("e se fosse R$ 1.200?"). Elas são de propósito temporárias — o planejamento
-- continua sendo a fonte da verdade, e um número mexido no calor da reunião
-- não pode virar o estudo sem ela decidir isso na aba Planejamento.
--
-- Como usar: rode APÓS a 022, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

alter table public.planejamentos
  -- { "sucessao": [ {t, c, l, p:[x,y,pr, x,y,pr, …]}, … ], "cruzamento": [ … ] }
  --   t  = tipo do traço (caneta | marcador)
  --   c  = cor  ·  l = calibre (fração da menor dimensão do slide)
  --   p  = pontos em trincas: x, y em coordenadas relativas 0..1 e a pressão
  --        da Apple Pencil naquele ponto (0..1), que dá a espessura viva do
  --        traço. Sem a pressão, o desenho denuncia na hora que não saiu de
  --        uma caneta de verdade.
  add column if not exists anotacoes_proposta jsonb not null default '{}'::jsonb;

comment on column public.planejamentos.anotacoes_proposta is
  'Desenhos da consultora sobre os slides, por nome de slide. Pontos em coordenadas relativas 0..1 para funcionar em qualquer tela.';

-- A proposta pública precisa mostrar as anotações: se o cliente abre o link
-- depois da reunião e vê um slide limpo, ele perde exatamente a parte que foi
-- explicada para ele.
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
    -- o plano inteiro, menos os identificadores internos
    'plano', to_jsonb(r) - 'cliente_nome' - 'cliente_idade'
             - 'id' - 'id_cliente' - 'token_proposta'
  );
end;
$$;

revoke all on function public.fn_proposta_carregar(uuid) from public;
grant execute on function public.fn_proposta_carregar(uuid) to anon, authenticated;
