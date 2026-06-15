/* WaveOps — Plausible bootstrap (SPEC-02).
   Movido para arquivo proprio para a CSP poder usar script-src 'self'
   (sem 'unsafe-inline'). O script externo plausible.io processa a fila. */
(function () {
  window.plausible =
    window.plausible ||
    function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
  window.plausible.init =
    window.plausible.init ||
    function (i) {
      window.plausible.o = i || {};
    };
  window.plausible.init();
})();
