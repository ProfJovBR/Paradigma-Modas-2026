# Etapa 04: imagens dos banners da pagina inicial

## Entrega

O painel tem a pagina **Banners** (`#banners`), com cards independentes para Hero Banner e CTA Banner. Cada card mostra a imagem publicada, aceita selecao e previa local, permite editar o texto alternativo, cancelar, substituir, remover e salvar/publicar. A selecao nao faz upload nem altera a loja. Remover tambem precisa de publicacao explicita. Alteracoes locais se perdem ao sair da pagina; recarregar o estado publicado pede confirmacao quando ha edicoes, e fechar/recarregar a aba exibe o aviso do navegador.

Nao existia suporte a imagens por dispositivo: cada banner usa uma unica imagem responsiva. Os containers, textos, botoes, recortes e breakpoints existentes foram preservados. As imagens personalizadas usam `object-fit: cover`, centralizadas e sem distorcao. Recomenda-se **1440 x 960 px (3:2)** para a area fotografica do Hero e **1440 x 480 px (3:1)** para a do CTA; essas medidas nao incluem a area de texto do banner. Mantenha o assunto principal no centro para permitir recortes em telas pequenas. Os banners do catalogo e do dashboard, assim como as categorias, nao sao alterados por esta pagina.

As imagens padrao atuais continuam como fallback, conforme solicitado nesta etapa: sem cadastro, durante o carregamento e em falhas de consulta/download/decodificacao. Nao foram adicionadas imagens comerciais ou produtos ficticios. O alt de uma imagem cadastrada e aplicado ao elemento `img`; vazio e permitido para imagens decorativas.

## Ativar no Supabase

1. No mesmo projeto usado pela loja e pelo painel, aplicar **uma vez** o arquivo completo [`202609160001_banners.sql`](../supabase/migrations/202609160001_banners.sql) pelo SQL Editor, como operador. Aplicar primeiro as migrations anteriores se o projeto for novo. Nao editar migrations ja aplicadas.
2. A migration cria `site_banners`, `banner_assets`, as RPCs e o bucket **banners**, privado, com limite **5.000.000 bytes (5 MB)** e MIME `image/jpeg`, `image/png`, `image/webp`. Nao e necessario criar o bucket manualmente. O limite global de uploads do projeto deve permitir pelo menos 5 MB. Se ja existir um bucket/tabela com esses nomes, revisar o conflito antes de aplicar; nao apagar objetos para contornar erros.
3. Manter as variaveis ja usadas pelos dois apps: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nao adicionar service_role, senha de banco ou chave administrativa ao frontend. A conta administrativa precisa ter membership em `private.admin_memberships`, conforme a configuracao existente.
4. O painel informa migration ausente e bloqueia publicacao se nao conseguir carregar os registros. A loja continua usando o fallback. Nao ha deploy ou aplicacao remota automatica nesta entrega.

O banco guarda somente caminho, alt e revisao do banner publicado. Arquivos ficam no Storage, nunca em base64 no banco. Downloads usam o cliente anonimo da loja e blob URLs temporarias, sujeitas a RLS; nao ha URLs publicas ou assinadas duradouras. As blob URLs de download e previa sao revogadas quando substituidas/desmontadas.

## Seguranca, falhas e limpeza

