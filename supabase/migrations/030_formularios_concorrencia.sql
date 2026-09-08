-- Migração 030: serializa gravações por formulário para impedir reabertura e tarefas duplicadas.

-- Aplicar após a 029. Mantém assinaturas e permissões das RPCs.

create or replace function public.fn_form_salvar(
  p_token uuid,
  p_respostas jsonb,
  p_etapa int,
  p_concluido boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cliente uuid;
begin
  select id, id_cliente into v_id, v_cliente
    from public.formularios_onboarding
   where token = p_token and status <> 'concluido' for update;

  if not found then
    return jsonb_build_object('erro', 'formulario_nao_encontrado_ou_concluido');
  end if;

  update public.formularios_onboarding
     set respostas   = p_respostas,
         etapa_atual = p_etapa,
         status      = case when p_concluido then 'concluido'::public.status_formulario
                            else 'em_andamento'::public.status_formulario end,
         concluido_em = case when p_concluido then now() else null end
   where id = v_id;

  -- Automação: formulário concluído gera tarefa de conferência para a Natália
  if p_concluido then
    insert into public.tarefas (id_cliente, titulo, tipo, automatica)
    values (v_cliente,
            'Conferir formulário preenchido e emitir apólice na seguradora',
            'formulario', true);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.fn_plan_salvar(
  p_token uuid,
  p_respostas jsonb,
  p_etapa int,
  p_concluido boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cliente uuid;
  v_erro text;
begin
  select id, id_cliente into v_id, v_cliente
    from public.formularios_planejamento
   where token = p_token and status <> 'concluido' for update;

  if not found then
    return jsonb_build_object('erro', 'planejamento_nao_encontrado_ou_concluido');
  end if;

  -- Salva SEMPRE, e primeiro. O que o cliente digitou não pode depender de a
  -- aplicação no estudo dar certo.
  update public.formularios_planejamento
     set respostas    = coalesce(p_respostas, '{}'::jsonb),
         etapa_atual  = greatest(coalesce(p_etapa, 0), 0),
         status       = case when p_concluido then 'concluido'::public.status_formulario
                             else 'em_andamento'::public.status_formulario end,
         concluido_em = case when p_concluido then now() else null end
   where id = v_id;

  if not p_concluido then
    return jsonb_build_object('ok', true);
  end if;

  -- ── Conclusão: as respostas viram planejamento ───────────────────────────
  -- Se algo der errado aqui, o formulário continua salvo e concluído: só o
  -- estudo fica para ser conferido à mão, com o motivo registrado. Perder as
  -- respostas de um cliente que preencheu vinte minutos de formulário é o
  -- único desfecho inaceitável.
  begin
    perform public.fn_plan_aplicar(v_cliente, coalesce(p_respostas, '{}'::jsonb));
    update public.formularios_planejamento
       set aplicado_em = now(), erro_aplicacao = null
     where id = v_id;
  exception when others then
    v_erro := sqlerrm;
    update public.formularios_planejamento
       set aplicado_em = null, erro_aplicacao = left(v_erro, 500)
     where id = v_id;
  end;

  insert into public.tarefas (id_cliente, titulo, tipo, automatica)
  values (v_cliente,
          case when v_erro is null
               then 'Planejamento preenchido pelo cliente: conferir os números e montar a proposta'
               else 'Planejamento preenchido pelo cliente NÃO foi aplicado ao estudo — conferir à mão'
          end,
          'planejamento', true);

  return jsonb_build_object('ok', true, 'aplicado', v_erro is null);
end;
$$;
