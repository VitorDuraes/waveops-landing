"use client";
// 09 . Login admin (/admin/login) - e-mail corporativo + senha, via API real
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAside } from "@/components/shell/AuthAside";
import { useToast } from "@/components/providers";

export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  // Campos vazios. Estavam pre-preenchidos com o e-mail do time e com a senha padrao
  // de desenvolvimento, que ia junto no bundle JS entregue ao navegador de qualquer
  // visitante de /admin/login. [varredura 2026-08-10]
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Credenciais inválidas");
      toast("Acesso liberado");
      router.push("/admin");
    } catch (err) {
      toast((err as Error).message, "info");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <AuthAside
        pitchH="Painel de operações WaveOps"
        pitchP="Acompanhe receita recorrente, clientes, cobranças e a régua de follow-up, tudo num só lugar."
        points={[
          "MRR, inadimplência e churn em tempo real",
          "Reenvie cobranças e pause clientes",
          "Acompanhe os follow-ups automáticos",
        ]}
      />
      <div className="auth-main">
        <div className="auth-card reveal-y">
          <span className="badge accent" style={{ marginBottom: 14 }}>
            Acesso interno
          </span>
          <h1>Painel Admin</h1>
          <p className="sub">Acesso restrito à equipe WaveOps.</p>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="adm-e-mail-corporativo">E-mail corporativo</label>
              <input id="adm-e-mail-corporativo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@waveops.com.br" />
            </div>
            <div className="field">
              <label htmlFor="adm-senha">Senha</label>
              <input id="adm-senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading ? "Aguarde..." : "Entrar no painel"}
            </button>
          </form>
          <div className="auth-alt" style={{ marginTop: 18 }}>
            Não é da equipe? <Link href="/cliente/login">Área do cliente</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
