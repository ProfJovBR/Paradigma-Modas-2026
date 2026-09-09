# Etapa 03: personalizacao de cores

Implementacao autorizada em 09/09/2026. Esta etapa amplia apenas o tema; promocoes, pedidos, checkout e pagamentos continuam pendentes.

## Ativacao

Aplicar uma vez o conteudo completo de `supabase/migrations/202609090001_theme.sql` no SQL Editor do mesmo projeto Supabase da loja e do painel, como operador. A migration pressupoe Auth, private.admin_memberships e public.is_admin() ja existentes. Nao modifica as migrations anteriores nem as politicas do catalogo/Storage. Se houver conflito com tabelas/funcoes existentes, revisar antes de executar; nao remover objetos para contornar conflitos.

Apenas a configuracao singleton e criada, com rascunho e publicacao nulos. Nao ha produtos ou dados ficticios. Sem publicacao, a loja usa defaultTheme de packages/ui/src/theme.ts.

Nao foi possivel aplicar remotamente nesta entrega: a conexao disponivel e a chave publishable e nao ha sessao de Dashboard acessivel pela ferramenta de navegador. Nunca solicitar chave secreta para colocar no frontend. O painel informa migration ausente e bloqueia escrita se o carregamento falhar.

## Uso

1. Entrar no painel e abrir Aparencia.
2. Alterar as cores: afeta apenas a previa isolada.
3. Salvar rascunho: persiste para retomar depois, sem alterar a loja.
4. Publicar tema: salva e publica as cores atuais em uma transacao. Texto precisa ter contraste de pelo menos 4,5:1 com fundo e superficies.
5. Loja reconsulta ao recarregar, retomar foco, mudar hash ou a cada 60 segundos enquanto visivel. Nao e sincronizacao instantanea.

Restaurar padrao altera somente os seletores e a previa; para aplicar a loja, publicar explicitamente. Edicoes nao salvas se perdem ao trocar de tela. Recarregar tema salvo pede confirmacao se houver mudancas locais; o navegador tambem alerta antes de recarregar/fechar com alteracoes pendentes.

## Seguranca e consistencia

- theme_settings: RLS ativo; anon/authenticated podem selecionar somente published. draft e revision sao lidos por get_theme_editor(), que verifica membership. Escrita direta nao e concedida a clientes.
- save_theme(): SECURITY DEFINER com search_path vazio, autorizacao por public.is_admin(), validacao de quatro tokens hex de seis digitos, contraste calculado no servidor para publicacao. Rascunhos com baixo contraste podem ser salvos para edicao.
- Bloqueio da linha e UUID de revisao impedem sobrescrita por editor desatualizado. Conflito retorna 40001; usuario precisa recarregar conscientemente.
- theme_versions: historico de publicacoes, leitura somente administrativa, sem escrita direta. A versao e o tema publicado mudam na mesma transacao.
- Falha de rede nunca mostra sucesso. Se a resposta de uma gravacao se perder, recarregar o estado salvo para verificar o resultado real antes de tentar novamente.
- Loja valida os tokens recebidos e mantem a ultima versao valida durante falhas; primeira carga sem tema valido usa o padrao. Textos sobre a cor principal usam branco/preto ou texto escuro conforme contraste. Cores auxiliares acompanham temas escuros.

## Verificacao

`npm run test:db`: PostgreSQL em memoria (PGlite), executando as tres migrations. Cobre isolamento do rascunho por privilegios de coluna, negativa de RPC para visitante/usuario comum, escrita direta bloqueada, contraste/formato invalidos, revisao obsoleta, historico, publicacao atomica e revogacao administrativa.

`npm run test:ui`: Playwright/Chrome com HTTP interceptado exclusivamente em supabase.test. Cobre salvar/retomar rascunho sem mudar a loja, publicar e atualizar ao foco, desktop/390/320px, tema escuro, falha de rede, contraste insuficiente, conflito entre abas e migration ausente.

`npm run build`: TypeScript estrito e builds das duas aplicacoes.

Estes testes nao comprovam Auth/RLS/Storage do Supabase hospedado. Aplicacao remota e aceite manual do tema ainda pendentes: salvar um rascunho, reabrir o painel, verificar isolamento na loja anonima, publicar e conferir a mudanca. Nao executar fixtures em producao.

Resultado local em 09/09/2026: teste SQL/PGlite aprovado, seis testes Playwright aprovados (incluindo catalogo/tema em 1440/390/320px), build aprovado para loja e painel. Capturas de Aparencia em desktop e 320px revisadas.
