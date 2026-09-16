import "server-only";
import { getPrisma } from "./db";
import { env } from "./env";
import { log } from "./log";
import { clientIp } from "./ratelimit";
import { calcularId, diaUtc, type EventoNormalizado } from "@/lib/funil";

// Lado com efeito colateral da medicao de funil (SPEC-18). A regra pura (lista de
// eventos, sanitizacao, calculo do hash) vive em src/lib/funil.ts e e testada la.

// Id do visitante do dia. Usa clientIp(), que ja ignora o primeiro valor de
// x-forwarded-for (forjavel), e o SESSION_SECRET como sal, que nunca sai do servidor.
export function idDoVisitante(headers: Headers, agora: Date = new Date()): string {
  const ip = clientIp(headers);
  const ua = (headers.get("user-agent") || "desconhecido").slice(0, 256);
  return calcularId(diaUtc(agora), ip, ua, env.sessionSecret);
}

// Sem DATABASE_URL (modo mock/dev) vira log e pronto. Falha de banco tambem nao
// propaga: quem chama esta no caminho do usuario, e medicao quebrada nao pode
// derrubar checkout, pagamento nem landing.
export async function registrarEvento(
  ev: EventoNormalizado,
  visitorId: string,
  origem: "landing" | "portal"
): Promise<void> {
  if (!env.hasDb()) {
    log.info("evento.mock", { nome: ev.nome, origem });
    return;
  }
  try {
    await getPrisma().evento.create({
      data: {
        nome: ev.nome,
        visitorId,
        origem,
        path: ev.path,
        referrerHost: ev.referrerHost,
        props: ev.props ?? undefined,
      },
    });
  } catch (e) {
    log.warn("evento.falha", { nome: ev.nome, motivo: e instanceof Error ? e.message : "desconhecido" });
  }
}

// Evento de etapa que acontece LONGE do navegador do visitante: webhook de pagamento,
// job de reconciliacao. Nao ha header de quem visitou, entao o id vem do que foi
// gravado no cliente durante o checkout. Cliente sem visitorId (cadastro manual pelo
// admin, ou checkout anterior a SPEC-18) entra com um id namespaceado, para a etapa
// continuar sendo contada sem se misturar com visita de navegador.
export async function registrarPorCliente(
  nome: EventoNormalizado["nome"],
  customerId: string,
  props?: Record<string, string>
): Promise<void> {
  if (!env.hasDb()) {
    log.info("evento.mock", { nome, origem: "portal" });
    return;
  }
  try {
    const c = await getPrisma().customer.findUnique({ where: { id: customerId }, select: { visitorId: true } });
    await registrarEvento(
      { nome, path: null, referrerHost: null, props: props ?? null },
      c?.visitorId || `cliente:${customerId}`,
      "portal"
    );
  } catch (e) {
    log.warn("evento.falha", { nome, motivo: e instanceof Error ? e.message : "desconhecido" });
  }
}

// Atalho para quem dispara evento de dentro do servidor (rota de checkout, webhook
// de pagamento, ativacao de conta). Nunca lanca.
export async function registrarNoServidor(
  nome: EventoNormalizado["nome"],
  headers: Headers,
  props?: Record<string, string>,
  path?: string
): Promise<string> {
  const visitorId = idDoVisitante(headers);
  await registrarEvento({ nome, path: path ?? null, referrerHost: null, props: props ?? null }, visitorId, "portal");
  return visitorId;
}
