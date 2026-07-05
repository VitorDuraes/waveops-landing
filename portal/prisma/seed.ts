/* Seed do banco a partir dos dados mock (src/lib/data.ts).
   Rodar: npx prisma db seed  (precisa de DATABASE_URL e tsx).

   As datas sao ancoradas no momento do seed (relativas a "hoje"), para que
   metricas por mes, status vencido/pausado e "vence em X dias" fiquem coerentes
   independentemente de quando o seed roda. O cliente c-001 (Joao) recebe um
   historico completo de faturas (5 pagas + 1 em aberto). */
import { PrismaClient } from "@prisma/client";
import { plans, customers, followups, tickets, me } from "../src/lib/data";

const db = new PrismaClient();

const reais = (n: number) => Math.round(n * 100);

// --- ancoragem temporal (UTC, para casar com a formatacao das telas) ---
const now = new Date();
const Y = now.getUTCFullYear();
const Mo = now.getUTCMonth();
const D = now.getUTCDate();
const clampDay = (d: number) => Math.min(28, Math.max(1, d));
// dia do mes atual + offset de meses
const monthDay = (offset: number, day: number) => new Date(Date.UTC(Y, Mo + offset, clampDay(day)));
// um dia garantidamente dentro do mes atual
const dayThisMonth = (day: number) => monthDay(0, day);

type InvStatus = "em_aberto" | "paga" | "vencida" | "cancelada";
interface InvSpec {
  due: Date;
  paidAt: Date | null;
  status: InvStatus;
}

const method = (m: string): "pix" | "cartao" | "boleto" | null =>
  m === "PIX" ? "pix" : m === "Cartão" ? "cartao" : m === "Boleto" ? "boleto" : null;
const channel = (c: string): "whatsapp" | "email" | "discord" =>
  c === "WhatsApp" ? "whatsapp" : c === "Discord" ? "discord" : "email";

// Datas de exibicao do cliente (proximo vencimento + ultimo pagamento) por status.
function customerDates(id: string, status: string): { nextDue: Date | null; lastPay: Date | null } {
  if (id === "c-001") return { nextDue: monthDay(1, 20), lastPay: monthDay(0, Math.min(D, 20)) };
  switch (status) {
    case "ativo":
      return { nextDue: monthDay(1, 20), lastPay: monthDay(0, Math.min(D, 20)) };
    case "pendente":
      return { nextDue: dayThisMonth(D + 4), lastPay: monthDay(-1, 20) };
    case "vencido":
      return { nextDue: dayThisMonth(D - 6), lastPay: monthDay(-1, 20) };
    case "pausado":
      return { nextDue: monthDay(-1, 12), lastPay: monthDay(-2, 20) };
    case "cancelado":
      return { nextDue: null, lastPay: monthDay(-3, 20) };
    default:
      return { nextDue: null, lastPay: null };
  }
}

// Plano de faturas por cliente, coerente com o status.
function invoicePlan(id: string, status: string): InvSpec[] {
  if (id === "c-001") {
    // historico do cliente demo: 5 pagas (meses -4..0) + 1 em aberto (mes +1)
    const paid: InvSpec[] = [4, 3, 2, 1, 0].map((off) => {
      const due = off === 0 ? monthDay(0, Math.min(D, 20)) : monthDay(-off, 20);
      return { due, paidAt: due, status: "paga" as const };
    });
    return [...paid, { due: monthDay(1, 20), paidAt: null, status: "em_aberto" }];
  }
  switch (status) {
    case "ativo": {
      const m0 = monthDay(0, Math.min(D, 20));
      return [
        { due: monthDay(-1, 20), paidAt: monthDay(-1, 20), status: "paga" },
        { due: m0, paidAt: m0, status: "paga" },
      ];
    }
    case "pendente":
      return [
        { due: monthDay(-1, 20), paidAt: monthDay(-1, 20), status: "paga" },
        { due: dayThisMonth(D + 4), paidAt: null, status: "em_aberto" },
      ];
    case "vencido":
      return [
        { due: monthDay(-1, 20), paidAt: monthDay(-1, 20), status: "paga" },
        { due: dayThisMonth(D - 6), paidAt: null, status: "vencida" },
      ];
    case "pausado":
      return [
        { due: monthDay(-2, 20), paidAt: monthDay(-2, 20), status: "paga" },
        { due: monthDay(-1, 12), paidAt: null, status: "vencida" },
      ];
    case "cancelado":
      return [
        { due: monthDay(-3, 20), paidAt: monthDay(-3, 20), status: "paga" },
        { due: monthDay(-2, 20), paidAt: null, status: "cancelada" },
      ];
    default:
      return [];
  }
}

