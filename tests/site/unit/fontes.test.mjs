// Fontes do site (spec do novo visual, 5.2): Geist nos títulos e Inter no texto, as duas
// variáveis e auto-hospedadas. Só a Geist tem preload, porque desenha o título do hero.
// Hanken Grotesk e Space Mono saem das páginas; os arquivos delas ficam no repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerPaginas } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

test('todo url() de fonte em base.css existe em disco', () => {
  const caminhos = [...ler('assets/site/base.css').matchAll(/url\(\s*(['"]?)(\/assets\/fonts\/[^'")\s]+)\1\s*\)/g)].map((m) => m[2]);
  assert.ok(caminhos.length > 0, 'base.css não declara nenhuma fonte em /assets/fonts/');
  for (const caminho of caminhos) assert.ok(fs.existsSync(path.join(raiz, caminho)), `${caminho} não existe em disco`);
});

test('as famílias de @font-face em base.css são só Geist e Inter', () => {
  const css = ler('assets/site/base.css');
  const familias = [...css.matchAll(/@font-face\s*\{[^}]*?font-family:\s*['"]?([^;'"]+?)['"]?\s*;/g)].map((m) => m[1].trim());
  assert.deepEqual([...new Set(familias)].sort(), ['Geist', 'Inter']);
});

test('só a Geist tem preload de fonte no head', () => {
  const tags = [...ler('dev/site/parciais/head.html').matchAll(/<link\b[^>]*\brel="preload"[^>]*>/g)].map((m) => m[0]);
  const fontes = tags.filter((tag) => /\bas="font"/.test(tag)).map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1]);
  assert.deepEqual(fontes, ['/assets/fonts/geist-variavel-latin.woff2']);
});

test('nenhuma página cita Hanken Grotesk nem Space Mono', () => {
  for (const pagina of lerPaginas(raiz).paginas) {
    // Compara as linhas que citam, não o HTML inteiro: a falha mostra onde está a citação.
    const citacoes = ler(pagina.arquivo).split(/\r?\n/).map((linha) => linha.trim()).filter((linha) => /hanken|space[\s_-]?mono/i.test(linha));
    assert.deepEqual(citacoes, [], pagina.arquivo);
  }
});
