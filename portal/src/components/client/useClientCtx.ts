"use client";
// Contexto da area do cliente, agora derivado de dados reais da API.
// Busca /api/me + /api/me/invoices, descobre a fatura em aberto e monta o alerta
// a partir do status real do cliente (sem o antigo toggle de demonstracao).
import { useApi } from "@/lib/useApi";
import type { IconName } from "@/components/icons";
import type { Me, ClientInvoice, Tone, CustomerStatus } from "@/lib/types";

interface AlertInfo {
  tone: Tone;
  icon: IconName;
  t: string;
  s: string;
}

export interface ClientCtx {
  loading: boolean;
  error: string | null;
  reload: () => void;
  me: Me | null;
  statusKey: string;
  nextDue: string;
  open?: ClientInvoice;
  invoices: ClientInvoice[];
  alert: AlertInfo;
}

function buildAlert(status: CustomerStatus, nextDue: string, open?: ClientInvoice): AlertInfo {
  switch (status) {
    case "vencido":
      return {
        tone: "danger",
        icon: "alert",
        t: "Fatura vencida",
        s: "Sua mensalidade está em aberto. Regularize para manter seu plano ativo.",
      };
    case "pausado":
      return {
        tone: "danger",
        icon: "pause",
        t: "Plano pausado",
        s: "Sua assinatura está pausada por atraso acima de 7 dias. Pague a fatura para reativar. Seus dados e acesso continuam aqui.",
      };
    case "pendente":
      return {
        tone: "warn",
        icon: "clock",
        t: "Pagamento pendente",
        s: "Há uma cobrança aguardando pagamento. Quite para seguir com tudo em dia.",
      };
    case "aguardando":
      return {
        tone: "info",
        icon: "clock",
        t: "Aguardando pagamento",
        s: "Estamos aguardando a confirmação do seu primeiro pagamento para liberar tudo.",
      };
    case "cancelado":
      return {
        tone: "neutral",
        icon: "alert",
        t: "Assinatura cancelada",
        s: "Sua assinatura está cancelada. Fale com a gente para reativar quando quiser.",
      };
    default:
      // Cliente ativo com cobranca aberta (ainda dentro do prazo) nao pode ler
      // "pagamento em dia" ao lado de um botao "Pagar agora". A mensagem diz o que
      // existe: a proxima cobranca esta aberta e da para adiantar. [varredura 2026-08-10]
      if (open) {
        return {
          tone: "ok",
          icon: "checkCircle",
          t: "Plano ativo",
          s: `Sua próxima cobrança está aberta e vence em ${open.due}. Pague quando quiser, sem multa por antecipar.`,
        };
      }
      return {
        tone: "ok",
        icon: "checkCircle",
        t: "Tudo em dia",
        s: `Seu plano está ativo e o pagamento em dia. Próxima cobrança em ${nextDue}.`,
      };
  }
}

export function useClientCtx(): ClientCtx {
  const meReq = useApi<Me>("/api/me");
  const invReq = useApi<ClientInvoice[]>("/api/me/invoices");

  const me = meReq.data;
  const invoices = invReq.data ?? [];
  const open = invoices.find((i) => i.status === "em-aberto" || i.status === "vencida");
  const status = (me?.status ?? "ativo") as CustomerStatus;
  const nextDue = me?.nextDue ?? "—";

  return {
    loading: meReq.loading || invReq.loading,
    error: meReq.error || invReq.error,
    reload: () => {
      meReq.reload();
      invReq.reload();
    },
    me,
    statusKey: status,
    nextDue,
    open,
    invoices,
    alert: buildAlert(status, nextDue, open),
  };
}
