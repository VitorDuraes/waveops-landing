import { test, expect } from '@playwright/test';

const FRENTES = [
  { label: 'Atendimento', id: 'frente-atendimento', cena: 'atendimento' },
  { label: 'Agentes de IA', id: 'frente-ia', cena: 'agentes' },
  { label: 'Painéis de gestão', id: 'frente-paineis', cena: 'dashboards' },
  { label: 'CRM', id: 'frente-crm', cena: 'crms' },
  { label: 'Apps e sistemas', id: 'frente-apps', cena: 'saas' },
];

test('os cinco atalhos por teclado chegam ao capítulo e ativam sua demonstração', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Demonstrações das cinco frentes' });
  await expect(nav.getByRole('link')).toHaveCount(5);
  for (const frente of FRENTES) {
    const link = nav.getByRole('link', { name: frente.label, exact: true });
    await expect(link).toHaveAttribute('href', `#${frente.id}`);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`#${frente.id}$`));
    await expect(page.locator(`[data-cena="${frente.cena}"]`)).toHaveAttribute('data-ativa');
    const top = await page.locator(`#${frente.id}`).evaluate((alvo) => alvo.getBoundingClientRect().top);
    const fimTopo = await page.locator('.wo-topo').evaluate((topo) => topo.getBoundingClientRect().bottom);
    expect(top).toBeGreaterThanOrEqual(fimTopo);
  }
});

test.describe('atalhos nativos sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('os destinos ficam abaixo do topo e mostram o conteúdo completo', async ({ page }) => {
    await page.goto('/');
    for (const frente of FRENTES) {
      const link = page.getByRole('navigation', { name: 'Demonstrações das cinco frentes' }).getByRole('link', { name: frente.label, exact: true });
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`#${frente.id}$`));
      const top = await page.locator(`#${frente.id}`).evaluate((alvo) => alvo.getBoundingClientRect().top);
      const fimTopo = await page.locator('.wo-topo').evaluate((topo) => topo.getBoundingClientRect().bottom);
      expect(top).toBeGreaterThanOrEqual(fimTopo);
    }
    await expect(page.locator('.wo-apps__app .wo-apps__estado :visible')).toHaveText('Em andamento');
    await expect(page.locator('.wo-apps__sistema .wo-apps__estado :visible')).toHaveText('Em andamento');
  });
});
