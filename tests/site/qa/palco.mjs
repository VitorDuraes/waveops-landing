// @ts-check
/* Material de aprovação de uma cena do palco de fundo da Home (spec 13.8).

   Captura a janela inteira (fundo, painel e cena) em cada passo da cena, em 1440 x 900 e em
   390 x 844, e grava nos dois tamanhos a rolagem pelo capítulo: abre na abertura das cinco
   frentes, desce até a cena montar inteira, para, e sobe um pouco para mostrar a desmontagem.
   Cada captura fica no meio do trecho do passo, para não cair na fronteira entre dois passos.
   O celular é capturado com densidade 2, como a tela de um aparelho.

   Uso (de tests/site): PW_CHANNEL=chrome node qa/palco.mjs atendimento
   Saída, na raiz do repo: .tmp-qa/palco/<cena>-<largura>-passo-<n>.png e
   .tmp-qa/palco/<cena>-rolagem-<largura>.webm */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { criarServidor } from '../../../dev/site/serve.mjs';

/** @typedef {import('@playwright/test').Page} Page */

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const cena = process.argv[2] ?? '';
if (!/^[a-z]+$/.test(cena)) {
  console.error('uso: node qa/palco.mjs <cena>   (atendimento, agentes, dashboards, crms ou saas)');
  process.exit(2);
}
const saida = path.join(raizRepo, '.tmp-qa', 'palco');
fs.mkdirSync(saida, { recursive: true });

const JANELAS = [
  { largura: 1440, altura: 900, densidade: 1, celular: false },
  { largura: 390, altura: 844, densidade: 2, celular: true },
];

/** Espera dois quadros e o fim das transições. @param {Page} aba */
async function assentar(aba) {
  await aba.evaluate(async () => {
    await new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto)));
    await Promise.all(document.getAnimations().filter((animacao) => animacao instanceof CSSTransition).map((animacao) => animacao.finished.catch(() => undefined)));
  });
}

/** Rolagem em que o capítulo tem o progresso p (spec 13.4), arredondada para cima. @param {Page} aba @param {number} p */
function rolagemDoProgresso(aba, p) {
  return aba.evaluate(
    ({ cena, p }) => {
      const capitulo = document.querySelector(`[data-frente="${cena}"]`);
      if (!capitulo) throw new Error(`capítulo ${cena} não encontrado`);
      const caixa = capitulo.getBoundingClientRect();
      return Math.ceil(scrollY + caixa.top - (innerHeight / 2 - p * 0.75 * caixa.height));
    },
    { cena, p },
  );
}

/** Maior passo montado na cena. @param {Page} aba */
function montadas(aba) {
  return aba.evaluate((cena) => {
    const pecas = document.querySelectorAll(`[data-cena="${cena}"] [data-passo][data-visivel]`);
    return Math.max(0, ...[...pecas].map((peca) => Number(peca.getAttribute('data-passo'))));
  }, cena);
}

/** Rola suavemente até `alvo` em `ms` milissegundos, como uma pessoa com a roda do mouse. @param {Page} aba @param {number} alvo @param {number} ms */
function rolarSuave(aba, alvo, ms) {
  return aba.evaluate(
    ({ alvo, ms }) =>
      new Promise((pronto) => {
        const de = scrollY;
        const inicio = performance.now();
        /** @param {number} agora */
        const quadro = (agora) => {
          const t = Math.min(1, (agora - inicio) / ms);
          const suave = t < 0.5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2;
          window.scrollTo({ top: de + (alvo - de) * suave, behavior: 'instant' });
          if (t < 1) requestAnimationFrame(quadro);
          else pronto(undefined);
        };
        requestAnimationFrame(quadro);
      }),
    { alvo, ms },
  );
}

const servidor = criarServidor({ raiz: raizRepo });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
const endereco = servidor.address();
const base = `http://127.0.0.1:${typeof endereco === 'object' && endereco ? endereco.port : 0}`;
const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

try {
  for (const janela of JANELAS) {
    const viewport = { width: janela.largura, height: janela.altura };
    const opcoes = { viewport, deviceScaleFactor: janela.densidade, isMobile: janela.celular, hasTouch: janela.celular };

    // Uma captura por passo.
    const contexto = await navegador.newContext(opcoes);
    const aba = await contexto.newPage();
    await aba.goto(`${base}/`);
    await aba.evaluate(() => document.fonts.ready);
    const modo = await aba.locator('[data-palco]').getAttribute('data-palco-modo');
    if (modo !== 'fundo') throw new Error('o palco não ligou: confira o movimento reduzido do sistema');
    const total = await aba.evaluate((cena) => {
      const pecas = document.querySelectorAll(`[data-cena="${cena}"] [data-passo]`);
      return Math.max(0, ...[...pecas].map((peca) => Number(peca.getAttribute('data-passo'))));
    }, cena);
    if (!total) throw new Error(`cena ${cena} sem peças`);
    for (let passo = 1; passo <= total; passo += 1) {
      const topo = await rolagemDoProgresso(aba, (passo - 0.5) / total);
      await aba.evaluate((topo) => window.scrollTo({ top: topo, behavior: 'instant' }), topo);
      await assentar(aba);
      const visto = await montadas(aba);
      if (visto !== passo) throw new Error(`${janela.largura} px: esperava o passo ${passo} e a cena está no ${visto}`);
      const destino = path.join(saida, `${cena}-${janela.largura}-passo-${passo}.png`);
      await aba.screenshot({ path: destino });
      console.log(`captura: ${path.relative(raizRepo, destino)}`);
    }
    await contexto.close();

    // Vídeo da rolagem pelo capítulo: abertura, montagem até o fim, pausa e um pouco de volta.
    const gravacao = await navegador.newContext({
      ...opcoes,
      recordVideo: { dir: saida, size: { width: janela.largura * janela.densidade, height: janela.altura * janela.densidade } },
    });
    const filme = await gravacao.newPage();
    await filme.goto(`${base}/#frentes`);
    await filme.evaluate(() => document.fonts.ready);
    await assentar(filme);
    await filme.waitForTimeout(1200);
    for (const { progresso, ms } of [
      { progresso: 1.15, ms: 6000 },
      { progresso: 1.15, ms: 1400 },
      { progresso: 0.3, ms: 1800 },
      { progresso: 0.3, ms: 900 },
    ]) {
      await rolarSuave(filme, await rolagemDoProgresso(filme, progresso), ms);
    }
    const video = filme.video();
    await gravacao.close();
    if (video) {
      const destino = path.join(saida, `${cena}-rolagem-${janela.largura}.webm`);
      await video.saveAs(destino);
      await video.delete();
      console.log(`vídeo: ${path.relative(raizRepo, destino)}`);
    }
  }
} finally {
  await navegador.close();
  servidor.close();
}
