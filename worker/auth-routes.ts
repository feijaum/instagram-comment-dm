import { z } from "zod";
import { createSession, getSessionUser, hashPassword, isLoginRateLimited, isSameOrigin, recordLoginAttempt, revokeSession, verifyPassword } from "./auth";
import type { Env } from "./admin-api";

const MIN_PASSWORD_LENGTH = 6;
const INITIAL_ADMIN_EMAIL = "jvleite7" + "@gmail.com";
const loginSchema = z.object({ login:z.string().trim().min(1).max(254), password:z.string().min(MIN_PASSWORD_LENGTH).max(128) }).strict();
const passwordSchema = z.object({ current_password:z.string().min(MIN_PASSWORD_LENGTH).max(128), new_password:z.string().min(MIN_PASSWORD_LENGTH).max(128) }).strict().refine(v=>v.current_password!==v.new_password,{message:"different"});

function json(data:unknown,init:ResponseInit={}):Response{const headers=new Headers(init.headers);headers.set("content-type","application/json; charset=utf-8");headers.set("cache-control","no-store");headers.set("x-content-type-options","nosniff");headers.set("x-frame-options","DENY");headers.set("referrer-policy","no-referrer");headers.set("permissions-policy","camera=(), microphone=(), geolocation=()");headers.set("content-security-policy","default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");return new Response(JSON.stringify(data),{...init,headers})}
function fail(){return json({error:"Usuário ou senha inválidos."},{status:401})}

export async function login(request:Request,env:Env){
 if(!isSameOrigin(request))return json({error:"Origem não autorizada."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return json({error:"JSON inválido."},{status:400})}
 const parsed=loginSchema.safeParse(body);if(!parsed.success)return json({error:`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`},{status:400});
 const identifier=parsed.data.login.trim();
 const normalizedIdentifier=identifier.toLowerCase();
 if(await isLoginRateLimited(env.DB,normalizedIdentifier))return json({error:"Muitas tentativas. Tente novamente mais tarde."},{status:429});
 if(normalizedIdentifier!=="adm"){await recordLoginAttempt(env.DB,normalizedIdentifier,false);return fail()}
 const user=await env.DB.prepare("SELECT id,email,password_hash,is_active FROM users WHERE email=?1 LIMIT 1").bind(INITIAL_ADMIN_EMAIL).first<{id:string;email:string;password_hash:string;is_active:number}>();
 if(!user||!user.is_active){await recordLoginAttempt(env.DB,normalizedIdentifier,false);return fail()}
 const valid=await verifyPassword(parsed.data.password,user.password_hash);await recordLoginAttempt(env.DB,normalizedIdentifier,valid);if(!valid)return fail();
 await env.DB.prepare("INSERT INTO audit_logs (id,user_id,action,resource_type,outcome) VALUES (?1,?2,'login','session','success')").bind(crypto.randomUUID(),user.id).run();
 return createSession(env.DB,{id:user.id,email:user.email});
}

export async function me(request:Request,env:Env){const user=await getSessionUser(env.DB,request);if(!user)return json({authenticated:false},{status:401});const row=await env.DB.prepare("SELECT must_change_password FROM users WHERE id=?1 LIMIT 1").bind(user.id).first<{must_change_password:number}>();return json({authenticated:true,user:{...user,must_change_password:Number(row?.must_change_password??0)},initial_admin:user.email.toLowerCase()===INITIAL_ADMIN_EMAIL})}

export async function changePassword(request:Request,env:Env){
 if(!isSameOrigin(request))return json({error:"Origem não autorizada."},{status:403});
 const user=await getSessionUser(env.DB,request);if(!user)return json({error:"Não autenticado."},{status:401});
 let body:unknown;try{body=await request.json()}catch{return json({error:"JSON inválido."},{status:400})}
 const parsed=passwordSchema.safeParse(body);if(!parsed.success)return json({error:`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres e ser diferente da senha atual.`},{status:400});
 const row=await env.DB.prepare("SELECT password_hash FROM users WHERE id=?1 AND is_active=1 LIMIT 1").bind(user.id).first<{password_hash:string}>();if(!row)return json({error:"Usuário não encontrado."},{status:404});
 if(!(await verifyPassword(parsed.data.current_password,row.password_hash)))return json({error:"Senha atual inválida."},{status:401});
 const passwordHash=await hashPassword(parsed.data.new_password);await env.DB.prepare("UPDATE users SET password_hash=?1,must_change_password=0,updated_at=datetime('now') WHERE id=?2").bind(passwordHash,user.id).run();
 await env.DB.prepare("INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id,outcome) VALUES (?1,?2,'change_password','user',?2,'success')").bind(crypto.randomUUID(),user.id).run();
 return json({success:true,message:"Senha alterada com sucesso."});
}

export async function logout(request:Request,env:Env){if(!isSameOrigin(request))return json({error:"Origem não autorizada."},{status:403});const user=await getSessionUser(env.DB,request);const headers=await revokeSession(env.DB,request);if(user)await env.DB.prepare("INSERT INTO audit_logs (id,user_id,action,resource_type,outcome) VALUES (?1,?2,'logout','session','success')").bind(crypto.randomUUID(),user.id).run();return new Response(null,{status:204,headers})}

const initialPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(128),
}).strict();

async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function setInitialPassword(request: Request, env: Env) {
  if (!isSameOrigin(request)) return json({ error: "Origem não autorizada." }, { status: 403 });
  if (!env.ADMIN_BOOTSTRAP_TOKEN || env.ADMIN_BOOTSTRAP_TOKEN.length < 32) {
    return json({ error: "Token de primeiro acesso não configurado no Cloudflare." }, { status: 503 });
  }

  const providedToken = request.headers.get("x-admin-bootstrap-token") ?? "";
  if (providedToken.length < 32 || !(await tokenMatches(providedToken, env.ADMIN_BOOTSTRAP_TOKEN))) {
    return json({ error: "Token de primeiro acesso inválido." }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = initialPasswordSchema.safeParse(body);
  if (!parsed.success || parsed.data.email.toLowerCase() !== INITIAL_ADMIN_EMAIL) {
    return json({ error: "Dados do primeiro acesso inválidos." }, { status: 400 });
  }

  const user = await env.DB.prepare(
    "SELECT id,must_change_password FROM users WHERE email=?1 AND is_active=1 LIMIT 1",
  ).bind(INITIAL_ADMIN_EMAIL).first<{ id: string; must_change_password: number }>();

  if (!user) return json({ error: "Administrador inicial não encontrado." }, { status: 404 });
  if (Number(user.must_change_password) !== 1) {
    return json({ error: "A primeira senha já foi cadastrada." }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash=?1,must_change_password=0,updated_at=datetime('now') WHERE id=?2 AND must_change_password=1").bind(passwordHash, user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id=?1").bind(user.id),
    env.DB.prepare("INSERT INTO audit_logs (id,user_id,action,resource_type,resource_id,outcome) VALUES (?1,?2,'set_initial_password','user',?2,'success')").bind(crypto.randomUUID(), user.id),
  ]);

  return json({ success: true, message: "Primeira senha cadastrada com sucesso." });
}
