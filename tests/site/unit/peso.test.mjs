// Orçamento de peso por página (spec do site v2, seção 3): JavaScript próprio até 15 KB
// gzip e CSS até 25 KB gzip, somando o que a página carrega, inclusive os imports dos
// módulos. Mede com gzip nível 9, como as medições anteriores do CLAUDE.md.
// Página com formulário (contato e lista de interesse) tem teto de JS de 20 KB: são dez
// módulos pequenos de validação, contrato, atribuição e envio, e cada arquivo paga o
// próprio custo de gzip. Ajuste registrado em 10/10/2026, com o Contato em 15,9 KB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { lerPaginas, importsRelativos } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// Entrada do site (Tarefa 13B). Decisão do controlador em 20/10/2026: a entrada pode somar até 3 KB
// gzip de JavaScript e 2 KB de CSS em cada página, e os tetos sobem exatamente o que ela mediu, nada
// mais. Na rodada de correção 1 (o toque que pula não chega à página, aba nova aberta de um link do
// site não repete a entrada, ouvintes removidos no fim), o controlador subiu a cota de JavaScript para
// o tamanho medido, até 3,3 KB (3379 B), depois de cortar bytes do desenho sem mudar o visual.
// JavaScript: chegada.js (495 B) e chegada-cena.js (2642 B), carregados em toda página. CSS: a camada
// e a trava em components.css e os dois tokens em tokens.css, 389 B a mais nas duas folhas, medidos
// no último teste com e sem o bloco da entrada.
const ENTRADA_JS = 3137;
const ENTRADA_CSS = 389;
const LIMITE_JS = 15 * 1024 + ENTRADA_JS;
const LIMITE_JS_FORMULARIO = 20 * 1024 + ENTRADA_JS;
const LIMITE_CSS = 25 * 1024 + ENTRADA_CSS;

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
    const html = fs.readFileSync(abs, 'utf8');
    const { css, js } = carregados(html);
    const pesoCss = css.reduce((soma, c) => soma + gzip(path.join(raiz, c)), 0);
    const pesoJs = js.reduce((soma, j) => soma + gzip(path.join(raiz, j)), 0);
    const limiteJs = /data-form-(contato|interesse)\b/.test(html) ? LIMITE_JS_FORMULARIO : LIMITE_JS;
    assert.ok(pesoJs <= limiteJs, `JS ${pesoJs} B gzip passa de ${limiteJs} B: ${js.join(', ')}`);
    assert.ok(pesoCss <= LIMITE_CSS, `CSS ${pesoCss} B gzip passa de ${LIMITE_CSS} B: ${css.join(', ')}`);
  });
}

/** CSS da entrada: o que tokens.css e components.css pesam a mais com o bloco e os tokens dela. */
function cssDaEntrada() {
  const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
  const tokens = ler('assets/site/tokens.css');
  const componentes = ler('assets/site/components.css');
  const semTokens = tokens.replace(/\n  --wo-z-chegada: [^;]+;/, '').replace(/\n  \/\* Entrada do site[^]*?--wo-chegada-trava: [^;]+;/, '');
  const semBloco = componentes.replace(/\n\n\/\* -{10} Entrada do site[^]*?(?=\n\n\/\* -{10} )/, '');
  assert.ok(semTokens.length < tokens.length && semBloco.length < componentes.length, 'bloco ou tokens da entrada não encontrados');
  const z = (texto) => zlib.gzipSync(Buffer.from(texto), { level: 9 }).length;
  return z(tokens) + z(componentes) - z(semTokens) - z(semBloco);
}

test('a entrada do site não passa do que mediu nem das cotas de 3,3 KB de JavaScript e 2 KB de CSS', () => {
  const pesoJs = ['assets/site/chegada.js', 'assets/site/chegada-cena.js'].reduce((soma, j) => soma + gzip(path.join(raiz, j)), 0);
  assert.ok(pesoJs <= ENTRADA_JS && ENTRADA_JS <= 3379, `entrada com ${pesoJs} B gzip de JS, medida em ${ENTRADA_JS} B`);
  const pesoCss = cssDaEntrada();
  assert.ok(pesoCss <= ENTRADA_CSS && ENTRADA_CSS <= 2 * 1024, `entrada com ${pesoCss} B gzip de CSS, medida em ${ENTRADA_CSS} B`);
});
