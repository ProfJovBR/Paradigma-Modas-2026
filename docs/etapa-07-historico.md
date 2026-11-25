# Conta: pedidos e produtos vistos

A conta tem três painéis lado a lado no desktop e empilhados no celular: dados pessoais, pedidos e produtos vistos. Pedidos e histórico têm rolagem própria e carregamento em páginas. Pedidos consultam o banco a cada 15 segundos enquanto a aba está visível e também ao voltar à aba ou recuperar conexão. Falhas de sincronização são exibidas, sem substituir registros por estado vazio falso.

## Banco e privacidade

Aplicar supabase/migrations/20261031004332_customer_account_history.sql antes de publicar o frontend.
orders.customer_id é atribuído por trigger usando auth.uid(), sem aceitar ID fornecido pelo formulário. Checkout conectado envia com o cliente autenticado; visitante continua permitido. Tentativas persistidas ficam vinculadas à mesma identidade para não trocar o proprietário após falha de rede. Pedidos anteriores sem customer_id não são associados automaticamente por e-mail.

RLS permite ao cliente ler somente seus pedidos e itens. Privilégios administrativos existentes são preservados. Nome e e-mail não determinam propriedade.

product_views guarda a última visita de cada usuário a cada produto. A página de produto registra visitas autenticadas de produtos carregados; a conta consulta somente os últimos 30 dias. Registros mais antigos do próprio usuário são removidos na próxima visita registrada. Isso é uma janela de exibição de 30 dias, não uma rotina global de exclusão diária. Produtos indisponíveis têm estado próprio. O histórico começa após a publicação; não há registros retroativos nem transferência de navegação anônima.

## Validação e publicação

Build/typecheck passaram. Três testes PGlite passaram, incluindo isolamento entre clientes, mesma informação de contato sem compartilhar acesso, idempotência sem transferência de propriedade, status alterado pelo administrador, isolamento do histórico e corte de 30 dias. Esses testes não substituem integração hospedada.

A suíte Playwright não inicia: falta Chrome em /opt/google/chrome/chrome. Banco hospedado: esquema anterior inspecionado; aplicação da migration ficou pendente porque as duas confirmações do Supabase expiraram. Não publicar frontend antes de aplicar e verificar a migration.
