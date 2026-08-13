# A inteligência do Hub: onde ela está, e para onde ela pode ir

Análise do sistema com foco na camada de inteligência — o que já existe, quais
são os limites estruturais dela hoje, e a fila de melhorias que dá vantagem
real sobre qualquer concorrente desta categoria.

Nada aqui é implementação: é o levantamento e a priorização. Cada item traz o
que é, **por que é diferencial**, como se faz, que dado já existe, o esforço e
o risco.

---

## 1. O que já existe (e é muito)

A camada de inteligência hoje é **determinística, auditada e offline** — oito
motores em `src/lib/` mais uma camada opcional de LLM:

| Motor | Responde | Estado |
|---|---|---|
| `estudo.js` | *Quanto* proteger | Fonte única de todo número; 6.000 casos de fuzz |
| `diagnostico.js` | *Quem é* o cliente e *o que fazer* com o estudo | Perfil + recomendações com peso explícito; 10.000 planejamentos auditados |
| `premio.js` | *Quanto custa* cada cobertura | Faixa, nunca número seco; 58 conferências + fuzz |
| `niveis.js` | *Qual dos três planos* | Essencial/Recomendado/Completo + plano que cabe no bolso |
| `subscricao.js` | *Isso sai, e em quanto tempo* | Exigências, prazo, agravo, restrição |
| `objecoes.js` | *O que ele vai dizer* e como responder com número | Previsão + `naoDiga` |
| `beneficiarios.js` | *Quem recebe* e o que trava | CC 792/793/794 + alerta de beneficiário menor |
| `comparador.js` | *Seguro × previdência*, ano a ano | Tributação real dos dois lados |
| `transcricao.js` | *O que aconteceu na reunião* | Parser + extração + objeções, sem rede |
| `analisar-reuniao` (Edge) | A leitura que só um sênior faria | Claude, opcional, com schema fechado |
| `vw_prioridades` (SQL) | *Por quem começar o dia* | Score + Próxima Melhor Ação |

Isso já é mais inteligência do que a maioria dos CRMs de seguro tem. A regra
que governa tudo — *"palpite sem conta atrás é chute"* — é o maior ativo do
sistema e nenhuma melhoria abaixo pode custá-la.

---

## 2. Os três limites estruturais

Toda a inteligência atual compartilha três fronteiras. Elas não são defeitos de
execução; são o contorno do que foi construído até aqui — e é exatamente onde
estão os diferenciais.

### 2.1 Ela não aprende com nada

Nenhuma peça olha para trás. O sistema tem **298 clientes, 361 apólices, 249
lançamentos de comissão de 2023–2024, o histórico de funil completo e os
motivos de perda** — e nenhum desses dados volta para o motor. As objeções
previstas nunca são conferidas contra a que realmente derrubou a venda. Os
pesos do diagnóstico são constantes escritas à mão. O score de prioridade soma
pontos arbitrários. O sistema aconselha com muita disciplina e **zero
retroalimentação**.

### 2.2 Ela é de um cliente, num momento

Estudo, diagnóstico, transcrição e proposta olham **um cliente, numa reunião**.
Não existe inteligência de carteira (os 298 que já compraram), nem de série
temporal (o que mudou desde a última conversa), nem de núcleo familiar (o
cônjuge não é segurado em lugar nenhum — `conjuge` sequer aparece em
`estudo.js` como pessoa a proteger).

### 2.3 Ela é cega ao que acontece depois da reunião

A proposta pública (`/p/<token>`) **não registra nada**: nem se foi aberta, nem
quando, nem o que o cliente olhou. O follow-up é uma tarefa fixa de 3 dias,
igual para quem reabriu a proposta cinco vezes e para quem nunca clicou no
link. O sinal de compra mais barato que existe está sendo jogado fora.

---

## 3. Um achado concreto: o score perdeu a dimensão dinheiro

Vale corrigir antes de qualquer coisa nova, porque é barato e afeta a tela
inicial todo dia.

`vw_prioridades` (migração 004) pontua assim:

