import { NextRequest, NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";

export async function GET() {
  const u = await guard(["customer", "admin"]);
  if (u instanceof NextResponse) return u;
  const me = await getRepo().getMe(u.email);
  if (!me) return err("Conta não encontrada", 404);
  return ok(me);
}

// Troca a forma de pagamento preferida do cliente (acao na tela /cliente/pagamento).
export async function PATCH(req: NextRequest) {
  const u = await guard(["customer"]);
  if (u instanceof NextResponse) return u;
  const body = await req.json().catch(() => ({}) as { method?: string });
  // A UI manda "card"; o banco usa "cartao". Normaliza e valida.
  const map: Record<string, "pix" | "cartao" | "boleto"> = {
    pix: "pix",
    card: "cartao",
    cartao: "cartao",
    boleto: "boleto",
  };
  const method = map[String(body.method || "").toLowerCase()];
  if (!method) return err("Forma de pagamento inválida");
  const me = await getRepo().getMe(u.email);
  if (!me) return err("Conta não encontrada", 404);
  await getRepo().setPaymentMethod(me.id, method);
  return ok({ ok: true, method });
}
