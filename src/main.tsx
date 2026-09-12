import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="app-shell">
      <section className="card">
        <span className="eyebrow">Instagram Comment DM</span>
        <h1>Painel administrativo</h1>
        <p>
          A base da aplicação está pronta. As próximas fases adicionarão
          autenticação, publicações, produtos, automações e integração oficial
          com a Meta.
        </p>
        <div className="status" role="status">
          <strong>Fase 2:</strong> estrutura inicial configurada.
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
