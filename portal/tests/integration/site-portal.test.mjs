import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { montarLead, montarInteresse } from '../../../assets/site/lib/payload.js';
import { enviarJson } from '../../../assets/site/lib/enviar.js';
import { verificarPreflight, verificarRespostaPublica, verificarFunilRenderizado,
  verificarPrismaSemEnv, encerrarContainerProprio, encerrarProcessoProprio } from './site-portal-checks.mjs';

// H5: módulos reais do site, HTTP do Next, PostgreSQL e aviso recebido localmente.
// Não lê .env, não aceita destino externo e não usa credenciais de produção.
const portal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repo = path.dirname(portal);
const origem = 'https://waveops.com.br';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36';
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const processoEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|SYSTEMDRIVE|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS)$/i.test(key)));
const chave = randomBytes(48).toString('hex');
const execucao = randomUUID();
const nomeContainer = `waveops-h5-${process.pid}-${execucao.slice(0, 8)}`;
const avisos = [];
let pasta;
let banco;
let app;
let appUrl;
let receptor;
let containerTentado = false;
let idAvisoEsperado;
let saidaApp = '';
let ambiente;
let cookieAdmin;
let cookieCliente;

function executar(comando, argumentos, opcoes = {}) {
  const resultado = spawnSync(comando, argumentos, { encoding: 'utf8', windowsHide: true,
    env: processoEnv, timeout: 90_000, maxBuffer: 2 * 1024 * 1024, ...opcoes });
  if (resultado.error) throw resultado.error;
  assert.equal(resultado.status, 0, `${path.basename(comando)} falhou: ${resultado.stderr}`);
  return resultado.stdout.trim();
}

function validarBanco(url) {
  const destino = new URL(url);
  assert.equal(destino.protocol, 'postgresql:');
  assert.equal(destino.hostname, '127.0.0.1');
  assert.equal(destino.pathname, '/waveops_site_test');
  assert.equal(destino.username, 'postgres');
  assert.equal(destino.password, '');
  assert.ok(Number(destino.port) >= 1024);
}

async function aguardar(condicao, mensagem, limiteMs = 60_000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (await condicao()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(mensagem);
}

async function portaLivre() {
  const servidor = http.createServer();
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });
  const porta = servidor.address().port;
  await new Promise((resolve, reject) => servidor.close((erro) => erro ? reject(erro) : resolve()));
  return porta;
}

function fetchLocal(destino, opcoes = {}) {
  assert.equal(new URL(destino).origin, appUrl, 'O teste só pode chamar seu portal local.');
  return fetch(destino, { ...opcoes, redirect: 'manual',
    headers: { Origin: origem, 'User-Agent': userAgent, ...opcoes.headers } });
}

async function enviar(rota, corpo) {
  let respostaHttp;
  idAvisoEsperado = corpo.idEnvio;
  const resultado = await enviarJson(`${appUrl}${rota}`, corpo, { tempoLimiteMs: 60_000,
    fetchImpl: async (destino, opcoes) => {
      respostaHttp = await fetchLocal(destino, opcoes);
      return respostaHttp;
    } });
  assert.ok(respostaHttp, 'Não houve resposta HTTP do portal local.');
  verificarRespostaPublica(respostaHttp, origem);
  return resultado;
}

function contexto(pagina) {
  return { idEnvio: randomUUID(), agora: new Date(), preenchidoEmMs: 2000,
    pagina, politicaVersao: 'fixture-h5', cienciaTextoVersao: 'fixture-ciencia',
    marketingTextoVersao: 'fixture-marketing', atribuicao: {
      fonte: 'h5/local', landingUrl: 'https://waveops.com.br/solucoes/', referrer: 'example.test',
      utm: { source: 'h5', medium: 'local', campaign: 'integracao', content: 'form', term: 'teste' },
    } };
}

