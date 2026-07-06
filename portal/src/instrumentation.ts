// OpenTelemetry do WaveOps Portal.
// Como o projeto usa pasta src/, o Next 15 procura ESTE arquivo em src/instrumentation.ts.
// - TRACES via @vercel/otel (auto-instrumenta fetch -> chamadas ao Mercado Pago viram spans).
// - LOGS via OTLP (nosso log.ts espelha cada linha; aparecem no Grafana Loki).
// Tudo so exporta quando as OTEL_* estao definidas; sem elas, roda igual em dev.
import { registerOTel } from "@vercel/otel";

export function register() {
  // Pula apenas o edge (OTLP precisa do runtime Node).
  if (process.env.NEXT_RUNTIME === "edge") return;
  const serviceName = process.env.OTEL_SERVICE_NAME || "waveops-portal";
  registerOTel({ serviceName });

  // Logs -> OTLP. So liga quando ha endpoint configurado (ex.: Grafana Cloud).
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    void initOtelLogs(serviceName);
  }
}

// Import dinamico para nao carregar o SDK de logs no edge nem quando OTLP esta off.
async function initOtelLogs(serviceName: string) {
  try {
    const { logs } = await import("@opentelemetry/api-logs");
    const { LoggerProvider, BatchLogRecordProcessor } = await import("@opentelemetry/sdk-logs");
    const { OTLPLogExporter } = await import("@opentelemetry/exporter-logs-otlp-http");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    // OTLPLogExporter le OTEL_EXPORTER_OTLP_ENDPOINT/HEADERS do ambiente (posta em /v1/logs).
    // OTel SDK 2.x: o resource vem de resourceFromAttributes() (a classe Resource saiu) e
    // os processors vao no construtor do LoggerProvider (addLogRecordProcessor saiu). Desde
    // o sdk-logs 0.220 o BatchLogRecordProcessor recebe um unico objeto de options com o
    // exporter dentro (antes era (exporter, config)). O flush a cada ~2s faz os logs
    // aparecerem quase em tempo real no Grafana. [Dependabot #16 e #28 / M6]
    const provider = new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": serviceName }),
      processors: [
        new BatchLogRecordProcessor({ exporter: new OTLPLogExporter(), scheduledDelayMillis: 2000 }),
      ],
    });
    logs.setGlobalLoggerProvider(provider);
    console.log("[otel] export de logs OTLP ligado para", serviceName);
  } catch (e) {
    console.error("[otel] init de logs falhou:", (e as Error).message);
  }
}
