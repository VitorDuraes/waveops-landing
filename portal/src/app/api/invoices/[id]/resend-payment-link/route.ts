import { NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";
import { sendEmail } from "@/server/integrations";
import { env } from "@/server/env";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  const { id } = await params;

  const inv = await getRepo().getInvoiceWithCustomer(id);
  if (!inv) return err("Fatura não encontrada", 404);

  const link = inv.paymentLink || new URL("/cliente/faturas", env.appUrl).toString();
  const subject = "WaveOps · link de pagamento da sua fatura";
  const html = `<p>Olá, ${inv.companyName}. Aqui está o link para pagar a fatura ${inv.id}:</p><p><a href="${link}">${link}</a></p>`;
  const mail = await sendEmail(inv.email, subject, html);
  // Sem provedor (ou com envio recusado) a rota nao pode responder "reenviado": o
  // admin marcaria a cobranca como feita sem nada ter saido. [varredura 2026-08-10]
  if (!mail.ok) {
    return err(mail.error || "Não foi possível reenviar a cobrança por e-mail.", 502, { reason: "email_failed" });
  }

  return ok({ ok: true, invoice: id, sentTo: inv.email });
}
