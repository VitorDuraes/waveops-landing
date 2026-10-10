import { test, expect, type Locator, type Page } from '@playwright/test';

/* Página Demonstrações técnicas: filtro por frente, aviso de cenário simulado e a versão
   sem JavaScript. Roda nos três projetos (desktop, tablet e celular). */
const ROTA = '/demonstracoes-tecnicas/';

const FRENTES = [
  { botao: 'Automação', titulo: 'Cobrança e relatório recorrentes, sem clique manual.' },
  { botao: 'Integração', titulo: 'Um cadastro, vários sistemas atualizados.' },
  { botao: 'Sistemas e painéis', titulo: 'Da planilha ao painel com acesso por perfil.' },
  { botao: 'Agentes de IA', titulo: 'Triagem com IA e revisão humana.' },
  { botao: 'E-commerce', titulo: 'Pedido, pagamento e estoque no mesmo fluxo.' },
  { botao: 'Consultoria', titulo: 'Mapa de processos com ordem de prioridade.' },
] as const;

/** Abre a página e espera o filtro ligar: o script marca data-pronto no grupo de botões. */
async function abrir(page: Page): Promise<Locator> {
  await page.goto(ROTA);
  const filtro = page.getByRole('group', { name: 'Filtrar por frente' });
  await expect(filtro).toHaveAttribute('data-pronto', '');
  return filtro;
}

test.describe('Demonstrações técnicas: filtro por frente', () => {
  test('deve abrir com Todas ativa e os 6 fluxos visíveis quando a página carrega', async ({ page }) => {
    const filtro = await abrir(page);
    await expect(filtro.getByRole('button')).toHaveCount(7);
    await expect(filtro.getByRole('button', { name: 'Todas', pressed: true })).toBeVisible();
    await expect(filtro.getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(page.getByRole('article')).toHaveCount(6);
  });

  for (const frente of FRENTES) {
    test(`deve mostrar só o fluxo de ${frente.botao} e marcar o botão quando a frente é escolhida`, async ({ page }) => {
      const filtro = await abrir(page);
      await filtro.getByRole('button', { name: frente.botao, exact: true }).click();

      const fluxos = page.getByRole('article');
      await expect(fluxos).toHaveCount(1);
      await expect(fluxos.getByRole('heading', { level: 2 })).toHaveText(frente.titulo);

      await expect(filtro.getByRole('button', { name: frente.botao, exact: true, pressed: true })).toBeVisible();
      await expect(filtro.getByRole('button', { pressed: true })).toHaveCount(1);
      await expect(filtro.getByRole('button', { name: 'Todas', pressed: false })).toBeVisible();
    });
  }

  test('deve voltar a mostrar os 6 fluxos quando Todas é escolhida depois de uma frente', async ({ page }) => {
    const filtro = await abrir(page);
    await filtro.getByRole('button', { name: 'Consultoria', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(1);

    await filtro.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(6);
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
    await expect(regiao).toHaveText('Mostrando 1 de 6 demonstrações. Frente: Automação.');

    await filtro.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(regiao).toHaveText('Mostrando 6 de 6 demonstrações.');
  });

  test('deve filtrar pelo teclado quando o botão tem foco', async ({ page }) => {
    const filtro = await abrir(page);
    await filtro.getByRole('button', { name: 'E-commerce', exact: true }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(filtro.getByRole('button', { name: 'E-commerce', exact: true, pressed: true })).toBeFocused();
    await expect(page.locator('[data-filtro-status]')).toContainText('1 de 6');
  });
});

test.describe('Demonstrações técnicas: aviso de cenário simulado', () => {
  test('deve manter o aviso e a pílula de cenário simulado nos 6 fluxos quando a página abre', async ({ page }) => {
    await page.goto(ROTA);
    const aviso = page.getByRole('note');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Cenários simulados.');
    await expect(aviso).toContainText('Não são casos de clientes.');
    await expect(page.getByText('Demonstração · cenário simulado', { exact: true })).toHaveCount(6);
  });

  test('deve mostrar entrada, regra e saída em cada um dos 6 fluxos quando a página abre', async ({ page }) => {
    await page.goto(ROTA);
    await expect(page.locator('article')).toHaveCount(6);
    await expect(page.locator('article li')).toHaveCount(18);
    for (const etapa of ['1 · Entrada', '2 · Regra', '3 · Saída']) {
      await expect(page.locator('article li').filter({ hasText: etapa })).toHaveCount(6);
    }
  });

  test('deve levar o fecho da lista ao contato quando o link é lido', async ({ page }) => {
    await page.goto(ROTA);
    await expect(page.getByRole('link', { name: 'Peça uma demonstração guiada.' })).toHaveAttribute('href', '/contato/');
  });
});

test.describe('Demonstrações técnicas sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('deve mostrar os 6 fluxos e esconder o filtro quando o JavaScript está desligado', async ({ page }) => {
    await page.goto(ROTA);
    await expect(page.getByRole('article')).toHaveCount(6);
    await expect(page.getByRole('group', { name: 'Filtrar por frente' })).toBeHidden();
    await expect(page.getByRole('note')).toContainText('Cenários simulados.');
    await expect(page.getByText('Demonstração · cenário simulado', { exact: true })).toHaveCount(6);
  });
});
