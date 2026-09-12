import { z } from "zod";
import {
  createSession,
  getSessionUser,
  hashPassword,
  isLoginRateLimited,
  isSameOrigin,
  recordLoginAttempt,
  revokeSession,
  verifyPassword,
} from "./auth";

export interface Env {
  DB: D1Database;
  INSTAGRAM_TOKEN_ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
}

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
}).strict();

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function genericLoginFailure(): Response {
  return json({ error: "E-mail ou senha inválidos." }, { status: 401 });
}

async function login(request: Request, env: Env): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Dados de login inválidos." }, { status: 400 });

  const { email, password } = parsed.data;
  if (await isLoginRateLimited(env.DB, email)) return json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });

  const normalizedEmail = email.toLowerCase();
  const user = await env.DB.prepare("SELECT id, email, password_hash, is_active FROM users WHERE email = ?1 LIMIT 1")
    .bind(normalizedEmail)
    .first<{ id: string; email: string; password_hash: string; is_active: number }>();

  const valid = Boolean(user?.is_active) && Boolean(user) && await verifyPassword(password, user.password_hash);
  await recordLoginAttempt(env.DB, email, valid);
  if (!valid || !user) return genericLoginFailure();

  await env.DB.prepare("INSERT INTO audit_logs (id, user_id, action, resource_type, outcome) VALUES (?1, ?2, 'login', 'session', 'success')")
    .bind(crypto.randomUUID(), user.id)
    .run();
  return createSession(env.DB, { id: user.id, email: user.email });
}

async function me(request: Request, env: Env): Promise<Response> {
  const user = await getSessionUser(env.DB, request);
  if (!user) return json({ authenticated: false }, { status: 401 });
  return json({ authenticated: true, user });
}

async function logout(request: Request, env: Env): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
  const user = await getSessionUser(env.DB, request);
  const headers = await revokeSession(env.DB, request);
  if (user) {
    await env.DB.prepare("INSERT INTO audit_logs (id, user_id, action, resource_type, outcome) VALUES (?1, ?2, 'logout', 'session', 'success')")
      .bind(crypto.randomUUID(), user.id)
      .run();
  }
  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ status: "ok", service: "instagram-comment-dm" });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/login") return login(request, env);
    if (request.method === "GET" && url.pathname === "/api/auth/me") return me(request, env);
    if (request.method === "POST" && url.pathname === "/api/auth/logout") return logout(request, env);

    if (url.pathname.startsWith("/api/")) return json({ error: "Rota não encontrada." }, { status: 404 });
    return env.DB
      ? new Response("Aplicação pronta para o shell do Worker.", { status: 200 })
      : new Response("Configuração do banco ausente.", { status: 503 });
  },
};
