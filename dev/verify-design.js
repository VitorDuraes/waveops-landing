/* Run against the local landing using agent-browser eval --stdin. No lead is sent. */
(async function () {
  const results = [];
  const check = (name, value) => results.push({ name, pass: Boolean(value) });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const root = document.documentElement;
  const button = document.getElementById('motion-toggle');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('.workflow-stage');

  check('No horizontal page overflow', root.scrollWidth <= window.innerWidth);
  check('One primary heading', document.querySelectorAll('h1').length === 1);
  check('All eight integration labels remain', document.querySelectorAll('.logos .chip').length === 8);
  check('Internal anchors have destinations', [...document.querySelectorAll('a[href^="#"]')].every((a) => document.getElementById(a.hash.slice(1))));
  check('Workflow controller initialized', stage.classList.contains('scene-ready'));
  check('Cards have dimensional faces', stage.querySelectorAll('.node-depth').length === 5);

  const originallyPaused = root.dataset.motion === 'paused';
  if (!originallyPaused) button.click();
  check('Pause exposes its state', root.dataset.motion === 'paused' && button.getAttribute('aria-pressed') === 'true');
  await wait(80);
  check('CSS motion stops', document.getAnimations().every((animation) => animation.playState !== 'running'));

  // The confirmation must remain visible when animation is paused. This only
  // exposes the existing confirmation UI temporarily, without submitting data.
  const success = document.getElementById('form-success');
  success.classList.add('show');
  check('Form confirmation remains visible while paused', getComputedStyle(success).display !== 'none' && getComputedStyle(success).opacity === '1');
  success.classList.remove('show');
  check('Paused content remains readable', [...document.querySelectorAll('.reveal')].filter((el) => !el.closest('[hidden]')).every((el) => getComputedStyle(el).opacity === '1'));

  if (!preference.matches) {
    button.click();
    check('Resume works', root.dataset.motion === 'running' && button.getAttribute('aria-pressed') === 'false');
  } else {
    check('System reduced motion is respected', button.disabled && root.dataset.motion === 'paused');
  }

  const faq = document.querySelector('.faq-q');
  faq.click();
  check('FAQ opens', faq.getAttribute('aria-expanded') === 'true');
  faq.click();
  check('FAQ closes', faq.getAttribute('aria-expanded') === 'false');

  check('Commercial values stay private', !/R\$|\bBRL\b/.test(document.body.innerText));
  check('Proposal CTA opens WhatsApp', Boolean(document.querySelector('#pacotes a[href^="https://wa.me/"]')));
  check('Workflow has five nodes', document.querySelectorAll('[data-node]').length === 5);
  check('Workflow has four connections', stage.querySelectorAll('[data-edge]').length === 4);

  const menu = document.getElementById('hamburger');
  if (getComputedStyle(menu).display !== 'none') {
    menu.click();
    check('Mobile menu opens', menu.getAttribute('aria-expanded') === 'true' && document.getElementById('mobile-menu').getAttribute('aria-hidden') === 'false');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    check('Mobile menu closes with Escape', menu.getAttribute('aria-expanded') === 'false');
  }

  if (originallyPaused && !preference.matches) button.click();
  return { viewport: [innerWidth, innerHeight], theme: root.dataset.theme, reducedMotion: preference.matches, results, failed: results.filter((result) => !result.pass).length };
})();
