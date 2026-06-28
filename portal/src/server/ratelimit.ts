import "server-only";

// Rate limiter leve em memoria (janela deslizante). Suficiente para 1 instancia
// (caso do Railway no MVP). Para multi-instancia, trocar por Redis/Upstash.
// Nao substitui as defesas por requisicao (OTP com limite de tentativas + uso unico),
// e uma camada extra contra abuso (email bombing, brute-force por IP).
const hits = new Map<string, number[]>();

// Expurgo periodico: sem ele, cada chave nova (ex.: IP forjado) virava entrada
// permanente no Map e crescia ate exaurir a memoria. Varre no maximo a cada minuto
// e remove as chaves cujo ultimo acesso passou da janela maxima. [M5 do audit 2026-06-28]
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_MAX_AGE_MS = 15 * 60_000;
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [k, arr] of hits) {
    if (arr.length === 0 || now - arr[arr.length - 1] > SWEEP_MAX_AGE_MS) hits.delete(k);
  }
}

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false; // estourou o limite
  }
  arr.push(now);
  hits.set(key, arr);
  return true; // dentro do limite
}

// IP do cliente. Ordem de confianca: header dedicado da borda (Cloudflare CF-Connecting-IP
// quando estiver na frente, Railway x-real-ip) e, por ultimo, o ULTIMO valor de
// x-forwarded-for (adicionado pelo proxy mais proximo). NAO o primeiro valor de XFF, que
// o cliente forja a vontade para furar o rate limit por IP. [M5 do audit 2026-06-28]
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "desconhecido";
}
