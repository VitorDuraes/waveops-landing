import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* axe nos estados que só existem depois de interagir: erro, falha e confirmação dos
   formulários, e o menu aberto no celular. O teste de a11y.spec.ts só vê a carga. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function graves(page: Page) {
  // A entrada em cascata do hero (spec 15.3) acaba antes de 1 s: o axe mede a página já no lugar.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animacao) => (animacao as CSSAnimation).animationName === 'wo-entrada')
    .map((animacao) => animacao.finished.catch(() => undefined))));
  const resultado = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return resultado.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'tablet', 'estados cobertos em desktop e celular');
});

test('contato: estados de erro, falha e confirmação sem violação grave', async ({ page }) => {
  await page.clock.install();
  let resposta = 503;
  await page.route('**/__dev/lead*', (rota) =>
    rota.fulfill({ status: resposta, contentType: 'application/json', body: resposta === 200 ? '{"ok":true}' : '{"ok":false}' }),
  );
  await page.goto('/contato/');
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.locator('#contato-resumo')).toBeVisible();
  expect(await graves(page)).toEqual([]);

  await page.getByLabel('Seu nome').fill('Ana Souza');
  await page.locator('#f-tel').fill('34991775784');
  await page.locator('#f-politica').check();
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Enviar pedido' }).click();
  await expect(page.locator('#contato-falha')).toBeVisible();
  expect(await graves(page)).toEqual([]);

  resposta = 200;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.locator('#contato-confirmacao')).toBeVisible();
  expect(await graves(page)).toEqual([]);
});

test('lista de interesse: erro e confirmação sem violação grave', async ({ page }) => {
  await page.clock.install();
  await page.route('**/__dev/interesse*', (rota) => rota.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto('/plataforma/');
  await page.getByRole('button', { name: 'Entrar na lista de interesse' }).click();
  await expect(page.locator('#e-pl-email')).toBeVisible();
  expect(await graves(page)).toEqual([]);

  await page.locator('#pl-email').fill('ana@empresa.com.br');
  await page.locator('#pl-politica').check();
  await page.clock.fastForward(2000);
  await page.getByRole('button', { name: 'Entrar na lista de interesse' }).click();
  await expect(page.locator('#interesse-confirmacao')).toBeVisible();
  expect(await graves(page)).toEqual([]);
});

test('menu aberto no celular sem violação grave', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'o menu só abre até 1180 px');
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.locator('#menu-movel')).toBeVisible();
  expect(await graves(page)).toEqual([]);
});
