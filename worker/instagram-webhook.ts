import type { Env } from "./admin-api";

const INSTAGRAM_ACCOUNT_ID = "17841461318186821";
const TARGET_SHORTCODE = "DdPJa0dCW_r";
const KEYWORD = "decor";
const DM_MESSAGE = [
  "Olá! Separei estas opções de decoração para você:",
  "",
  "Estante Alta: https://meli.la/2L1ayfd",
  "Nicho suspenso: https://meli.la/2PVHFot",
  "Porta temperos: https://meli.la/12q5tXU",
  "Prateleira para micro-ondas: https://meli.la/249rBLW",
  "Banqueta com encosto: https://meli.la/2T4PxKq",
].join("\n");

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

function containsKeyword(value: string): boolean {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .includes(KEYWORD);
}

async function isTargetPublication(mediaId: string, accessToken: string): Promise<boolean> {
  const url = new URL(`https://graph.instagram.com/${encodeURIComponent(mediaId)}`);
  url.searchParams.set("fields", "permalink");
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return false;
  const data = await response.json() as { permalink?: string };
  return typeof data.permalink === "string" && data.permalink.includes(`/${TARGET_SHORTCODE}/`);
}

async function sendPrivateReply(commentId: string, accessToken: string): Promise<boolean> {
  const response = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_ACCOUNT_ID}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: DM_MESSAGE },
      }),
    },
  );
  return response.ok;
}

async function processComment(value: Record<string, unknown>, env: Env): Promise<void> {
  const commentId = typeof value.id === "string" ? value.id : "";
  const commentText = typeof value.text === "string" ? value.text : "";
  const media = value.media && typeof value.media === "object" ? value.media as Record<string, unknown> : {};
  const mediaId = typeof media.id === "string" ? media.id : "";

  if (!commentId || !mediaId || !containsKeyword(commentText) || !env.INSTAGRAM_ACCESS_TOKEN) return;

  const idempotencyKey = `instagram_comment:${commentId}`;
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO system_settings (key,value,updated_at) VALUES (?1,'processing',datetime('now'))",
  ).bind(idempotencyKey).run();
  if (Number(inserted.meta.changes ?? 0) === 0) return;

  try {
    if (!(await isTargetPublication(mediaId, env.INSTAGRAM_ACCESS_TOKEN))) {
      await env.DB.prepare("UPDATE system_settings SET value='ignored',updated_at=datetime('now') WHERE key=?1")
        .bind(idempotencyKey).run();
      return;
    }

    if (!(await sendPrivateReply(commentId, env.INSTAGRAM_ACCESS_TOKEN))) {
      throw new Error("Instagram recusou a resposta privada.");
    }

    await env.DB.prepare("UPDATE system_settings SET value='processed',updated_at=datetime('now') WHERE key=?1")
      .bind(idempotencyKey).run();
  } catch (error) {
    await env.DB.prepare("DELETE FROM system_settings WHERE key=?1").bind(idempotencyKey).run();
    console.error("Falha ao processar comentário do Instagram.", error instanceof Error ? error.message : "erro desconhecido");
  }
}

async function processPayload(payload: unknown, env: Env): Promise<void> {
  if (!payload || typeof payload !== "object") return;
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return;

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const item = change as { field?: unknown; value?: unknown };
      if (item.field !== "comments" || !item.value || typeof item.value !== "object") continue;
      await processComment(item.value as Record<string, unknown>, env);
    }
  }
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

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return text("Payload inválido.", 400);
    }

    await processPayload(payload, env);
    return text("EVENT_RECEIVED");
  }

  return text("Método não permitido.", 405);
}
