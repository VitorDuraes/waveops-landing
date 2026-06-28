import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { ok, err } from "@/server/http";
import { env } from "@/server/env";
import { runDunning } from "@/server/jobs";

// Job diario da regua de cobranca. Protegido por CRON_SECRET SO no header
// Authorization: Bearer. Query string sai de proposito: vazava em log de proxy,
// Referer e trace (URL completa vira atributo de span). Comparacao constante. [M3 do audit]
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
  return ok(await runDunning());
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return err("Não autorizado", 401);
  return ok(await runDunning());
}
