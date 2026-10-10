// Testes do carimbo de parciais, do versionamento de assets e da simulação do build do Netlify.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  carimbarParciais,
  versionarAssets,
  importsRelativos,
  lerNetlify,
  construir,
  montarDist,
} from '../../../dev/site/build.mjs';

const parciais = {
  topo: '<nav>\n  <a href="/solucoes/"{{atual:solucoes}}>Soluções</a>\n  <a href="/contato/"{{atual:contato}}>Contato</a>\n</nav>',
  rodape: '<footer>{{ano}}</footer>',
};
const lerParcial = (nome) => {
  if (!(nome in parciais)) throw new Error(`parcial inexistente: ${nome}`);
  return parciais[nome];
};

test('carimba o parcial entre os marcadores, com indentação e item ativo', () => {
  const html = '<body>\n    <!-- parcial:topo ativo="contato" -->\n    velho\n    <!-- /parcial:topo -->\n</body>';
  const saida = carimbarParciais(html, lerParcial);
  assert.equal(
    saida,
    '<body>\n    <!-- parcial:topo ativo="contato" -->\n    <nav>\n      <a href="/solucoes/">Soluções</a>\n      <a href="/contato/" aria-current="page">Contato</a>\n    </nav>\n    <!-- /parcial:topo -->\n</body>',
  );
});

test('carimbar duas vezes dá o mesmo resultado', () => {
  const html = '<body>\n  <!-- parcial:topo ativo="solucoes" -->\n  <!-- /parcial:topo -->\n</body>';
  const uma = carimbarParciais(html, lerParcial);
  assert.equal(carimbarParciais(uma, lerParcial), uma);
});

test('atributo do marcador vira valor escapado no parcial', () => {
  const html = '<!-- parcial:rodape ano="2026 & <cia>" -->\n<!-- /parcial:rodape -->';
  assert.match(carimbarParciais(html, lerParcial), /<footer>2026 &amp; &lt;cia&gt;<\/footer>/);
});

test('parcial inexistente e marcador aberto sem fechamento acusam erro', () => {
  assert.throws(() => carimbarParciais('<!-- parcial:nada -->\n<!-- /parcial:nada -->', lerParcial), /nada/);
  assert.throws(() => carimbarParciais('<!-- parcial:topo -->\nsem fim', lerParcial), /sem fechamento/);
});

test('placeholder sem valor acusa erro em vez de sair vazio', () => {
  assert.throws(() => carimbarParciais('<!-- parcial:rodape -->\n<!-- /parcial:rodape -->', lerParcial), /ano/);
});

