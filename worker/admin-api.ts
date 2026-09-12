import { z } from "zod";
import { getSessionUser, isSameOrigin } from "./auth";

export interface Env {
  DB: D1Database;
  INSTAGRAM_TOKEN_ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
}

type AuthUser = { id: string; email: string };

const postCreate = z.object({
  instagram_account_id: z.string().uuid(),
  provider_post_id: z.string().trim().min(1).max(255),
  title: z.string().trim().max(200).nullable().optional(),
}).strict();
const postPatch = postCreate.partial();
const productCreate = z.object({
  name: z.string().trim().min(1).max(160),
  product_url: z.string().trim().max(2048).url(),
}).strict();
const productPatch = productCreate.partial();
const automationCreate = z.object({
  post_id: z.string().uuid(),
  product_id: z.string().uuid(),
  keyword: z.string().trim().min(1).max(80),
  dm_template: z.string().trim().min(1).max(1000),
  is_active: z.boolean().optional(),
}).strict();
const automationPatch = automationCreate.partial();
const approvedVariables = new Set(["{{nome}}", "{{link_produto}}"]);

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
function noContent(): Response { return json(null, { status: 204 }); }
function id(): string { return crypto.randomUUID(); }
function normalizeKeyword(value: string): string { return value.normalize("NFKC").trim().toLocaleLowerCase("pt-BR"); }
function validProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}
function validateTemplate(template: string): boolean {
  const variables = template.match(/{{[^{}]+}}/g) ?? [];
  return variables.every((variable) => approvedVariables.has(variable));
}
async function auth(request: Request, env: Env): Promise<AuthUser | Response> {
  const user = await getSessionUser(env.DB, request);
  return user ?? json({ error: "Não autenticado." }, { status: 401 });
}
function badRequest(message: string): Response { return json({ error: message }, { status: 400 }); }
function notFound(): Response { return json({ error: "Registro não encontrado." }, { status: 404 }); }
function conflict(message: string): Response { return json({ error: message }, { status: 409 }); }

async function posts(request: Request, env: Env, user: AuthUser, idParam?: string): Promise<Response> {
  if (request.method === "GET" && !idParam) {
    const result = await env.DB.prepare(`SELECT p.id, p.instagram_account_id, p.provider_post_id, p.title, p.is_active, p.created_at, p.updated_at, a.username AS instagram_username
      FROM posts p JOIN instagram_accounts a ON a.id = p.instagram_account_id AND a.user_id = ?1
      WHERE p.user_id = ?1 ORDER BY p.created_at DESC`).bind(user.id).all();
    return json({ posts: result.results });
  }
  if (request.method === "POST" && !idParam) {
    if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
    const parsed = postCreate.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return badRequest("Dados da publicação inválidos.");
    const data = parsed.data;
    const account = await env.DB.prepare("SELECT id FROM instagram_accounts WHERE id = ?1 AND user_id = ?2 LIMIT 1").bind(data.instagram_account_id, user.id).first();
    if (!account) return notFound();
    const postId = id();
    try {
      await env.DB.prepare("INSERT INTO posts (id, user_id, instagram_account_id, provider_post_id, title) VALUES (?1, ?2, ?3, ?4, ?5)").bind(postId, user.id, data.instagram_account_id, data.provider_post_id, data.title ?? null).run();
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) return conflict("Essa publicação já está cadastrada para esta conta.");
      throw error;
    }
    await audit(env.DB, user.id, "create", "post", postId);
    return json({ id: postId }, { status: 201 });
  }
  if (!idParam) return json({ error: "Método não permitido." }, { status: 405 });
  const owned = await env.DB.prepare("SELECT id, instagram_account_id, provider_post_id, title, is_active FROM posts WHERE id = ?1 AND user_id = ?2 LIMIT 1").bind(idParam, user.id).first<{id:string;instagram_account_id:string;provider_post_id:string;title:string|null;is_active:number}>();
  if (!owned) return notFound();
  if (request.method === "GET") return json({ post: owned });
  if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM posts WHERE id = ?1 AND user_id = ?2").bind(idParam, user.id).run();
    await audit(env.DB, user.id, "delete", "post", idParam);
    return noContent();
  }
  if (request.method === "PATCH") {
    const parsed = postPatch.safeParse(await request.json().catch(() => null));
    if (!parsed.success || Object.keys(parsed.data).length === 0) return badRequest("Dados da publicação inválidos.");
    const data = parsed.data;
    if (data.instagram_account_id) {
      const account = await env.DB.prepare("SELECT id FROM instagram_accounts WHERE id = ?1 AND user_id = ?2 LIMIT 1").bind(data.instagram_account_id, user.id).first();
      if (!account) return notFound();
    }
    const next = { ...owned, ...data };
    try {
      await env.DB.prepare("UPDATE posts SET instagram_account_id=?1, provider_post_id=?2, title=?3, updated_at=datetime('now') WHERE id=?4 AND user_id=?5")
        .bind(next.instagram_account_id, next.provider_post_id, next.title ?? null, idParam, user.id).run();
    } catch (error) {
      if (String(error).toLowerCase().includes("unique")) return conflict("Essa publicação já está cadastrada para esta conta.");
      throw error;
    }
    await audit(env.DB, user.id, "update", "post", idParam);
    return json({ post: next });
  }
  return json({ error: "Método não permitido." }, { status: 405 });
}

