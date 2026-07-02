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
| Todo dia às 8h (pg_cron) | O banco **escreve as mensagens do dia** (aniversários, reativação de leads parados) na Central de Mensagens — envio com 1 clique |
| Planilha importada | Dados históricos entram **sem** disparar tarefas/formulários (flag `importado`), mas com comissão calculada e funil correto |
| A qualquer momento | O sistema **pontua cada lead** (score de prioridade: etapa + urgência + valor potencial + reunião marcada) e sugere a **Próxima Melhor Ação** — o "Foco de Hoje" do dashboard e a faixa no perfil do cliente |
| Reunião marcada para amanhã | Entra na Central de Mensagens um **lembrete de confirmação** pronto |
| Proposta apresentada | Cria sozinho a tarefa de **follow-up em 3 dias** |
| Cliente com apólice ativa sem contato há X dias | Aparece em **"Clientes que precisam de atenção"** no pós-venda (retenção) |

## 🧩 Módulos

- **Dashboard** — KPIs do mês, comissão da Natália, gráfico de evolução, divisão
  de comissões, Top 5 assessores (com taxa de conversão), visão do funil e a
  **Central do Dia** (tarefas, atrasos, aniversários e leads estagnados).
- **Pipeline** — Kanban com arrastar-e-soltar, dias parados com alerta
  amarelo/vermelho configurável, motivo obrigatório ao perder um cliente.
- **Clientes** — perfil 360º com abas: Planejamento (dados da reunião),
  Reuniões, Apólices, **Documentos** (anexos no Storage), Formulário de
  onboarding, Tarefas e Histórico. Faixa de **Próxima Melhor Ação** e
  temperatura no topo. Botão **Gerar proposta** cria a apresentação.
- **Proposta** — apresentação em tela cheia gerada a partir do planejamento
  (capital recomendado, pilares, fechamento) — exportável em PDF pelo navegador.
- **Formulário público** (`/f/<token>`) — onboarding pós-venda estilo Typeform:
  etapas curtas, progresso salvo automaticamente (o cliente pode parar e voltar),
  sem login, seguro por token via RPC. Campos configuráveis em
  `src/lib/formularioConfig.js`.
- **Pós-Venda** — carteira de apólices ativas + Régua de Relacionamento.
- **Agenda** — reuniões agrupadas por dia (atrasadas em destaque), confirmação
  por WhatsApp e mudança de status em 1 clique.
- **Central de Mensagens** — fila abastecida automaticamente pelo banco
  (aniversários de cliente/apólice e reativação de leads parados); cada
  mensagem sai pronta, é enviada com 1 clique e marcada como tratada.
- **Relatórios** — comissões a pagar por assessor (fechamento do mês, com
  exportação CSV), motivos de perda e tempo médio por etapa do funil.
- **Importar** — traga as planilhas históricas (clientes e apólices): colunas
  detectadas automaticamente, prévia antes de importar, criação automática de
  assessores/seguradoras que faltam e planilha modelo para download.
- **Cadastros** — assessores, seguradoras (com % de comissão padrão), divisão
  de comissão, limites de alerta do Kanban e **metas mensais**.

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
3. [`supabase/migrations/003_metas_mensagens_relatorios.sql`](supabase/migrations/003_metas_mensagens_relatorios.sql)
4. [`supabase/migrations/004_codigos_e_inteligencia.sql`](supabase/migrations/004_codigos_e_inteligencia.sql)
5. [`supabase/migrations/005_documentos.sql`](supabase/migrations/005_documentos.sql)
6. [`supabase/migrations/006_crm_interacoes_carteira.sql`](supabase/migrations/006_crm_interacoes_carteira.sql)
7. [`supabase/migrations/007_assessor_conversao_duplicados.sql`](supabase/migrations/007_assessor_conversao_duplicados.sql)

> Para a fila de mensagens se abastecer sozinha todo dia às 8h, habilite a
> extensão **pg_cron** antes de rodar a 003 (painel → Database → Extensions →
> pg_cron). Sem ela tudo funciona igual — só que pelo botão "Gerar mensagens
> de hoje" na Central de Mensagens.

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
- [x] Metas mensais com acompanhamento no dashboard
- [x] Agenda de reuniões com confirmação por WhatsApp
- [x] Central de Mensagens com geração diária automática (pg_cron)
- [x] Relatórios: comissões por assessor (CSV), motivos de perda, gargalos do funil
- [x] Importador de planilhas (clientes e apólices, sem disparar automações)
- [x] Lista inicial de seguradoras (percentuais aproximados — ajustar em Cadastros)
- [x] Códigos do escritório em clientes e assessores (cadastro, busca, importação)
- [x] Motor de priorização inteligente (score + Próxima Melhor Ação) no dashboard e no cliente
- [x] Busca global no topo (clientes e assessores por nome/código/telefone; atalho "/")
- [x] Documentos e anexos por cliente (Storage do Supabase)
- [x] Pronto para deploy na Vercel (`vercel.json` + guia em DEPLOY.md)
- [x] Registro de interações + "último contato" por cliente (CRM)
- [x] Mensagens automáticas editáveis + lembrete de reunião + follow-up de proposta
- [x] Pós-venda robusto: receita recorrente, carteira por seguradora, retenção
- [x] Backup/exportação de clientes e apólices em CSV
- [x] Assessor 360 (página do assessor com leads, conversão e comissão)
- [x] Gráfico de conversão mensal (leads criados × fechados)
- [x] Detector de clientes duplicados (aviso na tela de Clientes)
- [x] Responsivo no celular (menu-gaveta, tabelas roláveis, layout adaptável)
- [ ] Rodar a importação com as planilhas reais (aguardando arquivos)
- [ ] Alinhar o formulário com o oficial (aguardando conteúdo — site inacessível daqui)
- [ ] Envio 100% automático de WhatsApp (requer API oficial Meta/Twilio + Edge Function)
