// @ts-check
/* Grava o vídeo do hero (spec 6.2) a partir da cena de dev/site/video/cena.html.

   Desenha os 360 quadros de 12 s a 30 por segundo (t = i / 30) e manda cada PNG, pela
   entrada padrão, a um processo só do ffmpeg, que gera os quatro vídeos e o pôster numa
   passada (split e scale), sem gravar quadro em disco. O pôster é o quadro de t = 0.

   Antes de gravar, confere a costura do loop: desenhar(0) e desenhar(12) têm de dar o mesmo
   quadro, senão alguma grandeza da cena não dá um número inteiro de voltas em 12 s. Depois,
   confere os tetos da spec 6.2. Se uma das duas falhar, sai com código 1 sem tocar em
   assets/site/video/: o ffmpeg grava em .tmp-qa/video/saida/, e os arquivos só vão para o
   lugar quando tudo passa. Os quadros de 0, 6 e 11,9 s ficam em .tmp-qa/video/, para
   conferência a olho.

   Uso (de tests/site, com o ffmpeg no PATH): PW_CHANNEL=chrome node qa/video.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { criarServidor } from '../../../dev/site/serve.mjs';

/** @typedef {import('@playwright/test').Page} Page */

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const destino = path.join(raizRepo, 'assets', 'site', 'video');
const conferencia = path.join(raizRepo, '.tmp-qa', 'video');
const saida = path.join(conferencia, 'saida');

const FPS = 30;
const QUADROS = 12 * FPS;
/** Quadros guardados para conferência a olho: índice e nome do arquivo. */
const PARA_CONFERIR = new Map([
  [0, 'quadro-00.0s.png'],
  [180, 'quadro-06.0s.png'],
  [357, 'quadro-11.9s.png'],
]);

const KB = 1024;
const MB = 1024 * KB;
/** Tetos da spec 6.2, em bytes (os mesmos de unit/video.test.mjs). @type {Record<string, number>} */
const TETOS = {
  'onda-1920.webm': 2.5 * MB,
  'onda-1920.mp4': 2.5 * MB,
  'onda-1280.webm': 1.2 * MB,
  'onda-1280.mp4': 1.2 * MB,
  'onda-poster.webp': 120 * KB,
};

// Cor: a cena é sRGB. Os vídeos passam para YUV com a matriz BT.709, em faixa limitada, e o
// setparams marca isso em cada quadro, com a curva sRGB da origem. A marcação vai no quadro
// porque o ffmpeg 8 tira a cor do quadro, não de -colorspace e afins na saída. Sem marcação,
// o Chrome erra o verde dos tons claros; com ela, o vídeo bate com o pôster, que fica no
// padrão do WebP (BT.601) que todo decodificador assume.
const CONVERTER = 'out_color_matrix=bt709:out_range=tv';
const MARCAR = 'format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=iec61966-2-1:range=tv';
// +bitexact tira do arquivo o identificador aleatório do WebM: rodar de novo sem mudar a cena
// dá os mesmos bytes, e o git não ganha binário novo à toa.
const REPRODUZIVEL = ['-fflags', '+bitexact'];
const VP9 = ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-an', ...REPRODUZIVEL];
const H264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', ...REPRODUZIVEL];
const WEBP = ['-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', '-pix_fmt', 'yuv420p', ...REPRODUZIVEL];
const FILTROS = [
  '[0:v]split=3[grande][menor][poster]',
  `[grande]scale=${CONVERTER},${MARCAR},split=2[g1][g2]`,
  `[menor]scale=1280:720:flags=lanczos:${CONVERTER},${MARCAR},split=2[m1][m2]`,
].join(';');
const ARGUMENTOS = [
  '-hide_banner', '-loglevel', 'warning', '-stats', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-filter_complex', FILTROS,
  '-map', '[g1]', ...VP9, path.join(saida, 'onda-1920.webm'),
  '-map', '[g2]', ...H264, path.join(saida, 'onda-1920.mp4'),
  '-map', '[m1]', ...VP9, path.join(saida, 'onda-1280.webm'),
  '-map', '[m2]', ...H264, path.join(saida, 'onda-1280.mp4'),
  '-map', '[poster]', ...WEBP, path.join(saida, 'onda-poster.webp'),
];

