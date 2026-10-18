// Contraste dos tokens de cor (spec do novo visual, 5.1 e 15.2): texto 4,5:1; componente e anel de
// foco 3:1. O teste lê assets/site/tokens.css, resolve var() em cada contexto (:root é o escuro da
// página inteira e .wo-cartao-claro herda dele), compõe cor com alfa sobre o fundo sem arredondar o
// canal e só então aplica a conta da WCAG. Cor nova ou valor mudado em tokens.css passa por aqui
// antes de chegar às páginas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const tokens = fs.readFileSync(path.join(raiz, 'assets', 'site', 'tokens.css'), 'utf8');

/** Declarações "--nome: valor" de um corpo de regra, sem quebrar em ";" dentro de parênteses. */
function lerDeclaracoes(corpo) {
  const saida = new Map();
  const guardar = (trecho) => {
    const i = trecho.indexOf(':');
    if (i > 0) saida.set(trecho.slice(0, i).trim(), trecho.slice(i + 1).trim());
  };
  let profundidade = 0;
  let inicio = 0;
  for (let i = 0; i < corpo.length; i += 1) {
    const c = corpo[i];
    if (c === '(') profundidade += 1;
    else if (c === ')') profundidade -= 1;
    else if (c === ';' && profundidade === 0) {
      guardar(corpo.slice(inicio, i));
      inicio = i + 1;
    }
  }
  guardar(corpo.slice(inicio));
  return saida;
}

/**
 * Regras de nível zero, por seletor. Regra repetida soma as declarações e a última vence,
 * como na cascata com a mesma especificidade. O que está dentro de @media não entra: aqui só
 * interessa a paleta.
 */
function lerBlocos(css) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocos = new Map();
  let profundidade = 0;
  let inicio = 0;
  let cabeca = '';
  let corpoInicio = 0;
  for (let i = 0; i < limpo.length; i += 1) {
    const c = limpo[i];
    if (c === '{') {
      if (profundidade === 0) {
        cabeca = limpo.slice(inicio, i).trim();
        corpoInicio = i + 1;
      }
      profundidade += 1;
    } else if (c === '}') {
      profundidade -= 1;
      if (profundidade === 0) {
        inicio = i + 1;
        if (!cabeca.startsWith('@')) {
          for (const seletor of cabeca.split(',')) {
            const chave = seletor.trim().replace(/\s+/g, ' ');
            const declaracoes = blocos.get(chave) ?? new Map();
            for (const [nome, valor] of lerDeclaracoes(limpo.slice(corpoInicio, i))) declaracoes.set(nome, valor);
            blocos.set(chave, declaracoes);
          }
        }
      }
    } else if (c === ';' && profundidade === 0) {
      inicio = i + 1;
    }
  }
  return blocos;
}

const blocos = lerBlocos(tokens);

/**
 * Valor calculado de uma propriedade num contexto, como o navegador faz: var() é trocado onde a
 * propriedade foi declarada. No cartão claro, o que o bloco não declara vem de :root já resolvido
 * lá, então um nome de :root que aponta para outro nome não acompanha a troca de contexto.
 */
function resolver(contexto, nome, pilha = []) {
  if (pilha.includes(nome)) throw new Error(`referência circular: ${[...pilha, nome].join(' > ')}`);
  const proprio = blocos.get(contexto);
  if (!proprio) throw new Error(`bloco ${contexto} inexistente em tokens.css`);
  let origem = contexto;
  let bruto = proprio.get(nome);
  if (bruto === undefined && contexto !== ':root') {
    origem = ':root';
    bruto = blocos.get(':root')?.get(nome);
  }
  if (bruto === undefined) throw new Error(`${nome} indefinido em ${contexto}`);
  const resolvido = bruto.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, referencia) => resolver(origem, referencia, [...pilha, nome]));
  if (resolvido.includes('var(')) throw new Error(`${nome} em ${contexto} usa var() com reserva, que este teste não resolve: ${bruto}`);
  return resolvido;
}

