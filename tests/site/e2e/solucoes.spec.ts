import { test, expect } from '@playwright/test';
import { varrerContraste } from './helpers/contraste';

test.describe('Soluções', () => {
  test.use({ reducedMotion: 'reduce' });

  test('o índice leva ao resultado e as frentes chegam à oferta correta', async ({ page }) => {
    await page.goto('/solucoes/');
    const ids = ['vender', 'atender', 'operar', 'decidir', 'crescer'];
    for (const id of ids) {
      await page.locator(`.wo-solucoes-indice a[href="#${id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      const titulo = page.locator(`#${id}-titulo`);
      await expect(titulo).toBeInViewport();
      const topo = await page.locator('.wo-topo').boundingBox();
      const caixa = await titulo.boundingBox();
      expect(caixa!.y, `${id}: título fora da área coberta pelo topo`).toBeGreaterThanOrEqual(topo!.y + topo!.height);
    }
    const destinos = await page.locator('.wo-solucoes-frentes a').evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href')!))]);
    expect(destinos).toHaveLength(5);
    for (const destino of destinos) {
      await page.locator(`.wo-solucoes-frentes a[href="${destino}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(destino));
      await expect(page.locator(`${destino.slice(destino.indexOf('#'))} h3`)).toBeInViewport();
      await page.goto('/solucoes/');
    }
  });

  test('hero e cada seção mantêm contraste AA durante a rolagem', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', '1440 × 900 e 390 × 844 cobrem as duas grades');
    test.setTimeout(240_000);
    const trechos = ['.wo-abertura', '#vender', '#atender', '#operar', '#decidir', '#crescer', '#publicos', '.wo-cta'];
    const medidos = await varrerContraste(page, '/solucoes/', trechos);
    await info.attach('contraste-solucoes.json', { body: JSON.stringify(medidos, null, 2), contentType: 'application/json' });
    for (const trecho of trechos) {
      expect(medidos.filter((alvo) => alvo.trecho === trecho).length, trecho).toBeGreaterThan(0);
    }
    expect(medidos.filter((alvo) => alvo.passos < 3).map((alvo) => `${alvo.texto}: ${alvo.passos} passos`)).toEqual([]);
    const abaixo = medidos.filter((alvo) => alvo.pior && alvo.pior.razao < alvo.minimo).map((alvo) => ({
      texto: alvo.texto, trecho: alvo.trecho, cor: alvo.cor, tamanho: alvo.tamanho, peso: alvo.peso,
      minimo: alvo.minimo, ...alvo.pior,
    }));
    expect(abaixo).toEqual([]);
  });
});

test.describe('Soluções sem JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  test('índice, resultados e contratação permanecem acessíveis', async ({ page }) => {
    await page.goto('/solucoes/');
    await page.getByRole('navigation', { name: 'Resultados', exact: true }).getByRole('link', { name: 'Decidir com dados' }).click();
    await expect(page.locator('#decidir-titulo')).toBeInViewport();
    await expect(page.locator('#decidir-contratar').getByRole('link', { name: 'Painéis de gestão', exact: true })).toHaveAttribute('href', '/projetos-sob-medida/#dashboards');
    await expect(page.locator('main > section')).toHaveCount(8);
    await expect(page.locator('[data-fundo-video]')).not.toHaveAttribute('src');
  });
});
