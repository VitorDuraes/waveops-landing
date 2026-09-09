import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";
import { notifyDiscord } from "@/server/integrations";

export async function GET() {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  return ok(await getRepo().listCustomers());
}

export async function POST(req: NextRequest) {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  const body = await req.json().catch(() => ({}) as Record<string, string>);
  if (!body.name || !body.email) return err("Nome e e-mail são obrigatórios");
  // Valor mensal combinado. Aceita "1.997", "1997,50" e "1997". Ausente ou zerado,
  // o repo cai no valor de referencia do plano.
  let amount: number | undefined;
  if (body.amount != null && String(body.amount).trim() !== "") {
    const parsed = Number(String(body.amount).replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return err("Informe um valor mensal válido");
    if (parsed > 1_000_000) return err("Valor mensal fora da faixa aceita");
    amount = parsed;
  }
  const customer = await getRepo().createCustomer({
    name: body.name,
    company: body.company || body.name,
    email: body.email,
    phone: body.phone,
    planId: body.planId || "operacao",
    amount,
  });
  await notifyDiscord(`Novo cliente criado: ${customer.company} (${customer.email})`);
  return ok(customer, 201);
}
