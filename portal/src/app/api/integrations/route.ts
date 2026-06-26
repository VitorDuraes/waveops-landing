import { NextResponse } from "next/server";
import { guard, ok } from "@/server/http";
import { env } from "@/server/env";

// Status REAL das integracoes (admin). Reporta so SE cada uma esta configurada
// (booleano derivado do env), nunca o valor do segredo. Sem "Conectado" fixo.
export async function GET() {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  const items = [
    {
      key: "money",
      name: "Mercado Pago",
      desc: "Gateway de pagamento: checkout, cobranças e webhooks",
      connected: env.paymentGateway === "mercadopago" && !!env.mercadopago.accessToken,
    },
    {
      key: "mail",
      name: "Resend",
      desc: "E-mails transacionais e login por código",
      connected: !!env.resendKey,
    },
    {
      key: "discord",
      name: "Discord",
      desc: "Alertas internos de pagamento e inadimplência",
      connected: !!env.discordWebhook,
    },
    {
      key: "users",
      name: "WaveOps CRM (Twenty)",
      desc: "Empresas, contatos, pipeline (oportunidades) e chamados",
      connected: !!env.twenty.token,
    },
  ];
  return ok(items);
}
