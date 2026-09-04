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

## 🧭 Navegação — três caminhos para o mesmo lugar

As três situações são diferentes, e por isso os caminhos também são:

| Situação | Caminho |
|---|---|
| Computador, com tempo | Menu lateral agrupado por seção, tudo à vista |
| Computador, com pressa | **Ctrl+K** (ou `/`) abre a paleta · `g`+inicial vai direto |
| Celular, em pé | Barra inferior com os 4 destinos do dia a dia + busca |

- **Paleta de comandos** — um campo só que acha **cliente, tela e ação**, pelo
  nome que a consultora usa e não pelo nome técnico: "funil" leva ao Pipeline,
  "whatsapp" às Mensagens, "planilha" ao Importar, "dps" à aba Formulário do
  cliente aberto. Setas e Enter navegam tudo — o mouse é opcional.
- **A aba do cliente mora na URL** (`/clientes/<id>/apolices`). F5 no meio da
  reunião mantém o lugar, o botão voltar devolve a aba anterior e o link colado
  no WhatsApp abre exatamente onde ela estava.
- **As 12 abas viraram mapa**: agrupadas pelo momento da consultoria (Reunião ·
  Relacionamento · Pós-venda) e com uma bolinha marcando as que **já têm
  conteúdo** — ela vê onde tem coisa sem abrir uma por uma.
- **Trilha no topo** respondendo "onde eu estou": seção → página → aba.
- **Atalhos**: `Ctrl K` busca, `?` a lista de atalhos, `g d` Dashboard, `g p`
  Pipeline, `g a` Agenda, `g c` Clientes, `g v` Pós-Venda, `g m` Mensagens,
  `g r` Relatórios, `g i` Importar, `g s` Cadastros, `g g` Guia. Nenhum deles
  dispara enquanto se digita num campo — pode escrever à vontade.
- **Teclado**: o primeiro `Tab` oferece pular o menu e ir direto ao conteúdo.
- **A paleta abre com o trabalho do dia, não com o histórico.** Sem digitar
  nada, o primeiro grupo é **"Precisam de você hoje"**: os cinco clientes de
  maior score, cada um com a próxima ação escrita ao lado. O banco já pontuava
  isso (`vw_prioridades_classificadas`) e o resultado só existia no Dashboard,
  atrás de uma navegação. Quem ela visitou por último é história; quem está
  esperando é trabalho — e agora `Ctrl K` responde "por onde eu começo?".
- **A busca alcança o INTERIOR do planejamento.** A aba mais longa do sistema
  tem quase cem campos, e achar a aba deixou de ser o problema: o problema é
  achar o bloco certo rolando com o polegar no meio da reunião. Digitar
  "benefici" com um cliente aberto leva direto a
  `/clientes/<id>/planejamento#sec-beneficiarios` — a âncora mora na URL, o
  botão voltar funciona e o link colado no WhatsApp abre no bloco exato.

Tudo isso nasce de um arquivo só, [`src/lib/navegacao.js`](src/lib/navegacao.js):
menu, barra do celular, paleta e ajuda de atalhos leem do mesmo mapa, então uma
tela nova nunca fica inalcançável por esquecimento.

## 📝 O cliente que não quer reunião

Existe um cliente que compra e não senta 40 minutos numa call. Ele responde no
WhatsApp às onze da noite, resolve tudo por link e some da agenda por três
semanas se a próxima etapa for "vamos marcar". Para ele, o Hub não tinha
caminho: o planejamento só existia dentro da aba da consultora, preenchida ao
vivo. Sem reunião não havia estudo, e sem estudo não havia proposta — a venda
morria de agenda, não de preço.

O link `/pl/<token>` é o planejamento virado do avesso: as mesmas perguntas,
escritas para serem respondidas sozinho, no celular. Doze blocos curtos, salvos
sozinhos, com **revisão final** antes de enviar.

Três decisões sustentam o desenho:

> **Ele preenche o diagnóstico, não a apólice.** Família, renda, custo de vida,
> dívidas, cada classe do patrimônio, a empresa, o que já tem de seguro e quem
> quer proteger — isso só ele sabe. Capital, coberturas e prêmio continuam saindo
> do motor e da cotação: pedir que o cliente escolha o próprio capital seria pedir
> que ele fizesse a consultoria, e é por não querer fazer isso que ele contrata
> alguém.

> **Branco não apaga.** A consultora pode ter anotado a renda numa ligação antes
> de mandar o link. Cada coluna é gravada como `coalesce(<respondido>, <atual>)`:
> o cliente só acrescenta, nunca zera o trabalho dela.

> **Nada segue com erro.** Cada bloco é conferido antes de avançar e o envio
> reconfere tudo de novo — não há ninguém ao lado para explicar mensagem de erro,
> e um formulário que falha no último clique é um cliente que não volta. Números
> fora de faixa são aparados **dentro** do que o banco aceita antes de chegar
> nele, e se ainda assim a gravação falhar, as respostas ficam salvas e a
> consultora recebe uma tarefa avisando.

Quando ele envia, as respostas viram o planejamento de verdade (a RPC grava nas
colunas do estudo) e nasce a tarefa de conferência. A consultora abre o cliente e
encontra o estudo montado — falta só revisar e precificar, que é a parte dela.

## 🧠 A inteligência do planejamento

O motor responde **quanto**. O [diagnóstico](src/lib/diagnostico.js) responde as
três perguntas que vêm depois:

1. **Quem é este cliente?** — perfil (provedor de família, sócio/empresário,
   patrimônio consolidado, sem dependentes, acúmulo), que define a **ordem** das
   coberturas. Um empresário com aval no banco e um casal com filho pequeno têm
   exposições diferentes; o estudo que trata os dois igual está errado para os dois.
2. **O que fazer com este estudo?** — recomendações ordenadas por um peso
   explícito: **gravidade × probabilidade × dinheiro em jogo** (relativo à
   exposição do cliente, não em valor absoluto) **× alinhamento com o foco que
   ele declarou**. Cada uma traz o `porque` com os números daquele cliente e uma
   frase pronta para dizer na reunião.
