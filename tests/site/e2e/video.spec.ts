import { test, expect } from '@playwright/test';

/* Contraste WCAG 2.x. O axe não mede texto sobre imagem nem sobre vídeo (marca como incompleto),
   então o teste do pôster mede na mão: pixel mais claro atrás do texto contra a cor computada. */
const linear = (canal: number): number => {
  const s = canal / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancia = (r: number, g: number, b: number): number => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const razaoDeContraste = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

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

  /* O fundo do hero é fixo e o texto sobe por cima dele quando a página rola, então o texto passa
     por todas as alturas do pôster, inclusive pelo brilho da onda. O teste rola de 12 px em 12 px,
     do repouso até o texto chegar embaixo do topo, e em cada passo acha o pixel mais claro dentro
     da caixa do texto, escondido com visibility: hidden (o pior caso: o selo perde a camada preta
     própria). O passo é menor que a linha do selo (14 px), então as caixas de passos vizinhos se
     encostam e nenhuma altura do fundo fica sem medir. Só o pôster: com menos movimento o vídeo
     nem carrega, e o pôster é o quadro de 0 s. A medição dos 24 quadros do laço, uma só vez, está
     no relatório da Tarefa 5. */
  test('o selo e a nota do hero mantêm 4,5:1 sobre o pôster durante toda a rolagem', async ({ page, context }) => {
    test.setTimeout(120_000);
    const PASSO = 12;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.wo-home-fundo__poster')).toHaveJSProperty('complete', true);
    await expect(page.locator('video')).toHaveJSProperty('currentSrc', '');
    // Com menos movimento o CSS põe transition-duration em tudo; sem transição, esconder vale na hora.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    const topo = await page.locator('.wo-topo').evaluate((elemento) => elemento.getBoundingClientRect().bottom);
    const altura = page.viewportSize()!.height;
    const alvos = await page.evaluate(() => [
      { nome: 'selo', seletor: '.wo-home-hero .wo-etiqueta-hero' },
      { nome: 'nota', seletor: '.wo-home-hero__texto .wo-nota-mono' },
    ].map(({ nome, seletor }) => {
      const elemento = document.querySelector<HTMLElement>(seletor)!;
      elemento.setAttribute('data-medir', nome);
      const cor = getComputedStyle(elemento).color;
      elemento.style.setProperty('visibility', 'hidden', 'important');
      return { nome, cor };
    }));
    /** Rola até `y` e devolve as caixas do texto na janela, cortadas entre o fim do topo e o fim da janela. */
    const rolarPara = (y: number) => page.evaluate(async ({ y, topo, altura }) => {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok())));
      return [...document.querySelectorAll<HTMLElement>('[data-medir]')].map((elemento) => {
        const faixa = document.createRange();
        faixa.selectNodeContents(elemento);
        const retangulos = [...faixa.getClientRects()]
          .map((r) => ({ x: r.x, y: Math.max(r.y, topo), w: r.width, h: Math.min(r.y + r.height, altura) - Math.max(r.y, topo) }))
          .filter((r) => r.w > 0 && r.h > 0);
        return { nome: elemento.dataset.medir!, retangulos };
      });
    }, { y, topo, altura });
    const leitor = await context.newPage();
    const piores = new Map<string, { razao: number; rgb: number[]; rolagem: number }>();
    const passos = new Map<string, number>();
    let terminou = false;
    for (let rolagem = 0; rolagem < 6000; rolagem += PASSO) {
      const visiveis = (await rolarPara(rolagem)).filter((alvo) => alvo.retangulos.length > 0);
      if (visiveis.length === 0) { terminou = true; break; }
      const xs = visiveis.flatMap((alvo) => alvo.retangulos.flatMap((r) => [r.x, r.x + r.w]));
      const recorte = { x: Math.floor(Math.min(...xs)), y: Math.ceil(topo), width: 0, height: altura - Math.ceil(topo) };
      recorte.width = Math.ceil(Math.max(...xs)) - recorte.x;
      const png = await page.screenshot({ clip: recorte, scale: 'css' });
      const claros = await leitor.evaluate(async ({ base64, recorte, retangulosPorAlvo }) => {
        const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0);
        const lin = (canal: number) => { const s = canal / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
        return retangulosPorAlvo.map((retangulos) => {
          let melhor = { luz: -1, rgb: [0, 0, 0] };
          let pixels = 0;
          for (const r of retangulos) {
            const x0 = Math.max(0, Math.floor(r.x - recorte.x)); const y0 = Math.max(0, Math.floor(r.y - recorte.y));
            const x1 = Math.min(img.width, Math.ceil(r.x - recorte.x + r.w)); const y1 = Math.min(img.height, Math.ceil(r.y - recorte.y + r.h));
            if (x1 <= x0 || y1 <= y0) continue;
            const dados = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
            for (let i = 0; i < dados.length; i += 4) {
              pixels += 1;
              const luz = 0.2126 * lin(dados[i]!) + 0.7152 * lin(dados[i + 1]!) + 0.0722 * lin(dados[i + 2]!);
              if (luz > melhor.luz) melhor = { luz, rgb: [dados[i]!, dados[i + 1]!, dados[i + 2]!] };
            }
          }
          return { rgb: melhor.rgb, pixels };
        });
      }, { base64: png.toString('base64'), recorte, retangulosPorAlvo: visiveis.map((alvo) => alvo.retangulos) });
      for (const [i, alvo] of visiveis.entries()) {
        const claro = claros[i]!;
        if (claro.pixels === 0) continue;
        const cor = alvos.find((candidato) => candidato.nome === alvo.nome)!.cor;
        const [r = 255, g = 255, b = 255, alfa = 1] = (cor.match(/[\d.]+/g) ?? []).map(Number);
        const composto = [r, g, b].map((canal, k) => canal * alfa + claro.rgb[k]! * (1 - alfa));
        const razao = razaoDeContraste(luminancia(composto[0]!, composto[1]!, composto[2]!), luminancia(claro.rgb[0]!, claro.rgb[1]!, claro.rgb[2]!));
        passos.set(alvo.nome, (passos.get(alvo.nome) ?? 0) + 1);
        if (razao < (piores.get(alvo.nome)?.razao ?? Infinity)) piores.set(alvo.nome, { razao, rgb: claro.rgb, rolagem });
      }
    }
    await leitor.close();
    expect(terminou, 'a rolagem levou o texto até o topo').toBe(true);
    for (const { nome, cor } of alvos) {
      expect(passos.get(nome) ?? 0, `${nome}: passos medidos`).toBeGreaterThanOrEqual(nome === 'selo' ? 20 : 40);
      const pior = piores.get(nome)!;
      expect.soft(pior.razao, `${nome}: ${cor} sobre rgb(${pior.rgb.join(', ')}) na rolagem de ${pior.rolagem} px dá ${pior.razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
