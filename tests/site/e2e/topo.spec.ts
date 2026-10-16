import { test, expect, type Page } from '@playwright/test';

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

/* Topo fixo de dois estados (spec 5.5). O HTML nasce com o topo escuro e solto sobre a faixa
   escura de abertura; o site.js liga o modo fixo e troca o estado quando a faixa termina. */
async function fimDaFaixa(page: Page) {
  return page.evaluate(() => {
    const faixa = document.querySelector('[data-faixa-escura]');
    if (!faixa) throw new Error('página sem [data-faixa-escura]');
    return Math.ceil(faixa.getBoundingClientRect().bottom + window.scrollY);
  });
}

const rolarPara = (page: Page, y: number) => page.evaluate((alvo) => window.scrollTo({ top: alvo, behavior: 'instant' }), y);

test.describe('topo fixo', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmo comportamento do desktop e do celular');
  });

  // Na Home a faixa escura é o invólucro do hero e do palco; nas outras, a abertura.
  for (const url of ['/', '/solucoes/']) {
    test(`${url}: o topo nasce escuro e fica claro depois da faixa`, async ({ page }) => {
      await page.goto(url);
      const topo = page.locator('.wo-topo');
      await expect(page.locator('html')).toHaveAttribute('data-topo', 'fixo');
      await expect(topo).toHaveAttribute('data-estado', 'escuro');
      expect(await topo.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
      await rolarPara(page, await fimDaFaixa(page));
      await expect(topo).toHaveAttribute('data-estado', 'claro');
      await rolarPara(page, 0);
      await expect(topo).toHaveAttribute('data-estado', 'escuro');
    });
  }

  // No Contato a faixa escura é o main inteiro: o topo continua escuro enquanto o main cobre o topo.
  test('o Contato mantém o topo escuro enquanto o main cobre o topo', async ({ page }) => {
    await page.goto('/contato/');
    const topo = page.locator('.wo-topo');
    await expect(page.locator('html')).toHaveAttribute('data-topo', 'fixo');
    await expect(topo).toHaveAttribute('data-estado', 'escuro');
    await rolarPara(page, (await fimDaFaixa(page)) - 300);
    await expect(topo).toHaveAttribute('data-estado', 'escuro');
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

test('recarregar no meio da página mantém o topo claro', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a rolagem restaurada é a mesma nas outras larguras');
  await page.goto('/solucoes/');
  await rolarPara(page, 1500);
  await expect(page.locator('.wo-topo')).toHaveAttribute('data-estado', 'claro');
  await page.reload();
  await expect(page.locator('.wo-topo')).toHaveAttribute('data-estado', 'claro');
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
