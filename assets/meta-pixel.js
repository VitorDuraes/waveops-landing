/* WaveOps: Meta Pixel (Facebook/Instagram Ads).
   Movido para arquivo proprio para a CSP poder usar script-src 'self'
   (sem 'unsafe-inline'), igual ao analytics.js. Nao re-inline no HTML.

   Origens que precisam estar liberadas na CSP do index.html:
     script-src  https://connect.facebook.net
     img-src     https://www.facebook.com
     connect-src https://www.facebook.com

   Eventos custom (Lead, Contact) sao disparados pelo main.js via window.fbq. */
(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = !0;
  n.version = "2.0";
  n.queue = [];
  t = b.createElement(e);
  t.async = !0;
  t.src = v;
  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
})(
  window,
  document,
  "script",
  "https://connect.facebook.net/en_US/fbevents.js"
);

fbq("init", "2432999197227570");
fbq("track", "PageView");
