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

test('Home sem JavaScript mostra as cenas montadas', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'mesma regra nas outras larguras');
  await page.goto('/');
  await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
  const opacidades = await page
    .locator('[data-cena="atendimento"] [data-passo]')
    .evaluateAll((pecas) => pecas.map((peca) => getComputedStyle(peca).opacity));
  expect(opacidades.length).toBeGreaterThanOrEqual(6);
  expect(opacidades.filter((opacidade) => opacidade !== '1')).toEqual([]);
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

/* Sem JavaScript o topo não é fixo: entra no fluxo com fundo escuro (regra do <noscript> do head),
   e o menu aberto do celular empurra o título em vez de cobri-lo. */
for (const url of ['/', '/solucoes/', '/404.html']) {
  test(`${url} sem JavaScript, o topo não fica fixo`, async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'mesma regra nas outras larguras');
    await page.goto(url);
    await expect(page.locator('html')).not.toHaveAttribute('data-topo');
    const topo = page.locator('.wo-topo');
    await expect(topo).toHaveAttribute('data-estado', 'escuro');
    expect(await topo.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
    if (info.project.name !== 'celular') return;
    const menu = await page.locator('#menu-movel').boundingBox();
    const titulo = await page.locator('h1').boundingBox();
    expect(menu, '#menu-movel visível sem JavaScript').not.toBeNull();
    expect(titulo, 'h1 visível').not.toBeNull();
    expect(titulo!.y, 'o h1 começa depois do fim do menu').toBeGreaterThanOrEqual(menu!.y + menu!.height);
  });
}
