// Vídeo do hero (spec 6.2): os quatro vídeos e o pôster existem, cabem nos tetos e têm a
// assinatura do formato. Todos saem da cena de dev/site/video/cena.js; para refazer, rode
// `PW_CHANNEL=chrome node qa/video.mjs` de tests/site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
