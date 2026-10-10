// @ts-check
/* De onde veio quem preenche o formulário. Com várias páginas, a UTM fica na URL só
   da primeira: o funil.js grava o primeiro toque da sessão em sessionStorage e os
   formulários leem daqui. Sem o registro (funil.js bloqueado, sessionStorage
   indisponível), calcula a partir da página atual, como o site antigo fazia. */

/** Chave escrita só pelo assets/funil.js. */
export const CHAVE_ORIGEM = 'waveops:origem:v1';

/**
 * @typedef {{ source: string, medium: string, campaign: string, term: string, content: string }} Utm
 * @typedef {{ fonte: string, landingUrl: string, referrer: string, utm: Utm }} Atribuicao
 */

const CAMPOS_UTM = /** @type {const} */ (['source', 'medium', 'campaign', 'term', 'content']);

/** @param {unknown} valor @param {number} maximo */
function texto(valor, maximo) {
  return typeof valor === 'string' ? valor.slice(0, maximo) : '';
}

/**
 * Atribuição calculada só com a página atual.
 * @param {{ href: string, search: string, hostname: string }} local
 * @param {string} referrer
 * @returns {Atribuicao}
 */
export function calcularAtribuicao(local, referrer) {
  const parametros = new URLSearchParams(local.search);
  /** @type {Utm} */
  const utm = { source: '', medium: '', campaign: '', term: '', content: '' };
  for (const campo of CAMPOS_UTM) utm[campo] = (parametros.get(`utm_${campo}`) ?? '').trim().slice(0, 120);
  let referrerExterno = '';
  let hostReferrer = '';
  try {
    hostReferrer = referrer ? new URL(referrer).hostname : '';
    if (hostReferrer && hostReferrer !== local.hostname) referrerExterno = referrer.slice(0, 500);
  } catch {
    referrerExterno = '';
  }
  const fonte = utm.source
    ? (utm.medium ? `${utm.source}/${utm.medium}` : utm.source).slice(0, 64)
    : referrerExterno
      ? hostReferrer.slice(0, 64)
      : 'direto';
  return { fonte, landingUrl: local.href.slice(0, 500), referrer: referrerExterno, utm };
}

/**
 * Primeiro toque da sessão, ou a atribuição da página atual quando não houver registro.
 * @param {{ href: string, search: string, hostname: string }} local
 * @param {string} referrer
 * @param {Pick<Storage, 'getItem'> | null | undefined} armazenamento
 * @returns {Atribuicao}
 */
export function lerAtribuicao(local, referrer, armazenamento) {
  try {
    const bruto = armazenamento?.getItem(CHAVE_ORIGEM);
    if (bruto) {
      const dados = JSON.parse(bruto);
      if (dados && typeof dados.fonte === 'string' && typeof dados.landingUrl === 'string') {
        const utmGravada = dados.utm && typeof dados.utm === 'object' ? dados.utm : {};
        /** @type {Utm} */
        const utm = { source: '', medium: '', campaign: '', term: '', content: '' };
        for (const campo of CAMPOS_UTM) utm[campo] = texto(utmGravada[campo], 120);
        return {
          fonte: texto(dados.fonte, 64) || 'direto',
          landingUrl: texto(dados.landingUrl, 500),
          referrer: texto(dados.referrer, 500),
          utm,
        };
      }
    }
  } catch {
    /* registro ilegível ou sessionStorage bloqueado: cai no cálculo da página */
  }
  return calcularAtribuicao(local, referrer);
}
