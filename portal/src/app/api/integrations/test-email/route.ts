import { NextResponse } from "next/server";
import { guard, ok, err } from "@/server/http";
import { sendEmail } from "@/server/integrations";
import { env } from "@/server/env";
import { rateLimit } from "@/server/ratelimit";

// Teste REAL de envio (admin). Existe porque "chave configurada" nao e o mesmo que
// "e-mail sai": com o dominio nao verificado no Resend, a chave e valida e todo
// envio e recusado com 403. Este endpoint faz um envio de verdade para o e-mail do
// time e devolve o motivo exato da recusa. [varredura 2026-08-10]
export async function POST() {
  const u = await guard(["admin"]);
  if (u instanceof NextResponse) return u;
  if (!rateLimit("email-test", 5, 60_000)) {
    return err("Muitos testes seguidos. Aguarde um minuto.", 429);
  }
  const to = env.teamNotifyEmail;
  const res = await sendEmail(
    to,
    "Teste de envio do portal WaveOps",
    `<p>Envio de teste disparado pelo painel admin.</p><p>Remetente configurado: ${env.emailFrom}</p>`
  );
  if (res.mock) return ok({ ok: false, to, detail: res.error });
  if (!res.ok) return ok({ ok: false, to, detail: res.error });
  return ok({ ok: true, to, detail: `E-mail de teste enviado para ${to}. Confira a caixa de entrada e o spam.` });
}
