// Testes do servidor local: URLs com barra final, 404, travessia de pasta, proteções
// (Host local, dotfile, só o que o Netlify publica), vídeo com Range (spec 9.5) e
// endpoints simulados.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { criarServidor } from '../../../dev/site/serve.mjs';

let servidor;
let base;
let raiz;
let pastaSegredo;
// Fixture de vídeo: 1000 bytes, cada um com o próprio índice módulo 256.
const BYTES_VIDEO = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));

before(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-serve-'));
  fs.writeFileSync(path.join(raiz, 'index.html'), '<h1>home</h1>');
  fs.writeFileSync(path.join(raiz, '404.html'), '<h1>nao encontrado</h1>');
  fs.mkdirSync(path.join(raiz, 'solucoes'));
  fs.writeFileSync(path.join(raiz, 'solucoes', 'index.html'), '<h1>solucoes</h1>');
  fs.mkdirSync(path.join(raiz, 'assets'));
  fs.writeFileSync(path.join(raiz, 'assets', 'a.css'), 'body{}');
  fs.writeFileSync(path.join(raiz, 'assets', 'v.webm'), BYTES_VIDEO);
  fs.writeFileSync(path.join(raiz, 'assets', 'v.mp4'), BYTES_VIDEO);
  fs.mkdirSync(path.join(raiz, '.git'));
  fs.writeFileSync(path.join(raiz, '.git', 'config'), 'segredo do git');
  pastaSegredo = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-serve-fora-'));
  fs.writeFileSync(path.join(pastaSegredo, 'segredo-wo.txt'), 'nao pode vazar');
  servidor = criarServidor({ raiz, atrasoLentoMs: 50 });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
  fs.rmSync(raiz, { recursive: true, force: true });
  fs.rmSync(pastaSegredo, { recursive: true, force: true });
});

/** GET com Host escolhido (fetch não deixa trocar o Host). */
function pedirComHost(host, caminho) {
  return new Promise((resolver, rejeitar) => {
    const req = http.request(`${base}${caminho}`, { headers: { Host: host } }, (res) => {
      let corpo = '';
      res.on('data', (c) => (corpo += c));
      res.on('end', () => resolver({ status: res.statusCode, corpo }));
    });
    req.on('error', rejeitar);
    req.end();
  });
}

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
  const nome = path.basename(pastaSegredo);
  const r = await fetch(`${base}/..%2f${nome}%2fsegredo-wo.txt`);
  assert.notEqual(r.status, 200);
  assert.doesNotMatch(await r.text(), /nao pode vazar/);
});

test('não serve dotfile nem pasta oculta (.git)', async () => {
  const r = await fetch(`${base}/.git/config`);
  assert.equal(r.status, 404);
  assert.doesNotMatch(await r.text(), /segredo do git/);
});

test('Host que não é local leva 421 (fecha DNS rebinding)', async () => {
  const r = await pedirComHost('evil.example', '/');
  assert.equal(r.status, 421);
  const local = await pedirComHost('localhost:4321', '/');
  assert.equal(local.status, 200);
});

test('com netlify.toml na raiz, só serve o que o Netlify publica', async () => {
  const outra = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-serve-toml-'));
  try {
    fs.writeFileSync(path.join(outra, 'index.html'), '<h1>home</h1>');
    fs.writeFileSync(path.join(outra, 'netlify.toml'), '[build]\n  command = "cp ../index.html _site/ && cp -r ../assets _site/"\n');
    fs.mkdirSync(path.join(outra, 'portal'));
    fs.writeFileSync(path.join(outra, 'portal', 'package.json'), '{"segredo":true}');
    fs.mkdirSync(path.join(outra, 'dev', 'site'), { recursive: true });
    fs.writeFileSync(path.join(outra, 'dev', 'site', 'og.html'), '<h1>og</h1>');
    const s2 = criarServidor({ raiz: outra });
    await new Promise((ok) => s2.listen(0, '127.0.0.1', ok));
    const b2 = `http://127.0.0.1:${s2.address().port}`;
    try {
      assert.equal((await fetch(`${b2}/`)).status, 200);
      assert.equal((await fetch(`${b2}/portal/package.json`)).status, 404);
      assert.equal((await fetch(`${b2}/netlify.toml`)).status, 404);
      assert.equal((await fetch(`${b2}/dev/site/og.html`)).status, 200);
    } finally {
      s2.close();
    }
  } finally {
    fs.rmSync(outra, { recursive: true, force: true });
  }
});

