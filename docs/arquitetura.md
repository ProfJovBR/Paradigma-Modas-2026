# Arquitetura e decisoes

## Aplicacoes

apps/loja e apps/admin sao entradas e builds independentes. npm workspaces evita duplicacao de componentes. packages/ui exporta componentes, estilos Tailwind e tokens; packages/core concentra contratos, validacao de imagens e fabrica do cliente Supabase. As duas aplicacoes usam a mesma URL/chave publica e configuracoes de sessao diferentes.

O painel usa navegacao por hash, com links diretos e historico do navegador. A loja usa ancoras para catalogo e marca e #produto/UUID para detalhes reais, sem exigir rewrite.

## Tema

Tema inicial: amarelo #FFDF32, branco #FFFFFF, texto #191919 e superficie #F6F6F4. Fonte serifada do sistema para marca e titulos; sans-serif para operacao. Sem dependencia de fontes remotas.

defaultTheme em packages/ui/src/theme.ts e a fonte dos valores configuraveis. Variaveis CSS permitem sobrescrita por escopo; a previa do painel recebe seu proprio tema. O contraste do texto sobre a cor primaria e calculado. O fundo e a cor do texto tambem precisam passar por validacao de contraste antes da futura publicacao.

Etapa 03: theme_settings guarda rascunho, tema publicado e UUID de revisao. O frontend publico tem SELECT somente na coluna published; leitura administrativa usa get_theme_editor(). save_theme() verifica public.is_admin(), formato e contraste ao publicar, bloqueia a linha e compara revisao antes de salvar. Publicar grava as cores atuais como rascunho e tema publicado e acrescenta uma versao a theme_versions na mesma transacao. Salvar rascunho nao altera published. Sem localStorage de tema. A loja reconsulta ao recarregar, navegar, retomar foco e a cada 60 segundos visiveis; falhas preservam a ultima versao valida ou o tema base. Alteracoes locais precisam ser salvas antes de sair da tela.

## Modelo

Etapa 02 implementa categories, sizes, colors, products, product_variants, product_images e private.admin_memberships nas migrations SQL. Estoque e um inteiro por variante; preco em centavos. Nao ha seeds. Promocoes e pedidos abaixo continuam como planejamento. theme_settings e theme_versions foram adicionadas na Etapa 03.

- products: nome, descricao, preco em centavos, categoria e status draft/active/archived. UUID nas URLs; slug adiado.
- product_images: caminho no Storage, texto alternativo e ordem; imagens reais aprovadas.
- categories, sizes, colors: registros gerenciaveis, cores hex validadas.
- product_variants: produto, tamanho, cor, SKU unico e estoque inteiro nao negativo; combinacao unica por produto.
- promotions e promotion_items: nome, periodo, estado, modo global/individual e produtos associados.
- theme_settings: rascunho, tokens publicados e revisao para concorrencia; uma linha.
- theme_versions: historico de publicacoes com tokens, autor e data; leitura administrativa.
- orders e order_items: dados reais e snapshot de valores; leitura restrita por comprador ou administrador.
- admin_memberships: permissoes mantidas no servidor, nunca derivadas de metadados editaveis pelo usuario.

## Descontos e estoque

Percentual > 0 e <= 100, no maximo duas casas decimais. Modo global aplica um unico percentual exclusivamente aos produtos selecionados; individual exige percentual para cada item. Exigir nome e ao menos um produto para salvar uma campanha. Calcular desconto sobre preco original em centavos, arredondando uma unica vez. Nao acumular campanhas: proposta inicial e usar o maior desconto elegivel, a confirmar antes da implementacao. Todas essas regras precisam ser impostas no servidor, nao apenas nos campos HTML.

Estoque pertence a variacao, nao ao produto. Futuras movimentacoes devem ser transacionais; pedidos preservam os valores e atributos da compra, mesmo apos edicao do catalogo. Fluxo de compra e reserva fica para etapa futura.

## Seguranca antes de integrar

Criar migracoes revisadas e RLS em todas as tabelas expostas. Leitura publica somente de produtos ativos, imagens aprovadas e tema publicado. Escritas, pedidos e rascunhos exigem autorizacao. Storage precisa de politicas proprias, limites de tamanho e MIME. Edge Functions validam JWT e papel administrativo antes de operacoes privilegiadas. Nunca confiar apenas no painel ocultar um botao.

Etapa 02 implementa login por email/senha, restauracao e renovacao de sessao, logout local e verificacao de public.is_admin(). A tabela de membros e privada, com RLS sem politicas para clientes; provisionamento apenas pelo operador do projeto. As escritas sao feitas pelo JWT da administradora e protegidas por RLS, sem chave privilegiada no frontend. Nao foi necessario criar Edge Functions para este CRUD.

Fotos usam bucket privado e downloads sujeitos a RLS. Somente imagens associadas a produtos active podem ser baixadas anonimamente. Arquivar bloqueia novas consultas/downloads, mas nao pode revogar bytes que alguem ja baixou. A loja revalida dados ao retomar foco, ao navegar/recarregar e a cada 60 segundos enquanto visivel.

Atualizacoes de produtos e estoque verificam updated_at para detectar edicoes concorrentes. Operacoes em produto, variantes e fotos sao salvas separadamente e indicadas na UI. Publicar altera apenas o status salvo; nao salva campos pendentes. Um produto sem variante/estoque aparece como sem estoque. Nao ha reserva ou decremento de estoque por compra.
