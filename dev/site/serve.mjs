// @ts-check
/* Servidor local do site institucional, sem dependência.

   Imita o que importa do Netlify: URL com barra final (/solucoes/ serve
   solucoes/index.html), 301 de /solucoes para /solucoes/ e 404.html com status 404.
   Também responde os endpoints simulados que o site usa fora de produção, para
   nenhum teste local mandar lead de mentira para o n8n de verdade:

     POST /__dev/lead        200 {"ok":true,"protocolo":<idEnvio>}
     POST /__dev/interesse   idem
     ?simular=falha          503
     ?simular=validacao      422 {"ok":false,"erro":"validacao","campos":["email"]}
     ?simular=lento          responde depois de 15 s (o site desiste em 12 s)
     POST /api/e             204, como o endpoint de funil do portal (o funil.js usa
                             caminho relativo em localhost)

   Proteções (o servidor roda na raiz do repo, onde também estão .git e portal/):
   só responde com Host local (127.0.0.1, localhost), o que fecha DNS rebinding; nega
   qualquer segmento que comece com ponto; e, se a raiz tiver netlify.toml, só serve o
   que o cp do Netlify publica, mais dev/site/ para as ferramentas de QA.

   Uso: node dev/site/serve.mjs [--port 4321] [--root .tmp-site] */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executadoDireto, lerNetlify } from './build.mjs';

/** @type {Record<string, string>} */
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
};
const ENDPOINTS = new Set(['/__dev/lead', '/__dev/interesse']);
const CORPO_MAX = 16 * 1024;

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {unknown} dados
 */
function responderJson(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(dados));
}

/** @param {http.IncomingMessage} req @returns {Promise<string>} */
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    /** @type {Buffer[]} */
    const partes = [];
    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > CORPO_MAX) {
        reject(new Error('corpo grande demais'));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @param {number} atrasoLentoMs
 */
async function endpointSimulado(req, res, url, atrasoLentoMs) {
  if (!ENDPOINTS.has(url.pathname)) return responderJson(res, 404, { ok: false });
  if (req.method !== 'POST') return responderJson(res, 405, { ok: false });
  let dados;
  try {
    dados = JSON.parse((await lerCorpo(req)) || '{}');
  } catch {
    return responderJson(res, 400, { ok: false, erro: 'corpo' });
  }
  const simular = url.searchParams.get('simular');
  if (simular === 'lento') await new Promise((ok) => setTimeout(ok, atrasoLentoMs));
  if (simular === 'falha') return responderJson(res, 503, { ok: false, erro: 'indisponivel' });
  if (simular === 'validacao') return responderJson(res, 422, { ok: false, erro: 'validacao', campos: ['email'] });
  console.log(`${req.method} ${url.pathname} 200 campos: ${Object.keys(dados).join(', ')}`);
  return responderJson(res, 200, { ok: true, protocolo: String(dados.idEnvio ?? 'dev') });
}

/** @param {string} abs */
function estado(abs) {
  try {
    return fs.statSync(abs);
  } catch {
    return undefined;
  }
}

/**
 * Cria o servidor (sem chamar listen).
 * @param {{ raiz: string, atrasoLentoMs?: number }} opcoes
 */
export function criarServidor({ raiz, atrasoLentoMs = 15000 }) {
  const raizAbs = path.resolve(raiz);
  const toml = path.join(raizAbs, 'netlify.toml');
  /** @type {Set<string> | null} primeiro segmento permitido, ou null para servir tudo */
  let permitidos = null;
  if (fs.existsSync(toml)) {
    const { arquivos, pastas } = lerNetlify(fs.readFileSync(toml, 'utf8'));
    permitidos = new Set([...arquivos, ...pastas, 'dev']);
  }

  /** @param {string} caminho caminho decodificado da URL */
  const liberado = (caminho) => {
    const segmentos = caminho.split('/').filter(Boolean);
    if (segmentos.some((s) => s.startsWith('.'))) return false;
    if (!permitidos || !segmentos.length) return true;
    if (segmentos[0] === 'dev') return segmentos[1] === 'site';
    return permitidos.has(segmentos[0]);
  };

  /** @param {http.ServerResponse} res @param {string} abs @param {number} status @param {boolean} cabeca */
  const enviarArquivo = (res, abs, status, cabeca) => {
    res.writeHead(status, {
      'Content-Type': TIPOS[path.extname(abs).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    if (cabeca) return res.end();
    fs.createReadStream(abs)
      .on('error', () => res.destroy())
      .pipe(res);
  };

  /** @param {http.ServerResponse} res @param {boolean} cabeca */
  const naoEncontrado = (res, cabeca) => {
    const pagina = path.join(raizAbs, '404.html');
    if (estado(pagina)?.isFile()) return enviarArquivo(res, pagina, 404, cabeca);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  };

  return http.createServer(async (req, res) => {
    try {
      const host = (req.headers.host ?? '').replace(/:\d+$/, '');
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
        res.writeHead(421, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('host não permitido');
      }
      const url = new URL(req.url ?? '/', 'http://local');
      if (url.pathname.startsWith('/__dev/')) return await endpointSimulado(req, res, url, atrasoLentoMs);
      if (url.pathname === '/api/e' && req.method === 'POST') {
        await lerCorpo(req).catch(() => '');
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        return res.end();
      }
      const cabeca = req.method === 'HEAD';
      if (req.method !== 'GET' && !cabeca) {
        res.writeHead(405);
        return res.end();
      }
      let caminho;
      try {
        caminho = decodeURIComponent(url.pathname);
      } catch {
        return naoEncontrado(res, cabeca);
      }
      const alvo = path.resolve(raizAbs, '.' + caminho);
      if (alvo !== raizAbs && !alvo.startsWith(raizAbs + path.sep)) return naoEncontrado(res, cabeca);
      if (!liberado(caminho)) return naoEncontrado(res, cabeca);
      const info = estado(alvo);
      if (info?.isDirectory()) {
        if (!caminho.endsWith('/')) {
          res.writeHead(301, { Location: url.pathname + '/' + url.search });
          return res.end();
        }
        const indice = path.join(alvo, 'index.html');
        return estado(indice)?.isFile() ? enviarArquivo(res, indice, 200, cabeca) : naoEncontrado(res, cabeca);
      }
      if (info?.isFile()) return enviarArquivo(res, alvo, 200, cabeca);
      return naoEncontrado(res, cabeca);
    } catch (erro) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(erro instanceof Error ? erro.message : erro));
    }
  });
}

if (executadoDireto(import.meta.url)) {
  const args = process.argv.slice(2);
  /** @param {string} nome @param {string} padrao */
  const opcao = (nome, padrao) => {
    const i = args.indexOf(nome);
    return i !== -1 && args[i + 1] ? args[i + 1] : padrao;
  };
  const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const raiz = path.resolve(opcao('--root', raizRepo));
  const porta = Number(opcao('--port', '4321'));
  criarServidor({ raiz }).listen(porta, '127.0.0.1', () => {
    console.log(`site em http://127.0.0.1:${porta}/ (raiz: ${raiz})`);
  });
}
