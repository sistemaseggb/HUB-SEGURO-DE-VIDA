# Rotina mensal de comissões — manual da Natália

O ciclo do mês tem 3 passos e leva menos de 10 minutos. O resultado final é o
**Fechamento para o financeiro**: a planilha separada por **assessor e
seguradora**, com todo mundo identificado pelo código, conferência automática
e a cascata financeira completa.

## A regra financeira do escritório (como todo valor é calculado)

```
comissão BRUTA (planilha da seguradora)
  − imposto do escritório (20%)
  = base LÍQUIDA
      × 40% → especialista (Natália na produção dela, Bruno na dele)
      × 30% → escritório
      × 30% → assessor que indicou o cliente
```

- O **financeiro lança pelo bruto** — a planilha traz o bruto e também todas
  as colunas da cascata para conferência.
- O **Hub mostra o líquido** — no card *Controle da Natália* ela vê o que de
  fato ganha em cada mês.
- A Natália também atua como **assessora (código CS8868)**: nas vendas
  indicadas por ela, os 30% do assessor também são dela.
- Os percentuais são editáveis em **Cadastros → Divisão de comissão**.

---

## Passo 0 — só na primeira vez (carga histórica)

1. **Supabase**: rode a migração `009_comissoes_importadas.sql` no SQL Editor
   (uma vez só; a tabela `comissoes_importadas` aparece no Table Editor).
2. **Importar → Clientes/Leads**: cole o conteúdo de `cadastro-clientes.csv`
   (300 clientes da planilha geral, com códigos — os assessores são criados
   automaticamente com seus códigos).
3. **Importar → Apólices**: cole o conteúdo de `cadastro-apolices.csv`
   (**361 apólices** da geral: seguradora normalizada, prêmio mensal, data de
   emissão/vigência, % de comissão, nº, **tipo de produto** — Temporário,
   Vitalício, Resgatável, RC, D&O... —, **Status** ATIVO/INATIVO e **Motivo
   cancelamento**). Apólices inativas entram como `cancelada` com o motivo, só
   como histórico, sem disparar pós-venda. **Rode antes** as migrações
   `012_historico_apolices.sql` (status + motivo) e `013_tipo_produto_apolice.sql`
   (tipo de produto). A data de emissão vira o "aniversário da apólice": o
   sistema puxa sozinho a mensagem de renovação todo ano e a tarefa de revisão
   11 meses depois.

   > **4 pontos para revisar depois** (o Hub já importa tudo; são só campos
   > que a geral não trazia): 3 apólices entraram com prêmio 0 (ROSÂNGELA
   > BIACHII, Henrique Batistello, GIOVANNA HEPFNER AULER — sem valor na
   > planilha) e 1 com seguradora "A definir" (Leticia Galbier Ricetto
   > Pegorari). Complete em Cliente 360 → Apólices quando tiver o dado.
4. **Importar → Comissões**: cole o conteúdo de
   `comissoes-consolidadas-mai-jun-2026.csv` — maio e junho inteiros entram de
   uma vez (o sistema reconhece o formato "Hub — consolidado": mês e
   seguradora vêm do próprio arquivo).

## Passo 1 — todo mês: importar as planilhas

Quando as planilhas do mês chegarem (Azos, Icatu, MAG, Omint...):

1. Abra **Importar → Comissões (planilhas das seguradoras)**.
2. Abra a planilha no Excel, selecione as células **com a linha de
   cabeçalho**, copie (Ctrl+C) e cole no campo (Ctrl+V).
   - O relatório da **MAG** vem em `.csv` — use o botão de arquivo.
   - O da **Icatu empresarial** (`.xls`) abre no Excel normalmente — copie de lá.
3. Confira o que o sistema detectou: nome do formato, nº de lançamentos e os
   totais por produção (Nati/Bruno) aparecem em badges.
4. Escolha o **mês de competência** (quando a planilha não traz o mês).
5. Clique em **Importar**. Errou? Cole de novo e importe — o mesmo mês é
   **substituído**, nunca duplicado.
6. Repita para cada seguradora do mês.

## Passo 2 — conferir

Abra **Relatórios** e selecione o mês no canto superior direito:

- Card **"Comissões recebidas das seguradoras"**: total do mês, Natália ×
  Bruno, por seguradora e a evolução de todos os meses.
- Card **"Fechamento para o financeiro"**: a faixa deve estar **verde**
  ("Conferido: bate centavo a centavo"). Se estiver vermelha ou houver aviso
  amarelo de código sem cadastro, resolva antes de enviar (cadastre o código
  do assessor em **Cadastros → Assessores**).

## Passo 3 — gerar e enviar o relatório do mês

No card **Fechamento para o financeiro**:

- **Pendências de classificação** (se aparecer o bloco amarelo): clique em
  "É da Nati"/"É do Bruno" para clientes sem produção e vincule o assessor
  nos que estão sem código — a correção vale para todos os meses daquele
  cliente, de uma vez.
- **Fechamento (CSV)** → a planilha do financeiro: uma linha por
  **assessor × seguradora** (código, nome, produção, clientes, lançamentos,
  recorrente/venda nova/campanha, estornos, comissão bruta, imposto, base
  líquida e as três partes da divisão), com subtotal por assessor e total
  geral do mês.
- **Imprimir / PDF** → o mesmo fechamento em página limpa para imprimir ou
  salvar em PDF (o navegador abre a janela de impressão sozinho).
- **Detalhado com códigos (CSV)** → cada lançamento com código do assessor,
  código do cliente, valor bruto, líquido e repasse do assessor — para
  auditoria e tirar dúvidas de pagamento.
