# Dicionário de dados — planilhas de comissão

> Documento vivo: mapeia **todas** as planilhas de comissão usadas pelo escritório,
> arquivo por arquivo, para padronizar a importação e os relatórios finais.
> Atualizado conforme novas planilhas são analisadas.
> **Nenhum dado pessoal é registrado aqui — apenas estrutura.**

## Visão geral

Existem dois tipos de planilha:

1. **Planilhas oficiais das seguradoras** (exportadas dos portais — ex.: Azos):
   layout fixo, com cabeçalho institucional, linha de total no rodapé e, às
   vezes, linhas de estorno. São a **fonte da verdade** dos valores.
2. **Planilhas internas mensais** (montadas manualmente por seguradora/mês —
   ex.: `AZOS_COMISSÃO_MAIO_26`, `Icatu Indiv. MAIO 26`): reorganizam os dados
   oficiais acrescentando as colunas de gestão do escritório
   (**Código assessor** e **Produção** = quem vendeu, Nati/Bruno).
3. **Planilha "geral"** (`PLANILHA GERAL DE SEGUROS NATALIA E BRUNO.xlsx`):
   registro-mestre de propostas fechadas desde 2023 + matriz de comissão mensal
   (abandonada desde o fim de 2023 — ver §10).

## Arquivos mapeados até agora

### 1. `AZOS_COMISSÃO_MAIO_26.xlsx` (interna — Azos, maio/26)

- Aba `Página3` — 70 linhas de dados.
- Colunas: `Nome do Segurado`, `Código do cliente`, `Código assessor`,
  `Produção` (Nati/Bruno), `Parcela`, `Pagamento Segurado` (data `dd/mm/aaaa`
  como texto), `Comissão Bruta` (número com ponto decimal, ex.: `61.08`).
- Σ Comissão Bruta: **R$ 5.052,49** (Nati 54 linhas, Bruno 16).
- Observações: `Código do cliente` vazio em várias linhas; datas de pagamento
  do segurado vão de 01/04 a 31/05 (a competência é o mês do *recebimento* da
  comissão, não o do pagamento do segurado).

### 2. `AzosRelatorioComissoes_20260602_20260702...xlsx` (oficial — Azos)

- Aba `Sheet` — 4 linhas de cabeçalho institucional (razão social + CNPJ) antes
  do cabeçalho real na **linha 5**; 42 linhas de dados + **1 linha de total**
  no rodapé (`Total Comissão Bruta no Período`, valor na última coluna).
- Colunas: `Nome do Segurado`, `CPF do Segurado`, `ID da Apólice`,
  `Nº da Apólice`, `Coberturas`, `Mês de Competência` (`mm/aaaa`), `Parcela`,
  `Pagamento Segurado`, `Pagamento Comissão`, `Valor da Fatura`,
  `Comissão Bruta` (numéricas), `Responsável pela Venda` (e-mail do escritório),
  `Nº da Proposta de Endosso`.
- Σ Comissão Bruta: **R$ 3.009,53** | Σ Valor da Fatura: R$ 12.084,02.
- É a fonte da qual a planilha interna da Azos é montada (mesmos segurados e
  valores; a interna acrescenta assessor e produção).

### 3. `AzosRelatorioCampanhas_20260601_20260731...xlsx` (oficial — Azos, campanhas)

- Aba `Sheet` — mesmo padrão: cabeçalho institucional, cabeçalho real na linha 5,
  5 linhas de dados + 1 linha de **estorno** (sem nome do segurado).
- Colunas: `Nome do Segurado`, `ID da Apólice`, `Mês de Competência`,
  `Mês de Pagamento`, `Prêmio`, `Nome da Campanha` (ex.: Multiplicazos),
  `Valor Recebido` — valores em texto formato BR (`273,96`).
- Σ Valor Recebido: **R$ 3.329,97**. Receita de campanha ≠ comissão recorrente
  (deve aparecer separada nos relatórios).

### 4. `Icatu Empresarial Maio 26.xlsx` (interna — Icatu empresarial, maio/26)

- Aba `Página3` — 10 linhas de dados.
- Colunas: `Nome/Razão social`, `Código do cliente`, `Código assessor`,
  `Produção`, `N.Fatura`, `Comissão` (**texto** formato BR: `R$1.539,94`).
- Σ Comissão: **R$ 2.659,80** (toda de Nati).
- Observações: o mesmo cliente aparece em várias linhas (uma por
  cobertura/fatura); **não há coluna de data/competência** — o mês está apenas
  no nome do arquivo.

