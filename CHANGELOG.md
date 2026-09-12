# Changelog

Todas as alterações relevantes do projeto devem ser registradas aqui.

## [Não lançado]

### Fase 2 — Estrutura da aplicação e persistência

- Adicionada base React + TypeScript + Vite.
- Adicionado Cloudflare Workers como runtime/API inicial.
- Adicionada configuração Wrangler com binding D1 preparado.
- Adicionada migração D1 inicial com entidades, índices e constraints.
- Adicionado endpoint `/api/health` sem exposição de segredos.
- Adicionado shell inicial da interface administrativa em pt-BR.
- Adicionado TypeScript estrito e configuração inicial de ESLint.
- Adicionados `.gitignore` e `.env.example` para reduzir risco de vazamento local.
- Atualizado `README.md` e `PROJECT_STATE.md` com o estado verificável da fase.
- Nenhuma integração Meta ou banco remoto foi ativada.

### Fase 1 — Estrutura e documentação

- Inicialização do repositório `feijaum/instagram-comment-dm`.
- Adicionado `README.md`.
- Adicionado `ARCHITECTURE.md`.
- Adicionado `SECURITY.md`.
- Adicionado `PROJECT_STATE.md`.
- Registrado que o repositório iniciou sem código ou configuração de aplicação.
- Registrados os requisitos de segurança, idempotência, anti-spam, autorização, webhooks oficiais da Meta e proteção de segredos.
