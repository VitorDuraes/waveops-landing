// Entrada do site (Tarefa 13B): a decisão de rodar, a marcação da camada e a ordem do <head>.
// assets/site/chegada.js é script clássico (roda antes da primeira pintura), então o teste o executa
// num contexto do node:vm com uma janela falsa, em vez de importar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { lerPaginas } from '../../../dev/site/build.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const CHAVE = 'waveops:chegada';

/** Janela mínima: sessão, preferência de movimento, economia de dados, aba e página anterior. */
function janelaFalsa({ vista = false, reduzido = false, economia, aba = 'visible', bloqueado = false, anterior = '' } = {}) {
  const dados = new Map(vista ? [[CHAVE, '1']] : []);
  const sessao = {
    getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
    setItem: (chave, valor) => void dados.set(chave, String(valor)),
  };
  const dataset = {};
  const janela = {
    get sessionStorage() {
      if (bloqueado) throw new Error('SecurityError');
      return sessao;
    },
    matchMedia: (consulta) => ({ matches: reduzido && consulta === '(prefers-reduced-motion: reduce)' }),
    navigator: economia === undefined ? {} : { connection: { saveData: economia } },
    document: { visibilityState: aba, referrer: anterior, documentElement: { dataset } },
    location: { origin: 'https://waveops.com.br' },
  };
  return { janela, dados, dataset };
}

/** Executa o script como o navegador faria, com `window` apontando para a janela falsa. */
function executar(janela) {
  const contexto = vm.createContext({ window: janela });
  vm.runInContext(ler('assets/site/chegada.js'), contexto, { filename: 'chegada.js' });
  return contexto;
}

const decidir = (opcoes) => {
  const contexto = executar(janelaFalsa({ vista: true }).janela);
  return contexto.deveRodarChegada(janelaFalsa(opcoes).janela);
};

test('a entrada roda na primeira página da visita, com movimento liberado e sem economia de dados', () => {
  assert.equal(decidir({}), true);
  assert.equal(decidir({ economia: false }), true);
});

test('a entrada não roda na página seguinte da visita', () => {
  assert.equal(decidir({ vista: true }), false);
});

test('a entrada não roda com menos movimento', () => {
  assert.equal(decidir({ reduzido: true }), false);
});

test('a entrada não roda com economia de dados', () => {
  assert.equal(decidir({ economia: true }), false);
});

test('a entrada não roda com a aba aberta em segundo plano', () => {
  assert.equal(decidir({ aba: 'hidden' }), false);
});

test('link do site aberto em aba nova não repete a entrada: a página anterior é do próprio site', () => {
  // O Chromium não copia o sessionStorage para a aba aberta com Ctrl+clique (sem opener).
  assert.equal(decidir({ anterior: 'https://waveops.com.br/' }), false);
  assert.equal(decidir({ anterior: 'https://waveops.com.br/solucoes/#frente' }), false);
  assert.equal(decidir({ anterior: 'https://www.google.com/' }), true);
  assert.equal(decidir({ anterior: 'https://portal.waveops.com.br/cliente/login' }), true);
  assert.equal(decidir({ anterior: 'https://waveops.com.br.exemplo.com/' }), true);
});

test('sem sessionStorage a entrada não roda, para não repetir em toda página', () => {
  assert.equal(decidir({ bloqueado: true }), false);
});

test('na primeira página o script marca a visita e liga a camada; na seguinte não faz nada', async () => {
  const primeira = janelaFalsa();
  executar(primeira.janela);
  assert.equal(primeira.dados.get(CHAVE), '1');
  assert.equal(primeira.dataset.chegada, 'ligada');

  const seguinte = janelaFalsa({ vista: true });
  executar(seguinte.janela);
  assert.equal(seguinte.dataset.chegada, undefined);

  const reduzido = janelaFalsa({ reduzido: true });
  executar(reduzido.janela);
  assert.equal(reduzido.dataset.chegada, undefined);
  assert.equal(reduzido.dados.has(CHAVE), false, 'quem pediu menos movimento não gasta a entrada da visita');
});

test('se o desenho não carregar, a camada sai na hora', async () => {
  // No node:vm o import() dinâmico falha, como uma falha de rede no navegador.
  const primeira = janelaFalsa();
  executar(primeira.janela);
  await new Promise((resolver) => setTimeout(resolver, 20));
  assert.equal(primeira.dataset.chegada, 'feita');
});

test('o <head> comum carrega a decisão como script clássico, antes das folhas de estilo', () => {
  const head = ler('dev/site/parciais/head.html');
  const tag = /<script\b[^>]*src="\/assets\/site\/chegada\.js"[^>]*><\/script>/.exec(head);
  assert.ok(tag, 'o parcial head carrega /assets/site/chegada.js');
  assert.doesNotMatch(tag[0], /\b(type="module"|defer|async)\b/, 'precisa rodar antes da primeira pintura');
  assert.ok(tag.index < head.indexOf('rel="stylesheet"'), 'antes do CSS, para não esperar as folhas de estilo');
  assert.ok(tag.index > head.indexOf('Content-Security-Policy'), 'depois da CSP');
  assert.match(ler('assets/site/chegada.js'), /import\('\.\/chegada-cena\.js'\)/, 'o desenho só é pedido quando a entrada vai rodar');
});

test('a camada está no HTML de toda página, escondida, decorativa e sem nada focável', () => {
  const parcial = ler('dev/site/parciais/chegada.html');
  assert.match(parcial, /^<div class="wo-chegada" hidden aria-hidden="true" data-chegada-camada>/);
  assert.match(parcial, /<canvas class="wo-chegada__tela"><\/canvas>/);
  assert.doesNotMatch(parcial, /<(a|button|input|select|textarea)\b|tabindex|href=/i);
  for (const pagina of lerPaginas(raiz).paginas) {
    const html = ler(pagina.arquivo);
    const corpo = html.slice(html.indexOf('<body'));
    assert.match(corpo, /^<body[^>]*>\s*<a class="wo-pular"[^>]*>[^<]*<\/a>\s*<!-- parcial:chegada -->\s*<div class="wo-chegada" hidden aria-hidden="true" data-chegada-camada>/,
      `${pagina.arquivo}: a camada vem logo depois do "Pular para o conteúdo"`);
  }
});
