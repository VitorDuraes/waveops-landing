"use client";
// Acoes de escrita do painel admin, ligadas a API real. Cada acao trata erro com
// toast e aceita um onDone() opcional para recarregar a lista/tela depois.
import { useToast } from "@/components/providers";

async function post(url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Falha na ação");
  return data as Record<string, unknown>;
}

export type CustomerAction = "ativo" | "pausado" | "cancelado";

export function useAdminActions() {
  const toast = useToast();
  return {
    markPaid: async (invoiceId: string, onDone?: () => void) => {
      try {
        await post(`/api/invoices/${invoiceId}/mark-as-paid`);
        toast("Fatura marcada como paga");
        onDone?.();
      } catch (e) {
        toast((e as Error).message, "info");
      }
    },
    resendInvoice: async (invoiceId: string) => {
      try {
        await post(`/api/invoices/${invoiceId}/resend-payment-link`);
        toast("Link de cobrança reenviado");
      } catch (e) {
        toast((e as Error).message, "info");
      }
    },
    setStatus: async (customerId: string, status: CustomerAction, onDone?: () => void) => {
      const label = status === "pausado" ? "Cliente pausado" : status === "cancelado" ? "Assinatura cancelada" : "Cliente reativado";
      try {
        await post(`/api/customers/${customerId}/status`, { status });
        toast(label + ", time avisado no Discord", "info");
        onDone?.();
      } catch (e) {
        toast((e as Error).message, "info");
      }
    },
    // Reembolso TOTAL do ultimo pagamento no gateway + cancelamento da assinatura.
    // Envolve dinheiro real e nao tem desfazer: confirma antes de chamar a API.
    refund: async (customerId: string, onDone?: () => void) => {
      const okToGo = window.confirm(
        "Reembolsar o último pagamento deste cliente no Mercado Pago e cancelar a assinatura? Esta ação não pode ser desfeita."
      );
      if (!okToGo) return;
      try {
        const r = await post(`/api/customers/${customerId}/refund`);
        toast(r.alreadyRefunded ? "Este pagamento já estava reembolsado" : "Reembolso emitido e assinatura cancelada", "info");
        onDone?.();
      } catch (e) {
        toast((e as Error).message, "info");
      }
    },
    // Roda a regua de cobranca pelo endpoint admin (followups/send -> runDunning).
    runDunning: async (onDone?: () => void) => {
      try {
        const r = await post(`/api/followups/send`);
        const steps = (r.steps as { sent: number }[]) || [];
        const sent = steps.reduce((s, x) => s + (x.sent || 0), 0);
        const paused = (r.paused as number) || 0;
        toast(`Régua executada · ${sent} mensagem(ns) enviada(s), ${paused} pausa(s)`);
        onDone?.();
      } catch (e) {
        toast((e as Error).message, "info");
      }
    },
    wa: (phone?: string) => {
      const digits = (phone || "").replace(/\D/g, "");
      if (!digits) {
        toast("Cliente sem WhatsApp cadastrado", "info");
        return;
      }
      const num = digits.length <= 11 ? "55" + digits : digits;
      window.open(`https://wa.me/${num}`, "_blank", "noopener");
    },
  };
}
