# Hub Seguro de Vida — Natália Maschendorf

![CI](https://github.com/sistemaseggb/HUB-SEGURO-DE-VIDA/actions/workflows/ci.yml/badge.svg)

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
| Planilha de comissão do mês importada | Dashboard ganha o card "Comissão recebida das seguradoras" (Natália × Bruno + evolução) e os Relatórios fecham o mês por seguradora/assessor — reimportar o mesmo mês substitui, sem duplicar |
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
- **Proposta** — apresentação em tela cheia com navegação de deck (setas do
  teclado, bolinhas laterais, contador): capa, diagnóstico, "quanto tempo a
  família aguentaria hoje?" (autonomia sem × com o plano), capital, 5 pilares,
  blindagem patrimonial, gap, **o investimento** (prêmio/dia, % da renda e
  alavancagem R$ 1 → R$ N, quando a cotação está no planejamento) e próximos
  passos — exportável em PDF pelo navegador.
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
- **Relatórios** — fechamento do mês por **assessor × seguradora** com a
  cascata bruto → imposto → líquido → divisão 40/30/30 (CSV para o
  financeiro + PDF), Controle da Natália (ganho líquido mês a mês e
  recorrência), motivos de perda e tempo médio por etapa do funil.
- **Importar** — traga as planilhas históricas (clientes e apólices): colunas
  detectadas automaticamente, prévia antes de importar, criação automática de
  assessores/seguradoras que faltam e planilha modelo para download.
- **Cadastros** — assessores, seguradoras (com % de comissão padrão), divisão
  de comissão, limites de alerta do Kanban e **metas mensais**.

---

## ✨ Modo demonstração (sem configurar nada)

Quer ver o sistema funcionando **agora**, ou demonstrá-lo a um interessado?

```bash
npm install && npm run dev
```

Sem o arquivo `.env`, o Hub liga sozinho em **modo demonstração**: banco
simulado com dados 100% fictícios (clientes, apólices, comissões, DPS
preenchida), login com qualquer e-mail/senha e um selo "✨ Demonstração" no
topo. Nada é salvo — recarregou, voltou ao início. Para forçar o modo demo
mesmo com `.env`, use `VITE_DEMO=1 npm run dev`.

### Testes de ponta a ponta

```bash
npm run build && npm run preview   # terminal 1 (modo demo)
npm run test:e2e                   # terminal 2
```

São duas suítes (31 verificações): a **principal** navega o sistema inteiro
nas duas visões — consultora (login, dashboard, pipeline, cliente 360 com
planejamento por pilares, apólices, DPS, proposta, relatórios com fechamento,
pós-venda, agenda, mensagens, cadastros) e cliente (formulário público de DPS
pelo link); a de **erros de usuário** ataca os caminhos que quebram sistemas:
link inválido, formulário já concluído, obrigatórios vazios, proposta sem
planejamento, rota inexistente, venda com comissão automática, popups de
dossiê/DPS, pendências de classificação, busca, exclusão com confirmação,
celular (375px) e F5. Capturas em `e2e-shots/`.

### Marca

A identidade visual segue a logo oficial **GB | XP** (grafite + laranja):
sidebar escura, laranja como único acento, tipografia Inter + Lexend.

- `public/logo.png` — lockup completo GB | XP (login, proposta, impressos)
- `public/logo-gb.png` — monograma GB quadrado (sidebar, favicon, PWA)
- `docs/marca/` — os arquivos originais em alta (PNG e SVG)

Em fundos escuros a marca aparece num selo branco — o mesmo arquivo serve em
qualquer fundo. Para trocar, substitua os PNGs; nenhum código muda. A paleta
dos gráficos (laranja/azul/ameixa) foi validada para daltonismo e contraste.

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
8. [`supabase/migrations/008_integracao_outlook.sql`](supabase/migrations/008_integracao_outlook.sql)
9. [`supabase/migrations/009_comissoes_importadas.sql`](supabase/migrations/009_comissoes_importadas.sql)
10. [`supabase/migrations/010_meta_comissao_recebida.sql`](supabase/migrations/010_meta_comissao_recebida.sql)
11. [`supabase/migrations/011_fechamento_liquido.sql`](supabase/migrations/011_fechamento_liquido.sql)
12. [`supabase/migrations/012_historico_apolices.sql`](supabase/migrations/012_historico_apolices.sql)
13. [`supabase/migrations/013_tipo_produto_apolice.sql`](supabase/migrations/013_tipo_produto_apolice.sql)
14. [`supabase/migrations/014_planejamento_detalhado.sql`](supabase/migrations/014_planejamento_detalhado.sql)
15. [`supabase/migrations/015_cotacao_proposta.sql`](supabase/migrations/015_cotacao_proposta.sql)
16. [`supabase/migrations/016_filhos_custo_mensal.sql`](supabase/migrations/016_filhos_custo_mensal.sql)
17. [`supabase/migrations/017_proposta_publica.sql`](supabase/migrations/017_proposta_publica.sql)
18. [`supabase/migrations/018_roteiro_reuniao.sql`](supabase/migrations/018_roteiro_reuniao.sql)

> Para a fila de mensagens se abastecer sozinha todo dia às 8h, habilite a
> extensão **pg_cron** antes de rodar a 003 (painel → Database → Extensions →
> pg_cron). Sem ela tudo funciona igual — só que pelo botão "Gerar mensagens
> de hoje" na Central de Mensagens.

### 2b. Carga da base histórica (clientes + apólices + comissões)

Depois das migrações, cole no **SQL Editor**, um de cada vez:

1. [`supabase/seeds/carga_historica.sql`](supabase/seeds/carga_historica.sql)
   — **298 clientes e 361 apólices** da planilha geral, ligados a assessores
   e seguradoras, com a comissão 40/30/30 calculada.
2. [`supabase/seeds/carga_comissoes_2023_2024.sql`](supabase/seeds/carga_comissoes_2023_2024.sql)
   — **histórico de comissões 2023–2024** (249 lançamentos, R$ 41.515,45, da
   aba "Comissão Mês"): a evolução aparece nos Relatórios e no Controle da
   Natália desde o início da operação.

Os dois são **seguros de rodar mais de uma vez** (só inserem o que falta) e
**não geram tarefas/formulários** — as automações ficam desligadas durante a
carga. São gerados por `scripts/gerar-seed-historico.mjs` e
`scripts/gerar-seed-comissoes.mjs` a partir da planilha.

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
- [x] Guia de "Primeiros passos" no dashboard (some quando o setup termina)
- [x] Saudação inteligente por horário (bom dia/boa tarde/boa noite)
- [x] App instalável no celular (PWA: ícone, tela cheia)
- [x] Edição e exclusão de assessores, seguradoras e clientes
- [x] Edição e exclusão de apólices, reuniões e interações
- [x] Resumo dos últimos 7 dias no dashboard
- [x] Redesign visual premium (Inter + Lexend, paleta de marca, componentes)
- [x] Faixas didáticas "Como funciona" em cada módulo (dispensáveis)
- [x] Feedback visual (toasts) nas ações de salvar/excluir/enviar
- [x] Integração com a agenda do Outlook (Microsoft Graph, mão única) — guia
      em [`docs/INTEGRACAO_OUTLOOK.md`](docs/INTEGRACAO_OUTLOOK.md)
- [x] Importador de comissões das seguradoras (Azos, Icatu, MAG, Omint —
      formatos oficiais e internos reconhecidos sozinhos; mapa em
      [`docs/PLANILHAS_COMISSAO.md`](docs/PLANILHAS_COMISSAO.md)) + relatório
      "Comissões recebidas" com separação Natália × Bruno e exportação CSV
- [x] Fechamento para o financeiro separado por assessor × seguradora, com a
      cascata bruto → imposto (20%) → líquido → divisão 40/30/30, códigos,
      conferência automática, pendências resolvidas na tela e PDF de 1 clique
- [x] Controle da Natália (migração 011): quanto ela ganha (líquido) em cada
      mês — 40% da produção dela + indicações pelo código CS8868 — com
      recorrência garantida e extrato CSV
- [x] Inteligência do mês: variação por seguradora vs mês anterior, tipo de
      receita, top clientes com concentração e alerta de seguradora faltante
- [x] Extrato de comissões no Cliente 360 (aba Comissões) e no Assessor 360
      (últimos meses + clientes que mais geram)
- [x] Meta de comissão recebida (migração 010) no card Metas do Dashboard
- [x] Planejamento por **5 pilares** (migração 014): família, invalidez,
      doenças graves, DIT e sucessão/inventário — sugestões calculadas, gap
      vs cobertura atual e resumo ao vivo
- [x] Apresentação renovada: logo do escritório (public/logo.png), slide de
      diagnóstico, blindagem patrimonial (custo do inventário), gap de
      cobertura e próximos passos
- [x] DPS completa no formulário público (padrão das seguradoras) com
      impressão limpa para transcrever ao portal + destaque dos "sim"
- [x] Dossiê 1-página do cliente: estudo, apólices, últimas conversas e
      pendências — a folha da consultora antes de cada reunião
- [ ] Rodar a importação com as planilhas reais (aguardando arquivos)
- [ ] Alinhar o formulário com o oficial (aguardando conteúdo — site inacessível daqui)
- [ ] Envio 100% automático de WhatsApp (requer API oficial Meta/Twilio + Edge Function)
