import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* Palco de fundo da Home (spec 13). Com o palco ligado, as cinco cenas ficam fixas na tela, atrás
   do texto: a do capítulo da vez aparece e se monta conforme a rolagem, e antes do primeiro
   capítulo nenhuma aparece. Com menos movimento, sem JavaScript ou com a janela abaixo de 560 px
   de altura, o palco desliga e cada capítulo mostra o painel e a cena já montada. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Espera dois quadros: a rolagem chega ao módulo e o quadro que ela agendou já rodou. */
async function quadro(page: Page) {
  await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))));
}

/** Rola até o topo do capítulo ficar em innerHeight / 2 - p × 0,75 × altura. A rolagem é
    arredondada para cima: com p = 0, o topo fica na linha ou logo acima, nunca uma fração abaixo. */
async function rolarProgresso(page: Page, frente: string, p: number) {
  await page.evaluate(
    ({ frente, p }) => {
      const capitulo = document.querySelector(`[data-frente="${frente}"]`);
      if (!capitulo) throw new Error(`capítulo ${frente} não encontrado`);
      const caixa = capitulo.getBoundingClientRect();
      const alvo = innerHeight / 2 - p * 0.75 * caixa.height;
      window.scrollTo({ top: Math.ceil(scrollY + caixa.top - alvo), behavior: 'instant' });
    },
    { frente, p },
  );
  await quadro(page);
}

/** Maior data-passo montado na cena, ou 0. Um passo pode ter mais de uma peça. */
async function montadas(page: Page, cena: string) {
  return page.evaluate((cena) => {
    const pecas = document.querySelectorAll<HTMLElement>(`[data-cena="${cena}"] [data-passo][data-visivel]`);
    return Math.max(0, ...[...pecas].map((peca) => Number(peca.dataset.passo)));
  }, cena);
}

/** Espera as transições acabarem, para não medir no meio delas. */
async function semTransicao(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animacao) => animacao.finished.catch(() => undefined)));
  });
}

/** Quantas peças do palco não estão com opacidade 1. */
function pecasApagadas(page: Page) {
  return page.locator('[data-cena] [data-passo]').evaluateAll((pecas) => pecas.filter((peca) => getComputedStyle(peca).opacity !== '1').length);
}

/** Violações sérias ou críticas do axe dentro da seção do palco. */
async function gravesNoPalco(page: Page) {
  const resultado = await new AxeBuilder({ page }).include('[data-palco]').withTags(TAGS).analyze();
  return resultado.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('palco ligado no desktop e no celular', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'o tablet usa o layout do celular');
  });

  test('antes do primeiro capítulo nenhuma cena aparece', async ({ page }) => {
    await page.goto('/');
    await page.locator('.wo-home-frentes__abertura').evaluate((abertura) => abertura.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await quadro(page);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await expect(page.locator('[data-cena][data-ativa]')).toHaveCount(0);
    await expect(page.locator('.wo-home-fundo')).not.toHaveAttribute('data-capitulo');
  });

  test('a cena do capítulo da vez fica ativa e as outras não', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0.2);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await expect(page.locator('[data-cena="atendimento"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-frente="atendimento"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="agentes"]')).not.toHaveAttribute('data-ativa');
    await expect(page.locator('.wo-home-fundo')).toHaveAttribute('data-capitulo', 'atendimento');
  });
});

