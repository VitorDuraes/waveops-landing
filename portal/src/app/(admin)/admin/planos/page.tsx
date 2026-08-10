"use client";
// 15 . Planos (/admin/planos)
import { Icon } from "@/components/icons";
import { useToast } from "@/components/providers";
import { useApi } from "@/lib/useApi";
import { Loading, LoadError } from "@/components/ui/Loading";
import { plans } from "@/lib/data";
import { fmt } from "@/lib/format";
import type { Customer } from "@/lib/types";

export default function PlanosAdminPage() {
  const toast = useToast();
  const cReq = useApi<Customer[]>("/api/customers");

  if (cReq.loading) return <Loading />;
  if (cReq.error || !cReq.data)
    return <LoadError message={cReq.error || "Não foi possível carregar os planos."} onRetry={cReq.reload} />;

  const customers = cReq.data;
  // Assinantes por plano derivam dos clientes reais (planLabel = nome do plano no
  // checkout). Sem cliente, os contadores ficam em zero, sem numero de exemplo.
  const countFor = (name: string) => customers.filter((c) => c.plan === name).length;
  const totalSubs = plans.reduce((a, p) => a + countFor(p.name), 0);
  // Receita por plano = soma do valor COMBINADO de cada cliente, nao "preco de tabela
  // x quantidade". Com o valor por proposta, multiplicar pela tabela mentiria o MRR.
  const mrrFor = (name: string) =>
    customers.filter((c) => c.plan === name).reduce((s, c) => s + (c.amount || 0), 0);
  const mrrTotal = plans.reduce((a, p) => a + mrrFor(p.name), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Planos</h2>
          <div className="lead">
            {plans.length} planos · {totalSubs} assinante{totalSubs === 1 ? "" : "s"} ativo
            {totalSubs === 1 ? "" : "s"}.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => toast("Novo plano...", "info")}>
          <Icon name="plus" /> Novo plano
        </button>
      </div>

      <div className="grid cols-4">
        {plans.map((p) => {
          const n = countFor(p.name);
          return (
            <div className="card" key={p.id}>
              <div className="flex between">
                <div className="cell-strong" style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>
                  {p.name}
                </div>
                {p.featured && <span className="badge accent">Mais escolhido</span>}
              </div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 6, minHeight: 38 }}>
                {p.desc}
              </div>
              <div className="big-amount" style={{ fontSize: 28, margin: "14px 0 0" }}>
                {p.selfService ? "" : "a partir de "}
                {fmt(p.monthly)}
                <span style={{ fontSize: 14, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>/mês</span>
              </div>
              <div className="cell-sub mono">
                {p.selfService ? `ou ${fmt(p.annual)}/mês no anual` : "referência para montar a proposta"}
              </div>
              <div style={{ marginTop: 12 }}>
                <span className={"badge " + (p.selfService ? "ok" : "info")}>
                  <span className="d" />
                  {p.selfService ? "Assinatura direta" : "Sob proposta"}
                </span>
              </div>
              <div
                className="flex between"
                style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}
              >
                <span className="muted" style={{ fontSize: 13 }}>
                  {n} assinante{n === 1 ? "" : "s"}
                </span>
                <div className="flex gap8">
                  <button className="act" onClick={() => toast("Editar plano...", "info")}>
                    <Icon name="edit" />
                  </button>
                  <span className="badge ok">
                    <span className="d" />
                    Ativo
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="section-title">
          Receita por plano
          <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
            {fmt(mrrTotal)}/mês no total
          </span>
        </div>
        {plans.map((p) => {
          const n = countFor(p.name);
          const receita = mrrFor(p.name);
          // Barra proporcional a RECEITA, nao a contagem: um cliente Empresarial pesa
          // mais que tres do plano de entrada.
          const w = mrrTotal ? Math.round((receita / mrrTotal) * 100) : 0;
          return (
            <div key={p.id}>
              <div className="flex between" style={{ padding: "6px 0" }}>
                <span>
                  {p.name} · {n} cliente{n === 1 ? "" : "s"}
                </span>
                <span className="cell-strong">{fmt(receita)}/mês</span>
              </div>
              <div className="bar" style={{ margin: "6px 0 12px" }}>
                <i style={{ width: w + "%", ...(p.featured ? { background: "var(--accent-strong)" } : {}) }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
