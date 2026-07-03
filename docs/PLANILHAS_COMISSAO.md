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

### 10. `VIDA_INDIVIDUAL_ICATU.xlsx` (oficial — Icatu individual, jun/26)

- "Extrato Analítico Individual", período 01/06/2026 → 30/07/2026.
- Cabeçalho real na **linha 5**; 146 linhas de dados; rodapé com totais por
  tipo de lançamento.
- Colunas: `Cliente`, `CPF`, `Lançamento`, `Produto`, `Processo`,
  `Data de pagamento`, `Certificado`, `Apólice`, `Proposta`, `Parcela`,
  `Vencimento`, `Data do cálculo`, `Valor base`, `%`, `Comissão` (texto BR).
- Dois tipos de lançamento: **Corretagem** (recorrente, Σ R$ 883,37) e
  **Agenciamento** (venda nova, Σ R$ 1.230,43). Contém **estornos com valor
  negativo** (`-R$144,81`).
- É a fonte da qual a interna `Icatu Indiv.` é montada.

### 11. `VIDA_EMPRESARIAL_ICATU.xls` (oficial — Icatu empresarial, jun/26)

- **Atenção: apesar da extensão `.xls`, o arquivo é uma tabela HTML** (export
  do portal Icatu) — não abre com leitores de Excel binário.
- 11 linhas de dados + linha `Valor Total` (Σ prêmio R$ 8.884,88, Σ comissão
  **R$ 2.781,55**). Colunas: `Estipulante`, `Subestipulante`, `Apólice`,
  `N.Fatura`, `Competência` (`202604`/`202605`), `Prêmio`, `Comissão`.

**Conciliação comprovada**: o rodapé "PAGAMENTO DE CORRETAGEM R$ 3.664,92" do
extrato individual = corretagem individual (R$ 883,37) **+ empresarial
(R$ 2.781,55)** — a Icatu paga tudo no mesmo código de corretagem. Os números
das planilhas fecham entre si.

## Regra de negócio: a cascata financeira do fechamento

Definida pela usuária (jul/2026). Os valores das planilhas das seguradoras
são sempre **brutos**; sobre eles:

1. **Imposto do escritório: 20%** da bruta.
2. O **líquido** restante é dividido: **40% especialista** (Natália na
   produção dela, Bruno na dele), **30% escritório** e **30% assessor** que
   indicou o cliente.
3. O **financeiro recebe o bruto** (com a cascata inteira em colunas para
   conferência); o Hub mostra o **líquido** para a Natália ter controle do
   que de fato ganha.
4. A Natália também atua como assessora — **código CS8868**: nas vendas
   indicadas por ela, os 30% do assessor também são dela.

Percentuais e código vivem em `configuracoes` (migração 011) e são editáveis
em Cadastros; o cálculo compartilhado está em `src/lib/fechamento.js` e na
view `vw_fechamento_assessor_seguradora`.

## Regra de negócio: Natália × Bruno

As planilhas chegam sempre com **todos** os seguros do escritório (Natália e
Bruno juntos). A coluna `Produção` (Nati/Bruno) é quem separa. **Regra
definida pela usuária**: não excluir os dados do Bruno — apenas **separar**.
O sistema (Hub) é apenas da Natália, então os relatórios devem trazer o total
geral E o recorte por produção, sem descartar nada.

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
| 11 | Arquivo `.xls` que na verdade é HTML (não abre como Excel binário) | Icatu Empresarial oficial |
| 12 | Estornos aparecem de 3 jeitos: linha negativa (Icatu), coluna própria (MAG) ou linha "Estorno realizado" (Azos campanhas) | Oficiais |

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
| Icatu Individual oficial (corretagem + agenciamento) | jun/26 | R$ 2.113,80 |
| Icatu Empresarial oficial | jun/26 | R$ 2.781,55 |
| Omint (interna) | jun/26 | R$ 98,67 |
| **Total jun/26** | | **R$ 21.084,24** |

## Relatórios finais que os dados permitem gerar

Com o modelo canônico alimentado pelos 12 arquivos, ficam viáveis:

1. **Fechamento mensal consolidado** — total de comissão por competência,
   aberto por seguradora, com variação mês a mês.
