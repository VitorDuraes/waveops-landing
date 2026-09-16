/* WaveOps: medição própria de funil (SPEC-18). Manda evento para POST /api/e, no
   portal, que é onde estão o banco e as faturas. Substituiu o Plausible.

   Três regras que este arquivo não pode quebrar:
   1. Medição nunca derruba a página: tudo em try/catch, nada bloqueia.
   2. O corpo vai como text/plain de propósito. Com application/json o navegador
      dispara preflight entre origens, e preflight morre quando a página está sendo
      descarregada. O conteúdo continua sendo JSON.
   3. Não sai dado pessoal daqui. Só rótulo curto de opção fixa. */
(function () {
  'use strict';

  // No portal (e no dev local) a landing é servida na mesma origem do endpoint,
  // então a chamada é relativa e nem passa por CORS.
  var h = location.hostname;
  var mesma = h === 'localhost' || h === '127.0.0.1' || /(^|\.)portal\.waveops\.com\.br$/.test(h);
  var URL_EVENTO = mesma ? '/api/e' : 'https://portal.waveops.com.br/api/e';

  // Só o host, e nunca o próprio site. Tem try/catch próprio para um referrer
  // estranho não cancelar o evento inteiro.
  function refHost() {
    try {
      var r = document.referrer ? new URL(document.referrer).hostname : '';
      return r && r !== h ? r : undefined;
    } catch (e) {
      return undefined;
    }
  }

  /* De onde a pessoa veio. Precedência: UTM vence referrer, porque UTM é o que nós
     carimbamos no link e é o único que separa campanha de campanha. Sem os dois é
     "direto", que mistura URL digitada, favorito, app e e-mail: não dá para separar,
     e fingir que dá seria pior. */
  function fonte() {
    try {
      var p = new URLSearchParams(location.search);
      var src = (p.get('utm_source') || '').trim();
      if (src) {
        var med = (p.get('utm_medium') || '').trim();
        return (med ? src + '/' + med : src).slice(0, 64);
      }
      var r = refHost();
      return r ? r.slice(0, 64) : 'direto';
    } catch (e) {
      return 'direto';
    }
  }

  // Uma vez por carregamento: por evento, um clique depois de trocar de aba cairia
  // em "direto" e sujaria a atribuição.
  var FONTE = fonte();

  function enviar(nome, props) {
    try {
      var corpo = JSON.stringify({ n: nome, p: props || undefined, u: location.pathname, r: refHost(), f: FONTE });
      if (navigator.sendBeacon) {
        var blob = new Blob([corpo], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(URL_EVENTO, blob)) return;
      }
      // keepalive faz a requisição sobreviver à navegação.
      fetch(URL_EVENTO, {
        method: 'POST',
        body: corpo,
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
        mode: mesma ? 'same-origin' : 'cors',
      }).catch(function () {});
    } catch (e) {
      /* medição é melhoria, nunca requisito */
    }
  }

  window.WaveFunil = { enviar: enviar };
  enviar('visita');
})();
