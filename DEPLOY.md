# Como colocar o Hub 100% no ar — passo a passo

Este guia leva o sistema do zero ao ar, pronto para a consultora trabalhar.
São **3 partes**: (A) o banco de dados no Supabase, (B) publicar o site na
Vercel e (C) o teste final. Reserve ~30 minutos na primeira vez.

> **Visão geral:** o Hub é um site (feito em React) que conversa com um banco
> de dados (Supabase). O site é publicado na Vercel; o banco fica no Supabase.
> Os dois precisam estar configurados e "apresentados" um ao outro.

---

## Parte A — Banco de dados (Supabase)

### A1. Crie o projeto no Supabase
1. Acesse **supabase.com** → **Start your project** → entre com o GitHub.
2. **New project**: dê um nome (ex.: `hub-seguro-vida`), defina uma senha de
   banco (guarde-a) e escolha a região **South America (São Paulo)**.
3. Aguarde ~2 minutos até o projeto ficar pronto.

### A2. Rode as migrações (cria todas as tabelas) — a parte mais importante

**Jeito fácil (recomendado, 1 minuto):** No Supabase, abra **SQL Editor** →
**New query**. Abra o arquivo **`supabase/setup_completo.sql`** deste
repositório, copie **tudo**, cole no editor e clique em **Run**. Esse arquivo já
junta as 27 migrações na ordem certa — pronto. *(Use este caminho num projeto
Supabase novo/vazio.)*

**Jeito manual (se preferir, ou se o de cima der erro):** rode um arquivo de
cada vez, na **ordem**, copiando o conteúdo de cada um da pasta
`supabase/migrations/`:

1. `001_schema_inicial.sql`
2. `002_automacao_e_planejamento.sql`
3. `003_metas_mensagens_relatorios.sql`
4. `004_codigos_e_inteligencia.sql`
5. `005_documentos.sql` *(cria também o bucket de arquivos)*
6. `006_crm_interacoes_carteira.sql`
7. `007_assessor_conversao_duplicados.sql`
8. `008_integracao_outlook.sql`
9. `009_comissoes_importadas.sql`
10. `010_meta_comissao_recebida.sql`
11. `011_fechamento_liquido.sql`
12. `012_historico_apolices.sql`
13. `013_tipo_produto_apolice.sql`
14. `014_planejamento_detalhado.sql`
15. `015_cotacao_proposta.sql`
16. `016_filhos_custo_mensal.sql`
17. `017_proposta_publica.sql`
18. `018_roteiro_reuniao.sql`
19. `019_planejamento_completo.sql`
20. `020_transcricoes_reuniao.sql`
21. `021_planejamento_inteligente.sql`
22. `022_comparador.sql`
23. `023_apresentacao.sql`
24. `024_estado_e_prazo_divida.sql`

> **Como saber se deu certo?** Cada Run deve terminar com "Success". Em
> **Table Editor** você verá as tabelas (clientes, apólices, planejamentos…).
> As migrações são seguras de rodar de novo — se repetir uma, ela não duplica
> nada.

### A3. Confirme o bucket de documentos
Vá em **Storage**. Deve existir um bucket **privado** chamado `documentos`
(criado pela migração 005). Se por acaso não existir, crie manualmente:
**New bucket** → nome `documentos` → deixe **Public** desmarcado → **Create**.

### A4. (Opcional) Ligue o envio automático de mensagens às 8h
As mensagens de relacionamento podem ser geradas sozinhas todo dia. Para isso,
em **Database → Extensions**, procure **pg_cron** e ative. *Sem isso tudo
funciona igual — só que a consultora clica em "Gerar mensagens de hoje" na
Central de Mensagens.*

### A5. Crie o usuário de acesso da consultora
Em **Authentication → Users → Add user → Create new user**: informe o e-mail e
uma senha para a Natália. É com esse login que ela entra no Hub.

### A6. Pegue as chaves de conexão
Em **Project Settings → API**, copie dois valores (vai usar na Parte B):
- **Project URL** (algo como `https://xxxx.supabase.co`)
- **anon public** key (uma chave longa — a chave *pública*, pode ir no site)

---

## Parte B — Publicar o site (Vercel)

O projeto já vem pronto para a Vercel (o arquivo `vercel.json` faz as rotas
internas funcionarem).

