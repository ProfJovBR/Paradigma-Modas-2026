# Etapa 02: catalogo e autenticacao

## Implementado

- Cliente Supabase configurado separadamente em cada app, apontando para o mesmo projeto; somente chave publishable aceita.
- Painel com login real por email/senha, recuperacao de sessao, refresh de token, logout deste navegador e verificacao de membership no banco. Nenhum cadastro publico de administradores.
- Migrations SQL versionadas: categorias, tamanhos, cores, produtos, variantes com SKU/estoque, imagens e membership privada.
- RLS em todas as tabelas de catalogo e membership; grants explicitos; is_admin sem argumentos, SECURITY DEFINER com search_path vazio. Metadados editaveis nao participam da autorizacao.
- CRUD de categorias/tamanhos/cores; exclusoes em uso bloqueadas por FK. Criacao de produto como rascunho, edicao, publicacao, volta a rascunho e arquivamento. Variantes editaveis e estoque inteiro nao negativo.
- Upload, exclusao, descricao e ordem de fotos. Bucket privado, nomes UUID sem sobrescrita; limite servidor de 5 MiB e MIME JPEG/PNG/WebP. Navegador verifica assinatura binaria, decodificacao e dimensoes (8000px/lado, 32MP).
- Catalogo consultado no banco, busca por nome, filtro por categoria, ordenacao, paginacao e pagina de produto com galeria, variantes e disponibilidade. Estados de carregamento, erro/retry, vazio e produto indisponivel.
- Previa de cores preservada, sem persistencia. Promocoes e pedidos continuam explicitamente indisponiveis. Nenhum checkout, pagamento ou deploy.

## Regras operacionais

O catalogo publico e composto por status active, mesmo sem estoque (indicado na tela). Publicar nao salva campos pendentes. Cada secao de produto possui seu proprio salvar; variantes e fotos sao independentes. Atualizacoes de produto e variante usam updated_at para impedir sobrescrita silenciosa de alteracoes concorrentes. O servidor valida precos/quantidades/atributos e RLS em qualquer cliente HTTP.

Fotos nao usam URLs publicas nem links assinados. Cada download consulta RLS; objetos nao associados a produto publico ficam privados. Cache-control 0 nos uploads e no-store nas consultas do cliente. Dados ja baixados/capturados nao podem ser retirados do dispositivo de um visitante. A loja reconsulta ao recarregar, retomar foco e a cada 60 segundos visiveis; nao e sincronizacao instantanea.

Storage e banco nao compartilham uma transacao. Upload cria metadados antes do objeto e tenta compensar falhas; remocao apaga objeto antes dos metadados. Em interrupcao de rede, pode sobrar registro incompleto ou objeto orfao privado. A interface permite remover registros incompletos; o operador pode revisar objetos orfaos pelo Dashboard Storage. Nao excluir registros diretamente de storage.objects: usar Storage API/Dashboard.

Validacao de assinatura/dimensoes ocorre no navegador e pode ser contornada por uma administradora usando API direta. RLS e MIME/tamanho do bucket sao impostos no servidor. O sistema nao permite uploads de visitantes/usuarios comuns; nao oferece antivirus ou processamento de imagens em servidor nesta etapa. SVG nao e aceito.

## Verificacoes locais

`npm run test:db`: executa as duas migrations em PostgreSQL WASM (PGlite), com schemas auth/storage minimos de teste. Verifica grants/RLS, negacao de escrita para visitante/usuario comum, isolamento de rascunhos/imagens/atributos, publicacao e arquivamento, tentativa de autoatribuicao, metadados falsos, revogacao administrativa e estoque negativo. Tudo em memoria; nao toca projeto externo.

`npm run test:ui`: Playwright/Chrome com HTTP interceptado apenas em https://supabase.test e dados de teste somente na memoria do teste. Verifica login/erro, restauracao/logout, acesso negado, CRUD e fluxo de publicacao/arquivamento refletido na loja, upload invalido e valido, variante/estoque, pagina de produto, estados de erro e layout 1440/390/320px. Isso testa a interface e SDK, nao a seguranca do servico hospedado.

