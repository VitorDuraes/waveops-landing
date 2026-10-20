import { test, expect, type Page } from '@playwright/test';
import { lerPng } from './helpers/contraste';

test('o topo mantém contraste AA sobre o cartão claro da Plataforma', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'reprodução do cartão sob os links da barra');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/plataforma/');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo({ top: 819, behavior: 'instant' }));
  const link = page.locator('.wo-topo__links a').first();
  const caixa = (await link.boundingBox())!;
  const cor = await link.evaluate((el) => getComputedStyle(el).color);
  await page.screenshot({ path: info.outputPath('topo-sobre-cartao.png') });
  // Retira só a tinta do link para medir os pixels reais atrás dos glifos, preservando o topo.
  await link.evaluate((el) => { el.style.color = 'transparent'; });
  const png = lerPng(await page.screenshot({ clip: caixa, scale: 'css' }));
  const [r, g, b, a = 1] = cor.match(/[\d.]+/g)!.map(Number);
  const linear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = (c: number[]) => 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2]);
  let minimo = Infinity;
  let fundo: number[] = [];
  for (let i = 0; i < png.rgba.length; i += 4) {
    const pixel = [...png.rgba.slice(i, i + 3)];
    const tinta = [r, g, b].map((c, n) => c * a + pixel[n] * (1 - a));
    const l1 = lum(tinta); const l2 = lum(pixel);
    const razao = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (razao < minimo) { minimo = razao; fundo = pixel; }
  }
  await info.attach('contraste-real', { body: JSON.stringify({ cor, fundo, minimo, scrollY: await page.evaluate(() => scrollY) }), contentType: 'application/json' });
  console.log(JSON.stringify({ contrasteTopo: minimo, cor, fundo }));
  expect(minimo, `${cor} sobre rgb(${fundo.join(', ')}): ${minimo.toFixed(3)}:1`).toBeGreaterThanOrEqual(4.5);
});

test('Tab fora do menu fecha o painel e deixa o primeiro link do main descoberto', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'reprodução do painel em tela baixa');
  await page.setViewportSize({ width: 390, height: 600 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/contato/');
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  const painel = page.locator('#menu-movel');
  await painel.getByRole('link').last().focus();
  await page.keyboard.press('Tab');
  const alvo = page.locator('main a[href]').first();
  await expect(alvo).toBeFocused();
  const descoberto = await alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const frente = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return frente === el || el.contains(frente);
  });
  await page.screenshot({ path: info.outputPath('foco-apos-menu.png') });
  expect(descoberto, 'o painel não pode cobrir o link focado no main').toBe(true);
  await expect(painel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
});

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

test('seletor da Plataforma troca o painel por teclado e marca aria-pressed', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'mesmo comportamento das outras larguras');
  await page.goto('/plataforma/');
  const automacoes = page.getByRole('button', { name: /^Automações/ });
  await expect(page.locator('#tela-visao-geral')).toBeVisible();
  await expect(page.locator('#tela-automacoes')).toBeHidden();
  await automacoes.focus();
  await page.keyboard.press('Enter');
  await expect(automacoes).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Visão geral/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#tela-automacoes')).toBeVisible();
  await expect(page.locator('#tela-visao-geral')).toBeHidden();
});

/* Topo fixo (spec 5.5 e 15.2). O HTML nasce com o topo solto e escuro; o site.js liga o modo fixo. O
   topo fica no estado escuro em qualquer ponto da página: a troca para o claro saiu com o fundo vivo
   (fundo.spec.ts confere o estado do início ao fim de toda página). */
const rolarPara = (page: Page, y: number) => page.evaluate((alvo) => window.scrollTo({ top: alvo, behavior: 'instant' }), y);

/** Fundo e cor do topo como o navegador calculou, com proteção escura sobre cartões claros. */
const corDoTopo = (page: Page) => page.locator('.wo-topo').evaluate((topo) => [getComputedStyle(topo).backgroundColor, getComputedStyle(topo).color]);
const TOPO_ESCURO = ['rgba(10, 10, 10, 0.84)', 'rgb(243, 243, 241)'];

