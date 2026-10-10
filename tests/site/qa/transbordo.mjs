// @ts-check
/* Acha os elementos que passam da largura da janela. Ferramenta local de diagnóstico.
   Uso (de tests/site): PW_CHANNEL=chrome node qa/transbordo.mjs /caminho/ 360 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { criarServidor } from '../../../dev/site/serve.mjs';

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const caminho = process.argv[2] ?? '/';
const largura = Number(process.argv[3] ?? 360);

const servidor = criarServidor({ raiz: raizRepo });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
const endereco = servidor.address();
const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;
const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
try {
  const aba = await navegador.newPage({ viewport: { width: largura, height: 900 } });
  await aba.goto(`http://127.0.0.1:${porta}${caminho}`);
  const culpados = await aba.evaluate(() => {
    const limite = document.documentElement.clientWidth;
    /** @type {{ seletor: string, direita: number, largura: number }[]} */
    const lista = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= limite + 0.5) continue;
      const filhoTambem = [...el.children].some((f) => f.getBoundingClientRect().right > limite + 0.5);
      if (filhoTambem) continue;
      const classe = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '';
      lista.push({ seletor: `${el.tagName.toLowerCase()}${classe}`, direita: Math.round(r.right), largura: Math.round(r.width) });
    }
    return { limite, documento: document.documentElement.scrollWidth, lista: lista.slice(0, 25) };
  });
  console.log(JSON.stringify(culpados, null, 1));
} finally {
  await navegador.close();
  servidor.close();
}
