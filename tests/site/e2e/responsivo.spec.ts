import { test, expect } from '@playwright/test';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* Nenhuma página pode rolar na horizontal entre 360 e 1440 px. Roda só no projeto
   desktop, porque a própria spec troca a largura da janela. */
const LARGURAS = [360, 390, 768, 1024, 1280, 1440];

for (const pagina of paginasJson.paginas) {
  test(`${pagina.url} não rola na horizontal de 360 a 1440 px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a spec controla a largura sozinha');
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 900 });
      const resposta = await page.goto(pagina.url);
      test.skip(resposta?.status() === 404, `${pagina.arquivo} ainda não existe`);
      const medidas = await page.evaluate(() => ({
        documento: document.documentElement.scrollWidth,
        janela: document.documentElement.clientWidth,
      }));
      expect(medidas.documento, `largura ${largura}px`).toBeLessThanOrEqual(medidas.janela);
    }
  });
}
