# Evolução da consultoria — entrega e implantação

Esta versão trata os problemas identificados na avaliação e acrescenta uma jornada de atendimento. Foi desenvolvida com dados fictícios; alterar estes arquivos não atualiza automaticamente a Vercel nem o banco de produção.

## O que mudou

| Avaliação | Entrega |
|---|---|
| C01 | Venda confirma resultado do banco, mantém campos quando falha e usa identificador de operação para não duplicar a apólice em uma retentativa. Edição/exclusão verificam o registro afetado. |
| C02 | Abrir WhatsApp não marca envio. A confirmação continua manual em “Já enviei”. |
| C03 | Erros de leitura são distintos de base vazia nos fluxos principais, configurações e premiação. Há opção de tentar novamente. |
| C04 | Resposta pública com campos permitidos explicitamente, incluindo filtragem de objetos internos. Propostas são versões fixas, aprovadas por usuário, com validade e revogação. Formulários também têm prazo e revogação. |
| C05 | Pós-venda identifica prêmio mensal/anualizado da carteira em vez de chamar esse valor de receita da consultora. |
| C06 | Ranking calcula clientes fechados sobre decisões concluídas; várias apólices não fazem a conversão ultrapassar 100%. |
| C07 | Relatórios e premiação não aceitam paginação parcial como resultado completo. Exportação de clientes/apólices também busca todas as páginas. |
| C08 | Upload confere vínculo, tenta desfazer arquivo sem metadados, limita tamanho/tipo e informa exclusão incompleta. |
| C09 | Perfil e Pipeline compartilham validação de perda; o banco também exige motivo ao mudar para perdido. |
| C10 | Perfis admin/consultora/leitura, conta sem perfil bloqueada, clientes arquivados com restauração administrativa e auditoria. Backup externo e política de retenção exigem operação administrativa real. |
| M01–M02 | Central do Dia e Foco de Hoje antes dos indicadores. Registro rápido do contato e próxima ação em uma operação atômica. |
| M03 | Jornada por fase e modo reunião com três blocos de planejamento, preservando os campos e a visualização completa. |
| M04 | Cotações com seguradora/produto, valores, coberturas, exclusões, carências, franquias, reajuste, datas, justificativa e vínculo ao documento do cliente. |
| M05 | Publicação exige aprovação; usa revisão do estudo para impedir publicar dados diferentes dos que foram conferidos. Cliente responde interesse/revisão/conversa sem que isso seja tratado como contratação. |
| M06 | Situação da emissão, responsável, pendência, apólice e prazo. Vigência exige apólice ativa e pagamento confirmado. |
| M07 | Revisão de renda, família, beneficiários e coberturas; agendamento atualiza um lembrete sem duplicá-lo; orientação de apoio em sinistro. |
| M08 | Pipeline com mudança de etapa por seletor, utilizável por toque e teclado, além de busca. |
| M09 | Recuperação/troca de senha com Supabase e mensagens sem revelar se o e-mail existe. |
| M10 | Tela Operação e qualidade, registros de execução, monitor externo e procedimento de recuperação abaixo. Ativar monitoramento depende da configuração no GitHub. |
| M11 | Substituição transacional de comissões, rastreio de arquivo/lote, vínculos ambíguos pendentes, consolidação administrativa assistida de clientes e conciliação por apólice/mês. |
| M12 | Aviso de conexão, foco e teclado dos modais, rascunho cifrado opcional e bloqueio de sobrescrita de estudo alterado em outra sessão. |
| M13 | Registro de fontes, responsável e revisão das premissas. Os dados começam como pendentes: testes matemáticos não homologam premissas jurídicas nem aceitação da seguradora. |

## Limites importantes do produto

- “Prêmio cotado” exige uma cotação real. Aplicar seu preço não prova que as coberturas do estudo são equivalentes; a consultora precisa conferir essa equivalência.
- Uma resposta favorável do cliente não é assinatura nem apólice vigente. O sistema não confirma pagamento diretamente na seguradora: registra a confirmação feita pela equipe.
- O WhatsApp continua sendo aberto com mensagem pronta. Não há confirmação automática de entrega/leitura nem disparo pela API oficial.
- O rascunho é cifrado no armazenamento local, com chave restrita à sessão do navegador. Não é backup, não resiste a todo tipo de encerramento e não protege contra código malicioso na mesma origem. É opcional, não deve ser usado em dispositivo compartilhado e é removido ao sair da conta. O prazo máximo local é 24h; o vencimento é verificado ao tentar recuperar.
- O arquivamento preserva o cadastro e os dados vinculados; não cancela apólices nem pagamentos. Consolidações com dois planejamentos ou duas jornadas são recusadas para não escolher silenciosamente qual estudo apagar. Desfazer consolidação exige revisão administrativa.
- A auditoria de planejamento registra metadados, sem duplicar notas médicas. Auditoria e exportação de CSV não substituem backup do banco e do Storage.

## Implantação em uma instalação existente

