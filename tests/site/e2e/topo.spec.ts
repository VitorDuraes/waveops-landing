import { test, expect } from '@playwright/test';

/* Menu do topo e seletores, só com teclado. */

test('menu do celular abre, fecha com Esc e devolve o foco ao botão', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'o menu só existe até 1180 px');
  await page.goto('/');
  const botao = page.getByRole('button', { name: 'Abrir menu' });
  const painel = page.locator('#menu-movel');
  await expect(painel).toBeHidden();
  await botao.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(painel).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(painel.getByRole('link', { name: 'Soluções' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();
});

test('no desktop o menu fica inteiro na barra e o item da página atual é marcado', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'barra completa só acima de 1180 px');
  const resposta = await page.goto('/solucoes/');
  test.skip(resposta?.status() === 404, 'solucoes/index.html ainda não existe');
  const principal = page.getByRole('navigation', { name: 'Principal' });
  await expect(principal).toBeVisible();
  await expect(principal.getByRole('link', { name: 'Soluções' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeHidden();
});

test('pular para o conteúdo é o primeiro foco e leva ao main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const pular = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(pular).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#conteudo')).toBeFocused();
});

test('seletor da Home troca o painel por teclado e marca aria-pressed', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'mesmo comportamento das outras larguras');
  await page.goto('/');
  const operar = page.getByRole('button', { name: 'Operar com menos retrabalho' });
  await expect(page.locator('#resultado-vender')).toBeVisible();
  await expect(page.locator('#resultado-operar')).toBeHidden();
  await operar.focus();
  await page.keyboard.press('Enter');
  await expect(operar).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Vender mais' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#resultado-operar')).toBeVisible();
  await expect(page.locator('#resultado-vender')).toBeHidden();
});
