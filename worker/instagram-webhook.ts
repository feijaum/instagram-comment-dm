import type { Env } from "./admin-api";

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validSignature(body: ArrayBuffer, signature: string, appSecret: string): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, body);
  return constantTimeEqual(signature.slice(7).toLowerCase(), bytesToHex(new Uint8Array(digest)));
}

export async function handleInstagramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode") ?? "";
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";

    if (
      mode === "subscribe" &&
      env.META_WEBHOOK_VERIFY_TOKEN &&
      challenge &&
      constantTimeEqual(token, env.META_WEBHOOK_VERIFY_TOKEN)
    ) {
      return text(challenge);
    }
    return text("Verificação recusada.", 403);
  }

  if (request.method === "POST") {
    if (!env.META_APP_SECRET) return text("Webhook não configurado.", 503);
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    const rawBody = await request.arrayBuffer();
    if (!(await validSignature(rawBody, signature, env.META_APP_SECRET))) {
      return text("Assinatura inválida.", 401);
    }

    try {
      JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return text("Payload inválido.", 400);
    }

    return text("EVENT_RECEIVED");
  }

  return text("Método não permitido.", 405);
}