async function products(request: Request, env: Env, user: AuthUser, idParam?: string): Promise<Response> {
  if (request.method === "GET" && !idParam) {
    const result = await env.DB.prepare("SELECT id, name, product_url, is_active, created_at, updated_at FROM products WHERE user_id = ?1 ORDER BY created_at DESC").bind(user.id).all();
    return json({ products: result.results });
  }
  if (request.method === "POST" && !idParam) {
    if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
    const parsed = productCreate.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !validProductUrl(parsed.data.product_url)) return badRequest("Informe uma URL de produto HTTPS válida.");
    const productId = id();
    await env.DB.prepare("INSERT INTO products (id, user_id, name, product_url) VALUES (?1, ?2, ?3, ?4)").bind(productId, user.id, parsed.data.name, new URL(parsed.data.product_url).toString()).run();
    await audit(env.DB, user.id, "create", "product", productId);
    return json({ id: productId }, { status: 201 });
  }
  if (!idParam) return json({ error: "Método não permitido." }, { status: 405 });
  const owned = await env.DB.prepare("SELECT id, name, product_url, is_active FROM products WHERE id = ?1 AND user_id = ?2 LIMIT 1").bind(idParam, user.id).first<{id:string;name:string;product_url:string;is_active:number}>();
  if (!owned) return notFound();
  if (request.method === "GET") return json({ product: owned });
  if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
  if (request.method === "DELETE") {
    try { await env.DB.prepare("DELETE FROM products WHERE id = ?1 AND user_id = ?2").bind(idParam, user.id).run(); }
    catch { return conflict("O produto não pode ser excluído enquanto estiver vinculado a uma automação."); }
    await audit(env.DB, user.id, "delete", "product", idParam);
    return noContent();
  }
  if (request.method === "PATCH") {
    const parsed = productPatch.safeParse(await request.json().catch(() => null));
    if (!parsed.success || Object.keys(parsed.data).length === 0 || (parsed.data.product_url !== undefined && !validProductUrl(parsed.data.product_url))) return badRequest("Dados do produto inválidos. A URL deve usar HTTPS.");
    const next = { ...owned, ...parsed.data };
    await env.DB.prepare("UPDATE products SET name=?1, product_url=?2, updated_at=datetime('now') WHERE id=?3 AND user_id=?4").bind(next.name, next.product_url, idParam, user.id).run();
    await audit(env.DB, user.id, "update", "product", idParam);
    return json({ product: next });
  }
  return json({ error: "Método não permitido." }, { status: 405 });
}