### B1. Importe o projeto
1. Acesse **vercel.com** → **Sign Up / Log in** com o GitHub.
2. **Add New… → Project** → encontre **HUB-SEGURO-DE-VIDA** → **Import**.
3. **Framework Preset**: a Vercel detecta **Vite** sozinha.
4. Em **Branch**, escolha a branch que você quer publicar
   (a de produção do repositório).

### B2. Configure as variáveis de ambiente (sem isso o site abre em branco)
Ainda antes do deploy, abra **Environment Variables** e adicione as duas, com
os valores que você copiou no passo **A6**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | *(o Project URL do Supabase)* |
| `VITE_SUPABASE_ANON_KEY` | *(a chave anon public do Supabase)* |

> Se estas variáveis **não** forem preenchidas, o Hub abre em **modo
> demonstração** (dados fictícios que não são salvos). Ou seja: para valer,
> preencha as duas.

### B3. Deploy
Clique em **Deploy** e aguarde ~2 minutos. No fim, a Vercel te dá um endereço
tipo `https://hub-seguro-de-vida.vercel.app` — esse é o link do sistema. 🎉

### B4. "Apresente" o site ao Supabase (login e links)
No Supabase → **Authentication → URL Configuration**:
- **Site URL**: cole o endereço da Vercel.
- **Redirect URLs**: adicione também o endereço da Vercel.

Isso faz o login e os links públicos (`/f/...` do formulário e `/p/...` da
proposta) funcionarem no domínio publicado.

---

## Parte C — Teste final (5 minutos)

Abra o link da Vercel e confirme, na ordem:

1. **Login** com o e-mail/senha criados em A5. (Não deve aparecer o selo
   "Demonstração" no topo — se aparecer, revise as variáveis em B2.)
2. **Cadastros** → cadastre suas **seguradoras** (com o % de comissão), seus
   **assessores** e a **divisão de comissão** (soma 100%).
3. **Clientes → Novo lead** → crie um cliente de teste.
4. No cliente: **Planejamento** (preencha renda, custo, filhos) → veja o anel
   de prontidão → **Gerar proposta** e navegue os slides.
5. **Roteiro** → marque um bloco e salve.
6. **Apólices → Registrar venda** → confirme que a comissão é calculada.
7. **Documentos** → envie um PDF de teste (valida o Storage).
8. Abra o **Guia passo a passo** (menu Ajuda) — é o manual da consultora.

Passou nos 8? Está **100% no ar**. 🚀

### C1. Limpar seus testes antes de entregar (visão de ADM)
Depois de testar à vontade, deixe o banco limpo para a Natália começar do zero:
no **SQL Editor**, rode o arquivo **`supabase/limpar_dados_teste.sql`**. Ele
apaga os clientes/apólices de teste e mantém seus cadastros (seguradoras,
assessores, metas). Tem uma opção B no arquivo para zerar tudo.

---

## Trazer a base antiga (opcional, quando quiser)
Se a Natália já tem clientes/apólices numa planilha, use **Importar** no menu:
cole a planilha (ou envie um CSV) e o sistema reconhece as colunas sozinho,
mostra uma prévia e importa sem duplicar quem já existe.

## Atualizações futuras
Toda alteração enviada para a branch publicada faz a Vercel **republicar
sozinha**. Se a mudança incluir uma **nova migração** (arquivo novo em
`supabase/migrations/`), rode-a no SQL Editor como na Parte A2.

## Custo
Os planos **gratuitos** da Vercel e do Supabase atendem tranquilamente o uso de
uma consultora. Só se pensa em plano pago com volume muito alto (milhares de
acessos/dia ou muitos GB de documentos).

## Domínio próprio (opcional)
Para um endereço tipo `hub.nataliaseguros.com.br`, configure em
**Settings → Domains** na Vercel, apontando um domínio registrado (ex.:
Registro.br). Depois, repita o passo **B4** com o novo endereço.

## Se algo der errado
- **Site abre em branco / selo "Demonstração":** variáveis `VITE_...` ausentes
  ou erradas na Vercel (passo B2). Corrija e refaça o deploy.
- **"Não consigo logar":** confira o passo B4 (URL Configuration) e se o
  usuário foi criado em A5.
- **Erro ao salvar algo:** provavelmente falta rodar alguma migração (A2). O
  Hub avisa na tela quando uma coluna/tabela não existe.
- **Upload de documento falha:** confira o bucket `documentos` (A3).
