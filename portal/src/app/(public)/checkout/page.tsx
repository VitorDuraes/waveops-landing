"use client";
// 02 . Checkout (/checkout)
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { PublicNav } from "@/components/shell/PublicNav";
import { useToast } from "@/components/providers";
import { plans } from "@/lib/data";
import { whatsappUrl } from "@/lib/contact";
import { fmt, fmtFull } from "@/lib/format";

type Method = "pix" | "card" | "boleto";

function CheckoutInner() {
  const toast = useToast();
  const params = useSearchParams();
  const chosen = params.get("plano") || "operacao";
  const plan = plans.find((p) => p.id === chosen) || plans[0];
  // Plano sob proposta acessado direto pela URL: a página não pode cobrar um preço de
  // tabela por ele. Mostra o caminho da proposta em vez do formulário de pagamento.
  const sobProposta = !plan.selfService;

  const [method, setMethod] = useState<Method>("pix");
  // LGPD: consentimento e ato do titular. Caixa pre-marcada nao serve como aceite,
  // entao o padrao e desmarcado. [varredura 2026-08-10]
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!terms) {
      toast("Aceite os termos para continuar", "info");
      return;
    }
    if (loading) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          name: fd.get("name"),
          company: fd.get("company"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          document: fd.get("document"),
          method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar o pagamento");
      toast("Assinatura criada! Redirecionando...");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      toast((err as Error).message, "info");
      setLoading(false);
    }
  }

  const methods: { m: Method; icon: "pix" | "card" | "barcode"; label: string }[] = [
    { m: "pix", icon: "pix", label: "PIX" },
    { m: "card", icon: "card", label: "Cartão" },
    { m: "boleto", icon: "barcode", label: "Boleto" },
  ];

  return (
    <>
      <PublicNav />
      <div className="pub-wrap" style={{ maxWidth: 1000 }}>
        <Link className="btn btn-quiet btn-sm" href="/#pacotes" style={{ marginBottom: 18 }}>
          <Icon name="chevronLeft" /> Voltar ao site
        </Link>
        {sobProposta ? (
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontSize: 30, marginBottom: 6 }}>Plano {plan.name}</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              Este plano é fechado por proposta. Escopo, volume e valor saem de um diagnóstico rápido da sua
              operação, então não faz sentido cobrar um preço de tabela antes de conversar.
            </p>
            <div className="card">
              <div className="section-title">O que está incluso</div>
              <ul className="feature-list">
                {plan.benefits.map((b, i) => (
                  <li key={i}>
                    <Icon name="checkCircle" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: 22 }}
                href={whatsappUrl(`Olá! Quero uma proposta do plano ${plan.name} da WaveOps.`)}
                target="_blank"
                rel="noopener"
              >
                <Icon name="whatsapp" /> Pedir proposta no WhatsApp
              </a>
              <p className="hint center" style={{ marginTop: 12 }}>
                Prefere ver como a gente cobra antes?{" "}
                <Link href="/#pacotes" style={{ color: "var(--accent-strong)" }}>
                  Construir e manter
                </Link>
                .
              </p>
            </div>
          </div>
        ) : (
          <>
        <h1 style={{ fontSize: 30, marginBottom: 6 }}>Finalizar assinatura</h1>
        <p className="muted" style={{ marginBottom: 28 }}>
          Preencha seus dados para iniciar o pagamento.
        </p>
        <div className="checkout">
          <form className="card" onSubmit={onSubmit} noValidate>
            <div className="section-title">Seus dados</div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="co-nome-completo">Nome completo</label>
                <input id="co-nome-completo" name="name" placeholder="Seu nome" required />
              </div>
              <div className="field">
                <label htmlFor="co-empresa">Empresa</label>
                <input id="co-empresa" name="company" placeholder="Nome da empresa" required />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="co-e-mail">E-mail</label>
                <input id="co-e-mail" name="email" type="email" placeholder="voce@empresa.com.br" required />
              </div>
              <div className="field">
                <label htmlFor="co-whatsapp">WhatsApp</label>
                <input id="co-whatsapp" name="phone" placeholder="(00) 00000-0000" required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="co-cpf-cnpj">CPF / CNPJ</label>
              <input id="co-cpf-cnpj" name="document" placeholder="000.000.000-00" required />
            </div>

            <div className="section-title" style={{ marginTop: 24 }}>
              Forma de pagamento
            </div>
            <div className="pay-methods">
              {methods.map((o) => (
                <div
                  key={o.m}
                  className={"pay-opt" + (method === o.m ? " active" : "")}
                  onClick={() => setMethod(o.m)}
                >
                  <Icon name={o.icon} />
                  <div className="pl">{o.label}</div>
                </div>
              ))}
            </div>

            <label
              className="flex gap8"
              style={{ marginTop: 22, fontSize: 13.5, color: "var(--text-2)", cursor: "pointer" }}
            >
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ width: "auto" }} />{" "}
              <span>
                Li e aceito os{" "}
                <Link href="/termos" target="_blank" style={{ color: "var(--accent-strong)" }}>
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" target="_blank" style={{ color: "var(--accent-strong)" }}>
                  Política de Privacidade
                </Link>{" "}
                da WaveOps.
              </span>
            </label>
            <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 20 }} disabled={loading}>
              {loading ? "Processando..." : "Ir para o pagamento"} <Icon name="arrowRight" />
            </button>
            <p className="hint center" style={{ marginTop: 12 }}>
              Pagamento processado com segurança pelo gateway. A WaveOps não armazena dados do cartão.
            </p>
          </form>

          <div className="card summary">
            <div className="section-title">Resumo</div>
            <div className="flex between" style={{ marginBottom: 14 }}>
              <div>
                <div className="cell-strong">Plano {plan.name}</div>
                <div className="cell-sub">Cobrança mensal recorrente</div>
              </div>
              <span className="badge accent">Plano</span>
            </div>
            <div className="sum-line">
              <span className="muted">Mensalidade</span>
              <span>{fmtFull(plan.monthly)}</span>
            </div>
            <div className="sum-line">
              <span className="muted">Primeira cobrança</span>
              <span>Hoje</span>
            </div>
            <div className="sum-line">
              <span className="muted">Renovação</span>
              <span>Todo mês</span>
            </div>
            <div className="sum-line total">
              <span>Total hoje</span>
              <span>{fmtFull(plan.monthly)}</span>
            </div>
            <div className="alert ok" style={{ marginTop: 18 }}>
              <Icon name="checkCircle" />
              <div className="body">
                <div className="at" style={{ fontSize: 13.5 }}>
                  Acesso imediato
                </div>
                <div className="as">Assim que o pagamento for confirmado, sua área do cliente é liberada.</div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="pub-wrap">Carregando...</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
