"use client";
// 13 . Faturas admin (/admin/faturas)
import { useState } from "react";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAdminActions } from "@/components/admin/useAdminActions";
import { useApi } from "@/lib/useApi";
import { Loading, LoadError } from "@/components/ui/Loading";
import type { AdminInvoice } from "@/lib/types";
import { fmt, initials } from "@/lib/format";

const FILTERS: [string, string][] = [
  ["todas", "Todas"],
  ["em-aberto", "Em aberto"],
  ["vencida", "Vencidas"],
  ["paga", "Pagas"],
  ["cancelada", "Canceladas"],
];

export default function FaturasAdminPage() {
  const { resendInvoice, wa, markPaid } = useAdminActions();
  const [filter, setFilter] = useState("todas");
  // scope=admin: no modo demo (sem login) a rota nao tem papel para consultar e
  // devolveria as faturas do cliente, quebrando esta tela.
  const req = useApi<AdminInvoice[]>("/api/invoices?scope=admin");

  if (req.loading) return <Loading />;
  if (req.error || !req.data)
    return <LoadError message={req.error || "Não foi possível carregar as faturas."} onRetry={req.reload} />;

  const invoicesAll = req.data;

  const list = filter === "todas" ? invoicesAll : invoicesAll.filter((i) => i.status === filter);
  const totalOpen = invoicesAll
    .filter((i) => i.status === "em-aberto" || i.status === "vencida")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Faturas</h2>
          <div className="lead">
            {invoicesAll.length} faturas · {fmt(totalOpen)} em aberto
          </div>
        </div>
      </div>
      <div className="toolbar">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={"chip-filter " + (k === filter ? "active" : "")} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="card flush">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fatura</th>
                <th>Cliente</th>
                <th>Plano</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Forma</th>
                <th>Último follow-up</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map((i) => (
                  <tr key={i.id}>
                    <td className="cell-mono">{i.id}</td>
                    <td>
                      <div className="cell-user">
                        <span className="avatar-sm">{initials(i.customer)}</span>
                        <div>
                          <div className="cell-strong">{i.customer}</div>
                          <div className="cell-sub">{i.company}</div>
                        </div>
                      </div>
                    </td>
                    <td>{i.plan}</td>
                    <td>{fmt(i.amount)}</td>
                    <td className="cell-strong">{i.due}</td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                    <td>{i.method}</td>
                    <td className="cell-sub">{i.lastFollowup}</td>
                    <td>
                      <div className="row-actions">
                        <button className="act" title="Reenviar cobrança" onClick={() => resendInvoice(i.id)}>
                          <Icon name="refresh" />
                        </button>
                        <button className="act" title="Marcar como paga" onClick={() => markPaid(i.id, req.reload)}>
                          <Icon name="check" />
                        </button>
                        <button className="act" title="WhatsApp" onClick={() => wa()}>
                          <Icon name="whatsapp" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <div className="card">
                      <EmptyState icon="invoice" title="Nenhuma fatura" desc="Sem faturas com esse filtro." />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
