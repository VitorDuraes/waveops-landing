/* WaveOps: medição própria de funil (SPEC-18). Manda evento para POST /api/e, no
   portal, que é onde estão o banco e as faturas. Substituiu o Plausible.

   Quatro regras que este arquivo não pode quebrar:
   1. Medição nunca derruba a página: tudo em try/catch, nada bloqueia.
   2. O corpo vai como text/plain de propósito. Com application/json o navegador
      dispara preflight entre origens, e preflight morre quando a página está sendo
      descarregada. O conteúdo continua sendo JSON.
   3. Não sai dado pessoal daqui. Só rótulo curto de opção fixa.
   4. Atribuição por sessão (site de várias páginas, 10/2026). A UTM só existe na URL
      da primeira página: o primeiro toque fica em sessionStorage["waveops:origem:v1"]
      e vale para todos os eventos da sessão, e "visita" sai uma vez por sessão (de
      novo só se chegar outra campanha). Os formulários leem o mesmo registro para
      mandar UTM junto com o lead (assets/site/lib/atribuicao.js). Se o
      sessionStorage falhar, volta ao comportamento antigo: fonte por carregamento. */
(function () {
  'use strict';

  var CHAVE_ORIGEM = 'waveops:origem:v1';
  var CHAVE_VISITA = 'waveops:visita:v1';

  // No portal (e no dev local) a landing é servida na mesma origem do endpoint,
  // então a chamada é relativa e nem passa por CORS.
  var h = location.hostname;
  var mesma = h === 'localhost' || h === '127.0.0.1' || /(^|\.)portal\.waveops\.com\.br$/.test(h);
  var URL_EVENTO = mesma ? '/api/e' : 'https://portal.waveops.com.br/api/e';

  /* Interno: o próprio site e qualquer *.waveops.com.br (o portal). Quem volta do
     checkout não é chegada nova e não pode reescrever o primeiro toque. */
  /** @param {string} host */
  function interno(host) {
    return host === h || host === 'waveops.com.br' || /\.waveops\.com\.br$/.test(host);
  }

  /** Host do referrer, interno ou não; vazio se não houver ou for ilegível. */
  function hostDoReferrer() {
    try {
      return document.referrer ? new URL(document.referrer).hostname : '';
    } catch (e) {
      return '';
    }
  }

  // Só o host, e nunca o próprio site nem o portal. Tem try/catch próprio para um
  // referrer estranho não cancelar o evento inteiro.
  function refHost() {
    var r = hostDoReferrer();
    return r && !interno(r) ? r : undefined;
  }

  /** @param {string} busca location.search ou a query de outra URL */
  function lerUtm(busca) {
    var p = new URLSearchParams(busca);
    /** @param {string} k */
    var g = function (k) {
      return (p.get(k) || '').trim().slice(0, 120);
    };
    return { source: g('utm_source'), medium: g('utm_medium'), campaign: g('utm_campaign'), term: g('utm_term'), content: g('utm_content') };
  }

  /** @param {{ source: string, medium: string }} utm */
  function fonteDaUtm(utm) {
    return (utm.medium ? utm.source + '/' + utm.medium : utm.source).slice(0, 64);
  }

  /* De onde a pessoa veio NESTE carregamento. Precedência: UTM vence referrer, porque
     UTM é o que nós carimbamos no link e é o único que separa campanha de campanha.
     Sem os dois, null: pode ser navegação interna, recarga ou entrada direta, e quem
     decide é o registro da sessão. */
  function chegada() {
    try {
      var utm = lerUtm(location.search);
      var r = refHost();
      if (!utm.source && !r) return null;
      var fonte = utm.source ? fonteDaUtm(utm) : String(r);
      return {
        fonte: fonte.slice(0, 64),
        landingUrl: String(location.href).slice(0, 500),
        referrer: r ? String(document.referrer).slice(0, 500) : '',
        utm: utm,
      };
    } catch (e) {
      return null;
    }
  }

  function direta() {
    return {
      fonte: 'direto',
      landingUrl: String(location.href).slice(0, 500),
      referrer: '',
      utm: { source: '', medium: '', campaign: '', term: '', content: '' },
    };
  }

  /* Sem registro na aba e com referrer interno: é aba nova aberta de outra página do
     site (o sessionStorage é por aba) ou volta do portal. Não é chegada nova, então não
     conta visita; a UTM, se houver, vem da URL de onde a pessoa saiu. */
  function herdadaDoReferrer() {
    var utm = { source: '', medium: '', campaign: '', term: '', content: '' };
    try {
      if (hostDoReferrer() === h) utm = lerUtm(new URL(document.referrer).search);
    } catch (e) {
      /* referrer ilegível: fica sem UTM */
    }
    return {
      fonte: utm.source ? fonteDaUtm(utm) : 'direto',
      landingUrl: hostDoReferrer() === h ? String(document.referrer).slice(0, 500) : String(location.href).slice(0, 500),
      referrer: '',
      utm: utm,
    };
  }

  var FONTE = 'direto';
  var mandarVisita = true;
  try {
    var atual = chegada();
    var bruto = sessionStorage.getItem(CHAVE_ORIGEM);
    var gravado = bruto ? JSON.parse(bruto) : null;
    if (gravado && typeof gravado.fonte !== 'string') gravado = null;
    var refInterno = !atual && !gravado && hostDoReferrer() !== '' && interno(hostDoReferrer());
    var registro = atual || gravado || (refInterno ? herdadaDoReferrer() : direta());
    if (atual || !gravado) {
      registro.em = new Date().toISOString();
      sessionStorage.setItem(CHAVE_ORIGEM, JSON.stringify(registro));
    }
    FONTE = String(registro.fonte).slice(0, 64);
    if (refInterno) {
      // A aba de origem já contou a visita: marca como enviada e não manda de novo.
      sessionStorage.setItem(CHAVE_VISITA, FONTE);
      mandarVisita = false;
    } else {
      mandarVisita = sessionStorage.getItem(CHAVE_VISITA) !== FONTE;
      if (mandarVisita) sessionStorage.setItem(CHAVE_VISITA, FONTE);
    }
  } catch (e) {
    // sessionStorage bloqueado (Safari privado, política do navegador): fonte por carregamento.
    var porCarga = chegada();
    FONTE = porCarga ? porCarga.fonte : 'direto';
    mandarVisita = true;
  }

  /**
   * @param {string} nome evento da lista fechada de portal/src/lib/funil.ts
   * @param {Record<string, string | number | boolean>} [props] até 5 rótulos curtos, nunca dado pessoal
   */
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
  if (mandarVisita) enviar('visita');
})();
