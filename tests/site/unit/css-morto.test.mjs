import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerPaginas } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const arquivos = (rel, extensao) => fs.readdirSync(path.join(raiz, rel), { recursive: true })
  .map(String).filter((nome) => nome.endsWith(extensao)).map((nome) => `${rel}/${nome.replaceAll('\\', '/')}`);

test('toda classe de componente ou página tem consumidor real', () => {
  const folhas = ['assets/site/components.css', ...arquivos('assets/site/paginas', '.css')];
  const fontes = [...lerPaginas(raiz).paginas.map((p) => p.arquivo),
    ...arquivos('dev/site/parciais', '.html'), 'dev/site/og.html', ...arquivos('assets/site', '.js')];
  const consumidores = fontes.map(ler).join('\n').replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
  const semUso = [];
  for (const folha of folhas) {
    const css = ler(folha).replace(/\/\*[\s\S]*?\*\//g, '');
    const seletores = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1]).join('\n');
    for (const nome of new Set([...seletores.matchAll(/\.(wo-[a-zA-Z0-9_-]+)/g)].map((m) => m[1]))) {
      if (!new RegExp(`(?<![\\w-])${nome}(?![\\w-])`).test(consumidores)) semUso.push(`${folha}: ${nome}`);
    }
  }
  assert.deepEqual(semUso, []);
});

test('variáveis sem reserva têm definição em tokens ou na própria folha', () => {
  const tokens = ler('assets/site/tokens.css');
  const ausentes = [];
  for (const folha of arquivos('assets/site', '.css')) {
    const css = ler(folha).replace(/\/\*[\s\S]*?\*\//g, '');
    const definicoes = new Set([...`${tokens}\n${css}`.matchAll(/(--wo-[\w-]+)\s*:/g)].map((m) => m[1]));
    for (const nome of new Set([...css.matchAll(/var\(\s*(--wo-[\w-]+)\s*\)/g)].map((m) => m[1]))) {
      if (!definicoes.has(nome)) ausentes.push(`${folha}: ${nome}`);
    }
  }
  assert.deepEqual(ausentes, []);
});

test('tokens não conservam o bloco Legado nem o alias mono', () => {
  const tokens = ler('assets/site/tokens.css');
  assert.doesNotMatch(tokens, /\/\*\s*Legado\b|--wo-mono\b/);
});
