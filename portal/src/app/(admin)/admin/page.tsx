"use client";
// 10 . Dashboard admin (/admin)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Metric } from "@/components/ui/Metric";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RowActions } from "@/components/admin/RowActions";
import { Loading, LoadError } from "@/components/ui/Loading";
import { Stagger, StaggerItem } from "@/components/motion";
import { useApi } from "@/lib/useApi";
import { useAdminActions } from "@/components/admin/useAdminActions";
import type { Customer, Metrics } from "@/lib/types";
import { fmt, initials } from "@/lib/format";

export default function AdminDashboard() {
  const router = useRouter();
  const { runDunning } = useAdminActions();
  const cReq = useApi<Customer[]>("/api/customers");
  const mReq = useApi<Metrics>("/api/metrics");
  const reloadAll = () => {
    cReq.reload();
    mReq.reload();
  };

  if (cReq.loading || mReq.loading) return <Loading />;
  if (cReq.error || mReq.error || !cReq.data || !mReq.data)
    return (
      <LoadError
        message={cReq.error || mReq.error || "Não foi possível carregar o painel."}
        onRetry={() => {
          cReq.reload();
          mReq.reload();
        }}
      />
    );

  const customers = cReq.data;
  const M = mReq.data;
  const overdue = customers.filter((c) => c.status === "vencido" || c.status === "pendente");
  // Contadores das acoes rapidas derivam dos clientes reais (nada fixo na tela).
  const vencidos = customers.filter((c) => c.status === "vencido").length;
  const pendentes = customers.filter((c) => c.status === "pendente" || c.status === "aguardando").length;
  const pausados = customers.filter((c) => c.status === "pausado").length;
  const ticketMedio = M.active ? Math.round(M.mrr / M.active) : 0;
  const previsto = M.receivedMonth + M.expected;
  const pct = previsto > 0 ? Math.round((M.receivedMonth / previsto) * 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Visão geral</h2>
          <div className="lead">Junho 2026 · receita recorrente e cobrança em tempo real.</div>
        </div>
        <div className="flex gap8">
          <button className="btn btn-ghost" onClick={() => runDunning(reloadAll)}>
            <Icon name="bell" /> Rodar follow-ups
          </button>
          <Link className="btn btn-primary" href="/admin/clientes">
            <Icon name="plus" /> Novo cliente
          </Link>
        </div>
      </div>

      <Stagger className="grid cols-4">
        <StaggerItem>
          <Metric icon="money" label="MRR atual" value={fmt(M.mrr)} />
        </StaggerItem>
        <StaggerItem>
          <Metric icon="users" label="Clientes ativos" value={M.active} />
        </StaggerItem>
        <StaggerItem>
          <Metric
            icon="alert"
            label="Em atraso"
            value={M.overdue}
            delta={M.overdue > 0 ? "precisa de follow-up" : undefined}
            tone="down"
          />
        </StaggerItem>
        <StaggerItem>
          <Metric icon="pause" label="Pausados" value={M.paused} />
        </StaggerItem>
      </Stagger>

      <div className="grid cols-3" style={{ marginTop: 22 }}>
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="section-title">Recebimento do mês</div>
          <div className="flex between" style={{ alignItems: "flex-end", marginBottom: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>
                Recebido
              </div>
              <div className="big-amount" style={{ fontSize: 30, color: "var(--ok)" }}>
                {fmt(M.receivedMonth)}
              </div>
            </div>
            <div className="right">
              <div className="muted" style={{ fontSize: 13 }}>
                A receber
              </div>
              <div className="big-amount" style={{ fontSize: 22 }}>
                {fmt(M.expected)}
              </div>
            </div>
          </div>
          <div className="bar">
            <i style={{ width: pct + "%" }} />
          </div>
          <div className="flex between" style={{ marginTop: 8 }}>
            <span className="hint">{pct}% da receita prevista já entrou</span>
            <span className="hint">Previsto: {fmt(M.receivedMonth + M.expected)}</span>
          </div>
          <div className="grid cols-3" style={{ marginTop: 20 }}>
            <div className="dl" style={{ gridTemplateColumns: "1fr" }}>
              <div className="di">
                <div className="dt">Churn do mês</div>
                <div className="dd" style={{ color: "var(--danger)" }}>
                  {M.churn} cliente
                </div>
              </div>
            </div>
            <div className="dl" style={{ gridTemplateColumns: "1fr" }}>
              <div className="di">
                <div className="dt">Faturas em aberto</div>
                <div className="dd">{M.openInvoices}</div>
              </div>
            </div>
            <div className="dl" style={{ gridTemplateColumns: "1fr" }}>
              <div className="di">
                <div className="dt">Ticket médio</div>
                <div className="dd">{fmt(ticketMedio)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="section-title">Ações rápidas</div>
          <div className="lrow" style={{ paddingTop: 0 }}>
            <div className="ic" style={{ color: "var(--danger)" }}>
              <Icon name="alert" />
            </div>
            <div className="gr">
              <div className="t">
                {vencidos} cliente{vencidos === 1 ? "" : "s"} vencido{vencidos === 1 ? "" : "s"}
              </div>
              <div className="s">Aguardando pagamento</div>
            </div>
            <Link className="act" href="/admin/faturas">
              <Icon name="chevronRight" />
            </Link>
          </div>
          <div className="lrow">
            <div className="ic" style={{ color: "var(--warn)" }}>
              <Icon name="clock" />
            </div>
            <div className="gr">
              <div className="t">
                {pendentes} pagamento{pendentes === 1 ? "" : "s"} pendente{pendentes === 1 ? "" : "s"}
              </div>
              <div className="s">Follow-up agendado</div>
            </div>
            <Link className="act" href="/admin/followups">
              <Icon name="chevronRight" />
            </Link>
          </div>
          <div className="lrow">
            <div className="ic" style={{ color: "var(--paused)" }}>
              <Icon name="pause" />
            </div>
            <div className="gr">
              <div className="t">
                {pausados} cliente{pausados === 1 ? "" : "s"} pausado{pausados === 1 ? "" : "s"}
              </div>
              <div className="s">Atraso acima de 7 dias</div>
            </div>
            <Link className="act" href="/admin/clientes">
              <Icon name="chevronRight" />
            </Link>
          </div>
        </div>
      </div>

      <div className="card flush" style={{ marginTop: 22 }}>
        <div className="section-title" style={{ padding: "18px 18px 14px", margin: 0 }}>
          Precisam de atenção{" "}
          <Link className="btn btn-quiet btn-sm" href="/admin/faturas">
            Ver faturas <Icon name="chevronRight" />
          </Link>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((c) => (
                <tr key={c.id} onClick={() => router.push(`/admin/clientes/${c.id}`)}>
                  <td>
                    <div className="cell-user">
                      <span className="avatar-sm">{initials(c.name)}</span>
                      <div>
                        <div className="cell-strong">{c.name}</div>
                        <div className="cell-sub">{c.company}</div>
                      </div>
                    </div>
                  </td>
                  <td>{c.plan}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="cell-strong">{c.nextDue}</td>
                  <td>{fmt(c.amount)}</td>
                  <td>
                    <RowActions id={c.id} phone={c.phone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
