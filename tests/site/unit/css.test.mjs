// Guarda contra colisão de nome no CSS do site: a mesma classe definida duas vezes como
// regra base faz a segunda sobrescrever a primeira em silêncio (já aconteceu com .wo-entrada,
// que era cartão e campo de formulário ao mesmo tempo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const pastaSite = path.join(raiz, 'assets', 'site');

/** Seletores de regra de nível zero (fora de @media e @supports). */
function seletoresBase(css) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const seletores = [];
  let profundidade = 0;
  let inicio = 0;
  for (let i = 0; i < limpo.length; i += 1) {
    const c = limpo[i];
    if (c === '{') {
      const cabeca = limpo.slice(inicio, i).trim();
      if (profundidade === 0 && !cabeca.startsWith('@')) {
        for (const s of cabeca.split(',')) seletores.push(s.trim().replace(/\s+/g, ' '));
      }
      profundidade += 1;
      inicio = i + 1;
    } else if (c === '}') {
      profundidade -= 1;
      inicio = i + 1;
    } else if (c === ';' && profundidade === 0) {
      inicio = i + 1;
    }
  }
  return seletores;
}

function repetidos(lista) {
  const vistos = new Set();
  const dobrados = new Set();
  for (const s of lista) {
    if (vistos.has(s)) dobrados.add(s);
    vistos.add(s);
  }
  return [...dobrados];
}

const arquivosPagina = fs.existsSync(path.join(pastaSite, 'paginas'))
  ? fs.readdirSync(path.join(pastaSite, 'paginas')).filter((f) => f.endsWith('.css'))
  : [];
const componentes = seletoresBase(fs.readFileSync(path.join(pastaSite, 'components.css'), 'utf8'));

test('components.css não define o mesmo seletor base duas vezes', () => {
  assert.deepEqual(repetidos(componentes), []);
});

for (const arquivo of arquivosPagina) {
  test(`paginas/${arquivo} não repete seletor base nem redefine componente`, () => {
    const proprios = seletoresBase(fs.readFileSync(path.join(pastaSite, 'paginas', arquivo), 'utf8'));
    assert.deepEqual(repetidos(proprios), []);
    const doComponente = new Set(componentes);
    assert.deepEqual(proprios.filter((s) => doComponente.has(s)), []);
  });
}

test('o parser acha a colisão que motivou este teste', () => {
  const css = '.wo-a { padding: 1px } @media (max-width: 9px) { .wo-a { padding: 0 } } .wo-a { padding: 2px }';
  assert.deepEqual(repetidos(seletoresBase(css)), ['.wo-a']);
});
