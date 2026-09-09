# Configuracao local e Supabase

## 1. Projeto e migrations

Crie ou escolha um projeto Supabase vazio para a PARADIGMA. Loja e painel devem usar o mesmo projeto. A configuracao local do projeto foi preenchida durante a sessao. O estado de cada migration aplicada remotamente deve ser confirmado separadamente.

No Dashboard, abra SQL Editor e execute, em ordem, o conteudo completo de:
- supabase/migrations/202609060001_catalog.sql
- supabase/migrations/202609060002_storage.sql
- supabase/migrations/202609090001_theme.sql (personalizacao de cores; aplicar somente esta se as anteriores ja estiverem instaladas)

Cada migration e transacional; execute apenas uma vez por projeto e mantenha o registro de quais arquivos foram aplicados. Nao ha dados de exemplo. Em projeto existente, revise conflitos de nomes e politicas antes de aplicar: politicas permissivas anteriores de storage.objects podem ampliar acesso. As migrations nao apagam tabelas/buckets existentes nem substituem politicas externas.

Alternativa para quem ja usa CLI: instalar/configurar Supabase CLI, inicializar configuracao local com supabase init, fazer login e supabase link --project-ref REFERENCIA, revisar supabase db push --dry-run e executar supabase db push. Nao misturar aplicacao manual e CLI sem reconciliar o historico de migrations pelo fluxo migration repair. Nao passar senha do banco em argumentos ou arquivos versionados.

Confira no Dashboard: seis tabelas de catalogo com RLS, funcao public.is_admin(), tabela private.admin_memberships e bucket catalog marcado como privado, 5 MiB, MIME JPEG/PNG/WebP. Nao exponha o schema private na Data API.

## 2. Primeira administradora

1. Em Authentication > Sign In / Providers, habilite email/senha. Desative cadastro publico (Allow new users to sign up) se nao houver outro fluxo autorizado. Nao existe signup na aplicacao.
2. Em Authentication > Users > Add user > Create new user, crie a conta real com email correto e senha forte mantida no gerenciador de senhas da administradora. Confirme o email pelo fluxo do Dashboard quando necessario. Esta etapa usa login por senha; convites/links de recuperacao de senha nao estao implementados na UI.
3. Copie o UUID dessa conta na lista de Users. No SQL Editor, como operador do projeto, execute o bloco abaixo substituindo somente o UUID. O UUID e identificador, nao senha:

```sql
insert into private.admin_memberships (user_id)
values ('UUID_DA_CONTA_CONFIRMADA'::uuid)
on conflict (user_id) do nothing;
```

O FK exige conta existente. Nenhum usuario, nem uma administradora logada no app, possui permissao de gravar nessa tabela. Nunca usar user_metadata, campos de perfil, lista de emails no frontend ou allowlist editavel no navegador.

Para revogar, o operador executa:

```sql
delete from private.admin_memberships
where user_id = 'UUID_DA_CONTA'::uuid;
```

RLS verifica a membership a cada operacao, inclusive com token ainda valido. O painel revalida na recuperacao/renovacao de sessao e ao retornar a aba. Logout encerra a sessao deste navegador; nao e logout global de todos os dispositivos.

## 3. Variaveis locais

No Dashboard, obtenha Project URL e chave Publishable (sb_publishable_...). Crie apps/loja/.env.local e apps/admin/.env.local usando os respectivos .env.example, preenchendo em ambos os MESMOS valores:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Preencha somente localmente. O exemplo fica vazio no repositorio. Nao use chave legacy service_role, sb_secret_, senha do banco ou token Cloudflare. A aplicacao aceita apenas chave publishable; se o projeto ainda usa chaves legadas, crie uma publishable no Dashboard. Variaveis VITE_ sao publicadas no bundle: nao sao cofre de segredos.

Reinicie os dois servidores depois de editar env:

```sh
npm run dev:loja
npm run dev:admin
```

Loja: http://127.0.0.1:5173. Painel: http://127.0.0.1:5174. Se ocupadas, use as portas informadas pelo Vite. O painel mostrara login quando configurado; apenas membros autorizados entram. A loja usa cliente anonimo independente, mesmo que exista sessao administrativa.

Os fluxos atuais sao email/senha e restauracao da sessao, sem redirects por email. Configure Site URL e allowlist de redirects antes de introduzir recuperacao de senha/convites por link em etapa futura; SMTP transacional tambem sera necessario nesse caso.

## 4. Segredos e testes

.env, .env.local, .env.test.local, arquivos de chave e logs estao ignorados. Nao compartilhe esses arquivos nem valores em mensagens. Nao ha necessidade de chave privilegiada no navegador ou no script de teste real.

Execute o roteiro de docs/etapa-02.md em staging para verificar Auth/Storage reais. PGlite e fixtures HTTP locais nao validam configuracoes do seu projeto.

Fontes oficiais: https://supabase.com/docs/guides/getting-started/api-keys, https://supabase.com/docs/guides/database/postgres/row-level-security, https://supabase.com/docs/reference/javascript/auth-onauthstatechange e https://supabase.com/docs/guides/storage/serving/downloads.

## Cloudflare Pages (nao executar nesta etapa)

Sera necessario acesso a conta Cloudflare e ao repositorio Git, e eventualmente DNS dos dominios. Via CI/CLI, usar token restrito a Pages e Account ID em secrets da plataforma.

Criar futuramente dois projetos Pages no mesmo repositorio, ambos com raiz de build na raiz do monorepo:

| Projeto | Comando | Diretorio de saida |
| --- | --- | --- |
| Loja | npm run build:loja | apps/loja/dist |
| Admin | npm run build:admin | apps/admin/dist |

Fixar Node 24 no ambiente de build e configurar as variaveis publicas por projeto. Mudancas em packages/ e no lockfile devem disparar ambos os builds; mudancas especificas de app podem usar watch paths. Painel por hash nao precisa de rewrite de rotas. Integrar autenticacao e permissoes antes de disponibilizar o painel.

Fontes: https://developers.cloudflare.com/pages/configuration/monorepos/ e https://developers.cloudflare.com/pages/configuration/build-watch-paths/.

Nao sao necessarias credenciais de pagamentos nesta etapa.
