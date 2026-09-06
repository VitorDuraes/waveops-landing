/* Controller checks with a simulated DOM. Does not replace visual browser QA. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../assets/scene.js'), 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const ids = ['whatsapp', 'site', 'core', 'crm', 'followup'];
const routes = [...html.matchAll(/data-edge="([^"]+)" d="([^"]+)"/g)];
// Este arquivo so faz sentido com o painel 3D montado no index.html: o DOM simulado
// abaixo e construido a partir dos data-edge da pagina. O hero voltou para o painel
// plano e scene.js nao e mais carregado, entao aqui nao ha o que verificar.
if (!html.includes('data-edge=')) {
  console.log('SKIP: o painel 3D nao esta no index.html e scene.js nao e carregado pela pagina. Nada a verificar.');
  process.exit(0);
}
assert.equal(routes.length, 4);
assert.equal((html.match(/class="node-depth"/g) || []).length, 5);

function events() {
  const callbacks = {};
  return {
    addEventListener(name, fn) { (callbacks[name] ||= []).push(fn); },
    emit(name, payload = {}) { (callbacks[name] || []).forEach((fn) => fn(payload)); }
  };
}
function element(dataset = {}) {
  const classes = new Set();
  return {
    ...events(), dataset,
    style: { setProperty(key, value) { this[key] = value; } },
    attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    classList: {
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); },
      toggle(name, on) { on ? classes.add(name) : classes.delete(name); }
    }
  };
}
function boot({ reduced = false, initialPaused = false, observer = true } = {}) {
  const nodes = ids.map((node) => element({ node }));
  const packets = {};
  const edges = routes.map(([, key, d]) => {
    const values = d.match(/[-\d.]+/g).map(Number);
    assert.equal(values.length, 8, 'Cubic connector has four points');
    packets[key] = element();
    return {
      ...element({ edge: key }),
      getTotalLength() { return 200; },
      getPointAtLength(distance) {
        assert.ok(distance > 0 && distance < 200, 'Packets stay within their path');
        const t = distance / 200, u = 1 - t;
        return {
          x: u ** 3 * values[0] + 3 * u * u * t * values[2] + 3 * u * t * t * values[4] + t ** 3 * values[6],
          y: u ** 3 * values[1] + 3 * u * u * t * values[3] + 3 * u * t * t * values[5] + t ** 3 * values[7]
        };
      }
    };
  });
  const status = element();
  const stage = {
    ...element(),
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 520, height: 440 }),
    querySelector(selector) { return selector === '[data-flow-status]' ? status : packets[selector.match(/="([^"]+)"/)[1]]; },
    querySelectorAll(selector) { return selector === '[data-node]' ? nodes : edges; }
  };
  const preference = { ...events(), matches: reduced };
  const pointer = { ...events(), matches: true };
  const root = { dataset: { motion: initialPaused ? 'paused' : 'running' } };
  const document = { ...events(), hidden: false, documentElement: root, querySelector: () => stage };
  const frames = new Map();
  let frameId = 0, now = 0, observe;
  const window = {
    ...events(), matchMedia: (query) => query.includes('prefers-reduced-motion') ? preference : pointer,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  const IntersectionObserver = class {
    constructor(fn) { observe = fn; }
    observe() {}
  };
  if (observer) window.IntersectionObserver = IntersectionObserver;
  vm.runInNewContext(source, { window, document, IntersectionObserver });
  const advance = (count) => {
    for (let i = 0; i < count; i++) {
      now += 16;
      assert.ok(frames.size <= 1, 'Only one render loop');
      const pending = [...frames.values()]; frames.clear();
      pending.forEach((fn) => fn(now));
      for (const packet of Object.values(packets)) {
        for (const value of Object.values(packet.attributes)) assert.ok(Number.isFinite(Number(value)));
      }
    }
  };
  return { stage, status, nodes, packets, edges, preference, pointer, root, document, window, frames, advance,
    visible(on) { observe([{ isIntersecting: on }]); },
    pause(on) { root.dataset.motion = on ? 'paused' : 'running'; window.emit('waveops:motion', { detail: { paused: on } }); }
  };
}

const app = boot();
assert.equal(app.frames.size, 0, 'Wait for viewport visibility');
app.visible(true);
app.advance(70);
assert.equal(app.stage.dataset.phase, 'capture');
assert.ok(Number(app.packets.whatsapp.style.opacity) > 0);
assert.ok(Number(app.packets.site.style.opacity) > 0);
assert.equal(app.packets.crm.style.opacity, '0', 'Output waits for qualification');
app.advance(90);
assert.equal(app.stage.dataset.phase, 'qualify');
app.advance(100);
assert.equal(app.stage.dataset.phase, 'deliver');
assert.equal(app.packets.whatsapp.style.opacity, '0');
assert.ok(Number(app.packets.crm.style.opacity) > 0);
assert.ok(Number(app.packets.followup.style.opacity) > 0);
app.advance(110);
assert.equal(app.stage.dataset.phase, 'complete');
assert.ok(Object.values(app.packets).every((packet) => packet.style.opacity === '0'));

app.stage.emit('pointermove', { pointerType: 'mouse', clientX: 510, clientY: 10 });
app.advance(30);
assert.equal(app.stage.style['--panel-rx'], undefined, 'The workflow board stays frontal');
assert.equal(app.stage.style['--panel-ry'], undefined, 'Pointer movement does not tilt the board');
app.pause(true);
assert.equal(app.status.textContent, 'pausado');
assert.equal(app.frames.size, 0, 'Pause cancels rendering');
const stopped = JSON.stringify(app.packets);
app.advance(100);
assert.equal(JSON.stringify(app.packets), stopped, 'Paused packet positions stay fixed');
app.pause(false);
assert.equal(app.frames.size, 1);
app.visible(false);
assert.equal(app.frames.size, 0, 'Offscreen panel stops rendering');
assert.equal(app.stage.dataset.suspended, 'true');
app.visible(true);
app.document.hidden = true; app.document.emit('visibilitychange');
assert.equal(app.frames.size, 0, 'Hidden tab stops rendering');
app.document.hidden = false; app.document.emit('visibilitychange');
assert.equal(app.frames.size, 1);
app.preference.matches = true; app.preference.emit('change');
assert.equal(app.frames.size, 0, 'Live reduced-motion change stops rendering');
app.preference.matches = false; app.preference.emit('change');
for (let i = 0; i < 5; i++) app.window.emit('waveops:motion');
assert.equal(app.frames.size, 1, 'Repeated preference updates cannot duplicate loops');
app.advance(500);

for (const options of [{ reduced: true }, { initialPaused: true }]) {
  const paused = boot(options); paused.visible(true); paused.advance(50);
  assert.equal(paused.frames.size, 0, 'Initial reduced motion / user pause is respected');
  assert.ok(paused.stage.classList.contains('scene-ready'));
  assert.equal(paused.status.textContent, 'pausado');
}
const fallback = boot({ observer: false });
fallback.advance(70);
assert.equal(fallback.stage.dataset.phase, 'capture', 'Animation works without IntersectionObserver');
console.log('PASS: flow sequencing, finite positions, frontal board, pause/resume, reduced motion, hidden/offscreen suspension and one render loop. Visual rendering is not tested here.');

