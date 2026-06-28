"use client";
// Ativacao pos-pagamento: o cliente e redirecionado para ca apos pagar.
// Fluxo: 1) informa o e-mail -> recebe o codigo; 2) digita o codigo (cria a sessao);
// 3) cria a senha (para os proximos logins). Liberada no middleware (sem sessao ainda).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAside } from "@/components/shell/AuthAside";
import { CodeInput } from "@/components/ui/CodeInput";
import { useToast } from "@/components/providers";

type Step = "email" | "codigo" | "senha";

export default function AtivarPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao enviar o código");
      if (data.devCode) setCode(String(data.devCode).padStart(6, "0").slice(0, 6).split(""));
      setStep("codigo");
      toast(data.devCode ? `Código (demo): ${data.devCode}` : "Código enviado para seu e-mail", "info");
    } catch (err) {
      toast((err as Error).message, "info");
    } finally {
      setLoading(false);
    }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.join("") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Código inválido");
      setStep("senha");
      toast("Código confirmado. Agora crie sua senha.");
    } catch (err) {
      toast((err as Error).message, "info");
    } finally {
      setLoading(false);
    }
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) {
      toast("A senha precisa ter ao menos 8 caracteres.", "info");
      return;
    }
    if (password !== confirm) {
      toast("As senhas não conferem.", "info");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar a senha");
      toast("Conta ativada! Bem-vindo.");
      router.push("/cliente");
    } catch (err) {
      toast((err as Error).message, "info");
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <AuthAside
        pitchH="Falta só ativar."
        pitchP="Pagamento confirmado. Confirme seu e-mail com um código e crie sua senha de acesso."
        points={[
          "Acompanhe seu plano e faturas",
          "Pague em segundos por PIX, cartão ou boleto",
          "Fale com o suporte direto pelo portal",
        ]}
      />
      <div className="auth-main">
        <div className="auth-card reveal-y">
          <h1>Ativar conta</h1>
          <p className="sub">
            {step === "email" && "Informe o e-mail usado na compra para receber um código."}
            {step === "codigo" && "Digite o código que enviamos para o seu e-mail."}
            {step === "senha" && "Crie a senha que você vai usar para entrar."}
          </p>

          {step === "email" && (
            <form onSubmit={onEmail}>
              <div className="field">
                <label>E-mail</label>
                <input
                  type="email"
                  placeholder="o e-mail da compra"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} disabled={loading}>
                {loading ? "Enviando..." : "Receber código por e-mail"}
              </button>
            </form>
          )}

          {step === "codigo" && (
            <>
              <form onSubmit={onCode}>
                <div className="field">
                  <label>Código enviado por e-mail</label>
                  <CodeInput value={code} onChange={setCode} autoFocus disabled={loading} />
                </div>
                <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} disabled={loading}>
                  {loading ? "Confirmando..." : "Confirmar código"}
                </button>
              </form>
              <button
                type="button"
                className="btn btn-quiet btn-sm btn-block"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setStep("email");
                  setCode(["", "", "", "", "", ""]);
                }}
              >
                Usar outro e-mail
              </button>
            </>
          )}

          {step === "senha" && (
            <form onSubmit={onPassword}>
              <div className="field">
                <label>Nova senha</label>
                <input
                  type="password"
                  placeholder="Mínimo de 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="field">
                <label>Confirmar senha</label>
                <input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} disabled={loading}>
                {loading ? "Ativando..." : "Criar senha e entrar"}
              </button>
            </form>
          )}

          <div className="auth-alt" style={{ marginTop: 14 }}>
            Já tem senha? <Link href="/cliente/login">Entrar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