async function main() {
  // Trava anti-prod: este seed cria clientes ficticios (demonstracao/dev). Rodar
  // contra o banco de producao recontamina o admin com dados falsos. So roda em
  // host local; para forcar de proposito (nunca em producao), use SEED_FORCE=1.
  const host = (process.env.DATABASE_URL?.match(/@([^:/?]+)/)?.[1] || "").toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "db", "postgres"]);
  if (!localHosts.has(host) && process.env.SEED_FORCE !== "1") {
    throw new Error(
      `Seed abortado: DATABASE_URL aponta para "${host || "?"}", que nao e um banco local. ` +
        "Este seed cria dados ficticios e nao deve rodar em producao. Para forcar, use SEED_FORCE=1."
    );
  }

  // planos
  for (const p of plans) {
    await db.plan.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        name: p.name,
        description: p.desc,
        price: reais(p.monthly),
        billingCycle: "mensal",
        isActive: true,
      },
    });
  }

  // usuario admin
  await db.user.upsert({
    where: { email: "financeiro@waveops.com.br" },
    update: {},
    create: { name: "Equipe WaveOps", email: "financeiro@waveops.com.br", role: "admin" },
  });

  // clientes (datas relativas a hoje, coerentes com o status)
  for (const c of customers) {
    const { nextDue, lastPay } = customerDates(c.id, c.status);
    const data = {
      name: c.name,
      companyName: c.company,
      email: c.email,
      phone: c.phone,
      document: c.id === me.id ? me.document : null,
      status: c.status,
      planLabel: c.plan,
      monthlyAmount: reais(c.amount),
      nextDueDate: nextDue,
      lastPaymentDate: lastPay,
      paymentMethod: method(c.method),
    };
    await db.customer.upsert({ where: { id: c.id }, update: data, create: { id: c.id, ...data } });
  }

  // faturas: recriadas do zero a cada seed (sem invoiceId em followups, seguro apagar)
  await db.followup.deleteMany();
  await db.invoice.deleteMany();

  let seq = 1001;
  for (const c of customers) {
    for (const spec of invoicePlan(c.id, c.status)) {
      await db.invoice.create({
        data: {
          id: `FAT-${seq++}`,
          customerId: c.id,
          amount: reais(c.amount),
          dueDate: spec.due,
          paidAt: spec.paidAt,
          status: spec.status,
          paymentMethod: method(c.method),
        },
      });
    }
  }

  // follow-ups (ligados por nome do cliente)
  for (const f of followups) {
    const cust = customers.find((c) => c.name === f.customer);
    if (!cust) continue;
    await db.followup.create({
      data: {
        customerId: cust.id,
        invoiceId: null,
        type: f.type,
        channel: channel(f.channel),
        status: f.status,
        message: f.label,
        errorMessage: f.status === "falhou" ? f.result : null,
        sentAt: new Date(),
      },
    });
  }

  await db.supportTicket.deleteMany();
  for (const t of tickets) {
    await db.supportTicket.create({
      data: {
        customerId: me.id,
        title: t.title,
        description: t.type,
        priority: t.priority === "Alta" ? "alta" : t.priority === "Baixa" ? "baixa" : "media",
        status: t.status === "resolvido" ? "resolvido" : "aberto",
      },
    });
  }

  console.log("Seed concluido.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
