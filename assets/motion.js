/* WaveOps: preferências de movimento e progresso de leitura. */
(function () {
  'use strict';

  const root = document.documentElement;
  const storageKey = 'waveops:motion:paused';
  const preference = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let userPaused = false;
  try { userPaused = window.localStorage.getItem(storageKey) === 'true'; } catch (e) {}

  const isPaused = () => userPaused || Boolean(preference && preference.matches);

  function applyMotion() {
    const paused = isPaused();
    root.dataset.motion = paused ? 'paused' : 'running';

    const button = document.getElementById('motion-toggle');
    if (button) {
      const label = preference && preference.matches ? 'Movimento reduzido' : (paused ? 'Ativar animações' : 'Pausar animações');
      const labelElement = button.querySelector('.motion-label');
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', label);
      button.disabled = Boolean(preference && preference.matches);
      button.title = button.disabled ? 'As animações estão pausadas pela preferência de movimento do seu sistema.' : label;
      if (labelElement) labelElement.textContent = label;
    }

    document.querySelectorAll('svg.flow-wires').forEach((svg) => {
      const method = paused ? 'pauseAnimations' : 'unpauseAnimations';
      if (typeof svg[method] === 'function') {
        try { svg[method](); } catch (e) {}
      }
    });

    window.dispatchEvent(new CustomEvent('waveops:motion', { detail: { paused } }));
  }

  // O atributo fica disponível antes de main.js e scene.js inicializarem.
  applyMotion();

  const button = document.getElementById('motion-toggle');
  if (button) {
    button.addEventListener('click', () => {
      if (preference && preference.matches) return;
      userPaused = !userPaused;
      try { window.localStorage.setItem(storageKey, String(userPaused)); } catch (e) {}
      applyMotion();
    });
  }

  if (preference) {
    if (preference.addEventListener) preference.addEventListener('change', applyMotion);
    else if (preference.addListener) preference.addListener(applyMotion);
  }

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) {
      userPaused = event.key === storageKey && event.newValue === 'true';
      applyMotion();
    }
  });

  const progress = document.querySelector('.scroll-progress');
  if (progress) {
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const distance = root.scrollHeight - root.clientHeight;
      const value = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
      progress.style.transform = 'scaleX(' + value + ')';
    };
    const scheduleProgress = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', scheduleProgress);
    window.addEventListener('load', scheduleProgress, { once: true });
    if ('ResizeObserver' in window) new ResizeObserver(scheduleProgress).observe(document.body);
    updateProgress();
  }
})();
