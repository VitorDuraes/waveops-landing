import { test, expect, type Page } from '@playwright/test';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* Botão flutuante de WhatsApp (spec 5.4 e 9.2): em toda página menos Contato, que já tem o canal e
   o formulário. Sem chat: é só o link, com o evento de funil que o site já usa. */

/** Rola até o topo do capítulo ficar em innerHeight / 2 - p × 0,75 × altura (a conta do palco). */
async function rolarCapitulo(page: Page, frente: string, p: number) {
  await page.evaluate(
    ({ frente, p }) => {
      const capitulo = document.querySelector(`[data-frente="${frente}"]`);
      if (!capitulo) throw new Error(`capítulo ${frente} não encontrado`);
      const caixa = capitulo.getBoundingClientRect();
      window.scrollTo({ top: Math.ceil(window.scrollY + caixa.top - (window.innerHeight / 2 - p * 0.75 * caixa.height)), behavior: 'instant' });
    },
    { frente, p },
  );
}

/** Rola até o título de "Duas formas de começar", a primeira seção depois do palco da Home (spec 15.4). */
const rolarAtePrimeiraSecao = (page: Page) => page.locator('#entradas-titulo').evaluate((titulo) => titulo.scrollIntoView({ block: 'center', behavior: 'instant' }));

/** Rola até o topo da primeira seção depois do palco ficar na altura `y` da janela. */
const rolarSecaoPara = (page: Page, y: number) => page.locator('[data-palco] + section').evaluate((secao, alvo) => {
  scrollTo({ top: Math.round(scrollY + secao.getBoundingClientRect().top - alvo), behavior: 'instant' });
}, y);

/** Duração da transição de uma propriedade do botão, como o navegador a calculou. A lista de
    durações é repetida até cobrir a de propriedades (com menos movimento ela tem um valor só). */
function duracaoDaTransicao(page: Page, propriedade: string) {
  return page.locator('a[data-whatsapp="flutuante"]').evaluate((botao, propriedade) => {
    const estilo = getComputedStyle(botao);
    const propriedades = estilo.transitionProperty.split(', ');
    const duracoes = estilo.transitionDuration.split(', ');
    const indice = propriedades.indexOf(propriedade);
    return indice === -1 ? 'sem transição' : duracoes[indice % duracoes.length];
  }, propriedade);
}

test.describe('em desktop', () => {
  // A spec controla a largura da janela sozinha, então roda só no projeto desktop.
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

  // Com o painel do palco preso embaixo da janela (abaixo de 1024 px), o botão sai da frente dele.
  // A partir de 1024 px o painel fica ao lado da cena e o botão não atrapalha.
  test('com um capítulo ativo, o botão some em 1023 px e fica em 1024 px', async ({ page }) => {
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    await page.setViewportSize({ width: 1023, height: 800 });
    await page.goto('/');
    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'atendimento');
    await expect(botao).toHaveCSS('opacity', '0');
    await page.setViewportSize({ width: 1024, height: 800 });
    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'atendimento');
    await expect(botao).toHaveCSS('opacity', '1');
  });
});

