import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* Entrada do site (Tarefa 13B). Na primeira página da visita, com movimento liberado, a camada
   da entrada cobre a tela, desenha a marca, explode em fios e abre o anel como portal. Clique,
   toque ou tecla pulam. Menos movimento, economia de dados e falta de JavaScript não veem nada.
   O estado fica em <html data-chegada>: ligada (antes da pintura), desenhando, abrindo (o portal
   cresce e a cascata do hero recomeça), saindo (pulada) e feita. */
test.use({ reducedMotion: 'no-preference' });

const CAMADA = '.wo-chegada';

/** Anota no navegador cada troca de data-chegada, com o instante, desde antes do primeiro script. */
async function gravarLinha(page: Page) {
  await page.addInitScript(() => {
    const linha: [string | null, number][] = [];
    Object.defineProperty(window, '__chegada', { value: linha });
    new MutationObserver(() => {
      const valor = document.documentElement.getAttribute('data-chegada');
      if (linha.at(-1)?.[0] !== valor) linha.push([valor, performance.now()]);
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-chegada'] });
  });
}

const linha = (page: Page) =>
  page.evaluate(() => (window as unknown as { __chegada: [string | null, number][] }).__chegada);

const estado = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-chegada'));

/** A camada cobre a tela: renderizada, visível e no topo do ponto central. */
const cobre = (page: Page) =>
  page.evaluate((seletor) => {
    const camada = document.querySelector(seletor);
    if (!camada) return false;
    const estilo = getComputedStyle(camada);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
    const topo = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return Boolean(topo && camada.contains(topo));
  }, CAMADA);

/** O botão principal do hero da Home, "Falar com especialista", que leva a /contato/. */
const CTA = 'main a.wo-btn--primario >> nth=0';

async function centro(page: Page, seletor: string): Promise<[number, number]> {
  const caixa = (await page.locator(seletor).first().boundingBox())!;
  return [caixa.x + caixa.width / 2, caixa.y + caixa.height / 2];
}

async function esperarEstado(page: Page, valor: string, tempo = 3000) {
  await page.waitForFunction((v) => document.documentElement.getAttribute('data-chegada') === v, valor, { timeout: tempo, polling: 'raf' });
}

test.describe('com movimento liberado', () => {
  test('roda na primeira página da visita, em 1,2 a 1,6 s, e não roda na página seguinte', async ({ page }) => {
    const pedidos: string[] = [];
    page.on('request', (pedido) => pedidos.push(new URL(pedido.url()).pathname));
    await gravarLinha(page);
    await page.goto('/');
    await esperarEstado(page, 'abrindo');
    // A camada aparece na primeira pintura, quando o CSS chega: a duração na tela conta dali, pelo
    // início da trava. A sequência dura 1,45 s; a margem de cima cobre o quadro do fim.
    const pintura = await page.evaluate(() => Number(document.querySelector('.wo-chegada')!.getAnimations()[0].startTime));
    await esperarEstado(page, 'feita');
    const etapas = await linha(page);
    expect(etapas.map(([valor]) => valor)).toEqual(['ligada', 'desenhando', 'abrindo', 'feita']);
    const fim = etapas.at(-1)![1];
    expect(fim - pintura, 'duração da entrada na tela em ms').toBeGreaterThanOrEqual(1200);
    expect(fim - pintura, 'duração da entrada na tela em ms').toBeLessThanOrEqual(1600);
    expect(pedidos).toContain('/assets/site/chegada-cena.js');
    await expect(page.locator(CAMADA)).toBeHidden();
    expect(await page.evaluate(() => sessionStorage.getItem('waveops:chegada'))).toBe('1');

    pedidos.length = 0;
    await page.goto('/solucoes/');
    expect(await estado(page)).toBeNull();
    await expect(page.locator(CAMADA)).toBeHidden();
    expect(await cobre(page)).toBe(false);
    expect(pedidos).not.toContain('/assets/site/chegada-cena.js');
  });

  test('roda em qualquer página que abra a visita', async ({ page }) => {
    await gravarLinha(page);
    await page.goto('/contato/');
    await esperarEstado(page, 'feita');
    expect((await linha(page)).map(([valor]) => valor)).toEqual(['ligada', 'desenhando', 'abrindo', 'feita']);
  });

  test('cobre a página enquanto desenha e deixa a página inteira no DOM e acessível', async ({ page }) => {
    await page.goto('/');
    await esperarEstado(page, 'desenhando');
    expect(await cobre(page)).toBe(true);
    await expect(page.locator(CAMADA)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveCount(1);
  });

  test('a cascata do hero recomeça quando o portal abre', async ({ page }) => {
    await page.goto('/');
    await esperarEstado(page, 'abrindo');
    const intervalo = await page.evaluate(async () => {
      const camada = document.querySelector('.wo-chegada')!;
      const trava = camada.getAnimations().find((a) => (a as CSSAnimation).animationName === 'wo-chegada-trava');
      const titulo = document.querySelector('h1')!.getAnimations().find((a) => (a as CSSAnimation).animationName === 'wo-entrada');
      // Recomeçada, a animação fica pendente até o quadro seguinte, sem startTime.
      await titulo?.ready;
      return Number(titulo?.startTime) - Number(trava?.startTime);
    });
    expect(intervalo, 'a cascata do título começa depois do desenho da marca').toBeGreaterThanOrEqual(500);
  });

  test('um clique sobre o botão do hero pula a entrada na hora e não chega ao botão', async ({ page }) => {
    await page.goto('/');
    await esperarEstado(page, 'desenhando');
    const [x, y] = await centro(page, CTA);
    const antes = await page.evaluate(() => performance.now());
    await page.mouse.click(x, y);
    await esperarEstado(page, 'feita', 600);
    expect(await page.evaluate((t) => performance.now() - t, antes)).toBeLessThan(500);
    await expect(page.locator(CAMADA)).toBeHidden();
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('h1')).toHaveCSS('opacity', '1', { timeout: 1500 });
  });

  /* O toque que pula não pode chegar ao que está embaixo da camada: quem toca a tela escura não viu o
     botão. O clique sintetizado do toque sai depois que o dedo solta, então a camada só sai depois. */
  test.describe('toque', () => {
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== 'celular', 'toque só no celular');
    });

    test('um toque sobre o botão do hero pula a entrada e fica na página', async ({ page }) => {
      await page.goto('/');
      await esperarEstado(page, 'desenhando');
      const [x, y] = await centro(page, CTA);
      await page.touchscreen.tap(x, y);
      await esperarEstado(page, 'feita', 1000);
      await expect(page.locator(CAMADA)).toBeHidden();
      await page.waitForTimeout(300);
      expect(new URL(page.url()).pathname).toBe('/');
    });

    test('um toque sobre o WhatsApp flutuante pula a entrada sem abrir a conversa nem contar no funil', async ({ page, context }) => {
      const conversas: string[] = [];
      await context.route('https://wa.me/**', (rota) => {
        conversas.push(rota.request().url());
        return rota.fulfill({ body: '' });
      });
      await page.goto('/');
      const eventos: string[] = await page.evaluate(() => {
        const lista: string[] = [];
        Object.defineProperty(window, '__eventos', { value: lista });
        window.WaveFunil = { enviar: (nome) => void lista.push(nome) };
        return lista;
      });
      expect(eventos).toEqual([]);
      await esperarEstado(page, 'desenhando');
      const [x, y] = await centro(page, '.wo-whatsapp-flutuante');
      await page.touchscreen.tap(x, y);
      await esperarEstado(page, 'feita', 1000);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => (window as unknown as { __eventos: string[] }).__eventos)).toEqual([]);
      expect(conversas).toEqual([]);
      expect(context.pages()).toHaveLength(1);
      expect(new URL(page.url()).pathname).toBe('/');
    });
  });

  test('um link do site aberto em aba nova não repete a entrada', async ({ page, context }, info) => {
    test.skip(info.project.name === 'celular', 'abrir em aba nova com Ctrl é gesto de mouse e teclado');
    await page.goto('/');
    await esperarEstado(page, 'feita');
    const [aba] = await Promise.all([
      context.waitForEvent('page'),
      page.locator(CTA).click({ modifiers: ['ControlOrMeta'] }),
    ]);
    await aba.waitForLoadState('load');
    expect(new URL(aba.url()).pathname).toBe('/contato/');
    expect(await estado(aba)).toBeNull();
    await expect(aba.locator(CAMADA)).toBeHidden();
  });

  test('uma tecla pula a entrada e o Tab chega ao "Pular para o conteúdo"', async ({ page }) => {
    await page.goto('/');
    await esperarEstado(page, 'desenhando');
    await page.keyboard.press('Tab');
    await esperarEstado(page, 'feita', 600);
    await expect(page.locator(CAMADA)).toBeHidden();
    await expect(page.locator('.wo-pular')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#conteudo')).toBeFocused();
  });

  test('nada dentro da camada recebe foco', async ({ page }) => {
    await page.goto('/');
    await esperarEstado(page, 'desenhando');
    const focaveis = await page.locator(`${CAMADA} :is(a, button, input, select, textarea, [tabindex], [contenteditable])`).count();
    expect(focaveis).toBe(0);
    expect(await page.evaluate((s) => document.querySelector(s)?.contains(document.activeElement) ?? false, CAMADA)).toBe(false);
  });

  test('sem violação séria de acessibilidade durante e depois da entrada', async ({ page }) => {
    const analisar = async (durante: boolean) => {
      let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
      // Durante a entrada os blocos da cascata do hero estão no meio do esmaecimento, e o axe mede
      // contraste com a opacidade do quadro (a11y.spec.ts espera a cascata acabar pelo mesmo motivo).
      // A camada e o resto da página entram na medida; depois da entrada, a página inteira.
      if (durante) axe = axe.exclude('[data-entrada]');
      const resultado = await axe.analyze();
      return resultado.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    };
    await page.goto('/');
    await esperarEstado(page, 'desenhando');
    expect(await analisar(true)).toEqual([]);
    await esperarEstado(page, 'feita');
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((a) => (a as CSSAnimation).animationName === 'wo-entrada')
      .map((a) => a.finished.catch(() => undefined))));
    expect(await analisar(false)).toEqual([]);
  });

  test('sem desenho, a camada some sozinha em até 2 s', async ({ page }) => {
    // O módulo do desenho chega vazio: ninguém encerra a entrada, só a trava do CSS.
    await page.route('**/assets/site/chegada-cena.js', (rota) => rota.fulfill({ contentType: 'text/javascript', body: '' }));
    await gravarLinha(page);
    await page.goto('/');
    expect(await cobre(page)).toBe(true);
    // A camada aparece na primeira pintura, quando o CSS chega; a trava conta dali.
    const apareceu = await page.evaluate(() => Number(document.querySelector('.wo-chegada')!.getAnimations()[0].startTime));
    await page.waitForFunction(() => {
      const camada = document.querySelector('.wo-chegada');
      return camada && getComputedStyle(camada).visibility === 'hidden';
    }, undefined, { timeout: 3000, polling: 'raf' });
    const sumiu = await page.evaluate(() => performance.now());
    expect((await linha(page)).map(([valor]) => valor)).toEqual(['ligada']);
    expect(sumiu - apareceu, 'a trava do CSS tira a camada em até 2 s').toBeLessThanOrEqual(2050);
    expect(await cobre(page)).toBe(false);
    await expect(page.locator('h1')).toHaveCSS('opacity', '1');
  });

  test('se o desenho falhar ao carregar, a camada sai na hora', async ({ page }) => {
    await page.route('**/assets/site/chegada-cena.js', (rota) => rota.abort());
    await page.goto('/');
    await esperarEstado(page, 'feita', 1000);
    expect(await cobre(page)).toBe(false);
  });

  test('sem canvas, a camada sai na hora', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await page.goto('/');
    await esperarEstado(page, 'feita', 1000);
    expect(await cobre(page)).toBe(false);
  });
});

