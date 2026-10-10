import "server-only";
import { NextRequest, NextResponse, after } from "next/server";
import type { ResultadoDeValidacao } from "@/lib/leads";
import { CORPO_MAXIMO, receberFormulario, respostaDoPreflight, type Resposta, type TipoDeFormulario } from "@/lib/receber-formulario";
import { clientIp, rateLimit } from "./ratelimit";
import { idDoVisitante } from "./evento";
import { avisarTime, gravarLead } from "./leads";
import { env } from "./env";
import { log } from "./log";

// Liga a recepção dos formulários do site (src/lib/receber-formulario.ts, onde estão as
// decisões e os testes) ao Next: lê o corpo com teto, grava no Postgres, agenda o aviso
// para depois da resposta e converte a resposta.

function paraNext(r: Resposta): NextResponse {
  const res = r.corpo === null ? new NextResponse(null, { status: r.status }) : NextResponse.json(r.corpo, { status: r.status });
  for (const [nome, valor] of Object.entries(r.cabecalhos)) res.headers.set(nome, valor);
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
  return paraNext(respostaDoPreflight(req.headers.get("origin")));
}

export async function receberFormularioDoSite(req: NextRequest, tipo: TipoDeFormulario, validar: (corpo: unknown) => ResultadoDeValidacao): Promise<NextResponse> {
  const resposta = await receberFormulario(tipo, {
    origin: req.headers.get("origin"),
    ip: clientIp(req.headers),
    lerCorpo: () => lerCorpo(req),
    validar,
    permitir: rateLimit,
    gravar: (lead) => gravarLead(lead, idDoVisitante(req.headers)),
    aoGravar: (lead) =>
      after(() => avisarTime(lead).catch((e) => log.warn("lead.aviso_falhou", { motivo: e instanceof Error ? e.message : "desconhecido" }))),
    registrar: (nivel, evento, campos) => log[nivel](evento, campos),
    emProducao: env.isProd,
  });
  return paraNext(resposta);
}
