import "server-only";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { env } from "./env";

const OTEL_SEV: Record<Level, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

// Logger estruturado (JSON) do servidor. Objetivo: logs consultaveis e prontos
// para OpenTelemetry. Cada linha e um JSON com ts, level, msg e campos extras.
// Quando o OTel for ligado (instrumentation.ts no deploy), estes campos viram
// atributos de log/trace e a correlacao (ex.: ref "wo_...") liga checkout, webhook
// e baixa da fatura numa transacao so.
//
// LGPD: nunca logar token, cartao, CVV ou segredo. E-mail, telefone e documento
// sao mascarados. A funcao redact() faz isso por nome de campo.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

// Campos cujo VALOR nunca deve aparecer no log (mascarado por completo).
const SECRET_KEY = /token|secret|authorization|password|senha|cartao|card|cvv|cvc|apikey|api_key/i;
// Campos que sao PII e entram parcialmente mascarados.
const EMAIL_KEY = /email|e-mail/i;
const PHONE_KEY = /phone|telefone|whatsapp|celular/i;
const DOC_KEY = /document|documento|cpf|cnpj/i;

// Exportadas para mascarar PII tambem nos canais que nao passam pelo logger
// (alertas no Discord, etc.), nao so nos logs estruturados. [M2 do audit 2026-06-28]
export function maskEmail(v: string): string {
  const [user, domain] = v.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}
export function maskTail(v: string, keep = 4): string {
  const digits = v.replace(/\D/g, "");
  if (digits.length <= keep) return "***";
  return `***${digits.slice(-keep)}`;
}

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) {
      out[k] = v;
    } else if (SECRET_KEY.test(k)) {
      out[k] = "[redacted]";
    } else if (typeof v === "string" && EMAIL_KEY.test(k)) {
      out[k] = maskEmail(v);
    } else if (typeof v === "string" && (PHONE_KEY.test(k) || DOC_KEY.test(k))) {
      out[k] = maskTail(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, msg: string, fields?: Fields): void {
  const safe = fields ? redact(fields) : {};
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  // Espelha para o OTel: vira log no Grafana Loki quando o OTLP esta ligado;
  // noop (NoopLogger) quando nao ha LoggerProvider, entao e seguro em dev.
  try {
    logs.getLogger("waveops-portal").emit({
      severityNumber: OTEL_SEV[level],
      severityText: level.toUpperCase(),
      body: msg,
      attributes: safe as Record<string, string>,
    });
  } catch {
    /* nunca deixa o log derrubar a request */
  }
}

export const log = {
  // debug so fora de producao (evita ruido e custo de ingestao em prod).
  debug: (msg: string, fields?: Fields) => {
    if (!env.isProd) emit("debug", msg, fields);
  },
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
