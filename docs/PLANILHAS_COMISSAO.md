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
3. **Planilha "geral"** (a mais importante, consolida tudo) — *aguardando envio*.

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

## Problemas de padronização encontrados (a corrigir na consolidação)

| # | Problema | Onde |
|---|---|---|
| 1 | Valores em 3 formatos: número (`61.08`), texto BR (`R$1.539,94`) e texto sem R$ (`273,96`) | Azos interna / Icatu / Azos campanhas |
| 2 | Mês de competência ausente nas planilhas internas (só no nome do arquivo) | Icatu Indiv., Icatu Empresarial |
| 3 | Cabeçalho institucional + linha de total/estorno misturados aos dados | Relatórios oficiais Azos |
| 4 | Nomes de cliente com espaços à esquerda, caixa alta × capitalizado, truncados | Todas |
| 5 | `Código do cliente` como `473522.0` (float) ou vazio | Internas |
| 6 | Abas com 1000 linhas/26 colunas formatadas mas vazias (incham o arquivo) | Internas |
| 7 | Nome de coluna inconsistente para o mesmo conceito: `Nome do Segurado` × `Cliente` × `Nome/Razão social`; `Parcela` × `N.Fatura` | Todas |

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

## Pendências

- [ ] Receber as demais planilhas (envio parcelado) — **inclusive a "geral"**.
- [ ] Confirmar com a usuária: a "geral" é montada a partir das mensais ou é independente?
- [ ] Definir formato dos relatórios finais de exportação (CSV/XLSX, por assessor × por seguradora × por mês).
