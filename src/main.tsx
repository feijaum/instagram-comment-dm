import React, { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type User = { id: string; email: string };
type Post = { id: string; instagram_account_id: string; provider_post_id: string; title: string | null; is_active: number; instagram_username?: string };
type Product = { id: string; name: string; product_url: string; is_active: number };
type Automation = { id: string; post_id: string; product_id: string; keyword: string; dm_template: string; is_active: number; post_title?: string | null; product_name?: string };

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: "same-origin", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a operação.");
  return data as T;
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestJson("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const session = await requestJson<{ user: User }>("/api/auth/me");
      onLogin(session.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao entrar.");
    } finally { setLoading(false); }
  }

  return <main className="app-shell"><section className="card auth-card">
    <span className="eyebrow">Instagram Comment DM</span><h1>Entrar</h1><p>Acesse o painel administrativo com sua conta.</p>
    <form onSubmit={submit}>
      <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
      <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={6} required /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
    </form>
  </section></main>;
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [section, setSection] = useState("dashboard");
  const [posts, setPosts] = useState<Post[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => { try { const [postData, productData, automationData] = await Promise.all([requestJson<{ posts: Post[] }>("/api/posts"), requestJson<{ products: Product[] }>("/api/products"), requestJson<{ automations: Automation[] }>("/api/automation-rules")]); setPosts(postData.posts); setProducts(productData.products); setAutomations(automationData.automations); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados."); } };
  useEffect(() => { void load(); }, []);
  async function remove(path: string, label: string) { if (!confirm(`Excluir ${label}?`)) return; try { await requestJson(path, { method: "DELETE" }); setMessage("Registro excluído."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir."); } }
  async function toggle(automation: Automation) { try { await requestJson(`/api/automation-rules/${automation.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_active: !Boolean(automation.is_active) }) }); setMessage(automation.is_active ? "Automação desativada." : "Automação ativada."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar a automação."); } }
  const labels: Record<string, string> = { dashboard: "Visão geral", posts: "Publicações", products: "Produtos", automations: "Automações", history: "Histórico", security: "Segurança", settings: "Configurações" };
  return <div className="admin-layout"><aside className="sidebar"><div><span className="eyebrow">Instagram Comment DM</span><h2>Painel</h2></div><nav>{Object.entries(labels).map(([key, label]) => <button className={section === key ? "nav-active" : ""} onClick={() => setSection(key)} key={key}>{label}</button>)}</nav><div className="sidebar-foot"><small>{user.email}</small><button onClick={onLogout}>Sair</button></div></aside><main className="content"><header><div><span className="eyebrow">Administração</span><h1>{labels[section]}</h1></div><span className="pill">Sessão segura</span></header>{message && <div className="status" role="status">{message}</div>}{error && <div className="error" role="alert">{error}</div>}{section === "dashboard" && <><div className="grid"><div className="stat"><strong>{posts.length}</strong><span>Publicações</span></div><div className="stat"><strong>{products.length}</strong><span>Produtos</span></div><div className="stat"><strong>{automations.filter((item) => item.is_active).length}</strong><span>Automações ativas</span></div></div><section className="card"><h2>Próximos passos</h2><p>Cadastre publicações, produtos e regras. A integração oficial com o Instagram será adicionada em uma fase posterior.</p></section></>}{section === "posts" && <Posts posts={posts} reload={load} remove={remove} />}{section === "products" && <Products products={products} reload={load} remove={remove} />}{section === "automations" && <Automations items={automations} posts={posts} products={products} reload={load} toggle={toggle} remove={remove} />}{section === "history" && <section className="card"><h2>Histórico</h2><p>O histórico operacional será conectado aos logs na próxima etapa de observabilidade.</p></section>}{section === "security" && <section className="card"><h2>Segurança</h2><p>Autenticação por sessão HttpOnly, autorização por proprietário e validação de entrada estão ativas.</p></section>}{section === "settings" && <section className="card"><h2>Configurações</h2><p>Integrações e configurações avançadas serão habilitadas nas próximas fases.</p></section>}</main></div>;
}

function Posts({ posts, reload, remove }: { posts: Post[]; reload: () => Promise<void>; remove: (path: string, label: string) => Promise<void> }) { const [account, setAccount] = useState(""); const [provider, setProvider] = useState(""); const [title, setTitle] = useState(""); const [error, setError] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); setError(""); try { await requestJson("/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instagram_account_id: account, provider_post_id: provider, title: title || null }) }); setAccount(""); setProvider(""); setTitle(""); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar."); } } return <><section className="card"><h2>Nova publicação</h2><p className="muted">Cadastro manual temporário até a conexão oficial com a Meta.</p><form className="form-grid" onSubmit={submit}><label>ID da conta Instagram<input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="UUID da conta cadastrada" required /></label><label>ID da publicação no Instagram<input value={provider} onChange={(e) => setProvider(e.target.value)} required /></label><label>Título<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></label><button type="submit">Cadastrar publicação</button></form>{error && <div className="error">{error}</div>}</section><section className="card"><h2>Publicações cadastradas</h2>{posts.length === 0 ? <p className="muted">Nenhuma publicação cadastrada.</p> : <div className="list">{posts.map((post) => <article className="list-item" key={post.id}><div><strong>{post.title || "Sem título"}</strong><small>ID: {post.provider_post_id} · Conta: {post.instagram_username || post.instagram_account_id}</small></div><button className="danger" onClick={() => remove(`/api/posts/${post.id}`, "a publicação")}>Excluir</button></article>)}</div>}</section></>; }

function Products({ products, reload, remove }: { products: Product[]; reload: () => Promise<void>; remove: (path: string, label: string) => Promise<void> }) { const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [error, setError] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); setError(""); try { await requestJson("/api/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, product_url: url }) }); setName(""); setUrl(""); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar."); } } return <><section className="card"><h2>Novo produto</h2><form className="form-grid" onSubmit={submit}><label>Nome<input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} required /></label><label>URL do produto<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required /></label><button type="submit">Cadastrar produto</button></form>{error && <div className="error">{error}</div>}</section><section className="card"><h2>Produtos cadastrados</h2>{products.length === 0 ? <p className="muted">Nenhum produto cadastrado.</p> : <div className="list">{products.map((product) => <article className="list-item" key={product.id}><div><strong>{product.name}</strong><small>{product.product_url}</small></div><button className="danger" onClick={() => remove(`/api/products/${product.id}`, "o produto")}>Excluir</button></article>)}</div>}</section></>; }

function Automations({ items, posts, products, reload, toggle, remove }: { items: Automation[]; posts: Post[]; products: Product[]; reload: () => Promise<void>; toggle: (automation: Automation) => Promise<void>; remove: (path: string, label: string) => Promise<void> }) { const [post, setPost] = useState(""); const [product, setProduct] = useState(""); const [keyword, setKeyword] = useState(""); const [template, setTemplate] = useState("Olá, {{nome}}! Aqui está o produto que você pediu: {{link_produto}}"); const [error, setError] = useState(""); async function submit(event: FormEvent) { event.preventDefault(); setError(""); try { await requestJson("/api/automation-rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post_id: post, product_id: product, keyword, dm_template: template, is_active: false }) }); setKeyword(""); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar."); } } return <><section className="card"><h2>Nova automação</h2><p className="muted">Variáveis permitidas: <code>{"{{nome}}"}</code> e <code>{"{{link_produto}}"}</code>.</p><form className="form-grid" onSubmit={submit}><label>Publicação<select value={post} onChange={(e) => setPost(e.target.value)} required><option value="">Selecione uma publicação</option>{posts.map((item) => <option key={item.id} value={item.id}>{item.title || item.provider_post_id}</option>)}</select></label><label>Produto<select value={product} onChange={(e) => setProduct(e.target.value)} required><option value="">Selecione um produto</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Palavra-chave<input value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={80} placeholder="Ex.: quero" required /></label><label>Mensagem da DM<textarea value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={2000} required /></label><button type="submit">Cadastrar automação</button></form>{error && <div className="error">{error}</div>}</section><section className="card"><h2>Automações cadastradas</h2>{items.length === 0 ? <p className="muted">Nenhuma automação cadastrada.</p> : <div className="list">{items.map((item) => <article className="list-item" key={item.id}><div><strong>{item.keyword}</strong><small>{item.post_title || item.post_id} · {item.product_name || item.product_id}</small></div><div className="actions"><button onClick={() => toggle(item)}>{item.is_active ? "Desativar" : "Ativar"}</button><button className="danger" onClick={() => remove(`/api/automation-rules/${item.id}`, "a automação")}>Excluir</button></div></article>)}</div>}</section></>; }

function App() { const [user, setUser] = useState<User | null>(null); const [checking, setChecking] = useState(true); useEffect(() => { requestJson<{ user: User }>("/api/auth/me").then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setChecking(false)); }, []); if (checking) return <main className="app-shell"><section className="card"><p>Verificando sessão…</p></section></main>; if (!user) return <Login onLogin={setUser} />; return <Dashboard user={user} onLogout={async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); setUser(null); }} />; }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
