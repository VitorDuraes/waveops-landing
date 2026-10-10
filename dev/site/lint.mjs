// @ts-check
/* Lint do HTML do site institucional. Sem dependência: regras por expressão regular
   sobre a marcação que nós mesmos escrevemos, não sobre HTML qualquer.

   Uso (a partir da raiz do repo):
     node dev/site/lint.mjs               todas as páginas de dev/site/paginas.json
     node dev/site/lint.mjs contato/index.html

   Saída: "arquivo:linha: regra: mensagem". Sai com 1 se houver erro. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerPaginas, executadoDireto } from './build.mjs';

/**
 * @typedef {{ arquivo: string, linha: number, regra: string, mensagem: string }} ErroLint
 * @typedef {{
 *   arquivo: string,
 *   url: string,
 *   indexavel?: boolean,
 *   dominio: string,
 *   paginas: Map<string, Set<string>>,
 *   arquivos: Set<string>,
 * }} ContextoLint
 */

const TITULO_MAX = 60;
const DESCRICAO_MAX = 155;
const TRAVESSAO = /[\u2013\u2014]|&(?:mdash|ndash);|&#(?:8211|8212);|&#x201[34];/gi;
const ESQUEMA_PERMITIDO = /^(?:\/|#|https?:|mailto:|tel:|data:)/i;
const TIPOS_SEM_ROTULO = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

/** @param {string} texto */
function comprimentoVisivel(texto) {
  return texto.trim().replace(/&#?[a-z0-9]+;/gi, '_').length;
}

/** @param {string} html */
function criarLocalizador(html) {
  /** @type {number[]} */
  const quebras = [];
  for (let i = html.indexOf('\n'); i !== -1; i = html.indexOf('\n', i + 1)) quebras.push(i);
  /** @param {number} indice */
  return (indice) => {
    let baixo = 0;
    let alto = quebras.length;
    while (baixo < alto) {
      const meio = (baixo + alto) >> 1;
      if (quebras[meio] < indice) baixo = meio + 1;
      else alto = meio;
    }
    return baixo + 1;
  };
}

/** Troca comentários por espaços, mantendo as posições e as quebras de linha. @param {string} html */
function semComentarios(html) {
  return html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
}

/** @param {string} tag @param {string} nome */
function atributo(tag, nome) {
  const m = new RegExp(`\\s${nome}="([^"]*)"`, 'i').exec(tag);
  return m ? m[1] : undefined;
}

/**
 * Ids de uma página, sem contar os que estão em comentário.
 * @param {string} html
 */
export function coletarIds(html) {
  return new Set([...semComentarios(html).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

/**
 * Roda todas as regras sobre uma página.
 * @param {string} html
 * @param {ContextoLint} ctx
 * @returns {ErroLint[]}
 */
export function lintarHtml(html, ctx) {
  /** @type {ErroLint[]} */
  const erros = [];
  const linhaDe = criarLocalizador(html);
  /** @param {string} regra @param {number} indice @param {string} mensagem */
  const acusar = (regra, indice, mensagem) => erros.push({ arquivo: ctx.arquivo, linha: linhaDe(indice), regra, mensagem });
  const limpo = semComentarios(html);

  if (!/^\s*<!doctype html>/i.test(html)) acusar('doctype', 0, 'falta <!doctype html> no início');
  const tagHtml = /<html\b[^>]*>/i.exec(limpo);
  if (!tagHtml || atributo(tagHtml[0], 'lang') !== 'pt-BR') acusar('lang', tagHtml?.index ?? 0, '<html> precisa de lang="pt-BR"');

  const iHead = limpo.search(/<head\b[^>]*>/i);
  const iFimHead = limpo.search(/<\/head>/i);
  const head = iHead !== -1 && iFimHead !== -1 ? limpo.slice(iHead, iFimHead) : '';
  const corpoInicio = iFimHead === -1 ? 0 : iFimHead;

  if (!/^<head\b[^>]*>\s*<meta\s+charset="utf-8"\s*\/?>/i.test(head)) {
    acusar('charset', Math.max(iHead, 0), '<meta charset="utf-8"> tem de ser a primeira tag do <head>');
  }

  const iCsp = head.search(/<meta\s+http-equiv="Content-Security-Policy"/i);
  const iRecurso = head.search(/<(link|script|style)\b/i);
  if (iCsp === -1) acusar('csp', Math.max(iHead, 0), 'falta a <meta> de Content-Security-Policy');
  else if (iRecurso !== -1 && iRecurso < iCsp) acusar('csp', iHead + iRecurso, 'a CSP tem de vir antes de qualquer link, script ou style');

  const titulos = [...head.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
  if (titulos.length !== 1) acusar('titulo', Math.max(iHead, 0), `precisa de exatamente 1 <title>, achei ${titulos.length}`);
  else if (!titulos[0][1].trim()) acusar('titulo', iHead + (titulos[0].index ?? 0), '<title> vazio');
  else if (comprimentoVisivel(titulos[0][1]) > TITULO_MAX) {
    acusar('titulo', iHead + (titulos[0].index ?? 0), `<title> com mais de ${TITULO_MAX} caracteres`);
  }

  const descricao = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(head);
  if (!descricao || !descricao[1].trim()) acusar('descricao', Math.max(iHead, 0), 'falta a meta description');
  else if (comprimentoVisivel(descricao[1]) > DESCRICAO_MAX) {
    acusar('descricao', iHead + descricao.index, `meta description com mais de ${DESCRICAO_MAX} caracteres`);
  }

  if (ctx.indexavel === false) {
    if (!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(head)) {
      acusar('robots', Math.max(iHead, 0), 'página não indexável precisa de <meta name="robots" content="noindex">');
    }
  } else {
    const canonical = /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(head);
    const esperado = ctx.dominio + ctx.url;
    if (!canonical || canonical[1] !== esperado) {
      acusar('canonical', canonical ? iHead + canonical.index : Math.max(iHead, 0), `canonical tem de ser ${esperado}`);
    }
  }

  const corpo = limpo.slice(corpoInicio);
  const h1s = [...corpo.matchAll(/<h1\b/gi)];
  if (h1s.length !== 1) acusar('h1', corpoInicio + (h1s[1]?.index ?? 0), `precisa de exatamente 1 <h1>, achei ${h1s.length}`);
  let nivelAnterior = 0;
  for (const m of corpo.matchAll(/<h([1-6])\b/gi)) {
    const nivel = Number(m[1]);
    if (nivel > nivelAnterior + 1) {
      acusar('titulos', corpoInicio + (m.index ?? 0), `heading pula de h${nivelAnterior} para h${nivel}`);
    }
    nivelAnterior = nivel;
  }

  /** @type {Set<string>} */
  const ids = new Set();
  for (const m of limpo.matchAll(/\sid="([^"]+)"/g)) {
    if (ids.has(m[1])) acusar('id-duplicado', m.index ?? 0, `id repetido: ${m[1]}`);
    ids.add(m[1]);
  }

  // Trechos <label>...</label>: campo dentro de um deles tem rótulo implícito.
  const trechosLabel = [...limpo.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
  /** @param {number} indice */
  const dentroDeLabel = (indice) => trechosLabel.some(([inicio, fim]) => indice > inicio && indice < fim);

  for (const m of limpo.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/gi)) {
    const tag = m[0];
    const indice = m.index ?? 0;
    const nome = /^<([a-z0-9-]+)/i.exec(tag)?.[1].toLowerCase() ?? '';
    const semValores = tag.replace(/"[^"]*"/g, '""');

    if (/(?:\s|")on[a-z]+\s*=/i.test(semValores)) acusar('evento-inline', indice, `evento inline em <${nome}>: use addEventListener`);
    if (/\s(href|src|action)="\s*javascript:/i.test(tag)) acusar('javascript-url', indice, 'URL javascript: é proibida');
    if (/\s(href|src)="http:\/\//i.test(tag)) acusar('http', indice, 'use https://');
    if (nome === 'img' && atributo(tag, 'alt') === undefined) acusar('img-alt', indice, '<img> sem alt (use alt="" se for decorativa)');
    if (nome === 'button' && atributo(tag, 'type') === undefined) acusar('botao-type', indice, '<button> sem type');
    if (nome === 'svg' && (atributo(tag, 'width') === undefined || atributo(tag, 'height') === undefined)) {
      acusar('svg-tamanho', indice, '<svg> sem width e height: se o CSS não carregar, ele ocupa a largura toda (use width="1em" height="1em")');
    }
    if (atributo(tag, 'target') === '_blank' && !/\bnoopener\b/.test(atributo(tag, 'rel') ?? '')) {
      acusar('blank-rel', indice, 'target="_blank" exige rel="noopener"');
    }

    if (nome === 'input' || nome === 'select' || nome === 'textarea') {
      const tipo = (atributo(tag, 'type') ?? '').toLowerCase();
      const rotulado = atributo(tag, 'aria-label') || atributo(tag, 'aria-labelledby');
      const id = atributo(tag, 'id');
      const temLabel =
        dentroDeLabel(indice) ||
        (id !== undefined && new RegExp(`<label\\b[^>]*\\sfor="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i').test(limpo));
      if (!(nome === 'input' && TIPOS_SEM_ROTULO.has(tipo)) && !rotulado && !temLabel) {
        acusar('rotulo', indice, `<${nome}${id ? ` id="${id}"` : ''}> sem <label for> nem aria-label`);
      }
    }

    for (const attr of ['aria-controls', 'aria-describedby', 'aria-labelledby', 'for']) {
      const valor = atributo(tag, attr);
      if (valor === undefined || (attr === 'for' && nome !== 'label')) continue;
      for (const ref of valor.split(/\s+/).filter(Boolean)) {
        if (!ids.has(ref)) acusar('referencia-aria', indice, `${attr}="${ref}" aponta para id que não existe`);
      }
    }

    for (const attr of ['href', 'src']) {
      const valor = atributo(tag, attr);
      if (valor === undefined) continue;
      if (!ESQUEMA_PERMITIDO.test(valor) && !/^javascript:/i.test(valor)) {
        acusar('link-relativo', indice, `${attr}="${valor}": use caminho a partir da raiz (/...) ou URL completa`);
        continue;
      }
      const problema = verificarLinkInterno(valor, ctx, ids);
      if (problema) acusar('link-interno', indice, problema);
    }

    if (nome === 'meta' && /^(og:image|twitter:image)$/.test(atributo(tag, 'property') ?? atributo(tag, 'name') ?? '')) {
      const imagem = atributo(tag, 'content') ?? '';
      const caminho = imagem.startsWith(ctx.dominio + '/') ? imagem.slice(ctx.dominio.length) : '';
      if (!caminho || !ctx.arquivos.has(caminho)) acusar('og-imagem', indice, `imagem de compartilhamento não existe no site: ${imagem}`);
    }
  }

  for (const m of limpo.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const tipo = atributo(attrs, 'type') ?? '';
    if (tipo === 'application/ld+json') {
      try {
        JSON.parse(m[2]);
      } catch {
        acusar('json-ld', m.index ?? 0, 'JSON-LD inválido');
      }
    } else if (atributo(attrs, 'src') === undefined) {
      acusar('script-inline', m.index ?? 0, 'script inline viola a CSP: mova para arquivo em /assets/');
    }
  }

  for (const m of html.matchAll(TRAVESSAO)) {
    acusar('travessao', m.index ?? 0, 'travessão ou meia-risca: troque por ponto, vírgula ou dois-pontos');
  }

  /** @type {Map<string, number>} */
  const saldo = new Map();
  for (const m of html.matchAll(/<!--\s*(\/?)parcial:([a-z0-9-]+)/g)) {
    saldo.set(m[2], (saldo.get(m[2]) ?? 0) + (m[1] ? -1 : 1));
  }
  for (const [nome, valor] of saldo) if (valor !== 0) acusar('parcial', 0, `marcadores do parcial ${nome} desbalanceados`);

  return erros;
}

/**
 * @param {string} valor
 * @param {ContextoLint} ctx
 * @param {Set<string>} idsPagina
 * @returns {string | undefined}
 */
function verificarLinkInterno(valor, ctx, idsPagina) {
  if (valor === '#') return 'href="#" não leva a lugar nenhum';
  if (valor.startsWith('#')) {
    return idsPagina.has(valor.slice(1)) ? undefined : `âncora ${valor} não existe nesta página`;
  }
  if (!valor.startsWith('/') || valor.startsWith('//')) return undefined;
  const [semHash, ancora] = valor.split('#');
  const caminho = semHash.split('?')[0];
  const ehPagina = ctx.paginas.has(caminho) || caminho === ctx.url;
  if (ehPagina) {
    if (!ancora) return undefined;
    const idsAlvo = caminho === ctx.url ? idsPagina : ctx.paginas.get(caminho);
    return idsAlvo?.has(ancora) ? undefined : `âncora #${ancora} não existe em ${caminho}`;
  }
  if (ctx.arquivos.has(caminho)) return undefined;
  if (!path.extname(caminho) && !caminho.endsWith('/') && ctx.paginas.has(caminho + '/')) {
    return `use barra final: ${caminho}/`;
  }
  return `destino interno não existe: ${caminho}`;
}

/** @param {string} raiz @returns {Set<string>} */
function listarArquivosPublicos(raiz) {
  /** @type {Set<string>} */
  const arquivos = new Set();
  /** @param {string} dir */
  const andar = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, item.name);
      if (item.isDirectory()) andar(abs);
      else arquivos.add('/' + path.relative(raiz, abs).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(path.join(raiz, 'assets'))) andar(path.join(raiz, 'assets'));
  for (const item of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (item.isFile()) arquivos.add('/' + item.name);
  }
  return arquivos;
}

/**
 * Travessão em arquivo que não é HTML: JavaScript e CSS do site e textos publicados.
 * @param {string} raiz
 * @returns {ErroLint[]}
 */
export function lintarTextos(raiz) {
  /** @type {string[]} */
  const alvos = ['llms.txt', 'robots.txt', 'assets/funil.js'];
  /** @param {string} dir */
  const andar = (dir) => {
    if (!fs.existsSync(path.join(raiz, dir))) return;
    for (const item of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
      const rel = `${dir}/${item.name}`;
      if (item.isDirectory()) andar(rel);
      else if (/\.(m?js|css)$/.test(item.name)) alvos.push(rel);
    }
  };
  andar('assets/site');
  /** @type {ErroLint[]} */
  const erros = [];
  for (const rel of alvos) {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) continue;
    const texto = fs.readFileSync(abs, 'utf8');
    const linhaDe = criarLocalizador(texto);
    for (const m of texto.matchAll(TRAVESSAO)) {
      erros.push({ arquivo: rel, linha: linhaDe(m.index ?? 0), regra: 'travessao', mensagem: 'travessão ou meia-risca: troque por ponto, vírgula ou dois-pontos' });
    }
  }
  return erros;
}

if (executadoDireto(import.meta.url)) {
  const argumentos = process.argv.slice(2);
  const iRaiz = argumentos.indexOf('--raiz');
  const raiz = iRaiz !== -1 && argumentos[iRaiz + 1] ? path.resolve(argumentos[iRaiz + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const config = lerPaginas(raiz);
  const pedidos = argumentos.filter((a, i) => a !== '--raiz' && argumentos[i - 1] !== '--raiz').map((a) => a.split(path.sep).join('/'));
  const arquivos = listarArquivosPublicos(raiz);
  /** @type {Map<string, Set<string>>} */
  const paginas = new Map();
  /** @type {ErroLint[]} */
  const erros = [];
  for (const p of config.paginas) {
    const abs = path.join(raiz, p.arquivo);
    if (fs.existsSync(abs)) paginas.set(p.url, coletarIds(fs.readFileSync(abs, 'utf8')));
    else erros.push({ arquivo: p.arquivo, linha: 0, regra: 'pagina-ausente', mensagem: 'listada em dev/site/paginas.json e sem arquivo' });
  }
  if (!pedidos.length) erros.push(...lintarTextos(raiz));
  let lidas = 0;
  for (const p of config.paginas) {
    if (pedidos.length && !pedidos.includes(p.arquivo)) continue;
    const abs = path.join(raiz, p.arquivo);
    if (!fs.existsSync(abs)) continue;
    lidas += 1;
    erros.push(...lintarHtml(fs.readFileSync(abs, 'utf8'), {
      arquivo: p.arquivo, url: p.url, indexavel: p.indexavel, dominio: config.dominio, paginas, arquivos,
    }));
  }
  for (const e of erros) console.log(`${e.arquivo}:${e.linha}: ${e.regra}: ${e.mensagem}`);
  console.log(`lint: ${lidas} página(s), ${erros.length} erro(s)`);
  process.exit(erros.length ? 1 : 0);
}
