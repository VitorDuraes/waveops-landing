import { NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { getRepo } from "@/server/repo";
import { hashPassword, verifyPassword } from "@/server/auth";
import { log } from "@/server/log";

// Define a senha do cliente AUTENTICADO. Dois fluxos:
// 1) ATIVACAO (conta ainda sem senha, pos-pagamento): e-mail -> codigo -> senha. Livre.
// 2) TROCA (conta ja com senha): exige a senha ATUAL. Sem isso, uma sessao sequestrada
//    (cookie roubado ou OTP momentaneo) viraria account takeover persistente. [M4 do audit]
export async function POST(req: Request) {
  const u = await guard(["customer"]);
  if (u instanceof NextResponse) return u;
  const { password, currentPassword } = await req
    .json()
    .catch(() => ({}) as { password?: string; currentPassword?: string });
  if (!password || password.length < 8) {
    return err("A senha precisa ter ao menos 8 caracteres");
  }
  const repo = getRepo();
  // getActivationTarget devolve alvo SO quando a conta nao tem senha (elegivel a ativar).
  const activation = await repo.getActivationTarget(u.sub);
  if (!activation) {
    // Conta ja tem senha: e troca, reautentica com a senha atual.
    const acct = await repo.findCustomerForLogin(u.email);
    if (!acct || !verifyPassword(String(currentPassword || ""), acct.passwordHash)) {
      return err("Senha atual incorreta", 403);
    }
  }
  await repo.setCustomerPassword(u.sub, hashPassword(password));
  log.info("senha.definida", { customerId: u.sub, troca: !activation });
  return ok({ ok: true });
}
