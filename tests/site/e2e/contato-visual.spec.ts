import { test, expect, type Page } from '@playwright/test';
import { lerPng, varrerContraste } from './helpers/contraste';

/* Regressões do cartão de Contato: opções legíveis em telas estreitas, foco de teclado visível e
   texto sobre a onda durante a rolagem. Os contratos e os envios ficam em contato.spec.ts. */
test.use({ reducedMotion: 'reduce' });

async function conferirEncaixe(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'sem rolagem horizontal').toBeLessThanOrEqual(1);
  const problemas = await page.locator('.wo-opcao-canal').evaluateAll((opcoes) => opcoes.flatMap((opcao) => {
    const caixa = opcao.getBoundingClientRect();
    const estilo = getComputedStyle(opcao);
    const inicio = caixa.left + Number.parseFloat(estilo.borderLeftWidth) + Number.parseFloat(estilo.paddingLeft);
    const fim = caixa.right - Number.parseFloat(estilo.borderRightWidth) - Number.parseFloat(estilo.paddingRight);
    const erros: string[] = [];
    if (caixa.height < 44 || caixa.width < 44) erros.push(`${opcao.textContent}: alvo menor que 44 px`);
    for (const no of opcao.childNodes) {
      if (no.nodeType !== Node.TEXT_NODE || !no.textContent?.trim()) continue;
      const faixa = document.createRange();
      faixa.selectNodeContents(no);
      for (const r of faixa.getClientRects()) {
        if (r.left < inicio - 0.5 || r.right > fim + 0.5) erros.push(`${no.textContent}: glifos fora do conteúdo`);
      }
    }
    return erros;
  }));
  expect(problemas).toEqual([]);
}

test('opções e estados do formulário cabem em 360, 390, 768 e 1440 px', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'o teste controla as quatro larguras');
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1024 });
    await page.clock.install();
    let status = 503;
    await page.route('**/__dev/lead*', route => route.fulfill({ status, contentType: 'application/json', body: status === 200 ? '{"ok":true}' : '{"ok":false}' }));
    await page.goto('/contato/');
    await page.evaluate(() => document.fonts.ready);
    await conferirEncaixe(page);
    await expect(page.locator('[data-whatsapp="flutuante"]')).toHaveCount(0);
    const cartao = (await page.locator('.wo-contato-cartao').boundingBox())!;
    const texto = (await page.locator('.wo-abertura__texto').boundingBox())!;
    if (width >= 1024) expect(cartao.x).toBeGreaterThan(texto.x + texto.width);
    else expect(cartao.y).toBeGreaterThan(texto.y + texto.height);
    await page.getByRole('button', {name: 'Enviar pedido'}).click();
    await expect(page.locator('#contato-resumo')).toBeVisible();
    await conferirEncaixe(page);
    await page.locator('#f-nome').fill('Pessoa Teste');
    await page.getByLabel('E-mail', {exact:true}).check();
    await page.locator('#f-email').fill('pessoa.com.nome.composto@example.com');
    await page.locator('#f-politica').check();
    await page.clock.fastForward(2000);
    await page.getByRole('button', {name: 'Enviar pedido'}).click();
    await expect(page.locator('#contato-falha')).toBeVisible();
    await conferirEncaixe(page);
    status = 200;
    await page.getByRole('button', {name: 'Tentar de novo'}).click();
    await expect(page.locator('#contato-confirmacao')).toBeVisible();
    await expect(page.locator('[data-confirmacao-titulo]')).toBeFocused();
    expect(await page.locator('#contato-confirmacao').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const titulo = (await page.locator('[data-confirmacao-titulo]').boundingBox())!;
    const topo = (await page.locator('.wo-topo').boundingBox())!;
    expect(titulo.y).toBeGreaterThanOrEqual(topo.y + topo.height);
    expect(titulo.y + titulo.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.unroute('**/__dev/lead*');
  }
});

test('Tab e setas trocam o canal com anel de foco visível e contraste de 3:1', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', 'desktop e celular cobrem as duas disposições dos canais');
  await page.goto('/contato/');
  await page.locator('#f-empresa').focus();
  await page.keyboard.press('Tab');
  for (const canal of ['whatsapp', 'email', 'ligacao']) {
    const radio = page.locator(`input[name="canalRetorno"][value="${canal}"]`);
    await expect(radio).toBeFocused();
    await expect(radio).toBeChecked();
    const alvo = radio.locator('..');
    const estilo = await alvo.evaluate(el => {
      const css = getComputedStyle(el);
      return {tipo:css.outlineStyle, largura:Number.parseFloat(css.outlineWidth), afastamento:Number.parseFloat(css.outlineOffset)};
    });
    expect(estilo.tipo).toBe('solid');
    expect(estilo.largura).toBeGreaterThanOrEqual(2);
    const caixa = (await alvo.boundingBox())!;
    const topo = (await page.locator('.wo-topo').boundingBox())!;
    const yAnel = Math.floor(caixa.y - estilo.afastamento - estilo.largura / 2);
    expect(yAnel, 'anel abaixo do topo fixo').toBeGreaterThan(topo.y + topo.height);
    const pixels = lerPng(await page.screenshot({scale:'css'}));
    const pixel = (y: number) => {
      const i = (y * pixels.largura + Math.floor(caixa.x + caixa.width / 2)) * 4;
      return [pixels.rgba[i]!, pixels.rgba[i + 1]!, pixels.rgba[i + 2]!];
    };
    const luz = (rgb: number[]) => rgb.map(c => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i]!, 0);
    const anel = luz(pixel(yAnel));
    const fundo = luz(pixel(yAnel - Math.ceil(estilo.largura) - 2));
    expect((Math.max(anel, fundo) + 0.05) / (Math.min(anel, fundo) + 0.05), `contraste real do foco em ${canal}`).toBeGreaterThanOrEqual(3);
    if (canal !== 'ligacao') await page.keyboard.press('ArrowRight');
  }
  await expect(page.locator('[data-campo-horario]')).toBeVisible();
});

test('hero e próxima seção mantêm contraste AA durante toda a rolagem', async ({ page }, info) => {
  test.skip(info.project.name === 'tablet', '1440 × 900 e 390 × 844 cobrem as duas grades');
  test.setTimeout(180_000);
  const trechos = ['[aria-labelledby="contato-titulo"]', '[aria-labelledby="depois-titulo"]'];
  const medidos = await varrerContraste(page, '/contato/', trechos);
  await info.attach('contraste-contato.json', {body:JSON.stringify(medidos,null,2), contentType:'application/json'});
  for (const trecho of trechos) expect(medidos.filter(alvo => alvo.trecho === trecho).length, trecho).toBeGreaterThan(0);
  expect(medidos.filter(alvo => alvo.passos < 3).map(alvo => `${alvo.texto}: ${alvo.passos} passos`)).toEqual([]);
  expect(medidos.filter(alvo => alvo.pior && alvo.pior.razao < alvo.minimo).map(alvo => ({texto:alvo.texto, minimo:alvo.minimo, ...alvo.pior}))).toEqual([]);
});
