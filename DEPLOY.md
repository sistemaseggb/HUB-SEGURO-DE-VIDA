# Como publicar o Hub na internet (deploy)

Rodar `npm run dev` só funciona no seu computador. Para a Natália acessar de
qualquer lugar — e para os **links do formulário do cliente (`/f/...`)
funcionarem** — o sistema precisa estar publicado. O caminho mais simples e
gratuito é a **Vercel**. Leva ~10 minutos.

O projeto já vem pronto para isso (arquivo `vercel.json` incluído, que faz as
rotas internas funcionarem).

---

## Passo a passo (Vercel)

### 1. Suba o código para o GitHub
O código já está no repositório `sistemaseggb/HUB-SEGURO-DE-VIDA`, na branch
`claude/insurance-hub-system-y6jwwe`. (Se for usar em produção de verdade, o
ideal é depois juntar essa branch na `main`.)

### 2. Crie a conta e importe o projeto
1. Acesse **vercel.com** e clique em **Sign Up** → entre com a conta do GitHub
2. No painel, clique em **Add New… → Project**
3. Encontre o repositório **HUB-SEGURO-DE-VIDA** e clique em **Import**
4. Em **Framework Preset**, a Vercel detecta **Vite** automaticamente
5. Se aparecer opção de branch, escolha `claude/insurance-hub-system-y6jwwe`

### 3. Configure as variáveis de ambiente (MUITO IMPORTANTE)
Antes de clicar em Deploy, abra **Environment Variables** e adicione as duas:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://athyubovaihjqlwepdky.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_gQHa6b766qSUmjnj4Y0w7A_Lxmzt2ZD` |

> São as mesmas do seu `.env`. Sem elas, o site abre em branco.

### 4. Deploy
Clique em **Deploy** e aguarde ~2 minutos. No fim, a Vercel te dá um endereço
tipo `https://hub-seguro-de-vida.vercel.app` — esse é o link do sistema no ar. 🎉

### 5. Libere o endereço no Supabase (login e formulário)
No painel do Supabase → **Authentication → URL Configuration**:
- Em **Site URL**, coloque o endereço da Vercel
- Em **Redirect URLs**, adicione também o endereço da Vercel

Isso garante que o login e os links funcionem no domínio publicado.

---

## Atualizações futuras
Toda vez que novas alterações forem enviadas para a branch no GitHub, a Vercel
**republica sozinha** — não precisa refazer nada.

## Sobre custo
O plano gratuito da Vercel e o plano gratuito do Supabase atendem
tranquilamente o uso da Natália. Só será necessário pensar em plano pago se o
volume crescer muito (milhares de acessos/dia ou muitos GB de documentos).

## Domínio próprio (opcional)
Se quiser um endereço tipo `hub.nataliaseguros.com.br` no lugar do
`.vercel.app`, dá para configurar em **Settings → Domains** na Vercel, apontando
um domínio que você registre (ex.: Registro.br). Posso te orientar quando chegar
essa hora.
