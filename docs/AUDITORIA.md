# Auditoria de 10.000 planejamentos

> O que 10.000 clientes plausíveis revelaram sobre o motor do estudo — e o que
> foi corrigido. Reproduza com `npm run auditoria`.

## Por que esta auditoria existe

O `npm run test:motor` já jogava milhares de entradas hostis no
`calcularEstudo()` e cobrava que nada virasse `NaN`. Isso prova **robustez**, e
robustez não é competência: um motor que devolvesse zero em tudo passaria
naquele teste com louvor.

A pergunta que faltava é outra, e é a única que importa para quem apresenta o
estudo na frente do cliente:

> **O conselho que o sistema dá está certo?**

Para responder isso, entrada aleatória não serve. Serve gente. São 10.000
clientes plausíveis, distribuídos em quinze arquétipos e nove públicos, cada um
com números que existem no mundo — e com lacunas de preenchimento, porque na
vida real o estudo raramente chega completo.

| Público | Quantos dos 10.000 |
|---|---|
| Sucessão (patrimônio consolidado, 65+, herdeiros menores) | ~1.990 |
| PF família (casal com filhos, viúvo, divorciado com pensão) | ~1.950 |
| PF sem dependentes (solteiro jovem, casal DINK) | ~1.630 |
| PJ (empresário, homem-chave, sócio único) | ~1.280 |
| PF alta renda (autônomo liberal) | ~760 |
| Temporário (cobrir o financiamento) | ~660 |
| PF baixa renda (MEI) | ~630 |
| Aposentadoria e acúmulo | ~550 |
| PF + PJ | ~550 |

Sobre cada estudo passam **24 regras de revisão**. Cada regra é uma coisa que um
consultor sênior olharia e diria "isso está errado" ou "isso você deixou
passar". Os tetos de mercado ficam **dentro do arquivo de auditoria**, e não
importados do motor: auditor que usa as constantes do auditado não audita nada,
só confirma que o sistema concorda consigo mesmo.

## O que a primeira execução encontrou

**16 regras dispararam. 8 delas graves.** Em ordem de quantos planejamentos
seriam afetados:

| Regra | Frequência | O erro |
|---|---:|---|
| 🔴 R14 | **89,5%** | A verba sucessória cobria o ITCMD e ignorava o custo de **segurar os bens** durante os 6 a 18 meses de inventário |
| 🟡 R12 | **81,8%** | ITCMD fixo em 4% (a alíquota de SP) para todo mundo, sem nunca perguntar o estado |
| 🔴 R02 | **25,1%** | Diária de DIT sugerida acima do que qualquer seguradora emite (renda ÷ 30 dá R$ 5.000/dia para quem ganha R$ 150 mil) |
| 🔴 R11 | **19,6%** | Cliente casado sem regime de bens: o estudo tributava o patrimônio inteiro **calado**, superdimensionando a verba em até 50% |
| 🟡 R10 | **19,4%** | A previdência contava como liquidez do inventário **e** como reserva da família — o mesmo saldo em duas contas |
| 🟡 R05 | **14,3%** | Prêmio acima de 10% da renda sem aviso nenhum (o motor só avisava a partir de 30%, três vezes o razoável) |
| 🔴 R06 | **12,3%** | Capital de morte cheio para cliente **sem nenhum dependente** — proteção contra um risco que não existe |
| 🟡 R20 | **5,0%** | Estudo sem nenhuma cobertura que paga em vida |
| 🔴 R01 | **4,7%** | Doenças graves acima do teto de emissão do mercado (chegava a R$ 5,3 mi) |
| 🟡 R08 | **4,4%** | Idoso com capital calculado como reposição de renda por 20 anos |
| 🔴 R04 | **4,2%** | Prêmio maior que a sobra mensal do cliente, sem aviso |
| 🔴 R16 / 🟡 R17 | **3,1%** | Buy-sell sugerido para **sócio único** — capital sem contraparte |
| 🔴 R09 | **2,1%** | A apólice atual abatia o gap de morte **e** somava na liquidez sucessória |
| 🟡 R13 | **1,8%** | Autônomo sem DIT no estudo |
| 🟡 R03 | **1,6%** | Capital acima do limite de subscrição sem avisar do resseguro facultativo |

## O que foi corrigido

### 1. O inventário custa mais do que o imposto

O ITCMD é o número que todo mundo cita, e é o menor deles. Enquanto o processo
corre, o imóvel travado continua gerando IPTU, condomínio, seguro e manutenção;
o carro, IPVA; a empresa, contador. A família paga tudo isso **sem poder vender
nada**.

O estudo passou a calcular `custoSustentacaoInventario` (1% ao ano sobre os bens
ilíquidos, pelo prazo do rito) e a exibir a conta aberta em duas parcelas.

### 2. O ITCMD é estadual

