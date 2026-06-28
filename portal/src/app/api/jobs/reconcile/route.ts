import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { ok, err } from "@/server/http";
import { env } from "@/server/env";
import { runReconcile } from "@/server/jobs";

// Reconciliacao do gateway: rede de seguranca quando o webhook nao chega (banco
// pausado, app dormindo, 5xx). Busca pagamentos aprovados recentes e aplica os que
// faltam. Idempotente. Protegido por CRON_SECRET SO no header Authorization: Bearer
// (query string sai: vazava em log/Referer/trace). Comparacao constante. [M3 do audit]
function authorized(req: NextRequest): boolean {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const expected = env.cronSecret;
  if (!bearer || !expected) return false;
  const a = Buffer.from(bearer);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return err("Não autorizado", 401);
  return ok(await runReconcile());
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return err("Não autorizado", 401);
  return ok(await runReconcile());
}