3. **O que ainda falta perguntar?** — pendências separadas das recomendações de
   propósito: recomendação é decisão, pendência é dado que falta. Misturar as
   duas faz a consultora apresentar um estudo achando que ele está pronto.

Duas regras governam o arquivo:

> **Palpite sem conta atrás é chute.** Recomendação que não sabe se justificar
> não é gerada — silêncio é melhor que confiança inventada.

> **Nada é aplicado sozinho.** Cada número entra no estudo só quando ela clicar.
> O sistema não esteve na reunião; ela esteve.

Tudo determinístico, sem rede e sem chave de API: o mesmo estudo dá sempre a
mesma resposta, que é o mínimo que se pede de algo que vai ser citado na frente
de um cliente. A qualidade desse conselho é medida por
[10.000 planejamentos auditados](docs/AUDITORIA.md) a cada `npm test`.

## 💰 As três ferramentas de preço

O motor sabia **quanto proteger** e não sabia **quanto custa**. O prêmio só
existia depois que a consultora cotava nas seguradoras e digitava o número — e
entre a reunião e a cotação passavam dias, que é justamente quando a venda
esfria. Pior: sem o preço de cada cobertura, ninguém respondia à segunda
pergunta da reunião, que é a que decide — *"e se tirar essa daqui, quanto cai?"*.