```sql
fn_ordem_etapa(status) * 8
+ least(dias_na_etapa, 30)
+ least(coalesce(pl.capital_sugerido, 0) / 100000.0, 25)   -- ← valor potencial
+ case when proxima_reuniao is not null then 10 else 0 end
```

A migração **019** removeu a trigger `fn_sugerir_capital` e **zerou os valores
que ela havia gravado** — decisão correta na época (a fórmula do banco brigava
com `estudo.js` e era a origem dos erros de número na apresentação). Só que a
partir dali `capital_sugerido` passou a guardar **apenas o que a consultora
digita para sobrescrever a sugestão**, o que é raro.

Consequência: para quase todo cliente esse termo vale **0**. O score, que tinha
quatro dimensões, hoje tem três — perdeu justamente a que separa um lead de
R$ 300 mil de um de R$ 5 milhões, e são 25 pontos num limiar de "quente" de 55.
O mesmo acontece no `Pipeline.jsx:30`, onde o card mostra capital zerado, e o
`demoDb.js:455` replica a fórmula, então a demonstração esconde o problema.

**Correção:** gravar um `capital_estimado` calculado por `calcularEstudo()`
quando o planejamento é salvo (o app já roda o motor a cada tecla), e o score
passa a ler esse campo. Uma coluna, uma linha no salvamento, uma linha na view.
Sem reintroduzir fórmula concorrente no banco: o número continua nascendo em
`estudo.js`.

---

## 4. As melhorias, por ordem de impacto

### Nível 1 — Diferenciais com os dados que já estão no banco

---

#### 4.1 Radar da carteira: o motor de estudo rodando sobre quem já comprou

**O que é.** Um processo que aplica `calcularEstudo()` + `diagnosticar()` sobre
as **361 apólices existentes** e devolve uma fila priorizada de quem está
subsegurado hoje. Sinais que o sistema já sabe ler e nunca cruzou:

- apólice só com morte, sem invalidez e sem doenças graves (o buraco mais comum
  e o mais caro — `diagnostico.js` já argumenta isso para clientes novos);
- capital contratado há N anos contra a renda e o custo de vida de hoje;
- produto **temporário** vencendo (a migração 013 guarda `tipo_produto`);
- filho que nasceu depois da contratação, ou que entra na faixa da faculdade;
- cliente cuja única proteção é vida em grupo da empresa;
- idade cruzando faixa de emissão (`IDADE_MAXIMA_EMISSAO` em `premio.js`) —
  "revisar agora ou não revisar mais".

**Por que é diferencial.** A receita mais barata do mercado é a carteira que já
existe, e ninguém audita 300 apólices com o mesmo rigor de um estudo novo —
porque ninguém tem um motor que faça isso em milissegundos. O Hub tem. É
transformar um relatório em uma fila de trabalho com valor em reais ao lado.

**Como.** Uma view/página "Revisão de carteira" que roda os motores existentes
por cliente com apólice ativa, ordena por gap descoberto e injeta os melhores
na Central de Mensagens com a frase pronta.

**Dados:** já existem. **Esforço:** M. **Risco:** baixo — reusa tudo.

---

#### 4.2 Probabilidade atuarial de verdade

**O que é.** Hoje `diagnostico.js` pesa recomendações com `GRAVIDADE = {bloqueia:
100, corrige: 60, ...}` — constantes qualitativas — e afirma no comentário que
"invalidez é bem mais provável que morte" sem nunca dizer *quanto*. Uma tábua
brasileira embutida (BR-EMS para morte, tábua de entrada em invalidez) troca
isso por número com fonte citável:

> *"Na sua idade, a chance de morte **ou** invalidez antes dos 65 é de 18,4%. E
> três em cada quatro dessas ocorrências não são morte."*

**Por que é diferencial.** É a frase mais forte que existe numa reunião de vida
e nenhum concorrente a diz com fonte. Além do argumento, ela **conserta o motor
por dentro**: a "probabilidade" que o peso do diagnóstico usa deixa de ser
constante e passa a variar com a idade do cliente — um cliente de 55 anos e um
de 28 param de receber a mesma ordem de recomendações.