function contato() {
  return montarLead({ nome: 'Pessoa Teste', empresa: 'Empresa Teste', canalRetorno: 'email',
    telefone: '', email: ' CONTATO@EXAMPLE.TEST ', mensagem: 'Mensagem fictícia de integração local.',
    politicaCiente: true, marketingAceito: false, website: '' },
  { dor: 'Ferramentas que não conversam', procura: 'Projeto sob medida', melhorHorario: '' }, contexto('/contato/'));
}

function interesse() {
  return montarInteresse({ email: ' INTERESSE@EXAMPLE.TEST ', politicaCiente: true,
    marketingAceito: false, website: '' }, contexto('/plataforma/'));
}

before(async () => {
  // O Docker também precisa ser local, mesmo se a máquina tiver contextos remotos.
  const endpoint = executar(docker, ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
  assert.match(endpoint, /^(npipe:\/\/|unix:\/\/)/, 'Use somente um engine Docker local.');
  const imagem = executar(docker, ['image', 'inspect', 'postgres:16', '--format', '{{.Id}}']);
  assert.match(imagem, /^sha256:[a-f0-9]{64}$/);
  const clienteGerado = await readFile(path.join(portal, 'node_modules/.prisma/client/index.js'), 'utf8');
  const caminhosEnv = clienteGerado.match(/"relativeEnvPaths":\s*(\{[^}]*\})/);
  assert.ok(caminhosEnv, 'Não foi possível conferir referências de ambiente do Prisma instalado.');
  verificarPrismaSemEnv(JSON.parse(caminhosEnv[1]));
  const evidencias = path.join(repo, '.tmp-qa', 'h5-integracao');
  await mkdir(evidencias, { recursive: true });
  pasta = await mkdtemp(path.join(evidencias, 'execucao-'));
  const appPasta = path.join(pasta, 'portal');
  await mkdir(appPasta);
  // Lista explícita: nenhuma variante de .env ou configuração pessoal é copiada.
  for (const item of ['src', 'public', 'prisma', 'package.json', 'package-lock.json', 'next.config.mjs',
    'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs', 'tailwind.config.ts']) {
    await cp(path.join(portal, item), path.join(appPasta, item), { recursive: true });
  }
  await symlink(path.join(portal, 'node_modules'), path.join(appPasta, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir');
  containerTentado = true;
  executar(docker, ['run', '--detach', '--rm', '--name', nomeContainer,
    '--label', 'com.waveops.qa=h5-local', '--label', `com.waveops.qa.run=${execucao}`,
    '--memory', '256m', '--cpus', '0.5', '--pids-limit', '128',
    '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_DB=waveops_site_test',
    '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', imagem]);
  const portaBanco = executar(docker, ['port', nomeContainer, '5432/tcp']);
  assert.match(portaBanco, /^127\.0\.0\.1:\d+$/);
  const databaseUrl = `postgresql://postgres@${portaBanco}/waveops_site_test?connect_timeout=1`;
  validarBanco(databaseUrl);
  ambiente = { ...processoEnv, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl,
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', AUTH_ENFORCED: 'true',
    SESSION_SECRET: chave, ADMIN_EMAIL: 'admin@example.test', ADMIN_PASSWORD: randomBytes(32).toString('hex'),
    CRON_SECRET: randomBytes(32).toString('hex'), PAYMENT_GATEWAY: 'mock' };
  await aguardar(() => {
    const estado = spawnSync(docker, ['exec', nomeContainer, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'waveops_site_test'],
      { env: processoEnv, encoding: 'utf8', windowsHide: true, timeout: 3000 });
    return estado.status === 0;
  }, 'O PostgreSQL local não ficou pronto.');
  banco = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await aguardar(async () => {
    try {
      await banco.$connect();
      await banco.$queryRaw`SELECT 1`;
      return true;
    } catch (erro) {
      if ((erro.code ?? erro.errorCode) === 'P1001') return false;
      throw erro;
    }
  }, 'O PostgreSQL não aceitou uma consulta pela porta local publicada.');
  executar(process.execPath, [path.join(portal, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    { cwd: appPasta, env: ambiente });
  assert.equal(await banco.lead.count(), 0);
  assert.equal(await banco.evento.count(), 0);
  receptor = http.createServer(async (req, res) => {
    try {
      const partes = [];
      for await (const parte of req) partes.push(parte);
      const { content } = JSON.parse(Buffer.concat(partes).toString('utf8'));
      const envio = idAvisoEsperado;
      const linha = await banco.lead.findUnique({ where: { idEnvio: envio } });
      avisos.push({ content, envio, persistido: linha !== null });
      res.writeHead(204).end();
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => {
    receptor.once('error', reject);
    receptor.listen(0, '127.0.0.1', resolve);
  });
  const portaApp = await portaLivre();
  appUrl = `http://127.0.0.1:${portaApp}`;
  Object.assign(ambiente, { APP_URL: appUrl, NEXT_PUBLIC_APP_URL: appUrl,
    DISCORD_WEBHOOK_URL: `http://127.0.0.1:${receptor.address().port}/aviso` });
  app = spawn(process.execPath, [path.join(portal, 'node_modules/next/dist/bin/next'), 'dev', '--webpack',
    '--hostname', '127.0.0.1', '--port', String(portaApp)],
  { cwd: appPasta, env: ambiente, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  app.stdout.on('data', (parte) => { saidaApp += parte.toString(); });
  app.stderr.on('data', (parte) => { saidaApp += parte.toString(); });
  app.on('error', (erro) => { saidaApp += erro.message; });
  await aguardar(async () => {
    assert.equal(app.exitCode, null, 'O processo local do Next terminou durante o boot.');
    try { return (await fetchLocal(`${appUrl}/api/site/contato`, { method: 'OPTIONS',
      signal: AbortSignal.timeout(3000) })).status === 204; } catch { return false; }
  }, 'O portal isolado não ficou pronto.', 120_000);
  async function sessao(role) {
    const token = await new SignJWT({ role, email: `${role}@example.test` }).setSubject(`fixture-${role}`)
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m')
      .sign(new TextEncoder().encode(chave));
    return `waveops_session=${token}`;
  }
  cookieAdmin = await sessao('admin');
  cookieCliente = await sessao('customer');
}, { timeout: 180_000 });

after(async () => {
  const erros = [];
  if (app) {
    try {
      await encerrarProcessoProprio(app, { terminarArvore: (pid) =>
        executar('taskkill.exe', ['/PID', String(pid), '/T', '/F']) });
    } catch (erro) { erros.push(erro); }
  }
  if (receptor) {
    try { await new Promise((resolve, reject) => receptor.close((erro) => erro ? reject(erro) : resolve())); }
    catch (erro) { erros.push(erro); }
  }
  if (banco) { try { await banco.$disconnect(); } catch (erro) { erros.push(erro); } }
  if (containerTentado) {
    try {
      encerrarContainerProprio(nomeContainer, execucao, (args) => spawnSync(docker, args,
        { env: processoEnv, encoding: 'utf8', windowsHide: true, timeout: 15_000 }));
    } catch (erro) { erros.push(erro); }
  }
  if (pasta) {
    // Logs só do ambiente fictício. Tokens e chaves efêmeros nunca são gravados.
    let seguro = saidaApp;
    for (const segredo of [chave, ambiente?.ADMIN_PASSWORD, ambiente?.CRON_SECRET, cookieAdmin, cookieCliente,
      cookieAdmin?.split('=')[1], cookieCliente?.split('=')[1]]) {
      if (segredo) seguro = seguro.replaceAll(segredo, '[omitido]');
    }
    await writeFile(path.join(pasta, 'portal.log'), seguro);
    console.log(`Evidência local: ${path.relative(repo, pasta)}`);
  }
  if (erros.length) throw new AggregateError(erros, 'Falha ao encerrar recursos próprios do teste.');
});

test('CORS e autorização passam pelas rotas reais do portal', { timeout: 60_000 }, async () => {
  for (const rota of ['/api/site/contato', '/api/site/interesse']) {
    const resposta = await fetchLocal(`${appUrl}${rota}`, { method: 'OPTIONS' });
    verificarPreflight(resposta, origem);
  }
  for (const [cookie, status] of [[undefined, 401], [cookieCliente, 403]]) {
    const resposta = await fetchLocal(`${appUrl}/api/leads/consulta`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: '{}' });
    assert.equal(resposta.status, status);
  }
});

test('payload e envio reais do site gravam contato, versões, atribuição e aviso', { timeout: 60_000 }, async () => {
  const corpo = contato();
  const resposta = await enviar('/api/site/contato', corpo);
  assert.deepEqual(resposta, { ok: true, status: 200, protocolo: corpo.idEnvio });
  const linha = await banco.lead.findUniqueOrThrow({ where: { idEnvio: corpo.idEnvio } });
  assert.equal(linha.email, 'contato@example.test');
  assert.equal(linha.canalRetorno, 'email');
  assert.equal(linha.telefone, null);
  assert.equal(linha.nome, 'Pessoa Teste');
  assert.equal(linha.mensagem, corpo.mensagem);
  assert.equal(linha.politicaVersao, 'fixture-h5');
  assert.equal(linha.cienciaTextoVersao, 'fixture-ciencia');
  assert.equal(linha.marketingAceito, false);
  assert.equal(linha.utmSource, 'h5');
  assert.equal(linha.utmCampaign, 'integracao');
  assert.equal(linha.primeiraFonte, 'h5/local');
  assert.equal(linha.pagina, '/contato/');
  await aguardar(() => avisos.length === 1, 'O aviso local do contato não chegou.');
  assert.equal(avisos[0].persistido, true);
  assert.equal(avisos[0].envio, corpo.idEnvio);
  assert.equal(avisos[0].content, `Novo lead pelo site (contato, retorno por e-mail). Veja no admin: ${appUrl}/admin/leads`);
  assert.equal((await enviar('/api/site/contato', corpo)).ok, true);
  assert.equal(await banco.lead.count({ where: { idEnvio: corpo.idEnvio } }), 1);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(avisos.length, 1, 'Reenvio não pode disparar outro aviso.');
});

test('lista persiste e deduplica só idEnvio, sem suprimir novo envio do mesmo e-mail', { timeout: 60_000 }, async () => {
  const corpo = interesse();
  for (let i = 0; i < 2; i++) assert.equal((await enviar('/api/site/interesse', corpo)).ok, true);
  assert.equal(await banco.lead.count({ where: { idEnvio: corpo.idEnvio } }), 1);
  await aguardar(() => avisos.length === 2, 'O aviso local da lista não chegou.');
  const novo = { ...corpo, idEnvio: randomUUID() };
  assert.equal((await enviar('/api/site/interesse', novo)).ok, true);
  assert.equal(await banco.lead.count({ where: { email: 'interesse@example.test' } }), 2);
  const linha = await banco.lead.findUniqueOrThrow({ where: { idEnvio: novo.idEnvio } });
  assert.equal(linha.finalidade, 'aviso_abertura_plataforma');
  assert.equal(linha.marketingAceito, false);
  await aguardar(() => avisos.length === 3, 'O aviso da nova inscrição não chegou.');
  assert.ok(avisos.every((aviso) => aviso.persistido));
  assert.equal(avisos[1].envio, corpo.idEnvio);
  assert.equal(avisos[2].envio, novo.idEnvio);
  for (const aviso of avisos) {
    assert.equal(/example\.test|Pessoa Teste|Mensagem fictícia/.test(aviso.content), false);
  }
});

test('recusa 422 volta ao módulo de envio sem gravar nem avisar', { timeout: 60_000 }, async () => {
  const quantidade = await banco.lead.count();
  const resposta = await enviar('/api/site/contato', { ...contato(), email: 'teste@' });
  assert.equal(resposta.ok, false);
  assert.equal(resposta.status, 422);
  assert.equal(resposta.motivo, 'validacao');
  assert.ok(resposta.campos.includes('email'));
  assert.equal(await banco.lead.count(), quantidade);
  assert.equal(avisos.length, 3);
});

test('honeypot responde sem criar lead ou aviso no ambiente integrado', { timeout: 60_000 }, async () => {
  const corpo = { ...contato(), website: 'fixture-robo' };
  const quantidade = await banco.lead.count();
  assert.equal((await enviar('/api/site/contato', corpo)).ok, true);
  assert.equal(await banco.lead.count(), quantidade);
  assert.equal(avisos.length, 3);
});

test('admin autenticado consulta os dados gravados sem expor visitorId e idEnvio', { timeout: 60_000 }, async () => {
  const resposta = await fetchLocal(`${appUrl}/api/leads/consulta`, { method: 'POST',
    headers: { Cookie: cookieAdmin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get('cache-control'), 'no-store');
  const lista = await resposta.json();
  assert.equal(lista.total, 3);
  assert.equal(lista.leads.length, 3);
  assert.equal(lista.leads.filter((lead) => lead.tipo === 'interesse').length, 2);
  for (const lead of lista.leads) {
    assert.equal('visitorId' in lead, false);
    assert.equal('idEnvio' in lead, false);
    const linha = await banco.lead.findUniqueOrThrow({ where: { id: lead.id } });
    for (const campo of ['nome', 'empresa', 'email', 'telefone', 'mensagem', 'tipo', 'status', 'canalRetorno',
      'finalidade', 'politicaVersao', 'cienciaTextoVersao', 'marketingAceito', 'marketingTextoVersao',
      'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'referrer', 'landingUrl', 'primeiraFonte', 'pagina']) {
      assert.equal(lead[campo], linha[campo], `O admin mudou o campo ${campo}.`);
    }
    assert.equal(lead.createdAt, linha.createdAt.toISOString());
  }
});

test('quatro sinais atravessam a rota real e compartilham visitante com o lead', { timeout: 60_000 }, async () => {
  for (const nome of ['visita', 'lead_enviado', 'interesse_plataforma', 'whatsapp_click']) {
    const resposta = await fetchLocal(`${appUrl}/api/e`, { method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ n: nome, u: '/', f: 'h5/local' }) });
    assert.equal(resposta.status, 204);
  }
  const eventos = await banco.evento.findMany();
  assert.deepEqual(eventos.map((evento) => evento.nome).sort(),
    ['visita', 'lead_enviado', 'interesse_plataforma', 'whatsapp_click'].sort());
  const linha = await banco.lead.findFirstOrThrow({ where: { tipo: 'contato' } });
  assert.ok(eventos.every((evento) => evento.origem === 'landing' && evento.visitorId === linha.visitorId));
});

test('funil do admin renderiza os eventos reais do banco isolado', { timeout: 60_000 }, async () => {
  const resposta = await fetchLocal(`${appUrl}/admin/funil`, { headers: { Cookie: cookieAdmin } });
  assert.equal(resposta.status, 200);
  const html = await resposta.text();
  assert.equal(html.includes('A medição não está gravando'), false);
  assert.equal(html.includes('Sem banco configurado'), false);
  assert.equal(html.includes('Nenhum evento ainda'), false);
  verificarFunilRenderizado(html, [
    { rotulo: 'Visita', visitantes: 1, eventos: 1 },
    { rotulo: 'Lead enviado', visitantes: 1, eventos: 1 },
    { rotulo: 'Lista de interesse da Plataforma', visitantes: 1 },
    { rotulo: 'Clique no WhatsApp', visitantes: 1 },
  ]);
});
