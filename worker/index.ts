export interface Env {
  DB: D1Database;
  INSTAGRAM_TOKEN_ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...init.headers,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ status: "ok", service: "instagram-comment-dm" });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Rota não encontrada." }, { status: 404 });
    }

    return env.DB
      ? new Response("Aplicação pronta para o shell do Worker.", { status: 200 })
      : new Response("Configuração do banco ausente.", { status: 503 });
  },
};
