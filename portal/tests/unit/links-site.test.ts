import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Links do portal para o site institucional (waveops.com.br, outra origem). O portal
// (Railway) e o site (Netlify) publicam em momentos diferentes, então todo link precisa
// funcionar no site que está no ar E no site novo. Hoje isso vale para a raiz e para as
// âncoras da página única antiga: existem no site atual, e a Home nova redireciona cada
// uma (assets/site/lib/legado.js). Página nova, como /contato/, só depois que o site
// novo estiver no ar: aí troque os links pelas URLs diretas e relaxe esta regra para
// aceitar as páginas de dev/site/paginas.json.

const PORTAL = resolve(__dirname, "../..");
const LEGADO = resolve(PORTAL, "../assets/site/lib/legado.js");

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(entrada.name) ? [caminho] : [];
  });
}

const FONTES = arquivos(join(PORTAL, "src")).map((caminho) => ({
  arquivo: relative(PORTAL, caminho).replaceAll("\\", "/"),
  texto: readFileSync(caminho, "utf8"),
}));

const ANCORAS = [...readFileSync(LEGADO, "utf8").matchAll(/'(#[a-z-]+)':/g)].map((m) => m[1]);
const RAIZES = ["https://waveops.com.br", "https://waveops.com.br/", "https://www.waveops.com.br", "https://www.waveops.com.br/"];
const PERMITIDOS = new Set([...RAIZES, ...ANCORAS.map((ancora) => `https://waveops.com.br/${ancora}`)]);

function ocorrencias(padrao: RegExp) {
  return FONTES.flatMap(({ arquivo, texto }) => [...texto.matchAll(padrao)].map((m) => ({ arquivo, valor: m[1] })));
}

describe("links do portal para o site", () => {
  test("o mapa de âncoras antigas foi lido do site", () => {
    assert.ok(ANCORAS.includes("#contato") && ANCORAS.includes("#pacotes"), `âncoras lidas de legado.js: ${ANCORAS.join(", ")}`);
  });

  test("todo link absoluto para o site é a raiz ou uma âncora antiga", () => {
    const urls = ocorrencias(/(https?:\/\/(?:www\.)?waveops\.com\.br[^\s"'`)}<>]*)/g);
    assert.ok(urls.length > 0, "nenhum link para o site encontrado: o teste perdeu o alvo");
    const fora = urls.filter(({ valor }) => !PERMITIDOS.has(valor));
    assert.deepEqual(fora, [], `use a raiz ou uma destas âncoras, que funcionam no site atual e no novo: ${[...PERMITIDOS].join(", ")}`);
  });
});
