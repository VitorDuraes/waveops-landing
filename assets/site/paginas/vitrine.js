// @ts-check
/* WaveOps · vitrine do hero da Home (adendo 1 da Tarefa 13A). As cinco mini interfaces estão no
   HTML ([data-vitrine], abas com aria-controls e aria-pressed, painel da vez com data-ativo); este
   módulo só troca qual aparece. Sem ele, fica a primeira frente e as abas somem (<noscript>).
   A troca automática é a animação CSS da barra da aba da vez (home.css): no fim, passa à próxima.
   A pausa é do CSS (botão do rodapé, ponteiro e foco); aqui ficam as abas e a aba oculta. */

/**
 * Liga as abas e a troca automática da vitrine.
 * @param {Document} doc
 */
export function iniciarVitrine(doc = document) {
  const vitrine = doc.querySelector('[data-vitrine]');
  if (!(vitrine instanceof HTMLElement)) return;
  const abas = /** @type {HTMLButtonElement[]} */ ([...vitrine.querySelectorAll('button[aria-controls]')]);
  const paineis = abas.map((aba) => doc.getElementById(aba.getAttribute('aria-controls') ?? ''));
  if (!abas.length || paineis.some((painel) => !painel)) return;
  let atual = Math.max(0, abas.findIndex((aba) => aba.getAttribute('aria-pressed') === 'true'));

  /** @param {number} indice */
  const mostrar = (indice) => {
    atual = (indice + abas.length) % abas.length;
    abas.forEach((aba, i) => aba.setAttribute('aria-pressed', String(i === atual)));
    paineis.forEach((painel, i) => painel?.toggleAttribute('data-ativo', i === atual));
  };

  // Escolher uma aba encerra a troca automática nesta visita da página (padrão de carrossel do APG).
  abas.forEach((aba, i) => aba.addEventListener('click', () => {
    vitrine.setAttribute('data-escolhida', '');
    mostrar(i);
  }));
  vitrine.addEventListener('animationend', (evento) => {
    if (evento.animationName === 'wo-vitrine-avanco') mostrar(atual + 1);
  });
  const conferirAba = () => vitrine.toggleAttribute('data-oculta', doc.visibilityState === 'hidden');
  doc.addEventListener('visibilitychange', conferirAba);
  conferirAba();
  mostrar(atual);
  vitrine.setAttribute('data-pronto', '');
}

if (typeof document !== 'undefined') iniciarVitrine();
