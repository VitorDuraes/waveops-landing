// @ts-check
/* Baixa as fontes do novo visual: Geist e Inter, as duas variáveis, só o recorte latino, mais
   as licenças OFL. Uso único, para refazer depois (fonte nova ou versão nova):

     node dev/site/fontes.mjs

   Pede o CSS ao Google Fonts com user agent de Chrome (sem ele o Google devolve outro formato),
   guarda o bloco "latin" de cada família em assets/fonts/ e imprime o unicode-range de cada um,
   que vai para o @font-face de assets/site/base.css.

   Segurança: só baixa de fonts.googleapis.com, fonts.gstatic.com e raw.githubusercontent.com, por
   HTTPS e sem seguir redirecionamento. Qualquer outro host que apareça no CSS é recusado, e nada
   é gravado antes de tudo ter sido baixado e conferido. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executadoDireto } from './build.mjs';

const URL_CSS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Inter:wght@400..700&display=swap';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const HOSTS_PERMITIDOS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'raw.githubusercontent.com']);
const LIMITE_CSS = 64 * 1024;
const LIMITE_FONTE = 200 * 1024;
const LIMITE_LICENCA = 64 * 1024;

/** Uma fonte por família, no recorte latino. */
const FONTES = [
  { familia: 'Geist', arquivo: 'geist-variavel-latin.woff2' },
  { familia: 'Inter', arquivo: 'inter-variavel-latin.woff2' },
];
const LICENCAS = [
  { url: 'https://raw.githubusercontent.com/vercel/geist-font/main/OFL.txt', arquivo: 'OFL-geist.txt' },
  { url: 'https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt', arquivo: 'OFL-inter.txt' },
];

/**
 * Aceita só HTTPS, porta padrão, sem credencial e com host da lista.
 * @param {string} texto
 * @returns {URL}
 */
function urlPermitida(texto) {
  const url = new URL(texto);
  if (url.protocol !== 'https:') throw new Error(`só HTTPS é aceito: ${texto}`);
  if (url.username || url.password || url.port) throw new Error(`URL com credencial ou porta: ${texto}`);
  if (!HOSTS_PERMITIDOS.has(url.hostname)) throw new Error(`host fora da lista permitida: ${url.hostname}`);
  return url;
}

/**
 * @param {string} texto
 * @param {number} limite bytes
 * @returns {Promise<Buffer>}
 */
async function baixar(texto, limite) {
  const url = urlPermitida(texto);
  const resposta = await fetch(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'error' });
  if (!resposta.ok) throw new Error(`${url.href}: HTTP ${resposta.status}`);
  const corpo = Buffer.from(await resposta.arrayBuffer());
  if (corpo.length === 0 || corpo.length > limite) throw new Error(`${url.href}: ${corpo.length} bytes, fora do esperado`);
  return corpo;
}

/**
 * Blocos @font-face do CSS do Google. O rótulo do recorte vem no comentário antes de cada bloco.
 * @param {string} css
 * @returns {{ recorte: string, familia: string, url: string, faixa: string }[]}
 */
function lerBlocos(css) {
  /** @type {{ recorte: string, familia: string, url: string, faixa: string }[]} */
  const blocos = [];
  for (const m of css.matchAll(/\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const familia = /font-family:\s*'([^']+)'/.exec(m[2])?.[1];
    const url = /src:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/.exec(m[2])?.[1];
    const faixa = /unicode-range:\s*([^;]+);/.exec(m[2])?.[1].trim();
    if (!familia || !url || !faixa) throw new Error(`bloco ${m[1]} do CSS sem família, src ou unicode-range`);
    blocos.push({ recorte: m[1], familia, url, faixa });
  }
  return blocos;
}

async function principal() {
  const destino = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'fonts');

  const css = (await baixar(URL_CSS, LIMITE_CSS)).toString('utf8');
  // Nada além da lista, mesmo nos blocos que não serão baixados.
  for (const m of css.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) urlPermitida(m[1]);
  const blocos = lerBlocos(css);

  /** @type {{ arquivo: string, corpo: Buffer }[]} */
  const gravar = [];
  for (const { familia, arquivo } of FONTES) {
    const achados = blocos.filter((b) => b.familia === familia && b.recorte === 'latin');
    if (achados.length !== 1) throw new Error(`${familia}: esperava 1 bloco "latin" no CSS, achei ${achados.length}`);
    const corpo = await baixar(achados[0].url, LIMITE_FONTE);
    if (corpo.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error(`${familia}: o arquivo baixado não é woff2`);
    gravar.push({ arquivo, corpo });
    console.log(`${familia} (latin): assets/fonts/${arquivo}, ${corpo.length} bytes`);
    console.log(`  unicode-range: ${achados[0].faixa}`);
  }
  for (const { url, arquivo } of LICENCAS) {
    const corpo = await baixar(url, LIMITE_LICENCA);
    if (!/SIL OPEN FONT LICENSE/i.test(corpo.toString('utf8'))) throw new Error(`${arquivo}: o texto baixado não é a licença OFL`);
    gravar.push({ arquivo, corpo });
    console.log(`licença: assets/fonts/${arquivo}`);
  }

  for (const { arquivo, corpo } of gravar) fs.writeFileSync(path.join(destino, arquivo), corpo);
}

if (executadoDireto(import.meta.url)) {
  try {
    await principal();
  } catch (erro) {
    console.error(`erro: ${erro instanceof Error ? erro.message : erro}`);
    process.exit(1);
  }
}
