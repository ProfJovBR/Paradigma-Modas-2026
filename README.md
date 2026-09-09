# Paradigma Modas 2026

Loja e painel administrativo separados, com identidade compartilhada. Etapa 02: integracao Supabase para autenticacao administrativa e catalogo. Etapa 03: rascunho e publicacao das cores da loja (exige a migration de tema). Sem compras, pagamentos ou publicacao de site.

## Executar

Requer Node.js 22.12+ (verificado com Node 24.15) e npm.

```sh
npm install
npm run dev:loja
```

Em outro terminal:

```sh
npm run dev:admin
```

Loja: http://127.0.0.1:5173. Painel: http://127.0.0.1:5174. Se a porta estiver ocupada, o Vite informa a proxima livre.

```sh
npm run build
npm run test:db
npm run test:ui
```

Builds em apps/loja/dist e apps/admin/dist. Os testes usam Chrome instalado e iniciam servidores proprios nas portas 5183 a 5186 (com fixtures e sem configuracao).

Sem configuracao, o painel mostra instrucoes de acesso e a loja mostra catalogo indisponivel. Configure o mesmo projeto em apps/loja/.env.local e apps/admin/.env.local, aplique as migrations e provisione a primeira administradora seguindo docs/configuracao.md. Nao coloque segredos em VITE_.

Os testes locais usam PostgreSQL em memoria (PGlite) e fixtures HTTP de navegador. Eles nao acessam Supabase real. O roteiro e teste opcional de staging estao em docs/etapa-02.md.

- [Arquitetura e regras](docs/arquitetura.md)
- [Escopo, referencias e verificacao](docs/etapa-01.md)
- [Credenciais e hospedagem futura](docs/configuracao.md)
- [Etapa 02 e verificacoes](docs/etapa-02.md)

- [Etapa 03: personalizacao de cores](docs/etapa-03.md)