2. **Separação Natália × Bruno** — recorte por `Produção` em todos os
   relatórios (sem excluir os dados do Bruno).
3. **Comissão por assessor (cód. AAI)** — base para repasse: valor gerado,
   nº de clientes e de parcelas por assessor/mês.
4. **Recorrente × venda nova** — as oficiais distinguem: MAG
   (`CARTEIRA` × `ANGARIACAO`), Icatu (`Corretagem` × `Agenciamento`),
   Azos (comissão × campanha).
5. **Carteira de clientes ativos** — da aba `Propostas fechadas`: 353 apólices
   ativas com seguradora, prêmio e assessor (após normalizar grafias).
6. **Evolução mensal por cliente** — reconstrução da matriz `Comissão Mês`
   (abandonada desde dez/2023) a partir das planilhas por seguradora.
7. **Estornos e cancelamentos** — consolidando os 3 formatos de estorno +
   motivos de cancelamento da geral.
8. **Auditoria oficial × interna** — conferência automática de que a planilha
   interna do mês bate com o relatório oficial da seguradora.
9. **Reuniões e conversão por assessor** — abas `Reuniões Marcadas` e
   `Agendamentos` da geral.

## Pendências

- [x] ~~Receber as planilhas~~ → **12 arquivos recebidos, mapa completo**.
- [x] ~~Confirmar se a "geral" é montada a partir das mensais~~ → a geral tem o
      registro-mestre de propostas (`Propostas fechadas`) e uma matriz mensal
      abandonada desde dez/2023; a consolidação mensal precisa ser reconstruída
      a partir das planilhas por seguradora.
- [x] ~~Definir formato dos relatórios finais~~ → workbook consolidado entregue
      (Fechamento, Nati × Bruno, Por Assessor, Detalhamento) e relatórios no Hub.
- [x] ~~Implementar a consolidação~~ → **implementado no Hub**:
      - `supabase/migrations/009_comissoes_importadas.sql` — tabela + view de resumo;
      - `src/lib/planilhasComissao.js` — detecção automática dos 6 perfis de
        planilha (internas + oficiais Azos/Icatu/MAG), testada com os 12
        arquivos reais: todos os totais batem centavo a centavo;
      - **Importar → Comissões**: cola as células (ou envia o CSV da MAG),
        o formato é reconhecido sozinho, prévia com totais por produção e
        reimportar o mesmo mês substitui os dados antigos;
      - **Relatórios**: card "Comissões recebidas das seguradoras" com
        Natália × Bruno, por seguradora, por assessor, recorrente × venda
        nova × campanha e exportação CSV (resumo e detalhado).

## Rotina mensal (o ciclo completo no Hub)

Todo mês, quando as planilhas chegarem:

1. **Importar → Comissões**: cole a planilha de cada seguradora (tabela
   abaixo). Escolha o mês — reimportar o mesmo mês **substitui** os dados
   antigos, então pode colar de novo quantas vezes precisar.
2. **Dashboard** atualiza sozinho: card "Comissão recebida das seguradoras"
   com o mês de referência, split Natália × Bruno e evolução dos últimos meses.
3. **Relatórios** mostram o fechamento: por seguradora, por assessor
   (base de repasse), recorrente × venda nova × campanha e a evolução de
   todos os meses.
4. Exportações substituem a planilha geral antiga:
   - **Resumo CSV** e **Detalhado CSV** — fechamento do mês;
   - **Matriz cliente × mês** — a aba "Comissão Mês" da geral (parada desde
     dez/2023), agora gerada automaticamente com todos os meses importados.

## Como importar cada arquivo no Hub (passo a passo)

| Arquivo | Como importar |
|---|---|
| Internas (Azos/Icatu/MAG/Omint) | Copiar células com cabeçalho → colar → escolher mês e seguradora |
| Azos oficial (comissões/campanhas) | Copiar tudo (pode incluir o topo institucional) → colar |
| MAG oficial | Enviar o `.csv` direto no campo de arquivo |
| Icatu individual oficial | Copiar células → colar (mês vem da data de pagamento) |
| Icatu empresarial oficial | Abrir o `.xls` no Excel → copiar células → colar → escolher o mês |
