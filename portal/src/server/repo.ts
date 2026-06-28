import "server-only";
import { env } from "./env";
import { getPrisma } from "./db";
import { log } from "./log";
import { INVOICE_REF_PREFIX } from "./payments";
import {
  fireAndForget,
  upsertEmpresa,
  upsertPessoa,
  createChamado,
  createBriefing,
  createAssinatura,
  createFatura,
  createOportunidade,
  updateEmpresaStatus,
  type EmpresaInput,
} from "./twenty";
import {
  plans as mockPlans,
  me as mockMe,
  customers as mockCustomers,
  invoicesForClient,
  invoicesAll as mockInvoicesAll,
  followups as mockFollowups,
  tickets as mockTickets,
  metrics as mockMetrics,
} from "@/lib/data";
import type {
  Plan,
  Me,
  Customer,
  ClientInvoice,
  AdminInvoice,
  Followup,
  Ticket,
  Metrics,
  CustomerStatus,
  InvoiceStatus,
  ProjectBrief,
} from "@/lib/types";

export interface NewCustomerInput {
  name: string;
  company: string;
  email: string;
  phone?: string;
  planId: string;
}
export interface NewTicketInput {
  customerId: string;
  title: string;
  type: string;
  priority: string;
  description?: string;
}
export interface CheckoutRecordInput {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  document?: string;
  planId: string;
  method: "pix" | "cartao" | "boleto";
  provider: string;
  gatewayCustomerId?: string;
  gatewaySubscriptionId?: string;
}
export interface GatewayPaymentInput {
  gatewayPaymentId?: string;
  gatewaySubscriptionId?: string;
  status: string;
  amountCents?: number; // valor pago (centavos) para conferir contra a fatura
}
export interface PaymentApplyResult {
  applied: boolean;
  invoiceId?: string;
  customerId?: string;
}
export interface GatewayRefundInput {
  gatewayPaymentId?: string;
  gatewaySubscriptionId?: string;
}
export interface RefundApplyResult {
  applied: boolean;
  invoiceId?: string;
  customerId?: string;
  alreadyRefunded?: boolean;
}
// Pagamento elegivel a reembolso: ultima fatura paga do cliente com id no gateway.
export interface RefundablePayment {
  gatewayPaymentId: string;
  invoiceId: string;
  amountCents: number;
}
export interface InvoiceContact {
  id: string;
  amount: number;
  email: string;
  companyName: string;
  paymentLink: string | null;
  // Documento do cliente (CPF/CNPJ), exigido pelo MP no boleto. null quando ausente.
  document: string | null;
  // Status atual da fatura: a rota so cobra fatura aberta (evita pagar 2x).
  status: InvoiceStatus;
}
export interface BriefInput {
  goal: string;
  currentTool?: string;
  pain?: string;
  volume?: string;
}

export interface Repo {
  listPlans(): Promise<Plan[]>;
  getCustomerByEmail(email: string): Promise<Customer | null>;
  getCustomerById(id: string): Promise<Customer | null>;
  listCustomers(): Promise<Customer[]>;
  getMe(email: string): Promise<Me | null>;
  listInvoicesForCustomer(customerId: string): Promise<ClientInvoice[]>;
  listAllInvoices(): Promise<AdminInvoice[]>;
  listFollowups(): Promise<Followup[]>;
  listFollowupsForCustomer(customerId: string): Promise<Followup[]>;
  listTickets(customerId?: string): Promise<Ticket[]>;
  getMetrics(): Promise<Metrics>;
  createCustomer(input: NewCustomerInput): Promise<Customer>;
  markInvoicePaid(id: string): Promise<void>;
  createTicket(input: NewTicketInput): Promise<Ticket>;
  recordCheckout(input: CheckoutRecordInput): Promise<void>;
  applyGatewayPayment(event: GatewayPaymentInput): Promise<PaymentApplyResult>;
  // Reembolso/chargeback: estorna a fatura e cancela a assinatura e o cliente.
  // Idempotente (fatura ja estornada -> no-op).
  applyGatewayRefund(event: GatewayRefundInput): Promise<RefundApplyResult>;
  // Ultima fatura paga do cliente com pagamento no gateway (alvo do reembolso).
  getRefundablePayment(customerId: string): Promise<RefundablePayment | null>;
  setCustomerStatus(id: string, status: CustomerStatus): Promise<void>;
  // Troca a forma de pagamento preferida do cliente (acao do proprio cliente).
  setPaymentMethod(id: string, method: "pix" | "cartao" | "boleto"): Promise<void>;
  getInvoiceWithCustomer(id: string): Promise<InvoiceContact | null>;
  // Login por e-mail OU documento (CPF/CNPJ) + senha.
  findCustomerForLogin(identifier: string): Promise<{ id: string; email: string; passwordHash: string | null } | null>;
  setCustomerPassword(id: string, passwordHash: string): Promise<void>;
  // Alvo de ativacao: e-mail do cliente se ele ainda NAO tem senha (null se ja ativou).
  getActivationTarget(id: string): Promise<{ email: string } | null>;
  // Briefing do projeto (um por cliente). saveBrief faz upsert (novo envio sobrescreve).
  getBriefForCustomer(customerId: string): Promise<ProjectBrief | null>;
  saveBrief(customerId: string, input: BriefInput): Promise<ProjectBrief>;
}

