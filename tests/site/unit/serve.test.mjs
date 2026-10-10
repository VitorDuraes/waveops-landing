// Testes do servidor local: URLs com barra final, 404, travessia de pasta e endpoints simulados.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarServidor } from '../../../dev/site/serve.mjs';

let servidor;
let base;
let raiz;

before(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-serve-'));
  fs.writeFileSync(path.join(raiz, 'index.html'), '<h1>home</h1>');
  fs.writeFileSync(path.join(raiz, '404.html'), '<h1>nao encontrado</h1>');
  fs.mkdirSync(path.join(raiz, 'solucoes'));
  fs.writeFileSync(path.join(raiz, 'solucoes', 'index.html'), '<h1>solucoes</h1>');
  fs.mkdirSync(path.join(raiz, 'assets'));
  fs.writeFileSync(path.join(raiz, 'assets', 'a.css'), 'body{}');
  fs.writeFileSync(path.join(path.dirname(raiz), 'segredo-wo.txt'), 'nao pode vazar');
  servidor = criarServidor({ raiz, atrasoLentoMs: 50 });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

test('serve a home e a página com barra final', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /home/);
  const pagina = await fetch(`${base}/solucoes/`);
  assert.equal(pagina.status, 200);
  assert.match(pagina.headers.get('content-type'), /text\/html/);
});

test('sem barra final redireciona com 301', async () => {
  const r = await fetch(`${base}/solucoes`, { redirect: 'manual' });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/solucoes/');
});

test('rota inexistente devolve 404 com a página 404', async () => {
  const r = await fetch(`${base}/nao-existe/`);
  assert.equal(r.status, 404);
  assert.match(await r.text(), /nao encontrado/);
});

test('não sai da raiz por travessia de pasta', async () => {
  const r = await fetch(`${base}/..%2fsegredo-wo.txt`);
  assert.notEqual(r.status, 200);
  assert.doesNotMatch(await r.text(), /nao pode vazar/);
});

test('CSS sai com o tipo certo', async () => {
  const r = await fetch(`${base}/assets/a.css`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/css/);
});

test('endpoint simulado de lead responde 200 com protocolo', async () => {
  const r = await fetch(`${base}/__dev/lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idEnvio: 'abc-123', nome: 'Ana' }),
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, protocolo: 'abc-123' });
});

test('POST /api/e responde 204, como o funil do portal', async () => {
  const r = await fetch(`${base}/api/e`, { method: 'POST', body: '{"n":"visita"}', headers: { 'Content-Type': 'text/plain' } });
  assert.equal(r.status, 204);
});

test('endpoint simulado obedece ?simular=falha, validacao e lento', async () => {
  const corpo = { method: 'POST', body: '{"idEnvio":"x"}', headers: { 'Content-Type': 'application/json' } };
  assert.equal((await fetch(`${base}/__dev/interesse?simular=falha`, corpo)).status, 503);
  const v = await fetch(`${base}/__dev/lead?simular=validacao`, corpo);
  assert.equal(v.status, 422);
  assert.equal((await v.json()).erro, 'validacao');
  const inicio = Date.now();
  assert.equal((await fetch(`${base}/__dev/lead?simular=lento`, corpo)).status, 200);
  assert.ok(Date.now() - inicio >= 45);
});
