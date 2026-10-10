import "server-only";
import { NextRequest, NextResponse, after } from "next/server";
import { ORIGENS_DA_LANDING } from "@/lib/funil";
import { ehRoboDeFormulario, protocoloDe, type ResultadoDeValidacao } from "@/lib/leads";
import { clientIp, rateLimit } from "./ratelimit";
import { idDoVisitante } from "./evento";
import { avisarTime, gravarLead, type ResultadoDaGravacao } from "./leads";
import { log } from "./log";

// Recepção dos formulários do site novo (rotas /api/site/contato e /api/site/interesse).
// O site manda JSON de outra origem (waveops.com.br), então há preflight, e só lê `ok` e
// `campos` da resposta. Quatro decisões que parecem detalhe e não são:
//
// 1. CORS EM TODA RESPOSTA de origem permitida, inclusive 422, 429 e 503. Sem o
//    cabeçalho, o navegador esconde a resposta, o fetch rejeita e a tela mostra falha de
//    rede em vez de marcar o campo.
// 2. ORIGEM OBRIGATÓRIA. Diferente de /api/e, que trata origem ausente como o próprio
//    portal: aqui ninguém do portal envia, e o site sempre manda Origin.
// 3. NUNCA 2xx EM ERRO. Qualquer 2xx confirma para a pessoa ("Recebido"). Falha de banco
//    é 503, e a tela oferece tentar de novo e o WhatsApp, com os dados preservados.
// 4. ROBÔ RECEBE 200 sem gravar, antes da validação, para não aprender as regras.

const CORPO_MAXIMO = 16 * 1024;
const POR_MINUTO = 5;
const POR_HORA = 20;

type Tipo = "contato" | "interesse";

function origemPermitida(origin: string | null): origin is string {
  return !!origin && ORIGENS_DA_LANDING.includes(origin);
}

function responder(origin: string | null, status: number, corpo: Record<string, unknown>, extra: Record<string, string> = {}): NextResponse {
  const res = NextResponse.json(corpo, { status });
  res.headers.set("Cache-Control", "no-store");
  if (origemPermitida(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  for (const [nome, valor] of Object.entries(extra)) res.headers.set(nome, valor);
  return res;
}

// Lê o corpo com teto em bytes, sem carregar um corpo gigante inteiro na memória (o
// Content-Length pode faltar no envio em partes). null = passou do teto.
async function lerCorpo(req: NextRequest): Promise<string | null> {
  const declarado = Number(req.headers.get("content-length") || 0);
  if (declarado > CORPO_MAXIMO) return null;
  const leitor = req.body?.getReader();
  if (!leitor) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > CORPO_MAXIMO) {
      await leitor.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes).toString("utf8");
}

export function preflight(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 204 });
  if (origemPermitida(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "content-type");
    res.headers.set("Access-Control-Max-Age", "86400");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export async function receberFormulario(req: NextRequest, tipo: Tipo, validar: (corpo: unknown) => ResultadoDeValidacao): Promise<NextResponse> {
  const origin = req.headers.get("origin");
  if (!origemPermitida(origin)) return responder(null, 403, { ok: false, erro: "origem" });

  const texto = await lerCorpo(req).catch(() => null);
  if (texto === null) return responder(origin, 413, { ok: false, erro: "tamanho" });

  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return responder(origin, 422, { ok: false, erro: "validacao", campos: ["corpo"] });
  }

  if (ehRoboDeFormulario(corpo)) {
    log.info("lead.robo", { tipo });
    return responder(origin, 200, { ok: true, protocolo: protocoloDe(corpo) });
  }

  const resultado = validar(corpo);
  if (!resultado.ok) {
    log.info("lead.recusado", { tipo, campos: resultado.campos });
    return responder(origin, 422, { ok: false, erro: "validacao", campos: resultado.campos });
  }

  const ip = clientIp(req.headers);
  if (!rateLimit(`lead:${tipo}:min:${ip}`, POR_MINUTO, 60_000) || !rateLimit(`lead:${tipo}:hora:${ip}`, POR_HORA, 3_600_000)) {
    log.warn("lead.volume", { tipo });
    return responder(origin, 429, { ok: false, erro: "volume" }, { "Retry-After": "60" });
  }

  let gravacao: ResultadoDaGravacao;
  try {
    gravacao = await gravarLead(resultado.dados, idDoVisitante(req.headers));
  } catch (e) {
    log.error("lead.falha_gravacao", { tipo, motivo: e instanceof Error ? e.message.slice(0, 200) : "desconhecido" });
    return responder(origin, 503, { ok: false, erro: "indisponivel" });
  }

  // Gravar antes de responder; avisar depois. A falha do aviso não muda o 200.
  if (gravacao === "gravado") {
    const lead = resultado.dados;
    after(() => avisarTime(lead).catch((e) => log.warn("lead.aviso_falhou", { motivo: e instanceof Error ? e.message : "desconhecido" })));
  }
  log.info("lead.recebido", { tipo, gravacao });
  return responder(origin, 200, { ok: true, protocolo: resultado.dados.idEnvio });
}
