import { test, expect } from '@playwright/test';
import { varrerContraste } from './helpers/contraste';

test.describe('Plataforma', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const largura of [640, 700]) {
    test(`workspace em ${largura} px contém os indicadores e mantém os estados ao lado`, async ({ page }, info) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto('/plataforma/');
      await page.evaluate(() => document.fonts.ready);
      const workspace = page.locator('.wo-plataforma-workspace');
      const medidas = await workspace.evaluate((quadro) => {
        const indicadores = Array.from(quadro.querySelectorAll('.wo-plataforma-kpis > div'), (cartao) => {
          const caixa = cartao.getBoundingClientRect();
          const estilo = getComputedStyle(cartao);
          const esquerda = caixa.left + parseFloat(estilo.borderLeftWidth) + parseFloat(estilo.paddingLeft);
          const direita = caixa.right - parseFloat(estilo.borderRightWidth) - parseFloat(estilo.paddingRight);
          return Array.from(cartao.querySelectorAll('span, strong'), (texto) => {
            const faixa = document.createRange();
            faixa.selectNodeContents(texto);
            const linhas = Array.from(faixa.getClientRects());
            return { texto: texto.textContent, numero: texto.tagName === 'STRONG', linhas: linhas.length,
              folga: Math.min(...linhas.map((linha) => Math.min(linha.left - esquerda, direita - linha.right))) };
          });
        }).flat();
        const estados = Array.from(quadro.querySelectorAll('.wo-plataforma-execucoes__linha'), (linha) => {
          const nome = linha.querySelector('.wo-plataforma-execucoes__nome')!.getBoundingClientRect();
          const estado = linha.querySelector('.wo-plataforma-estado')!.getBoundingClientRect();
          return { nome: linha.querySelector('.wo-plataforma-execucoes__nome')!.textContent,
            aoLado: estado.left >= nome.right && estado.top < nome.bottom && estado.bottom > nome.top };
        });
        return { indicadores, estados };
      });
      await info.attach(`workspace-${largura}.json`, { body: JSON.stringify(medidas, null, 2), contentType: 'application/json' });
      expect(medidas.indicadores).toHaveLength(6);
      for (const indicador of medidas.indicadores) {
        expect.soft(indicador.folga, `${indicador.texto}: texto dentro do conteúdo do cartão`).toBeGreaterThanOrEqual(-0.5);
        if (indicador.numero) expect.soft(indicador.linhas, `${indicador.texto}: número sem quebra`).toBe(1);
      }
      expect(medidas.estados).toHaveLength(6);
      expect(medidas.estados.filter((estado) => !estado.aoLado).map((estado) => estado.nome),
        'todos os estados ficam ao lado do nome').toEqual([]);
    });
  }

  test('a lista fica no cartão da abertura e as âncoras preservam o acesso', async ({ page }) => {
    await page.goto('/plataforma/#modulos');
    await expect(page.locator('#modulos-titulo')).toBeInViewport();
    const titulo = await page.locator('#modulos-titulo').boundingBox();
    const topo = await page.locator('.wo-topo').boundingBox();
    expect(titulo!.y).toBeGreaterThanOrEqual(topo!.y + topo!.height);
    await page.locator('main a[href="#lista"]').click();
    await expect(page).toHaveURL(/#lista$/);
    await expect(page.locator('#plataforma-titulo')).toBeInViewport();
    await expect(page.locator('.wo-abertura .wo-cartao-noite[data-entrada] #form-interesse')).toHaveCount(1);
    await expect(page.locator('header a[href^="/plataforma/"]')).toHaveCount(0);
    await expect(page.locator('.wo-abertura .wo-cartao-claro .wo-maquete__aviso')).toBeVisible();
  });

  test('em 360 px o WhatsApp não cobre o envio durante a rolagem manual', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/plataforma/');
    const envio = page.locator('#form-interesse button[type="submit"]');
    const flutuante = page.locator('[data-whatsapp="flutuante"]');
    // Pior alinhamento: as duas caixas na mesma altura, sem o scroll-padding de scrollIntoView.
    await envio.evaluate((botao) => {
      const whats = document.querySelector('[data-whatsapp="flutuante"]')!.getBoundingClientRect();
      scrollTo({ top: scrollY + botao.getBoundingClientRect().top - whats.top, behavior: 'instant' });
    });
    const caixaEnvio = (await envio.boundingBox())!;
    const caixaWhats = (await flutuante.boundingBox())!;
    expect(caixaEnvio.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(caixaEnvio.y - caixaWhats.y)).toBeLessThan(1);
    expect(caixaEnvio.x + caixaEnvio.width, 'o envio termina antes da faixa do WhatsApp').toBeLessThan(caixaWhats.x);
    expect(await envio.evaluate((botao) => {
      const r = botao.getBoundingClientRect();
      return botao.contains(document.elementFromPoint(r.right - 2, r.top + r.height / 2));
    })).toBe(true);
  });

  test('hero e cada seção mantêm contraste AA durante a rolagem', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', '1440 × 900 e 390 × 844 cobrem as duas grades');
    test.setTimeout(300_000);
    const trechos = ['#lista', '[aria-labelledby="encaixe-titulo"]', '[aria-labelledby="nucleo-titulo"]',
      '[aria-labelledby="experiencia-titulo"]', '#modulos', '[aria-labelledby="caso-titulo"]', '[aria-labelledby="assinatura-titulo"]'];
    const medidos = await varrerContraste(page, '/plataforma/', trechos);
    await info.attach('contraste-plataforma.json', { body: JSON.stringify(medidos, null, 2), contentType: 'application/json' });
    for (const trecho of trechos) {
      expect(medidos.filter((alvo) => alvo.trecho === trecho).length, trecho).toBeGreaterThan(0);
    }
    expect(medidos.filter((alvo) => alvo.passos < 3).map((alvo) => `${alvo.texto}: ${alvo.passos} passos`)).toEqual([]);
    expect(medidos.filter((alvo) => alvo.pior && alvo.pior.razao < alvo.minimo).map((alvo) => ({
      texto: alvo.texto, trecho: alvo.trecho, cor: alvo.cor, tamanho: alvo.tamanho, peso: alvo.peso,
      minimo: alvo.minimo, ...alvo.pior,
    }))).toEqual([]);
  });
});

test.describe('Plataforma sem JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  test('as quatro telas, os módulos e a alternativa da lista permanecem visíveis', async ({ page }) => {
    await page.goto('/plataforma/');
    await expect(page.locator('[data-opcoes]')).toBeHidden();
    for (const painel of await page.locator('[data-painel]').all()) await expect(painel).toBeVisible();
    await expect(page.locator('.wo-form__semjs')).toBeVisible();
    await expect(page.locator('#form-interesse')).toBeHidden();
    await expect(page.locator('#modulos .wo-plataforma-modulo__nome')).toHaveCount(11);
    await expect(page.locator('[data-fundo-video]')).not.toHaveAttribute('src');
  });
});
