# Rotina mensal de comissões — manual da Natália

O ciclo do mês tem 3 passos e leva menos de 10 minutos. O resultado final é o
**Fechamento para o financeiro**: a planilha que o líder usa para pagar cada
assessor, com todo mundo identificado pelo código e conferência automática.

---

## Passo 0 — só na primeira vez (carga histórica)

1. **Supabase**: rode a migração `009_comissoes_importadas.sql` no SQL Editor
   (uma vez só; a tabela `comissoes_importadas` aparece no Table Editor).
2. **Importar → Clientes/Leads**: cole o conteúdo de `cadastro-clientes.csv`
   (300 clientes da planilha geral, com códigos — os assessores são criados
   automaticamente com seus códigos).
3. **Importar → Apólices**: cole o conteúdo de `cadastro-apolices.csv`
   (349 apólices ativas da geral, com seguradora, prêmio, vigência, % e nº).
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
- **Fechamento (CSV)** → a planilha do líder: uma linha por assessor
  (código, nome, produção, clientes, lançamentos, estornos, total a repassar)
  com linha de total geral.
- **Imprimir / PDF** → o mesmo fechamento em página limpa para imprimir ou
  salvar em PDF (o navegador abre a janela de impressão sozinho).
- **Detalhado com códigos (CSV)** → cada lançamento com código do assessor E
  código do cliente — para auditoria e tirar dúvidas de pagamento.

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
