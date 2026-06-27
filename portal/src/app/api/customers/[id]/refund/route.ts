import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";
import { getGateway } from "@/server/payments";
import { notifyDiscord } from "@/server/integrations";
import { log } from "@/server/log";

// Reembolso pelo painel admin: estorna o ultimo pagamento do cliente no gateway e
// cancela a assinatura. Total (MVP). Reembolso parcial e feito no painel do gateway.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  const { id } = await params;

  const repo = getRepo();
  const customer = await repo.getCustomerById(id);
  if (!customer) return err("Cliente não encontrado", 404);

  const payment = await repo.getRefundablePayment(id);
  if (!payment) return err("Nenhum pagamento reembolsável para este cliente.", 422);

  const gateway = getGateway();
  if (!gateway.refundPayment) {
    return err("O gateway atual não suporta reembolso automático. Faça pelo painel do gateway.", 422);
  }

  const r = await gateway.refundPayment(payment.gatewayPaymentId);
  if (!r.ok) return err("Falha ao reembolsar no gateway: " + (r.detail || "erro desconhecido"), 502);

  // A partir daqui o dinheiro JÁ foi estornado no Mercado Pago. Se a baixa no banco
  // falhar, não pode estourar 500 genérico: o estado ficaria inconsistente (estornado
  // no gateway, fatura ainda "paga") e a reconciliação não recupera reembolsos. Avisa
  // o time e devolve mensagem clara para tratamento manual.
  let applied;
  try {
    applied = await repo.applyGatewayRefund({ gatewayPaymentId: payment.gatewayPaymentId });
  } catch (e) {
    log.error("admin.reembolso.baixa_falhou", {
      customerId: id,
      invoiceId: payment.invoiceId,
      paymentId: payment.gatewayPaymentId,
      erro: (e as Error).message,
    });
    await notifyDiscord(
      `ATENÇÃO: reembolso emitido no Mercado Pago para ${customer.company} (fatura ${payment.invoiceId}), ` +
        `mas a baixa no sistema FALHOU. Verifique a fatura manualmente.`
    );
    return err(
      `Reembolso emitido no Mercado Pago, mas a baixa no sistema falhou. Verifique a fatura ${payment.invoiceId} manualmente.`,
      502
    );
  }

  log.info("admin.reembolso", {
    customerId: id,
    invoiceId: applied.invoiceId || payment.invoiceId,
    paymentId: payment.gatewayPaymentId,
    aplicado: applied.applied,
    jaReembolsada: applied.alreadyRefunded || false,
    por: u.email,
  });
  // alreadyRefunded: o webhook (ou outra chamada) já tinha estornado esta fatura. Não
  // reafirma cancelamento nesta resposta, para o toast do admin não enganar.
  if (applied.alreadyRefunded) {
    return ok({ ok: true, alreadyRefunded: true, invoiceId: applied.invoiceId, customerId: id });
  }
  await notifyDiscord(
    `Reembolso emitido para ${customer.company} por ${u.email} · fatura ${applied.invoiceId || payment.invoiceId} estornada e assinatura cancelada.`
  );
  return ok({ ok: true, invoiceId: applied.invoiceId || payment.invoiceId, customerId: id });
}
