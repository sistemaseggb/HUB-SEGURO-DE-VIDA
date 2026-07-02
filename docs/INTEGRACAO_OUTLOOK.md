# Integração com a Agenda do Outlook (Microsoft 365)

Este guia conecta a **agenda da Natália** ao Hub. Quando um assessor marca uma
reunião e convida a Natália, o evento cai na agenda dela — e o Hub passa a
trazer essas reuniões automaticamente (mão única: Outlook → Hub).

Tudo é gratuito. A configuração inicial (passo 1) precisa de alguém com acesso
de **administrador do Microsoft 365** do escritório. Leva ~15 minutos, uma vez só.

---

## Como funciona (visão geral)

```
Assessor marca reunião no Outlook e convida a Natália
        │
        ▼
Agenda da Natália (Microsoft 365)
        │   (a cada ~15 min, a "ponte" lê a agenda)
        ▼
Ponte = Edge Function "sync-outlook" no Supabase
        │   (envia cada evento para o banco)
        ▼
Hub: cria a reunião e casa com o cliente
     - achou o cliente pelo e-mail? → cria a reunião e avança o funil sozinho
     - não achou? → vai para "Reuniões do Outlook a vincular" na Agenda
```

---

## Passo 1 — Registrar o aplicativo no Azure (admin do Microsoft 365)

1. Acesse **https://entra.microsoft.com** (Microsoft Entra / Azure AD) com a conta de administrador.
2. Menu **Identidade → Aplicativos → Registros de aplicativo → Novo registro**.
   - Nome: `Hub Seguros - Sync Agenda`
   - Contas com suporte: **Somente contas neste diretório organizacional**
   - Clique em **Registrar**.
3. Na página do app, anote (vamos usar no passo 3):
   - **ID do aplicativo (cliente)** → `GRAPH_CLIENT_ID`
   - **ID do diretório (locatário)** → `GRAPH_TENANT_ID`
4. Menu **Certificados e segredos → Novo segredo do cliente**.
   - Descrição: `hub-sync`; validade: 24 meses.
   - Clique em Adicionar e **copie o Valor** imediatamente → `GRAPH_CLIENT_SECRET`
     (ele só aparece uma vez!).
5. Menu **Permissões de API → Adicionar permissão → Microsoft Graph →
   Permissões de aplicativo** → procure e marque **`Calendars.Read`** → Adicionar.
6. Ainda em Permissões de API, clique em **Conceder consentimento do administrador**
   e confirme (a linha do Calendars.Read deve ficar verde).

### (Recomendado) Restringir o acesso a apenas a caixa da Natália

Por padrão a permissão acima daria acesso à agenda de todos. Para limitar só à
Natália, um admin roda no **PowerShell** (com o módulo Exchange Online):

```powershell
# 1) cria uma política restrita a um grupo de e-mails
New-ApplicationAccessPolicy -AppId <GRAPH_CLIENT_ID> `
  -PolicyScopeGroupId grupo-hub-agenda@empresa.com.br `
  -AccessRight RestrictAccess `
  -Description "Hub Seguros lê apenas as agendas deste grupo"
```
(coloque a Natália num grupo `grupo-hub-agenda@...` e adicione só ela.)

> Se preferir pular essa parte agora, a integração funciona igual — apenas com
> acesso mais amplo. Dá para restringir depois.

---

## Passo 2 — Publicar a "ponte" no Supabase

A ponte é a função em `supabase/functions/sync-outlook/index.ts` (já está no
repositório). Duas formas de publicar:

**Opção A — pelo painel (mais simples):**
1. Painel do Supabase → **Edge Functions → Create a new function** → nome `sync-outlook`.
2. Cole o conteúdo de `supabase/functions/sync-outlook/index.ts` e clique em **Deploy**.

**Opção B — pela linha de comando (Supabase CLI):**
```bash
supabase functions deploy sync-outlook
```

---

## Passo 3 — Configurar os segredos

Painel do Supabase → **Edge Functions → sync-outlook → Secrets** (ou
Project Settings → Edge Functions → Secrets). Adicione os três:

| Nome | Valor (do passo 1) |
|---|---|
| `GRAPH_TENANT_ID` | ID do diretório (locatário) |
| `GRAPH_CLIENT_ID` | ID do aplicativo (cliente) |
| `GRAPH_CLIENT_SECRET` | o **Valor** do segredo do cliente |

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente — não
> precisa adicionar. **Nunca** coloque o `GRAPH_CLIENT_SECRET` no frontend nem
> no `.env` do site.

---

## Passo 4 — Ligar no Hub e testar

1. No Hub, vá em **Cadastros → Integração com o Outlook**.
2. Preencha o **e-mail da Natália** (o mesmo do Microsoft 365) e marque
   **Sincronização ativada**. Clique em **Salvar**.
3. Clique em **Sincronizar agora**. Se aparecer "Sincronizado: N evento(s)",
   funcionou! As reuniões aparecem na **Agenda** (as que casaram com clientes) e
   as demais em **"Reuniões do Outlook a vincular"**.

---

## Passo 5 — Deixar automático (a cada 15 minutos)

Para a ponte rodar sozinha, agende-a com o **pg_cron + pg_net** (rode uma vez no
SQL Editor, trocando a URL e a chave):

```sql
-- Habilite as extensões (se ainda não): pg_cron e pg_net (Database → Extensions)

select cron.schedule(
  'hub-sync-outlook',
  '*/15 * * * *',   -- a cada 15 minutos
  $$
  select net.http_post(
    url     := 'https://SEU_PROJETO.supabase.co/functions/v1/sync-outlook',
    headers := jsonb_build_object(
      'Authorization', 'Bearer SUA_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

- `SEU_PROJETO` está na URL do Supabase.
- `SUA_SERVICE_ROLE_KEY`: Project Settings → API → service_role (secreta).

Pronto — a partir daí as reuniões marcadas no Outlook aparecem no Hub sozinhas.

---

## Perguntas comuns

**A Natália precisa fazer algo?** Não. Ela só marca/aceita reuniões no Outlook
como sempre. O Hub cuida do resto.

**E se o assessor não convidar o cliente (só a Natália)?** A reunião ainda vem
para o Hub, mas vai para "Reuniões do Outlook a vincular", onde a Natália
escolhe o cliente em 1 clique. Se o cliente for convidado (com o mesmo e-mail
cadastrado no Hub), o vínculo é automático.

**Reuniões que não são de cliente (dentista, interno)?** Ficam na caixa de
entrada; é só clicar no "X" para ignorar.

**Dá pra marcar no Hub e criar no Outlook (mão dupla)?** Sim, é possível numa
etapa futura — envolve permissão de escrita (`Calendars.ReadWrite`) e mais
cuidados com conflitos. Começamos pela leitura, que é o que resolve hoje.
