// IP do cliente, para o limite de volume por IP e para o hash diário do visitante.
// Função pura (testada em tests/unit/ip-do-cliente.test.ts); quem lê o env é
// src/server/ratelimit.ts.
//
// Ordem de confiança:
// 1. CF-Connecting-IP, SÓ quando o Cloudflare está de fato na frente (env
//    CONFIAR_CF_CONNECTING_IP=true). Sem Cloudflare, esse cabeçalho chega como o cliente
//    mandou, e confiar nele dava um balde novo de limite a cada requisição forjada.
// 2. x-real-ip, posto pelo proxy do Railway.
// 3. O ÚLTIMO valor de x-forwarded-for, posto pelo proxy mais próximo. Nunca o primeiro,
//    que o cliente forja à vontade. [M5 do audit 2026-06-28; CF corrigido em 2026-10-10]
export function ipDoCliente(headers: Headers, confiarCloudflare: boolean): string {
  if (confiarCloudflare) {
    const cf = headers.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const partes = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return partes.length ? partes[partes.length - 1] : "desconhecido";
}
