import React, { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type User = { id: string; email: string };

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
    event.preventDefault(); setError(""); setLoading(true);
    try {
      await requestJson("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const session = await requestJson<{ user: User }>("/api/auth/me");
      onLogin(session.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao entrar."); }
    finally { setLoading(false); }
  }

  return <main className="app-shell"><section className="card auth-card">
    <span className="eyebrow">Instagram Comment DM</span><h1>Entrar</h1>
    <p>Acesse o painel administrativo com sua conta.</p>
    <form onSubmit={submit}>
      <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
      <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={12} required /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
    </form>
  </section></main>;
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <main className="app-shell"><section className="card">
    <span className="eyebrow">Instagram Comment DM</span><h1>Painel administrativo</h1>
    <p>Você está autenticado como <strong>{user.email}</strong>.</p>
    <div className="status" role="status"><strong>Autenticação:</strong> sessão segura ativa.</div>
    <button onClick={onLogout}>Sair</button>
  </section></main>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { requestJson<{ user: User }>("/api/auth/me").then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setChecking(false)); }, []);
  if (checking) return <main className="app-shell"><section className="card"><p>Verificando sessão…</p></section></main>;
  if (!user) return <Login onLogin={setUser} />;
  return <Dashboard user={user} onLogout={async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); setUser(null); }} />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
