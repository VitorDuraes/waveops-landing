import { test, expect } from '@playwright/test';

test.describe('vídeo do hero', () => {
  test.use({ reducedMotion: 'no-preference' });
  const erros = new WeakMap<object, string[]>();
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
    const lista: string[] = [];
    erros.set(page, lista);
    page.on('console', (msg) => { if (msg.type() === 'error') lista.push(msg.text()); });
    page.on('pageerror', (erro) => lista.push(erro.message));
  });
  test.afterEach(async ({ page }) => { expect(erros.get(page) ?? []).toEqual([]); });

  test('toca depois do load com movimento liberado', async ({ page }, info) => {
    await page.goto('/');
    const video = page.locator('video');
    await expect(video).toHaveJSProperty('paused', false);
    await expect(video).toHaveJSProperty('currentSrc', `http://127.0.0.1:${process.env.SITE_PORTA ?? 4321}/assets/site/video/onda-${info.project.name === 'desktop' ? 1920 : 1280}.webm`);
    await expect(video).toHaveAttribute('data-tocando');
  });

  test('com menos movimento, não toca e o pôster fica', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('video')).toHaveJSProperty('currentSrc', '');
    await expect(page.locator('.wo-home-fundo__poster')).toBeVisible();
    await expect(page.locator('[data-video-pausa]')).toBeHidden();
  });

  test('o botão pausa e retoma com nome fixo', async ({ page }) => {
    await page.goto('/');
    const botao = page.getByRole('button', { name: 'Pausar vídeo', exact: true });
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
    await botao.click();
    await expect(botao).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('video')).toHaveJSProperty('paused', true);
    await botao.click();
    await expect(botao).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
  });

  test('a pausa fica no primeiro viewport com vídeo tocando', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('video')).toHaveAttribute('data-tocando');
    const botao = page.getByRole('button', { name: 'Pausar vídeo' });
    const caixa = (await botao.boundingBox())!;
    const topo = (await page.locator('.wo-topo').boundingBox())!;
    expect(caixa.y).toBeGreaterThanOrEqual(topo.y + topo.height);
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeGreaterThanOrEqual(44);
    expect(await botao.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
  });

  test('pausa fora da tela e retoma na volta', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await expect(page.locator('video')).toHaveJSProperty('paused', true);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
  });

  test('pausa quando a preferência muda e retoma quando desliga', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('video')).toHaveJSProperty('paused', true);
    await expect(page.locator('[data-video-pausa]')).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('[data-video-pausa]')).toBeVisible();
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
  });

  test('pausa com a aba oculta e respeita a pausa manual na volta', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
    const visibilidade = (valor: string) => page.evaluate((estado) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: estado });
      document.dispatchEvent(new Event('visibilitychange'));
    }, valor);
    await visibilidade('hidden');
    await expect(page.locator('video')).toHaveJSProperty('paused', true);
    await visibilidade('visible');
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
    await page.getByRole('button', { name: 'Pausar vídeo' }).click();
    await visibilidade('hidden');
    await visibilidade('visible');
    await expect(page.locator('video')).toHaveJSProperty('paused', true);
    await expect(page.locator('[data-video-pausa]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('se play falhar, fica o pôster e a pausa coerente', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Reprodução bloqueada', 'NotAllowedError'));
    });
    await page.goto('/');
    await expect(page.locator('video')).toHaveAttribute('data-video-erro', 'NotAllowedError');
    await expect(page.locator('video')).not.toHaveAttribute('data-tocando');
    await expect(page.locator('.wo-home-fundo__poster')).toBeVisible();
    await expect(page.locator('[data-video-pausa]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('com economia de dados, não toca', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
    await page.goto('/');
    await expect(page.locator('video')).toHaveJSProperty('currentSrc', '');
    await expect(page.locator('[data-video-pausa]')).toBeHidden();
  });

  test('sem codec compatível mantém o pôster e o botão oculto', async ({ page }) => {
    await page.addInitScript(() => { HTMLMediaElement.prototype.canPlayType = () => ''; });
    await page.goto('/');
    await expect(page.locator('video')).toHaveJSProperty('currentSrc', '');
    await expect(page.locator('[data-video-pausa]')).toBeHidden();
  });

  test('nada de vídeo antes do load', async ({ page }) => {
    await page.addInitScript(() => {
      let carregada = false;
      addEventListener('load', () => { carregada = true; });
      const descritor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        ...descritor,
        set(valor) {
          document.documentElement.dataset.videoAntesLoad = String(!carregada);
          descritor.set!.call(this, valor);
        },
      });
    });
    await page.goto('/');
    await expect(page.locator('video')).toHaveJSProperty('paused', false);
    await expect(page.locator('html')).toHaveAttribute('data-video-antes-load', 'false');
  });

  test('o fundo do hero aparece atrás do texto', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'amostragem de pixels no desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    for (const seletor of ['html', '.wo-home-escuro', '.wo-home-hero']) {
      await expect(page.locator(seletor)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
    const caixa = (await page.locator('[data-hero]').boundingBox())!;
    const png = await page.screenshot({ clip: { x: 0, y: caixa.y + caixa.height * 0.4, width: 40, height: 40 } });
    const aba = await context.newPage();
    const luminancia = await aba.evaluate(async (base64) => {
      const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 40;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, 40, 40).data;
      let soma = 0;
      for (let i = 0; i < pixels.length; i += 4) soma += (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
      return soma / 1600;
    }, png.toString('base64'));
    expect(luminancia).toBeLessThan(0.3);
    await aba.close();
  });
});
