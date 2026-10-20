import { test, expect, type Locator, type Page } from '@playwright/test';
import { varrerContraste } from './helpers/contraste';

/* Página Demonstrações técnicas: filtro por frente, aviso de cenário simulado e a versão
   sem JavaScript. Roda nos três projetos (desktop, tablet e celular). */
const ROTA = '/demonstracoes-tecnicas/';

/* As cinco frentes da base WaveOps (decisão de 15/10/2026). A triagem com IA conta em duas frentes. */
const FRENTES = [
  { botao: 'Atendimento', titulos: ['Triagem com IA e revisão humana.'] },
  { botao: 'Agentes de IA', titulos: ['Triagem com IA e revisão humana.'] },
  { botao: 'Dashboards', titulos: ['Da planilha ao painel com acesso por perfil.'] },
  { botao: 'CRMs', titulos: ['Cobrança e relatório recorrentes, sem clique manual.', 'Um cadastro, vários sistemas atualizados.'] },
  { botao: 'SaaS', titulos: ['Pedido, pagamento e estoque no mesmo fluxo.'] },
] as const;
const TOTAL = 5;
const FICHAS = [
  ['CRMs sob medida', 'O pedido entra, a cobrança não sai e o relatório fica para depois.'],
  ['CRMs sob medida', 'Site, CRM, ERP e pagamento trabalham cada um por conta.'],
  ['Dashboards', 'A planilha virou o sistema da empresa e parou de dar conta.'],
  ['Automação de atendimento e Agentes de IA', 'Atender, fazer triagem e ler documento o dia todo trava o time.'],
  ['SaaS', 'A loja vende, mas o financeiro e o estoque só ficam sabendo depois.'],
] as const;

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
    await filtro.getByRole('button', { name: 'CRMs', exact: true }).click();
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

    await filtro.getByRole('button', { name: 'Atendimento', exact: true }).click();
    await expect(regiao).toHaveText('Mostrando 1 de 5 demonstrações. Frente: Atendimento.');

    await filtro.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(regiao).toHaveText('Mostrando 5 de 5 demonstrações.');
  });

  test('deve filtrar pelo teclado quando o botão tem foco', async ({ page }) => {
    const filtro = await abrir(page);
    await filtro.getByRole('button', { name: 'Dashboards', exact: true }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(filtro.getByRole('button', { name: 'Dashboards', exact: true, pressed: true })).toBeFocused();
    await expect(page.locator('[data-filtro-status]')).toContainText('1 de 5');
  });
});

test.describe('Demonstrações técnicas: aviso de cenário simulado', () => {
  test('deve abrir cada demonstração com a ficha de case', async ({ page }) => {
    await page.goto(ROTA);
    const fluxos = page.getByRole('article');
    await expect(fluxos).toHaveCount(TOTAL);
    for (const [indice, fluxo] of (await fluxos.all()).entries()) {
      const ficha = fluxo.locator('dl');
      await expect(ficha).toHaveCount(1);
      await expect(ficha.locator('dt')).toHaveText(['Frente', 'Cenário', 'Situação de partida']);
      await expect(ficha.locator('dd')).toHaveText([FICHAS[indice]![0], 'Simulado, sem dados de clientes', FICHAS[indice]![1]]);
      await expect(fluxo.getByText(FICHAS[indice]![1], { exact: true })).toHaveCount(1);
      const colunas = await ficha.locator('dd').evaluateAll(elementos => elementos.map(el => el.getBoundingClientRect().x));
      expect(new Set(colunas).size).toBe(page.viewportSize()!.width >= 768 ? 3 : 1);
    }
  });

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
    await expect(page.locator('article dl dd')).toHaveCount(TOTAL * 3);
  });
});

test.describe('Demonstrações técnicas: novo visual', () => {
  test.use({ reducedMotion: 'reduce' });

  test('hero transparente e cinco fluxos preservam a cascata e alternam os véus', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('.wo-abertura')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.wo-abertura [data-entrada]')).toHaveCount(7);
    expect(await page.locator('.wo-abertura [data-entrada]').evaluateAll(elementos => elementos.map(el => el.getAttribute('data-entrada')))).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    for (const [indice, fluxo] of (await page.locator('article').all()).entries()) {
      await expect(fluxo).toHaveClass(new RegExp(indice % 2 === 0 ? 'wo-veu(?: |$)' : 'wo-veu-forte'));
    }
  });

  test('hero e cinco fluxos mantêm contraste AA durante a rolagem', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', '1440 × 900 e 390 × 844 cobrem as duas grades');
    test.setTimeout(240_000);
    const trechos = ['.wo-abertura', ...Array.from({ length: TOTAL }, (_, i) => `article:nth-child(${i + 1})`)];
    const medidos = await varrerContraste(page, ROTA, trechos);
    await info.attach('contraste-demonstracoes.json', { body: JSON.stringify(medidos, null, 2), contentType: 'application/json' });
    for (const trecho of trechos) expect(medidos.filter(alvo => alvo.trecho === trecho).length, trecho).toBeGreaterThan(0);
    expect(medidos.filter(alvo => alvo.passos < 3).map(alvo => `${alvo.texto}: ${alvo.passos} passos`)).toEqual([]);
    expect(medidos.filter(alvo => alvo.pior && alvo.pior.razao < alvo.minimo).map(alvo => ({
      texto: alvo.texto, trecho: alvo.trecho, cor: alvo.cor, tamanho: alvo.tamanho, peso: alvo.peso,
      minimo: alvo.minimo, ...alvo.pior,
    }))).toEqual([]);
  });
});
