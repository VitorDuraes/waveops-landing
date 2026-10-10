// O que vai ao ar é só o que o cp do netlify.toml copia, e só há deploy quando o
// ignore enxerga a mudança. Estes testes amarram as duas listas a dev/site/paginas.json
// e conferem sitemap, robots e llms.txt contra as páginas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerNetlify, lerPaginas } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const netlify = lerNetlify(ler('netlify.toml'));
const { dominio, paginas } = lerPaginas(raiz);
const PROIBIDOS = ['api', 'admin', 'cliente', 'checkout', 'termos', 'privacidade'];

/** Pasta de primeiro nível de uma página (`solucoes/index.html` vira `solucoes`), ou o arquivo da raiz. */
const publicado = (arquivo) => (arquivo.includes('/') ? arquivo.split('/')[0] : arquivo);

test('toda página de paginas.json é copiada pelo build do Netlify', () => {
  for (const p of paginas) {
    const alvo = publicado(p.arquivo);
    const copiado = p.arquivo.includes('/') ? netlify.pastas.includes(alvo) : netlify.arquivos.includes(alvo);
    assert.ok(copiado, `${p.arquivo} não está no cp do netlify.toml`);
  }
});

test('toda página e todo arquivo publicado estão no ignore (senão o commit não dispara deploy)', () => {
  for (const item of [...netlify.arquivos, ...netlify.pastas]) {
    assert.ok(netlify.ignorados.includes(item), `${item} é publicado mas não está no ignore`);
  }
});

test('assets, robots, sitemap e llms.txt continuam publicados', () => {
  assert.ok(netlify.pastas.includes('assets'));
  for (const arquivo of ['robots.txt', 'sitemap.xml', 'llms.txt']) assert.ok(netlify.arquivos.includes(arquivo), arquivo);
});

test('nenhuma página usa slug sequestrado pelos 301 do portal', () => {
  for (const p of paginas) assert.ok(!PROIBIDOS.includes(publicado(p.arquivo)), p.arquivo);
});

test('sitemap lista exatamente as páginas indexáveis', () => {
  const urls = [...ler('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  const esperado = paginas.filter((p) => p.indexavel !== false).map((p) => dominio + p.url).sort();
  assert.deepEqual(urls, esperado);
});

test('robots aponta o sitemap e libera o site', () => {
  const robots = ler('robots.txt');
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${dominio}/sitemap\\.xml$`, 'm'));
});

test('llms.txt só linka páginas que existem e não repete afirmação retirada pelo refino', () => {
  const llms = ler('llms.txt');
  const urls = new Set(paginas.map((p) => dominio + p.url));
  for (const [, link] of llms.matchAll(/\]\((https:\/\/waveops\.com\.br[^)]*)\)/g)) {
    assert.ok(urls.has(link), `llms.txt linka ${link}, que não é página do site`);
  }
  for (const retirada of [/3 a 7 dias/i, /preço fechado/i, /sem fidelidade/i, /#pacotes/, /página única/i]) {
    assert.doesNotMatch(llms, retirada);
  }
});
