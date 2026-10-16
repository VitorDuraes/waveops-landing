// Palco de fundo da Home (spec 13): as contas de progresso, passo, capítulo ativo e escala da
// cena, e o conteúdo das cenas no index.html (ordem das frentes, passos sem buraco, aviso de
// ilustração e nada de moeda ou porcentagem).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MIDIA_PALCO,
  CENA_DESKTOP,
  CENA_CELULAR,
  progressoNoTrecho,
  passoPorProgresso,
  estadoFixo,
  escalaDaCena,
} from '../../../assets/site/lib/palco.js';

// Trecho do index.html que vai de data-palco ao </section> seguinte.
const html = fs.readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const inicio = html.indexOf('data-palco');
const trecho = inicio === -1 ? '' : html.slice(inicio, html.indexOf('</section>', inicio));
const frentes = [...trecho.matchAll(/data-frente="([^"]+)"/g)].map((m) => m[1]);
const cenas = [...trecho.matchAll(/data-cena="([^"]+)"/g)].map((m) => m[1]);

/** HTML do figure da cena. @param {string} cena */
function figura(cena) {
  const marca = trecho.indexOf(`data-cena="${cena}"`);
  assert.ok(marca !== -1, `cena ${cena} não encontrada`);
  const fim = trecho.indexOf('</figure>', marca) + '</figure>'.length;
  return trecho.slice(trecho.lastIndexOf('<figure', marca), fim);
}

/** Números distintos de data-passo dentro da cena, em ordem crescente. @param {string} cena */
function passosDe(cena) {
  const numeros = [...figura(cena).matchAll(/data-passo="(\d+)"/g)].map((m) => Number(m[1]));
  return [...new Set(numeros)].sort((a, b) => a - b);
}

/** Texto sem as tags. @param {string} trechoHtml */
function textoDe(trechoHtml) {
  return trechoHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Declarações de uma propriedade no CSS, com o @media que as envolve ('' fora de @media).
 * @param {string} css
 * @param {string} propriedade
 */
function declaracoes(css, propriedade) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
  /** @type {string[]} */
  const pilha = [];
  /** @type {{ media: string, valor: string }[]} */
  const achadas = [];
  let inicio = 0;
  for (let i = 0; i < limpo.length; i += 1) {
    const c = limpo[i];
    if (c === '{') {
      pilha.push(limpo.slice(inicio, i).trim());
      inicio = i + 1;
    } else if (c === '}' || c === ';') {
      const trecho = limpo.slice(inicio, i).trim();
      const par = trecho.match(/^(--[\w-]+)\s*:\s*(.+)$/);
      if (par && par[1] === propriedade) {
        achadas.push({ media: pilha.filter((cabeca) => cabeca.startsWith('@media')).join(' '), valor: par[2].trim() });
      }
      if (c === '}') pilha.pop();
      inicio = i + 1;
    }
  }
  return achadas;
}

test('progressoNoTrecho vai de 0 a 1 e satura nas pontas', () => {
  assert.equal(progressoNoTrecho(100, 200, 150), 0.5);
  assert.equal(progressoNoTrecho(100, 200, 50), 0);
  assert.equal(progressoNoTrecho(100, 200, 250), 1);
  assert.equal(progressoNoTrecho(900, 350, 625), 0.5);
  assert.equal(progressoNoTrecho(100, 100, 100), 1);
  assert.equal(progressoNoTrecho(100, 100, 99), 0);
});

test('passoPorProgresso mostra o primeiro passo no início e o último no fim', () => {
  assert.deepEqual([0, -0.2, 0.5, 0.51, 1, 1.4].map((p) => passoPorProgresso(p, 6)), [1, 1, 3, 4, 6, 6]);
});

test('estadoFixo ativa o capítulo cujo topo passou da metade da janela, e nenhum antes do primeiro', () => {
  const totais = [6, 6, 6, 6, 6];
  const blocos = (primeiro) => [0, 1, 2, 3, 4].map((i) => ({ topo: primeiro + i * 600, altura: 600 }));
  assert.deepEqual(estadoFixo(blocos(500), 900, totais), { ativa: -1, passo: 0 });
  assert.deepEqual(estadoFixo(blocos(-375), 900, totais), { ativa: 1, passo: 3 });
  assert.deepEqual(estadoFixo(blocos(-2800), 900, totais), { ativa: 4, passo: 6 });
});

test('o palco pede 560 px de altura', () => {
  assert.equal(MIDIA_PALCO, '(min-height: 560px)');
});

test('o tamanho de desenho da cena no CSS é o mesmo das constantes do módulo', () => {
  const css = fs.readFileSync(new URL('../../../assets/site/paginas/home.css', import.meta.url), 'utf8');
  /** @param {string} propriedade */
  const porMedia = (propriedade) => Object.fromEntries(declaracoes(css, propriedade).map(({ media, valor }) => [media, valor]));
  const esperado = {
    '@media (min-width: 1024px)': [`${CENA_DESKTOP.largura}px`, `${CENA_DESKTOP.altura}px`],
    '@media (max-width: 1023.98px)': [`${CENA_CELULAR.largura}px`, `${CENA_CELULAR.altura}px`],
  };
  const largura = porMedia('--wo-palco-cena-largura');
  const altura = porMedia('--wo-palco-cena-altura');
  assert.deepEqual(Object.keys(largura).sort(), Object.keys(esperado).sort());
  for (const [media, [l, a]] of Object.entries(esperado)) {
    assert.equal(largura[media], l, media);
    assert.equal(altura[media], a, media);
  }
});

test('escalaDaCena encolhe a cena até caber na área útil, sem nunca aumentar', () => {
  assert.equal(escalaDaCena({ largura: 800, altura: 600 }, CENA_DESKTOP), 1);
  assert.equal(escalaDaCena({ largura: 360, altura: 240 }, CENA_DESKTOP), 0.5);
  assert.equal(escalaDaCena({ largura: 350, altura: 246 }, CENA_CELULAR), 0.5);
});

test('a Home tem as cinco cenas na ordem das frentes, com passos contínuos e aviso', () => {
  assert.deepEqual(frentes, ['atendimento', 'agentes', 'dashboards', 'crms', 'saas']);
  assert.deepEqual(cenas, frentes);
  for (const cena of cenas) {
    const passos = passosDe(cena);
    assert.deepEqual(passos, Array.from({ length: passos.length }, (_, i) => i + 1), cena);
    assert.match(figura(cena), /class="wo-maquete__aviso">Ilustração</, cena);
    assert.doesNotMatch(textoDe(figura(cena)), /R\$|\d\s?%/, cena);
  }
  assert.deepEqual(passosDe('atendimento'), [1, 2, 3, 4, 5, 6]);
});