/** Cor resolvida mais o fundo opaco do contexto, sobre o qual um fundo com alfa é composto. */
function cor(contexto, nome) {
  return { css: resolver(contexto, nome), base: resolver(contexto, '--wo-fundo') };
}

/** Canais de 0 a 255, sem arredondar, e alfa de 0 a 1. */
function lerCor(texto) {
  const t = texto.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(t);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    const canal = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: canal(0), g: canal(2), b: canal(4), a: h.length === 8 ? canal(6) / 255 : 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+)(%?))?\s*\)$/.exec(t);
  if (rgb) {
    const alfa = rgb[4] === undefined ? 1 : rgb[5] ? Number(rgb[4]) / 100 : Number(rgb[4]);
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: alfa };
  }
  throw new Error(`cor não reconhecida: ${texto}`);
}

/** Cor com alfa composta sobre um fundo opaco. */
function compor(frente, fundo) {
  const a = frente.a;
  return { r: frente.r * a + fundo.r * (1 - a), g: frente.g * a + fundo.g * (1 - a), b: frente.b * a + fundo.b * (1 - a), a: 1 };
}

/** Luminância relativa da WCAG 2. */
function luminancia({ r, g, b }) {
  const canal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/**
 * Razão de contraste da WCAG. Aceita texto de cor ou o par { css, base } de cor(). Alfa na
 * frente compõe sobre o fundo; alfa no fundo compõe antes sobre a base do contexto.
 */
function contraste(frente, fundo) {
  const f = typeof frente === 'string' ? { css: frente } : frente;
  const b = typeof fundo === 'string' ? { css: fundo } : fundo;
  let fundoCor = lerCor(b.css);
  if (fundoCor.a < 1) {
    if (!b.base) throw new Error(`fundo com alfa precisa de uma base opaca: ${b.css}`);
    const base = lerCor(b.base);
    if (base.a < 1) throw new Error(`a base também tem alfa: ${b.base}`);
    fundoCor = compor(fundoCor, base);
  }
  const l1 = luminancia(compor(lerCor(f.css), fundoCor));
  const l2 = luminancia(fundoCor);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('a conta de contraste bate com valores conhecidos', () => {
  assert.equal(contraste('#ffffff', '#000000').toFixed(2), '21.00');
  assert.equal(contraste('#767676', '#ffffff').toFixed(2), '4.54');
  assert.equal(contraste('rgb(0 0 0 / 0.5)', '#ffffff').toFixed(2), '3.98');
});

// [frente, fundo, mínimo]: texto 4,5:1; componente e anel de foco 3:1.
const PRIMITIVOS = [
  ['--wo-tinta', '--wo-papel', 4.5], ['--wo-tinta-2', '--wo-papel', 4.5], ['--wo-tinta-2', '--wo-papel-2', 4.5],
  ['--wo-tinta-3', '--wo-papel', 4.5], ['--wo-tinta-3', '--wo-papel-2', 4.5], ['--wo-tinta-3', '--wo-branco', 4.5],
  ['--wo-violeta', '--wo-papel', 4.5], ['--wo-violeta', '--wo-papel-2', 4.5],
  ['--wo-branco', '--wo-violeta', 4.5], ['--wo-branco', '--wo-violeta-forte', 4.5],
  ['--wo-clara', '--wo-noite', 4.5], ['--wo-clara-2', '--wo-noite', 4.5], ['--wo-clara-2', '--wo-cartao-noite', 4.5],
  ['--wo-violeta', '--wo-noite', 3], ['--wo-branco', '--wo-whatsapp', 3], ['--wo-whatsapp', '--wo-papel', 3],
];
const SEMANTICOS = [
  ['--wo-texto', '--wo-fundo', 4.5], ['--wo-texto-2', '--wo-fundo', 4.5], ['--wo-texto-3', '--wo-fundo', 4.5],
  ['--wo-texto-2', '--wo-superficie', 4.5], ['--wo-texto-3', '--wo-superficie', 4.5],
  ['--wo-acento-texto', '--wo-fundo', 4.5],
  ['--wo-sucesso', '--wo-fundo', 4.5], ['--wo-alerta', '--wo-fundo', 4.5], ['--wo-erro', '--wo-fundo', 4.5],
];
for (const [frente, fundo, minimo] of PRIMITIVOS) {
  test(`${frente} sobre ${fundo} passa ${minimo}:1`, () => {
    const razao = contraste(cor(':root', frente), cor(':root', fundo));
    assert.ok(razao >= minimo, `${razao.toFixed(2)}:1`);
  });
}
// Desde a D20 (spec 15.2) o contexto escuro vale para a página inteira, em :root, e o claro só
// existe dentro do cartão claro.
for (const contexto of [':root', '.wo-cartao-claro']) {
  for (const [frente, fundo, minimo] of SEMANTICOS) {
    test(`${contexto}: ${frente} sobre ${fundo} passa ${minimo}:1`, () => {
      const razao = contraste(cor(contexto, frente), cor(contexto, fundo));
      assert.ok(razao >= minimo, `${razao.toFixed(2)}:1`);
    });
  }
}

test('a página inteira fica no contexto escuro e o cartão claro volta ao papel e à tinta', () => {
  assert.equal(blocos.get(':root')?.get('color-scheme'), 'dark');
  assert.equal(resolver(':root', '--wo-fundo'), resolver(':root', '--wo-noite'));
  assert.equal(resolver(':root', '--wo-texto'), resolver(':root', '--wo-clara'));
  assert.equal(resolver('.wo-cartao-claro', '--wo-fundo'), resolver(':root', '--wo-papel'));
  assert.equal(resolver('.wo-cartao-claro', '--wo-texto'), resolver(':root', '--wo-tinta'));
  // O escuro é o da página: nenhuma faixa precisa de classe própria para ficar escura.
  assert.equal(blocos.has('.wo-noite'), false, 'tokens.css ainda tem um bloco .wo-noite');
});

// O fundo vivo (spec 15) fica atrás de toda página. O fundo é fixo e o texto sobe por cima dele
// quando a página rola, então passa pelo brilho da onda. O pixel mais claro atrás do texto do hero,
// depois da camada de leitura, foi medido numa varredura de rolagem em 16/10/2026 (pôster e 24
// quadros do laço, em 1440 x 900 e 390 x 844): rgb(107, 107, 107). O branco a 75% (--wo-clara-2) dá
// 3,81:1 nesse pixel, abaixo dos 4,5:1; o --wo-clara sólido dá 4,80:1.
const PIXEL_MAIS_CLARO_DA_ONDA = 'rgb(107, 107, 107)';
test('hero: o texto secundário sobre o vídeo passa 4.5:1 no pixel mais claro do fundo', () => {
  const razao = contraste(cor(':root', '--wo-hero-texto-secundario'), { css: PIXEL_MAIS_CLARO_DA_ONDA });
  assert.ok(razao >= 4.5, `${razao.toFixed(2)}:1`);
});

// Seções sobre a onda (spec 15.2 e 15.5): onde a seção 7 diz "Papel", o véu (preto noite a 72%);
// onde diz "Papel 2" ou "Noite", o véu forte (a 84%). Toda cor de texto do contexto escuro passa
// 4,5:1 sobre o pior pixel da onda coberto por cada um dos dois.
test('os véus são o preto noite a 72% e a 84%', () => {
  assert.deepEqual(lerCor(resolver(':root', '--wo-veu')), { r: 10, g: 10, b: 10, a: 0.72 });
  assert.deepEqual(lerCor(resolver(':root', '--wo-veu-forte')), { r: 10, g: 10, b: 10, a: 0.84 });
});
const TEXTOS_DO_ESCURO = ['--wo-texto', '--wo-texto-2', '--wo-texto-3', '--wo-acento-texto', '--wo-sucesso', '--wo-alerta', '--wo-erro', '--wo-info'];
for (const veu of ['--wo-veu', '--wo-veu-forte']) {
  for (const frente of TEXTOS_DO_ESCURO) {
    test(`${frente} sobre ${veu} por cima do pixel mais claro da onda passa 4.5:1`, () => {
      const razao = contraste(cor(':root', frente), { css: resolver(':root', veu), base: PIXEL_MAIS_CLARO_DA_ONDA });
      assert.ok(razao >= 4.5, `${razao.toFixed(2)}:1`);
    });
  }
}

// Topo (spec 5.5 e 15.2): sempre no estado sobre o escuro, com fundo transparente e desfoque. Por
// baixo dele passam a noite, o fundo do hero antes do pôster e a onda, com ou sem véu.
const NOITE = resolver(':root', '--wo-noite');
const FUNDOS_DO_TOPO = [
  ['a noite', { css: NOITE }],
  ['o fundo do hero', { css: resolver(':root', '--wo-noite-hero') }],
];
for (const [nome, fundo] of FUNDOS_DO_TOPO) {
  test(`topo: o texto do menu (branco a 85%) sobre ${nome} passa 4.5:1`, () => {
    const razao = contraste({ css: resolver(':root', '--wo-topo-texto-noite') }, fundo);
    assert.ok(razao >= 4.5, `${razao.toFixed(2)}:1`);
  });
  test(`topo: o lilás do "Ops" sobre ${nome} passa 4.5:1`, () => {
    const razao = contraste(cor(':root', '--wo-acento-texto'), fundo);
    assert.ok(razao >= 4.5, `${razao.toFixed(2)}:1`);
  });
}

// Anel de foco (WCAG 1.4.11, 3:1 para componente). Quase todo elemento focável fica sobre a onda: no
// hero e no palco sem véu, nas seções sob o véu e o véu forte, e no topo, na chamada final e no
// rodapé sobre a noite. Dentro do cartão claro, o anel fica sobre o papel.
const FUNDOS_DO_ANEL = [
  ['a onda sem véu', { css: PIXEL_MAIS_CLARO_DA_ONDA }],
  ['o véu sobre a onda', { css: resolver(':root', '--wo-veu'), base: PIXEL_MAIS_CLARO_DA_ONDA }],
  ['o véu forte sobre a onda', { css: resolver(':root', '--wo-veu-forte'), base: PIXEL_MAIS_CLARO_DA_ONDA }],
  ['a noite', { css: NOITE }],
];
for (const [nome, fundo] of FUNDOS_DO_ANEL) {
  test(`anel de foco sobre ${nome} passa 3:1`, () => {
    const razao = contraste(cor(':root', '--wo-foco'), fundo);
    assert.ok(razao >= 3, `${razao.toFixed(2)}:1`);
  });
}
test('anel de foco dentro do cartão claro passa 3:1 sobre o papel', () => {
  const razao = contraste(cor('.wo-cartao-claro', '--wo-foco'), cor('.wo-cartao-claro', '--wo-fundo'));
  assert.ok(razao >= 3, `${razao.toFixed(2)}:1`);
});

// O botão de contorno do hero fica sobre a onda: texto claro sobre o preto a 30%, que por sua vez fica
// sobre o pixel mais claro da onda.
test('botão de contorno sobre a onda: texto claro sobre o preto a 30% passa 4.5:1', () => {
  const fundo = { css: resolver(':root', '--wo-contorno-fundo'), base: PIXEL_MAIS_CLARO_DA_ONDA };
  const razao = contraste(cor(':root', '--wo-texto'), fundo);
  assert.ok(razao >= 4.5, `${razao.toFixed(2)}:1`);
});
