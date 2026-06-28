"use client";
// 06 . Faturas do cliente (/cliente/faturas)
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useModal } from "@/components/providers";
import { useClientCtx } from "@/components/client/useClientCtx";
import { PayModalContent } from "@/components/client/PayModalContent";
import { Loading, LoadError } from "@/components/ui/Loading";
import { fmt } from "@/lib/format";
import type { ClientInvoice } from "@/lib/types";

export default function FaturasClientePage() {
  const c = useClientCtx();
  const { openModal, closeModal } = useModal();

  if (c.loading) return <Loading />;
  if (c.error) return <LoadError message={c.error} onRetry={c.reload} />;

  function pay(inv: ClientInvoice) {
    openModal(<PayModalContent inv={inv} onClose={closeModal} />);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Faturas</h2>
          <div className="lead">Histórico completo de cobranças da sua conta.</div>
        </div>
      </div>
      <div className="card flush">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Fatura</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Forma</th>
                <th>Pago em</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {c.invoices.map((inv) => {
                const payable = inv.status === "em-aberto" || inv.status === "vencida";
                return (
                  <tr key={inv.id} onClick={payable ? () => pay(inv) : undefined}>
                    <td className="cell-mono">{inv.id}</td>
                    <td className="cell-strong">{inv.due}</td>
                    <td>{fmt(inv.amount)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td>{inv.method}</td>
                    <td className="muted">{inv.paidAt || "—"}</td>
                    <td>
                      <div className="row-actions">
                        {payable ? (
                          <button
                            className="act"
                            title="Pagar"
                            onClick={(e) => {
                              e.stopPropagation();
                              pay(inv);
                            }}
                          >
                            <Icon name="money" />
                          </button>
                        ) : (
                          <button className="act" title="Comprovante" onClick={(e) => e.stopPropagation()}>
                            <Icon name="download" />
                          </button>
                        )}
                        <button className="act" title="Copiar link" onClick={(e) => e.stopPropagation()}>
                          <Icon name="copy" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
