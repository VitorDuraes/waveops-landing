import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* Palco das cinco frentes da Home (spec 13). No desktop alto, a cena da frente da vez fica
   parada ao lado da lista e se monta conforme a rolagem; abaixo de 1024 x 600 px, cada cena se
   monta embaixo do texto da sua frente; com menos movimento, tudo aparece montado. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Espera dois quadros: a rolagem chega ao módulo e o quadro que ela agendou já rodou. */
async function quadro(page: Page) {
  await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))));
}

/** Rola até o topo do bloco da frente ficar em innerHeight / 2 - p × 0,75 × altura. */
async function rolarProgresso(page: Page, frente: string, p: number) {
  await page.evaluate(
    ({ frente, p }) => {
      const bloco = document.querySelector(`[data-frente="${frente}"]`);
      if (!bloco) throw new Error(`frente ${frente} não encontrada`);
      const caixa = bloco.getBoundingClientRect();
      const alvo = innerHeight / 2 - p * 0.75 * caixa.height;
      window.scrollTo({ top: scrollY + caixa.top - alvo, behavior: 'instant' });
    },
    { frente, p },
  );
  await quadro(page);
}

/** Rola até o topo da cena ficar na fração indicada da altura da janela. */
async function rolarCena(page: Page, cena: string, fracao: number) {
  await page.evaluate(
    ({ cena, fracao }) => {
      const figura = document.querySelector(`[data-cena="${cena}"]`);
      if (!figura) throw new Error(`cena ${cena} não encontrada`);
      const topo = figura.getBoundingClientRect().top;
      window.scrollTo({ top: scrollY + topo - fracao * innerHeight, behavior: 'instant' });
    },
    { cena, fracao },
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

test.describe('palco no desktop', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'o palco fixo é do desktop; o celular tem o próprio teste');
  });

  test('a cena da frente da vez fica ativa e as outras não', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0.2);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fixo');
    await expect(page.locator('[data-cena="atendimento"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="agentes"]')).not.toHaveAttribute('data-ativa');
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

  test('rolar até a segunda frente troca a cena', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'agentes', 0.2);
    await expect(page.locator('[data-cena="agentes"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="atendimento"]')).not.toHaveAttribute('data-ativa');
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

  test.describe('em 1280 x 650', () => {
    test.use({ viewport: { width: 1280, height: 650 } });

    test('o palco e a última peça cabem na janela', async ({ page }) => {
      await page.goto('/');
      await rolarProgresso(page, 'atendimento', 1);
      await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
      await semTransicao(page);
      const cena = await page.locator('[data-cena="atendimento"]').boundingBox();
      const ultima = await page.locator('[data-cena="atendimento"] [data-passo="6"]').boundingBox();
      if (!cena || !ultima) throw new Error('cena ou última peça sem caixa');
      expect(cena.y).toBeGreaterThanOrEqual(0);
      expect(cena.y + cena.height).toBeLessThanOrEqual(650);
      expect(ultima.x).toBeGreaterThanOrEqual(cena.x);
      expect(ultima.y).toBeGreaterThanOrEqual(cena.y);
      expect(ultima.x + ultima.width).toBeLessThanOrEqual(cena.x + cena.width);
      expect(ultima.y + ultima.height).toBeLessThanOrEqual(cena.y + cena.height);
    });
  });

  test('abaixo de 1024 px de largura vira cena embaixo do texto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fixo');
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'local');
    const bloco = await page.locator('[data-frente="atendimento"]').boundingBox();
    const cena = await page.locator('[data-cena="atendimento"]').boundingBox();
    if (!bloco || !cena) throw new Error('bloco ou cena sem caixa');
    expect(cena.y).toBeGreaterThanOrEqual(bloco.y + bloco.height);
  });

  test('abaixo de 600 px de altura também', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fixo');
    await page.setViewportSize({ width: 1280, height: 550 });
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'local');
  });

  test('o axe não acusa nada grave na seção', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await rolarProgresso(page, 'atendimento', 1);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
    await semTransicao(page);
    const resultado = await new AxeBuilder({ page }).include('[data-palco]').withTags(TAGS).analyze();
    const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(graves.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });

  test('a preferência muda com a página aberta', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fixo');
    await semTransicao(page);
    expect(await pecasApagadas(page)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    await expect.poll(() => pecasApagadas(page)).toBe(0);
  });
});

test('celular: cada cena fica abaixo da sua frente e se monta ao entrar', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'só o celular');
  await page.goto('/');
  await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'local');
  const bloco = await page.locator('[data-frente="atendimento"]').boundingBox();
  const cena = await page.locator('[data-cena="atendimento"]').boundingBox();
  if (!bloco || !cena) throw new Error('bloco ou cena sem caixa');
  expect(cena.y).toBeGreaterThanOrEqual(bloco.y + bloco.height);
  await rolarCena(page, 'atendimento', 0.9);
  await expect.poll(() => montadas(page, 'atendimento')).toBe(1);
  await rolarCena(page, 'atendimento', 0.35);
  await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
});

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