test('versiona CSS e JS de /assets/ e deixa imagem e fonte como estão', () => {
  const html = [
    '<link rel="stylesheet" href="/assets/site/base.css">',
    '<script type="module" src="/assets/site/site.js?v=velho"></script>',
    '<img src="/assets/brand/selo.webp" alt="">',
    '<link rel="preload" href="/assets/fonts/x.woff2" as="font">',
    '<a href="https://exemplo.com/assets/a.js">fora</a>',
  ].join('\n');
  const saida = versionarAssets(html, (p) => ({ '/assets/site/base.css': 'aaaa1111', '/assets/site/site.js': 'bbbb2222' })[p]);
  assert.match(saida, /href="\/assets\/site\/base\.css\?v=aaaa1111"/);
  assert.match(saida, /src="\/assets\/site\/site\.js\?v=bbbb2222"/);
  assert.match(saida, /src="\/assets\/brand\/selo\.webp"/);
  assert.match(saida, /href="\/assets\/fonts\/x\.woff2"/);
  assert.match(saida, /https:\/\/exemplo\.com\/assets\/a\.js"/);
});

test('asset referenciado que não existe acusa erro', () => {
  assert.throws(() => versionarAssets('<script src="/assets/site/sumiu.js"></script>', () => undefined), /sumiu\.js/);
});

test('lista imports relativos estáticos, dinâmicos e re-exports, e ignora pacotes', () => {
  const js = [
    "import { a } from './lib/a.js';",
    'import b from "../b.js";',
    "const c = await import('./c.js');",
    "import x from 'pacote';",
    "export { d } from './d.js';",
    "import './efeito.js';",
  ].join('\n');
  assert.deepEqual(importsRelativos(js), ['./lib/a.js', '../b.js', './c.js', './d.js', './efeito.js']);
});

test('lê do netlify.toml os arquivos e pastas do cp e os caminhos do ignore', () => {
  const toml = [
    '[build]',
    '  command = "rm -rf _site && mkdir -p _site && cp ../index.html ../robots.txt _site/ && cp -r ../assets ../solucoes _site/"',
    '  publish = "_site"',
    '  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- ../index.html ../assets ../solucoes ."',
  ].join('\n');
  assert.deepEqual(lerNetlify(toml), {
    arquivos: ['index.html', 'robots.txt'],
    pastas: ['assets', 'solucoes'],
    ignorados: ['index.html', 'assets', 'solucoes'],
  });
});

function criarRepoTemporario() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-build-'));
  const escrever = (rel, conteudo) => {
    const destino = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, conteudo);
  };
  escrever('dev/site/paginas.json', JSON.stringify({
    dominio: 'https://waveops.com.br',
    paginas: [
      { id: 'home', arquivo: 'index.html', url: '/' },
      { id: 'contato', arquivo: 'contato/index.html', url: '/contato/' },
    ],
  }));
  escrever('dev/site/parciais/topo.html', '<a href="/contato/"{{atual:contato}}>Contato</a>');
  escrever('assets/site/lib/util.js', 'export const x = 1;\n');
  escrever('assets/site/site.js', "import { x } from './lib/util.js';\nconsole.log(x);\n");
  escrever('assets/site/base.css', 'body{margin:0}\n');
  const pagina = (ativo) => [
    '<!doctype html>',
    '<html lang="pt-BR"><head>',
    '<link rel="stylesheet" href="/assets/site/base.css">',
    '<script type="module" src="/assets/site/site.js"></script>',
    '</head><body>',
    `<!-- parcial:topo ativo="${ativo}" -->`,
    '<!-- /parcial:topo -->',
    '</body></html>',
    '',
  ].join('\n');
  escrever('index.html', pagina('home'));
  escrever('contato/index.html', pagina('contato'));
  escrever('robots.txt', 'User-agent: *\n');
  escrever('netlify.toml', '[build]\n  command = "rm -rf _site && mkdir -p _site && cp ../index.html ../robots.txt _site/ && cp -r ../assets ../contato _site/"\n  publish = "_site"\n');
  return { raiz, escrever, ler: (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8') };
}

test('construir: checar aponta o que mudaria, escrever corrige, e checar fica limpo', async () => {
  const repo = criarRepoTemporario();
  const antes = await construir({ raiz: repo.raiz, modo: 'checar' });
  assert.deepEqual(antes.alterados.sort(), ['contato/index.html', 'index.html']);
  await construir({ raiz: repo.raiz, modo: 'escrever' });
  assert.match(repo.ler('contato/index.html'), /<a href="\/contato\/" aria-current="page">Contato<\/a>/);
  assert.equal(repo.ler('assets/site/site.js'), "import { x } from './lib/util.js';\nconsole.log(x);\n");
  assert.match(repo.ler('index.html'), /site\.js\?v=[0-9a-f]{8}"/);
  const depois = await construir({ raiz: repo.raiz, modo: 'checar' });
  assert.deepEqual(depois.alterados, []);
});

test('construir: mudar a lib muda o ?v= da página que carrega o módulo de entrada', async () => {
  const repo = criarRepoTemporario();
  await construir({ raiz: repo.raiz, modo: 'escrever' });
  const versaoAntes = repo.ler('index.html').match(/site\.js\?v=([0-9a-f]{8})/)[1];
  repo.escrever('assets/site/lib/util.js', 'export const x = 2;\n');
  const pendente = await construir({ raiz: repo.raiz, modo: 'checar' });
  assert.ok(pendente.alterados.includes('index.html'));
  await construir({ raiz: repo.raiz, modo: 'escrever' });
  const versaoDepois = repo.ler('index.html').match(/site\.js\?v=([0-9a-f]{8})/)[1];
  assert.notEqual(versaoDepois, versaoAntes);
});

test('construir com paginas limita o carimbo às páginas pedidas', async () => {
  const repo = criarRepoTemporario();
  const { alterados } = await construir({ raiz: repo.raiz, modo: 'escrever', paginas: ['contato/index.html'] });
  assert.deepEqual(alterados, ['contato/index.html']);
  assert.doesNotMatch(repo.ler('index.html'), /aria-current/);
  assert.doesNotMatch(repo.ler('index.html'), /\?v=/);
});

test('CRLF do Windows não muda hash nem resultado do carimbo', async () => {
  const lf = criarRepoTemporario();
  await construir({ raiz: lf.raiz, modo: 'escrever' });
  const crlf = criarRepoTemporario();
  for (const rel of ['index.html', 'assets/site/site.js', 'assets/site/base.css', 'dev/site/parciais/topo.html']) {
    crlf.escrever(rel, crlf.ler(rel).replace(/\n/g, '\r\n'));
  }
  await construir({ raiz: crlf.raiz, modo: 'escrever' });
  assert.equal(crlf.ler('index.html').replace(/\r\n/g, '\n'), lf.ler('index.html'));
  assert.deepEqual((await construir({ raiz: crlf.raiz, modo: 'checar' })).alterados, []);
});

test('montarDist copia exatamente o que o cp do netlify.toml copia', async () => {
  const repo = criarRepoTemporario();
  await construir({ raiz: repo.raiz, modo: 'escrever' });
  const destino = path.join(repo.raiz, '.tmp-site');
  await montarDist({ raiz: repo.raiz, destino });
  const existe = (rel) => fs.existsSync(path.join(destino, rel));
  assert.ok(existe('index.html'));
  assert.ok(existe('robots.txt'));
  assert.ok(existe('contato/index.html'));
  assert.ok(existe('assets/site/site.js'));
  assert.ok(!existe('dev/site/paginas.json'));
  assert.ok(!existe('netlify.toml'));
});
