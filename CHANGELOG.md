# Changelog

Todas as alterações relevantes do projeto devem ser registradas aqui.

## [Não lançado]

### Fase 3 — Autenticação e sessões seguras

- Adicionada migration `0001_auth.sql` com sessões e controle de tentativas de autenticação.
- Implementado hash de senha PBKDF2-HMAC-SHA-256 com salt aleatório.
- Implementadas sessões com token aleatório e armazenamento somente do hash no D1.
- Implementado cookie `__Host-session` com `HttpOnly`, `Secure` e `SameSite=Strict`.
- Implementados login, consulta de sessão e logout.
- Implementado rate limit para tentativas de login.
- Adicionada validação estrita do payload de login com Zod.
- Adicionada proteção de origem para operações de estado.
- Adicionados headers de segurança nas respostas JSON.
- Adicionada auditoria de login e logout sem registrar credenciais.
- Adicionada tela de login no frontend em pt-BR.
- Não adicionada integração Meta nesta fase.
- Testes de execução, typecheck, lint, build e migration ainda não foram declarados como aprovados.

### Fase 2 — Estrutura da aplicação e persistência

- Adicionada base React + TypeScript + Vite.
- Adicionado Cloudflare Workers como runtime/API inicial.
- Adicionada configuração Wrangler com binding D1 preparado.
- Adicionada migração D1 inicial com entidades, índices e constraints.
- Adicionado endpoint `/api/health` sem exposição de segredos.
- Adicionado shell inicial da interface administrativa em pt-BR.
- Adicionado TypeScript estrito e configuração inicial de ESLint.
- Adicionados `.gitignore` e `.env.example` para reduzir risco de vazamento local.
- Nenhuma integração Meta ou banco remoto foi ativada.

### Fase 1 — Estrutura e documentação

- Inicialização do repositório `feijaum/instagram-comment-dm`.
- Adicionado `README.md`.
- Adicionado `ARCHITECTURE.md`.
- Adicionado `SECURITY.md`.
- Adicionado `PROJECT_STATE.md`.
- Registrados os requisitos de segurança, idempotência, anti-spam, autorização, webhooks oficiais da Meta e proteção de segredos.