- **Extrato da Natália (CSV)** no card *Controle da Natália* → mês a mês:
  bruto da produção dela, imposto, líquido, parte dela (40%), quanto disso é
  recorrente, indicações (código CS8868) e o ganho total.

> Fechamento líquido: rode a migração `011_fechamento_liquido.sql` no
> Supabase (uma vez) — ela grava o imposto (20%), a divisão 40/30/30 e o
> código CS8868 da Natália, e cria a view `vw_fechamento_assessor_seguradora`
> com o fechamento direto no banco.

> Meta de comissão recebida: rode a migração `010_meta_comissao_recebida.sql`
> no Supabase e defina o valor em Cadastros — o Dashboard passa a mostrar a
> barra "Comissão recebida (seguradoras)" nas Metas do mês.

## Extras

- **Enviar resumo (WhatsApp)** no card do fechamento: abre o WhatsApp com o
  resumo do mês pronto (total conferido, Natália × Bruno, por seguradora e
  repasse por assessor) — é só escolher o contato do líder e enviar.
- **Projeção de receita recorrente** no card Inteligência do mês: média da
  carteira recorrente dos últimos meses, claramente marcada como estimativa.
- **Histórico 2023–2024**: o arquivo `HISTORICO-2023-2024-Arrastar-em-Comissoes.csv`
  (gerado da matriz "Comissão Mês" da planilha geral) entra pelo mesmo
  arrastar-e-soltar. Lançamentos sem seguradora identificável entram como
  "Histórico" e os sem produção caem nas pendências para classificar com
  1 clique.

No card "Comissões recebidas": **Matriz cliente × mês** exporta a visão da
antiga aba "Comissão Mês" da planilha geral, agora sempre atualizada.

## Passo 3b — a conferência da planilha geral (antes de importar)

Ao subir o .xlsx em **Importar → Planilha geral**, o Hub agora mostra uma faixa
de **conferência** antes do botão de importar. Ela existe porque dois defeitos
da planilha não quebram nada — só produzem número errado com cara de certo:

- **PRÊMIO MES fora do PRÊMIO ANUAL.** A coluna mensal é calculada, e o cálculo
  quebrou: em julho/2026 são 65 linhas em que as duas colunas discordam (a
  fórmula aponta para a linha de outro cliente, ou o valor anual foi colado
  dentro da coluna mensal). **O Hub usa o PRÊMIO ANUAL**, que é o valor digitado
  do contrato — e lista as linhas divergentes para você conferir. Se quiser
  arrumar na origem, a coluna mensal deveria ser sempre `= anual ÷ 12`.
- **O código de um assessor na apólice de outro.** O Hub identifica o assessor
  pelo **código** primeiro; quando dois assessores aparecem com o mesmo código,
  a apólice de um vai para o outro no ranking, sem deixar rastro depois de
  importada. A faixa lista os códigos em conflito e os assessores que aparecem
  com mais de um código (o que divide a produção da mesma pessoa em duas).

Nada disso impede a importação — mas o conflito de código só você resolve,
corrigindo na planilha ou ajustando o assessor do cliente depois em Clientes.

> **Rode uma vez a migração `026_assessor_na_apolice.sql`** no SQL Editor do
> Supabase. Antes dela, o assessor morava só no cliente — e um cliente guarda
> **um** assessor, enquanto a planilha traz **um por linha de apólice**. Com a
> migração, cada apólice carrega o assessor da própria linha, que é o que o
> ranking precisa. Sem rodar, tudo continua funcionando pelo assessor do
> cliente (o comportamento antigo).

## Passo 4 — o ranking dos GB Awards (depois de subir a planilha geral)

A premiação do ano tem dois prêmios que saem da área de seguros: **maior
emissor** (quantidade de apólices) e **maior prêmio** (volume somado). Os dois
são apurados sozinhos a partir da **planilha geral** — depois de subi-la em
**Importar → Planilha geral (Seguros Fechados)**, abra **GB Awards** no menu
(atalho `g` depois `w`) e o ranking já está atualizado.

- A janela vai de **1º de janeiro a 30 de novembro** (o mês da premiação),
  pela **data de emissão** da apólice. O mês de fechamento é ajustável no topo
  da tela, se a regra do ano mudar.
- **Apólice cancelada não conta** — a menos que você ligue a opção "contar
  apólices canceladas".
- O bloco **"O que ficou de fora"** lista as apólices **sem assessor
  identificado**. Corrija o assessor desses clientes antes do fechamento:
  enquanto estiverem assim, essa produção não entra no ranking de ninguém.
- **Exportar CSV** dá o quadro completo (posição nos dois prêmios, apólices,
  prêmio mensal e anualizado, ticket médio, distância até o líder) e
  **Mandar no grupo** abre o WhatsApp com o pódio já escrito — é o recado
  mensal para os assessores, com quantos dias faltam para o fechamento.

---

## Perguntas frequentes

**Seguro com pagamento anual conta como?** A seguradora paga a comissão de
uma vez; o lançamento aparece no mês em que ela pagou (parcela única). Os
mensais aparecem todo mês. O fechamento sempre reflete o que **de fato** foi
pago no mês — é sobre isso que o financeiro paga.

**E estornos?** Entram com valor negativo e já saem abatidos do total do
assessor (a coluna Estornos mostra quanto foi).

**Vieram seguros do Bruno junto?** Sim, sempre — e ficam. A coluna Produção
separa Natália × Bruno em todos os relatórios; nada é excluído.

**O Dashboard não atualizou?** O card "Comissão recebida das seguradoras"
mostra o mês atual ou, se ainda não importado, o último mês disponível.
Recarregue a página após importar.
