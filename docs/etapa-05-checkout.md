# Etapa 05 — Checkout e pedidos internos

Checkout sem cobrança online e sem NF. Cliente informa nome, e-mail, telefone e retirada ou endereço para entrega. Frete, prazo e pagamento são combinados no atendimento. Não se coleta CPF nesta etapa.

## Fluxo

- Carrinho reconsulta produtos ativos e estoque. Checkout vazio/indisponível bloqueia envio.
- `submit_order` valida dados e disponibilidade no servidor; calcula preços em centavos a partir do catálogo e exige concordância com o subtotal exibido. Guarda snapshots de produto, SKU, tamanho, cor e preço.
- Tentativa tem UUID e payload imutável mantidos em sessionStorage antes da requisição. Falha de transporte oferece recuperação com o mesmo UUID, inclusive após reload. O servidor serializa tentativas com a mesma chave e rejeita sua reutilização com outro payload.
- Pedido recebido fica `pending` e NÃO reserva estoque. Protocolo só aparece depois da confirmação do servidor.
- Painel lista pedidos paginados, filtra status, mostra contato/endereço/itens e baixa `.txt` sem valor fiscal. Reconsulta a cada 30 segundos com a aba visível.
- Somente administrador pode confirmar: transação bloqueia variantes, confere estoque e efetua baixa. Cancelamento de confirmado/em separação devolve estoque uma única vez. Revisão UUID impede alteração concorrente. Estados concluído/cancelado são terminais.

## Segurança e limites

RLS em orders/order_items: leitura apenas para admin; nenhum cliente tem INSERT/UPDATE/DELETE direto. RPC pública de intake é intencionalmente SECURITY DEFINER com search_path vazio e EXECUTE explícito: não retorna dados pessoais nem aceita preços arbitrários. RPC administrativa exige auth.uid() e is_admin(). As advertências do advisor para essas funções são esperadas e foram revisadas; admin_memberships com RLS sem policy também é intencional.

Limite de 50 variantes e 99 unidades por linha; três pedidos por contato (e-mail ou telefone) em 10 minutos, serializados para concorrência. Não é proteção completa contra bots distribuídos com contatos diferentes. Pedidos não confirmados não consomem estoque. Turnstile/limite por IP pode ser acrescentado numa etapa de proteção contra abuso. Não há expiração automática: lojista deve cancelar solicitações abandonadas.

Nenhuma notificação por e-mail/WhatsApp é enviada automaticamente. Não há cobrança, frete automático, promoção ou cupom nesta etapa. Produtos de teste não ficam publicados.

## Banco e operação

Projeto existente SiteJanaina (cldmrxkrwtzvggdoakow) estava sem tabelas de aplicação e sem usuários Auth. Foram criadas as tabelas/policies do catálogo e as de pedidos. Buckets catalog e banners já existiam com limites corretos; o SQL de restauração de catalog preservou o bucket existente com ON CONFLICT DO NOTHING. Nenhuma migration antiga do repositório foi alterada.

A restauração da migration de tema foi rejeitada pela revisão automática como fora do escopo do checkout. Não foi contornada. Tema e banners no banco permanecem fora da entrega; a interface existente usa fallback. Isso não impede checkout/catalogo.

Antes de operar o painel, o dono deve criar um usuário no Supabase Authentication e conceder a esse usuário membership conforme docs/configuracao.md. Nunca conceder admin por user_metadata. Em 30/10/2026 não havia usuários no projeto; é necessário definir a conta da lojista.

## Validação em 30/10/2026

- npm run typecheck / npm run build: aprovados.
- npm run test:db: aprovado, suíte existente e nova suíte de pedidos; PGlite isolado testa privacidade, preço, entrada inválida, idempotência, limites, transições e estoque.
- Supabase hospedado: criação transacional de produto fictício e submissão anônima repetida; conferido exatamente um pedido de R$50,00; ROLLBACK removeu todos os dados de teste.
- Playwright: execução tentada; host impede socket de inicialização do Chrome (`Operation not permitted`). Não houve validação visual nem aprovação da suíte de interface neste ambiente. Novos testes cobrem envio com endereço, resposta perdida/reload/retry, carrinho vazio e 320/1440 px; precisam rodar em host com navegador permitido.
