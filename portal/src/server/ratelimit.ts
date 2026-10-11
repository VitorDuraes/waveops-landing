import "server-only";
import { ipDoCliente } from "@/lib/ip-do-cliente";
import { criarLimitador } from "@/lib/limitador";

// Rate limiter leve em memoria (janela deslizante), um por processo. A regra, o expurgo
// por janela de cada chave e os testes estao em src/lib/limitador.ts.
// Nao substitui as defesas por requisicao (OTP com limite de tentativas + uso unico),
// e uma camada extra contra abuso (email bombing, brute-force por IP).
const limitador = criarLimitador();

// true = dentro do limite; false = estourou.
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  return limitador.permitir(key, max, windowMs);
}

// IP do cliente. A ordem de confiança e o porquê estão em src/lib/ip-do-cliente.ts:
// CF-Connecting-IP só vale com o Cloudflare declarado na frente, senão o cliente forja o
// cabeçalho e fura o limite por IP. [M5 do audit 2026-06-28; CF corrigido em 2026-10-10]
export function clientIp(headers: Headers): string {
  return ipDoCliente(headers, process.env.CONFIAR_CF_CONNECTING_IP === "true");
}
