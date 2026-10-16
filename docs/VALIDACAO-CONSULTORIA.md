# Validação da versão de consultoria

Validação realizada em 15/10/2026, em ambiente de desenvolvimento isolado. Nenhum teste de escrita foi executado na carteira de produção.

## Resultados

- `npm run lint`: aprovado, sem avisos.
- `npm run build`: aprovado.
- `CHROMIUM_PATH=/usr/bin/chromium VITE_DEMO=1 npm test`: aprovado, incluindo regras de cálculo, RPCs, autenticação de Edge Functions, navegação, planejamento público, apresentação, varredura de telas e persistência simulada.
- `test:jornada`: aprovado novamente após os ajustes finais de migração. Foram executados o pacote transacional gerado e a reaplicação das migrações novas em PostgreSQL isolado.
- `test:melhorias`: aprovado novamente com os cenários adicionais de operação e exportação da conciliação.
- Monitor externo executado manualmente: site público e endpoint de autenticação responderam com sucesso. Isso verifica a publicação que já estava no ar; não prova implantação desta nova versão.
- `git diff --check`: aprovado.

## Comportamentos cobertos pelos novos testes

- Rejeição da venda mantém o formulário; a nova tentativa pode concluir.
- Retentar a mesma operação de venda não duplica a apólice nem suas automações de inserção.
- Comissão zero é preservada.
- Abrir ou bloquear WhatsApp não confirma envio.
- Falha ao consultar clientes não aparece como carteira vazia.
- Contato e próxima ação são registrados juntos, sem duplicação por repetição da operação.
- A Central do Dia aparece na primeira tela de celular da massa de demonstração.
- Publicação exige aprovação e gera resposta pública sanitizada.
- Alterações posteriores não mudam o snapshot enviado; revogação e expiração impedem acesso.
- Perfil de leitura não escreve, conta anônima não publica e o último administrador não pode ser removido pela operação de perfis.
- Formulário revogado não pode ser acessado pela RPC pública nem contornado pela função interna.
- Gravação de estudo desatualizado é rejeitada.
- Lote de importação inválido desfaz a exclusão anterior e os metadados do lote.
- Cotação vencida não substitui o prêmio do estudo.
- Revisão de proteção atualiza um lembrete sem duplicá-lo.
- Situação vigente exige confirmação de pagamento e vínculo da apólice.
- Consolidação transfere o histórico e impede restauração simplista do cadastro consolidado.
- Arquivamento/restauração preservam o cadastro e registram auditoria.
- A tela de operação carrega e a conciliação mensal pode ser salva e exportada.

## Limites da evidência

PGlite valida SQL PostgreSQL e políticas no schema de teste, mas não replica todas as características operacionais do Supabase. Storage, entrega de e-mail, configuração do cron, serviço Outlook, backup externo e uso com as contas reais precisam de staging e validação administrativa. As premissas legais e de seguradoras continuam exigindo revisão profissional.

A versão não foi publicada na Vercel, e as migrações não foram aplicadas ao Supabase de produção. O roteiro está em `docs/EVOLUCAO-CONSULTORIA.md`; o pacote para instalação existente é `supabase/atualizacao_consultoria.sql`.

## Verificação de acesso em 16/10/2026

- Leitura Git e simulação de envio para uma branch separada aprovadas. Nenhuma
  alteração enviada à branch de produção nessa verificação.
- API do GitHub bloqueada pela política de rede, inclusive na tentativa com
  execução ampliada. O acesso Git não comprova acesso à API ou aos deployments.
- Site e endpoint de autenticação Supabase responderam HTTP 200.
- A chamada à RPC de leitura `fn_hub_papel` com a chave pública retornou
  HTTP 404 / `PGRST202`: a função não foi localizada no schema exposto pela API.
  Não publique o novo frontend antes de conferir e atualizar o banco.
- Build local de produção aprovado usando a configuração pública já presente
  no site, com `VITE_DEMO=0`. O artefato gerado não foi publicado.
- Lint e `git diff --check` aprovados após atualizar o guia de implantação.
- Não há credenciais administrativas Supabase/Vercel disponíveis na máquina.
  Os requisitos `SUPABASE_ACCESS_TOKEN` e `VERCEL_TOKEN`, junto dos destinos de
  rede necessários, foram salvos no rascunho de configuração do ambiente.
  Esse salvamento não fornece os tokens nem aplica migrações ou publica o site.
