import "server-only";
import { env } from "./env";
import { getPrisma } from "./db";
import { getRepo } from "./repo";
import { getGateway } from "./payments";
import { onPaymentApplied } from "./onboarding";
import { notifyDiscord, sendEmail } from "./integrations";
import { fireAndForget, upsertEmpresa, createFollowup, createChamado } from "./twenty";
import { log } from "./log";

export interface DunningStep {
  window: string;
  label: string;
  sent: number;
}
export interface DunningResult {
  mode: "mock" | "db";
  steps: DunningStep[];
  paused: number;
}

const WINDOWS = [
  { key: "before_7_days", label: "7 dias antes", offset: -7, statuses: ["em_aberto"] },
  { key: "before_3_days", label: "3 dias antes", offset: -3, statuses: ["em_aberto"] },
  { key: "due_today", label: "no vencimento", offset: 0, statuses: ["em_aberto"] },
  { key: "overdue_1_day", label: "1 dia após", offset: 1, statuses: ["em_aberto", "vencida"] },
  { key: "overdue_3_days", label: "3 dias após", offset: 3, statuses: ["vencida"] },
  { key: "overdue_7_days", label: "7 dias após", offset: 7, statuses: ["vencida"] },
] as const;

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// Job diario da regua de cobranca + pausa por inadimplencia.
// Sem banco, retorna um resumo simulado (modo mock).
export async function runDunning(): Promise<DunningResult> {
  if (!env.hasDb()) {
    return {
      mode: "mock",
      paused: 0,
      steps: WINDOWS.map((w) => ({ window: signed(w.offset), label: w.label, sent: 0 })),
    };
  }

  const db = getPrisma();
  const today = startOfDay(new Date());
  const steps: DunningStep[] = [];

  for (const w of WINDOWS) {
    const due = addDays(today, -w.offset); // dueDate = hoje - offset
    const invoices = await db.invoice.findMany({
      where: {
        dueDate: { gte: due, lt: addDays(due, 1) },
        status: { in: w.statuses as unknown as ("em_aberto" | "vencida")[] },
      },
      include: { customer: true },
    });

    let sent = 0;
    for (const inv of invoices) {
      // evita duplicar o mesmo follow-up para a mesma fatura
      const exists = await db.followup.findFirst({
        where: { invoiceId: inv.id, type: w.key as never },
      });
      if (exists) continue;

      const link = inv.paymentLink || new URL("/cliente/faturas", env.appUrl).toString();
      const msg = `Olá, ${inv.customer.companyName}. Lembrete da sua mensalidade WaveOps (${w.label}). Pague aqui: ${link}`;
      const mail = await sendEmail(inv.customer.email, "WaveOps · lembrete de cobrança", msg);
      // O follow-up so e "enviado" se o e-mail saiu. Gravar "enviado" sem envio real
      // fazia a regua parecer rodada e ninguem ser cobrado. [varredura 2026-08-10]
      const followup = await db.followup.create({
        data: {
          customerId: inv.customerId,
          invoiceId: inv.id,
          type: w.key as never,
          channel: "email",
          message: msg,
          status: mail.ok ? "enviado" : "falhou",
          errorMessage: mail.ok ? null : (mail.error || "Falha no envio do e-mail").slice(0, 200),
          sentAt: mail.ok ? new Date() : null,
        },
      });
      // Espelha o follow-up no Twenty (one-way, nao bloqueante). Garante a Empresa
      // por gatewayCustomerId e cria o registro followup ligado a ela. A relacao
      // followup -> fatura usa o id externo do Twenty; aqui ligamos so a Empresa
      // (a fatura espelhada no Twenty so existe se o checkout ja sincronizou).
      // TODO(wiring fatura): para ligar followup -> fatura no Twenty, resolver o
      // id da fatura espelhada (ex.: filtrar /rest/faturas por gatewayPaymentId)
      // e passar como faturaId em createFollowup.
      fireAndForget(
        "runDunning.followup",
        (async () => {
          const empresaId = await upsertEmpresa({
            companyName: inv.customer.companyName,
            document: inv.customer.document,
            planLabel: inv.customer.planLabel,
            monthlyAmountCents: inv.customer.monthlyAmount,
            paymentMethod: inv.customer.paymentMethod,
            gatewayCustomerId: inv.customer.gatewayCustomerId,
            status: inv.customer.status,
            nextDueDate: inv.customer.nextDueDate,
            lastPaymentDate: inv.customer.lastPaymentDate,
          });
          if (!empresaId) return;
          await createFollowup(
            {
              type: followup.type,
              channel: followup.channel,
              message: followup.message,
              status: followup.status,
              sentAt: followup.sentAt,
              errorMessage: followup.errorMessage,
            },
            empresaId
          );
        })()
      );
      if (w.offset >= 3) {
        await notifyDiscord(`Cobranca em atraso (${w.label}): ${inv.customer.companyName} · fatura ${inv.id}`);
      }
      sent++;
    }
    steps.push({ window: signed(w.offset), label: w.label, sent });
  }

  // pausa: fatura vencida ha mais de 7 dias e cliente ainda ativo
  const limit = addDays(today, -7);
  const toPause = await db.customer.findMany({
    where: { status: "ativo", invoices: { some: { status: "vencida", dueDate: { lt: limit } } } },
  });
  for (const c of toPause) {
    await db.customer.update({ where: { id: c.id }, data: { status: "pausado" } });
    await notifyDiscord(`Cliente pausado por atraso > 7 dias: ${c.companyName}`);
    // Abre um chamado de cobranca no WaveOps CRM (Twenty), substituindo o card do Trello.
    fireAndForget(
      "runDunning.pausa",
      (async () => {
        const empresaId = await upsertEmpresa({
          companyName: c.companyName,
          document: c.document,
          planLabel: c.planLabel,
          monthlyAmountCents: c.monthlyAmount,
          paymentMethod: c.paymentMethod,
          gatewayCustomerId: c.gatewayCustomerId,
          status: "pausado",
        });
        if (!empresaId) return;
        await createChamado(
          {
            title: `Cobrança: ${c.companyName} pausado`,
            description: "Cliente pausado por inadimplência acima de 7 dias.",
            priority: "alta",
            status: "aberto",
          },
          empresaId
        );
      })()
    );
  }

  return { mode: "db", steps, paused: toPause.length };
}

