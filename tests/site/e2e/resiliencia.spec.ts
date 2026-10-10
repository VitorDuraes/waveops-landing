import { test, expect } from '@playwright/test';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* Se o CSS não carregar (rede ruim, bloqueio, modo leitura), a página continua
   legível: nenhum ícone SVG estoura para a largura da tela (todo <svg> tem
   width/height de piso) e o texto principal continua lá. Já aconteceu numa captura:
   sem CSS, a Home passou de 33 mil px de altura. Roda só no desktop. */
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'o tamanho de piso não depende da largura');
});

for (const pagina of paginasJson.paginas.filter((p) => p.indexavel !== false)) {
  test(`${pagina.url} sem CSS não tem SVG gigante e mantém o h1`, async ({ page }) => {
    await page.route('**/*.css*', (rota) => rota.abort());
    await page.goto(pagina.url);
    const maiorSvg = await page.evaluate(() =>
      Math.max(0, ...[...document.querySelectorAll('svg')].map((s) => s.getBoundingClientRect().width)),
    );
    expect(maiorSvg).toBeLessThan(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).not.toHaveText('');
  });
}