// Planos sao configuracao estatica (mudam raramente); servidos igual nos dois modos.
function listPlansStatic(): Plan[] {
  return mockPlans;
}

// Normaliza documento (so digitos) para casar CPF/CNPJ digitado vs armazenado.
const normalizeDoc = (s: string) => s.replace(/\D/g, "");
// Armazenamento de senha em memoria para o modo mock (a persistencia real e no Prisma).
const mockPasswords = new Map<string, string>();
// Briefings em memoria para o modo mock (a persistencia real e no Prisma).
const mockBriefs = new Map<string, ProjectBrief>();
// Forma de pagamento trocada pelo cliente, em memoria (persistencia real no Prisma).
const mockPaymentMethods = new Map<string, "pix" | "cartao" | "boleto">();

/* ------------------------------------------------------------------ */
/* Repositorio mock (padrao, em memoria a partir de src/lib/data)      */
/* ------------------------------------------------------------------ */
const mockRepo: Repo = {
  async listPlans() {
    return listPlansStatic();
  },
  async getCustomerByEmail(email) {
    if (email.toLowerCase() === mockMe.email.toLowerCase()) {
      return mockCustomers.find((c) => c.id === mockMe.id) || null;
    }
    return mockCustomers.find((c) => c.email.toLowerCase() === email.toLowerCase()) || null;
  },
  async getCustomerById(id) {
    return mockCustomers.find((c) => c.id === id) || null;
  },
  async listCustomers() {
    return mockCustomers;
  },
  async getMe(email) {
    let me: Me | null;
    if (email.toLowerCase() === mockMe.email.toLowerCase()) {
      me = mockMe;
    } else {
      const c = mockCustomers.find((x) => x.email.toLowerCase() === email.toLowerCase());
      me = c
        ? {
            ...mockMe,
            id: c.id,
            name: c.name,
            firstName: c.name.split(" ")[0],
            company: c.company,
            email: c.email,
            phone: c.phone,
            plan: c.plan,
            amount: c.amount,
            nextDue: c.nextDue,
            status: c.status,
          }
        : null;
    }
    if (!me) return null;
    // Aplica a troca de metodo feita em /cliente/pagamento (em memoria no mock).
    const override = mockPaymentMethods.get(me.id);
    return override ? { ...me, paymentMethod: methodToDto(override) as Me["paymentMethod"] } : me;
  },
  async listInvoicesForCustomer(customerId) {
    if (customerId === mockMe.id) return invoicesForClient("em-dia");
    return [];
  },
  async listAllInvoices() {
    return mockInvoicesAll;
  },
  async listFollowups() {
    return mockFollowups;
  },
  async listFollowupsForCustomer(customerId) {
    const cust = mockCustomers.find((c) => c.id === customerId);
    if (!cust) return [];
    return mockFollowups.filter((f) => f.customer === cust.name);
  },
  async listTickets() {
    return mockTickets;
  },
  async getMetrics() {
    return mockMetrics;
  },
  async createCustomer(input) {
    const plan = mockPlans.find((p) => p.id === input.planId) || mockPlans[0];
    return {
      id: "c-" + Math.abs(hashString(input.email)).toString().slice(0, 3),
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone || "",
      plan: plan.name,
      amount: plan.monthly,
      status: "aguardando",
      nextDue: "—",
      lastPay: "—",
      method: "PIX",
    };
  },
  async markInvoicePaid() {
    /* no-op no mock */
  },
  async createTicket(input) {
    return {
      id: "CH-" + Math.abs(hashString(input.title)).toString().slice(0, 3),
      title: input.title,
      type: input.type,
      priority: input.priority,
      status: "aberto",
      createdAt: todayBR(),
    };
  },
  // Modo mock e estatico/em memoria: as operacoes de escrita do ciclo de cobranca
  // degradam para no-op (a persistencia real vive no repositorio Prisma).
  async recordCheckout() {
    /* no-op no mock */
  },
  async applyGatewayPayment() {
    return { applied: false };
  },
  async applyGatewayRefund() {
    return { applied: false };
  },
  async getRefundablePayment() {
    return null;
  },
  async setCustomerStatus() {
    /* no-op no mock */
  },
  async setPaymentMethod(id, method) {
    mockPaymentMethods.set(id, method);
  },
  async getInvoiceWithCustomer(id) {
    return {
      id,
      amount: mockMe.amount,
      email: mockMe.email,
      companyName: mockMe.company,
      paymentLink: null,
      document: mockMe.document || null,
      status: "em-aberto",
    };
  },
  async findCustomerForLogin(identifier) {
    const idLower = identifier.toLowerCase();
    const digits = normalizeDoc(identifier);
    const c = mockCustomers.find(
      (x) =>
        x.email.toLowerCase() === idLower ||
        (x.document && digits.length >= 11 && normalizeDoc(x.document) === digits)
    );
    if (!c) return null;
    return { id: c.id, email: c.email, passwordHash: mockPasswords.get(c.id) || null };
  },
  async setCustomerPassword(id, passwordHash) {
    mockPasswords.set(id, passwordHash);
  },
  async getActivationTarget(id) {
    const c = mockCustomers.find((x) => x.id === id) || (id === mockMe.id ? mockMe : null);
    if (!c) return null;
    return mockPasswords.has(id) ? null : { email: c.email };
  },
  async getBriefForCustomer(customerId) {
    return mockBriefs.get(customerId) || null;
  },
  async saveBrief(customerId, input) {
    const brief: ProjectBrief = {
      goal: input.goal,
      currentTool: input.currentTool || "",
      pain: input.pain || "",
      volume: input.volume || "",
      createdAt: mockBriefs.get(customerId)?.createdAt || todayBR(),
    };
    mockBriefs.set(customerId, brief);
    return brief;
  },
};