async function automations(request: Request, env: Env, user: AuthUser, idParam?: string): Promise<Response> {
  if (request.method === "GET" && !idParam) {
    const result = await env.DB.prepare(`SELECT r.id, r.post_id, r.product_id, r.keyword, r.keyword_normalized, r.dm_template, r.is_active, r.created_at, r.updated_at,
      p.title AS post_title, p.provider_post_id, pr.name AS product_name
      FROM automation_rules r JOIN posts p ON p.id=r.post_id AND p.user_id=?1 JOIN products pr ON pr.id=r.product_id AND pr.user_id=?1
      WHERE r.user_id=?1 ORDER BY r.created_at DESC`).bind(user.id).all();
    return json({ automations: result.results });
  }
  if (request.method === "POST" && !idParam) {
    if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
    const parsed = automationCreate.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !validateTemplate(parsed.data.dm_template)) return badRequest("Dados da automação inválidos. Use apenas {{nome}} e {{link_produto}}.");
    const data = parsed.data; const normalized = normalizeKeyword(data.keyword);
    const relations = await env.DB.prepare(`SELECT p.id AS post_id, pr.id AS product_id FROM posts p CROSS JOIN products pr WHERE p.id=?1 AND p.user_id=?2 AND pr.id=?3 AND pr.user_id=?2 LIMIT 1`).bind(data.post_id, user.id, data.product_id).first();
    if (!relations) return notFound();
    const ruleId=id();
    try { await env.DB.prepare("INSERT INTO automation_rules (id,user_id,post_id,product_id,keyword,keyword_normalized,dm_template,is_active) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)").bind(ruleId,user.id,data.post_id,data.product_id,data.keyword,normalized,data.dm_template,data.is_active ? 1 : 0).run(); }
    catch(error){ if(String(error).toLowerCase().includes("unique")) return conflict("Já existe uma automação com esta palavra-chave nesta publicação."); throw error; }
    await audit(env.DB,user.id,"create","automation_rule",ruleId); return json({id:ruleId},{status:201});
  }
  if (!idParam) return json({ error:"Método não permitido." },{status:405});
  const owned=await env.DB.prepare("SELECT id,post_id,product_id,keyword,keyword_normalized,dm_template,is_active FROM automation_rules WHERE id=?1 AND user_id=?2 LIMIT 1").bind(idParam,user.id).first<any>();
  if(!owned)return notFound(); if(request.method==="GET")return json({automation:owned});
  if(!isSameOrigin(request))return json({error:"Origem não autorizada."},{status:403});
  if(request.method==="DELETE"){await env.DB.prepare("DELETE FROM automation_rules WHERE id=?1 AND user_id=?2").bind(idParam,user.id).run();await audit(env.DB,user.id,"delete","automation_rule",idParam);return noContent();}
  if(request.method==="PATCH"){
    const parsed=automationPatch.safeParse(await request.json().catch(()=>null)); if(!parsed.success||Object.keys(parsed.data).length===0)return badRequest("Dados da automação inválidos."); const data=parsed.data;
    if(data.dm_template!==undefined&&!validateTemplate(data.dm_template))return badRequest("O texto usa uma variável não permitida.");
    if(data.post_id||data.product_id){const postId=data.post_id??owned.post_id, productId=data.product_id??owned.product_id; const rel=await env.DB.prepare("SELECT p.id FROM posts p JOIN products pr ON pr.id=?1 AND pr.user_id=?2 WHERE p.id=?3 AND p.user_id=?2 LIMIT 1").bind(productId,user.id,postId).first();if(!rel)return notFound();}
    const next={...owned,...data,keyword_normalized:data.keyword?normalizeKeyword(data.keyword):owned.keyword_normalized};
    try{await env.DB.prepare("UPDATE automation_rules SET post_id=?1,product_id=?2,keyword=?3,keyword_normalized=?4,dm_template=?5,is_active=?6,updated_at=datetime('now') WHERE id=?7 AND user_id=?8").bind(next.post_id,next.product_id,next.keyword,next.keyword_normalized,next.dm_template,next.is_active?1:0,idParam,user.id).run();}catch(error){if(String(error).toLowerCase().includes("unique"))return conflict("Já existe uma automação com esta palavra-chave nesta publicação.");throw error;}
    await audit(env.DB,user.id,"update","automation_rule",idParam);return json({automation:next});
  }
  return json({error:"Método não permitido."},{status:405});
}

async function audit(db:D1Database,userId:string,action:string,resourceType:string,resourceId:string){await db.prepare("INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id,outcome) VALUES (?1,?2,?3,?4,?5,'success')").bind(id(),userId,action,resourceType,resourceId).run();}

export async function handleAdminApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const userOrResponse=await auth(request,env); if(userOrResponse instanceof Response)return userOrResponse; const user=userOrResponse;
  const segments=pathname.split("/").filter(Boolean); const idParam=segments.length===3?segments[2]:undefined;
  if(pathname==="/api/posts"||pathname.startsWith("/api/posts/"))return posts(request,env,user,idParam);
  if(pathname==="/api/products"||pathname.startsWith("/api/products/"))return products(request,env,user,idParam);
  if(pathname==="/api/automation-rules"||pathname.startsWith("/api/automation-rules/"))return automations(request,env,user,idParam);
  return json({error:"Rota não encontrada."},{status:404});
}
