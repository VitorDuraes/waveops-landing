import { NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";
import { notifyDiscord } from "@/server/integrations";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  const { id } = await params;
  const inv = await getRepo().getInvoiceWithCustomer(id);
  if (!inv) return err("Fatura não encontrada", 404);
  // So baixa manual de fatura ABERTA. Bloqueia reabrir paga/reembolsada/cancelada, que
  // reverteria um estorno e reativaria o cliente sem pagamento. [A1 do audit 2026-06-28]
  if (!["criada", "em-aberto", "vencida"].includes(inv.status)) {
    return err("Esta fatura não está aberta para baixa manual", 409);
  }
  await getRepo().markInvoicePaid(id);
  await notifyDiscord(`Fatura ${id} marcada como paga manualmente por ${u.email}.`);
  return ok({ ok: true, invoice: id });
}