test.describe('palco no desktop', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'os casos de rolagem e de janela rodam no desktop');
  });

  test('os passos crescem ao descer e diminuem ao subir', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(1);
    await rolarProgresso(page, 'atendimento', 1);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
    await rolarProgresso(page, 'atendimento', 0.1);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(1);
  });

  test('rolar até o segundo capítulo troca a cena', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'agentes', 0.2);
    await expect(page.locator('[data-cena="agentes"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="atendimento"]')).not.toHaveAttribute('data-ativa');
    await expect(page.locator('.wo-home-fundo')).toHaveAttribute('data-capitulo', 'agentes');
  });

  test('o estado vale depois de recarregar no meio da seção', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'agentes', 0.5);
    await page.reload();
    await quadro(page);
    await expect(page.locator('[data-cena="agentes"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="atendimento"]')).not.toHaveAttribute('data-ativa');
  });

  test('voltar do histórico mantém o estado', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'agentes', 0.5);
    await page.goto('/solucoes/');
    await page.goBack();
    await quadro(page);
    await expect(page.locator('[data-cena="agentes"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="atendimento"]')).not.toHaveAttribute('data-ativa');
  });

  test('a folha creme cobre o fundo depois do palco', async ({ page }) => {
    await page.goto('/');
    await page.locator('#entradas-titulo').evaluate((titulo) => titulo.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await quadro(page);
    const noCentro = await page.evaluate(() => {
      const elemento = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return elemento?.closest('.wo-home-folha') ? 'folha' : (elemento?.outerHTML.slice(0, 80) ?? 'nada');
    });
    expect(noCentro).toBe('folha');
  });

  test('com menos de 560 px de altura o palco desliga', async ({ page }) => {
    await page.goto('/');
    await quadro(page);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    expect(await pecasApagadas(page)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 550 });
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    await expect.poll(() => pecasApagadas(page)).toBe(0);
  });

  test('a preferência muda com a página aberta', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await semTransicao(page);
    expect(await pecasApagadas(page)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    await expect(page.locator('.wo-home-fundo')).not.toHaveAttribute('data-capitulo');
    await expect.poll(() => pecasApagadas(page)).toBe(0);
  });

  test('o axe não acusa nada grave na seção com o palco ligado', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await rolarProgresso(page, 'atendimento', 1);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
    await semTransicao(page);
    expect(await gravesNoPalco(page)).toEqual([]);
  });

  test.describe('com menos movimento', () => {
    test.use({ reducedMotion: 'reduce' });

    test('o axe não acusa nada grave na seção com o palco desligado', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
      expect(await gravesNoPalco(page)).toEqual([]);
    });
  });
});

/* A cena ativa cabe inteira na área útil: abaixo do topo fixo, acima do fim da janela, dentro da
   largura e fora do painel. "Corpo da cena" é a tela desenhada; título e aviso ficam no canto dela. */
const JANELAS = [
  { width: 1440, height: 900, projeto: 'desktop' },
  { width: 1280, height: 650, projeto: 'desktop' },
  { width: 390, height: 844, projeto: 'celular' },
  { width: 360, height: 640, projeto: 'celular' },
];

for (const { projeto, ...janela } of JANELAS) {
  test.describe(`em ${janela.width} x ${janela.height}`, () => {
    test.use({ viewport: janela });

    test('a cena ativa cabe na área útil', async ({ page }, info) => {
      test.skip(info.project.name !== projeto, `essa janela roda no projeto ${projeto}`);
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await rolarProgresso(page, 'atendimento', 1);
      await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
      await semTransicao(page);
      const medidas = await page.evaluate(() => {
        const caixa = (seletor: string) => {
          const elemento = document.querySelector(seletor);
          if (!elemento) throw new Error(`${seletor} não encontrado`);
          const { top, bottom, left, right } = elemento.getBoundingClientRect();
          return { top, bottom, left, right };
        };
        // O topo vira fixo na Tarefa 3; até lá, a área útil já desconta a altura dele.
        const topoFixo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wo-topo-altura'));
        return {
          corpo: caixa('[data-cena="atendimento"][data-ativa] .wo-home-cena__tela'),
          painel: caixa('[data-frente="atendimento"][data-ativa] .wo-home-painel'),
          fimDoTopo: Math.max(caixa('.wo-topo').bottom, topoFixo),
          largura: document.documentElement.clientWidth,
          altura: innerHeight,
        };
      });
      const { corpo, painel } = medidas;
      expect(corpo.top).toBeGreaterThanOrEqual(medidas.fimDoTopo);
      expect(corpo.bottom).toBeLessThanOrEqual(medidas.altura);
      expect(corpo.left).toBeGreaterThanOrEqual(0);
      expect(corpo.right).toBeLessThanOrEqual(medidas.largura);
      const cruza = corpo.left < painel.right && corpo.right > painel.left && corpo.top < painel.bottom && corpo.bottom > painel.top;
      expect(cruza, `corpo ${JSON.stringify(corpo)} e painel ${JSON.stringify(painel)}`).toBe(false);
    });
  });
}

test.describe('com menos movimento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('palco desligado e tudo montado', async ({ page }) => {
    await page.goto('/');
    await quadro(page);
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    expect(await page.locator('[data-cena] [data-passo]').count()).toBeGreaterThanOrEqual(6);
    expect(await pecasApagadas(page)).toBe(0);
  });
});
