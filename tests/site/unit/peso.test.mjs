// Orçamento de peso por página (spec do site v2, seção 3): JavaScript próprio até 15 KB
// gzip e CSS até 25 KB gzip, somando o que a página carrega, inclusive os imports dos
// módulos. Mede com gzip nível 9, como as medições anteriores do CLAUDE.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { lerPaginas, importsRelativos } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LIMITE_JS = 15 * 1024;
const LIMITE_CSS = 25 * 1024;

const gzip = (arquivo) => zlib.gzipSync(fs.readFileSync(arquivo), { level: 9 }).length;

/** Arquivos de /assets/ que a página carrega, seguindo os imports dos módulos. */
function carregados(html) {
  const css = new Set();
  const js = new Set();
  for (const [, caminho] of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"?]+)/g)) css.add(caminho);
  const fila = [...html.matchAll(/<script[^>]+src="(\/assets\/[^"?]+)/g)].map((m) => m[1]);
  while (fila.length) {
    const caminho = fila.shift();
    if (js.has(caminho)) continue;
    js.add(caminho);
    const abs = path.join(raiz, caminho);
    for (const esp of importsRelativos(fs.readFileSync(abs, 'utf8'))) {
      fila.push('/' + path.relative(raiz, path.resolve(path.dirname(abs), esp)).split(path.sep).join('/'));
    }
  }
  return { css: [...css], js: [...js] };
}

for (const pagina of lerPaginas(raiz).paginas) {
  const abs = path.join(raiz, pagina.arquivo);
  test(`${pagina.url} cabe no orçamento de peso`, { skip: !fs.existsSync(abs) && 'página ainda não existe' }, () => {
    const { css, js } = carregados(fs.readFileSync(abs, 'utf8'));
    const pesoCss = css.reduce((soma, c) => soma + gzip(path.join(raiz, c)), 0);
    const pesoJs = js.reduce((soma, j) => soma + gzip(path.join(raiz, j)), 0);
    assert.ok(pesoJs <= LIMITE_JS, `JS ${(pesoJs / 1024).toFixed(1)} KB gzip passa de 15 KB: ${js.join(', ')}`);
    assert.ok(pesoCss <= LIMITE_CSS, `CSS ${(pesoCss / 1024).toFixed(1)} KB gzip passa de 25 KB: ${css.join(', ')}`);
  });
}