**1. A faixa de prêmio, por cobertura** ([`src/lib/premio.js`](src/lib/premio.js)).
Uma tabela de taxa mensal por R$ 1.000 de capital, ajustada pela curva de idade
com uma **elasticidade por cobertura** — morte acompanha a mortalidade inteira,
acidente quase não varia com a idade, doenças graves sobe mais rápido que as
duas. A saída é **sempre uma faixa, nunca um número seco**, e assimétrica para
cima, porque agravo de análise médica só empurra o preço nessa direção. Três
travas mantêm isso honesto: sem data de nascimento devolve `null` em vez de
chutar uma idade; acima da idade em que o mercado emite cada cobertura, avisa
por escrito em vez de só cobrar caro; e quando a cotação chega, **é ela que
manda** — a estimativa vira só uma conferência ("a cotação veio 60% acima da
faixa: houve agravo, ou entrou cobertura a mais?").

**2. Os três níveis do plano** ([`src/lib/niveis.js`](src/lib/niveis.js)).
Com uma opção só, a reunião termina numa pergunta fechada e o preço vira o
único assunto que sobra. Com três, o cliente escolhe entre *menos* e *mais*,
que é uma decisão que ele toma na hora. **Essencial** é o núcleo do risco
*deste* cliente (o perfil do diagnóstico define a ordem, e dívida avalizada ou
saldo devedor entram sempre — um "essencial" que deixa a família devendo não é
essencial); **Recomendado** é o que a consultora desenhou; **Completo** é o
estudo sem cortes. Cada nível carrega a lista do que **fica de fora**, com o
risco por escrito: comparativo que só mostra o que cada coluna tem é folheto,
não é decisão. Na proposta que o cliente vê, os valores são **ancorados na
cotação real** — a estimativa entra só na proporção entre os níveis.

**3. O plano que cabe no orçamento.** O estudo já sabia dizer "o prêmio não
cabe na sobra do cliente" e parava aí, que é o pior lugar possível: ela sabe
que vai cancelar e não sabe o que tirar. Cortado no chute, o primeiro a sair é
sempre a invalidez — a cobertura mais provável de todas, porque é a que o
cliente entende menos. A ferramenta monta o plano na **ordem do risco** dentro
do teto, e lista o que ficou de fora com quanto faltaria para entrar.

## 🛡️ "Já tenho seguro pela empresa"

É a objeção mais comum da categoria, e o sistema **concordava com ela**:
`cobertura_atual` era um número só, abatido inteiro do capital de morte como se
todo real de apólice existente fosse dinheiro portátil que chega à família.

Agora cada apólice é listada com a origem, e a origem decide tudo:

| O que ele tem | O que acontece de verdade |
|---|---|
| **Individual, custeada por ele** | É dele, acompanha-o e paga a quem ele indicou. Esta o estudo **deve** abater — senão vende duas vezes a mesma proteção. |
| **Vida em grupo da empresa** | Acaba no dia em que o vínculo acaba — e o vínculo raramente acaba num bom momento. Proteção emprestada, não patrimônio. |
| **Prestamista do banco / consignado** | O beneficiário é o **banco**. Quita a dívida (que o estudo já desconta à parte) e não entrega um real. Abatida do capital, some duas vezes da conta. |

O estudo passa a expor `gapPortavel` — o que falta de proteção descontando só o
que é realmente dele — e `capitalQueEvapora`. O número que abre a conversa vira
concreto: *"hoje faltam R$ 2 mi; no dia em que você sair da empresa, faltam
R$ 2,85 mi — e você recontrata pelo preço da idade que tiver na hora"*. O
custeio manda sobre a origem: uma apólice "individual" paga pela empresa é
benefício de emprego com outro nome.

## 🩺 "Isso sai, e em quanto tempo?"

A pergunta que vem depois do aperto de mão, e que mata venda **já ganha**. A
consultora dizia "uns dez dias", o caso ia para exame e perfil financeiro,
voltava em 45 dias com um agravo que ninguém avisou, e o cliente — que já tinha
decidido comprar — desistia. Não porque o produto piorou: porque a promessa
quebrou. Cliente perdoa preço; não perdoa surpresa.

[`src/lib/subscricao.js`](src/lib/subscricao.js) é o que um subscritor
experiente sabe de cabeça, escrito para ela saber **antes de prometer**:

- **o que a seguradora vai exigir** neste capital e nesta idade — de DPS simples
  a exames, perfil financeiro e resseguro facultativo;
- **quanto tempo isso leva**, com o prazo crescendo por capital *e* por idade
  (acima dos 60 a análise é mais criteriosa mesmo quando o exame já era exigido);
- **o que encarece** (profissão, fumante, IMC, atividades de risco) — com o
  aviso de que seguradora soma pontos de mortalidade, não multiplica agravos;
- **o que pode NÃO estar coberto**, que é coisa diferente e muito pior: agravo é
  preço, restrição é o cliente se achar coberto justamente na hora de maior risco;
- **o que separar ainda na reunião** — o processo quase nunca trava por decisão
  do cliente, trava por um PDF que ele tinha no celular no dia em que disse sim.

## 🗣️ O que ele vai dizer, e o que responder

A transcrição já detectava objeção **depois** da reunião, com a resposta certa
em abstrato. [`src/lib/objecoes.js`](src/lib/objecoes.js) faz as duas coisas que
faltavam.

**Prever.** O estudo já sabia quais objeções este cliente vai levantar e nunca
disse. Prêmio em 14% da renda? "Está caro" vai aparecer — e é dada como *certa*,
não como possibilidade. Vida em grupo na carteira? "Já tenho seguro pela
empresa". Jovem sem dependentes? "Não é prioridade agora". A probabilidade sai
de condições explícitas sobre os números do estudo, não de um ranking fixo.

**Responder com número.** "Sai por R$ 4,20 por dia" derruba "está caro" de um
jeito que "mas é a segurança da sua família" nunca derrubou. Todo argumento
carrega números do estudo, e a objeção some quando o número que a sustenta não
existe — meia resposta é dita com a mesma confiança da inteira.

E cada uma traz o **`naoDiga`**: a parte que nenhum material de treinamento
escreve e que mais decide a conversa. A resposta errada para "vou pensar" não é
uma resposta fraca — é uma que fecha a porta. Os `id` batem com os da
transcrição, então o que foi **detectado na gravação** encontra a resposta já
calculada para aquele cliente e vira munição de follow-up.

## ⚖️ Quem recebe o capital

A proposta inteira se apoia em *"o seguro não passa por inventário, chega em
dias"*. É verdade e tem base legal — e o sistema nunca guardou uma linha sobre a
**indicação de beneficiário**, que é exatamente onde a promessa se cumpre ou se
quebra.

| O que a lei diz | Referência |
|---|---|
| O capital segurado **não é herança**: fora do inventário, fora do ITCMD, fora do alcance dos credores | CC, art. 794 |
| Sem indicação válida, metade vai ao cônjuge e o resto aos herdeiros legais | CC, art. 792 |
| Companheiro(a) pode ser beneficiário, nas condições do artigo | CC, art. 793 |
| O beneficiário **não paga IR** sobre o capital recebido | Lei 7.713/88, art. 6º, XIII |

E o alerta que justifica o arquivo: **beneficiário menor**. A seguradora paga,
mas o dinheiro fica sob representação legal e o uso costuma depender de
autorização judicial — meses de espera pelo capital contratado precisamente para
não haver espera. Acontece com o cliente que fez tudo certo: o pai que indicou
os filhos. A correção leva dez segundos na proposta de contratação, e o sistema
passa a cobrá-la antes da assinatura em vez de a família descobrir depois.
[`src/lib/beneficiarios.js`](src/lib/beneficiarios.js) confere ainda a soma dos
percentuais, a data de nascimento que falta e o cônjuge ausente da lista — que
pode ser deliberado, e por isso é pergunta e não acusação.

## 🧩 Módulos

- **Dashboard** — KPIs do mês, comissão da Natália, gráfico de evolução, divisão
  de comissões, Top 5 assessores (com taxa de conversão), visão do funil e a
  **Central do Dia** (tarefas, atrasos, aniversários e leads estagnados).
- **Pipeline** — Kanban com arrastar-e-soltar, dias parados com alerta
  amarelo/vermelho configurável, motivo obrigatório ao perder um cliente.
- **Clientes** — perfil 360º com abas: Planejamento (dados da reunião — ou
  preenchidos pelo próprio cliente, pelo link),
  **Comparador** (seguro resgatável × previdência, com o gráfico do cruzamento),
  Roteiro, **Transcrição** (análise da gravação do Tactiq), Reuniões, Apólices,
  **Documentos** (anexos no Storage), Formulário de onboarding, Tarefas e
  Histórico. Faixa de **Próxima Melhor Ação** e
  temperatura no topo. Botão **Gerar proposta** cria a apresentação.
- **Proposta** — apresentação em tela cheia com navegação de deck (setas do
  teclado, bolinhas laterais, contador) e **modo apresentação**: tela cheia de
  verdade, tela sempre acesa, um slide por vez e a **Apple Pencil desenhando
  por cima do slide** — caneta com pressão, marcador, borracha, laser e
  simulação ao vivo dos números, tudo dentro da página (vai junto no
  compartilhamento de tela do Meet). Capítulos: capa, diagnóstico, "quanto tempo a
  família aguentaria hoje?" (sem vender nada × vendendo tudo × com o plano),
  capital recomendado, futuro dos filhos, **raio-X do patrimônio** (o que trava
  no inventário e o que vai direto ao beneficiário), sucessão com a conta do
  primeiro mês, **planejamento empresarial** (acordo de sócios, homem-chave e
  aval), gap, o quadro completo da apólice e **o investimento** — mensal e
  anual lado a lado, com o desconto à vista e a economia calculada. Exportável
  em PDF pelo navegador.
- **Formulário público** (`/f/<token>`) — onboarding pós-venda estilo Typeform:
  etapas curtas, progresso salvo automaticamente (o cliente pode parar e voltar),
  sem login, seguro por token via RPC. Campos configuráveis em
  `src/lib/formularioConfig.js`.
- **Planejamento por link** (`/pl/<token>`) — **para o cliente que não gosta de
  reunião**. O mesmo estudo da aba Planejamento, virado do avesso: doze blocos
  curtos que ele responde pelo celular, no horário dele. Cobre família, filhos e
  quanto custam, renda e custo de vida, dívidas, o **raio-X do patrimônio por
  classe**, previdência, empresa (só aparece se houver PJ), aposentadoria, os
  seguros que ele já tem, perfil de risco e beneficiários. Termina numa **tela de
  revisão** com botão de editar em cada bloco — o zero a mais na renda é pego ali,
  e não na apresentação. Ao enviar, as respostas **viram o planejamento** (a RPC
  grava direto nas colunas do estudo) e nasce uma tarefa de conferência: a
  consultora abre o cliente e encontra o estudo montado, pronto para revisar e
  precificar. O link é gerado no topo da aba Planejamento, com envio por WhatsApp
  em um clique.
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
- **GB Awards** — o ranking do ano na área de seguros, com os **dois prêmios**
  que a premiação de novembro entrega: **maior emissor** (quantidade de apólices
  emitidas) e **maior prêmio** (volume somado). Apura direto da planilha geral —
  ninguém digita ranking: subiu a planilha do mês, o pódio se move. Janela de
  1º de janeiro ao fechamento (novembro, ajustável), pela **data de emissão** da
  apólice; cancelada não conta (opcional); apólice sem assessor volta separada
  para ser corrigida antes do fechamento. Traz a corrida em barras, a distância
  de cada um até o líder, a projeção no ritmo atual, o quadro completo em CSV e
  o resumo pronto para o grupo do WhatsApp.
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

### Testes

```bash
npm run build && npm test        # lint + motor + ponta a ponta
```

Ou em separado: os que não precisam de navegador — `npm run test:formato`,
`npm run test:motor`,
`npm run test:planejamento`, `npm run test:plano-publico`, `npm run test:premio`,
`npm run test:premiacao`,
`npm run test:conhecimento`,
`npm run test:transcricao`, `npm run test:comparador`, `npm run test:apresentacao`
— e `npm run test:e2e`, que agora **constrói sozinho** antes de rodar (antes
falhava num clone novo dizendo que faltava o `dist/`, e só a CI acertava porque
buildava antes).
A suíte de navegador sobe o servidor de preview sozinha
(e reaproveita um que já esteja rodando), então basta um terminal.

**`test:formato`** — as funções mais vistas do sistema e as últimas a ganhar
teste. `format.js` não calcula nada: só decide como cada número e cada data
**aparecem** — e por isso nenhum defeito ali quebra uma tela, todos apenas
fazem a tela dizer a coisa errada com naturalidade. Foi assim que passaram
despercebidos um `tempoRelativo` que virava "ontem" a partir das 21h (a mesma
virada de dia que o próprio arquivo já corrigira duas vezes, em `hojeLocal` e
`mesLocal`), um "há NaN ano(s)" escrito por extenso quando a data era inválida,
e um "R$ 1.000 mil" para tudo entre R$ 999.500 e R$ 999.999. O teste fixa
`TZ=America/Sao_Paulo` antes do primeiro `Date` e **confere que fixou**: rodando
em UTC, como roda a CI, o defeito do fuso não existe e o teste passaria sem
provar nada. O que se confere é o fuso de quem usa o sistema, não o da máquina
que roda o teste.

**`test:motor`** — `calcularEstudo()` é a única fonte dos números do
planejamento *e* da proposta: se ele erra, a consultora apresenta o erro para
o cliente. O teste joga 4.000 combinações de entrada (inclusive negativo,
texto, vazio, 10^18) e 2.000 transcrições montadas ao acaso, cobrando
invariantes que precisam valer sempre — nada de NaN/Infinity/negativo na tela,
patrimônio bruto igual à soma das classes, custo do inventário nunca maior que
o que trava, maior evento indenizável nunca maior que a soma das importâncias,
porcentagens dentro de 0–100. Reproduzível: `CASOS=20000 SEMENTE=7 npm run
test:motor`.

**`test:planejamento`** — a auditoria dos **10.000 planejamentos**. O
`test:motor` prova que o estudo não *quebra*; este prova que o conselho está
*certo*, que é outra coisa e é mais difícil: um motor que devolvesse zero em
tudo passaria no fuzz com louvor. Aqui as entradas não são aleatórias, são
gente — o CLT de 28 anos sem filhos, a médica autônoma com três crianças, o
empresário com sócio e aval no banco, a viúva resolvendo o inventário do
marido, o casal sem filhos, quem só quer cobrir o financiamento por 20 anos.
Nove públicos, quinze arquétipos, com lacunas de preenchimento como acontece
na vida real. Sobre cada estudo passam **37 regras de revisão**, cada uma
sendo algo que um consultor sênior apontaria: capital que nenhuma seguradora
emite, prêmio que não cabe no bolso do cliente, proteção vendida para quem não
precisa dela, o mesmo dinheiro contado duas vezes em dois lugares do estudo,
pergunta decisiva que o sistema deixou de fazer. Os tetos de mercado ficam
**dentro do teste**, não importados do motor — auditor que usa as constantes do
auditado só confirma que o sistema concorda consigo mesmo. Rode
`npm run auditoria` para o relatório completo, com o percentual e um caso
concreto por regra; `CASOS=50000 SEMENTE=42 npm run auditoria` para outra
bateria. **A primeira execução reprovou em 16 regras, 8 delas graves** — o que
foi corrigido está listado em [`docs/AUDITORIA.md`](docs/AUDITORIA.md).

**`test:premio`** — as ferramentas que **precificam** a apólice produzem números
ditos em voz alta na reunião, e duas delas fazem promessas que não podem ser
quebradas por arredondamento. São 58 conferências mais um fuzz de 10.000
estudos, cobrando o que precisa valer sempre: na idade de referência o preço é
exatamente a taxa da tabela (a âncora de tudo o mais); mais capital nunca custa
menos e mais idade nunca custa menos, em **toda** cobertura; franquia maior
barateia a DIT e quadruplicar as diárias **não** quadruplica o prêmio; a faixa
sempre contém o centro e é assimétrica para cima; a escada de níveis nunca fica
fora de ordem (nenhum degrau mais caro entregando menos capital); o plano que
cabe **nunca estoura o teto** nem deixa de fora algo que ainda cabia na sobra;
e a carteira existente sempre fecha — portátil + condicionada + prestamista =
total. As regras **R25–R31** levam as mesmas cobranças para os 10.000
planejamentos da auditoria, agora gerados também com apólices existentes
misturadas (vida em grupo, prestamista, individual antiga), porque código novo
que não passa pelo teste que mais protege o sistema é código não testado.

**`test:premiacao`** — a apuração dos **GB Awards**. É o único número do sistema
que decide **quem sobe no palco**: se errar, alguém recebe um troféu que não é
dele, e o erro só aparece quando já não dá para desfazer. São 60 conferências
sobre o que a premiação precisa garantir: a janela do ano começa em 1º de
janeiro e termina em 30 de novembro (a apólice do dia 30 entra, a de dezembro
não, a do ano passado também não); apólice cancelada não premia, a menos que o
escritório mande; os **dois prêmios sabem ter donos diferentes** (muitas
pequenas × poucas grandes); empate no topo vira dois primeiros e o próximo é o
**terceiro**, não o segundo; apólice sem assessor não some nem premia — volta
separada para ser corrigida; e a conta fecha do jeito que uma auditoria refaz
na mão (ranking + sem assessor = tudo que entrou na janela, prêmio anual =
mensal × 12, a série mês a mês somando o total do ano).

**`test:planilha`** — o **leitor da planilha geral**, que é a porta de entrada de
todos os números da carteira. Os casos não são hipóteses: são os defeitos reais
da planilha de julho/2026, em miniatura. A coluna **PRÊMIO MES** é calculada e o
cálculo dela quebrou — em 65 das 342 linhas com os dois valores ela discorda do
**PRÊMIO ANUAL** em mais de 1% (em 43 delas, mais de 50%), porque a fórmula
aponta para a linha de outro cliente, porque alguém colou o valor anual dentro
da coluna mensal, ou porque sobrou `#REF!`. O teste cobra que o **anual mande**
(é o valor digitado, o do contrato), que a mensal só entre quando não há anual,
que arredondamento de ÷12 não vire alarme — e que o ranking que sai do leitor
seja o mesmo que sai dos contratos. Cobra também a conferência de cadastro: o
mesmo código em duas **pessoas** é acusado, "Romário" e "Romário Almeida" não.

**`test:conhecimento`** — as três camadas que produzem **texto lido em voz alta**
na reunião, e afirmações que o cliente pode conferir com o advogado dele. O que
se cobra aqui é diferente do que se cobra de um motor de cálculo: que a
subscrição nunca seja otimista por engano (prazo que só cresce com capital e
idade, restrição sempre dita, agravo nunca escondido); que nenhuma objeção saia
pela metade, porque meia resposta é dita com a mesma confiança da inteira; e que
**beneficiário menor SEMPRE dispare o alerta**, que é a promessa que não pode
falhar nunca. São 65 conferências mais um fuzz de 10.000 estudos, e as regras
**R32–R36** levam as mesmas cobranças para os 10.000 planejamentos da auditoria.
A primeira execução reprovou numa: aos 64 anos o prazo saía igual ao de um
cliente de 30 sempre que o capital já exigia exame — e o modelo estava errado,
não o teste.

**`test:transcricao`** — o fuzz prova que a análise não explode; isso não prova
que ela extrai CERTO (um parser que devolve lista vazia passa em qualquer teste
de robustez). Aqui cada caso é um pedaço de reunião escrito do jeito que as
pessoas falam — "a Alice tem 6 e o Lucas 9", "ganho uns quarenta e oito mil",
"a clínica fatura 4,2 milhões" — com o resultado esperado declarado ao lado.
Quando o parser regride, o teste diz qual frase parou de ser entendida.

**`test:comparador`** — o teste mais importante do arquivo mais delicado: os
números do comparador vão para um gráfico apresentado contra o assessor de
investimentos do cliente, e um erro de tributação não aparece como tela
quebrada — aparece como afirmação falsa numa reunião. Cada caso tem o
**resultado calculado à mão** (taxa zero, aportes exatos), não uma expectativa
colhida da própria implementação: a alíquota certa em cada faixa da regressiva,
VGBL tributando só o ganho e PGBL o total, a dedução do PGBL limitada aos 12%
da renda, e o ano do cruzamento numa conta redonda.

**`test:e2e`** — seis suítes. A **principal** navega o sistema inteiro
nas duas visões — consultora (login, dashboard, pipeline, cliente 360 com o
planejamento completo, transcrição da reunião, apólices, DPS, proposta,
relatórios com fechamento, pós-venda, agenda, mensagens, cadastros) e cliente
(formulário público de DPS pelo link); a de **erros de usuário** ataca os
caminhos que quebram sistemas:
link inválido, formulário já concluído, obrigatórios vazios, proposta sem
planejamento, rota inexistente, venda com comissão automática, popups de
dossiê/DPS, pendências de classificação, busca, exclusão com confirmação,
celular (375px) e F5. A de **navegação** cobre a parte em que ninguém repara
até quebrar: a aba do cliente que precisa sobreviver ao F5 e ao botão voltar, o
link colado no WhatsApp abrindo na aba certa, o slug inválido que não pode dar
tela branca, a paleta achando tela por sinônimo ("funil" → Pipeline, "whatsapp"
→ Mensagens, "planilha" → Importar), os atalhos `g`+tecla — inclusive o teste
de que digitar "gd" dentro de um campo **não** teletransporta a página —, a
trilha respondendo "onde eu estou", e o celular a 375px com a barra inferior
colada embaixo, sem tapar o conteúdo e sem rolagem lateral. A de
**planejamento** usa a aba como a consultora usa,
com o cliente na frente: valores hostis campo a campo, o estudo preenchido, a
alteração não salva que precisa sobreviver à troca de aba, o dado que tem que
voltar ao sair e retornar no cliente, o roteiro que leva ao bloco certo e a
proposta sem número quebrado. A **varredura geral** passa por TUDO: cada
rota e cada aba do Cliente 360, no computador e no celular, com clientes em
quatro estados — do lead recém-cadastrado (sem nada preenchido) ao PF+PJ
completo, mais um cliente perdido. Em cada parada cobra que não haja erro de
console, NaN/Infinity/undefined na tela, tela em branco nem rolagem horizontal
a 375px — apontando o elemento culpado quando falha. Capturas em `e2e-shots/`.

A de **acessibilidade** cobra o que sobra da tela quando o conteúdo dela some,
que é a situação de quem usa leitor de tela: todo controle com nome, todo campo
com rótulo, toda imagem com alt e exatamente um `h1` por página. Ela audita o
**DOM depois do React montar**, não o JSX — um `aria-label` que a build
derrubasse não passaria —, e passa por 11 rotas no computador, as 13 abas do
Cliente 360 e as mesmas 11 rotas no celular, onde a barra inferior e a busca são
outros controles. O retrato inicial era melhor do que parecia (nenhum botão sem
nome, nenhuma imagem sem alt), e o buraco estava todo nos campos: as dez caixas
da lista de tarefas anunciadas só como "caixa de seleção" — dez chances de
concluir a errada —, as catorze coberturas do planejamento soando todas iguais
("R$, campo de edição", porque em `CampoCobertura` o rótulo é um `<p>` e não um
`<label>`) e o seletor de etapa do funil, mudo no topo das treze abas. Onde o
controle vive numa lista de linhas iguais, o nome carrega o dado da linha
("Situação da reunião de 13/03/26", "Concluir: Revisão anual da apólice") — um
rótulo genérico deixaria dez controles indistinguíveis do mesmo jeito. A régua é
**zero**, não "poucos": um controle sem nome não incomoda um pouco, ele não é
utilizável — e zero é a única régua que não afrouxa sozinha com o tempo.

### Peso da página

Os originais da marca são de impressão: 1400×520 e 800×800, ~100 kB cada. Na
tela eles nunca passam de 64 px de altura — o navegador baixava **200 kB para
desenhar um logo do tamanho de uma unha**, em toda página do sistema (o
monograma mora na barra lateral) e, o que importa mais, nas páginas do
**cliente**, que ele abre no celular, à noite, no 4G: o formulário e o
planejamento por link começam pelo logo, antes de qualquer outra coisa.

`srcSet` resolve sem tirar nada de ninguém: versões pequenas atendem a tela e o
original continua disponível para retina e para a proposta impressa. O
navegador baixa uma só, e `sizes` diz qual — convertido pela proporção, porque
a marca é dimensionada pela ALTURA e o `sizes` é declarado em largura. Nenhum
arquivo foi re-encodado; os originais estão intactos.

| | antes | depois |
|---|---|---|
| Login | 97 kB | **9 kB** |
| Qualquer tela do sistema | ~200 kB | **15 kB** |
| Login em retina (2×) | 97 kB | **31 kB** |

O motor do estudo, que recalcula a cada tecla digitada no planejamento, leva
**0,073 ms** por chamada — medido, não estimado. Não há memoização em volta
dele de propósito: seria complexidade para resolver um problema que não existe.

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
19. [`supabase/migrations/019_planejamento_completo.sql`](supabase/migrations/019_planejamento_completo.sql)
20. [`supabase/migrations/020_transcricoes_reuniao.sql`](supabase/migrations/020_transcricoes_reuniao.sql)
21. [`supabase/migrations/021_planejamento_inteligente.sql`](supabase/migrations/021_planejamento_inteligente.sql)
22. [`supabase/migrations/022_comparador.sql`](supabase/migrations/022_comparador.sql)
23. [`supabase/migrations/023_apresentacao.sql`](supabase/migrations/023_apresentacao.sql)
24. [`supabase/migrations/024_estado_e_prazo_divida.sql`](supabase/migrations/024_estado_e_prazo_divida.sql)
25. [`supabase/migrations/025_subscricao_e_beneficiarios.sql`](supabase/migrations/025_subscricao_e_beneficiarios.sql)
26. [`supabase/migrations/026_assessor_na_apolice.sql`](supabase/migrations/026_assessor_na_apolice.sql)
27. [`supabase/migrations/027_cirurgias.sql`](supabase/migrations/027_cirurgias.sql)
28. [`supabase/migrations/028_proposta_publica_idade.sql`](supabase/migrations/028_proposta_publica_idade.sql)
29. [`supabase/migrations/029_planejamento_por_link.sql`](supabase/migrations/029_planejamento_por_link.sql)

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
│   │   ├── estudo.js             # Motor do estudo: todo número da proposta
│   │   ├── diagnostico.js        # A leitura do estudo: perfil e recomendações
│   │   ├── premio.js             # Faixa de prêmio por cobertura (estimativa)
│   │   ├── niveis.js             # Essencial/Recomendado/Completo + o que cabe
│   │   ├── subscricao.js         # "Isso sai?": exigências, prazo, agravo e restrições
│   │   ├── objecoes.js           # O que ele vai dizer, respondido com os números dele
│   │   ├── beneficiarios.js      # Quem recebe — e o que trava (CC 792/793/794)
│   │   ├── comparador.js         # Seguro × VGBL/PGBL, ano a ano
│   │   ├── premiacao.js          # GB Awards: maior emissor e maior prêmio do ano
│   │   ├── transcricao.js        # Análise da gravação da reunião
│   │   ├── apresentacao.js       # Traço da caneta, borracha e simulação
│   │   ├── roteiroApresentacao.js# Para QUEM se fala: ordem, títulos e falas
│   │   ├── telaDeApresentacao.js # Tela cheia e tela acesa (iPad/Safari)
│   │   ├── formularioConfig.js   # Perguntas do formulário de onboarding (DPS)
│   │   └── planejamentoPublico.js# Perguntas do planejamento que o cliente preenche
│   ├── components/               # Layout (sidebar) + componentes de UI
│   └── pages/                    # Dashboard, Pipeline, Clientes, Cliente 360º,
│                                 # Pós-Venda, Cadastros, Proposta, Login,
│                                 # Formulário público (/f/<token>) e
│                                 # Planejamento por link (/pl/<token>)
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
- [x] **Planejamento completo** (migração 019): tipo de estudo (PF, PJ ou os
      dois) e focos; raio-X do patrimônio por classe, com previdência fora do
      inventário e o déficit de liquidez calculado; bloco empresarial com
      acordo de sócios, homem-chave e dívidas avalizadas
- [x] **Apólice inteira no estudo**: morte acidental, fraturas, **cirurgias**
      (migração 027), diária de internação hospitalar (DIH) e assistência
      funeral individual e familiar, além das diárias com limite de dias e
      franquia. Cirurgias é a cobertura mais ACIONADA de todas e a que responde
      ao "eu já tenho plano de saúde": o convênio cobre o procedimento e não
      cobre a coparticipação, o material fora do rol, o cirurgião de escolha
      dele nem as semanas de recuperação sem faturar
- [x] **Prêmio mensal e anual** lado a lado: o desconto à vista aparece na
      proposta com a economia calculada, e o cliente escolhe a forma
- [x] **Nada se perde durante a reunião**: o planejamento se grava sozinho
      pouco depois que ela para de digitar, descarrega o que estiver pendente
      ao sair da aba, avisa antes de fechar o navegador e mostra o estado
      ("Salvando…", "Salvo às 14:32") numa barra fixa com Salvar e Proposta
      sempre ao alcance
- [x] **Roteiro do preenchimento**: a espinha do estudo em uma linha — cada
      bloco com o que já está em pé ("renda R$ 48 mil", "13 na apólice") e um
      clique que leva direto até ele, na ordem da conversa com o cliente
- [x] **A idade entra no estudo** (a data de nascimento já estava no cadastro e
      nunca tinha sido lida): janela real de proteção — o mais longo entre o
      filho mais novo virar adulto e o titular chegar à aposentadoria — e o
      **preço de deixar para depois**, com a mesma apólice em 1, 3 e 5 anos
      pela curva de agravamento por idade (estimativa, sempre rotulada)
- [x] **Sucessão de verdade** (migração 021): herdeiro menor obriga rito
      judicial (18 meses em vez de 6), holding corta as custas mas não o ITCMD,
      testamento não antecipa o imposto, e a **meação** entra só quando é certa
      — em comunhão parcial o estudo avisa quanto pode ser meação em vez de
      descontar por conta própria
- [x] **Previdência líquida de IR**: o extrato mostra o bruto, a família saca o
      líquido. PGBL é tributado sobre o total resgatado, VGBL só sobre o
      rendimento — e é o líquido que paga o inventário
- [x] **Comparador: seguro resgatável × VGBL/PGBL** (migração 022) — a prova
      numérica e gráfica. A consultora cola a tabela de resgate da cotação (o
      sistema interpola o meio, não inventa valor) e recebe a série ano a ano
      com a tributação certa dos dois lados: o **gráfico do cruzamento**, com a
      área hachurada do que faltaria à família, o **custo real da proteção** por
      mil de capital ao ano, e o quadro das dimensões que não são dinheiro
      (isenção de IR, inventário, impenhorabilidade, dedução do PGBL).
      A comparação é **de propósito justa**: credita a dedução de até 12% da
      renda no PGBL, usa a tabela regressiva de verdade e admite em voz alta
      que num horizonte longo sem sinistro o investimento acumula mais — é isso
      que a torna difícil de derrubar
- [x] **Modo apresentação com Apple Pencil** (migração 023) — a consultora
      apresenta pelo iPad compartilhando a tela no Meet, e a proposta deixa de
      ser um deck mudo. Botão **Apresentar**: tela cheia, tela sempre acesa
      (Wake Lock), rolagem que encaixa **um slide por vez** e uma barra de
      controles ao alcance do polegar, com alvos de 48px, que ela recolhe num
      toque quando quer a tela limpa.
      - **Caneta com pressão de verdade** (Pointer Events + eventos agrupados),
        **marcador** que grifa sem esconder o texto, **borracha** que apaga o
        traço inteiro ao encostar, e **laser** com rastro que apaga sozinho —
        gesto, nunca anotação.
      - **Rejeição de palma**: assim que uma caneta encosta no aparelho, o dedo
        para de desenhar. Sem isso, cada palavra escrita vem com o borrão do
        punho apoiado.
      - Os traços são **vetor em coordenadas relativas (0 a 1)**, guardados por
        **nome de capítulo** — o mesmo círculo funciona no iPad em pé, no
        deitado, no computador e no celular do cliente, e um cliente que ganha
        o capítulo da empresa não vê a anotação escorregar para o slide errado.
      - **Simulação ao vivo**: "e se fosse R$ 1.200?" muda o número na frente
        do cliente e a proposta inteira se recalcula — capital, gráficos,
        comparador. **Nada é gravado**, e uma etiqueta amarela diz isso o tempo
        todo; o planejamento continua sendo a fonte da verdade.
      - **A liberdade de decidir é dela**: o sistema não guarda o desenho
        sozinho nem joga fora sozinho. Na saída, e só quando há mesmo algo
        novo, ele pergunta — guardar, descartar ou voltar à apresentação. E
        fechar a aba com desenho pendente avisa antes.
- [x] **A apresentação vira conversa** — o que a tira de "deck bonito" e a
      coloca na reunião:
      - **Revelação por etapas**: um slide que abre com tudo escrito já
        entregou o final — o cliente lê antes de ela falar e a conversa vira
        legenda do slide. Com a revelação ligada, os cartões aparecem um a um
        no ritmo dela. A seta e a barra de espaço revelam primeiro e só depois
        viram o capítulo; **voltando, o capítulo aparece inteiro**, porque é
        um que ela já explicou.
      - **Seta** que sai reta de um ponto ao outro, com a ponta fechada e
        proporcional — "daqui vai para cá" é meia conversa de reunião, e à mão
        livre no iPad a seta sai torta.
      - **Três espessuras**: fino para escrever um número dentro do texto,
        grosso para circular um título de longe.
      - **Desfazer e refazer de verdade** (Ctrl+Z / Ctrl+Shift+Z), com
        histórico de estados: **a borracha passa a ter volta**. Antes, encostar
        sem querer num traço que sustentava o argumento o perdia para sempre,
        no meio da reunião. Um arrasto de borracha é um passo só.
      - **Pular capítulos nesta reunião**: um solteiro sem filhos não precisa
        do capítulo de sucessão, e passar por ele "porque está no roteiro" é o
        que torna a apresentação chata. Ela desliga no índice e a navegação
        passa por cima — sem apagar nada do estudo.
      - **Atalhos** para quem apresenta pelo computador ligado na TV: A/L/C/M/
        S/E trocam a ferramenta, 1 a 5 trocam a tinta, B apaga a tela,
        Home/End vão às pontas.
      - **Cronômetro** da reunião e **tela preta** num toque.
- [x] **A apresentação se adapta a quem está do outro lado da mesa**
      (`roteiroApresentacao.js`) — o deck era correto e genérico: o mesmo
      capítulo, na mesma ordem, com o mesmo título, para o pai de família de 34
      anos e para o empresário de 61 que veio tratar do inventário da holding.
      O perfil do cliente já era classificado pelo diagnóstico e a apresentação
      nunca tinha usado essa informação para nada.
      - **Cinco públicos, um por perfil**: provedor de família, sucessão e
        patrimônio, sócio/empresário, sem dependentes, acúmulo e aposentadoria.
        Cada um tem um EIXO — o assunto que carrega a reunião inteira.
      - **A ordem muda, o arco não**: entender → tomar consciência → ver a
        solução → ver o preço → decidir vale para todo mundo (mudar isso
        produziria decks irreconhecíveis entre si). O que muda é quem abre a
        consciência: quem veio por sucessão vê o inventário logo depois do
        reenquadramento, e a autonomia da família vem depois; quem não tem
        dependentes vê primeiro o que a apólice paga com ele VIVO.
      - **Os títulos que o cliente lê mudam com ele**: "se a renda parasse
        hoje, por quanto tempo a família manteria o padrão?" é uma pergunta
        excelente para um provedor e sem sentido para quem mora sozinho — e um
        cliente que lê uma pergunta sem sentido para ele conclui, corretamente,
        que o estudo é de prateleira. A capa, o reenquadramento, o número, o
        plano e o fechamento têm versão por eixo.
      - **O que sai da reunião sai com o motivo escrito**: sem dependentes, o
        capítulo do padrão de vida da família sai do caminho; quem não investe
        nem aporta em previdência não recebe os três capítulos que debatem
        "investir ou proteger" — era a apresentação criando a objeção em vez de
        responder a ela. Nada é apagado: o índice mostra por quê, um toque traz
        de volta, e o PDF e o link do cliente continuam inteiros.
      - **Painel do roteiro** (botão *Roteiro*): para o capítulo em que ela
        está, o objetivo em uma linha, a **frase pronta com os números deste
        cliente**, a pergunta que devolve a palavra a ele, o cuidado a tomar e
        a **objeção que costuma nascer ali** — com a resposta já calculada.
        Objeção tem hora: "está caro" nasce no slide do investimento, "já tenho
        plano de saúde" no da proteção em vida. Começa fechado, porque a tela
        dela está compartilhada e quem decide o que aparece nela é ela.
      - **Em que momento da reunião ela está** (abertura, retrato, consciência,
        solução, investimento, prova, decisão) fica na barra, ao lado do número
        do slide — é o que evita o erro mais caro: chegar ao preço antes de o
        cliente ter tomado consciência do risco.
- [x] **Capítulo da proteção em vida**: as coberturas que pagam com o cliente
      aqui (invalidez, doenças graves, cirurgias, DIT, DIH, fraturas) deixaram
      de aparecer diluídas entre outras dez linhas do quadro da apólice e
      ganharam um capítulo. É a resposta com a lista na tela para "isso só
      serve depois que eu morro" — a objeção mais comum da categoria.
- [x] **Aposentadoria e acúmulo** deixa de ser só um foco na lista: meta de
      capital, o que a previdência atual entrega projetada e líquida, a renda
      que isso sustenta de verdade e quanto falta aportar por mês — com o elo
      que ninguém faz: o aporte sai da renda, e sem invalidez coberta o plano
      de acúmulo para junto com ela
- [x] **Transcrição da reunião** (migração 020): cole o texto do Tactiq (ou
      solte o arquivo) e receba na hora o resumo executivo, os números que o
      cliente falou prontos para aplicar no planejamento, as objeções com a
      resposta sugerida, os compromissos virando tarefa e um raio-X de como a
      reunião foi conduzida — tudo offline, sem chave de API
- [x] **O perfil que a conversa revela** (e não é número): idade, tabagismo,
      condição de saúde para a DPS, o motivo de ele ter aceitado a conversa,
      quem decide, em quanto tempo, o orçamento que ele declarou, os seguros
      que já tem — com o alerta de por que cada um não basta (o da empresa
      acaba com o emprego, o prestamista paga ao banco) — cada achado com o
      trecho da conversa que serve de prova
- [x] **Números falados por extenso**: "quinhentos reais", "vinte e cinco mil",
      "um milhão e meio" viram valor — ninguém fala "R$ 500,00" numa reunião
- [x] **O que ainda falta perguntar**: a ponte entre a transcrição e o estudo —
      a lista de perguntas da próxima conversa sai pronta, escrita como
      pergunta e não como nome de campo
- [x] **Dois resumos**: o interno (com nota de condução, objeções e estratégia)
      e o **para mandar ao cliente** — só o "combinamos isso", pronto para o
      WhatsApp
- [x] Aprofundamento opcional com **Claude** (Edge Function `analisar-reuniao`):
      perfil do cliente, dores com evidência, respostas sob medida e a
      mensagem de follow-up pronta. Sem a chave configurada, a análise local
      continua funcionando normalmente
- [x] Apresentação renovada: logo do escritório (public/logo.png), slide de
      diagnóstico, raio-X patrimonial, sucessão com a conta do primeiro mês,
      planejamento empresarial, gap de cobertura e próximos passos
- [x] DPS completa no formulário público (padrão das seguradoras) com
      impressão limpa para transcrever ao portal + destaque dos "sim"
- [x] Dossiê 1-página do cliente: estudo, apólices, últimas conversas e
      pendências — a folha da consultora antes de cada reunião
- [ ] Rodar a importação com as planilhas reais (aguardando arquivos)
- [ ] Alinhar o formulário com o oficial (aguardando conteúdo — site inacessível daqui)
- [ ] Envio 100% automático de WhatsApp (requer API oficial Meta/Twilio + Edge Function)
