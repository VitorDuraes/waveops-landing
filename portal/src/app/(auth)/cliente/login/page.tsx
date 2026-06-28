"use client";
// 03 . Login do cliente (/cliente/login). Dois modos: senha (e-mail OU CPF/CNPJ) e
// codigo por e-mail (OTP). Ambos via API real.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAside } from "@/components/shell/AuthAside";
import { CodeInput } from "@/components/ui/CodeInput";
import { useToast } from "@/components/providers";

type Mode = "senha" | "codigo";

export default function ClienteLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("senha");
  const [loading, setLoading] = useState(false);

  // modo senha
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // modo codigo (OTP)
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  // E-mail com codigo valido mas sem assinatura: mostra CTA em vez de erro generico.
  const [noCustomer, setNoCustomer] = useState(false);

  function backToEmail() {
    setStep(1);
    setCode(["", "", "", "", "", ""]);
    setNoCustomer(false);
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no login");
      toast("Bem-vindo de volta!");
      router.push("/cliente");
    } catch (err) {
      toast((err as Error).message, "info");
      setLoading(false);
    }
  }

  async function onOtp(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (step === 1) {
        setNoCustomer(false);
        const res = await fetch("/api/auth/request-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao enviar o código");
        if (data.devCode) setCode(String(data.devCode).padStart(6, "0").slice(0, 6).split(""));
        setStep(2);
        toast(data.devCode ? `Código (demo): ${data.devCode}` : "Código enviado para seu e-mail", "info");
      } else {
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: code.join("") }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Codigo valido mas e-mail sem assinatura: mostra o CTA, nao o erro generico.
          if (data.reason === "no_customer") {
            setNoCustomer(true);
            return;
          }
          throw new Error(data.error || "Código inválido");
        }
        toast("Bem-vindo de volta!");
        router.push("/cliente");
      }
    } catch (err) {
      toast((err as Error).message, "info");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <AuthAside
        pitchH="Sua operação, no controle."
        pitchP="Acompanhe seu plano, faturas e pagamentos num só lugar. Sem burocracia, sem planilha."
        points={[
          "Veja seu plano e próximo vencimento",
          "Pague em segundos por PIX, cartão ou boleto",
          "Fale com o suporte direto pelo portal",
        ]}
      />
      <div className="auth-main">
        <div className="auth-card reveal-y">
          <h1>Entrar</h1>
          <p className="sub">Acesse a área do cliente WaveOps.</p>

          {mode === "senha" ? (
            <>
              <form onSubmit={onPassword}>
                <div className="field">
                  <label>E-mail ou CPF/CNPJ</label>
                  <input
                    placeholder="voce@empresa.com.br ou seu documento"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label>Senha</label>
                  <input
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} disabled={loading}>
                  {loading ? "Aguarde..." : "Entrar"}
                </button>
              </form>
              <button
                type="button"
                className="btn btn-quiet btn-sm btn-block"
                style={{ marginTop: 10 }}
                onClick={() => setMode("codigo")}
              >
                Entrar com código por e-mail
              </button>
            </>
          ) : (
            <>
              <form onSubmit={onOtp}>
                <div className="field">
                  <label>E-mail</label>
                  <input
                    type="email"
                    placeholder="voce@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={step === 2}
                  />
                </div>
                {step === 2 && (
                  <div className="field">
                    <label>Código enviado por e-mail</label>
                    <CodeInput value={code} onChange={setCode} autoFocus disabled={loading} />
                  </div>
                )}
                <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} disabled={loading}>
                  {loading ? "Aguarde..." : step === 1 ? "Receber código por e-mail" : "Entrar"}
                </button>
              </form>
              {noCustomer && (
                <div className="auth-alt" style={{ marginTop: 12 }}>
                  Não encontramos uma assinatura ativa para este e-mail.{" "}
                  <Link href="/#pacotes">Ver planos</Link> ou <Link href="/cliente/ativar">Ativar conta</Link>.
                </div>
              )}
              {step === 2 && (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm btn-block"
                  style={{ marginTop: 10 }}
                  onClick={backToEmail}
                >
                  Usar outro e-mail
                </button>
              )}
              <button
                type="button"
                className="btn btn-quiet btn-sm btn-block"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setMode("senha");
                  backToEmail();
                }}
              >
                Entrar com senha
              </button>
            </>
          )}

          <div className="auth-alt" style={{ marginTop: 14 }}>
            Ainda não é cliente? <Link href="/#pacotes">Ver planos</Link>
          </div>
          <div className="auth-alt" style={{ marginTop: 8 }}>
            É da equipe WaveOps? <Link href="/admin/login">Acessar painel admin</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
