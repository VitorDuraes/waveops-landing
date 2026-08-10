// WaveOps Portal - tipos da camada de dados (mock).
// Espelham o modelo da secao 10 do handoff, no formato usado pela interface.

export type CustomerStatus =
  | "lead"
  | "aguardando"
  | "ativo"
  | "pendente"
  | "vencido"
  | "pausado"
  | "cancelado";

export type InvoiceStatus =
  | "criada"
  | "em-aberto"
  | "paga"
  | "vencida"
  | "cancelada"
  | "estornada"
  | "reembolsada";

export type TicketStatus = "aberto" | "em-andamento" | "resolvido" | "fechado";

export type FollowupStatus = "agendado" | "enviado" | "falhou";

export type FollowupType =
  | "before_7_days"
  | "before_3_days"
  | "due_today"
  | "overdue_1_day"
  | "overdue_3_days"
  | "overdue_7_days";

export type FollowupChannel = "WhatsApp" | "E-mail" | "Discord";

export type PaymentMethod = "PIX" | "Cartão" | "Boleto";

// Estado de exemplo para validar cenarios da area do cliente.
export type DemoState = "em-dia" | "vencido" | "pausado";

export type Theme = "dark" | "light";
export type Density = "comfortable" | "compact";

// Tom usado por badges/alertas.
export type Tone = "ok" | "warn" | "danger" | "info" | "paused" | "neutral" | "accent";

export interface Plan {
  id: string;
  name: string;
  // Valor de REFERENCIA do plano. Vira o padrao sugerido na proposta, nao o preco
  // final: o valor que vale e o contratado, gravado no cliente (Customer.amount).
  monthly: number;
  annual: number;
  annualTotal: number;
  cycle: string;
  featured: boolean;
  desc: string;
  benefits: string[];
  // Plano de entrada, assinavel sozinho pelo checkout publico. Os demais sao
  // fechados por proposta: escopo e valor combinados no diagnostico.
  selfService: boolean;
}

export interface Me {
  id: string;
  name: string;
  firstName: string;
  company: string;
  email: string;
  phone: string;
  document: string;
  plan: string;
  planId: string;
  amount: number;
  cycle: string;
  startDate: string;
  nextDue: string;
  paymentMethod: PaymentMethod;
  cardLast4: string | null;
  status: CustomerStatus;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  plan: string;
  amount: number;
  status: CustomerStatus;
  nextDue: string;
  lastPay: string;
  method: PaymentMethod | string;
  document?: string;
}

export interface ClientInvoice {
  id: string;
  due: string;
  amount: number;
  status: InvoiceStatus;
  method: PaymentMethod | string;
  paidAt: string | null;
}

export interface AdminInvoice {
  id: string;
  customer: string;
  company: string;
  plan: string;
  amount: number;
  due: string;
  status: InvoiceStatus;
  method: PaymentMethod | string;
  lastFollowup: string;
}

export interface Followup {
  id: number;
  customer: string;
  type: FollowupType;
  label: string;
  channel: FollowupChannel;
  sentAt: string;
  status: FollowupStatus;
  invoice: string;
  result: string;
}

export interface Ticket {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: TicketStatus;
  createdAt: string;
}

// Briefing do projeto que o cliente quer (capturado apos o pagamento, na primeira
// entrada na area logada). Um por cliente.
export interface ProjectBrief {
  goal: string;
  currentTool: string;
  pain: string;
  volume: string;
  createdAt: string;
}

export interface Metrics {
  mrr: number;
  active: number;
  overdue: number;
  paused: number;
  openInvoices: number;
  receivedMonth: number;
  expected: number;
  churn: number;
}

export interface ReguaStep {
  key: FollowupType;
  label: string;
  when: string;
  tone: Tone;
}
