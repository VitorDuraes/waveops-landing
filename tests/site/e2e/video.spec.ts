import { test, expect } from '@playwright/test';

/* Controle do vídeo do fundo vivo (assets/site/fundo.js, spec 6.3 e 15.3), conferido na Home e numa
   página interna. O vídeo toca em qualquer ponto da página enquanto a aba está visível: sair do hero
   não pausa mais (15.6). As regras de toda página (o bloco do fundo, a pausa que vale para a visita,
   menos movimento, economia de dados e sem JavaScript) estão em fundo.spec.ts, e a varredura de
   contraste do hero também. */
const PAUSA = 'Pausar animação';

test.describe('vídeo do fundo', () => {
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
    const video = page.locator('[data-fundo-video]');
    await expect(video).toHaveJSProperty('paused', false);
    expect(await video.evaluate((elemento: HTMLVideoElement) => new URL(elemento.currentSrc).pathname)).toBe(`/assets/site/video/onda-${info.project.name === 'desktop' ? 1920 : 1280}.webm`);
    await expect(video).toHaveAttribute('data-tocando');
  });

  test('o botão do rodapé pausa e retoma com nome fixo', async ({ page }) => {
    await page.goto('/');
    const botao = page.getByRole('button', { name: PAUSA, exact: true });
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', false);
    await botao.click();
    await expect(botao).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', true);
    await expect(botao).toHaveAccessibleName(PAUSA);
    await botao.click();
    await expect(botao).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', false);
  });

  /* WCAG 2.2.2: o controle de pausa fica ao alcance. Desde o adendo 2 da 13A ele mora no rodapé de
     toda página, como texto, com alvo de 44 px abaixo de 768 px; no fim da página nada o cobre, nem o
     botão flutuante de WhatsApp, e o teclado chega nele logo depois do último link do rodapé. */
  test('a pausa fica no rodapé, visível, clicável e alcançável pelo teclado', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.locator('[data-fundo-video]')).toHaveAttribute('data-tocando');
    const botao = page.getByRole('button', { name: PAUSA, exact: true });
    await expect(page.locator('.wo-rodape [data-fundo-pausa]')).toHaveCount(1);
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await expect(botao).toBeInViewport();
    const caixa = (await botao.boundingBox())!;
    expect(caixa.height, info.project.name).toBeGreaterThanOrEqual(info.project.name === 'desktop' ? 36 : 44);
    expect(await botao.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'nada cobre o centro do botão no fim da página').toBe(true);
    await page.locator('.wo-rodape__coluna--empresa a').last().focus();
    await page.keyboard.press('Tab');
    await expect(botao).toBeFocused();
    await expect(botao).toHaveCSS('outline-style', 'solid');
  });

  test('continua tocando fora do hero, até o fim da página', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('[data-fundo-video]');
    await expect(video).toHaveJSProperty('paused', false);
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    const antes = await video.evaluate((elemento: HTMLVideoElement) => elemento.currentTime);
    await expect.poll(() => video.evaluate((elemento: HTMLVideoElement) => elemento.currentTime)).not.toBe(antes);
    await expect(video).toHaveJSProperty('paused', false);
    await expect(video).toHaveAttribute('data-tocando');
  });

  test('pausa quando a preferência muda e retoma quando desliga', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', true);
    await expect(page.locator('[data-fundo-pausa]')).toBeHidden();
    await expect(page.locator('.wo-fundo__poster')).toHaveCSS('opacity', '1');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('[data-fundo-pausa]')).toBeVisible();
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', false);
  });

  test('pausa com a aba oculta e respeita a pausa manual na volta', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', false);
    const visibilidade = (valor: string) => page.evaluate((estado) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: estado });
      document.dispatchEvent(new Event('visibilitychange'));
    }, valor);
    await visibilidade('hidden');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', true);
    await visibilidade('visible');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', false);
    await page.getByRole('button', { name: PAUSA }).click();
    await visibilidade('hidden');
    await visibilidade('visible');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', true);
    await expect(page.locator('[data-fundo-pausa]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('se play falhar, fica o pôster e a pausa coerente', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Reprodução bloqueada', 'NotAllowedError'));
    });
    await page.goto('/');
    await expect(page.locator('[data-fundo-video]')).toHaveAttribute('data-video-erro', 'NotAllowedError');
    await expect(page.locator('[data-fundo-video]')).not.toHaveAttribute('data-tocando');
    await expect(page.locator('[data-fundo-video]')).toHaveCSS('opacity', '0');
    await expect(page.locator('.wo-fundo__poster')).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-fundo-pausa]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('sem codec compatível mantém o pôster e o botão oculto', async ({ page }) => {
    await page.addInitScript(() => { HTMLMediaElement.prototype.canPlayType = () => ''; });
    await page.goto('/');
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('currentSrc', '');
    await expect(page.locator('[data-fundo-pausa]')).toBeHidden();
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
    await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('paused', false);
    await expect(page.locator('html')).toHaveAttribute('data-video-antes-load', 'false');
  });

  test('numa página interna o controle é o mesmo', async ({ page }) => {
    await page.goto('/projetos-sob-medida/');
    const video = page.locator('[data-fundo-video]');
    await expect(video).toHaveJSProperty('paused', false);
    await expect(video).toHaveAttribute('data-tocando');
    await page.getByRole('button', { name: PAUSA, exact: true }).click();
    await expect(video).toHaveJSProperty('paused', true);
    await expect(page.locator('.wo-fundo__poster')).toHaveCSS('opacity', '1');
  });

  test('o fundo do hero aparece atrás do texto', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'amostragem de pixels no desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    for (const seletor of ['html', '.wo-home-hero']) {
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
