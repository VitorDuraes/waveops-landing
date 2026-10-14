import { test, expect, type Locator, type Page } from '@playwright/test';

/* Página Demonstrações técnicas: filtro por frente, aviso de cenário simulado e a versão
   sem JavaScript. Roda nos três projetos (desktop, tablet e celular). */
const ROTA = '/demonstracoes-tecnicas/';

/* As quatro frentes da base WaveOps (decisão de 14/10/2026). Integração tem dois fluxos. */
const FRENTES = [
  { botao: 'Automação', titulos: ['Cobrança e relatório recorrentes, sem clique manual.'] },
  { botao: 'Integração', titulos: ['Um cadastro, vários sistemas atualizados.', 'Pedido, pagamento e estoque no mesmo fluxo.'] },
  { botao: 'Sistemas e painéis', titulos: ['Da planilha ao painel com acesso por perfil.'] },
  { botao: 'Agentes de IA', titulos: ['Triagem com IA e revisão humana.'] },
] as const;
const TOTAL = 5;

/** Abre a página e espera o filtro ligar: o script marca data-pronto no grupo de botões. */
async function abrir(page: Page): Promise<Locator> {
  await page.goto(ROTA);
  const filtro = page.getByRole('group', { name: 'Filtrar por frente' });
  await expect(filtro).toHaveAttribute('data-pronto', '');
  return filtro;
}

test.describe('Demonstrações técnicas: filtro por frente', () => {
  test('deve abrir com Todas ativa e os 5 fluxos visíveis quando a página carrega', async ({ page }) => {
    const filtro = await abrir(page);
    await expect(filtro.getByRole('button')).toHaveCount(FRENTES.length + 1);
    await expect(filtro.getByRole('button', { name: 'Todas', pressed: true })).toBeVisible();
    await expect(filtro.getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(page.getByRole('article')).toHaveCount(TOTAL);
  });

  for (const frente of FRENTES) {
    test(`deve mostrar só os fluxos de ${frente.botao} e marcar o botão quando a frente é escolhida`, async ({ page }) => {
      const filtro = await abrir(page);
      await filtro.getByRole('button', { name: frente.botao, exact: true }).click();

      const fluxos = page.getByRole('article');
      await expect(fluxos).toHaveCount(frente.titulos.length);
      await expect(fluxos.getByRole('heading', { level: 2 })).toHaveText([...frente.titulos]);

      await expect(filtro.getByRole('button', { name: frente.botao, exact: true, pressed: true })).toBeVisible();
      await expect(filtro.getByRole('button', { pressed: true })).toHaveCount(1);
      await expect(filtro.getByRole('button', { name: 'Todas', pressed: false })).toBeVisible();
    });
  }

  test('deve voltar a mostrar os 5 fluxos quando Todas é escolhida depois de uma frente', async ({ page }) => {
    const filtro = await abrir(page);
    await filtro.getByRole('button', { name: 'Agentes de IA', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(1);

    await filtro.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(TOTAL);
    await expect(filtro.getByRole('button', { name: 'Todas', pressed: true })).toBeVisible();
    await expect(filtro.getByRole('button', { pressed: true })).toHaveCount(1);
  });

  test('deve trocar de frente sem acumular fluxos quando duas frentes são escolhidas em seguida', async ({ page }) => {
    const filtro = await abrir(page);
    await filtro.getByRole('button', { name: 'Integração', exact: true }).click();
    await filtro.getByRole('button', { name: 'Agentes de IA', exact: true }).click();

    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Triagem com IA e revisão humana.' })).toBeVisible();
    await expect(filtro.getByRole('button', { pressed: true })).toHaveCount(1);
  });

  test('deve anunciar a contagem na região viva quando o filtro muda', async ({ page }) => {
    const filtro = await abrir(page);
    const regiao = page.locator('[data-filtro-status]');
    await expect(regiao).toHaveAttribute('aria-live', 'polite');
    await expect(regiao).toBeEmpty();

    await filtro.getByRole('button', { name: 'Automação', exact: true }).click();
    await expect(regiao).toHaveText('Mostrando 1 de 5 demonstrações. Frente: Automação.');

    await filtro.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(regiao).toHaveText('Mostrando 5 de 5 demonstrações.');
  });

  test('deve filtrar pelo teclado quando o botão tem foco', async ({ page }) => {
    const filtro = await abrir(page);
    await filtro.getByRole('button', { name: 'Sistemas e painéis', exact: true }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(filtro.getByRole('button', { name: 'Sistemas e painéis', exact: true, pressed: true })).toBeFocused();
    await expect(page.locator('[data-filtro-status]')).toContainText('1 de 5');
  });
});

test.describe('Demonstrações técnicas: aviso de cenário simulado', () => {
  test('deve manter o aviso e a pílula de cenário simulado nos 5 fluxos quando a página abre', async ({ page }) => {
    await page.goto(ROTA);
    const aviso = page.getByRole('note');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Cenários simulados.');
    await expect(aviso).toContainText('Não são casos de clientes.');
    await expect(page.getByText('Demonstração · cenário simulado', { exact: true })).toHaveCount(TOTAL);
  });

  test('deve mostrar entrada, regra e saída em cada um dos 5 fluxos quando a página abre', async ({ page }) => {
    await page.goto(ROTA);
    await expect(page.locator('article')).toHaveCount(TOTAL);
    await expect(page.locator('article li')).toHaveCount(TOTAL * 3);
    for (const etapa of ['1 · Entrada', '2 · Regra', '3 · Saída']) {
      await expect(page.locator('article li').filter({ hasText: etapa })).toHaveCount(TOTAL);
    }
  });

  test('deve levar o fecho da lista ao contato quando o link é lido', async ({ page }) => {
    await page.goto(ROTA);
    await expect(page.getByRole('link', { name: 'Peça uma demonstração guiada.' })).toHaveAttribute('href', '/contato/');
  });
});

test.describe('Demonstrações técnicas sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('deve mostrar os 5 fluxos e esconder o filtro quando o JavaScript está desligado', async ({ page }) => {
    await page.goto(ROTA);
    await expect(page.getByRole('article')).toHaveCount(TOTAL);
    await expect(page.getByRole('group', { name: 'Filtrar por frente' })).toBeHidden();
    await expect(page.getByRole('note')).toContainText('Cenários simulados.');
    await expect(page.getByText('Demonstração · cenário simulado', { exact: true })).toHaveCount(TOTAL);
  });
});