- Todas as RPCs de escrita e limpeza verificam `public.is_admin()`. Escrita direta nas tabelas nao e concedida nem a administradores pelo navegador. A leitura publica permite somente os dois registros publicados; o controle de uploads e restrito aos administradores.
- O navegador reaproveita a validacao de MIME, assinatura binaria e decodificacao de imagens do catalogo, com limite de 5 MB, 8000 pixels por lado e 32 megapixels. O bucket impoe MIME/tamanho no servidor; a RPC de publicacao tambem verifica a existencia e os metadados do objeto. Assinatura e dimensoes sao validadas no navegador, nao representam inspecao de bytes no servidor.
- `prepare_banner_upload` cria um caminho UUID novo registrado como pending; upload usa `upsert: false`. Arquivos pendentes nao podem ser baixados publicamente. `publish_banner` verifica revisao e bloqueia o registro para impedir sobrescrita entre abas. Somente depois de validar o objeto substitui o caminho publicado, marca o novo arquivo como active e o anterior como retired, na mesma transacao SQL.
- A imagem publicada nunca e apagada antes do upload/publicacao novos. A politica de DELETE do Storage permite somente arquivos retired. Falhas de upload ou rejeicoes da publicacao preservam o caminho anterior. Se o servidor publicou mas a resposta se perdeu, a interface nao anuncia sucesso: exige recarregar para conferir o estado. `discard_banner_upload` nao retira arquivos active, portanto a compensacao nao apaga a imagem que acabou de ser publicada.
- Depois de salvar e ao abrir Banners, o painel executa limpeza via **Storage API** e reconsulta a fila para confirmar. Falhas deixam os arquivos rastreados, exibem aviso separado do resultado da publicacao e permitem tentar novamente. Requisicoes simultaneas de limpeza da pagina sao enfileiradas.
- Uploads abandonados por fechamento/interrupcao ficam rastreados como pending. A proxima limpeza os torna retired apos **24 horas**; entao nao podem mais ser publicados. A fila considera ate 100 objetos por consulta; cada execucao processa ate dez lotes e informa pendencia caso reste trabalho. A limpeza depende de uma sessao administrativa abrir a pagina ou tentar novamente; nao existe job agendado nesta etapa.
- Os registros retired sao mantidos como marcadores leves para localizar inclusive uploads que terminem atrasados; nao sao imagens publicadas nem arquivos orfaos sem rastreio. Nenhuma rotina da aplicacao apaga metadados diretamente de `storage.objects`. A remocao deve usar a Storage API, conforme a [documentacao oficial do Supabase](https://supabase.com/docs/guides/storage/management/delete-objects).

A loja reconsulta ao abrir, navegar, retomar foco/visibilidade e a cada 60 segundos enquanto visivel. Nao e atualizacao instantanea por WebSocket. Remover uma imagem restaura o fallback no proximo refresh. Uma imagem que alguem ja baixou nao pode ser revogada do dispositivo.

## Como testar manualmente

1. Aplicar a migration em staging dedicado. Iniciar `npm run dev:admin` e `npm run dev:loja` com a configuracao desse projeto.
2. Entrar com uma administradora e abrir Banners. Conferir o fallback dos dois cards e suas dimensoes recomendadas.
3. Selecionar JPG, PNG ou WebP e preencher o alt. Conferir a previa; em uma loja anonima, a imagem deve permanecer inalterada. Cancelar e conferir o retorno ao estado salvo.
4. Salvar e publicar. Retomar o foco da loja anonima ou recarregar: o banner e seu alt devem refletir a publicacao. Reabrir Banners e conferir persistencia. Repetir para o CTA, que deve ser independente do Hero.
5. Substituir a imagem e conferir que o novo caminho e diferente e que o objeto anterior foi removido do bucket apos a limpeza. Editar apenas o alt nao deve criar outro arquivo. Remover/publicar deve retornar ao fallback.
6. Tentar GIF, arquivo corrompido e imagem acima de 5 MB. As gravacoes devem ser bloqueadas sem alterar o publicado. Testar falha de rede durante upload/salvamento: nao deve haver sucesso falso; conferir o estado salvo antes de repetir uma publicacao de resultado incerto.
7. Abrir o mesmo banner em duas abas, publicar em uma e tentar salvar a outra: deve aparecer conflito e exigir recarga consciente. Uma conta comum deve ser bloqueada pelo painel e pelas RPCs/RLS; nao confiar somente no bloqueio visual.
8. Conferir desktop, tablet e celular, incluindo 320 px, e falha no download da imagem: layout preservado, sem distorcao/overflow e fallback disponivel.

Fixtures automatizadas sao apenas locais/em memoria. Nao executar testes que criem fixtures em producao.

## Verificacao desta entrega

Os testes SQL usam PGlite com schemas minimos de Auth/Storage; verificam grants, RLS, RPCs, upload pendente oculto, publicacao, remocao, conflito, alt, metadados invalidos, limite de tamanho, impossibilidade de apagar/republicar arquivos ativos/retirados, abandono e revogacao administrativa. O harness simula a remocao da Storage API com SQL somente no banco em memoria.

Os testes Playwright interceptam somente `https://supabase.test`, com imagens sinteticas criadas em memoria. Cobrem selecao/previa/cancelamento, formatos aceitos, arquivos invalidos, publicacao dos dois banners, alt, recarga, troca/remocao, falhas de upload/publicacao/download/consulta, resposta perdida apos publicacao, limpeza pendente/retry, conflito e gate administrativo em 1440/768/390/320 px. A suite existente de catalogo, Auth e tema tambem deve continuar passando.

Comandos: `npm run typecheck`, `npm run test:db`, `npm run test:ui`, `npm run build`.

Resultado local em 16/09/2026: typecheck aprovado; suite SQL/PGlite aprovada com as quatro migrations; **20 testes Playwright aprovados**, incluindo seis novos cenarios de banners; builds Vite de loja e painel aprovados. Capturas do painel em 320 px e da loja em 1440 px foram inspecionadas. A primeira rodada isolada dos banners encontrou uma espera ambigua do teste entre a publicacao e a limpeza; a espera foi corrigida e a suite completa passou.

Aplicacao da migration e verificacao contra **Supabase hospedado permanecem pendentes**. PGlite e mocks HTTP nao comprovam configuracao de Auth/RLS/Storage do projeto remoto.

## Arquivos da entrega

- `apps/admin/src/App.tsx`: navegacao para Banners.
- `apps/admin/src/Banners.tsx`: cards, formularios, previas e estados.
- `apps/admin/src/banner-api.ts`: carregamento, upload, publicacao e limpeza.
- `apps/loja/src/App.tsx`: imagens publicadas no Hero e CTA da home.
- `packages/core/src/banners.ts`: contratos, configuracao e validacao.
- `packages/core/src/index.ts`: exportacoes compartilhadas.
- `packages/ui/src/BannerImage.tsx`: download privado, renderizacao e fallback.
- `packages/ui/src/usePublishedBanners.ts`: consulta/revalidacao publica.
- `packages/ui/src/Commerce.tsx`: injecao das imagens nos banners existentes.
- `packages/ui/src/index.tsx`: exportacoes de UI.
- `packages/ui/src/styles.css`: object-fit e estilos dos cards administrativos.
- `supabase/migrations/202609160001_banners.sql`: schema, bucket, politicas e RPCs.
- `tests/banners.spec.ts`: fluxos de interface e falhas.
- `tests/mock-supabase.ts`: simulacao HTTP isolada de banners.
- `tests/database/banners.mjs`: verificacoes SQL dos banners.
- `tests/database/rls.test.mjs`: aplicacao da nova migration e integracao das verificacoes SQL.
- `docs/arquitetura.md`: registro das decisoes.
- `docs/etapa-04-banners.md`: configuracao, testes, limites e lista de arquivos.
