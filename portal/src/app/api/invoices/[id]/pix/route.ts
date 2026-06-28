import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";
import { getGateway } from "@/server/payments";
import { log } from "@/server/log";

// Gera um PIX (QR + copia-e-cola) para pagar UMA fatura. So o dono da fatura.
// O webhook reconcilia pela ref woinv_<id> (gateway.createPixCharge).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard(["customer", "admin"]);
  if (u instanceof NextResponse) return u;
  const { id } = await params;
  const inv = await getRepo().getInvoiceWithCustomer(id);
  if (!inv) return err("Fatura não encontrada", 404);
  // Cliente so paga a propria fatura (evita IDOR). Admin pode qualquer uma.
  if (u.role === "customer" && inv.email.toLowerCase() !== u.email.toLowerCase()) {
    return err("Fatura não encontrada", 404);
  }
  // So cobra fatura aberta: evita gerar segundo PIX de uma fatura ja paga/cancelada.
  if (!["criada", "em-aberto", "vencida"].includes(inv.status)) {
    return err("Esta fatura não está aberta para pagamento", 409);
  }
  try {
    const pix = await getGateway().createPixCharge({
      invoiceId: inv.id,
      amount: inv.amount,
      payer: { name: inv.companyName, email: inv.email, document: inv.document || undefined },
      description: `WaveOps · Fatura ${inv.id}`,
    });
    return ok({ qrCodeBase64: pix.qrCodeBase64, copyPaste: pix.copyPaste });
  } catch (e) {
    log.error("invoice.pix_falhou", { invoiceId: id, erro: (e as Error).message });
    return err("Falha ao gerar o PIX", 502);
  }
}
