import "server-only";
import crypto from "node:crypto";
import { env } from "./env";
import { log } from "./log";

// Porta (interface) do gateway de pagamento. O resto do app so conhece esta
// interface; trocar de provedor e questao de env (PAYMENT_GATEWAY).
export interface GatewayCustomer {
  name: string;
  email: string;
  phone?: string;
  document?: string;
}
export interface CreateSubscriptionInput {
  customer: GatewayCustomer;
  planId: string;
  planName: string;
  amount: number; // em reais
  method: "pix" | "cartao" | "boleto";
}
export interface CreateSubscriptionResult {
  checkoutUrl: string;
  gatewayCustomerId?: string;
  gatewaySubscriptionId?: string;
  provider: string;
}
export interface NormalizedWebhookEvent {
  provider: string;
  kind: "payment" | "subscription" | "unknown";
  status: string; // ex.: approved, paid, pending, failed
  gatewayPaymentId?: string;
  gatewaySubscriptionId?: string;
  amountCents?: number; // valor pago, em centavos (para conferir contra a fatura)
  unresolved?: boolean; // nao deu para resolver o pagamento no MP -> pedir retry
  raw: unknown;
}
export interface WebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
  url: string;
}

export interface PaymentGateway {
  readonly id: string;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  verifyWebhook(req: WebhookRequest): Promise<boolean>;
  parseWebhook(req: WebhookRequest): Promise<NormalizedWebhookEvent>;
  // Opcional: lista os pagamentos aprovados recentes para reconciliacao. Rede de
  // seguranca para quando o webhook nao chega (banco pausado, app dormindo, 5xx).
  searchRecentApproved?(sinceDays?: number): Promise<NormalizedWebhookEvent[]>;
  // Opcional: reembolso TOTAL de um pagamento. Usado pelo botao "Reembolsar" do
  // admin. Quando ausente, o reembolso so pode ser feito no painel do gateway.
  refundPayment?(gatewayPaymentId: string): Promise<{ ok: boolean; detail?: string }>;
}

/* ------------------------------------------------------------------ */
/* Mock (padrao de desenvolvimento, sem credenciais)                   */
/* ------------------------------------------------------------------ */
const mockGateway: PaymentGateway = {
  id: "mock",
  async createSubscription(input) {
    // Simula a criacao e devolve uma URL de "pagamento" interna.
    const url = new URL("/checkout/sucesso", env.appUrl);
    url.searchParams.set("plano", input.planId);
    url.searchParams.set("mock", "1");
    return {
      provider: "mock",
      checkoutUrl: url.toString(),
      gatewayCustomerId: "mock_cus_" + Date.now(),
      gatewaySubscriptionId: "mock_sub_" + Date.now(),
    };
  },
  async verifyWebhook() {
    return true;
  },
  async parseWebhook(req) {
    let raw: unknown = req.rawBody;
    try {
      raw = JSON.parse(req.rawBody);
    } catch {
      /* mantem string */
    }
    return { provider: "mock", kind: "payment", status: "approved", raw };
  },
};

