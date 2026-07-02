# Hub Seguro de Vida — Natália Maschendorf

Sistema de organização do fluxo de trabalho de consultoria de seguro de vida:
cadastros base, pipeline de vendas (Kanban), pós-venda com régua de
relacionamento e dashboard gerencial.

**Stack:** React (Vite) + Tailwind CSS v4 + Lucide React + Supabase (PostgreSQL)

---

## 🚀 Setup do zero (passo a passo)

### 1. Clonar e instalar dependências

```bash
git clone https://github.com/sistemaseggb/hub-seguro-de-vida.git
cd hub-seguro-de-vida
npm install
```

> O projeto já foi inicializado com Vite + React, Tailwind v4 (via plugin
> `@tailwindcss/vite`), `@supabase/supabase-js` e `lucide-react`. Se um dia
> precisar recriar do zero, os comandos equivalentes são:
>
> ```bash
> npm create vite@latest hub-seguro-de-vida -- --template react
> cd hub-seguro-de-vida
> npm install
> npm install @supabase/supabase-js lucide-react tailwindcss @tailwindcss/vite
> ```

### 2. Criar o banco no Supabase

1. Abra o painel do seu projeto no [Supabase](https://supabase.com/dashboard)
2. Vá em **SQL Editor → New query**
3. Cole o conteúdo COMPLETO de [`supabase/migrations/001_schema_inicial.sql`](supabase/migrations/001_schema_inicial.sql)
4. Clique em **Run**

Isso cria as 6 tabelas, os triggers automáticos (comissão, dias na etapa,
histórico do funil), as views do dashboard e as políticas de segurança (RLS).

### 3. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

Depois edite o `.env` com os dados do painel **Project Settings → API Keys**:

| Variável | Onde encontrar | Formato |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL | `https://xxxx.supabase.co` (**sem** `/rest/v1/`) |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **anon / publishable** | `sb_publishable_...` ou `eyJ...` |

> ⚠️ **NUNCA use a secret key (`sb_secret_...`) no frontend.** Ela dá acesso
> total ao banco ignorando todas as regras de segurança. Se ela já foi exposta
> em algum lugar, gere uma nova em Project Settings → API Keys → Rotate.

### 4. Rodar o projeto

```bash
npm run dev
```

Abra http://localhost:5173 — a tela inicial mostra o status da conexão com o
Supabase.

---

## 📁 Estrutura

```
├── supabase/
│   └── migrations/
│       └── 001_schema_inicial.sql   # Schema completo do banco
├── src/
│   ├── lib/
│   │   └── supabase.js              # Cliente Supabase (singleton)
│   ├── App.jsx                      # Tela provisória de teste de conexão
│   ├── main.jsx
│   └── index.css                    # Tailwind v4 + tema base
├── .env.example                     # Modelo das variáveis de ambiente
└── vite.config.js                   # Vite + React + Tailwind
```

## 🗄️ Modelo de dados (resumo)

- **assessores** — quem traz os leads (divisão de comissão)
- **seguradoras** — com percentual de comissão padrão
- **clientes** — leads vinculados obrigatoriamente a um assessor; guarda a
  etapa do funil e desde quando está nela (`data_entrada_etapa`)
- **historico_funil** — trilha de auditoria de cada mudança de etapa
  (preenchida automaticamente por trigger)
- **reunioes** — agenda vinculada ao cliente
- **apolices** — vendas; a `comissao_gerada` é calculada automaticamente
  (prêmio mensal × 12 × % da seguradora, com possibilidade de sobrescrever o
  percentual por apólice)

**Views prontas para o frontend** (zero cálculo no React):
`vw_pipeline` (Kanban + dias parados), `vw_regua_relacionamento`
(aniversários de cliente e de apólice), `vw_ranking_assessores` (ranking com
taxa de conversão) e `vw_dashboard_mensal` (resumo mensal).

## 🧭 Roadmap dos módulos

- [x] Etapa 0 — Base: schema SQL, projeto Vite + Tailwind + Supabase
- [ ] Módulo 1 — Cadastros base (Assessores, Seguradoras, Clientes)
- [ ] Módulo 2 — Pipeline Kanban com dias parados por etapa
- [ ] Módulo 3 — Pós-venda: apólices ativas + régua de relacionamento
- [ ] Módulo 4 — Dashboard gerencial com ranking Top 5 de assessores
