// assets/funil.js roda como script clássico no navegador. Aqui ele roda num contexto
// vm com window, location, sessionStorage e sendBeacon falsos, e os testes olham o que
// ele mandaria para POST /api/e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const codigo = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/funil.js'), 'utf8');

function armazenamentoFalso() {
  const dados = new Map();
  return {
    dados,
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  };
}

const armazenamentoQuebrado = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('SecurityError'); },
};

/** Carrega o funil.js como se fosse uma página nova. Devolve os eventos enviados. */
async function carregar(href, referrer, armazenamento) {
  const url = new URL(href);
  const enviados = [];
  const contexto = {
    location: { href: url.href, search: url.search, hostname: url.hostname, pathname: url.pathname },
    document: { referrer },
    navigator: { sendBeacon: (_destino, blob) => { enviados.push(blob); return true; } },
    sessionStorage: armazenamento,
    URL,
    URLSearchParams,
    Blob,
    JSON,
    fetch: () => Promise.resolve(),
  };
  contexto.window = contexto;
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto);
  const eventos = [];
  for (const blob of enviados) eventos.push(JSON.parse(await blob.text()));
  return { eventos, funil: contexto.window.WaveFunil };
}

test('primeira página com UTM: visita com a fonte da campanha e registro gravado', async () => {
  const s = armazenamentoFalso();
  const { eventos } = await carregar('https://waveops.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=out', 'https://www.google.com/', s);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].n, 'visita');
  assert.equal(eventos[0].f, 'google/cpc');
  const registro = JSON.parse(s.getItem('waveops:origem:v1'));
  assert.equal(registro.fonte, 'google/cpc');
  assert.equal(registro.utm.campaign, 'out');
  assert.match(registro.landingUrl, /utm_campaign=out/);
});

test('segunda página da mesma sessão: sem nova visita e com a fonte da primeira', async () => {
  const s = armazenamentoFalso();
  await carregar('https://waveops.com.br/?utm_source=google&utm_medium=cpc', 'https://www.google.com/', s);
  const { eventos, funil } = await carregar('https://waveops.com.br/contato/', 'https://waveops.com.br/', s);
  assert.equal(eventos.length, 0, 'visita não se repete na sessão');
  assert.equal(typeof funil.enviar, 'function');
  assert.equal(JSON.parse(s.getItem('waveops:origem:v1')).fonte, 'google/cpc', 'o registro do primeiro toque não é sobrescrito');
});

test('evento depois de navegar dentro do site leva a fonte do primeiro toque', async () => {
  const s = armazenamentoFalso();
  await carregar('https://waveops.com.br/', 'https://www.linkedin.com/', s);
  const url = new URL('https://waveops.com.br/contato/');
  const enviados = [];
  const contexto = {
    location: { href: url.href, search: url.search, hostname: url.hostname, pathname: url.pathname },
    document: { referrer: 'https://waveops.com.br/' },
    navigator: { sendBeacon: (_d, blob) => { enviados.push(blob); return true; } },
    sessionStorage: s, URL, URLSearchParams, Blob, JSON, fetch: () => Promise.resolve(),
  };
  contexto.window = contexto;
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto);
  contexto.window.WaveFunil.enviar('lead_enviado', { dor: 'x' });
  const eventos = await Promise.all(enviados.map(async (b) => JSON.parse(await b.text())));
  assert.deepEqual(eventos.map((e) => e.n), ['lead_enviado']);
  assert.equal(eventos[0].f, 'www.linkedin.com');
  assert.equal(eventos[0].u, '/contato/');
});

test('nova campanha no meio da sessão vira nova visita com a fonte nova', async () => {
  const s = armazenamentoFalso();
  await carregar('https://waveops.com.br/', 'https://www.linkedin.com/', s);
  const { eventos } = await carregar('https://waveops.com.br/?utm_source=meta&utm_medium=pago', 'https://l.instagram.com/', s);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].f, 'meta/pago');
});

test('recarregar a página da campanha não conta outra visita', async () => {
  const s = armazenamentoFalso();
  await carregar('https://waveops.com.br/?utm_source=google&utm_medium=cpc', 'https://www.google.com/', s);
  const { eventos } = await carregar('https://waveops.com.br/?utm_source=google&utm_medium=cpc', '', s);
  assert.equal(eventos.length, 0);
});

test('entrada direta: visita com fonte direto e registro gravado', async () => {
  const s = armazenamentoFalso();
  const { eventos } = await carregar('https://waveops.com.br/plataforma/', '', s);
  assert.equal(eventos[0].f, 'direto');
  assert.equal(JSON.parse(s.getItem('waveops:origem:v1')).fonte, 'direto');
});

test('aba nova aberta de uma página com UTM: sem nova visita e com a UTM do referrer', async () => {
  const novaAba = armazenamentoFalso();
  const { eventos } = await carregar('https://waveops.com.br/contato/', 'https://waveops.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=out', novaAba);
  assert.equal(eventos.length, 0, 'a aba de origem já contou a visita');
  const registro = JSON.parse(novaAba.getItem('waveops:origem:v1'));
  assert.equal(registro.fonte, 'google/cpc');
  assert.equal(registro.utm.campaign, 'out');
});

test('voltar do portal não reescreve o primeiro toque nem conta outra visita', async () => {
  const s = armazenamentoFalso();
  await carregar('https://waveops.com.br/?utm_source=google&utm_medium=cpc', 'https://www.google.com/', s);
  const { eventos } = await carregar('https://waveops.com.br/', 'https://portal.waveops.com.br/checkout', s);
  assert.equal(eventos.length, 0);
  assert.equal(JSON.parse(s.getItem('waveops:origem:v1')).fonte, 'google/cpc');
});

test('vindo do portal numa sessão nova: sem visita e fonte direto', async () => {
  const { eventos } = await carregar('https://waveops.com.br/', 'https://portal.waveops.com.br/cliente/login', armazenamentoFalso());
  assert.equal(eventos.length, 0);
});

test('o evento vai como text/plain (com JSON o navegador faria preflight)', async () => {
  const url = new URL('https://waveops.com.br/');
  const blobs = [];
  const contexto = {
    location: { href: url.href, search: url.search, hostname: url.hostname, pathname: url.pathname },
    document: { referrer: '' },
    navigator: { sendBeacon: (_d, blob) => { blobs.push(blob); return true; } },
    sessionStorage: armazenamentoFalso(), URL, URLSearchParams, Blob, JSON, fetch: () => Promise.resolve(),
  };
  contexto.window = contexto;
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto);
  assert.match(blobs[0].type, /^text\/plain/);
});

test('sessionStorage bloqueado: volta ao comportamento antigo sem quebrar', async () => {
  const { eventos, funil } = await carregar('https://waveops.com.br/?utm_source=x', '', armazenamentoQuebrado);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].f, 'x');
  assert.equal(typeof funil.enviar, 'function');
});