**Cuidado.** Rotular sempre como estatística de mercado, nunca como previsão
individual; e auditar com a mesma disciplina do resto (monotonicidade por
idade, coerência entre coberturas).

**Esforço:** M. **Risco:** médio — exige escolher e declarar a tábua, e ela
vira premissa citada em voz alta.

---

#### 4.3 Telemetria da proposta: o sinal de compra que hoje se perde

**O que é.** Registrar, no `/p/<token>`: abertura, horário, dispositivo, quais
capítulos foram vistos e por quanto tempo, e quantas vezes o cliente voltou.

**Por que é diferencial.** Muda o follow-up de calendário para comportamento.
Hoje todo mundo recebe a mesma tarefa em 3 dias. Com telemetria:

> *"Ele reabriu a proposta 3× ontem à noite e ficou 4 minutos no capítulo do
> investimento. Ligue hoje, e comece pelo preço."*

versus

> *"Sete dias, nunca abriu. O problema não é o preço — é que ele não viu."*

São duas ligações completamente diferentes, e o sistema hoje não distingue as
duas situações. Isso também liga direto no 4.7 (cadência adaptativa).

**Cuidado.** É dado do próprio cliente, sem rastreador de terceiros, com aviso
na página. Nada de fingerprint.

**Esforço:** P–M (uma tabela, um RPC, um painel). **Risco:** baixo.

---

#### 4.4 O loop de aprendizado: o previsto contra o acontecido

**O que é.** Fechar o ciclo. Ao marcar um cliente como fechado ou perdido, o
sistema pergunta — com as opções que **ele mesmo previu** já na tela — qual
objeção realmente decidiu. Hoje `motivo_perda` é texto livre e as previsões de
`objecoes.js` nunca são conferidas contra a realidade.

Daí sai uma tela de calibração:

> *"Quando o sistema deu 'está caro' como CERTA, ela apareceu em 78% dos casos.
> Quando deu 'preciso falar com minha esposa' como PROVÁVEL, apareceu em 31% —
> essa condição está mal ajustada."*

**Por que é diferencial.** É o espírito da auditoria dos 10.000 planejamentos
aplicado ao mundo real: **um motor de conselhos que mede a própria precisão**.
Nenhum sistema desta categoria faz isso. E é o item que paga todos os outros,
porque passa a orientar onde ajustar peso, condição e argumento — em vez de
ajustar por intuição.

**Esforço:** P (uma tabela de desfecho + taxonomia + uma tela). **Risco:**
baixo. **Recomendo como primeiro item da fila** junto com o 3.

---

#### 4.5 Score calibrado pelo histórico, não por constantes

**O que é.** Substituir os pesos de `vw_prioridades` por **taxa de conversão
observada**. O sistema tem histórico de funil e dois anos de fechamentos: dá
para estimar a probabilidade de fechar por etapa × dias parados × faixa de
capital × assessor, e ordenar a fila por **valor esperado em reais**:

> *"João — 62% de chance, R$ 3.400 de comissão = R$ 2.100 de valor esperado."*

**Por que é diferencial.** A fila de trabalho deixa de ser uma pontuação
opaca ("score 47") e vira dinheiro defensável. Junto com a explicabilidade —
mostrar a decomposição do número quando ela passa o mouse — resolve o problema
de confiança que todo score sofre.

**Pré-requisito:** o item 3 (capital de volta ao score) e volume mínimo de
desfechos. Enquanto o volume não sustentar estimativa, mantém-se a heurística —
e o sistema diz qual dos dois está usando.

**Esforço:** M. **Risco:** médio (amostra pequena engana; é preciso declarar o
intervalo).

---

### Nível 2 — Diferenciais que exigem dado novo ou LLM

---

#### 4.6 O conhecimento das seguradoras (o que hoje mora no WhatsApp do gerente)

**O que é.** Hoje a tabela `seguradoras` tem **nome e percentual de comissão, e
nada mais**. `premio.js` tem uma tabela genérica de mercado; `subscricao.js`
admite explicitamente que "cada companhia tem a sua tabela" e para aí. Falta a
camada que decide onde colocar o caso:

