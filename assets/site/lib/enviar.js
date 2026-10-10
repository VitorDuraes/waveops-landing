// @ts-check
/* POST de JSON com tempo limite. Nunca lança: devolve o motivo da falha para a tela
   decidir o que mostrar. Quem pede envia uma vez; "Tentar de novo" reenvia o mesmo
   corpo (mesmo idEnvio), e o servidor deduplica. */

/** O site desiste depois disso e mostra o estado de falha, com os dados preservados. */
export const TEMPO_LIMITE_MS = 12000;

/**
 * @typedef {{
 *   ok: boolean,
 *   status: number,
 *   motivo?: 'timeout' | 'rede' | 'servidor' | 'validacao',
 *   campos?: string[],
 *   protocolo?: string,
 * }} ResultadoEnvio
 */

/**
 * @param {string} url
 * @param {unknown} corpo
 * @param {{ tempoLimiteMs?: number, fetchImpl?: typeof fetch }} [opcoes]
 * @returns {Promise<ResultadoEnvio>}
 */
export async function enviarJson(url, corpo, opcoes = {}) {
  const { tempoLimiteMs = TEMPO_LIMITE_MS, fetchImpl = globalThis.fetch } = opcoes;
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), tempoLimiteMs);
  try {
    const resposta = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      credentials: 'omit',
      signal: controle.signal,
    });
    /** @type {Record<string, unknown>} */
    let dados = {};
    try {
      const lido = await resposta.json();
      if (lido && typeof lido === 'object') dados = /** @type {Record<string, unknown>} */ (lido);
    } catch {
      /* corpo vazio ou não JSON: o workflow atual pode responder assim */
    }
    if (resposta.ok && dados.ok !== false) {
      return { ok: true, status: resposta.status, protocolo: typeof dados.protocolo === 'string' ? dados.protocolo : undefined };
    }
    if (resposta.status === 400 || resposta.status === 422) {
      const campos = Array.isArray(dados.campos) ? dados.campos.filter((c) => typeof c === 'string') : [];
      return { ok: false, status: resposta.status, motivo: 'validacao', campos };
    }
    return { ok: false, status: resposta.status, motivo: 'servidor' };
  } catch {
    return { ok: false, status: 0, motivo: controle.signal.aborted ? 'timeout' : 'rede' };
  } finally {
    clearTimeout(relogio);
  }
}

/** Identificador do envio. crypto.randomUUID existe em todo navegador atual com HTTPS. */
export function novoIdEnvio() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
