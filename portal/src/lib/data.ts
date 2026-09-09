// WaveOps Portal - dados mock (exemplos do escopo do projeto).
// No MVP a interface roda inteiramente com estes dados. A troca para backend
// real (Prisma/PostgreSQL + Asaas) acontece depois, mantendo estas estruturas.

import type {
  Plan,
  Me,
  Customer,
  ClientInvoice,
  AdminInvoice,
  Followup,
  Ticket,
  Metrics,
  ReguaStep,
  DemoState,
} from "@/lib/types";

// Planos reais da WaveOps (waveops.com.br). O Operacao e o unico assinavel sozinho
// (selfService); nos demais o valor sai por proposta e os numeros aqui sao so
// referencia interna para montar a proposta. O preco que vale e o contratado, que
// fica no cliente (Customer.monthlyAmount).
export const plans: Plan[] = [
  {
    id: "operacao",
    name: "Operação",
    selfService: true,
    monthly: 397,
    annual: 327,
    annualTotal: 3924,
    cycle: "mês",
    featured: false,
    desc: "A gente coloca sua operação no ar e mantém rodando.",
    benefits: [
      "Até 2 automações ativas",
      "1 número de WhatsApp incluso",
      "Infra hospedada e gerida pela WaveOps",
      "Monitoramento dos fluxos",
      "Conserto das integrações ativas",
      "Relatório mensal de valor em R$",
    ],
  },
  {
    id: "essencial",
    selfService: false,
    name: "Essencial",
    monthly: 697,
    annual: 577,
    annualTotal: 6924,
    cycle: "mês",
    featured: false,
    desc: "Mais automações e uma evolução todo mês.",
    benefits: [
      "Tudo do Operação",
      "Até 5 automações ativas",
      "1 evolução por mês",
      "Suporte prioritário",
    ],
  },
  {
    id: "pro",
    selfService: false,
    name: "Pro",
    monthly: 1297,
    annual: 1067,
    annualTotal: 12804,
    cycle: "mês",
    featured: true,
    desc: "Sistema, dashboard ou agente de IA incluso e evolução contínua.",
    benefits: [
      "Tudo do Essencial",
      "Até 12 automações ativas",
      "1 sistema, dashboard ou agente de IA hospedado",
      "Agente de IA com LLM econômico incluso (até 10 mil chamadas por mês)",
      "Evolução contínua do que está no ar",
      "Revisão mensal de resultados",
    ],
  },
  {
    id: "business",
    selfService: false,
    name: "Empresarial",
    monthly: 2497,
    annual: 2097,
    annualTotal: 25164,
    cycle: "mês",
    featured: false,
    desc: "Sua operação no automático, com SLA e contato dedicado.",
    benefits: [
      "Tudo do Pro",
      "Automações, sistemas e agentes dimensionados com você",
      "Múltiplos números de WhatsApp como canal dedicado",
      "SLA de resposta",
      "Ponto de contato dedicado",
    ],
  },
];

// Cliente logado (exemplo do escopo).
export const me: Me = {
  id: "c-001",
  name: "João Silva",
  firstName: "João",
  company: "JS Consultoria",
  email: "joao@jsconsultoria.com.br",
  phone: "(11) 99876-5432",
  document: "12.345.678/0001-90",
  plan: "Operação",
  planId: "operacao",
  amount: 397,
  cycle: "mês",
  startDate: "20/01/2026",
  nextDue: "20/07/2026",
  paymentMethod: "PIX",
  cardLast4: null,
  status: "ativo",
};

