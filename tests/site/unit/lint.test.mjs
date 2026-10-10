// Testes do lint de HTML do site: cada regra acusa o erro certo, na linha certa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintarHtml } from '../../../dev/site/lint.mjs';

const VALIDA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'">
<link rel="stylesheet" href="/assets/site/base.css?v=12345678">
<title>Contato · WaveOps</title>
<meta name="description" content="Fale com a WaveOps.">
<link rel="canonical" href="https://waveops.com.br/contato/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>
</head>
<body>
<a href="#conteudo">Pular para o conteúdo</a>
<main id="conteudo">
<h1>Contato</h1>
<h2>Seção</h2>
<h3>Subseção</h3>
<label for="f-nome">Nome</label><input id="f-nome" type="text">
<button type="button" aria-controls="painel" aria-expanded="false">Abrir</button>
<div id="painel">Painel</div>
<img src="/assets/brand/selo.webp" alt="">
<a href="/solucoes/#vender">Vender mais</a>
<a href="https://wa.me/5534991775784" target="_blank" rel="noopener">WhatsApp</a>
<!-- <img src="/assets/sumiu.png"> comentário não conta -->
</main>
</body>
</html>
`;

const contexto = {
  arquivo: 'contato/index.html',
  url: '/contato/',
  indexavel: true,
  dominio: 'https://waveops.com.br',
  paginas: new Map([['/solucoes/', new Set(['vender'])], ['/contato/', new Set()]]),
  arquivos: new Set(['/assets/site/base.css', '/assets/brand/selo.webp']),
};

const regras = (html, ctx = contexto) => lintarHtml(html, ctx).map((e) => e.regra);
const trocar = (de, para) => VALIDA.replace(de, para);

test('página válida não tem erro', () => {
  assert.deepEqual(lintarHtml(VALIDA, contexto), []);
});

test('doctype, lang e charset', () => {
  assert.ok(regras(trocar('<!doctype html>', '')).includes('doctype'));
  assert.ok(regras(trocar('lang="pt-BR"', 'lang="en"')).includes('lang'));
  assert.ok(regras(trocar('<meta charset="utf-8">', '')).includes('charset'));
});

test('CSP ausente ou depois de um recurso', () => {
  const semCsp = VALIDA.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n/, '');
  assert.ok(regras(semCsp).includes('csp'));
  const depois = semCsp.replace('</title>', '</title>\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">');
  assert.ok(regras(depois).includes('csp'));
});

test('título único, não vazio e curto', () => {
  assert.ok(regras(trocar('<title>Contato · WaveOps</title>', '<title></title>')).includes('titulo'));
  assert.ok(regras(trocar('</title>', '</title><title>Outro</title>')).includes('titulo'));
  assert.ok(regras(trocar('Contato · WaveOps', 'x'.repeat(71))).includes('titulo'));
});

test('descrição e canonical', () => {
  assert.ok(regras(trocar(/<meta name="description"[^>]*>/, '')).includes('descricao'));
  assert.ok(regras(trocar('content="Fale com a WaveOps."', `content="${'y'.repeat(161)}"`)).includes('descricao'));
  assert.ok(regras(trocar('https://waveops.com.br/contato/', 'https://waveops.com.br/outra/')).includes('canonical'));
});

test('página não indexável exige noindex', () => {
  const ctx404 = { ...contexto, arquivo: '404.html', url: '/404.html', indexavel: false };
  const semCanonical = VALIDA.replace(/<link rel="canonical"[^>]*>\n/, '');
  assert.ok(regras(semCanonical, ctx404).includes('robots'));
  const comNoindex = semCanonical.replace('</title>', '</title>\n<meta name="robots" content="noindex">');
  assert.deepEqual(regras(comNoindex, ctx404), []);
});

test('um h1 e headings sem pular nível', () => {
  assert.ok(regras(trocar('<h2>Seção</h2>', '<h1>Outro</h1>')).includes('h1'));
  assert.ok(regras(trocar('<h3>Subseção</h3>', '<h4>Subseção</h4>')).includes('titulos'));
});

test('id duplicado, img sem alt, botão sem type, campo sem rótulo', () => {
  assert.ok(regras(trocar('<div id="painel">', '<div id="conteudo">')).includes('id-duplicado'));
  assert.ok(regras(trocar('alt=""', '')).includes('img-alt'));
  assert.ok(regras(trocar('<button type="button"', '<button')).includes('botao-type'));
  assert.ok(regras(trocar('<label for="f-nome">Nome</label>', '')).includes('rotulo'));
});

test('script inline, evento inline e javascript: são proibidos', () => {
  assert.ok(regras(trocar('</main>', '<script>alert(1)</script></main>')).includes('script-inline'));
  assert.ok(regras(trocar('<div id="painel">', '<div id="painel" onclick="x()">')).includes('evento-inline'));
  assert.ok(regras(trocar('href="/solucoes/#vender"', 'href="javascript:void(0)"')).includes('javascript-url'));
});

test('http sem s e target _blank sem noopener', () => {
  assert.ok(regras(trocar('https://wa.me', 'http://wa.me')).includes('http'));
  assert.ok(regras(trocar(' rel="noopener"', '')).includes('blank-rel'));
});

test('link interno para página, âncora ou asset que não existe', () => {
  assert.ok(regras(trocar('/solucoes/#vender', '/nao-existe/')).includes('link-interno'));
  assert.ok(regras(trocar('/solucoes/#vender', '/solucoes/#sumiu')).includes('link-interno'));
  assert.ok(regras(trocar('href="#conteudo"', 'href="#sumiu"')).includes('link-interno'));
  assert.ok(regras(trocar('/assets/brand/selo.webp', '/assets/brand/sumiu.webp')).includes('link-interno'));
});

test('travessão e meia-risca são proibidos', () => {
  assert.ok(regras(trocar('Seção', 'Seção — nova')).includes('travessao'));
  assert.ok(regras(trocar('Seção', '1–2')).includes('travessao'));
});

test('JSON-LD inválido e referência ARIA quebrada', () => {
  assert.ok(regras(trocar('"WebPage"}', '"WebPage",}')).includes('json-ld'));
  assert.ok(regras(trocar('aria-controls="painel"', 'aria-controls="sumiu"')).includes('referencia-aria'));
});

test('o erro aponta a linha certa', () => {
  const erros = lintarHtml(trocar('<h3>Subseção</h3>', '<h4>Subseção</h4>'), contexto);
  const erro = erros.find((e) => e.regra === 'titulos');
  assert.equal(erro.linha, 18);
  assert.equal(erro.arquivo, 'contato/index.html');
});
