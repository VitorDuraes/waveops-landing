import { NextRequest } from "next/server";
import { issueOtp } from "@/server/auth";
import { sendEmail } from "@/server/integrations";
import { env } from "@/server/env";
import { ok, err } from "@/server/http";
import { rateLimit, clientIp } from "@/server/ratelimit";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}) as { email?: string });
  if (!email) return err("Informe o e-mail");
  // Anti email-bombing: 3 codigos por e-mail/min e 10 por IP/min.
  const ip = clientIp(req.headers);
  if (!rateLimit(`otp-req:${email.toLowerCase()}`, 3, 60_000) || !rateLimit(`otp-req-ip:${ip}`, 10, 60_000)) {
    return err("Muitas solicitações. Aguarde um minuto e tente novamente.", 429);
  }
  const code = await issueOtp(email);
  const html =
    `<p>Seu código de acesso ao portal WaveOps é:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px;font-family:monospace">${code}</p>` +
    `<p>O código expira em 10 minutos. Se não foi você que pediu, ignore este e-mail.</p>`;
  const mail = await sendEmail(email, "Seu código de acesso WaveOps", html);
  // Fora de producao, devolve o codigo para o teste seguir mesmo sem provedor.
  const devCode = env.isProd ? undefined : code;
  // O envio falhou de verdade (dominio nao verificado, chave invalida, rede). Responder
  // "enviado" aqui deixava o cliente esperando um e-mail que nunca sai. Em dev ainda
  // devolvemos o devCode para nao travar o teste, mas o status diz a verdade.
  if (!mail.ok) {
    if (devCode) return ok({ sent: false, devCode, warning: mail.error });
    return err(
      "Não conseguimos enviar o código agora. Fale com o suporte pelo WhatsApp para liberar seu acesso.",
      502,
      { reason: "email_failed" }
    );
  }
  return ok({ sent: true, devCode });
}
