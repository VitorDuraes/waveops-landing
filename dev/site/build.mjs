// @ts-check
/* Carimbo de parciais e versionamento de assets do site institucional.

   Por que existe: as 6 páginas têm topo, rodapé e chamada final iguais. Injetar essas
   peças por JavaScript no navegador piora SEO, leitor de tela e quem navega sem JS.
   Então elas vivem em dev/site/parciais/ e são carimbadas no HTML. As páginas
   carimbadas são commitadas: o deploy do Netlify continua sendo cópia de arquivo.

   Uso (a partir da raiz do repo):
     node dev/site/build.mjs              carimba e versiona, gravando os arquivos
     node dev/site/build.mjs --check      sai com 1 se alguma página ou módulo estiver desatualizado
     node dev/site/build.mjs --dist DIR   monta em DIR o que o cp do netlify.toml publica
     node dev/site/build.mjs --pagina contato/index.html   só a página indicada (repetível)

   Marcador:  <!-- parcial:topo ativo="solucoes" --> ... <!-- /parcial:topo -->
   No parcial: {{atual:solucoes}} vira aria-current="page" quando ativo="solucoes";
               {{nome}} vira o valor escapado do atributo nome="..." do marcador.

   Versão de cache: todo href/src para /assets/**.css|js|mjs ganha ?v=<8 hex do sha256>.
   Para módulo de assets/site/, o hash cobre também os módulos que ele importa: mudar
   uma lib muda o ?v= da página que carrega o módulo de entrada.

   Os imports entre módulos NÃO levam ?v=. O Netlify serve tudo com
   "Cache-Control: public,max-age=0,must-revalidate" e ETag (conferido ao vivo em
   09/10/2026), então o navegador revalida cada módulo e não sobra versão velha.
   Sem query no especificador, o TypeScript resolve os imports no typecheck. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ABRE_PARCIAL = /<!--\s*parcial:([a-z0-9-]+)((?:\s+[a-z0-9-]+="[^"]*")*)\s*-->/g;
const ATRIBUTO = /([a-z0-9-]+)="([^"]*)"/g;
const PLACEHOLDER = /\{\{([a-z0-9-]+)(?::([a-z0-9-]+))?\}\}/g;
const REF_ASSET = /\b(href|src)="(\/assets\/[^"?#]+\.(?:css|js|mjs))(?:\?v=[^"#]*)?"/g;
const IMPORT_RELATIVO = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"?#]+)\1/g;

/** @param {string} texto */
function escaparHtml(texto) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** @param {string} texto @returns {Record<string, string>} */
function lerAtributos(texto) {
  /** @type {Record<string, string>} */
  const attrs = {};
  for (const [, nome, valor] of texto.matchAll(ATRIBUTO)) attrs[nome] = valor;
  return attrs;
}

/** @param {string} nome @param {string} modelo @param {Record<string, string>} attrs */
function renderizar(nome, modelo, attrs) {
  return modelo.replace(/\s+$/, '').replace(PLACEHOLDER, (_, chave, alvo) => {
    if (chave === 'atual' && alvo) return attrs.ativo === alvo ? ' aria-current="page"' : '';
    if (alvo) throw new Error(`parcial ${nome}: placeholder desconhecido {{${chave}:${alvo}}}`);
    if (!(chave in attrs)) throw new Error(`parcial ${nome}: placeholder {{${chave}}} sem valor no marcador`);
    return escaparHtml(attrs[chave]);
  });
}

/**
 * Troca o miolo de cada marcador de parcial pelo conteúdo renderizado.
 * @param {string} html
 * @param {(nome: string) => string} lerParcial
 * @returns {string}
 */
export function carimbarParciais(html, lerParcial) {
  const abre = new RegExp(ABRE_PARCIAL.source, 'g');
  let saida = '';
  let pos = 0;
  let m;
  while ((m = abre.exec(html))) {
    const [marcador, nome, attrsTexto] = m;
    const fimMarcador = m.index + marcador.length;
    const fecha = new RegExp(`<!--\\s*/parcial:${nome}\\s*-->`, 'g');
    fecha.lastIndex = fimMarcador;
    const f = fecha.exec(html);
    if (!f) throw new Error(`marcador parcial:${nome} sem fechamento`);
    const inicioLinha = html.lastIndexOf('\n', m.index) + 1;
    const antes = html.slice(inicioLinha, m.index);
    const recuo = /^[ \t]*$/.test(antes) ? antes : '';
    const conteudo = renderizar(nome, lerParcial(nome), lerAtributos(attrsTexto));
    const recuado = conteudo
      .split('\n')
      .map((linha) => (linha ? recuo + linha : linha))
      .join('\n');
    saida += html.slice(pos, fimMarcador) + '\n' + recuado + '\n' + recuo;
    pos = f.index;
    abre.lastIndex = f.index + f[0].length;
  }
  return saida + html.slice(pos);
}

