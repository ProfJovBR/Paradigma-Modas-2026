# Etapa 01

## Inspecao

A pasta inicial continha somente dez PNGs em docs/referencias/. Nenhum codigo, manifesto ou estrutura de repositorio estava presente. Todos os PNGs foram preservados e lidos.

## Referencias

Arquivos compartilham o prefixo `ChatGPT Image 6 de set. de 2026, 02_07_02`:

| Sufixo | Referencia | Aproveitamento |
| --- | --- | --- |
| (1) | Inicio da loja | Marca serifada, amarelo e branco, faixas e catalogo |
| (2) | Listagem | Busca, filtros e ordenacao |
| (3) | Produto | Direcao futura para detalhes e variacoes |
| (4) | Carrinho | Apenas referencia futura; nao implementado |
| (5) | Checkout | Fora do escopo |
| (6) | Visao geral | Menu lateral, atalhos e areas de consulta |
| (7) | Produtos | Toolbar, listagem e acesso a cadastro |
| (8) | Promocoes | Navegacao e estados de campanhas |
| (9) | Nova promocao | Nome, selecao e modos de percentual |
| (10) | Aparencia | Seletores de cor e previa responsiva |

Nao foram copiadas fotos, produtos, precos, descontos, campanhas, depoimentos, beneficios comerciais ou metricas. Sem banner real aprovado, a loja usa faixa tipografica de identidade e estado de preparacao. Nao foi introduzida fotografia de estoque que pudesse parecer produto disponivel.

## Entregue

- Duas aplicacoes responsivas e builds separados, compartilhamento de UI, Tailwind e tema.
- Loja com marca, catalogo vazio, busca local, filtros vazios e ancora de marca.
- Painel com navegacao por hash, menu mobile, visao geral sem metricas inventadas e telas de produtos, atributos, promocoes, pedidos, aparencia e configuracao.
- Formularios visuais de produto e promocao, sem gravacao; modos global/individual alternaveis.
- Previa de cores em memoria, selecao desktop/celular e restauracao do tema base. Publicar desabilitado.

## Pendente

Auth real, schema/migracoes, RLS, consultas, CRUD, upload e ordenacao de imagens, edicao de variacoes/estoque, selecao de produtos em campanhas, calculos de desconto, publicacao de tema, pedidos reais e tratamento de loading/erro de rede. Os campos de formularios sao preparacao visual, nao cadastro funcional. Nao ha simulacao de sessao, checkout, persistencia ou pagamento.

## Verificacao

`npm run build`: TypeScript estrito e builds Vite das duas aplicacoes.
`npm run test:ui`: navegacao, filtros, modos de promocao, mudanca/restauracao de tema, isolamento da previa, menu mobile e ausencia de overflow; screenshots em test-results (ignorados pelo Git).

Verificado em 06/09/2026: ambos os builds aprovados; tres cenarios Playwright em Chrome (1440, 390 e 320px), sem erros JavaScript. Capturas de loja, painel e aparencia inspecionadas. Instalacao npm reportou zero vulnerabilidades. Os testes nao validam integracoes remotas, ainda inexistentes.
