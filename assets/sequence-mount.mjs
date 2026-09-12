/* WaveOps: monta a sequência de quadros de "Como funciona" como island React.

   Mesmo espírito de assets/starfield-mount.mjs: a raspagem por scroll mora no
   ImageSequence portado (assets/image-sequence.mjs), a leitura de scroll mora
   no motion-lite.mjs, e o estado de movimento continua dono único do
   motion.js. Aqui só se conectam essas peças à seção #como, com carga
   preguiçosa de verdade e desligado abaixo de 768px.

   Cache-busting: o `?v=` do <script> do index.html não alcança os sub-imports
   relativos. A versão viaja também no import de ./image-sequence.mjs, no de
   ./motion-lite.mjs e no nome dos quadros de ./sequence/. Ao trocar os
   quadros ou este arquivo, suba a data aqui e no <script type="module"> do
   index.html. */

import { progressFromRect } from './motion-lite.mjs?v=20260910';

const VERSAO = '20260910b';
const TOTAL_QUADROS = 48;
const ID_SCROLL = 'como-sequence';
const ID_ALVO = 'como-sequence-target';

const secaoScroll = document.getElementById(ID_SCROLL);
const alvo = document.getElementById(ID_ALVO);

if (secaoScroll && alvo && 'IntersectionObserver' in window && window.matchMedia) {
  const desktop = window.matchMedia('(min-width: 768px)');

  // Atenção: isto vira `new Image().src` dentro do image-sequence.mjs, então
  // resolve contra a URL do documento (index.html na raiz), não contra a URL
  // deste módulo em assets/. Por isso o caminho leva o prefixo "assets/", ao
  // contrário dos especificadores de import acima.
  const quadros = Array.from({ length: TOTAL_QUADROS }, (_, indice) => {
    const numero = String(indice).padStart(3, '0');
    return {
      src: `assets/sequence/frame-${numero}.webp?v=${VERSAO}`,
      alt: `Fluxo WaveOps se montando, quadro ${indice + 1} de ${TOTAL_QUADROS}`,
    };
  });

  let pausado = document.documentElement.dataset.motion === 'paused';
  let raiz = null;
  let jsx = null;
  let ImageSequence = null;
  let montando = false;
  let observer = null;

  /** Quadro mais próximo da posição atual de scroll, para o estado congelado. */
  function quadroDoProgresso() {
    const progresso = progressFromRect(secaoScroll.getBoundingClientRect(), window.innerHeight);
    const indice = Math.round(progresso * (TOTAL_QUADROS - 1));
    return quadros[Math.min(TOTAL_QUADROS - 1, Math.max(0, indice))];
  }

  // Cabeçalho compacto que gruda junto com o painel: sem ele, o visitante
  // rola 1+ tela de diagrama sem uma palavra de texto. Reaproveita o eyebrow
  // e o h2 que já existem no cabeçalho da seção (#como), só compactados em
  // h3, nunca reescritos. aria-hidden porque é duplicata visual decorativa:
  // o eyebrow e o h2 originais acima já cobrem o texto para leitor de tela,
  // e o próprio contêiner (#como-sequence-target) já é aria-hidden="true".
  function cabecalhoGrudado() {
    return jsx('div', {
      className: 'sequence-caption',
      'aria-hidden': 'true',
      children: jsx('div', {
        className: 'sequence-caption-inner',
        children: [
          jsx('span', { className: 'eyebrow', children: 'Como funciona' }),
          jsx('h3', { children: 'Um caminho claro. Do diagnóstico à operação.' }),
        ],
      }),
    });
  }

  function pintar() {
    if (!raiz || !jsx) return;
    if (pausado) {
      // data-motion="paused" ou prefers-reduced-motion (motion.js já funde os
      // dois num estado só): sem raspagem por scroll, um quadro fixo.
      raiz.render(
        jsx('div', {
          className: 'sequence-stack',
          children: [
            cabecalhoGrudado(),
            jsx('div', {
              className: 'sequence-frozen',
              children: jsx('img', {
                src: quadroDoProgresso().src,
                alt: 'Fluxo WaveOps se montando, com as animações pausadas',
                decoding: 'async',
              }),
            }),
          ],
        })
      );
      return;
    }
    raiz.render(
      jsx('div', {
        className: 'sequence-stack',
        children: [
          cabecalhoGrudado(),
          jsx(ImageSequence, {
            images: quadros,
            scrollBehavior: 'scrollSection',
            sectionId: ID_SCROLL,
            fit: 'cover',
          }),
        ],
      })
    );
  }

  async function montar() {
    if (montando || raiz) return;
    montando = true;
    try {
      const [reactDom, jsxRuntime, imageSequenceModulo] = await Promise.all([
        import('./vendor/react-dom-client.mjs'),
        import('./vendor/jsx-runtime.mjs'),
        import(`./image-sequence.mjs?v=${VERSAO}`),
      ]);
      jsx = jsxRuntime.jsx;
      ImageSequence = imageSequenceModulo.default;
      raiz = reactDom.createRoot(alvo);
      pintar();
      if (observer) observer.disconnect();
    } catch (erro) {
      // Se o módulo falhar, a seção continua legível: os 6 passos de texto,
      // fora deste bloco, não dependem do island. Só avisa no console.
      console.warn('WaveOps: a sequência de imagens não pôde ser montada.', erro);
    } finally {
      montando = false;
    }
  }

  // Carga preguiçosa de verdade: só monta quando a seção se aproxima do
  // viewport, e só no desktop. rootMargin folgado para o download começar
  // um pouco antes de a seção entrar de fato na tela.
  observer = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting && desktop.matches) montar();
      });
    },
    { rootMargin: '600px 0px' }
  );
  observer.observe(secaoScroll);

  // Movimento: o motion.js continua sendo o dono único do estado.
  window.addEventListener('waveops:motion', (evento) => {
    pausado = Boolean(evento.detail && evento.detail.paused);
    pintar();
  });
}
