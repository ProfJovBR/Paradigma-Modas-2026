# Fale conosco

## Comportamento

Admin: Configurações → Fale conosco. E-mail, WhatsApp e telefone possuem dados e visibilidade independentes. Salvar exige papel administrativo no servidor, valida os dados e compara a revisão para não sobrescrever outra edição. Os três canais começam vazios e ocultos; nenhum contato fictício é publicado.

Loja: o link Fale conosco abre os canais habilitados. WhatsApp usa wa.me; telefone usa tel; e-mail usa mailto. Assunto e mensagem são codificados ao compor o link de e-mail. A interface informa explicitamente que o aplicativo de e-mail deve ser aberto e o cliente precisa enviar a mensagem nele. Não há envio automático, caixa de mensagens nem promessa de entrega. Para envio automático futuro será necessário definir um provedor de e-mail e remetente verificado, com proteção contra spam no servidor.

A RPC pública retorna apenas os valores dos canais visíveis. A tabela não permite leitura anônima; usuários comuns autenticados não veem nenhuma linha. Escrita direta é bloqueada inclusive para administradores: deve passar por save_contact_settings. As funções privilegiadas usam search_path vazio e permissões explícitas; as funções administrativas verificam is_admin. A função pública privilegiada existe somente para projetar canais publicados sem expor valores ocultos.

## Ativação

Aplicar supabase/migrations/20261114002500_contact_settings.sql ao projeto correto antes de publicar as duas aplicações. Não modifica contatos existentes de outros módulos. Builds continuam sendo build:admin e build:loja. A configuração fica no banco, não em variáveis VITE_.

A alteração foi preparada em branch separada. Não foi publicada em produção nem aplicada ao Supabase hospedado.

## Validação

- npm run build: passou (TypeScript e os dois builds Vite).
- npm run test:db: 3 testes passaram em PGlite, incluindo restrição de administrador, ocultação dos dados, validação de contatos, tipos JSON e conflito de revisão. Não constitui teste do Supabase hospedado.
- npm run test:ui: tentado; Chrome não instalado no caminho esperado. Segunda execução com o Chromium do ambiente falhou antes de abrir páginas: socket do processo do navegador bloqueado pelo ambiente. Não foi possível validar visualmente ou confirmar os cenários UI nesta sessão.
- tests/contact.spec.ts cobre salvar/recarregar no admin, visibilidade na loja, destinos dos links, codificação da mensagem, largura 320px e estados vazio/erro, usando fixtures HTTP em memória.
