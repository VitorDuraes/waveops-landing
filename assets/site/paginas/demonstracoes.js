// @ts-check
/* WaveOps · filtro por frente da página Demonstrações técnicas.

   Melhoria progressiva, nunca requisito: sem este arquivo os seis fluxos aparecem e o grupo
   de botões some (data-sem-js-oculto, regra no <noscript> do <head>).

   Marcação esperada:
     [data-filtro] > button[data-categoria][aria-pressed]
         "todas" mostra tudo. Qualquer outro valor mostra os fluxos que têm esse valor.
     [data-categorias]
         cada fluxo, com as frentes dele separadas por espaço (hoje uma só)
     [data-filtro-status]
         região viva (aria-live="polite") que diz quantos fluxos aparecem

   Nada é lembrado entre visitas e nada vai para a URL: o design não pede. */

/** Valor de data-categoria do botão que mostra todos os fluxos. */
export const TODAS = 'todas';

/**
 * Frentes de um fluxo: o valor de data-categorias, separado por espaço.
 * @param {HTMLElement} fluxo
 * @returns {string[]}
 */
export function categoriasDe(fluxo) {
  return (fluxo.dataset.categorias ?? '').split(/\s+/).filter(Boolean);
}

/**
 * Mostra os fluxos da frente escolhida e esconde os outros.
 * @param {HTMLElement[]} fluxos
 * @param {string} categoria valor de data-categoria do botão escolhido
 * @returns {number} quantos fluxos ficaram visíveis
 */
export function filtrarFluxos(fluxos, categoria) {
  let visiveis = 0;
  for (const fluxo of fluxos) {
    const mostrar = categoria === TODAS || categoriasDe(fluxo).includes(categoria);
    fluxo.hidden = !mostrar;
    if (mostrar) visiveis += 1;
  }
  return visiveis;
}

/**
 * Frase que a região viva lê depois de filtrar.
 * @param {number} visiveis fluxos que ficaram na tela
 * @param {number} total fluxos da página
 * @param {string} frente texto do botão escolhido
 * @param {boolean} todas true quando o botão escolhido mostra tudo
 * @returns {string}
 */
export function descreverResultado(visiveis, total, frente, todas) {
  if (visiveis === 0) return 'Nenhuma demonstração nesta frente.';
  const contagem = `Mostrando ${visiveis} de ${total} ${total === 1 ? 'demonstração' : 'demonstrações'}.`;
  return todas ? contagem : `${contagem} Frente: ${frente}.`;
}

/**
 * Liga os botões de [data-filtro] aos fluxos [data-categorias].
 * @param {ParentNode} raiz
 */
export function iniciarFiltro(raiz = document) {
  const grupo = raiz.querySelector('[data-filtro]');
  if (!grupo) return;
  const botoes = /** @type {HTMLButtonElement[]} */ ([...grupo.querySelectorAll('button[data-categoria]')]);
  const fluxos = /** @type {HTMLElement[]} */ ([...raiz.querySelectorAll('[data-categorias]')]);
  const status = raiz.querySelector('[data-filtro-status]');
  if (!botoes.length || !fluxos.length) return;

  /**
   * @param {HTMLButtonElement} escolhido
   * @param {boolean} anunciar false na carga da página, para o leitor de tela não falar sozinho
   */
  const escolher = (escolhido, anunciar) => {
    const categoria = escolhido.dataset.categoria ?? TODAS;
    for (const botao of botoes) botao.setAttribute('aria-pressed', String(botao === escolhido));
    const visiveis = filtrarFluxos(fluxos, categoria);
    if (anunciar && status) {
      const frente = escolhido.textContent?.trim() ?? '';
      status.textContent = descreverResultado(visiveis, fluxos.length, frente, categoria === TODAS);
    }
  };

  const inicial = botoes.find((botao) => botao.getAttribute('aria-pressed') === 'true') ?? botoes[0];
  escolher(inicial, false);
  grupo.setAttribute('data-pronto', '');
  for (const botao of botoes) botao.addEventListener('click', () => escolher(botao, true));
}

if (typeof document !== 'undefined') iniciarFiltro();
