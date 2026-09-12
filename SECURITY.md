# Segurança

Este projeto trata segurança, privacidade e confiabilidade como requisitos de primeira classe.

## Segredos

Nunca armazenar no repositório ou no frontend:

- tokens da Meta/Instagram;
- client secrets e API secrets;
- senhas em texto puro;
- segredos de sessão;
- credenciais de banco;
- chaves privadas;
- dados sensíveis de configuração.

Segredos devem ser fornecidos por mecanismos apropriados de secret management/runtime e nunca devem aparecer em logs, respostas de API, mensagens de erro ou localStorage.

## Autenticação e sessão

Se houver autenticação própria com senha:

- armazenar somente hashes seguros;
- usar sessões seguras;
- preferir cookies `HttpOnly`, `Secure` e `SameSite` adequados;
- aplicar expiração e invalidação de sessão;
- registrar tentativas relevantes sem registrar credenciais.

## Autorização

Toda requisição a recurso protegido deve verificar autenticação e autorização no backend. IDs enviados pelo cliente não são suficientes para autorizar acesso. Consultas devem restringir explicitamente o proprietário/escopo do recurso para prevenir IDOR/BOLA.

## Entrada e saída

Validar entradas e saídas com schemas. Aplicar controles contra:

- SQL injection;
- XSS;
- CSRF quando aplicável;
- payloads malformados;
- parâmetros inesperados;
- URLs perigosas;
- abuso de endpoints.

Não executar HTML, JavaScript ou código arbitrário recebido de templates ou webhooks.

## URLs

Produtos aceitam somente URLs HTTPS cadastradas pelo administrador. Rejeitar esquemas perigosos como `javascript:`, `data:` e `vbscript:`. Nunca transformar uma URL recebida de webhook em destino de mensagem.

## Webhooks

- validar assinatura conforme a documentação oficial atual da Meta;
- rejeitar assinatura inválida;
- validar método, estrutura e conteúdo;
- rejeitar eventos desconhecidos ou não autorizados;
- identificar conta e publicação por configuração confiável;
- garantir idempotência em nível de banco;
- não registrar payloads sensíveis desnecessariamente.

## Anti-spam e abuso

Aplicar limites configuráveis por:

- usuário do Instagram;
- publicação;
- conta;
- sistema/global.

Também prevenir mensagens duplicadas, replay, retries descontrolados, loops, floods e abuso da API.

Deve existir uma ação global de emergência para `PAUSAR TODAS AS AUTOMAÇÕES`.

## Auditoria

Registrar eventos de segurança e alterações administrativas relevantes, incluindo login/falha, conexão/desconexão, criação/edição/exclusão de configurações, ativação/desativação e pausa de emergência.

Logs nunca devem conter tokens, senhas, cookies, segredos ou dados pessoais desnecessários.

## Meta/Instagram

Somente APIs oficiais serão utilizadas. Não implementar scraping, automação de navegador, endpoints não oficiais ou métodos para contornar restrições da Meta.

Antes de liberar a integração em produção, confirmar na documentação oficial vigente da Meta as permissões, versão da API, fluxo de autenticação, formato dos webhooks, recursos de comentários/mensagens e respectivas restrições.

## Validação antes de produção

A suíte de segurança deve cobrir, no mínimo:

- autenticação e autorização;
- IDOR/BOLA;
- rate limiting;
- idempotência;
- validação de webhook e assinatura;
- eventos duplicados;
- payloads maliciosos;
- XSS;
- SQL injection;
- validação de URLs;
- templates e variáveis permitidas;
- mocks do envio de DM.

Nenhuma etapa deve ser declarada concluída sem evidência de validação correspondente.