test.describe('topo fixo', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmo comportamento do desktop e do celular');
  });

  test('a âncora de outro sistema não para embaixo do topo', async ({ page }) => {
    await page.goto('/projetos-sob-medida/#modelos');
    await expect(page.locator('html')).toHaveAttribute('data-topo', 'fixo');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const alvo = document.querySelector('#modelos');
          const topo = document.querySelector('.wo-topo');
          if (!alvo || !topo) throw new Error('faltou #modelos ou .wo-topo');
          return Math.round(alvo.getBoundingClientRect().top - topo.getBoundingClientRect().bottom);
        }),
      )
      .toBeGreaterThanOrEqual(0);
  });

  test('o topo mede 66 px e o título da abertura começa abaixo dele', async ({ page }) => {
    await page.goto('/solucoes/');
    const caixas = await page.evaluate(() => {
      const topo = document.querySelector('.wo-topo')!.getBoundingClientRect();
      const titulo = document.querySelector('h1')!.getBoundingClientRect();
      return { fimDoTopo: topo.bottom, topoDoTitulo: titulo.top };
    });
    expect(Math.round(caixas.fimDoTopo)).toBe(66);
    expect(caixas.topoDoTitulo).toBeGreaterThanOrEqual(caixas.fimDoTopo);
  });
});

test('recarregar no meio da página mantém o topo fixo e escuro', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a rolagem restaurada é a mesma nas outras larguras');
  await page.goto('/solucoes/');
  await rolarPara(page, 1500);
  expect(await corDoTopo(page)).toEqual(TOPO_ESCURO);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-topo', 'fixo');
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(await corDoTopo(page)).toEqual(TOPO_ESCURO);
});

test('o foco por teclado não fica embaixo do topo', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'o foco reverso é o mesmo nas outras larguras');
  await page.goto('/solucoes/');
  await page.keyboard.press('End');
  const dentroDoMain = () => page.evaluate(() => Boolean(document.activeElement?.closest('main')));
  let entrou = false;
  for (let i = 0; i < 60 && !entrou; i += 1) {
    await page.keyboard.press('Shift+Tab');
    entrou = await dentroDoMain();
  }
  expect(entrou, 'o foco entrou no <main> em até 60 Shift+Tab').toBe(true);
  let conferidos = 0;
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Shift+Tab');
    const medidas = await page.evaluate(() => {
      const foco = document.activeElement;
      if (!foco || !foco.closest('main')) return null;
      return {
        alvo: foco.outerHTML.slice(0, 70),
        topo: foco.getBoundingClientRect().top,
        fimDoTopo: document.querySelector('.wo-topo')!.getBoundingClientRect().bottom,
      };
    });
    if (!medidas) continue;
    conferidos += 1;
    expect(medidas.topo, medidas.alvo).toBeGreaterThanOrEqual(medidas.fimDoTopo);
  }
  expect(conferidos, 'passos conferidos dentro do <main>').toBeGreaterThan(0);
});

test('pular para o conteúdo aparece por cima do topo', async ({ page }) => {
  await page.goto('/solucoes/');
  await page.keyboard.press('Tab');
  const pular = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(pular).toBeFocused();
  const noTopo = await pular.evaluate((link) => {
    const caixa = link.getBoundingClientRect();
    return document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2) === link;
  });
  expect(noTopo, 'elementFromPoint no centro do link devolve o próprio link').toBe(true);
});

/* O topo deixou de depender do IntersectionObserver: com a página inteira no escuro, não há faixa
   para vigiar. Sem o observador, o modo fixo liga igual e o topo fica escuro. */
test('sem IntersectionObserver o topo fica fixo e escuro', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'mesmo comportamento do desktop e do celular');
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'IntersectionObserver');
  });
  await page.goto('/solucoes/');
  await expect(page.locator('html')).toHaveAttribute('data-topo', 'fixo');
  expect(await page.locator('.wo-topo').evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  expect(await corDoTopo(page)).toEqual(TOPO_ESCURO);
  await rolarPara(page, 1500);
  expect(await corDoTopo(page)).toEqual(TOPO_ESCURO);
});

/* Pausa do fundo vivo no topo (spec 15.3): nome fixo, 40 px no desktop e 44 px abaixo de 768 px, ao
   lado do menu. Ela só aparece quando o vídeo pode tocar, então o teste libera o movimento. */
test('o botão de pausa do fundo fica no topo, com 40 px no desktop e 44 px abaixo de 768 px', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/solucoes/');
  const botao = page.getByRole('button', { name: 'Pausar animação do fundo', exact: true });
  await expect(botao).toBeVisible();
  const lado = (page.viewportSize()?.width ?? 0) < 768 ? 44 : 40;
  const caixa = (await botao.boundingBox())!;
  expect([Math.round(caixa.width), Math.round(caixa.height)], info.project.name).toEqual([lado, lado]);
  const barra = (await page.locator('.wo-topo__barra').boundingBox())!;
  expect(caixa.y).toBeGreaterThanOrEqual(barra.y);
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(barra.y + barra.height);
  // A ordem de tabulação continua: o botão do menu do celular vem depois da pausa e antes do painel.
  if (info.project.name === 'celular') {
    await botao.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();
  }
});
