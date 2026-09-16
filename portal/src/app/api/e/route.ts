import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/server/ratelimit";
import { idDoVisitante, registrarEvento } from "@/server/evento";
import { normalizarEvento, LIMITES } from "@/lib/funil";
import { ehRobo } from "@/lib/robo";

// Coleta de evento de funil (SPEC-18). Rota PUBLICA, chamada pela landing estatica
// (waveops.com.br, outra origem) e pelas telas do portal (mesma origem).
//
// Tres decisoes que parecem detalhe e nao sao:
//
// 1. RESPONDE 204 SEMPRE. Inclusive quando o corpo e invalido, quando o nome nao
//    existe e quando o rate limit estoura. Um endpoint publico que responde 400 ou
//    429 ensina o bot o que funciona. Este nao ensina nada, e o beacon do navegador
//    tambem nao tem o que fazer com um erro.
// 2. O CORPO CHEGA COMO text/plain. Com application/json o navegador dispara um
//    preflight OPTIONS entre origens, que dobra a ida e volta e simplesmente nao
//    acontece quando a pagina esta sendo descarregada: o evento se perderia. Com
//    text/plain a requisicao e "simples", sem preflight, e o sendBeacon funciona.
//    O conteudo continua sendo JSON.
// 3. NENHUM DADO PESSOAL ENTRA. O IP e usado para o hash do visitante e para o rate
//    limit, e nao e gravado. A sanitizacao de path, referrer e props vive em lib/funil.

const ORIGENS = ["https://waveops.com.br", "https://www.waveops.com.br"];

function vazio(origin: string | null): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  if (origin && ORIGENS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Sem Origin = mesma origem (as telas do portal). Com Origin, tem que ser a landing.
  if (origin && !ORIGENS.includes(origin)) return vazio(null);

  // Robo fora, antes de qualquer trabalho. Googlebot executa JavaScript, entao sem
  // isso ele entra no topo do funil como pessoa. Ver src/lib/robo.ts.
  if (ehRobo(req.headers.get("user-agent"))) return vazio(origin);

  // Corte por tamanho ANTES de ler o corpo, para um corpo gigante nao virar trabalho.
  const tamanho = Number(req.headers.get("content-length") || 0);
  if (tamanho > LIMITES.corpoBytes) return vazio(origin);

  if (!rateLimit(`evento:ip:${clientIp(req.headers)}`, 60, 60_000)) return vazio(origin);

  const texto = await req.text().catch(() => "");
  if (!texto || texto.length > LIMITES.corpoBytes) return vazio(origin);

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return vazio(origin);
  }

  const ev = normalizarEvento(bruto);
  if (!ev) return vazio(origin);

  await registrarEvento(ev, idDoVisitante(req.headers), origin ? "landing" : "portal");
  return vazio(origin);
}

// Nao deveria ser chamado (text/plain nao dispara preflight), mas se um navegador
// chamar, responde certo em vez de 405.
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = vazio(origin);
  if (origin && ORIGENS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "content-type");
    res.headers.set("Access-Control-Max-Age", "86400");
  }
  return res;
}
