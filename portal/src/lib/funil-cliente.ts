import type { NomeEvento } from "./funil";

// Disparo de evento de funil a partir do navegador, dentro do portal (SPEC-18).
// Equivalente ao assets/funil.js da landing, que e a mesma medicao vista do outro
// dominio. Aqui a chamada e sempre relativa: mesma origem, sem CORS.
//
// O tipo vem por `import type`, que o compilador apaga. Sem isso, importar
// lib/funil.ts (que usa node:crypto) puxaria modulo de servidor para o bundle.

export function enviarEvento(nome: NomeEvento, props?: Record<string, string>): void {
  try {
    const corpo = JSON.stringify({ n: nome, p: props, u: location.pathname });
    if (navigator.sendBeacon?.(new URL("/api/e", location.origin), new Blob([corpo], { type: "text/plain;charset=UTF-8" }))) {
      return;
    }
    void fetch("/api/e", {
      method: "POST",
      body: corpo,
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* medicao e melhoria, nunca requisito */
  }
}
