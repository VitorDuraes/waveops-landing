import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { verificarPreflight, verificarRespostaPublica, verificarFunilRenderizado,
  verificarPrismaSemEnv, encerrarContainerProprio, encerrarProcessoProprio } from './site-portal-checks.mjs';

const origem = 'https://waveops.com.br';
const cors = { 'Access-Control-Allow-Origin': origem, Vary: 'Origin', 'Cache-Control': 'no-store' };
const preflight = { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type' };

test('Prisma sem referência de .env aceita caminhos nulos ou ausentes e recusa caminhos reais', () => {
  verificarPrismaSemEnv({ rootEnvPath: null });
  verificarPrismaSemEnv({ rootEnvPath: null, schemaEnvPath: null });
  assert.throws(() => verificarPrismaSemEnv({ rootEnvPath: '../.env' }));
  assert.throws(() => verificarPrismaSemEnv({ rootEnvPath: null, schemaEnvPath: '../.env' }));
});

test('preflight exige método e cabeçalho usados pelo navegador', () => {
  verificarPreflight(new Response(null, { status: 204, headers: preflight }), origem);
  for (const campo of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers']) {
    const incompleto = { ...preflight }; delete incompleto[campo];
    assert.throws(() => verificarPreflight(new Response(null, { status: 204, headers: incompleto }), origem));
  }
  assert.throws(() => verificarPreflight(new Response(null, { status: 204,
    headers: { ...preflight, 'Access-Control-Allow-Methods': 'GET' } }), origem));
});

test('POST de sucesso e recusa 422 exigem CORS e no-store', () => {
  for (const status of [200, 422]) {
    verificarRespostaPublica(new Response('{}', { status, headers: cors }), origem);
    for (const campo of ['Access-Control-Allow-Origin', 'Cache-Control']) {
      const incompleto = { ...cors }; delete incompleto[campo];
      assert.throws(() => verificarRespostaPublica(new Response('{}', { status, headers: incompleto }), origem));
    }
  }
});

const valores = [{ rotulo: 'Lead enviado', visitantes: 1, eventos: 1 },
  { rotulo: 'Lista de interesse da Plataforma', visitantes: 1 }];
function funil(lead = 1, interesse = 1) {
  return `<div class="flabel">Lead enviado</div><div class="fsub">1 evento</div>
    <div class="fqtd">${lead}</div><div class="flabel">Lista de interesse da Plataforma</div>
    <div class="fv">${interesse} · 100%</div>`;
}

test('funil precisa mostrar os números de cada sinal, não apenas seus rótulos', () => {
  verificarFunilRenderizado(funil(), valores);
  assert.throws(() => verificarFunilRenderizado(funil(0, 1), valores));
  assert.throws(() => verificarFunilRenderizado(funil(1, 0), valores));
});

test('contagens dentro de script não servem como evidência visível do funil', () => {
  assert.throws(() => verificarFunilRenderizado(`<script>${funil()}</script>`, valores));
});

const nome = 'waveops-h5-fixture';
const execucao = 'execucao-ficticia';
const etiquetas = { 'com.waveops.qa': 'h5-local', 'com.waveops.qa.run': execucao };

test('limpeza encontra recurso próprio mesmo após falha do comando de criação', () => {
  const chamadas = [];
  encerrarContainerProprio(nome, execucao, (args) => {
    chamadas.push(args);
    return { status: 0, stdout: args[0] === 'inspect' ? JSON.stringify(etiquetas) : nome, stderr: '' };
  });
  assert.deepEqual(chamadas.map((args) => args[0]), ['inspect', 'stop']);
});

test('contêiner ausente é diferente de falha do daemon', () => {
  encerrarContainerProprio(nome, execucao, () => ({ status: 1, stdout: '', stderr: `Error: No such object: ${nome}` }));
  assert.throws(() => encerrarContainerProprio(nome, execucao,
    () => ({ status: 1, stdout: '', stderr: 'Cannot connect to Docker daemon' })));
});

test('limpeza recusa contêiner com nome igual pertencente a outra execução', () => {
  const chamadas = [];
  assert.throws(() => encerrarContainerProprio(nome, execucao, (args) => {
    chamadas.push(args);
    return { status: 0, stdout: JSON.stringify({ ...etiquetas, 'com.waveops.qa.run': 'outra-execucao' }), stderr: '' };
  }));
  assert.equal(chamadas.length, 1);
});

function processo(terminaCom) {
  const filho = new EventEmitter();
  Object.assign(filho, { pid: 123, exitCode: null, signalCode: null, sinais: [] });
  filho.kill = (sinal) => {
    filho.sinais.push(sinal);
    if (sinal === terminaCom) queueMicrotask(() => {
      filho.signalCode = sinal; filho.emit('exit', null, sinal);
    });
    return true;
  };
  return filho;
}

test('processo que ignora SIGTERM recebe SIGKILL dentro do prazo', async () => {
  const filho = processo('SIGKILL');
  await encerrarProcessoProprio(filho, { plataforma: 'linux', prazoMs: 10 });
  assert.deepEqual(filho.sinais, ['SIGTERM', 'SIGKILL']);
});

test('processo que não encerra produz erro em vez de espera indefinida', async () => {
  await assert.rejects(encerrarProcessoProprio(processo('nenhum'), { plataforma: 'linux', prazoMs: 10 }));
});

test('processo já encerrado não recebe comando de terminação', async () => {
  const filho = processo('SIGTERM'); filho.signalCode = 'SIGTERM';
  await encerrarProcessoProprio(filho, { plataforma: 'linux', prazoMs: 10 });
  assert.deepEqual(filho.sinais, []);
});
