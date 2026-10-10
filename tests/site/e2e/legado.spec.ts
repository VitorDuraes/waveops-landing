import { test, expect } from '@playwright/test';

/* Âncoras da página única antiga chegam por anúncio, WhatsApp e portal. O servidor
   não vê o #, então a Home redireciona no navegador. Roda só no desktop. */
const CASOS: [string, string][] = [
  ['#contato', '/contato/'],
  ['#pacotes', '/projetos-sob-medida/#modelos'],
  ['#servicos', '/solucoes/'],
  ['#casos', '/demonstracoes-tecnicas/'],
  ['#como', '/projetos-sob-medida/#como-trabalhamos'],
  ['#faq', '/projetos-sob-medida/#perguntas'],
  ['#publicos', '/solucoes/#publicos'],
  ['#operacao', '/plataforma/'],
];

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'redirect não depende da largura');
});

for (const [antiga, destino] of CASOS) {
  test(`/${antiga} leva a ${destino}`, async ({ page }) => {
    await page.goto(`/${antiga}`);
    await expect(page).toHaveURL(new RegExp(`${destino.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`));
  });
}

test('âncora que existe na Home nova não redireciona', async ({ page }) => {
  await page.goto('/#solucoes');
  await expect(page).toHaveURL(/\/#solucoes$/);
  await expect(page.locator('#solucoes')).toBeVisible();
});

test('rota inexistente responde 404 com a página de erro', async ({ page }) => {
  const resposta = await page.goto('/pagina-que-nao-existe/');
  expect(resposta?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página não existe.');
});
