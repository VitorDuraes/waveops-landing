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

test('os 301 para o portal continuam, todos com force', () => {
  const toml = ler('netlify.toml');
  const regras = [...toml.matchAll(/\[\[redirects\]\]\s*from = "([^"]+)"\s*to = "([^"]+)"\s*status = (\d+)\s*force = (true|false)/g)].map((m) => ({
    de: m[1],
    para: m[2],
    status: Number(m[3]),
    force: m[4] === 'true',
  }));
  for (const de of ['/cliente/*', '/admin/*', '/checkout', '/api/*', '/termos', '/privacidade']) {
    const regra = regras.find((r) => r.de === de);
    assert.ok(regra, `falta o redirect de ${de}`);
    assert.equal(regra.status, 301);
    assert.equal(regra.force, true);
    assert.match(regra.para, /^https:\/\/portal\.waveops\.com\.br\//);
  }
});

test('os headers de segurança continuam no netlify.toml', () => {
  const toml = ler('netlify.toml');
  assert.match(toml, /Content-Security-Policy = "frame-ancestors 'none'"/);
  assert.match(toml, /X-Frame-Options = "DENY"/);
  assert.match(toml, /X-Content-Type-Options = "nosniff"/);
  assert.match(toml, /Referrer-Policy = "strict-origin-when-cross-origin"/);
  assert.match(toml, /Permissions-Policy = "camera=\(\), microphone=\(\)/);
});

/** O `command` de uma seção do netlify.toml (`build` ou `context.deploy-preview`), ou null. */
function comandoDaSecao(toml, secao) {
  const linhas = toml.replace(/\r\n/g, '\n').split('\n');
  const inicio = linhas.findIndex((l) => l.trim() === `[${secao}]`);
  if (inicio === -1) return null;
  for (const linha of linhas.slice(inicio + 1)) {
    if (/^\s*\[/.test(linha)) return null;
    const achado = /^\s*command\s*=\s*"([^"]*)"/.exec(linha);
    if (achado) return achado[1];
  }
  return null;
}

const NOINDEX = " && echo '/*' > _site/_headers && echo '  X-Robots-Tag: noindex, nofollow' >> _site/_headers";

test('Deploy Preview e branch deploy publicam o mesmo site, com noindex em toda resposta', () => {
  const toml = ler('netlify.toml');
  const producao = comandoDaSecao(toml, 'build');
  assert.ok(producao, 'sem command em [build]');
  for (const contexto of ['context.deploy-preview', 'context.branch-deploy']) {
    assert.equal(comandoDaSecao(toml, contexto), producao + NOINDEX, `${contexto} precisa ser o build de produção mais o _headers com noindex`);
  }
});

test('produção nunca leva noindex', () => {
  const toml = ler('netlify.toml');
  assert.doesNotMatch(comandoDaSecao(toml, 'build') ?? '', /noindex/);
  assert.equal(comandoDaSecao(toml, 'context.production'), null, 'produção usa o [build], sem override');
  assert.doesNotMatch(ler('robots.txt'), /Disallow:\s*\/\s*$/m);
  assert.ok(!fs.existsSync(path.join(raiz, '_headers')), 'um _headers na raiz iria para produção');
});