- idade mínima/máxima e capital máximo **por cobertura e por seguradora**;
- capital máximo sem exame, carências, exclusões típicas;
- prazo médio de emissão — **medido pelo próprio sistema** (data da proposta →
  data de emissão da apólice), não declarado pela seguradora;
- apetite por profissão e por atividade de risco.

Com as condições gerais em PDF indexadas (o Storage já existe), a pergunta que
hoje trava a reunião passa a ter resposta na hora: *"qual a carência de doenças
graves na Icatu?"*.

**Por que é diferencial.** Vira a pergunta "quanto custa?" em "**quem emite
este caso mais rápido, mais barato e com menos exigência**". É o único item
desta lista que uma concorrente não copia lendo a tela — o conhecimento é
proprietário e cresce com o uso.

**Esforço:** G. **Risco:** médio (dado desatualizado é pior que dado nenhum —
cada afirmação precisa de data e origem).

---

#### 4.7 Cadência de follow-up adaptativa

**O que é.** O follow-up passa a nascer de sinal, não de calendário: engajamento
na proposta (4.3), temperatura da transcrição, objeção detectada e etapa. Um
cliente que pediu tempo recebe silêncio no prazo que pediu; um que reabriu a
proposta recebe contato no mesmo dia. E `objecoes.js` já sabe **o que não
dizer** em cada caso — hoje esse conhecimento não chega ao follow-up.

**Esforço:** M. **Risco:** baixo. **Depende de:** 4.3.

---

#### 4.8 Copiloto ao vivo durante a reunião

**O que é.** A transcrição hoje só serve depois. Com o texto chegando ao vivo
(ou com o iPad já em modo apresentação), uma faixa lateral discreta: número que
o cliente acabou de falar → botão de aplicar no estudo; objeção detectada → o
argumento com o número dele **e o `naoDiga`** na tela, antes de a resposta
errada sair.

**Por que é diferencial.** É a diferença entre "análise de reunião" e
"assistente na reunião" — e o sistema já tem as duas metades prontas
(`transcricao.js` detecta, `objecoes.js` responde). Falta o tempo real.

**Cuidado.** Silencioso, opt-in e recolhível. Um copiloto que distrai é pior
que nenhum.

**Esforço:** G. **Risco:** alto (é a única melhoria que pode atrapalhar a
reunião em vez de ajudar).

---

#### 4.9 Guarda-corpo do LLM: toda afirmação numérica conferida contra o motor

**O que é.** A Edge Function `analisar-reuniao` devolve texto livre — inclusive
`leitura_do_estudo`, que **critica os capitais** — e nada verifica se os
números citados existem no estudo. Um validador determinístico casaria cada
"R$ X" da resposta com um campo real e marcaria na tela o que não bate.

**Por que é diferencial.** É a versão coerente com a cultura do repositório:
o LLM propõe, o motor confere, a consultora decide. É o que torna seguro
**dizer em voz alta** o que o modelo escreveu — e é a única forma de expandir o
uso de LLM sem abrir mão da regra que sustenta o sistema inteiro.

**Esforço:** P–M. **Risco:** baixo. **Alto custo-benefício.**

---

#### 4.10 Pergunte ao Hub (linguagem natural sobre a base)

**O que é.** *"Quantos clientes de SP com apólice só de morte e renda acima de
30 mil?"* → SQL gerado sobre um conjunto de views somente-leitura, com o SQL
sempre à vista e sem nenhuma permissão de escrita.

**Por que é diferencial.** Hoje todo recorte novo exige um relatório novo em
código. Com isso, a operação faz a própria pergunta — e as boas perguntas
viram relatório fixo depois.

**Esforço:** M. **Risco:** médio (precisa de whitelist rígida de views e
limite de linhas; nunca sobre tabelas cruas).

---

#### 4.11 O estudo do casal

**O que é.** O motor é monotitular. A exposição do cônjuge — a renda dele, a
cobertura cruzada, quem sustenta os filhos se a **outra** renda parar — não
existe em lugar nenhum do estudo.

