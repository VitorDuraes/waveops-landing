// @ts-check
/* WaveOps · entrada do site (Tarefa 13B), a decisão. Ver dev/site/README.md. */
/** @param {Window} janela */
function deveRodarChegada(janela) {
  try {
    if (janela.sessionStorage.getItem('waveops:chegada')) return false;
  } catch {
    return false;
  }
  // Aba nova aberta de um link do site: não herda a sessão.
  return janela.document.visibilityState === 'visible'
    && !janela.document.referrer.startsWith(janela.location.origin + '/')
    && !janela.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !janela.navigator.connection?.saveData;
}

(function (janela) {
  if (!deveRodarChegada(janela)) return;
  try {
    janela.sessionStorage.setItem('waveops:chegada', '1');
  } catch {
    return;
  }
  const raiz = janela.document.documentElement;
  raiz.dataset.chegada = 'ligada';
  import('./chegada-cena.js').catch(function () {
    raiz.dataset.chegada = 'feita';
  });
})(window);