/* ------------------------------------------------------------------ */
/* Repositorio Prisma (quando DATABASE_URL existe)                     */
/* ------------------------------------------------------------------ */
const REAIS = 100;
const centsToReais = (c: number) => Math.round(c / REAIS);
const reaisToCents = (r: number) => Math.round(r * REAIS);

function fmtBR(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
const invStatusToDto = (s: string): InvoiceStatus => s.replace(/_/g, "-") as InvoiceStatus;
const methodToDto = (m: string | null): string =>
  m === "pix" ? "PIX" : m === "cartao" ? "Cartão" : m === "boleto" ? "Boleto" : "—";
const channelToDto = (c: string): "WhatsApp" | "E-mail" | "Discord" =>
  c === "whatsapp" ? "WhatsApp" : c === "discord" ? "Discord" : "E-mail";

function prismaRepoFactory(): Repo {
  const db = getPrisma();
  const addMonth = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));

  // Marca a fatura como paga (idempotente) e atualiza o cliente: registra o
  // ultimo pagamento e, se nao restar fatura em aberto/vencida, reativa (ativo)
  // e agenda o proximo vencimento.
  async function payInvoice(id: string, gatewayPaymentId?: string): Promise<{ customerId: string } | null> {
    const inv = await db.invoice.findUnique({ where: { id } });
    if (!inv) return null;
    if (inv.status !== "paga") {
      try {
        await db.invoice.update({
          where: { id },
          data: { status: "paga", paidAt: new Date(), ...(gatewayPaymentId ? { gatewayPaymentId } : {}) },
        });
      } catch (e) {
        // gatewayPaymentId e @unique: colisao = outra entrega do mesmo webhook ja
        // baixou esta cobranca. Trata como idempotente (no-op).
        if (isUniqueViolation(e)) return { customerId: inv.customerId };
        throw e;
      }
    }
    const customer = await db.customer.findUnique({ where: { id: inv.customerId } });
    const open = await db.invoice.count({
      where: { customerId: inv.customerId, status: { in: ["em_aberto", "vencida"] } },
    });
    const data: { lastPaymentDate: Date; status?: "ativo"; nextDueDate?: Date } = { lastPaymentDate: new Date() };
    // Primeiro pagamento (cliente "aguardando") ja ativa a conta. O proximo vencimento
    // so e reagendado quando NAO resta fatura em aberto/vencida (nao reagenda com saldo).
    if (customer?.status === "aguardando") data.status = "ativo";
    if (open === 0) {
      data.status = "ativo";
      data.nextDueDate = addMonth(inv.dueDate);
    }
    await db.customer.update({ where: { id: inv.customerId }, data });
    return { customerId: inv.customerId };
  }

  return {
    async listPlans() {
      return listPlansStatic();
    },
    async getCustomerByEmail(email) {
      const c = await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
      return c ? toCustomerDto(c) : null;
    },
    async getCustomerById(id) {
      const c = await db.customer.findUnique({ where: { id } });
      return c ? toCustomerDto(c) : null;
    },
    async listCustomers() {
      const list = await db.customer.findMany({ orderBy: { createdAt: "asc" } });
      return list.map(toCustomerDto);
    },
    async getMe(email) {
      const c = await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
      if (!c) return null;
      const displayName = c.name || c.companyName;
      return {
        id: c.id,
        name: displayName,
        firstName: displayName.split(" ")[0],
        company: c.companyName,
        email: c.email,
        phone: c.phone || "",
        document: c.document || "",
        plan: c.planLabel || "—",
        planId: "operacao",
        amount: c.monthlyAmount != null ? centsToReais(c.monthlyAmount) : 0,
        cycle: "mês",
        startDate: fmtBR(c.createdAt),
        nextDue: c.nextDueDate ? fmtBR(c.nextDueDate) : "—",
        paymentMethod: methodToDto(c.paymentMethod) as Me["paymentMethod"],
        cardLast4: null,
        status: c.status as CustomerStatus,
      };
    },
    async listInvoicesForCustomer(customerId) {
      const list = await db.invoice.findMany({ where: { customerId }, orderBy: { dueDate: "desc" } });
      return list.map((i) => ({
        id: i.id,
        due: fmtBR(i.dueDate),
        amount: centsToReais(i.amount),
        status: invStatusToDto(i.status),
        method: methodToDto(i.paymentMethod),
        paidAt: i.paidAt ? fmtBR(i.paidAt) : null,
      }));
    },
    async listAllInvoices() {
      const list = await db.invoice.findMany({ include: { customer: true }, orderBy: { dueDate: "desc" } });
      return list.map((i) => ({
        id: i.id,
        customer: i.customer.companyName,
        company: i.customer.companyName,
        plan: "Operação",
        amount: centsToReais(i.amount),
        due: fmtBR(i.dueDate),
        status: invStatusToDto(i.status),
        method: methodToDto(i.paymentMethod),
        lastFollowup: "—",
      }));
    },
    async listFollowups() {
      const list = await db.followup.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" } });
      return list.map(followupToDto);
    },
    async listFollowupsForCustomer(customerId) {
      const list = await db.followup.findMany({
        where: { customerId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      });
      return list.map(followupToDto);
    },
    async listTickets(customerId) {
      const list = await db.supportTicket.findMany({
        where: customerId ? { customerId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return list.map((t) => ({
        id: t.id,
        title: t.title,
        type: "—",
        priority: t.priority,
        status: t.status as Ticket["status"],
        createdAt: fmtBR(t.createdAt),
      }));
    },
    async getMetrics() {
      // Recebido/a receber sao escopados ao mes corrente (rotulo "do mes").
      const ref = new Date();
      const monthStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
      const nextMonthStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
      const [activeAgg, overdue, paused, canceled, open] = await Promise.all([
        db.customer.aggregate({ _sum: { monthlyAmount: true }, _count: true, where: { status: "ativo" } }),
        db.customer.count({ where: { status: "vencido" } }),
        db.customer.count({ where: { status: "pausado" } }),
        db.customer.count({ where: { status: "cancelado" } }),
        db.invoice.count({ where: { status: { in: ["em_aberto", "vencida"] } } }),
      ]);
      const paid = await db.invoice.aggregate({
        _sum: { amount: true },
        where: { status: "paga", paidAt: { gte: monthStart, lt: nextMonthStart } },
      });
      const openSum = await db.invoice.aggregate({
        _sum: { amount: true },
        where: { status: { in: ["em_aberto", "vencida"] }, dueDate: { gte: monthStart, lt: nextMonthStart } },
      });
      return {
        mrr: centsToReais(activeAgg._sum.monthlyAmount || 0),
        active: activeAgg._count,
        overdue,
        paused,
        openInvoices: open,
        receivedMonth: centsToReais(paid._sum.amount || 0),
        expected: centsToReais(openSum._sum.amount || 0),
        churn: canceled,
      };
    },
    async createCustomer(input) {
      const plan = mockPlans.find((p) => p.id === input.planId) || mockPlans[0];
      const c = await db.customer.create({
        data: {
          name: input.name,
          companyName: input.company,
          email: input.email,
          phone: input.phone,
          status: "aguardando",
          planLabel: plan.name,
          monthlyAmount: plan.monthly * 100,
          paymentMethod: "pix",
        },
      });
      return toCustomerDto(c);
    },
    async markInvoicePaid(id) {
      await payInvoice(id);
    },
    async createTicket(input) {
      const t = await db.supportTicket.create({
        data: {
          customerId: input.customerId,
          title: input.title,
          description: input.description,
          priority: priorityToEnum(input.priority),
        },
      });
      // Espelha no Twenty (one-way, nao bloqueante): garante a Empresa e cria o
      // Chamado ligado a ela. Caso central. Falha aqui nao afeta o ticket.
      fireAndForget("createTicket", syncChamadoToTwenty(db, t.customerId, t));
      return {
        id: t.id,
        title: t.title,
        type: input.type,
        priority: input.priority,
        status: t.status as Ticket["status"],
        createdAt: fmtBR(t.createdAt),
      };
    },
    async recordCheckout(input) {
      const plan = mockPlans.find((p) => p.id === input.planId) || mockPlans[0];
      const cents = reaisToCents(plan.monthly);
      const now = new Date();
      const nextDue = addMonth(now);
      const existing = await db.customer.findFirst({
        where: { email: { equals: input.email, mode: "insensitive" } },
      });
      const base = {
        name: input.name,
        companyName: input.company || input.name,
        phone: input.phone,
        document: input.document,
        planLabel: plan.name,
        monthlyAmount: cents,
        paymentMethod: input.method,
        gatewayCustomerId: input.gatewayCustomerId,
      };
      const customer = existing
        ? await db.customer.update({
            where: { id: existing.id },
            // mantem "ativo" se ja era; senao fica "aguardando" o 1o pagamento
            data: { ...base, status: existing.status === "ativo" ? existing.status : "aguardando" },
          })
        : await db.customer.create({ data: { ...base, email: input.email, status: "aguardando" } });
      // Garante que o plano existe (Subscription.planId e FK). Migrations criam o
      // schema mas nao populam Plan; sem isso, todo checkout estoura FK em deploy sem seed.
      await db.plan.upsert({
        where: { id: plan.id },
        update: {},
        create: { id: plan.id, name: plan.name, price: cents, billingCycle: "mensal", isActive: true },
      });
      const sub = await db.subscription.create({
        data: {
          customerId: customer.id,
          planId: plan.id,
          status: "pendente",
          startDate: now,
          nextDueDate: nextDue,
          gatewaySubscriptionId: input.gatewaySubscriptionId,
        },
      });
      const invoice = await db.invoice.create({
        data: {
          customerId: customer.id,
          subscriptionId: sub.id,
          amount: cents,
          dueDate: now,
          status: "em_aberto",
          paymentMethod: input.method,
        },
      });
      // Espelha no Twenty (one-way, nao bloqueante): Empresa + Pessoa (contato) +
      // Assinatura + Fatura. Falha aqui nao afeta o checkout.
      fireAndForget(
        "recordCheckout",
        (async () => {
          const empresaId = await upsertEmpresa(customerToEmpresa(customer));
          if (!empresaId) return;
          await upsertPessoa(
            { name: customer.name, email: customer.email, phone: customer.phone, document: customer.document },
            empresaId
          );
          const assinaturaId = await createAssinatura(
            {
              status: sub.status,
              startDate: sub.startDate,
              nextDueDate: sub.nextDueDate,
              gatewaySubscriptionId: sub.gatewaySubscriptionId,
            },
            empresaId
          );
          await createFatura(
            {
              amountCents: invoice.amount,
              dueDate: invoice.dueDate,
              status: invoice.status,
              paymentMethod: invoice.paymentMethod,
              paymentLink: invoice.paymentLink,
              gatewayPaymentId: invoice.gatewayPaymentId,
            },
            empresaId,
            assinaturaId
          );
        })()
      );
    },
    async applyGatewayPayment(event) {
      const paid = event.status.toLowerCase();
      // Status ESTRITO: so estes valem como pago. "payment.created" e apenas criacao,
      // nao aprovacao, e nao entra aqui.
      const isApproved = ["approved", "authorized", "paid", "received", "confirmed", "accredited"].includes(paid);

      // Idempotencia: se este pagamento ja foi carimbado numa fatura, e reenvio -> no-op.
      if (event.gatewayPaymentId) {
        const stamped = await db.invoice.findFirst({ where: { gatewayPaymentId: event.gatewayPaymentId } });
        if (stamped) return { applied: false, invoiceId: stamped.id, customerId: stamped.customerId };
      }
      if (!isApproved) return { applied: false };

      // Pagamento de UMA fatura (ref woinv_<invoiceId>): da baixa direto naquela fatura,
      // sem depender da assinatura. Reusa payInvoice (idempotente) e a checagem de valor.
      if (event.gatewaySubscriptionId?.startsWith(INVOICE_REF_PREFIX)) {
        const invoiceId = event.gatewaySubscriptionId.slice(INVOICE_REF_PREFIX.length);
        const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
        if (!inv) return { applied: false };
        if (event.amountCents != null && event.amountCents !== inv.amount) {
          log.warn("pagamento.valor_divergente", {
            invoiceId: inv.id,
            esperadoCents: inv.amount,
            pagoCents: event.amountCents,
            ref: event.gatewaySubscriptionId,
          });
          return { applied: false, invoiceId: inv.id, customerId: inv.customerId };
        }
        const r = await payInvoice(inv.id, event.gatewayPaymentId);
        if (!r) return { applied: false, invoiceId: inv.id, customerId: inv.customerId };
        if (inv.subscriptionId) {
          await db.subscription.update({ where: { id: inv.subscriptionId }, data: { status: "ativo" } }).catch(() => {});
          fireAndForget("applyGatewayPayment", syncOpportunityToTwenty(db, r.customerId, inv.subscriptionId));
        }
        return { applied: true, invoiceId: inv.id, customerId: r.customerId };
      }

      // Correlacao pela ref wo_: baixa a fatura DAQUELA assinatura (nao a mais antiga
      // de qualquer assinatura do cliente).
      if (event.gatewaySubscriptionId) {
        const sub = await db.subscription.findFirst({ where: { gatewaySubscriptionId: event.gatewaySubscriptionId } });
        if (!sub) return { applied: false };
        const inv = await db.invoice.findFirst({
          where: { subscriptionId: sub.id, status: { in: ["em_aberto", "vencida", "criada"] } },
          orderBy: { dueDate: "asc" },
        });
        if (!inv) return { applied: false, customerId: sub.customerId };
        // Confere o valor pago contra a fatura (em centavos), quando informado.
        if (event.amountCents != null && event.amountCents !== inv.amount) {
          log.warn("pagamento.valor_divergente", {
            invoiceId: inv.id,
            esperadoCents: inv.amount,
            pagoCents: event.amountCents,
            ref: event.gatewaySubscriptionId,
          });
          return { applied: false, invoiceId: inv.id, customerId: sub.customerId };
        }
        const r = await payInvoice(inv.id, event.gatewayPaymentId);
        if (!r) return { applied: false, invoiceId: inv.id, customerId: sub.customerId };
        // Ativa a assinatura SO depois de baixar a fatura confirmada.
        await db.subscription.update({ where: { id: sub.id }, data: { status: "ativo" } });
        // Espelha no Twenty (best-effort, nao bloqueante): atualiza o status do
        // cliente e, no PRIMEIRO pagamento, abre a oportunidade (pipeline).
        fireAndForget(
          "applyGatewayPayment",
          (async () => {
            const c = await db.customer.findUnique({ where: { id: r.customerId } });
            if (c) await updateEmpresaStatus(c.gatewayCustomerId, c.status);
            await syncOpportunityToTwenty(db, r.customerId, sub.id);
          })()
        );
        return { applied: true, invoiceId: inv.id, customerId: r.customerId };
      }
      return { applied: false };
    },
    async applyGatewayRefund(event) {
      // Acha a fatura paga pelo id do pagamento (caminho do webhook e do botao do
      // admin) ou, na falta dele, pela ref da assinatura (ultima fatura paga).
      let inv = event.gatewayPaymentId
        ? await db.invoice.findFirst({ where: { gatewayPaymentId: event.gatewayPaymentId } })
        : null;
      if (!inv && event.gatewaySubscriptionId) {
        const sub = await db.subscription.findFirst({
          where: { gatewaySubscriptionId: event.gatewaySubscriptionId },
        });
        if (sub) {
          inv = await db.invoice.findFirst({
            where: { subscriptionId: sub.id, status: "paga" },
            orderBy: { paidAt: "desc" },
          });
        }
      }
      if (!inv) return { applied: false };
      // Idempotencia REAL contra corrida (webhook 'refunded' + botao do admin, ou
      // retries do MP): a transicao para "reembolsada" e condicional ao status atual
      // e atomica (updateMany com guard). Quem ganha a corrida aplica os efeitos; o
      // outro recebe count 0 e vira no-op. So a checagem de status (read-then-write)
      // nao cobriria duas execucoes concorrentes.
      const claimed = await db.invoice.updateMany({
        where: { id: inv.id, status: { notIn: ["reembolsada", "estornada"] } },
        data: { status: "reembolsada" },
      });
      if (claimed.count === 0) {
        return { applied: false, alreadyRefunded: true, invoiceId: inv.id, customerId: inv.customerId };
      }
      if (inv.subscriptionId) {
        await db.subscription.update({
          where: { id: inv.subscriptionId },
          data: { status: "cancelado", canceledAt: new Date() },
        });
      }
      // So cancela o CLIENTE se nao restar assinatura ativa nem fatura em aberto: um
      // cliente pode ter mais de uma assinatura, e derrubar o cliente inteiro por um
      // reembolso distorceria churn/MRR e o autopause da regua. Mesma logica do
      // payInvoice (open === 0).
      const [activeSubs, openInvoices] = await Promise.all([
        db.subscription.count({ where: { customerId: inv.customerId, status: "ativo" } }),
        db.invoice.count({ where: { customerId: inv.customerId, status: { in: ["em_aberto", "vencida"] } } }),
      ]);
      if (activeSubs === 0 && openInvoices === 0) {
        const c = await db.customer.update({ where: { id: inv.customerId }, data: { status: "cancelado" } });
        // Espelha o cancelamento no Twenty (best-effort, nao bloqueante).
        fireAndForget("applyGatewayRefund", updateEmpresaStatus(c.gatewayCustomerId, "cancelado"));
      }
      return { applied: true, invoiceId: inv.id, customerId: inv.customerId };
    },
    async getRefundablePayment(customerId) {
      const inv = await db.invoice.findFirst({
        where: { customerId, status: "paga", gatewayPaymentId: { not: null } },
        orderBy: { paidAt: "desc" },
      });
      if (!inv || !inv.gatewayPaymentId) return null;
      return { gatewayPaymentId: inv.gatewayPaymentId, invoiceId: inv.id, amountCents: inv.amount };
    },
    async setCustomerStatus(id, status) {
      const c = await db.customer.update({ where: { id }, data: { status } });
      // Espelha o status do cliente no Twenty (best-effort, nao bloqueante).
      fireAndForget("setCustomerStatus", updateEmpresaStatus(c.gatewayCustomerId, status));
    },
    async setPaymentMethod(id, method) {
      await db.customer.update({ where: { id }, data: { paymentMethod: method } });
    },
    async getInvoiceWithCustomer(id) {
      const inv = await db.invoice.findUnique({ where: { id }, include: { customer: true } });
      if (!inv) return null;
      return {
        id: inv.id,
        amount: centsToReais(inv.amount),
        email: inv.customer.email,
        companyName: inv.customer.companyName,
        paymentLink: inv.paymentLink,
        document: inv.customer.document,
        status: invStatusToDto(inv.status),
      };
    },
    async findCustomerForLogin(identifier) {
      const idLower = identifier.toLowerCase();
      // Casa por e-mail (case-insensitive) OU documento (como digitado).
      const c = await db.customer.findFirst({
        where: { OR: [{ email: { equals: idLower, mode: "insensitive" } }, { document: identifier }] },
      });
      return c ? { id: c.id, email: c.email, passwordHash: c.passwordHash } : null;
    },
    async setCustomerPassword(id, passwordHash) {
      await db.customer.update({ where: { id }, data: { passwordHash } });
    },
    async getActivationTarget(id) {
      const c = await db.customer.findUnique({ where: { id } });
      return c && !c.passwordHash ? { email: c.email } : null;
    },
    async getBriefForCustomer(customerId) {
      const b = await db.projectBrief.findUnique({ where: { customerId } });
      return b ? briefToDto(b) : null;
    },
    async saveBrief(customerId, input) {
      const existed = await db.projectBrief.findUnique({ where: { customerId } });
      const data = {
        goal: input.goal,
        currentTool: input.currentTool || null,
        pain: input.pain || null,
        volume: input.volume || null,
      };
      const b = await db.projectBrief.upsert({
        where: { customerId },
        update: data,
        create: { customerId, ...data },
      });
      // Espelha no Twenty (one-way, nao bloqueante) so na PRIMEIRA vez: cria um
      // chamado "Projeto: <empresa>" com o briefing (substitui o card do Trello).
      if (!existed) fireAndForget("saveBrief", syncBriefToTwenty(db, customerId, b));
      return briefToDto(b);
    },
  };
}

// row do Prisma (customer) -> entrada do adapter do Twenty (Empresa).
function customerToEmpresa(c: {
  companyName: string;
  document: string | null;
  planLabel: string | null;
  monthlyAmount: number | null;
  paymentMethod: string | null;
  gatewayCustomerId: string | null;
  status: string;
  nextDueDate: Date | null;
  lastPaymentDate: Date | null;
}): EmpresaInput {
  return {
    companyName: c.companyName,
    document: c.document,
    planLabel: c.planLabel,
    monthlyAmountCents: c.monthlyAmount,
    paymentMethod: c.paymentMethod,
    gatewayCustomerId: c.gatewayCustomerId,
    status: c.status,
    nextDueDate: c.nextDueDate,
    lastPaymentDate: c.lastPaymentDate,
  };
}

// Garante a Empresa no Twenty (a partir da row do cliente) e cria o Chamado
// ligado a ela. Usado no fluxo nao bloqueante de createTicket. Carrega o cliente
// pelo id da row do ticket. Best-effort: qualquer falha so e logada.
async function syncChamadoToTwenty(
  db: ReturnType<typeof getPrisma>,
  customerId: string,
  ticket: { title: string; description: string | null; priority: string; status: string; trelloCardId: string | null }
): Promise<void> {
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const empresaId = await upsertEmpresa(customerToEmpresa(customer));
  if (!empresaId) return;
  await createChamado(
    {
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      trelloCardId: ticket.trelloCardId,
    },
    empresaId
  );
}

// Abre a Oportunidade (pipeline) no Twenty no PRIMEIRO pagamento da assinatura.
// Recorrencia (2a fatura paga em diante) NAO abre novo pipeline. Best-effort.
async function syncOpportunityToTwenty(
  db: ReturnType<typeof getPrisma>,
  customerId: string,
  subscriptionId: string
): Promise<void> {
  const paidCount = await db.invoice.count({ where: { subscriptionId, status: "paga" } });
  if (paidCount !== 1) return;
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const empresaId = await upsertEmpresa(customerToEmpresa(customer));
  if (!empresaId) return;
  const pessoaId = await upsertPessoa(
    { name: customer.name, email: customer.email, phone: customer.phone, document: customer.document },
    empresaId
  );
  await createOportunidade(
    {
      name: `${customer.companyName}${customer.planLabel ? " · " + customer.planLabel : ""}`,
      amountCents: customer.monthlyAmount,
      closeDate: new Date(),
    },
    empresaId,
    pessoaId
  );
}

// Espelha o briefing do projeto no Twenty como chamado "Projeto: <empresa>"
// (substitui o card do Trello). Best-effort, ligado a Empresa do cliente.
async function syncBriefToTwenty(
  db: ReturnType<typeof getPrisma>,
  customerId: string,
  brief: { goal: string; currentTool: string | null; pain: string | null; volume: string | null }
): Promise<void> {
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const empresaId = await upsertEmpresa(customerToEmpresa(customer));
  if (!empresaId) return;
  // Briefing tem objeto proprio no Twenty (nao vira chamado): objetivo, ferramenta,
  // dor e volume, ligado a Empresa do cliente.
  await createBriefing(
    {
      goal: brief.goal,
      currentTool: brief.currentTool,
      pain: brief.pain,
      volume: brief.volume,
      companyName: customer.companyName,
    },
    empresaId
  );
}

// row do Prisma (project_brief) -> DTO de UI
function briefToDto(b: {
  goal: string;
  currentTool: string | null;
  pain: string | null;
  volume: string | null;
  createdAt: Date;
}): ProjectBrief {
  return {
    goal: b.goal,
    currentTool: b.currentTool || "",
    pain: b.pain || "",
    volume: b.volume || "",
    createdAt: fmtBR(b.createdAt),
  };
}

// row do Prisma (customer) -> DTO de UI
function toCustomerDto(c: {
  id: string;
  name: string | null;
  companyName: string;
  email: string;
  phone: string | null;
  document: string | null;
  status: string;
  planLabel: string | null;
  monthlyAmount: number | null;
  nextDueDate: Date | null;
  lastPaymentDate: Date | null;
  paymentMethod: string | null;
}): Customer {
  return {
    id: c.id,
    name: c.name || c.companyName,
    company: c.companyName,
    email: c.email,
    phone: c.phone || "",
    plan: c.planLabel || "—",
    amount: c.monthlyAmount != null ? centsToReais(c.monthlyAmount) : 0,
    status: c.status as CustomerStatus,
    nextDue: c.nextDueDate ? fmtBR(c.nextDueDate) : "—",
    lastPay: c.lastPaymentDate ? fmtBR(c.lastPaymentDate) : "—",
    method: methodToDto(c.paymentMethod),
    document: c.document || undefined,
  };
}

// row do Prisma (followup + customer) -> DTO de UI
function followupToDto(f: {
  id: string;
  customer: { companyName: string };
  type: string;
  channel: string;
  sentAt: Date | null;
  status: string;
  invoiceId: string | null;
  errorMessage: string | null;
}): Followup {
  return {
    id: Number(f.id.replace(/\D/g, "").slice(0, 6) || "0"),
    customer: f.customer.companyName,
    type: f.type as Followup["type"],
    label: f.type,
    channel: channelToDto(f.channel),
    sentAt: f.sentAt ? fmtBR(f.sentAt) : "—",
    status: f.status as Followup["status"],
    invoice: f.invoiceId || "—",
    result: f.errorMessage || "—",
  };
}

function priorityToEnum(p: string): "baixa" | "media" | "alta" {
  const v = p.toLowerCase();
  if (v.startsWith("alta")) return "alta";
  if (v.startsWith("baixa")) return "baixa";
  return "media";
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}
function todayBR(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Violacao de restricao unica do Prisma (P2002), usada para idempotencia do webhook.
function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002";
}

// Detecta erro de "banco inacessivel" (Prisma nao conseguiu conectar).
function isDbUnreachable(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return (
    e.name === "PrismaClientInitializationError" ||
    /reach database server|P1001|ECONNREFUSED|ETIMEDOUT/i.test(e.message)
  );
}

// Em DEV, se o Postgres estiver fora, cai para o repositorio mock (com aviso) em
// vez de estourar 500. Em PRODUCAO o erro continua propagando (queremos saber).
// Coerente com o objetivo do projeto: rodar sem credencial degradando para mock.
function resilientRepo(prisma: Repo, mock: Repo): Repo {
  let useMock = false;
  return new Proxy(prisma, {
    get(target, prop) {
      const key = prop as keyof Repo;
      const real = target[key];
      if (typeof real !== "function") return real;
      return async (...args: unknown[]) => {
        const callMock = () => (mock[key] as (...a: unknown[]) => unknown)(...args);
        if (useMock) return callMock();
        try {
          return await (real as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        } catch (e) {
          if (!env.isProd && isDbUnreachable(e)) {
            useMock = true;
            console.warn(
              "[repo] Banco inacessível em dev: usando dados mock. Suba o Postgres (docker compose up -d + npm run db:seed) para dados reais."
            );
            return callMock();
          }
          throw e;
        }
      };
    },
  });
}

let _repo: Repo | null = null;
export function getRepo(): Repo {
  if (_repo) return _repo;
  _repo = env.hasDb() ? resilientRepo(prismaRepoFactory(), mockRepo) : mockRepo;
  return _repo;
}
