# PARADIGMA

## Estrutura e stack
- Preservar arquivos existentes e todas as imagens em docs/referencias/.
- Monorepo npm workspaces: apps/loja e apps/admin; packages/ui e packages/core compartilhados.
- React, TypeScript estrito, Vite, Tailwind CSS com plugin Vite e variaveis CSS.
- Supabase sera responsavel por Postgres, Auth, Storage e Edge Functions.
- Cloudflare Pages: dois projetos separados vinculados ao mesmo repositorio. Nao publicar sem pedido.

## Regras de produto
- Referencias sao exclusivamente visuais. Nunca copiar produtos, fotos comerciais, precos, promocoes, pessoas ou metricas ficticias para a aplicacao.
- Sem dados reais, mostrar estados vazios. Sem consulta ao servidor, metricas devem mostrar indisponibilidade, nunca zeros que aparentem resultados consultados.
- Nao simular login, pedidos, checkout, pagamento ou sucesso de persistencia. Formularios ainda nao integrados devem informar a limitacao e bloquear gravacao.
- Promocoes: nome, produtos selecionados, percentual global somente sobre os selecionados OU percentual individual por produto.
- Tema central em packages/ui/src/theme.ts. Previa isolada do tema publicado. Nunca publicar ao alterar um seletor de cor.
- Nao adicionar pagamentos nesta etapa.

## Seguranca e qualidade
- Nunca colocar segredos em codigo, docs ou variaveis VITE_. Chave publica nao substitui RLS.
- Auth real e verificacao de papel administrativo no servidor sao requisitos antes de liberar operacoes.
- Usar centavos inteiros para dinheiro; estoque por variacao; precos e descontos finais validados no servidor.
- Componentes, estilos e tokens compartilhados; navegacao acessivel, foco visivel e layout desde 320px.
- Executar npm run build e npm run test:ui para alteracoes nas interfaces compartilhadas.
- Consultar docs/arquitetura.md e docs/etapa-01.md antes de expandir o escopo.

## Etapa 02
- Catalogo e Auth foram integrados; consultar docs/etapa-02.md para limites e evidencias de testes.
- Migrations versionadas em supabase/migrations. Nao editar migrations ja aplicadas: criar outra migration.
- Admin e identificado por private.admin_memberships e public.is_admin(), nunca por user_metadata. Nem administradores do app podem conceder esse papel pelo navegador.
- Bucket catalog e privado. Usar download sujeito a RLS e blob URL temporaria; nunca getPublicUrl ou URLs assinadas duradouras para rascunhos.
- Loja usa cliente sem sessao persistente, separado do cliente autenticado do painel.
- Executar npm run test:db, npm run test:ui e npm run build. Fixtures de teste somente em memoria ou staging dedicado, nunca no banco de producao.
- Nao confundir PGlite e mocks HTTP com verificacao contra Supabase hospedado. Registrar exatamente quais testes foram executados.
- Promocoes, persistencia de tema, pedidos, checkout e pagamentos continuam fora desta etapa.

## Etapa 03
- Personalizacao de cores implementada; consultar docs/etapa-03.md. Aplicacao da nova migration no Supabase hospedado ainda deve ser confirmada.
- Rascunho e publicacao usam RPCs get_theme_editor/save_theme e public.is_admin(). Nao liberar escrita direta nas tabelas de tema.
- Loja consulta somente theme_settings.published. Publicacao exige contraste minimo de 4,5:1 no servidor e cria historico atomico em theme_versions.
- Promocoes, pedidos, checkout e pagamentos continuam fora do escopo.

## Etapa 05 (substitui as restrições anteriores sobre pedidos)
- Checkout e pedidos internos foram autorizados e implementados; consultar docs/etapa-05-checkout.md.
- Sem cobrança online/NF. Frete e pagamento combinados no atendimento.
- Preços e disponibilidade validados por submit_order; intake não reserva estoque.
- Confirmar baixa estoque transacionalmente; cancelar devolve uma vez; mudanças exigem revisão e papel admin.
- Preservar idempotência, RLS e proteção dos dados pessoais. Nunca simular sucesso local.