### 5. `Icatu Indiv. MAIO 26.xlsm` (interna — Icatu individual, maio/26)

- Aba `Página3` — 137 linhas de dados.
- Colunas: `Cliente`, `Código do cliente`, `Código assessor`, `Produção`,
  `Parcela`, `Comissão` (texto BR `R$0,58`).
- Σ Comissão: **R$ 5.362,92** (Bruno 77 linhas, Nati 60).
- Observações: várias linhas por cliente/parcela (uma por cobertura);
  `Código assessor` vazio em algumas linhas; também **sem coluna de data**.

### 6. `MAG_MAIO_26.xlsx` (interna — MAG, maio/26)

- Aba `Página3` — **566 linhas** (a maior das internas).
- Colunas: `Nome/Razão social`, `Código do cliente`, `Código assessor`,
  `Produção`, `Parcela comissionada`, `Competência comissionada` (`202605`),
  `Parcela faturada`, `Competência faturada`, `Valor Comissão` (número),
  `Valor estorno`.
- Σ Valor Comissão: **R$ 7.723,52** (Nati 318 linhas, Bruno 248).
- É a única interna que **tem competência em coluna** (herdada do relatório
  oficial da MAG). Muitas linhas por cliente (uma por cobertura/verba).

### 7. `RELAÇÃO COMISSÕES MAG JUNHO.csv` (oficial — MAG, junho/26)

- CSV separado por `;`, BOM UTF-8, **543 linhas**, 36 colunas.
- Colunas-chave: `Nome/Razão social`, `CPF/CNPJ do cliente`, `Proposta`,
  `Descrição Produto`, `Valor base`, `Parcela/Competência comissionada e
  faturada`, `Tipo de lançamento` (`ANGARIACAO_COMISSAO` = venda nova,
  `CARTEIRA_COMISSAO` = recorrente), `Data de efetivação do crédito`,
  `Valor Angariação`, `Valor Comissão`, `Valor estorno`, `Valor bonificação`.
- Σ Comissão (carteira): **R$ 7.500,10** + Σ Angariação: **R$ 2.250,62**.
- Competência única: 202606. Valores em texto BR (`352,34`); campos com `\t`
  no início (CNPJ, nº inscrição) para não perder zeros.

### 8. `OMINT_MAIO_26.xlsx` e `OMINT_junho26.xlsx` (internas — Omint)

- Aba `Sheet1` — colunas: `Segurado / Estipulante`, `Código do cliente`,
  `Código assessor`, `Produção`, `N° Parcela`, `Vl. a Receber` (número).
- Maio: 4 linhas, Σ **R$ 3.323,16** | Junho: 1 linha, Σ **R$ 98,67**.
- Sem coluna de competência (mês só no nome do arquivo).

### 9. `PLANILHA GERAL DE SEGUROS NATALIA E BRUNO.xlsx` (a "geral")

Arquivo multi-abas — funciona como o "sistema" atual do escritório:

| Aba | Estado | Conteúdo |
|---|---|---|
| `Propostas fechadas` | visível | **Registro-mestre**: 365 propostas desde mar/2023. Colunas: nome, cód. cliente, especialista (Nati), % comissão, assessor, cód. AI, apólice, seguradora, prêmio anual/mês, data, tipo (resgatável ou não), % , status ATIVO/INATIVO, motivo cancelamento |
| `Comissão Mês` | visível | Matriz cliente × mês (2023-03 → 2024-12): comissão recorrente esperada por cliente |
| `Reuniões Marcadas (2025)` | visível | Assessores (nome, líder, função, código, nível) × reuniões por mês |
| `Agendamentos ` | oculta | Contagem de agendamentos por assessor |
| `Tabela dinâmica 1` | oculta | Vazia (resíduo de pivot) |

**Achados importantes da geral:**

- A aba `Propostas fechadas` é a fonte dos cadastros (cliente, assessor,
  seguradora, apólice, prêmio, status) — é ela que deve alimentar a importação
  do Hub.
- A mesma seguradora está grafada de até **5 formas** (`MAG`/`Mag`/`mag`,
  `Azos`/`azos`/`AZos`, `Met Life`/`Metlife`, `Akad (RC)`/`AKad (RC)`,
  `Omint`/`OMINT`/`Omint (Seg. Viagem)`) — 20 grafias para ~10 seguradoras
  reais. Distribuição (após normalizar): MAG 183, Icatu 44, Azos 49, Akad 32,
  Met Life 19, Prudential 12, Omint 14, Pottencial 5, AXA 1, vazio 6.
