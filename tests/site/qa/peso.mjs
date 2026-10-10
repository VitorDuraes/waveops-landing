// @ts-check
/* Tabela de peso por página (gzip nível 9): HTML, CSS e JavaScript próprios.
   Uso (da raiz do repo): node tests/site/qa/peso.mjs */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { lerPaginas, importsRelativos } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** @param {string} arquivo */
const gzip = (arquivo) => zlib.gzipSync(fs.readFileSync(arquivo), { level: 9 }).length;
/** @param {number} bytes */
const kb = (bytes) => (bytes / 1024).toFixed(1).replace('.', ',');

console.log('página | HTML | CSS | JS | arquivos JS');
for (const pagina of lerPaginas(raiz).paginas) {
  const abs = path.join(raiz, pagina.arquivo);
  if (!fs.existsSync(abs)) continue;
  const html = fs.readFileSync(abs, 'utf8');
  const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"?]+)/g)].map((m) => m[1]);
  const fila = [...html.matchAll(/<script[^>]+src="(\/assets\/[^"?]+)/g)].map((m) => m[1]);
  /** @type {Set<string>} */
  const js = new Set();
  while (fila.length) {
    const caminho = /** @type {string} */ (fila.shift());
    if (js.has(caminho)) continue;
    js.add(caminho);
    const arquivo = path.join(raiz, caminho);
    for (const esp of importsRelativos(fs.readFileSync(arquivo, 'utf8'))) {
      fila.push('/' + path.relative(raiz, path.resolve(path.dirname(arquivo), esp)).split(path.sep).join('/'));
    }
  }
  const pesoCss = css.reduce((s, c) => s + gzip(path.join(raiz, c)), 0);
  const pesoJs = [...js].reduce((s, j) => s + gzip(path.join(raiz, j)), 0);
  console.log(`${pagina.url} | ${kb(gzip(abs))} KB | ${kb(pesoCss)} KB | ${kb(pesoJs)} KB | ${js.size}`);
}