test.describe('no celular, com o palco da Home', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'celular', 'o painel do palco só fica embaixo da janela no celular');
  });

  test('o botão some com o capítulo 1 ativo e volta na primeira seção depois do palco', async ({ page }) => {
    await page.goto('/');
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    await expect(botao, 'no alto da Home').toHaveCSS('opacity', '1');

    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'atendimento');
    await expect(botao, 'com o capítulo 1 ativo').toHaveCSS('opacity', '0');
    await expect(botao).toHaveCSS('pointer-events', 'none');

    await rolarAtePrimeiraSecao(page);
    await expect(botao, 'com a primeira seção depois do palco na tela').toHaveCSS('opacity', '1');
    await expect(botao).toHaveCSS('pointer-events', 'auto');

    // Voltando para o palco, ele sai de novo.
    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(botao, 'de volta ao palco').toHaveCSS('opacity', '0');
    await expect(botao).toHaveCSS('pointer-events', 'none');
  });

  // Spec 15.4: ele volta quando a primeira seção depois do palco cobre a caixa dele, nem antes nem depois.
  test('o botão volta quando a primeira seção depois do palco cobre a caixa dele', async ({ page }) => {
    await page.goto('/');
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    const caixa = (await botao.boundingBox())!;
    await rolarSecaoPara(page, caixa.y + 8);
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'saas');
    await expect(botao, 'seção 8 px abaixo do alto do botão').toHaveCSS('opacity', '0');
    await rolarSecaoPara(page, caixa.y - 8);
    await expect(botao, 'seção 8 px acima do alto do botão').toHaveCSS('opacity', '1');
    await expect(botao).toHaveCSS('pointer-events', 'auto');
  });

  test('o botão oculto sai da navegação por teclado e volta depois do palco', async ({ page }) => {
    await page.goto('/');
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    await page.locator('a[data-whatsapp="cta-final"]').focus();
    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(botao).toHaveCSS('opacity', '0');
    await page.keyboard.press('Tab');
    await expect(botao, 'o Tab ignora o botão invisível').not.toBeFocused();
    await rolarAtePrimeiraSecao(page);
    await expect(botao).toHaveCSS('opacity', '1');
    await botao.focus();
    await expect(botao, 'depois do palco o link volta a receber foco').toBeFocused();
  });

  test('a troca de opacidade leva 240 ms e some com menos movimento', async ({ page }) => {
    await page.goto('/');
    expect(await duracaoDaTransicao(page, 'opacity')).toBe('0.24s');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await duracaoDaTransicao(page, 'opacity')).toBe('1e-05s');
  });

  test('com menos movimento o palco não liga e o botão fica', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    await page.locator('[data-frente="atendimento"]').evaluate((capitulo) => capitulo.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(page.locator('.wo-fundo')).not.toHaveAttribute('data-capitulo');
    await expect(botao).toHaveCSS('opacity', '1');
  });
});

test.describe('sem animation-timeline, no celular e no tablet', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'o painel inferior aparece abaixo de 1024 px');
    // Simula a falta do recurso tanto na condição CSS quanto em consultas feitas por JavaScript.
    await page.route('**/assets/site/paginas/home.css*', async (rota) => {
      const resposta = await rota.fetch();
      const css = (await resposta.text()).replaceAll(/animation-timeline\s*:\s*view\(\)/g, 'animation-timeline: __sem_suporte__()');
      await rota.fulfill({ response: resposta, body: css });
    });
    await page.addInitScript(() => {
      const suporta = CSS.supports.bind(CSS);
      CSS.supports = (propriedade: string, valor?: string) =>
        propriedade.includes('animation-timeline') ? false : valor === undefined ? suporta(propriedade) : suporta(propriedade, valor);
    });
  });

  test('sem animation-timeline o botão sai do palco e do teclado, volta depois do palco e some ao subir', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => CSS.supports('animation-timeline: view()'))).toBe(false);
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    await expect(botao).toBeVisible();
    await page.locator('a[data-whatsapp="cta-final"]').focus();
    await rolarCapitulo(page, 'saas', 0.8);
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'saas');
    await expect(botao).toHaveCSS('opacity', '0');
    await expect(botao).toBeHidden();
    await page.keyboard.press('Tab');
    await expect(botao).not.toBeFocused();
    await rolarAtePrimeiraSecao(page);
    await expect(botao).toHaveCSS('opacity', '1');
    await expect(botao).toBeVisible();
    await botao.focus();
    await expect(botao).toBeFocused();
    await rolarCapitulo(page, 'saas', 0.8);
    await expect(botao).toHaveCSS('opacity', '0');
    await expect(botao).toBeHidden();
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(botao).toHaveCSS('opacity', '1');
    await expect(botao).toBeVisible();
  });

  test('sem animation-timeline desativar o palco por movimento ou altura libera o botão', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    const botao = page.locator('a[data-whatsapp="flutuante"]');
    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(botao).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    await expect(botao).toBeVisible();
    await expect(botao).toHaveCSS('opacity', '1');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(botao).toBeHidden();
    const tamanho = page.viewportSize()!;
    await page.setViewportSize({ width: tamanho.width, height: 550 });
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    await expect(botao).toBeVisible();
    await expect(botao).toHaveCSS('opacity', '1');
    await page.setViewportSize(tamanho);
    // A posição do capítulo depende do modo fixo, aplicado pelo evento de mudança de mídia.
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await rolarCapitulo(page, 'atendimento', 0.2);
    await expect(botao).toBeHidden();
  });
});
