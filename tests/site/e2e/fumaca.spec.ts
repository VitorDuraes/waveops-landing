import { test, expect } from '@playwright/test';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* Fumaça: toda página de dev/site/paginas.json responde 200, tem um h1 e não loga erro. */
const paginas = paginasJson.paginas.filter((p) => p.indexavel !== false);

for (const pagina of paginas) {
  test(`@fumaca ${pagina.url} abre sem erro de console`, async ({ page }) => {
    const erros: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') erros.push(msg.text());
    });
    page.on('pageerror', (erro) => erros.push(erro.message));
    const resposta = await page.goto(pagina.url);
    expect(resposta?.status(), `${pagina.arquivo} tem de existir`).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(erros).toEqual([]);
  });
}
