import "server-only";
import { NextResponse } from "next/server";
import { readSession, type Role, type SessionUser } from "./auth";
import { env } from "./env";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
// O terceiro argumento (extra) mescla campos no corpo JSON, p.ex. um motivo legivel
// por maquina (reason) para o front diferenciar casos sem depender do texto.
export function err(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// Usuario sintetizado para o modo demo (AUTH_ENFORCED=false), escolhido conforme
// o papel exigido pela rota. Permite que os dashboards busquem dados sem login.
function demoUser(roles: Role[]): SessionUser {
  const adminOnly = roles.length > 0 && roles.every((r) => r === "admin");
  return adminOnly
    ? { sub: "admin", role: "admin", email: env.adminEmail }
    : { sub: "c-001", role: "customer", email: env.demoCustomerEmail };
}

// Guarda de rota: retorna o usuario da sessao OU uma NextResponse de erro.
// Uso: const u = await guard(["admin"]); if (u instanceof NextResponse) return u;
// Com AUTH_ENFORCED=false, sem sessao, devolve um usuario-padrao (demo) em vez de 401.
export async function guard(roles: Role[] = []): Promise<NextResponse | SessionUser> {
  const user = await readSession();
  if (user) {
    if (roles.length && !roles.includes(user.role)) return err("Sem permissão", 403);
    return user;
  }
  if (!env.authEnforced) return demoUser(roles);
  return err("Não autenticado", 401);
}
