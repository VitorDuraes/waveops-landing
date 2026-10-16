// @ts-check
/* Material de aprovação de uma cena do palco das cinco frentes (spec 13.8).

   Captura a cena em cada passo, em 1440 x 900 (palco fixo) e em 390 x 844 (cena embaixo do
   texto), e grava em 1440 x 900 a rolagem pela frente: desce até a cena montar inteira e sobe
   um pouco para mostrar a desmontagem.

   No celular, o passo depende de onde o topo da cena está, e nos primeiros passos ela ainda
   está no pé da tela. Para a captura mostrar a cena inteira, o script chega ao passo rolando,
   congela o palco (barra o evento de rolagem antes do módulo da Home) e só então centraliza a
   cena. O congelamento é desta ferramenta: a página não sabe dele.

   Uso (de tests/site): PW_CHANNEL=chrome node qa/palco.mjs atendimento
   Saída: .tmp-qa/palco/<cena>-<largura>-passo-<n>.png e .tmp-qa/palco/<cena>-rolagem.webm,
   na raiz do repo. */
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

/** Espera dois quadros e o fim das transições. @param {Page} aba */
async function assentar(aba) {
  await aba.evaluate(async () => {
    await new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto)));
    await Promise.all(document.getAnimations().map((animacao) => animacao.finished.catch(() => undefined)));
  });
}

/** Rolagem em que a frente tem o progresso p no modo fixo (spec 13.4). @param {Page} aba @param {number} p */
function rolagemDoProgresso(aba, p) {
  return aba.evaluate(
    ({ cena, p }) => {
      const bloco = document.querySelector(`[data-frente="${cena}"]`);
      if (!bloco) throw new Error(`frente ${cena} não encontrada`);
      const caixa = bloco.getBoundingClientRect();
      return scrollY + caixa.top - (innerHeight / 2 - p * 0.75 * caixa.height);
    },
    { cena, p },
  );
}

/** Rolagem em que o topo da cena fica na fração indicada da janela. @param {Page} aba @param {number} fracao */
function rolagemDoTopo(aba, fracao) {
  return aba.evaluate(
    ({ cena, fracao }) => {
      const figura = document.querySelector(`[data-cena="${cena}"]`);
      if (!figura) throw new Error(`cena ${cena} não encontrada`);
      return scrollY + figura.getBoundingClientRect().top - fracao * innerHeight;
    },
    { cena, fracao },
  );
}

/** @param {Page} aba @param {number} topo */
async function rolarPara(aba, topo) {
  await aba.evaluate((topo) => window.scrollTo({ top: topo, behavior: 'instant' }), topo);
  await assentar(aba);
}

/** Maior passo montado na cena. @param {Page} aba */
function montadas(aba) {
  return aba.evaluate((cena) => {
    const pecas = document.querySelectorAll(`[data-cena="${cena}"] [data-passo][data-visivel]`);
    return Math.max(0, ...[...pecas].map((peca) => Number(peca.getAttribute('data-passo'))));
  }, cena);
}

const servidor = criarServidor({ raiz: raizRepo });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
const endereco = servidor.address();
const base = `http://127.0.0.1:${typeof endereco === 'object' && endereco ? endereco.port : 0}`;
const navegador = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

try {
  for (const janela of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const aba = await navegador.newPage({ viewport: janela });
    await aba.goto(`${base}/`);
    await aba.evaluate(() => document.fonts.ready);
    // Barreira de rolagem do congelamento: na captura do window, antes do listener do módulo.
    await aba.evaluate(() => {
      window.addEventListener('scroll', (evento) => {
        if (document.documentElement.hasAttribute('data-qa-congelado')) evento.stopImmediatePropagation();
      }, true);
    });
    const modo = await aba.locator('[data-palco]').getAttribute('data-palco-modo');
    if (!modo) throw new Error('o palco não ligou: confira o movimento reduzido do sistema');
    const total = await aba.evaluate((cena) => {
      const pecas = document.querySelectorAll(`[data-cena="${cena}"] [data-passo]`);
      return Math.max(0, ...[...pecas].map((peca) => Number(peca.getAttribute('data-passo'))));
    }, cena);
    if (!total) throw new Error(`cena ${cena} sem peças`);

    for (let passo = 1; passo <= total; passo += 1) {
      // O meio do trecho do passo, para a captura não cair na fronteira entre dois passos.
      const progresso = (passo - 0.5) / total;
      if (modo === 'fixo') {
        await rolarPara(aba, await rolagemDoProgresso(aba, progresso));
      } else {
        await rolarPara(aba, await rolagemDoTopo(aba, 0.9 - progresso * 0.55));
      }
      const visto = await montadas(aba);
      if (visto !== passo) throw new Error(`${janela.width} px: esperava o passo ${passo} e a cena está no ${visto}`);
      if (modo !== 'fixo') {
        await aba.evaluate(() => document.documentElement.setAttribute('data-qa-congelado', ''));
        const altura = await aba.locator(`[data-cena="${cena}"]`).evaluate((figura) => figura.getBoundingClientRect().height);
        await rolarPara(aba, await rolagemDoTopo(aba, Math.max(0.02, (1 - altura / janela.height) / 2)));
      }
      const destino = path.join(saida, `${cena}-${janela.width}-passo-${passo}.png`);
      await aba.screenshot({ path: destino });
      await aba.evaluate(() => document.documentElement.removeAttribute('data-qa-congelado'));
      console.log(`captura: ${path.relative(raizRepo, destino)}`);
    }
    await aba.close();
  }

  // Vídeo: 1440 x 900. Abre na âncora da seção, desce até a cena montar inteira, para, e sobe
  // um pouco para mostrar a desmontagem. Cada trecho é o progresso da frente e a duração.
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: saida, size: { width: 1440, height: 900 } },
  });
  const aba = await contexto.newPage();
  await aba.goto(`${base}/#frentes`);
  await aba.evaluate(() => document.fonts.ready);
  await assentar(aba);
  await aba.waitForTimeout(700);
  for (const { progresso, ms } of [
    { progresso: 1.15, ms: 4200 },
    { progresso: 1.15, ms: 900 },
    { progresso: 0.3, ms: 1600 },
    { progresso: 0.3, ms: 700 },
  ]) {
    const alvo = await rolagemDoProgresso(aba, progresso);
    await aba.evaluate(
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
  const video = aba.video();
  await contexto.close();
  if (video) {
    const destino = path.join(saida, `${cena}-rolagem.webm`);
    await video.saveAs(destino);
    await video.delete();
    console.log(`vídeo: ${path.relative(raizRepo, destino)}`);
  }
} finally {
  await navegador.close();
  servidor.close();
}