// Lista de clientes (admin).
export const customers: Customer[] = [
  { id: "c-001", name: "João Silva", company: "JS Consultoria", email: "joao@jsconsultoria.com.br", phone: "(11) 99876-5432", plan: "Operação", amount: 397, status: "ativo", nextDue: "20/07/2026", lastPay: "20/06/2026", method: "PIX" },
  { id: "c-002", name: "Marina Costa", company: "Clínica Vitalis", email: "marina@vitalis.com.br", phone: "(21) 98123-4455", plan: "Operação", amount: 397, status: "ativo", nextDue: "12/07/2026", lastPay: "12/06/2026", method: "Cartão" },
  { id: "c-003", name: "Rafael Lima", company: "Lima Marketing", email: "rafael@limamkt.com", phone: "(31) 99654-1212", plan: "Operação Anual", amount: 327, status: "ativo", nextDue: "03/08/2026", lastPay: "03/02/2026", method: "Cartão" },
  { id: "c-004", name: "Bruna Alves", company: "Alves Cursos", email: "bruna@alvescursos.com.br", phone: "(41) 99888-7766", plan: "Operação", amount: 397, status: "pendente", nextDue: "24/06/2026", lastPay: "24/05/2026", method: "Boleto" },
  { id: "c-005", name: "Diego Martins", company: "DM E-commerce", email: "diego@dmstore.com.br", phone: "(11) 97777-3322", plan: "Operação", amount: 397, status: "vencido", nextDue: "14/06/2026", lastPay: "14/05/2026", method: "PIX" },
  { id: "c-006", name: "Carla Souza", company: "Souza Imóveis", email: "carla@souzaimoveis.com", phone: "(48) 99321-7788", plan: "Operação", amount: 397, status: "vencido", nextDue: "11/06/2026", lastPay: "11/05/2026", method: "Boleto" },
  { id: "c-007", name: "Felipe Rocha", company: "Rocha Advocacia", email: "felipe@rochaadv.com.br", phone: "(51) 99445-9090", plan: "Operação Anual", amount: 327, status: "ativo", nextDue: "28/07/2026", lastPay: "28/01/2026", method: "Cartão" },
  { id: "c-008", name: "Patrícia Gomes", company: "PG Estética", email: "patricia@pgestetica.com", phone: "(62) 99112-3434", plan: "Operação", amount: 397, status: "ativo", nextDue: "09/07/2026", lastPay: "09/06/2026", method: "PIX" },
  { id: "c-009", name: "Lucas Pereira", company: "Pereira Contábil", email: "lucas@pereiracontabil.com.br", phone: "(11) 96655-1010", plan: "Operação", amount: 397, status: "pausado", nextDue: "02/06/2026", lastPay: "02/05/2026", method: "Boleto" },
  { id: "c-010", name: "Aline Dias", company: "Dias Odontologia", email: "aline@diasodonto.com.br", phone: "(85) 99876-2323", plan: "Operação", amount: 397, status: "ativo", nextDue: "16/07/2026", lastPay: "16/06/2026", method: "Cartão" },
  { id: "c-011", name: "Thiago Nunes", company: "Nunes Fitness", email: "thiago@nunesfit.com", phone: "(11) 95544-8877", plan: "Operação", amount: 397, status: "ativo", nextDue: "21/07/2026", lastPay: "21/06/2026", method: "PIX" },
  { id: "c-012", name: "Sandra Melo", company: "Melo Arquitetura", email: "sandra@meloarq.com.br", phone: "(27) 99233-4545", plan: "Operação Anual", amount: 327, status: "cancelado", nextDue: "—", lastPay: "15/03/2026", method: "Cartão" },
];

// Faturas do cliente logado (variam conforme o estado de exemplo).
export function invoicesForClient(demo: DemoState): ClientInvoice[] {
  const base: ClientInvoice[] = [
    { id: "FAT-0006", due: "20/07/2026", amount: 397, status: "em-aberto", method: "PIX", paidAt: null },
    { id: "FAT-0005", due: "20/06/2026", amount: 397, status: "paga", method: "PIX", paidAt: "20/06/2026" },
    { id: "FAT-0004", due: "20/05/2026", amount: 397, status: "paga", method: "PIX", paidAt: "19/05/2026" },
    { id: "FAT-0003", due: "20/04/2026", amount: 397, status: "paga", method: "PIX", paidAt: "20/04/2026" },
    { id: "FAT-0002", due: "20/03/2026", amount: 397, status: "paga", method: "PIX", paidAt: "20/03/2026" },
    { id: "FAT-0001", due: "20/02/2026", amount: 397, status: "paga", method: "PIX", paidAt: "20/02/2026" },
  ];
  if (demo === "vencido") {
    base[0] = { id: "FAT-0006", due: "14/06/2026", amount: 397, status: "vencida", method: "PIX", paidAt: null };
  } else if (demo === "pausado") {
    base[0] = { id: "FAT-0006", due: "02/06/2026", amount: 397, status: "vencida", method: "Boleto", paidAt: null };
    base.unshift({ id: "FAT-0007", due: "02/07/2026", amount: 397, status: "em-aberto", method: "Boleto", paidAt: null });
  }
  return base;
}

