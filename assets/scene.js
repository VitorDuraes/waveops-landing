/* Connected workflow panel. SVG paths are the source of truth for moving data. */
(function () {
  'use strict';

  const stage = document.querySelector('.workflow-stage');
  if (!stage) return;
  const root = document.documentElement;
  const status = stage.querySelector('[data-flow-status]');
  const nodes = [...stage.querySelectorAll('[data-node]')];
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const edges = [...stage.querySelectorAll('[data-edge]')].map((path, index) => ({
    path,
    packet: stage.querySelector('[data-packet="' + path.dataset.edge + '"]'),
    length: path.getTotalLength(),
    // Both sources arrive before qualification; outputs follow that step.
    start: [0.15, 0.6, 3.25, 3.7][index],
    duration: [2, 1.8, 1.85, 1.85][index]
  }));
  const cycle = 7.8;
  let clock = 0;
  let frame = 0;
  let previousTime = null;
  let visible = true;
  let phase = '';

  const paused = () => root.dataset.motion === 'paused' || preference.matches;
  const active = () => visible && !document.hidden && !paused();

  function setPhase(next) {
    if (phase === next) return;
    phase = next;
    stage.dataset.phase = next;
    nodes.forEach((node) => {
      const key = node.dataset.node;
      node.classList.toggle('is-active', (next === 'capture' && (key === 'whatsapp' || key === 'site')) || (next === 'deliver' && (key === 'crm' || key === 'followup')));
    });
  }

  function render(time) {
    edges.forEach((edge) => {
      const progress = (time - edge.start) / edge.duration;
      const traveling = progress > 0 && progress < 1;
      edge.packet.style.opacity = traveling ? String(Math.min(1, progress * 10, (1 - progress) * 10)) : '0';
      if (traveling) {
        const point = edge.path.getPointAtLength(progress * edge.length);
        edge.packet.setAttribute('cx', point.x.toFixed(2));
        edge.packet.setAttribute('cy', point.y.toFixed(2));
      }
      edge.path.style.strokeDashoffset = String(-time * 13);
      edge.path.style.opacity = traveling ? '.7' : '.32';
    });
    setPhase(time < 2.4 ? 'capture' : time < 3.25 ? 'qualify' : time < 5.55 ? 'deliver' : 'complete');
  }

  function tick(now) {
    frame = 0;
    if (!active()) return;
    const delta = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, .05);
    previousTime = now;
    clock = (clock + delta) % cycle;
    render(clock);
    frame = window.requestAnimationFrame(tick);
  }

  function sync() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    stage.dataset.suspended = String(!active());
    if (status) status.textContent = paused() ? 'pausado' : 'rodando';
    if (active()) frame = window.requestAnimationFrame(tick);
  }

  window.addEventListener('waveops:motion', sync);
  document.addEventListener('visibilitychange', sync);
  if (preference.addEventListener) preference.addEventListener('change', sync);
  else if (preference.addListener) preference.addListener(sync);

  if ('IntersectionObserver' in window) {
    visible = false;
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0 }).observe(stage);
  }

  // The graph is readable before JS and stays readable with reduced motion.
  // Paused initial state retains the illustrative points provided in the HTML.
  stage.classList.add('scene-ready');
  sync();
})();
