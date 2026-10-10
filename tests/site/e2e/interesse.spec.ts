import { test, expect, type Page, type Route } from '@playwright/test';

/* Jornadas da lista de interesse da Plataforma. */

test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'tablet', 'formulário coberto em desktop e celular');
});

async function abrir(page: Page) {
  await page.clock.install();
  const resposta = await page.goto('/plataforma/');
  test.skip(resposta?.status() === 404, 'plataforma/index.html ainda não existe');
  await expect(page.locator('#form-interesse')).toBeVisible();
}

async function interceptar(page: Page, responder: (route: Route, n: number) => Promise<void> | void) {
  const pedidos: Record<string, unknown>[] = [];
  await page.route('**/__dev/interesse*', async (route) => {
    pedidos.push(JSON.parse(route.request().postData() ?? '{}'));
    await responder(route, pedidos.length);
  });
  return pedidos;
}

const ok = (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, protocolo: 'p-1' }) });

test('e-mail inválido mostra o erro do design e foca o campo', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  await page.locator('#pl-email').fill('ana@');
  await page.locator('#pl-politica').check();
  await page.getByRole('button', { name: 'Entrar na lista de interesse' }).click();
  await expect(page.locator('#e-pl-email')).toHaveText('Informe um e-mail válido.');
  await expect(page.locator('#pl-email')).toBeFocused();
  await expect(page.locator('#pl-email')).toHaveAttribute('aria-invalid', 'true');
  expect(pedidos).toHaveLength(0);
});

test('sem a ciência da política não entra na lista', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  await page.locator('#pl-email').fill('ana@empresa.com.br');
  await page.getByRole('button', { name: 'Entrar na lista de interesse' }).click();
  await expect(page.locator('#e-pl-politica')).toBeVisible();
  await expect(page.locator('#pl-politica')).toBeFocused();
  expect(pedidos).toHaveLength(0);
});

test('com o servidor gravando, confirma com o e-mail normalizado e registra a ciência', async ({ page }) => {
  await abrir(page);
  const pedidos = await interceptar(page, ok);
  await page.locator('#pl-email').fill('  Ana@Empresa.COM.br ');
  await page.locator('#pl-politica').check();
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Entrar na lista de interesse' }).click();
  await expect(page.locator('#interesse-confirmacao')).toBeVisible();
  await expect(page.locator('#interesse-confirmacao')).toContainText('Você está na lista.');
  await expect(page.locator('[data-confirmacao-email]')).toHaveText('ana@empresa.com.br');
  await expect(page.locator('[data-confirmacao-titulo]')).toBeFocused();
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0]).toMatchObject({
    email: 'ana@empresa.com.br',
    finalidade: 'aviso_abertura_plataforma',
    origem: 'plataforma',
    politicaCiente: true,
    marketingAceito: false,
  });
});

test('falha do servidor mantém o e-mail e oferece tentar de novo', async ({ page }) => {
  await abrir(page);
  await interceptar(page, (route) => route.fulfill({ status: 503, body: '' }));
  await page.locator('#pl-email').fill('ana@empresa.com.br');
  await page.locator('#pl-politica').check();
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Entrar na lista de interesse' }).click();
  await expect(page.locator('#interesse-falha')).toBeVisible();
  await expect(page.locator('#pl-email')).toHaveValue('ana@empresa.com.br');
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(page.locator('#interesse-confirmacao')).toBeHidden();
});