1. **Antes da publicação**, confirme que a instalação tem as migrações 001–031. A nova tela exige as RPCs e políticas adicionadas nesta versão.
2. Faça backup do banco e dos arquivos privados, confirme a recuperação em um ambiente separado e registre responsável/data. Não use o banco real como teste de restauração.
3. Em staging, execute **o arquivo inteiro** `supabase/atualizacao_consultoria.sql`, gerado a partir das migrações 032–036. Ele verifica pré-requisitos e executa a atualização em uma transação. Um erro deve interromper o lote; não execute apenas trechos que parecem ter falhado.
4. Confira `hub_perfis`. A migração dá o perfil admin à conta já existente mais antiga e consultora às demais contas existentes. Revise essa atribuição antes de liberar o acesso. Novas contas não recebem perfil automaticamente. Pelo SQL administrativo é possível atribuir a primeira administração em uma instalação nova; use o UUID da conta correta.
5. Faça testes com uma conta admin, uma consultora, uma conta de leitura e uma conta sem perfil. Configure/desative cadastro público conforme a política de acesso da organização. Nunca coloque `service_role` no frontend.
6. Publique a mesma versão do frontend na Vercel **somente depois** das migrações. Preserve `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; não publique o build de demonstração em produção. Use `npm ci` e `npm run build` com as variáveis reais da Vercel.
7. No Supabase Auth, adicione a URL real `/recuperar-acesso` à lista de redirecionamentos permitidos e confira envio de e-mail/SMTP. Teste o e-mail de recuperação com uma conta de teste; o desenvolvimento local não valida entrega de e-mail.
8. Valide o fluxo real com registros de teste identificados: login, cliente, planejamento, cotação, publicação/revogação, formulário, contato, emissão e relatório. Não considere dados fictícios como prova de persistência real.
9. Confira links já enviados: a migração os transforma em snapshots sanitizados com validade de 30 dias. Formulários existentes recebem prazo de 90 dias a partir da atualização. Revogue links desnecessários e informe a consultora sobre esses prazos.

Para projetos novos, `supabase/setup_completo.sql` reúne as 36 migrações. Ele é exclusivo para uma base vazia; não deve ser aplicado sobre a produção existente.

## Monitoramento e rotinas

A workflow `.github/workflows/monitoramento.yml` testa site e endpoint de autenticação a cada 15 minutos (sujeito à disponibilidade do agendador do GitHub) e por execução manual. Configure no repositório:

- Variável `HUB_SITE_URL`: endereço canônico do site.
- Variável `VITE_SUPABASE_URL`: URL raiz do projeto.
- Secret `VITE_SUPABASE_ANON_KEY`: chave pública do projeto; nunca `service_role`.

Sem a configuração de autenticação o monitor falha de forma explícita. Ele não valida todas as operações autenticadas nem substitui testes com uma conta controlada. Configure destinatários e responsabilidade pelos alertas na plataforma; não foi enviado aviso externo por esta implementação.

A tela Operação e qualidade mostra última sincronização do Outlook, fila e execução disponível no `pg_cron`. “Sem registro” não significa execução bem-sucedida. O agendamento legado usa `0 8 * * *`; confira `cron.timezone`. Se o agendador estiver em UTC, isso é 05h em São Paulo, e 08h em São Paulo corresponde a `0 11 * * *`. Ajuste no banco após confirmar o fuso, sem duplicar jobs. Não existe processo novo garantindo Outlook/cron apenas porque a interface mostra esses recursos.

## Testes de desenvolvimento

```bash
npm ci
VITE_DEMO=1 npm run build
CHROMIUM_PATH=/usr/bin/chromium VITE_DEMO=1 npm test
```

`test:jornada` aplica o schema em PostgreSQL isolado (PGlite) e verifica permissões, snapshots, expiração/revogação, concorrência, rollback da importação, atendimento idempotente e recuperação. Isso não substitui staging Supabase, particularmente Storage, e-mail, cron, Edge Functions e permissões da conta real.

`test:melhorias` simula rejeições de gravação/consulta e bloqueio de popup no navegador. As suítes existentes cobrem cálculo e navegação dos demais fluxos. Consulte o resultado atual da execução; um comando documentado não é prova de aprovação.

Após alterar migrações, regenere os artefatos:

```bash
node scripts/gerar-atualizacao-consultoria.mjs
node scripts/gerar-setup-completo.mjs
```

## O que precisa de validação externa

Não foram usados acesso administrativo ao Supabase ou credenciais de publicação Vercel nesta entrega. Permanecem externos: aplicar migrações na conta real, publicar, testar Storage/e-mail/cron, comprovar restauração de backup e revisar juridicamente as premissas e o tratamento de dados sensíveis. O registro de fontes não altera automaticamente o motor e não representa aprovação profissional.

Após estabilizar essa versão em produção, as próximas evoluções recomendadas são: integração oficial de WhatsApp com eventos de entrega; importação de cotações por seguradora com conferência humana; arquivo protegido dos documentos originais de cada lote; e métricas de tempo entre reunião, proposta, decisão e emissão baseadas no uso real.
