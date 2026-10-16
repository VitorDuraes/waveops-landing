import { test, expect } from '@playwright/test';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* Botão flutuante de WhatsApp (spec 5.4 e 9.2): em toda página menos Contato, que já tem o canal e
   o formulário. Sem chat: é só o link, com o evento de funil que o site já usa. A spec controla a
   largura da janela sozinha, então roda só no projeto desktop. */
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'a spec controla a largura sozinha');
});

test('aparece em toda página menos Contato', async ({ page }) => {
  for (const pagina of paginasJson.paginas) {
    await page.goto(pagina.url);
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    if (pagina.id === 'contato') {
      await expect(botao, pagina.url).toHaveCount(0);
    } else {
      await expect(botao, pagina.url).toHaveCount(1);
      await expect(botao, pagina.url).toBeVisible();
      await expect(botao, pagina.url).toHaveAccessibleName('Falar no WhatsApp');
    }
  }
});

test('o clique manda whatsapp_click com local flutuante', async ({ page }) => {
  const chamadas: unknown[][] = [];
  await page.exposeFunction('registrar', (nome: string, props: unknown) => {
    chamadas.push([nome, props]);
  });
  await page.route('https://wa.me/**', (rota) => rota.fulfill({ body: '' }));
  await page.goto('/solucoes/');
  // O funil.js já definiu o WaveFunil real; o teste troca por um que só registra.
  await page.evaluate(() => {
    const janela = window as unknown as { registrar: (nome: string, props: unknown) => void };
    window.WaveFunil = { enviar: (nome, props) => janela.registrar(nome, props) };
  });
  await page.locator('a[data-whatsapp="flutuante"]').click();
  await expect.poll(() => chamadas).toEqual([['whatsapp_click', { local: 'flutuante' }]]);
});

test.describe('em 360 × 740', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
  });

  const cruza = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  test('não cobre o envio da lista de interesse', async ({ page }) => {
    await page.goto('/plataforma/');
    const envio = page.locator('#form-interesse button[type="submit"]');
    await envio.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    const caixaEnvio = await envio.boundingBox();
    const caixaBotao = await page.locator('a[data-whatsapp="flutuante"]').boundingBox();
    expect(caixaEnvio, 'botão de envio').not.toBeNull();
    expect(caixaBotao, 'botão flutuante').not.toBeNull();
    expect(cruza(caixaEnvio!, caixaBotao!), 'o envio fica fora da caixa do botão flutuante').toBe(false);
    // O scroll-padding-bottom da página guarda 88 px embaixo do alvo, qualquer que seja a largura dele
    // (a rolagem arredonda a posição, então a folga chega a 87,95).
    const folga = await page.evaluate((fim) => window.innerHeight - fim, caixaEnvio!.y + caixaEnvio!.height);
    expect(folga, 'folga entre o envio e o fim da janela').toBeGreaterThanOrEqual(87);
  });

  test('não cobre o fim do rodapé', async ({ page }) => {
    await page.goto('/solucoes/');
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const caixaBotao = await page.locator('a[data-whatsapp="flutuante"]').boundingBox();
    expect(caixaBotao, 'botão flutuante').not.toBeNull();
    // Links e textos do rodapé: o respiro de baixo vale para os dois.
    const itens = page.locator('footer a, footer p');
    const total = await itens.count();
    expect(total, 'links e textos no rodapé').toBeGreaterThan(0);
    for (let i = 0; i < total; i += 1) {
      const caixa = await itens.nth(i).boundingBox();
      if (!caixa) continue;
      const nome = (await itens.nth(i).innerText()).slice(0, 40);
      expect(cruza(caixa, caixaBotao!), `"${nome}" fica fora da caixa do botão flutuante`).toBe(false);
    }
  });

  test('a página não rola na horizontal', async ({ page }) => {
    for (const pagina of paginasJson.paginas) {
      await page.goto(pagina.url);
      const medidas = await page.evaluate(() => ({ documento: document.documentElement.scrollWidth, janela: document.documentElement.clientWidth }));
      expect(medidas.documento, pagina.url).toBeLessThanOrEqual(medidas.janela);
    }
  });
});
