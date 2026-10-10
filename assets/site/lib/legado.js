// @ts-check
/* Âncoras da página única antiga (até outubro de 2026). Elas vivem em anúncios,
   conversas de WhatsApp, favoritos e no portal. O servidor nunca recebe o que vem
   depois do #, então redirect do Netlify não alcança: a Home resolve no navegador.
   #prova era uma seção oculta de depoimentos e não tem destino. */

/** @type {Readonly<Record<string, string>>} */
const MAPA = Object.freeze({
  '#contato': '/contato/',
  '#pacotes': '/projetos-sob-medida/#modelos',
  '#servicos': '/solucoes/',
  '#casos': '/demonstracoes-tecnicas/',
  '#como': '/projetos-sob-medida/#como-trabalhamos',
  '#faq': '/projetos-sob-medida/#perguntas',
  '#publicos': '/solucoes/#publicos',
  '#operacao': '/plataforma/',
});

/**
 * Destino novo de uma âncora antiga, ou null quando não há o que redirecionar.
 * @param {string} hash valor de location.hash, com o #
 * @returns {string | null}
 */
export function destinoLegado(hash) {
  return Object.prototype.hasOwnProperty.call(MAPA, hash) ? MAPA[hash] : null;
}
