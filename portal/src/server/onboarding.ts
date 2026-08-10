import "server-only";
import { getRepo } from "./repo";
import { notifyDiscord, sendEmail, notifyTeamNewCustomer } from "./integrations";
import { env } from "./env";
import { log } from "./log";

export interface AppliedPayment {
  applied: boolean;
  invoiceId?: string;
  customerId?: string;
}

// Efeitos colaterais de um pagamento aplicado: aviso no Discord, e-mail de ativacao
// (so no 1o pagamento, quando o cliente ainda nao tem senha) e alerta do time para o
// onboarding manual por WhatsApp. Chamado pelo WEBHOOK e pelo job de RECONCILIACAO,
// por isso e idempotente: getActivationTarget devolve null depois que a senha existe,
// entao reprocessar o mesmo pagamento nao reenvia e-mail nem realerta o time.
export async function onPaymentApplied(result: AppliedPayment, source: "webhook" | "reconcile"): Promise<void> {
  if (!(result.applied && result.invoiceId)) return;
  await notifyDiscord(`Pagamento confirmado (${source}) · fatura ${result.invoiceId} quitada e cliente reativado.`);
  if (!result.customerId) return;

  const target = await getRepo().getActivationTarget(result.customerId);
  if (!target) return; // ja ativou (tem senha): nada a fazer

  // Fluxo: cliente acessa a ativacao, informa o e-mail, recebe o codigo e cria a senha.
  const link = new URL("/cliente/ativar", env.appUrl).toString();
  const mail = await sendEmail(
    target.email,
    "Pagamento confirmado · ative sua conta WaveOps",
    `<p>Recebemos seu pagamento.</p><p>Crie sua senha de acesso em: <a href="${link}">${link}</a></p>`
  );
  // O e-mail de ativacao e o unico caminho automatico do cliente entrar. Quando ele
  // falha, o time precisa ver no log e no Discord para acionar o cliente na mao.
  if (mail.ok) {
    log.info("ativacao.email_enviado", { customerId: result.customerId, email: target.email, source });
  } else {
    log.error("ativacao.email_falhou", { customerId: result.customerId, email: target.email, erro: mail.error });
    await notifyDiscord(`Falha ao enviar o e-mail de ativação de um cliente novo. Acione manualmente. Motivo: ${mail.error}`);
  }

  const cust = await getRepo().getCustomerById(result.customerId);
  if (cust) {
    await notifyTeamNewCustomer({
      name: cust.name,
      company: cust.company,
      plan: cust.plan,
      amountReais: cust.amount,
      phone: cust.phone,
      email: cust.email,
    });
    log.info("onboarding.time_notificado", { customerId: result.customerId, source });
  }
}