test.describe('com menos movimento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('não roda e não pede o desenho', async ({ page }) => {
    const pedidos: string[] = [];
    page.on('request', (pedido) => pedidos.push(new URL(pedido.url()).pathname));
    await page.goto('/');
    expect(await estado(page)).toBeNull();
    await expect(page.locator(CAMADA)).toBeHidden();
    expect(await cobre(page)).toBe(false);
    expect(pedidos).not.toContain('/assets/site/chegada-cena.js');
    expect(await page.evaluate(() => sessionStorage.getItem('waveops:chegada'))).toBeNull();
  });
});

test.describe('com economia de dados', () => {
  test('não roda e não pede o desenho', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => ({ saveData: true }) });
    });
    const pedidos: string[] = [];
    page.on('request', (pedido) => pedidos.push(new URL(pedido.url()).pathname));
    await page.goto('/');
    expect(await estado(page)).toBeNull();
    await expect(page.locator(CAMADA)).toBeHidden();
    expect(pedidos).not.toContain('/assets/site/chegada-cena.js');
  });
});

test.describe('sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('a camada nunca aparece', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(CAMADA)).toHaveCount(1);
    await expect(page.locator(CAMADA)).toBeHidden();
    expect(await page.locator(CAMADA).evaluate((el) => getComputedStyle(el).display)).toBe('none');
    await expect(page.locator('h1')).toBeVisible();
  });
});
