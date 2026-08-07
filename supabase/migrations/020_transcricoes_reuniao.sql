-- ============================================================================
-- HUB SEGURO DE VIDA — Migração 020: Transcrições de reunião
--
-- A consultora grava as reuniões com o Tactiq (extensão do Meet/Zoom) e sai de
-- cada encontro com uma transcrição inteira. Até aqui isso morria num arquivo
-- de texto: ninguém relê 40 minutos de conversa antes da próxima reunião.
--
-- Esta tabela guarda a transcrição junto do cliente e, ao lado dela, a ANÁLISE
-- já processada (coluna `analise`, jsonb). A análise é o que dá valor:
--
--   • resumo executivo e os momentos que decidiram a conversa;
--   • quanto a consultora falou e quanto o cliente falou (numa reunião
--     consultiva, quem mais fala é o cliente);
--   • os números que o cliente disse em voz alta — renda, custo de vida,
--     patrimônio, dívidas, idade dos filhos — prontos para aplicar no
--     planejamento sem redigitar nada;
--   • objeções levantadas, com a resposta sugerida para cada uma;
--   • sinais de compra e o nível de temperatura da oportunidade;
--   • quais blocos do roteiro foram cobertos e quais ficaram de fora;
--   • os compromissos assumidos, que viram tarefas com um clique.
--
-- O texto original fica guardado: a análise pode ser refeita a qualquer
-- momento quando o motor melhorar, sem pedir o arquivo de novo.
--
-- Como usar: rode APÓS a 019, colando o arquivo inteiro no SQL Editor.
-- ============================================================================

create table if not exists public.transcricoes (
  id           uuid primary key default gen_random_uuid(),
  id_cliente   uuid not null references public.clientes(id) on delete cascade,
  id_reuniao   uuid references public.reunioes(id) on delete set null,
  titulo       text,
  data_reuniao date not null default current_date,
  origem       text not null default 'tactiq',
  texto        text not null,
  analise      jsonb not null default '{}'::jsonb,
  resumo       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_transcricoes_cliente on public.transcricoes (id_cliente);
create index if not exists idx_transcricoes_data    on public.transcricoes (data_reuniao desc);

comment on table public.transcricoes is
  'Transcrições de reunião (Tactiq, Meet, Zoom ou colagem manual) com a análise já processada';
comment on column public.transcricoes.origem is
  'tactiq | meet | zoom | manual — de onde veio o texto';
comment on column public.transcricoes.texto is
  'Transcrição original, preservada para reprocessar a análise quando o motor melhorar';
comment on column public.transcricoes.analise is
  'Análise estruturada: falantes e tempo de fala, dados financeiros e de família extraídos, objeções, sinais de compra, cobertura do roteiro, compromissos e pontuação da reunião';
comment on column public.transcricoes.resumo is
  'Resumo executivo em texto, pronto para colar nas notas da reunião ou enviar ao cliente';

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_transcricoes_updated_at'
  ) then
    create trigger trg_transcricoes_updated_at
      before update on public.transcricoes
      for each row execute function public.fn_touch_updated_at();
  end if;
end $$;

alter table public.transcricoes enable row level security;

drop policy if exists "acesso_total_autenticado" on public.transcricoes;
create policy "acesso_total_autenticado" on public.transcricoes
  for all to authenticated using (true) with check (true);
