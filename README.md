# Instagram Comment DM Automation

Plataforma web segura para automatizar respostas via DM no Instagram a partir de comentários em publicações, usando exclusivamente APIs oficiais da Meta/Instagram.

## Status

**Fase atual: Fase 1 — Estrutura, documentação e estado inicial**

O repositório foi criado vazio. Nesta fase não há implementação funcional de frontend, backend ou integração com a Meta.

## Objetivos

- Conectar contas do Instagram por fluxo oficial da Meta.
- Cadastrar publicações, produtos e regras de automação.
- Detectar comentários elegíveis por publicação e palavra-chave.
- Resolver o produto exclusivamente a partir da configuração administrativa persistida.
- Enviar DM somente por APIs oficiais e dentro das restrições da Meta.
- Garantir idempotência, rate limiting, autorização por recurso e auditoria.
- Não expor tokens, segredos ou dados sensíveis no frontend, logs ou respostas de API.

## Stack planejada

- Frontend: React + TypeScript.
- Backend: Cloudflare Workers.
- Banco: Cloudflare D1.
- Validação: Zod ou equivalente.
- Deploy: Cloudflare Pages/Workers.
- Controle de versão: Git/GitHub.

A stack será confirmada antes da implementação estrutural.

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — arquitetura e fluxo de dados.
- [SECURITY.md](SECURITY.md) — requisitos e controles de segurança.
- [PROJECT_STATE.md](PROJECT_STATE.md) — estado atual e histórico de fases.
- [CHANGELOG.md](CHANGELOG.md) — alterações verificáveis do projeto.

## Regra de segurança

Tokens da Meta, segredos de API, senhas e segredos de sessão nunca devem ser armazenados no código-fonte, frontend, localStorage, logs ou mensagens de erro.

## Desenvolvimento

Nenhuma funcionalidade deve ser considerada concluída sem validação apropriada. Antes de produção, devem passar testes, typecheck, lint, build e migrações, além das verificações de segurança previstas no projeto.