**Por que é diferencial.** É a segunda venda mais natural que existe, ela está
sentada na mesma reunião, e o estudo hoje não a enxerga. Também melhora o
estudo do titular: um casal com duas rendas tem exposição diferente de um
provedor único, e hoje os dois recebem a mesma régua.

**Esforço:** G (mexe no motor, na proposta e no schema). **Risco:** médio.

---

#### 4.12 Memória do cliente entre reuniões

**O que é.** As transcrições são por reunião e nada as consolida. Um perfil
acumulado — cada afirmação com data e citação — mais o alerta de contradição:
*"em março ele disse renda de R$ 48 mil; hoje disse R$ 32 mil"*.

**Por que é diferencial.** Em ciclos longos (e os de patrimônio são longos), a
terceira reunião hoje começa do zero. E a contradição detectada é ouro: ou o
estudo está errado, ou a situação mudou — os dois exigem ação.

**Esforço:** M. **Risco:** baixo.

---

### Nível 3 — Refinos de alto retorno e baixo custo

| # | Item | Por quê | Esforço |
|---|---|---|---|
| 4.13 | **Explicabilidade do score** — mostrar a decomposição ("etapa 32 + parado 14 + capital 25") | Score opaco não é obedecido | P |
| 4.14 | **Taxonomia de motivo de perda** (hoje texto livre) | Sem ela, 4.4 não fecha o ciclo | P |
| 4.15 | **Sensibilidade no estudo** — "e se a renda cair 20%?", "e se o ITCMD subir para 8%?" | O modo apresentação já simula prêmio; falta simular premissa | P–M |
| 4.16 | **Mini-DPS na reunião** — 6 perguntas de saúde antes da venda | `subscricao.js` estima agravo por profissão e IMC; com condição declarada, ele acerta. A DPS completa só chega no pós-venda, tarde demais | P |
| 4.17 | **Risco de cancelamento** — prêmio alto vs. sobra, estorno nas comissões importadas, atraso | O motor já avisa "não cabe no bolso" antes da venda e esquece depois dela; estorno devolve comissão | M |
| 4.18 | **Painel de qualidade da base** — as pendências de `diagnostico.js` agregadas na carteira inteira | Hoje a pendência é vista um cliente por vez; ninguém sabe que 40% da base não tem UF e o ITCMD está chutado | P |

---

## 5. Ordem sugerida

**Primeiro (semanas 1–2) — barato, e destrava o resto:**
1. Item 3 — devolver o capital ao score
2. 4.14 + 4.4 — taxonomia de perda e o loop de aprendizado
3. 4.3 — telemetria da proposta
4. 4.9 — guarda-corpo do LLM

**Depois (mês 1–2) — o diferencial mais visível:**
5. 4.1 — radar da carteira
6. 4.7 — cadência adaptativa (já com o dado do 4.3)
7. 4.13 + 4.18 — explicabilidade e qualidade da base

**Em seguida (mês 2–4) — o que exige decisão de premissa:**
8. 4.2 — probabilidade atuarial
9. 4.5 — score calibrado (já com desfechos do 4.4)
10. 4.16 + 4.17 — mini-DPS e risco de cancelamento

**Apostas maiores, uma de cada vez:**
11. 4.6 — conhecimento das seguradoras (a mais defensável de todas)
12. 4.11 — estudo do casal
13. 4.8 — copiloto ao vivo
14. 4.10 + 4.12 — pergunta em linguagem natural e memória do cliente

---

## 6. A regra que não muda

Toda melhoria acima entra sob as mesmas três condições que fizeram a
inteligência atual valer alguma coisa:

> **Palpite sem conta atrás é chute.** Item novo que não sabe se justificar não
> é gerado.

> **Nada é aplicado sozinho.** O sistema não esteve na reunião; ela esteve.

> **Se vai ser dito em voz alta, é testado.** As suítes `test:planejamento`,
> `test:premio` e `test:conhecimento` são o padrão — inteligência nova sem
> auditoria é inteligência não entregue.

E uma quarta, que o item 4.4 introduz:

> **Conselho que não é conferido contra o que aconteceu é opinião.** A partir
> daqui, o sistema mede a própria precisão.
