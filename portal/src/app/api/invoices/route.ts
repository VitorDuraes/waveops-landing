import { NextRequest, NextResponse } from "next/server";
import { guard, ok } from "@/server/http";
import { getRepo } from "@/server/repo";

// A forma da resposta depende do papel: admin recebe AdminInvoice (com cliente),
// cliente recebe ClientInvoice. O `?scope=admin` so importa no modo demo
// (AUTH_ENFORCED=false, sem sessao), onde nao ha papel para consultar e a rota
// devolvia dado de cliente para a tela do admin, quebrando a pagina. Com sessao,
// quem manda e sempre o papel da sessao. [varredura 2026-08-10]
export async function GET(req: NextRequest) {
  const u = await guard(["customer", "admin"], req.nextUrl.searchParams.get("scope") === "admin" ? "admin" : undefined);
  if (u instanceof NextResponse) return u;
  const repo = getRepo();
  if (u.role === "admin") return ok(await repo.listAllInvoices());
  const me = await repo.getMe(u.email);
  return ok(me ? await repo.listInvoicesForCustomer(me.id) : []);
}
