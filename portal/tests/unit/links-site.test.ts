import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Links do portal para o site publicado. As URLs são absolutas porque a raiz do
// portal leva ao login. Cada destino precisa existir no manifesto do site, e cada
// fragmento precisa identificar uma seção real da página de destino.

const PORTAL = resolve(__dirname, "../..");
const SITE = resolve(PORTAL, "..");
const MANIFESTO: { paginas: { url: string; arquivo: string; indexavel?: boolean }[] } = JSON.parse(
  readFileSync(join(SITE, "dev/site/paginas.json"), "utf8"),
);
const PAGINAS = new Map(MANIFESTO.paginas.filter((pagina) => pagina.indexavel !== false).map((pagina) => [pagina.url, pagina.arquivo]));

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

function ocorrencias(padrao: RegExp) {
  return FONTES.flatMap(({ arquivo, texto }) => [...texto.matchAll(padrao)].map((m) => ({ arquivo, valor: m[1] })));
}

describe("links do portal para o site", () => {
  test("o manifesto contém as páginas de contato e contratação", () => {
    assert.ok(PAGINAS.has("/contato/") && PAGINAS.has("/projetos-sob-medida/"));
  });

  test("todo link absoluto aponta diretamente para uma página e seção existentes", () => {
    // Maiúscula e URL sem esquema ("//waveops.com.br") também entram, para cair na regra.
    const urls = ocorrencias(/((?:https?:)?\/\/(?:www\.)?waveops\.com\.br[^\s"'`)}<>,]*)/gi);
    assert.ok(urls.length > 0, "nenhum link encontrado: o teste perdeu o alvo");
    for (const { arquivo, valor } of urls) {
      const url = new URL(valor);
      assert.equal(url.protocol, "https:", `${arquivo}: use HTTPS em ${valor}`);
      assert.ok(
        ["https://waveops.com.br", "https://www.waveops.com.br"].includes(url.origin),
        `${arquivo}: origem diferente do site em ${valor}`,
      );
      const pagina = PAGINAS.get(url.pathname);
      assert.ok(pagina, `${arquivo}: página não publicada em ${valor}`);
      if (url.hash) {
        assert.notEqual(url.pathname, "/", `${arquivo}: substitua a âncora antiga pelo destino direto em ${valor}`);
        const html = readFileSync(join(SITE, pagina), "utf8");
        const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
        assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))), `${arquivo}: seção inexistente em ${valor}`);
      }
    }
  });

  test("nenhum link relativo para a raiz do portal", () => {
    // A raiz do portal redireciona para /cliente/login: "/" e "/#contato" nunca chegam ao site.
    const relativos = ocorrencias(/href\s*=\s*\{?\s*["'`](\/(?:[?#][^"'`]*)?)["'`]/g);
    assert.deepEqual(relativos, [], "para ir ao site, use a URL absoluta (https://waveops.com.br/)");
  });
});
