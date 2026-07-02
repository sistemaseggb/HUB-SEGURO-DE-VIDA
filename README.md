# Hub Seguro de Vida — Natália Maschendorf

Sistema de gestão completa do fluxo de consultoria de seguro de vida — pré-venda,
venda e pós-venda — com automação máxima: o trabalho da Natália é fazer a reunião
e registrar os dados; o sistema cuida do resto.

**Stack:** React (Vite) + Tailwind CSS v4 + Lucide React + Supabase (PostgreSQL + Auth)

---

## 🤖 O que é automático (motor de automações no banco)

| Quando... | O sistema sozinho... |
|---|---|
| Um lead é cadastrado | Cria a tarefa "fazer primeiro contato" para o dia seguinte |
| Uma reunião é agendada | Move o cliente para **Agendamento** no funil |
| A reunião é marcada como realizada | Move para **Reunião Realizada** + cria tarefa de montar o estudo |
| O planejamento é preenchido | Calcula o capital segurado sugerido (custo de vida × 12 × anos + dívidas) |
| Uma venda é registrada | Move para **Fechado**, calcula a comissão e divide entre **Natália / Assessor / Escritório**, gera o link do formulário de onboarding e agenda as tarefas de pós-venda (boas-vindas em 7 dias, revisão em 11 meses) |
| O cliente conclui o formulário | Cria a tarefa "conferir dados e emitir apólice" |
| Cliente muda de etapa no Kanban | Zera o contador de dias parados e grava o histórico do funil |
| Aniversário (cliente ou apólice) se aproxima | Aparece na Régua de Relacionamento e na Central do Dia, com botão de WhatsApp com mensagem pronta |

## 🧩 Módulos

- **Dashboard** — KPIs do mês, comissão da Natália, gráfico de evolução, divisão
  de comissões, Top 5 assessores (com taxa de conversão), visão do funil e a
  **Central do Dia** (tarefas, atrasos, aniversários e leads estagnados).
- **Pipeline** — Kanban com arrastar-e-soltar, dias parados com alerta
  amarelo/vermelho configurável, motivo obrigatório ao perder um cliente.
- **Clientes** — perfil 360º com abas: Planejamento (dados da reunião),
  Reuniões, Apólices, Formulário de onboarding e Tarefas. Botão **Gerar
  proposta** cria a apresentação para o cliente.
- **Proposta** — apresentação em tela cheia gerada a partir do planejamento
  (capital recomendado, pilares, fechamento) — exportável em PDF pelo navegador.
- **Formulário público** (`/f/<token>`) — onboarding pós-venda estilo Typeform:
  etapas curtas, progresso salvo automaticamente (o cliente pode parar e voltar),
  sem login, seguro por token via RPC. Campos configuráveis em
  `src/lib/formularioConfig.js`.
- **Pós-Venda** — carteira de apólices ativas + Régua de Relacionamento.
- **Cadastros** — assessores, seguradoras (com % de comissão padrão) e a regra
  de divisão de comissão + limites de alerta do Kanban.

---

## 🚀 Setup do zero

### 1. Clonar e instalar

```bash
git clone https://github.com/sistemaseggb/hub-seguro-de-vida.git
cd hub-seguro-de-vida
npm install
```

### 2. Criar o banco no Supabase

No painel do projeto → **SQL Editor**, rode **na ordem**:

1. [`supabase/migrations/001_schema_inicial.sql`](supabase/migrations/001_schema_inicial.sql)
2. [`supabase/migrations/002_automacao_e_planejamento.sql`](supabase/migrations/002_automacao_e_planejamento.sql)

### 3. Criar o usuário de acesso (login)

Painel Supabase → **Authentication → Users → Add user** → crie o e-mail/senha
da Natália (e o seu, como administrador). Marque "Auto confirm user".

### 4. Variáveis de ambiente

```bash
cp .env.example .env
```

| Variável | Onde encontrar | Formato |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL | `https://xxxx.supabase.co` (**sem** `/rest/v1/`) |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **anon / publishable** | `sb_publishable_...` ou `eyJ...` |

> ⚠️ **NUNCA use a secret key (`sb_secret_...`) no frontend.** Se ela já foi
> exposta, gere uma nova (Rotate) no painel.

### 5. Rodar

```bash
npm run dev
```

---

## 📁 Estrutura

```
├── supabase/migrations/          # Schema + automações (SQL testado)
├── src/
│   ├── lib/
│   │   ├── supabase.js           # Cliente Supabase
│   │   ├── constants.js          # Etapas do funil, paleta dos gráficos
│   │   ├── format.js             # Moeda, datas, links de WhatsApp
│   │   └── formularioConfig.js   # Perguntas do formulário de onboarding
│   ├── components/               # Layout (sidebar) + componentes de UI
│   └── pages/                    # Dashboard, Pipeline, Clientes, Cliente 360º,
│                                 # Pós-Venda, Cadastros, Proposta, Login,
│                                 # Formulário público (/f/<token>)
```

## 🧭 Roadmap

- [x] Etapa 0 — Base: schema SQL, projeto Vite + Tailwind + Supabase
- [x] Módulo 1 — Cadastros base (assessores, seguradoras, split de comissão)
- [x] Módulo 2 — Pipeline Kanban com dias parados e alertas
- [x] Módulo 3 — Pós-venda: apólices ativas + régua de relacionamento
- [x] Módulo 4 — Dashboard gerencial com Top 5 e comissões divididas
- [x] Extra — Login (Supabase Auth), Central do Dia, motor de automações,
      formulário de onboarding público, gerador de proposta
- [ ] Importar planilhas de clientes/apólices existentes (aguardando arquivos)
- [ ] Lista oficial de seguradoras (aguardando dados)
- [ ] Alinhar o formulário com o oficial (gbplanejamento.netlify.app)
- [ ] Envio automático de WhatsApp/e-mail (Edge Functions + pg_cron)