- Status: 353 ATIVO, 8 INATIVO, 4 em branco. Há 7 células `#REF!` (fórmulas
  quebradas) e códigos de cliente compostos (`9045148/ 300321`) ou com mais de
  uma apólice na mesma célula.
- A matriz `Comissão Mês` **parou de ser preenchida** após dez/2023 (2024 tem
  só 2–4 clientes/mês) — o acompanhamento mensal de comissão hoje só existe
  nas planilhas mensais por seguradora. É exatamente o vazio que os
  relatórios consolidados devem preencher.

## Problemas de padronização encontrados (a corrigir na consolidação)

| # | Problema | Onde |
|---|---|---|
| 1 | Valores em 3 formatos: número (`61.08`), texto BR (`R$1.539,94`) e texto sem R$ (`273,96`) | Azos interna / Icatu / Azos campanhas |
| 2 | Mês de competência ausente nas planilhas internas (só no nome do arquivo) | Icatu Indiv., Icatu Empresarial |
| 3 | Cabeçalho institucional + linha de total/estorno misturados aos dados | Relatórios oficiais Azos |
| 4 | Nomes de cliente com espaços à esquerda, caixa alta × capitalizado, truncados | Todas |
| 5 | `Código do cliente` como `473522.0` (float) ou vazio | Internas |
| 6 | Abas com 1000 linhas/26 colunas formatadas mas vazias (incham o arquivo) | Internas |
| 7 | Nome de coluna inconsistente para o mesmo conceito: `Nome do Segurado` × `Cliente` × `Nome/Razão social` × `Segurado / Estipulante`; `Parcela` × `N.Fatura` × `N° Parcela` | Todas |
| 8 | Seguradora com até 5 grafias diferentes na geral (`Mag`, `mag`, `MAG`…) | Geral |
| 9 | Fórmulas quebradas `#REF!` e códigos compostos (`9045148/ 300321`) | Geral |
| 10 | Matriz `Comissão Mês` desatualizada desde dez/2023 | Geral |

## Modelo canônico (proposta para a consolidação)

Cada linha de comissão, de qualquer origem, será normalizada para:

| Campo | Tipo | Origem |
|---|---|---|
| `seguradora` | texto | nome do arquivo / relatório |
| `tipo` | `individual` / `empresarial` / `campanha` | arquivo |
| `competencia` | `AAAA-MM` | coluna ou nome do arquivo |
| `cliente` | texto (trim + caixa padronizada) | coluna de nome |
| `codigo_cliente` | texto (sem `.0`) | coluna |
| `codigo_assessor` | texto | coluna |
| `producao` | texto (Nati/Bruno/…) | coluna |
| `parcela` | inteiro | `Parcela` / `N.Fatura` |
| `valor_comissao` | decimal (2 casas) | `Comissão` / `Comissão Bruta` / `Valor Recebido` |
| `data_pagamento` | data | quando existir |

## Resumo financeiro dos arquivos recebidos

| Origem | Competência | Valor |
|---|---|---|
| Azos (interna) | maio/26 | R$ 5.052,49 |
| Icatu Individual (interna) | maio/26 | R$ 5.362,92 |
| Icatu Empresarial (interna) | maio/26 | R$ 2.659,80 |
| MAG (interna) | maio/26 | R$ 7.723,52 |
| Omint (interna) | maio/26 | R$ 3.323,16 |
| **Total maio/26 (internas)** | | **R$ 24.121,89** |
| Azos oficial (comissões) | jun/26 | R$ 3.009,53 |
| Azos oficial (campanha Multiplicazos) | jun/26 | R$ 3.329,97 |
| MAG oficial (carteira + angariação) | jun/26 | R$ 9.750,72 |
| Omint (interna) | jun/26 | R$ 98,67 |

## Pendências

- [ ] Receber as **2 planilhas restantes** (envio parcelado).
- [x] ~~Confirmar se a "geral" é montada a partir das mensais~~ → a geral tem o
      registro-mestre de propostas (`Propostas fechadas`) e uma matriz mensal
      abandonada desde dez/2023; a consolidação mensal precisa ser reconstruída
      a partir das planilhas por seguradora.
- [ ] Definir formato dos relatórios finais de exportação (CSV/XLSX, por assessor × por seguradora × por mês).
