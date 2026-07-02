// ============================================================================
// PONTE OUTLOOK → HUB  (Supabase Edge Function)
//
// Lê a agenda da Natália no Microsoft 365 (via Microsoft Graph) e envia cada
// reunião para o banco, que cuida de casar com o cliente certo.
// Mão única: Outlook → Hub. Roda sozinha (agendada) a cada poucos minutos.
//
// SEGREDOS (configurar em: Supabase → Edge Functions → sync-outlook → Secrets):
//   GRAPH_TENANT_ID       — ID do diretório (tenant) no Azure
//   GRAPH_CLIENT_ID       — ID do aplicativo registrado
//   GRAPH_CLIENT_SECRET   — segredo do aplicativo  (NUNCA vai para o frontend!)
//   SUPABASE_URL          — já disponível automaticamente
//   SUPABASE_SERVICE_ROLE_KEY — já disponível automaticamente
//
// Passo a passo de configuração: docs/INTEGRACAO_OUTLOOK.md
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH = 'https://graph.microsoft.com/v1.0'

// Pega um token de aplicativo no Microsoft (client credentials)
async function obterToken(): Promise<string> {
  const tenant = Deno.env.get('GRAPH_TENANT_ID')!
  const body = new URLSearchParams({
    client_id: Deno.env.get('GRAPH_CLIENT_ID')!,
    client_secret: Deno.env.get('GRAPH_CLIENT_SECRET')!,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) throw new Error(`Falha ao autenticar no Microsoft: ${await resp.text()}`)
  const json = await resp.json()
  return json.access_token
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Lê a configuração (qual caixa ler e se a sync está ligada)
    const { data: cfg } = await supabase
      .from('configuracoes')
      .select('outlook_email, outlook_sync_ativo')
      .eq('id', 1)
      .single()

    if (!cfg?.outlook_sync_ativo || !cfg?.outlook_email) {
      return json({ ok: true, ignorado: 'sincronização desativada ou e-mail não configurado' })
    }

    const token = await obterToken()

    // Janela: de 1 dia atrás até 60 dias à frente
    const agora = new Date()
    const inicio = new Date(agora.getTime() - 1 * 864e5).toISOString()
    const fim = new Date(agora.getTime() + 60 * 864e5).toISOString()

    // Busca os eventos da agenda da Natália
    let url =
      `${GRAPH}/users/${encodeURIComponent(cfg.outlook_email)}/calendarView` +
      `?startDateTime=${inicio}&endDateTime=${fim}` +
      `&$select=id,subject,start,end,organizer,attendees&$top=100&$orderby=start/dateTime`

    let processados = 0
    const resumo: Record<string, number> = { vinculada: 0, nova: 0 }

    while (url) {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="America/Sao_Paulo"',
        },
      })
      if (!resp.ok) throw new Error(`Graph erro ${resp.status}: ${await resp.text()}`)
      const page = await resp.json()

      for (const ev of page.value ?? []) {
        const emails: string[] = (ev.attendees ?? [])
          .map((a: any) => a?.emailAddress?.address)
          .filter(Boolean)
        if (ev.organizer?.emailAddress?.address) emails.push(ev.organizer.emailAddress.address)

        const { data: status } = await supabase.rpc('fn_sync_evento_outlook', {
          p_outlook_id: ev.id,
          p_assunto: ev.subject ?? '(sem assunto)',
          p_inicio: ev.start?.dateTime ? new Date(ev.start.dateTime + 'Z').toISOString() : new Date().toISOString(),
          p_fim: ev.end?.dateTime ? new Date(ev.end.dateTime + 'Z').toISOString() : null,
          p_organizador: ev.organizer?.emailAddress?.address ?? null,
          p_emails: emails,
        })
        if (status && resumo[status] !== undefined) resumo[status]++
        processados++
      }

      url = page['@odata.nextLink'] ?? ''
    }

    await supabase.from('configuracoes').update({ outlook_ultima_sync: new Date().toISOString() }).eq('id', 1)

    return json({ ok: true, processados, ...resumo })
  } catch (e) {
    console.error(e)
    return json({ ok: false, erro: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