// Todas as faturas (admin).
export const invoicesAll: AdminInvoice[] = [
  { id: "FAT-1042", customer: "Diego Martins", company: "DM E-commerce", plan: "Operação", amount: 397, due: "14/06/2026", status: "vencida", method: "PIX", lastFollowup: "Vencido +3 dias" },
  { id: "FAT-1041", customer: "Carla Souza", company: "Souza Imóveis", plan: "Operação", amount: 397, due: "11/06/2026", status: "vencida", method: "Boleto", lastFollowup: "Vencido +7 dias" },
  { id: "FAT-1040", customer: "Bruna Alves", company: "Alves Cursos", plan: "Operação", amount: 397, due: "24/06/2026", status: "em-aberto", method: "Boleto", lastFollowup: "3 dias antes" },
  { id: "FAT-1039", customer: "Marina Costa", company: "Clínica Vitalis", plan: "Operação", amount: 397, due: "12/07/2026", status: "em-aberto", method: "Cartão", lastFollowup: "—" },
  { id: "FAT-1038", customer: "João Silva", company: "JS Consultoria", plan: "Operação", amount: 397, due: "20/06/2026", status: "paga", method: "PIX", lastFollowup: "—" },
  { id: "FAT-1037", customer: "Patrícia Gomes", company: "PG Estética", plan: "Operação", amount: 397, due: "09/06/2026", status: "paga", method: "PIX", lastFollowup: "—" },
  { id: "FAT-1036", customer: "Aline Dias", company: "Dias Odontologia", plan: "Operação", amount: 397, due: "16/06/2026", status: "paga", method: "Cartão", lastFollowup: "—" },
  { id: "FAT-1035", customer: "Lucas Pereira", company: "Pereira Contábil", plan: "Operação", amount: 397, due: "02/06/2026", status: "cancelada", method: "Boleto", lastFollowup: "Vencido +7 dias" },
  { id: "FAT-1034", customer: "Thiago Nunes", company: "Nunes Fitness", plan: "Operação", amount: 397, due: "21/06/2026", status: "paga", method: "PIX", lastFollowup: "—" },
];

// Follow-ups (admin).
export const followups: Followup[] = [
  { id: 1, customer: "Carla Souza", type: "overdue_7_days", label: "Vencido +7 dias", channel: "WhatsApp", sentAt: "18/06 09:02", status: "enviado", invoice: "FAT-1041", result: "Lida" },
  { id: 2, customer: "Diego Martins", type: "overdue_3_days", label: "Vencido +3 dias", channel: "WhatsApp", sentAt: "17/06 09:01", status: "enviado", invoice: "FAT-1042", result: "Lida" },
  { id: 3, customer: "Diego Martins", type: "overdue_1_day", label: "Vencido +1 dia", channel: "E-mail", sentAt: "15/06 08:31", status: "enviado", invoice: "FAT-1042", result: "Aberto" },
  { id: 4, customer: "Bruna Alves", type: "before_3_days", label: "3 dias antes", channel: "WhatsApp", sentAt: "21/06 09:00", status: "enviado", invoice: "FAT-1040", result: "Entregue" },
  { id: 5, customer: "Lucas Pereira", type: "overdue_7_days", label: "Vencido +7 dias", channel: "WhatsApp", sentAt: "09/06 09:03", status: "falhou", invoice: "FAT-1035", result: "Número inválido" },
  { id: 6, customer: "Carla Souza", type: "overdue_3_days", label: "Vencido +3 dias", channel: "E-mail", sentAt: "14/06 08:30", status: "enviado", invoice: "FAT-1041", result: "Aberto" },
  { id: 7, customer: "João Silva", type: "before_7_days", label: "7 dias antes", channel: "Discord", sentAt: "13/07 09:00", status: "agendado", invoice: "FAT-1038", result: "—" },
];

// Chamados de suporte (cliente).
export const tickets: Ticket[] = [
  { id: "CH-118", title: "Ajustar mensagem do follow-up de boas-vindas", type: "Solicitar ajuste", priority: "Média", status: "aberto", createdAt: "18/06/2026" },
  { id: "CH-104", title: "Dúvida sobre a cobrança de junho", type: "Dúvida sobre pagamento", priority: "Baixa", status: "resolvido", createdAt: "02/06/2026" },
  { id: "CH-097", title: "Automação do WhatsApp parou de enviar", type: "Problema em automação", priority: "Alta", status: "resolvido", createdAt: "21/05/2026" },
];

// Metricas do dashboard admin (do escopo).
export const metrics: Metrics = {
  mrr: 3970,
  active: 10,
  overdue: 2,
  paused: 1,
  openInvoices: 3,
  receivedMonth: 2779,
  expected: 1191,
  churn: 1,
};

// Regua de cobranca (config / referencia).
export const reguaSteps: ReguaStep[] = [
  { key: "before_7_days", label: "7 dias antes", when: "-7d", tone: "info" },
  { key: "before_3_days", label: "3 dias antes", when: "-3d", tone: "info" },
  { key: "due_today", label: "No dia do vencimento", when: "0", tone: "warn" },
  { key: "overdue_1_day", label: "1 dia após", when: "+1d", tone: "warn" },
  { key: "overdue_3_days", label: "3 dias após", when: "+3d", tone: "danger" },
  { key: "overdue_7_days", label: "7 dias após · pausa", when: "+7d", tone: "danger" },
];

// Objeto agregador, equivalente ao window.DB do prototipo.
export const DB = {
  plans,
  me,
  customers,
  invoicesForClient,
  invoicesAll,
  followups,
  tickets,
  metrics,
  reguaSteps,
};
