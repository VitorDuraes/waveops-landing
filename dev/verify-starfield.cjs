/* WaveOps: verificação dos islands React do hero. Roda com node, sem navegador.
   Uso: node dev/verify-starfield.cjs */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
const check = (nome, fn) => {
  try { fn(); passed += 1; console.log('  ok   ' + nome); }
  catch (e) { console.error('  FAIL ' + nome + ': ' + e.message); process.exitCode = 1; }
};

console.log('shim do pacote framer');
check('exporta os 4 símbolos usados pelos componentes', () => {
  // Validação por texto: check() é síncrono, então um callback async faria o
  // try/catch dele nunca ver a falha.
  const src = read('assets/vendor/framer-shim.mjs');
  for (const s of ['addPropertyControls', 'ControlType', 'RenderTarget', 'useIsStaticRenderer']) {
    assert.ok(new RegExp('export[^\\n]*\\b' + s + '\\b').test(src), 'falta export de ' + s);
  }
});
check('RenderTarget.current não devolve o valor de canvas', () => {
  const src = read('assets/vendor/framer-shim.mjs');
  assert.ok(/current\s*\(\s*\)/.test(src), 'RenderTarget precisa do metodo current()');
  assert.ok(!/current\s*\(\s*\)\s*\{\s*return\s*['"]CANVAS/.test(src),
    'current() não pode devolver CANVAS, senão o componente renderiza o placeholder estático');
});

console.log('\nsinal de scroll');
(async () => {
  const { createScrollSignal } = await import('../assets/scroll-signal.mjs');

  check('em repouso a energia é zero', () => {
    const s = createScrollSignal({ getY: () => 0 });
    s.sample(); s.sample();
    assert.strictEqual(s.energy, 0);
  });

  check('scroll para baixo gera energia positiva e direção 1', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 400; s.sample();
    assert.ok(s.energy > 0.5, 'energia ficou ' + s.energy);
    assert.strictEqual(s.direction, 1);
  });

  check('scroll para cima gera direção -1', () => {
    let y = 400;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 0; s.sample();
    assert.ok(s.energy > 0.5);
    assert.strictEqual(s.direction, -1);
  });

  check('energia satura em 1', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 999999; s.sample();
    assert.ok(s.energy <= 1, 'energia passou de 1: ' + s.energy);
  });

  check('energia decai até zerar quando o scroll para', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 400; s.sample();
    for (let i = 0; i < 200; i++) s.sample();
    assert.ok(s.energy < 0.01, 'energia não decaiu: ' + s.energy);
  });

  console.log('\nporte do starfield');
  check('nenhum specifier bare sobrou', () => {
    const src = read('assets/starfield.mjs');
    const bare = [...src.matchAll(/from\s*"([^".][^"]*)"/g)]
      .map((m) => m[1])
      .filter((s) => !s.startsWith('.') && !s.startsWith('/'));
    assert.deepStrictEqual(bare, [], 'sobrou specifier bare: ' + bare.join(', '));
  });
  check('canvas é transparente, não pinta fundo opaco', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(!/fillRect\(0,0,s\.W,s\.H\)/.test(src), 'ainda pinta fundo opaco com fillRect');
    assert.ok(/clearRect\(0,0,s\.W,s\.H\)/.test(src), 'falta o clearRect');
  });
  check('respeita a pausa de movimento', () => {
    assert.ok(/if\s*\(\s*paused\s*\)/.test(read('assets/starfield.mjs')), 'falta o guard de paused');
  });
  check('consome o sinal de scroll', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/createScrollSignal/.test(src), 'não importa createScrollSignal');
    assert.ok(/scroll\.sample\(\)/.test(src), 'não amostra o scroll no loop');
  });
  check('mantem o perfil de performance por device', () => {
    const src = read('assets/starfield.mjs');
    assert.ok(/getDeviceProfile/.test(src), 'o porte removeu o getDeviceProfile');
    assert.ok(/1500/.test(src), 'perdeu o teto de 1500 pontos do mobile');
    assert.ok(/quantAlpha/.test(src), 'perdeu a quantização de alpha, que segura o custo por frame');
    assert.ok(/spatialGrid/.test(src), 'perdeu o hash espacial da interação de mouse');
  });

  console.log('\n' + passed + ' verificações passaram');
})();