/* ------------------------------------------------------------------ */
/* Mercado Pago (assinaturas via preapproval)                          */
/* ------------------------------------------------------------------ */
const mercadoPagoGateway: PaymentGateway = {
  id: "mercadopago",
  async createSubscription(input) {
    // Sem token: degrada para um checkout simulado para o fluxo continuar visivel.
    if (!env.mercadopago.accessToken) {
      log.warn("mercadopago.sem_token", { plano: input.planId, fallback: "checkout_simulado" });
      const url = new URL("/checkout/sucesso", env.appUrl);
      url.searchParams.set("plano", input.planId);
      url.searchParams.set("mp", "simulado");
      return { provider: "mercadopago", checkoutUrl: url.toString(), gatewaySubscriptionId: "mp_sim_" + input.planId };
    }
    // MVP: cobranca via Checkout Pro (preferencia). E robusto no sandbox e casa com
    // o modelo de faturas do portal (cada cobranca = um link de pagamento, como a
    // regua ja funciona). A recorrencia automatica (preapproval) exige usuario de
    // teste + URL publica de webhook; fica para a fase com dominio publico.
    const isHttps = env.appUrl.startsWith("https://");
    // Referencia unica deste checkout. O webhook le o external_reference do pagamento
    // para reencontrar a assinatura (recordCheckout a grava em gatewaySubscriptionId)
    // e dar baixa na fatura certa. O planId continua salvo na assinatura (recordCheckout).
    const ref = "wo_" + crypto.randomUUID();
    // Nao fixamos payer.email na preferencia: no sandbox, isso obrigaria o comprador
    // logado a ter exatamente esse e-mail. Os dados do cliente ficam no recordCheckout
    // (nosso banco); o MP usa quem estiver logado no checkout.
    const body: Record<string, unknown> = {
      items: [{ title: `WaveOps · Plano ${input.planName}`, quantity: 1, unit_price: input.amount, currency_id: "BRL" }],
      external_reference: ref,
      // Pos-pagamento: volta para a ativacao (e-mail -> codigo -> criar senha).
      back_urls: { success: new URL("/cliente/ativar", env.appUrl).toString() },
    };
    // notification_url so quando o app for publico (MP rejeita localhost/http).
    if (isHttps) body.notification_url = new URL("/api/webhooks/mercadopago", env.appUrl).toString();
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.mercadopago.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log.error("mercadopago.preferencia_falhou", { httpStatus: res.status, detail: detail.slice(0, 300), ref });
      throw new Error("Mercado Pago: falha ao criar cobranca (" + res.status + ")");
    }
    const data = (await res.json()) as { id?: string; init_point?: string; sandbox_init_point?: string };
    // Escolha da URL de checkout:
    // - Token TEST-... (credencial de teste de uma conta REAL): sandbox_init_point
    //   (dominio sandbox.mercadopago.com.br).
    // - Token APP_USR-...: init_point normal (www.mercadopago.com.br). Vale tanto para
    //   producao quanto para conta de TESTE (test user): nesse caso o dinheiro e ficticio,
    //   mas o dominio e o normal. Usar sandbox_init_point com token APP_USR de test user
    //   causa loop de redirect (ERR_TOO_MANY_REDIRECTS).
    const useSandboxUrl = env.mercadopago.accessToken.startsWith("TEST-");
    const checkoutUrl =
      (useSandboxUrl ? data.sandbox_init_point : data.init_point) ||
      data.init_point ||
      data.sandbox_init_point ||
      new URL("/cliente", env.appUrl).toString();
    // gatewaySubscriptionId = ref (nao o id da preferencia): e o que o webhook casa
    // contra o external_reference do pagamento.
    return { provider: "mercadopago", checkoutUrl, gatewaySubscriptionId: ref };
  },
  async verifyWebhook(req) {
    const secret = env.mercadopago.webhookSecret;
    if (!secret) return !env.isProd; // sem segredo: aceita so fora de producao
    const signature = req.headers["x-signature"] || "";
    const requestId = req.headers["x-request-id"] || "";
    const parts = Object.fromEntries(
      signature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string])
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;
    const dataId = new URL(req.url).searchParams.get("data.id") || "";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    return timingSafeEqual(hmac, v1);
  },
  async parseWebhook(req) {
    let payload: { type?: string; action?: string; data?: { id?: string } } = {};
    try {
      payload = JSON.parse(req.rawBody);
    } catch {
      /* ignora */
    }
    const type = payload.type || payload.action || "unknown";
    // Chargeback: o caso real e coberto pelo topico "payment", cujo GET retorna status
    // "charged_back" (tratado no webhook como reembolso). O topico DEDICADO "chargebacks"
    // (type sem "payment") cairia em "unknown" e seria ignorado; nao o assinamos hoje.
    const kind: NormalizedWebhookEvent["kind"] = type.includes("payment")
      ? "payment"
      : type.includes("preapproval") || type.includes("subscription")
        ? "subscription"
        : "unknown";
    // O id do pagamento vem no corpo (data.id) ou na query (data.id / id) do IPN.
    const qs = new URL(req.url).searchParams;
    const paymentId = payload.data?.id || qs.get("data.id") || qs.get("id") || undefined;

    // Para pagamentos, busca o pagamento no MP: a notificacao so traz o id; precisamos
    // do status real e do external_reference (= a referencia do checkout) para casar
    // com a assinatura/fatura.
    if (kind === "payment" && paymentId && env.mercadopago.accessToken) {
      try {
        const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${env.mercadopago.accessToken}` },
        });
        if (r.ok) {
          const p = (await r.json()) as {
            id?: number | string;
            status?: string;
            external_reference?: string;
            transaction_amount?: number;
          };
          return {
            provider: "mercadopago",
            kind: "payment",
            status: p.status || "unknown",
            gatewayPaymentId: p.id != null ? String(p.id) : paymentId,
            gatewaySubscriptionId: p.external_reference || undefined,
            amountCents: p.transaction_amount != null ? Math.round(p.transaction_amount * 100) : undefined,
            raw: p,
          };
        }
        log.warn("mercadopago.get_payment_falhou", { httpStatus: r.status, paymentId });
      } catch (e) {
        log.warn("mercadopago.get_payment_erro", { paymentId, erro: (e as Error).message });
      }
      // Nao resolvemos o pagamento (rede/5xx/rate-limit): marca unresolved para o
      // webhook responder nao-2xx e o MP reenviar, em vez de ignorar a baixa.
      return {
        provider: "mercadopago",
        kind: "payment",
        status: "unresolved",
        gatewayPaymentId: paymentId,
        unresolved: true,
        raw: payload,
      };
    }
    return {
      provider: "mercadopago",
      kind,
      status: payload.action || type,
      gatewayPaymentId: kind === "payment" ? paymentId : undefined,
      gatewaySubscriptionId: kind === "subscription" ? payload.data?.id : undefined,
      raw: payload,
    };
  },
  // Reconciliacao: busca pagamentos aprovados dos ultimos `sinceDays` dias e devolve
  // so os do portal (external_reference "wo_..."). O repo aplica de forma idempotente,
  // entao reaplicar um pagamento ja baixado e no-op.
  async searchRecentApproved(sinceDays = 7) {
    if (!env.mercadopago.accessToken) return [];
    const end = new Date();
    const begin = new Date(end.getTime() - sinceDays * 24 * 60 * 60 * 1000);
    const url = new URL("https://api.mercadopago.com/v1/payments/search");
    url.searchParams.set("sort", "date_created");
    url.searchParams.set("criteria", "desc");
    url.searchParams.set("range", "date_created");
    url.searchParams.set("begin_date", begin.toISOString());
    url.searchParams.set("end_date", end.toISOString());
    url.searchParams.set("status", "approved");
    url.searchParams.set("limit", "100");
    type MpPayment = { id?: number | string; status?: string; external_reference?: string; transaction_amount?: number };
    let results: MpPayment[] = [];
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${env.mercadopago.accessToken}` } });
      if (!r.ok) {
        log.warn("mercadopago.search_falhou", { httpStatus: r.status });
        return [];
      }
      const data = (await r.json()) as { results?: MpPayment[] };
      results = data.results || [];
    } catch (e) {
      log.warn("mercadopago.search_erro", { erro: (e as Error).message });
      return [];
    }
    return results
      .filter((p) => (p.external_reference || "").startsWith("wo_"))
      .map((p) => ({
        provider: "mercadopago",
        kind: "payment" as const,
        status: p.status || "unknown",
        gatewayPaymentId: p.id != null ? String(p.id) : undefined,
        gatewaySubscriptionId: p.external_reference || undefined,
        amountCents: p.transaction_amount != null ? Math.round(p.transaction_amount * 100) : undefined,
        raw: p,
      }));
  },
  // Reembolso TOTAL via API do MP (POST /v1/payments/{id}/refunds, corpo vazio).
  // X-Idempotency-Key evita reembolso duplicado se a chamada for repetida.
  async refundPayment(gatewayPaymentId) {
    if (!env.mercadopago.accessToken) return { ok: false, detail: "Mercado Pago sem token configurado" };
    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${gatewayPaymentId}/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.mercadopago.accessToken}`,
          "X-Idempotency-Key": `refund-${gatewayPaymentId}`,
        },
        body: "{}",
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        log.error("mercadopago.refund_falhou", {
          httpStatus: res.status,
          detail: detail.slice(0, 300),
          paymentId: gatewayPaymentId,
        });
        return { ok: false, detail: `Mercado Pago retornou ${res.status}` };
      }
      log.info("mercadopago.refund_ok", { paymentId: gatewayPaymentId });
      return { ok: true };
    } catch (e) {
      log.error("mercadopago.refund_erro", { paymentId: gatewayPaymentId, erro: (e as Error).message });
      return { ok: false, detail: "Erro de rede ao reembolsar" };
    }
  },
};

/* ------------------------------------------------------------------ */
/* Asaas (cobranca recorrente nativa)                                  */
/* ------------------------------------------------------------------ */
const billingTypeAsaas: Record<string, string> = { pix: "PIX", cartao: "CREDIT_CARD", boleto: "BOLETO" };

const asaasGateway: PaymentGateway = {
  id: "asaas",
  async createSubscription(input) {
    if (!env.asaas.apiKey) throw new Error("ASAAS_API_KEY nao configurado.");
    const headers = { "Content-Type": "application/json", access_token: env.asaas.apiKey };

    const custRes = await fetch(`${env.asaas.baseUrl}/customers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.customer.name,
        email: input.customer.email,
        mobilePhone: input.customer.phone,
        cpfCnpj: input.customer.document,
      }),
    });
    if (!custRes.ok) throw new Error("Asaas: falha ao criar cliente (" + custRes.status + ")");
    const customer = (await custRes.json()) as { id: string };

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1);
    const subRes = await fetch(`${env.asaas.baseUrl}/subscriptions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customer.id,
        billingType: billingTypeAsaas[input.method] || "UNDEFINED",
        value: input.amount,
        nextDueDate: nextDue.toISOString().slice(0, 10),
        cycle: "MONTHLY",
        description: `WaveOps · Plano ${input.planName}`,
        externalReference: input.planId,
      }),
    });
    if (!subRes.ok) throw new Error("Asaas: falha ao criar assinatura (" + subRes.status + ")");
    const sub = (await subRes.json()) as { id: string };

    // primeira cobranca da assinatura -> link de pagamento (invoiceUrl)
    let checkoutUrl = new URL("/cliente", env.appUrl).toString();
    const payRes = await fetch(`${env.asaas.baseUrl}/subscriptions/${sub.id}/payments`, { headers });
    if (payRes.ok) {
      const pays = (await payRes.json()) as { data?: { invoiceUrl?: string }[] };
      checkoutUrl = pays.data?.[0]?.invoiceUrl || checkoutUrl;
    }
    return { provider: "asaas", checkoutUrl, gatewayCustomerId: customer.id, gatewaySubscriptionId: sub.id };
  },
  async verifyWebhook(req) {
    const expected = env.asaas.webhookToken;
    if (!expected) return !env.isProd;
    return timingSafeEqual(req.headers["asaas-access-token"] || "", expected);
  },
  async parseWebhook(req) {
    let payload: { event?: string; payment?: { id?: string; subscription?: string } } = {};
    try {
      payload = JSON.parse(req.rawBody);
    } catch {
      /* ignora */
    }
    const event = payload.event || "unknown";
    return {
      provider: "asaas",
      kind: event.startsWith("PAYMENT") ? "payment" : "subscription",
      status: event,
      gatewayPaymentId: payload.payment?.id,
      gatewaySubscriptionId: payload.payment?.subscription,
      raw: payload,
    };
  },
};

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function getGateway(): PaymentGateway {
  switch (env.paymentGateway) {
    case "mercadopago":
      return mercadoPagoGateway;
    case "asaas":
      return asaasGateway;
    default:
      return mockGateway;
  }
}
