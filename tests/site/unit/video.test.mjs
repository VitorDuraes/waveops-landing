// Vídeo do hero (spec 6.2): os quatro vídeos e o pôster existem, cabem nos tetos e têm a
// assinatura do formato. Todos saem da cena de dev/site/video/cena.js; para refazer, rode
// `PW_CHANNEL=chrome node qa/video.mjs` de tests/site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIDEOS, escolherVideo, deveTocar } from '../../../assets/site/lib/video.js';

test('escolherVideo prefere WebM e escolhe o tamanho pela largura', () => {
  const soWebm = (t) => t.startsWith('video/webm') ? 'probably' : '';
  const soMp4 = (t) => t.startsWith('video/mp4') ? 'maybe' : '';
  assert.deepEqual(escolherVideo(1440, soWebm), { src: '/assets/site/video/onda-1920.webm', tipo: 'video/webm' });
  assert.deepEqual(escolherVideo(1280, soWebm), { src: '/assets/site/video/onda-1280.webm', tipo: 'video/webm' });
  assert.deepEqual(escolherVideo(390, soMp4), { src: '/assets/site/video/onda-1280.mp4', tipo: 'video/mp4' });
  assert.deepEqual(escolherVideo(1920, () => 'probably'), { src: '/assets/site/video/onda-1920.webm', tipo: 'video/webm' });
  assert.equal(escolherVideo(1920, () => ''), null);
});

// Desde a D20 (spec 15.3) o vídeo toca em qualquer ponto da página: sair do hero não pausa mais.
test('deveTocar exige página carregada, aba visível e nenhum bloqueio, em qualquer ponto da rolagem', () => {
  const livre = { movimentoReduzido: false, economiaDeDados: false, carregada: true, abaVisivel: true, pausadoPeloUsuario: false };
  assert.equal(deveTocar(livre), true);
  for (const [chave, valor] of [['movimentoReduzido', true], ['economiaDeDados', true], ['carregada', false], ['abaVisivel', false], ['pausadoPeloUsuario', true]]) {
    assert.equal(deveTocar({ ...livre, [chave]: valor }), false, chave);
  }
  // Um estado antigo que ainda diga "fora do hero" não pausa o fundo.
  assert.equal(deveTocar({ ...livre, naTela: false }), true, 'naTela não conta mais');
});

test('os caminhos dos vídeos e do pôster do fundo existem em disco', () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  assert.ok(Object.isFrozen(VIDEOS));
  for (const formato of Object.values(VIDEOS)) {
    assert.ok(Object.isFrozen(formato));
    for (const src of Object.values(formato)) assert.ok(fs.existsSync(path.join(raiz, src)));
  }
  const parcial = fs.readFileSync(path.join(raiz, 'dev/site/parciais/fundo.html'), 'utf8');
  const src = /class="wo-fundo__poster" src="([^"]+)"/.exec(parcial)?.[1];
  assert.ok(src, 'o parcial do fundo não traz o pôster');
  assert.ok(fs.existsSync(path.join(raiz, src)));
});

const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets', 'site', 'video');
const KB = 1024;
const MB = 1024 * 1024;

// Tetos da spec 6.2, em bytes. O qa/video.mjs confere os mesmos depois de gravar.
const TETOS = {
  'onda-1920.webm': 2.5 * MB,
  'onda-1920.mp4': 2.5 * MB,
  'onda-1280.webm': 1.2 * MB,
  'onda-1280.mp4': 1.2 * MB,
  'onda-poster.webp': 120 * KB,
};

/** @param {number} bytes */
const legivel = (bytes) => (bytes >= MB ? `${String(bytes / MB).replace('.', ',')} MB` : `${bytes / KB} KB`);

/** Os 12 primeiros bytes do arquivo. @param {string} nome */
const cabeca = (nome) => fs.readFileSync(path.join(pasta, nome)).subarray(0, 12);

for (const [nome, teto] of Object.entries(TETOS)) {
  test(`${nome} existe e cabe em ${legivel(teto)}`, () => {
    const abs = path.join(pasta, nome);
    assert.ok(fs.existsSync(abs), `${nome} não existe: rode PW_CHANNEL=chrome node qa/video.mjs de tests/site`);
    const tamanho = fs.statSync(abs).size;
    assert.ok(tamanho <= teto, `${nome} tem ${tamanho} bytes e passa do teto de ${legivel(teto)} (${Math.floor(teto)} bytes)`);
  });
}

test('os WebM começam com o cabeçalho EBML (1a 45 df a3)', () => {
  for (const nome of ['onda-1920.webm', 'onda-1280.webm']) {
    assert.deepEqual([...cabeca(nome).subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], nome);
  }
});

test('os MP4 têm a caixa ftyp a partir do byte 4', () => {
  for (const nome of ['onda-1920.mp4', 'onda-1280.mp4']) {
    assert.equal(cabeca(nome).toString('latin1', 4, 8), 'ftyp', nome);
  }
});

test('o pôster é WebP: RIFF no byte 0 e WEBP a partir do byte 8', () => {
  const bytes = cabeca('onda-poster.webp');
  assert.equal(bytes.toString('latin1', 0, 4), 'RIFF');
  assert.equal(bytes.toString('latin1', 8, 12), 'WEBP');
});
