/* WaveOps: monta o campo de partículas do hero como island React.

   Cola fina de propósito. A física mora em starfield.mjs, o estado de tema mora
   no FlowTheme e o estado de movimento mora no motion.js. Aqui só se conectam. */

import { createRoot } from './vendor/react-dom-client.mjs';
import { jsx } from './vendor/jsx-runtime.mjs';
// Cache-busting: o `?v=` do <script> do index.html não alcança os sub-imports
// relativos. Os módulos de ./vendor/ são versionados e imutáveis na prática,
// mas os nossos mudam. Então a versão vai também no especificador. Ao mexer no
// starfield.mjs ou no scroll-signal.mjs, suba a data aqui, no import do
// scroll-signal dentro do starfield.mjs e no <script> do index.html.
import HeroStarfield from './starfield.mjs?v=20260910';

const alvo = document.getElementById('hero-starfield');
if (alvo) {
  const raiz = createRoot(alvo);

  /** Lê as cores dos tokens CSS. Nunca hardcoded em JS. */
  function lerTokens() {
    const estilo = getComputedStyle(document.documentElement);
    const accent = estilo.getPropertyValue('--accent').trim();
    const border = estilo.getPropertyValue('--border').trim();
    return {
      dotColor: accent || '#7c3aed',
      dotColorLight: border || '#18181b',
      theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    };
  }

  let pausado = document.documentElement.dataset.motion === 'paused';

  function pintar() {
    raiz.render(
      jsx(HeroStarfield, {
        ...lerTokens(),
        paused: pausado,
        gap: 16,
        baseRadius: 1.1,
        influenceRadius: 110,
        pushStrength: 16,
        glowBoost: 0.38,
        scrollPush: 26,
        borderRadius: 0,
        shootingStarsEnabled: true,
        breatheEnabled: true,
        twinkleEnabled: true,
      })
    );
  }

  pintar();

  // Tema: o FlowTheme continua sendo a fonte única. Aqui só assinamos.
  if (window.FlowTheme && typeof window.FlowTheme.subscribe === 'function') {
    window.FlowTheme.subscribe(pintar);
  }

  // Movimento: o motion.js continua sendo o dono único do estado.
  window.addEventListener('waveops:motion', (evento) => {
    pausado = Boolean(evento.detail && evento.detail.paused);
    pintar();
  });
}