/**
 * Põe ?v=<hash> em todo CSS e JS de /assets/ referenciado no HTML.
 * @param {string} html
 * @param {(caminho: string) => string | undefined} hashDe
 */
export function versionarAssets(html, hashDe) {
  return html.replace(REF_ASSET, (_, attr, caminho) => {
    const versao = hashDe(caminho);
    if (!versao) throw new Error(`asset referenciado não existe: ${caminho}`);
    return `${attr}="${caminho}?v=${versao}"`;
  });
}

/**
 * Especificadores relativos que um módulo importa (estático, dinâmico e re-export).
 * @param {string} js
 * @returns {string[]}
 */
export function importsRelativos(js) {
  return [...js.matchAll(IMPORT_RELATIVO)].map((m) => m[2]);
}

/**
 * Lê do netlify.toml o que o build copia e o que o ignore vigia.
 * @param {string} toml
 * @returns {{ arquivos: string[], pastas: string[], ignorados: string[] }}
 */
export function lerNetlify(toml) {
  const comando = /^\s*command\s*=\s*"([^"]*)"/m.exec(toml)?.[1] ?? '';
  const ignore = /^\s*ignore\s*=\s*"([^"]*)"/m.exec(toml)?.[1] ?? '';
  /** @type {string[]} */
  const arquivos = [];
  /** @type {string[]} */
  const pastas = [];
  for (const trecho of comando.split('&&').map((t) => t.trim())) {
    const partes = trecho.split(/\s+/);
    if (partes[0] !== 'cp') continue;
    const recursivo = partes.includes('-r') || partes.includes('-R');
    for (const parte of partes.slice(1)) {
      if (!parte.startsWith('../')) continue;
      (recursivo ? pastas : arquivos).push(parte.slice(3).replace(/\/$/, ''));
    }
  }
  const ignorados = ignore
    .split(/\s+/)
    .filter((p) => p.startsWith('../'))
    .map((p) => p.slice(3).replace(/\/$/, ''));
  return { arquivos, pastas, ignorados };
}

/* Texto sempre com LF. Com core.autocrlf=true o Windows tira o arquivo com CRLF e a
   esteira do Linux com LF: sem normalizar, o hash e o --check mudariam de máquina
   para máquina. */
/** @param {string} abs */
function lerTexto(abs) {
  return fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
}

/** @param {string | Buffer} conteudo */
function hash8(conteudo) {
  return crypto.createHash('sha256').update(conteudo).digest('hex').slice(0, 8);
}

/** @param {string} raiz @param {string} abs */
function relativo(raiz, abs) {
  return path.relative(raiz, abs).split(path.sep).join('/');
}

/** @param {string} dir @param {RegExp} filtro @returns {string[]} */
function listarArquivos(dir, filtro) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const saida = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, item.name);
    if (item.isDirectory()) saida.push(...listarArquivos(abs, filtro));
    else if (filtro.test(item.name)) saida.push(abs);
  }
  return saida.sort();
}

/**
 * Lê dev/site/paginas.json.
 * @param {string} raiz
 * @returns {{ dominio: string, paginas: { id: string, arquivo: string, url: string, indexavel?: boolean }[] }}
 */
export function lerPaginas(raiz) {
  return JSON.parse(fs.readFileSync(path.join(raiz, 'dev/site/paginas.json'), 'utf8'));
}

/**
 * Carimba parciais e versiona assets das páginas (todas, ou só as de `paginas`).
 * @param {{ raiz: string, modo?: 'escrever' | 'checar', paginas?: string[] }} opcoes
 * @returns {Promise<{ alterados: string[], avisos: string[] }>}
 */
