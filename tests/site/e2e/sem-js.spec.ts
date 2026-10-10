import { test, expect } from '@playwright/test';

/* Sem JavaScript o conteúdo tem de estar inteiro: o <noscript> do head mostra o menu
   e todos os painéis, e os formulários dão lugar a um aviso com saída por WhatsApp. */
test.use({ javaScriptEnabled: false });

test('Home sem JavaScript mostra os cinco resultados e esconde os botões do seletor', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'mesma regra nas outras larguras');
  await page.goto('/');
  for (const id of ['vender', 'atender', 'operar', 'decidir', 'crescer']) {
    await expect(page.locator(`#resultado-${id}`)).toBeVisible();
  }
  await expect(page.locator('[data-opcoes]')).toBeHidden();
});

test('no celular sem JavaScript os links do menu ficam visíveis', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'só o celular usa o painel');
  await page.goto('/');
  await expect(page.locator('#menu-movel')).toBeVisible();
  await expect(page.locator('#menu-movel').getByRole('link', { name: 'Contato' })).toBeVisible();
});

test('Contato sem JavaScript troca o formulário pelo aviso com WhatsApp', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'mesma regra nas outras larguras');
  const resposta = await page.goto('/contato/');
  test.skip(resposta?.status() === 404, 'contato/index.html ainda não existe');
  await expect(page.locator('#form-contato')).toBeHidden();
  await expect(page.locator('.wo-form__semjs')).toBeVisible();
  await expect(page.locator('.wo-form__semjs').getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/5534991775784/);
});
