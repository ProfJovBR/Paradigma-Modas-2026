# Hospedagem no Cloudflare Pages

## Estado da preparacao

Loja e painel geram sites estaticos independentes. Nao precisam de Worker, Functions, servidor Node em producao ou adaptador. O repositorio esta preparado para Pages; a publicacao e a validacao do Supabase hospedado permanecem pendentes. Checkout, pedidos e pagamentos nao estao implementados: esta entrega permite hospedar o catalogo e a administracao existente.

## Configuracao dos dois projetos

Na Cloudflare, abrir Workers & Pages e escolher criar um projeto **Pages** conectado ao repositorio Git. Repetir para o painel. A criacao com Git pode iniciar o primeiro deploy; fazer isso somente quando for publicar.

| Campo | Loja | Painel |
| --- | --- | --- |
| Framework preset | None | None |
| Root directory | raiz do repositorio (deixar vazio) | raiz do repositorio (deixar vazio) |
| Build command | `npm run build:loja` | `npm run build:admin` |
| Build output directory | `apps/loja/dist` | `apps/admin/dist` |
| Node | 24 (arquivo `.node-version`) | 24 (arquivo `.node-version`) |

Selecionar a branch de producao usada pelo repositorio. Manter `package-lock.json` versionado e a instalacao automatica de dependencias habilitada. Nao definir a raiz como `apps/loja` ou `apps/admin`: os workspaces precisam da raiz. Nao configurar comando `wrangler deploy`, pois este roteiro e de Pages com integracao Git.

Inicialmente manter todos os caminhos disparando builds: os comandos fazem typecheck das duas aplicacoes. Antes do push, incluir tambem os arquivos novos da etapa de banners e desta preparacao; arquivos locais nao versionados nao chegam a Cloudflare.

## Variaveis no ambiente de build

| Variavel | Onde | Valor |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | ambos | URL HTTPS do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ambos | chave publica `sb_publishable_...` |
| `VITE_LOJA_URL` | somente painel | URL HTTPS real da loja, em `pages.dev` ou dominio proprio |

Loja e painel de producao devem usar o mesmo Supabase. Configurar Production e Preview separadamente; previews administrativos devem usar staging dedicado, pois acessam e podem alterar o banco configurado. Se nao houver staging, desabilitar builds de preview no projeto. Nenhum `.env.local` deve ser enviado ao Git.

As variaveis Vite entram no JavaScript publico durante o build. Nunca usar `service_role`, `sb_secret_`, senha do banco ou token Cloudflare. Alterar variaveis exige novo build/deploy. O build em Pages (`CF_PAGES=1`, definido pela plataforma) falha se faltar URL HTTPS ou chave publishable; no painel tambem exige a URL da loja. Essa verificacao valida formato, nao conectividade ou permissoes.

## Supabase antes de liberar acesso

Seguir [configuracao.md](configuracao.md) e confirmar as quatro migrations, nesta ordem:

1. `202609060001_catalog.sql`
2. `202609060002_storage.sql`
3. `202609090001_theme.sql`
4. `202609160001_banners.sql`

Aplicar somente as pendentes; nunca executar novamente ou editar migrations aplicadas. Confirmar RLS, buckets privados `catalog` e `banners`, conta administrativa e membership em `private.admin_memberships`. A chave publica nao concede papel administrativo. O login atual usa email/senha, sem callback por URL; recuperacao de senha e convites ainda nao estao implementados.

## Rotas, headers e dominios

A navegacao usa hashes, preservados ao recarregar. Pages fornece fallback de SPA quando nao existe `404.html` no topo; nao e necessario `_redirects`. Os arquivos `public/_headers` sao copiados para cada `dist` e configuram protecao contra incorporacao em frames, sniffing de MIME e permissoes desnecessarias. O painel recebe `noindex, nofollow` e `robots.txt`; isso nao substitui Auth/RLS.

Depois de publicar, vincular cada dominio em Custom domains do respectivo projeto Pages e seguir as instrucoes de DNS da Cloudflare. Se mudar a URL da loja, atualizar `VITE_LOJA_URL` no painel e reconstruir. Nao adicionar regras de cache global sobre as APIs do Supabase.

## Verificacao e aceite

Validacao local aprovada em 17/09/2026 (20 testes de interface aprovados): `npm run build` (TypeScript e Vite), `npm run test:db` (PostgreSQL/PGlite em memoria) e `npm run test:ui -- --workers=2` (Playwright com HTTP simulado). Ambiente local Node 22.22.1; Node 24 foi selecionado para o build remoto e ainda precisa ser confirmado no primeiro build Pages.

Tambem foram verificados a copia dos headers/robots para os builds, a rejeicao de configuracao ausente com `CF_PAGES=1` e o build administrativo com essa flag e URL HTTPS de teste. A URL de teste nao foi mantida no build final. A primeira rodada de interface teve timeout em uma captura de tela de 320 px; uma tentativa concorrente nao iniciou por portas ocupadas, e a suite foi repetida isoladamente com dois workers.

Os testes locais nao comprovam Auth/RLS/Storage hospedados. Nenhum deploy ou alteracao no banco remoto foi realizado nesta preparacao. O teste remoto `npm run test:supabase` deve ser executado somente em staging dedicado conforme [etapa-02.md](etapa-02.md). Tema e banners tambem exigem os aceites descritos nas etapas 03 e 04.

Depois da publicacao, conferir loja anonima, imagens, detalhe e recarga de produto; login e logout do painel; negativa de acesso para usuario sem papel; links “Ver loja”; tema e banners. Conferir headers com `curl -I` nas duas URLs publicadas: o preview do Vite nao aplica `_headers`. Usar dados reais aprovados no aceite de producao, nunca fixtures de teste.

## Documentacao oficial consultada

- [Monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [Build e variaveis](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Versao do Node](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Rotas e SPA](https://developers.cloudflare.com/pages/configuration/serving-pages/)