function signed(offset: number): string {
  if (offset === 0) return "0";
  return offset < 0 ? `${offset}d` : `+${offset}d`;
}

export interface ReconcileResult {
  mode: "mock" | "db";
  checked: number;
  applied: number;
}

// Reconciliacao do gateway: rede de seguranca para quando o webhook nao chega
// (banco pausado, app dormindo, 5xx). Busca os pagamentos aprovados recentes no
// gateway e aplica os que faltam. Idempotente: o repo ignora os ja baixados, e o
// onPaymentApplied so reenvia o e-mail/alerta se o cliente ainda nao ativou.
export async function runReconcile(sinceDays = 7): Promise<ReconcileResult> {
  if (!env.hasDb()) return { mode: "mock", checked: 0, applied: 0 };
  const gateway = getGateway();
  if (!gateway.searchRecentApproved) {
    log.info("reconcile.sem_busca", { gateway: gateway.id });
    return { mode: "db", checked: 0, applied: 0 };
  }
  const events = await gateway.searchRecentApproved(sinceDays);
  let applied = 0;
  for (const ev of events) {
    const result = await getRepo().applyGatewayPayment({
      gatewayPaymentId: ev.gatewayPaymentId,
      gatewaySubscriptionId: ev.gatewaySubscriptionId,
      status: ev.status,
      amountCents: ev.amountCents,
    });
    if (result.applied) {
      applied++;
      log.info("reconcile.fatura_baixada", {
        invoiceId: result.invoiceId,
        customerId: result.customerId,
        paymentId: ev.gatewayPaymentId,
        ref: ev.gatewaySubscriptionId,
      });
      await onPaymentApplied(result, "reconcile");
    }
  }
  log.info("reconcile.done", { checked: events.length, applied });
  return { mode: "db", checked: events.length, applied };
}
