// @ts-check
/* Gera assets/og-waveops.png (1200 x 630) a partir de dev/site/og.html.
   Uso (de tests/site): PW_CHANNEL=chrome node qa/og.mjs */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { criarServidor } from '../../../dev/site/serve.mjs';

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const servidor = criarServidor({ raiz: raizRepo });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
const endereco = servidor.address();
const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;
const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
try {
  const aba = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
  await aba.goto(`http://127.0.0.1:${porta}/dev/site/og.html`);
  await aba.evaluate(() => document.fonts.ready);
  const destino = path.join(raizRepo, 'assets', 'og-waveops.png');
  await aba.screenshot({ path: destino, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`imagem gerada: ${path.relative(raizRepo, destino)}`);
} finally {
  await navegador.close();
  servidor.close();
}