`npm run build`: TypeScript estrito e builds das duas aplicacoes.

Resultado em 06/09/2026: build aprovado para loja e painel; teste SQL/PGlite aprovado; cinco testes Playwright aprovados, incluindo fluxo completo em 1440/390/320px, acesso negado e inicializacao sem credenciais. Capturas de produto, editor, aparencia e configuracao foram revisadas. Nao houve conexao a Supabase real nem insercao em banco externo.

## Testar Supabase real

Nao executado nesta entrega: nao foram fornecidos projeto/credenciais, e nao foi criado ou alterado banco externo. Preparar primeiro um projeto de staging dedicado seguindo docs/configuracao.md, com migrations e duas contas: administradora e usuario comum confirmado. Nao usar producao para o teste automatizado abaixo; ele cria fixtures descartaveis e tenta remove-las ao final.

1. Na raiz, criar .env.test.local a partir de tests/integration/.env.example.
2. Preencher URL/chave publishable do staging, emails/senhas das duas contas de teste e PARADIGMA_TEST_ALLOW_WRITES=isolated-staging. O arquivo e ignorado pelo Git. Nao colar valores em mensagens ou comandos que aparecam no historico.
3. Executar `npm run test:supabase`. O script usa somente chave publica e JWTs obtidos por login; nao precisa de service_role/senha do banco. Saida sanitizada informa apenas etapa/resultado.
4. Verificar que o script concluiu tambem a limpeza. Se houve falha, revisar registros "Teste isolado" e objetos orfaos no staging.

O teste remoto verifica Auth, membership, cadastro/variante/foto, rascunho oculto, negativas de escrita/upload/download, publicacao/leitura e arquivamento ocultando produto/foto. Os testes SQL locais cobrem ainda tentativas diretas contra membership, claims falsas, grants e revogacao.

## Aceite manual com dados reais

1. Entrar no painel com a primeira administradora. Recarregar e confirmar restauracao da sessao.
2. Cadastrar categoria, tamanho e cor reais. Criar produto com preco real; salvar rascunho. Adicionar variante/SKU/estoque, foto real e descricao da foto; salvar.
3. Em janela anonima, abrir loja e #produto/UUID: rascunho deve estar ausente e detalhe indisponivel.
4. Publicar no painel. Recarregar loja anonima: conferir produto, preco, imagem e variante.
5. Editar estoque e verificar disponibilidade apos recarregar. Arquivar; confirmar ausencia no catalogo, detalhe e novas requisicoes de imagem.
6. Sair e tentar entrar com usuario comum: painel negado. No staging, executar teste remoto para verificar as mesmas restricoes fora da UI.

Esse aceite permanece pendente de configuracao externa. Nao confundir um build aprovado com validacao de RLS no seu projeto, que pode conter politicas anteriores permissivas.

## Opcoes padrao de tamanhos e cores

O painel oferece 20 tamanhos e 18 cores em Categorias e variacoes. Em cada aba, "Cadastrar opcoes padrao" grava as opcoes ausentes pelo cliente autenticado e pelas politicas RLS existentes. Nao ha migration ou cadastro automatico ao abrir a tela. Os valores ficam em apps/admin/src/attribute-presets.ts; nomes e cores cadastrados continuam editaveis.

Antes de gravar, o painel consulta os registros atuais e compara nomes sem distinguir maiusculas/minusculas e espacos nas extremidades. A insercao em lote ignora conflitos exatos de nome sem sobrescrever registros existentes. A confirmacao depende de nova leitura do banco. Duas criacoes simultaneas com diferencas de caixa ainda seguem a unicidade exata do schema existente.

O teste tests/presets.spec.ts usa somente fixtures HTTP em memoria: cadastro, retorno a aba, preservacao de nome/cor existentes, falha de gravacao sem sucesso falso e layout de 320px. O cadastro no Supabase real ocorre quando a administradora aciona o botao.