/** PNG do instante t, lido do canvas da cena. @param {Page} aba @param {number} t */
async function quadro(aba, t) {
  const url = await aba.evaluate((t) => {
    const canvas = document.querySelector('canvas');
    if (!canvas || !window.desenhar) throw new Error('a cena não tem canvas nem desenhar()');
    window.desenhar(t);
    return canvas.toDataURL('image/png');
  }, t);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

/** desenhar(0) e desenhar(12) dão o mesmo quadro? @param {Page} aba */
function costuraFechada(aba) {
  return aba.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas || !window.desenhar) throw new Error('a cena não tem canvas nem desenhar()');
    window.desenhar(0);
    const inicio = canvas.toDataURL('image/png');
    window.desenhar(12);
    return canvas.toDataURL('image/png') === inicio;
  });
}

/** Desenha os 360 quadros e manda cada um ao ffmpeg. @param {Page} aba */
async function gravar(aba) {
  const ffmpeg = spawn('ffmpeg', ARGUMENTOS, { stdio: ['pipe', 'inherit', 'inherit'] });
  const fim = new Promise((ok, falha) => {
    ffmpeg.on('error', (erro) => falha(new Error(`não deu para rodar o ffmpeg (está no PATH?): ${erro.message}`)));
    ffmpeg.on('close', (codigo) => (codigo === 0 ? ok(undefined) : falha(new Error(`o ffmpeg saiu com código ${codigo}`))));
  });
  fim.catch(() => {}); // o erro é lido no await do fim; aqui só evita a rejeição sem dono
  ffmpeg.stdin.on('error', () => {}); // se o ffmpeg cair, o motivo chega pelo fim
  const escoar = () => new Promise((ok) => ffmpeg.stdin.once('drain', ok));
  for (let i = 0; i < QUADROS && ffmpeg.exitCode === null; i++) {
    const png = await quadro(aba, i / FPS);
    const nome = PARA_CONFERIR.get(i);
    if (nome) fs.writeFileSync(path.join(conferencia, nome), png);
    if (!ffmpeg.stdin.write(png)) await Promise.race([escoar(), fim]);
  }
  ffmpeg.stdin.end();
  await fim;
}

/** Imprime o tamanho de cada arquivo contra o teto. Devolve true se todos cabem. */
function conferirTetos() {
  let cabem = true;
  for (const [nome, teto] of Object.entries(TETOS)) {
    const tamanho = fs.statSync(path.join(saida, nome)).size;
    const cabe = tamanho <= teto;
    cabem &&= cabe;
    const uso = `${(tamanho / KB).toFixed(1)} KB (${tamanho} bytes) de ${(teto / KB).toFixed(1)} KB`;
    console[cabe ? 'log' : 'error'](`${cabe ? 'cabe' : 'PASSA DO TETO'}  ${nome}: ${uso}`);
  }
  return cabem;
}

fs.mkdirSync(saida, { recursive: true });
const servidor = criarServidor({ raiz: raizRepo });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
const endereco = servidor.address();
const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;
const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
try {
  const aba = await navegador.newPage({ viewport: { width: 1920, height: 1080 } });
  await aba.goto(`http://127.0.0.1:${porta}/dev/site/video/cena.html`);
  await aba.waitForFunction(() => typeof window.desenhar === 'function');
  if (!(await costuraFechada(aba))) {
    console.error('costura do loop: desenhar(0) e desenhar(12) dão quadros diferentes; alguma grandeza não dá um número inteiro de voltas em 12 s');
    process.exitCode = 1;
  } else {
    console.log('costura do loop: ok, desenhar(0) e desenhar(12) dão o mesmo quadro');
    const inicio = Date.now();
    await gravar(aba);
    console.log(`gravação: ${((Date.now() - inicio) / 1000).toFixed(0)} s; quadros de conferência em ${path.relative(raizRepo, conferencia)}`);
    if (conferirTetos()) {
      fs.mkdirSync(destino, { recursive: true });
      for (const nome of Object.keys(TETOS)) fs.copyFileSync(path.join(saida, nome), path.join(destino, nome));
      console.log(`arquivos gravados em ${path.relative(raizRepo, destino)}`);
    } else {
      console.error(`nada mudou em ${path.relative(raizRepo, destino)}; os arquivos desta rodada estão em ${path.relative(raizRepo, saida)}`);
      process.exitCode = 1;
    }
  }
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await navegador.close();
  servidor.close();
}
