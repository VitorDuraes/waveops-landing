/* WaveOps: verificacao dos islands React do hero. Roda com node, sem navegador.
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
check('exporta os 4 simbolos usados pelos componentes', () => {
  // Validacao por texto: check() e sincrono, entao um callback async faria o
  // try/catch dele nunca ver a falha.
  const src = read('assets/vendor/framer-shim.mjs');
  for (const s of ['addPropertyControls', 'ControlType', 'RenderTarget', 'useIsStaticRenderer']) {
    assert.ok(new RegExp('export[^\\n]*\\b' + s + '\\b').test(src), 'falta export de ' + s);
  }
});
check('RenderTarget.current nao devolve o valor de canvas', () => {
  const src = read('assets/vendor/framer-shim.mjs');
  assert.ok(/current\s*\(\s*\)/.test(src), 'RenderTarget precisa do metodo current()');
  assert.ok(!/current\s*\(\s*\)\s*\{\s*return\s*['"]CANVAS/.test(src),
    'current() nao pode devolver CANVAS, senao o componente renderiza o placeholder estatico');
});

console.log('\n' + passed + ' verificacoes passaram');