Tabela `ITCMD_POR_UF` com as 27 unidades da federação, campo de UF no formulário
(migração `024`) e o campo `itcmdOrigem` dizendo de onde o número veio:
`consultora`, `uf` ou `padrao`. Quando é `padrao`, o estudo avisa em voz alta
que assumiu a premissa.

### 3. Um real só não faz duas coisas

Duas correções de dupla contagem:

- **Apólice atual**: só a parte que **sobra** depois de reservado o capital de
  morte entra como liquidez sucessória (`coberturaLivreParaSucessao`).
- **Previdência**: a autonomia "hoje, sem o plano" agora desconta o custo do
  inventário não coberto, porque é essa a ordem em que as contas chegam — o
  imposto vence antes, e sai do dinheiro líquido.

### 4. Quem depende dessa renda?

A pergunta que decidia o estudo inteiro e que o motor não fazia. Se ninguém
depende — solteiro sem filhos, viúvo com filhos formados — **não há renda a
substituir**, e o capital de morte passou a cobrir a dívida (que não morre com o
devedor) em vez de dez anos de custo de vida.

E na mesma correção, a distinção que faltava: **invalidez não é morte**. Para
quem tem família os dois capitais coincidem. Para o solteiro, não: se ele morre,
ninguém fica sem nada; se fica inválido, ele mesmo precisa viver o resto da vida
sem trabalhar. Era justamente a cobertura que o estudo zerava junto.

### 5. Sugestão que a seguradora recusa não é sugestão

`LIMITES_MERCADO` com os tetos praticados no mercado brasileiro de vida
individual. Quando o teto morde, o valor é limitado, registrado em `limitados` e
a tela avisa **por que** foi limitado. A consultora continua livre para digitar o
que a cotação aprovar.

### 6. O plano precisa caber no bolso

Prêmio maior que a sobra mensal do cliente virou aviso **grave**: apólice que não
cabe cancela em poucos meses, e cancelamento estorna comissão. A régua do
comprometimento da renda desceu de 30% para 10% (atenção) e 20% (grave).

### 7. Coerência do desenho da apólice

- Buy-sell só é sugerido com **dois ou mais sócios** (não há com quem cruzar a
  apólice de um sócio único).
- Estudo PJ puro não traz mais coberturas de família calculadas sobre uma renda
  pessoal que nem foi levantada — **exceto a invalidez**, que continua, porque o
  banco executa o aval na invalidez do avalista exatamente como na morte.
- Aviso quando a proteção termina antes do financiamento (campo novo
  `dividas_prazo_anos`).
- Aviso quando o plano só paga na morte.

### 8. A camada que faltava: `src/lib/diagnostico.js`

O motor respondia "quanto". Ninguém respondia "**e daí?**". O diagnóstico
classifica o perfil (provedor, empresário, patrimonial, sem dependentes,
acúmulo), ordena as recomendações por um peso explícito
(gravidade × probabilidade × dinheiro em jogo, relativo à exposição do cliente)
e separa **recomendação** (decisão) de **pendência** (dado que falta).

Regra de ouro do arquivo: *palpite sem conta atrás é chute*. Toda recomendação
carrega o `porque` com os números daquele cliente — é o que a consultora repete
quando perguntam "de onde saiu esse valor?". Recomendação que não sabe se
justificar não é gerada.

E nada é aplicado sozinho: cada número entra no estudo só quando ela clicar.
O sistema não esteve na reunião.

## Estado atual

```
✅ Nenhuma das regras de revisão encontrou problema nos 10.000 planejamentos.
```

Verificado em quatro sementes diferentes (40.000 planejamentos) e numa bateria
de 50.000. O `npm run test:planejamento` roda a auditoria em modo `--travar` e
reprova o build se qualquer regra voltar a disparar.

## Regras que ainda toleram exceção

Três regras aceitam um limite pequeno porque dependem de dado que o cliente pode
legitimamente não ter informado — e nesses casos o sistema **pede o dado** em vez
de chutar:

| Regra | Limite | Por quê |
|---|---:|---|
| R12 (UF) | 2% | O cadastro pode não ter o estado |
| R13 (DIT do autônomo) | 2% | A profissão pode estar em branco |
| R16 (nº de sócios) | 2% | Estudo PJ ainda em preenchimento |

## Como estender

Uma regra nova é um objeto no array `REGRAS` de
`scripts/auditoria-planejamento.mjs`:

```js
{
  id: 'R25', gravidade: 'grave',
  titulo: 'Frase curta do que está errado',
  porque: 'Por que isso é erro, na linguagem de quem apresenta o estudo.',
  quando: (cenario, estudo, diagnostico) => condicao ? 'o que foi encontrado' : null,
}
```

Um arquétipo novo é uma função no array `ARQUETIPOS` que devolve
`{ rotulo, publico, idade, plano }`.