export async function construir({ raiz, modo = 'escrever', paginas }) {
  const config = lerPaginas(raiz);
  /** @type {Map<string, string>} */
  const novos = new Map();
  /** @type {Map<string, string>} */
  const hashes = new Map();
  /** @type {string[]} */
  const avisos = [];

  /** @param {string} nome */
  const lerParcial = (nome) => {
    const arquivo = path.join(raiz, 'dev/site/parciais', `${nome}.html`);
    if (!fs.existsSync(arquivo)) throw new Error(`parcial inexistente: dev/site/parciais/${nome}.html`);
    return lerTexto(arquivo);
  };

  const emProcesso = new Set();
  /** @param {string} abs @returns {string} */
  const versaoModulo = (abs) => {
    const url = '/' + relativo(raiz, abs);
    const pronto = hashes.get(url);
    if (pronto) return pronto;
    if (emProcesso.has(url)) throw new Error(`import circular envolvendo ${url}`);
    emProcesso.add(url);
    const conteudo = lerTexto(abs);
    const dependencias = importsRelativos(conteudo).map((especificador) => {
      const alvo = path.resolve(path.dirname(abs), especificador);
      if (!fs.existsSync(alvo)) throw new Error(`${url} importa ${especificador}, que não existe`);
      return versaoModulo(alvo);
    });
    emProcesso.delete(url);
    const versao = hash8(conteudo + '\n' + dependencias.join(','));
    hashes.set(url, versao);
    return versao;
  };
  for (const abs of listarArquivos(path.join(raiz, 'assets/site'), /\.m?js$/)) versaoModulo(abs);

  /** @param {string} caminho */
  const hashDe = (caminho) => {
    const pronto = hashes.get(caminho);
    if (pronto) return pronto;
    const abs = path.join(raiz, caminho);
    if (!fs.existsSync(abs)) return undefined;
    const versao = hash8(lerTexto(abs));
    hashes.set(caminho, versao);
    return versao;
  };

  for (const pagina of config.paginas) {
    if (paginas && !paginas.includes(pagina.arquivo)) continue;
    const abs = path.join(raiz, pagina.arquivo);
    if (!fs.existsSync(abs)) {
      avisos.push(`página ainda não existe: ${pagina.arquivo}`);
      continue;
    }
    const atual = lerTexto(abs);
    let novo;
    try {
      novo = versionarAssets(carimbarParciais(atual, lerParcial), hashDe);
    } catch (erro) {
      throw new Error(`${pagina.arquivo}: ${erro instanceof Error ? erro.message : erro}`);
    }
    if (novo !== atual) novos.set(pagina.arquivo, novo);
  }

  if (modo === 'escrever') {
    for (const [rel, conteudo] of novos) fs.writeFileSync(path.join(raiz, rel), conteudo);
  }
  return { alterados: [...novos.keys()].sort(), avisos };
}

/**
 * Monta em `destino` exatamente o que o cp do netlify.toml publica.
 * @param {{ raiz: string, destino: string }} opcoes
 */
export async function montarDist({ raiz, destino }) {
  const raizAbs = path.resolve(raiz);
  const destinoAbs = path.resolve(destino);
  const dentroDoTmp = destinoAbs.startsWith(path.resolve(process.env.TEMP || process.env.TMPDIR || '/tmp'));
  if (destinoAbs === raizAbs || raizAbs.startsWith(destinoAbs + path.sep)) {
    throw new Error(`destino recusado, apagaria o repo: ${destinoAbs}`);
  }
  if (!path.basename(destinoAbs).startsWith('.tmp') && !dentroDoTmp) {
    throw new Error(`destino recusado: use uma pasta .tmp-* ou temporária, não ${destinoAbs}`);
  }
  const { arquivos, pastas } = lerNetlify(fs.readFileSync(path.join(raizAbs, 'netlify.toml'), 'utf8'));
  fs.rmSync(destinoAbs, { recursive: true, force: true });
  fs.mkdirSync(destinoAbs, { recursive: true });
  for (const arquivo of arquivos) {
    const origem = path.join(raizAbs, arquivo);
    if (!fs.existsSync(origem)) throw new Error(`netlify.toml copia ${arquivo}, que não existe`);
    fs.copyFileSync(origem, path.join(destinoAbs, path.basename(arquivo)));
  }
  for (const pasta of pastas) {
    const origem = path.join(raizAbs, pasta);
    if (!fs.existsSync(origem)) throw new Error(`netlify.toml copia a pasta ${pasta}, que não existe`);
    fs.cpSync(origem, path.join(destinoAbs, path.basename(pasta)), { recursive: true });
  }
  return { arquivos, pastas };
}

/** @param {string} urlModulo */
export function executadoDireto(urlModulo) {
  if (!process.argv[1]) return false;
  const a = path.resolve(fileURLToPath(urlModulo));
  const b = path.resolve(process.argv[1]);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

if (executadoDireto(import.meta.url)) {
  const args = process.argv.slice(2);
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const checar = args.includes('--check');
  const iDist = args.indexOf('--dist');
  const paginas = args.flatMap((a, i) => (args[i - 1] === '--pagina' ? [a.split(path.sep).join('/')] : []));
  try {
    const { alterados, avisos } = await construir({
      raiz,
      modo: checar ? 'checar' : 'escrever',
      paginas: paginas.length ? paginas : undefined,
    });
    for (const aviso of avisos) console.warn(`aviso: ${aviso}`);
    if (checar && alterados.length) {
      console.error('Desatualizado. Rode: node dev/site/build.mjs');
      for (const rel of alterados) console.error(`  ${rel}`);
      process.exit(1);
    }
    if (checar) console.log('build --check: tudo em dia');
    else console.log(alterados.length ? `atualizados: ${alterados.join(', ')}` : 'nada a atualizar');
    if (iDist !== -1) {
      const destino = path.resolve(raiz, args[iDist + 1] || '.tmp-site');
      await montarDist({ raiz, destino });
      console.log(`dist montado em ${relativo(raiz, destino)}`);
    }
  } catch (erro) {
    console.error(`erro: ${erro instanceof Error ? erro.message : erro}`);
    process.exit(1);
  }
}
