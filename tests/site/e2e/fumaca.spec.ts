import { test, expect } from '@playwright/test';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* Fumaça: toda página de dev/site/paginas.json responde, tem um h1 e não loga erro.
   Página que ainda não foi escrita é pulada, para a suíte servir desde a fundação. */
const paginas = paginasJson.paginas.filter((p) => p.indexavel !== false);

for (const pagina of paginas) {
  test(`@fumaca ${pagina.url} abre sem erro de console`, async ({ page }) => {
    const erros: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') erros.push(msg.text());
    });
    page.on('pageerror', (erro) => erros.push(erro.message));
    const resposta = await page.goto(pagina.url);
    test.skip(resposta?.status() === 404, `${pagina.arquivo} ainda não existe`);
    expect(resposta?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(erros).toEqual([]);
  });
}
