# Etapa 06 — Conta do cliente

O botão Minha conta abre um modal nativo com Entrar e Criar conta. Cliente autenticado vai diretamente a #conta, com nome, e-mail, atalhos e logout local. A rota direta #conta oferece o mesmo acesso. O modal permite Escape, mantém foco dentro dele e devolve foco ao fechar.

O Supabase Auth guarda o cadastro. Nome fica em user_metadata.full_name apenas para apresentação; nunca participa da autorização. Não há nova tabela nem mudança de RLS ou membership administrativa. Cliente de identidade usa paradigma-customer-auth com persistência e renovação; catálogo e pedidos continuam usando o cliente público separado. O painel preserva paradigma-admin-auth.

Cadastro exige nome, e-mail e confirmação de senha (mínimo oito caracteres). Chamadas têm trava contra envio duplo, estados de erro e mensagem de confirmação quando o servidor não retorna sessão. Não declarar cadastro confirmado antes de receber sessão. Link de confirmação usa a origem da loja, detectSessionInUrl e limpa os tokens antes de abrir a conta. Pedidos antigos não são associados automaticamente por e-mail. Histórico de pedidos, edição de perfil e recuperação de senha ficam para outra etapa.

## Configuração hospedada em 30/10/2026

- SiteJanaina: email habilitado, disable_signup=false, mailer_autoconfirm=false (consulta ao endpoint público de settings).
- Site URL alterada de localhost:3000 para https://paradigma-modas-2026.pages.dev/ no painel Supabase.
- Sem SMTP customizado: painel mostra serviço interno de teste. Precisa configurar SMTP para cadastro de clientes reais; não desabilitar confirmação para contornar isso.
- Nenhuma conta fictícia criada em produção nem e-mail de teste enviado.

## Validação

Build e typecheck passaram. Dois testes locais de banco (PGlite) passaram; não equivalem a teste do Auth hospedado.
Foram adicionados testes Playwright de sessão persistida/logout, validação de senha e confirmação pendente, falha de login e Escape/foco no celular. A execução da suíte foi impedida por ausência do Chrome em /opt/google/chrome/chrome; os testes de UI não passaram nem falharam por comportamento da aplicação.