test('CSS sai com o tipo certo', async () => {
  const r = await fetch(`${base}/assets/a.css`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/css/);
});

/** GET com cabeçalho Range. @param {string} intervalo */
const pedirIntervalo = (intervalo) => fetch(`${base}/assets/v.webm`, { headers: { Range: intervalo } });

test('vídeo sai com o tipo certo e anuncia Accept-Ranges', async () => {
  const r = await fetch(`${base}/assets/v.webm`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/webm');
  assert.equal(r.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), BYTES_VIDEO);
  const mp4 = await fetch(`${base}/assets/v.mp4`);
  assert.equal(mp4.status, 200);
  assert.equal(mp4.headers.get('content-type'), 'video/mp4');
  await mp4.arrayBuffer();
});

test('Range de um intervalo responde 206 com o trecho e Content-Range', async () => {
  const r = await pedirIntervalo('bytes=0-99');
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 0-99/1000');
  assert.equal(r.headers.get('content-length'), '100');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), BYTES_VIDEO.subarray(0, 100));

  // Sem o fim, vai até o último byte: é o pedido que o navegador faz ao tocar o vídeo.
  const aberto = await pedirIntervalo('bytes=900-');
  assert.equal(aberto.status, 206);
  assert.equal(aberto.headers.get('content-range'), 'bytes 900-999/1000');
  assert.deepEqual(Buffer.from(await aberto.arrayBuffer()), BYTES_VIDEO.subarray(900));

  // Sufixo: os últimos 100 bytes.
  const sufixo = await pedirIntervalo('bytes=-100');
  assert.equal(sufixo.status, 206);
  assert.equal(sufixo.headers.get('content-range'), 'bytes 900-999/1000');
  assert.deepEqual(Buffer.from(await sufixo.arrayBuffer()), BYTES_VIDEO.subarray(900));
});

test('Range fora do arquivo responde 416 com o tamanho total', async () => {
  const r = await pedirIntervalo('bytes=1000-');
  assert.equal(r.status, 416);
  assert.equal(r.headers.get('content-range'), 'bytes */1000');
  await r.arrayBuffer();
});

test('pedido abortado no meio destrói o stream do arquivo e solta o descritor', async (t) => {
  // Bem maior que os buffers do socket: o servidor ainda está lendo quando o cliente desiste,
  // como o navegador faz com vídeo ao trocar de intervalo.
  fs.writeFileSync(path.join(raiz, 'assets', 'grande.webm'), Buffer.alloc(32 * 1024 * 1024));
  const espiao = t.mock.method(fs, 'createReadStream');
  await new Promise((resolver, rejeitar) => {
    const req = http.request(`${base}/assets/grande.webm`, { headers: { Range: 'bytes=0-' } }, (res) => {
      res.on('error', () => {});
      if (res.statusCode !== 206) return rejeitar(new Error(`status ${res.statusCode}`));
      res.once('data', () => {
        req.destroy();
        resolver(undefined);
      });
    });
    req.on('error', () => {}); // o socket fechado por nós mesmos
    req.end();
  });
  const stream = espiao.mock.calls.find((c) => String(c.arguments[0]).endsWith('grande.webm'))?.result;
  assert.ok(stream, 'o servidor não abriu o arquivo');
  for (let i = 0; i < 100 && !stream.closed; i++) await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(stream.destroyed, true, 'o stream do arquivo ficou vivo depois do aborto');
  assert.equal(stream.closed, true, 'o descritor do arquivo ficou aberto depois do aborto');
});

test('Range inválido ou com vários intervalos é ignorado: 200 com o arquivo inteiro', async () => {
  for (const intervalo of ['bytes=50-10', 'bytes=0-9,20-29', 'linhas=0-9']) {
    const r = await pedirIntervalo(intervalo);
    assert.equal(r.status, 200, intervalo);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), BYTES_VIDEO, intervalo);
  }
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
