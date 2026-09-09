-- Migração 031: remove acesso anônimo às RPCs internas.
-- GRANT para authenticated não remove o EXECUTE padrão de PUBLIC.
revoke all on function public.fn_sync_evento_outlook(text, text, timestamptz, timestamptz, text, text[]) from public, anon;
revoke all on function public.fn_vincular_evento(uuid, uuid) from public, anon;
revoke all on function public.fn_plan_aplicar(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fn_plan_num(jsonb, text) from public, anon, authenticated;
revoke all on function public.fn_plan_int(jsonb, text, int, int) from public, anon, authenticated;
revoke all on function public.fn_plan_faixa(jsonb, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.fn_plan_txt(jsonb, text, int) from public, anon, authenticated;
revoke all on function public.fn_plan_opcao(jsonb, text, text[]) from public, anon, authenticated;
revoke all on function public.fn_plan_bool(jsonb, text) from public, anon, authenticated;
revoke all on function public.fn_plan_ids(jsonb, text, text[]) from public, anon, authenticated;
revoke all on function public.fn_plan_filhos(jsonb) from public, anon, authenticated;
revoke all on function public.fn_plan_seguros(jsonb) from public, anon, authenticated;
revoke all on function public.fn_plan_beneficiarios(jsonb) from public, anon, authenticated;
