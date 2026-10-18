import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* Palco de fundo da Home (spec 13). Com o palco ligado, as cinco cenas ficam fixas na tela, atrás
   do texto: a do capítulo da vez aparece e se monta conforme a rolagem, e antes do primeiro
   capítulo nenhuma aparece. Com menos movimento, sem JavaScript ou com a janela abaixo de 560 px
   de altura, o palco desliga e cada capítulo mostra o painel e a cena já montada. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Espera dois quadros: a rolagem chega ao módulo e o quadro que ela agendou já rodou. */
async function quadro(page: Page) {
  await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))));
}

/** Rola até o topo do capítulo ficar em innerHeight / 2 - p × 0,75 × altura. A rolagem é
    arredondada para cima: com p = 0, o topo fica na linha ou logo acima, nunca uma fração abaixo. */
async function rolarProgresso(page: Page, frente: string, p: number) {
  await page.evaluate(
    ({ frente, p }) => {
      const capitulo = document.querySelector(`[data-frente="${frente}"]`);
      if (!capitulo) throw new Error(`capítulo ${frente} não encontrado`);
      const caixa = capitulo.getBoundingClientRect();
      const alvo = innerHeight / 2 - p * 0.75 * caixa.height;
      window.scrollTo({ top: Math.ceil(scrollY + caixa.top - alvo), behavior: 'instant' });
    },
    { frente, p },
  );
  await quadro(page);
}

/** Maior data-passo montado na cena, ou 0. Um passo pode ter mais de uma peça. */
async function montadas(page: Page, cena: string) {
  return page.evaluate((cena) => {
    const pecas = document.querySelectorAll<HTMLElement>(`[data-cena="${cena}"] [data-passo][data-visivel]`);
    return Math.max(0, ...[...pecas].map((peca) => Number(peca.dataset.passo)));
  }, cena);
}

/** Espera as transições acabarem, para não medir no meio delas. */
async function semTransicao(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animacao) => animacao.finished.catch(() => undefined)));
  });
}

/** Quantas peças do palco não estão com opacidade 1. */
function pecasApagadas(page: Page) {
  return page.locator('[data-cena] [data-passo]').evaluateAll((pecas) => pecas.filter((peca) => getComputedStyle(peca).opacity !== '1').length);
}

/** Violações sérias ou críticas do axe dentro da seção do palco. */
async function gravesNoPalco(page: Page) {
  const resultado = await new AxeBuilder({ page }).include('[data-palco]').withTags(TAGS).analyze();
  return resultado.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('palco ligado no desktop e no celular', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'o tablet usa o layout do celular');
  });

  test('antes do primeiro capítulo nenhuma cena aparece', async ({ page }) => {
    await page.goto('/');
    await page.locator('.wo-home-frentes__abertura').evaluate((abertura) => abertura.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await quadro(page);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await expect(page.locator('[data-cena][data-ativa]')).toHaveCount(0);
    await expect(page.locator('.wo-fundo')).not.toHaveAttribute('data-capitulo');
  });

  test('a cena do capítulo da vez fica ativa e as outras não', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0.2);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await expect(page.locator('[data-cena="atendimento"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-frente="atendimento"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="agentes"]')).not.toHaveAttribute('data-ativa');
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'atendimento');
  });
});

test.describe('palco no desktop', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'os casos de rolagem e de janela rodam no desktop');
  });

  test('os passos crescem ao descer e diminuem ao subir', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(1);
    await rolarProgresso(page, 'atendimento', 1);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
    await rolarProgresso(page, 'atendimento', 0.1);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(1);
  });

  test('rolar até o segundo capítulo troca a cena', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'agentes', 0.2);
    await expect(page.locator('[data-cena="agentes"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="atendimento"]')).not.toHaveAttribute('data-ativa');
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'agentes');
  });

  test('o estado vale depois de recarregar no meio da seção', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'agentes', 0.5);
    await page.reload();
    await quadro(page);
    await expect(page.locator('[data-cena="agentes"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="atendimento"]')).not.toHaveAttribute('data-ativa');
  });

  test('voltar do histórico mantém o estado', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'agentes', 0.5);
    await page.goto('/solucoes/');
    await page.goBack();
    await quadro(page);
    await expect(page.locator('[data-cena="agentes"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('[data-cena="atendimento"]')).not.toHaveAttribute('data-ativa');
  });

  /* Spec 15.4: a folha creme saiu. Depois do quinto capítulo, nenhuma cena fica na tela, a onda volta
     ao brilho inteiro e o véu da primeira seção faz a leitura. O palco acaba quando o fim dele passa
     da metade da janela, a mesma linha que liga um capítulo. */
  test('depois do palco nenhuma cena aparece e o fundo volta ao brilho inteiro', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'saas', 1);
    await expect(page.locator('[data-cena="saas"]')).toHaveAttribute('data-ativa');
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'saas');
    await page.locator('#entradas-titulo').evaluate((titulo) => titulo.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await quadro(page);
    await expect(page.locator('[data-cena][data-ativa]')).toHaveCount(0);
    await expect(page.locator('[data-frente][data-ativa]')).toHaveCount(0);
    await expect(page.locator('.wo-fundo')).not.toHaveAttribute('data-capitulo');
    // A onda aparece inteira: o vídeo, quando toca, ou o pôster.
    await expect.poll(() => page.evaluate(() => {
      const video = document.querySelector('[data-fundo-video]');
      const camada = video?.hasAttribute('data-tocando') ? video : document.querySelector('.wo-fundo__poster');
      return camada ? getComputedStyle(camada).opacity : 'sem fundo';
    })).toBe('1');
    await expect(page.locator('[data-palco] + section')).toHaveCSS('background-color', 'rgba(10, 10, 10, 0.72)');
    // Subindo de volta ao quinto capítulo, a cena dele volta inteira.
    await rolarProgresso(page, 'saas', 1);
    await expect(page.locator('[data-cena="saas"]')).toHaveAttribute('data-ativa');
    const total = await page.locator('[data-cena="saas"] [data-passo]').evaluateAll((pecas) => Math.max(...pecas.map((peca) => Number((peca as HTMLElement).dataset.passo))));
    await expect.poll(() => montadas(page, 'saas')).toBe(total);
  });

  test('o fim do palco é a metade da janela', async ({ page }) => {
    await page.goto('/');
    const rolarFim = (deslocamento: number) => page.locator('[data-palco]').evaluate((secao, d) => {
      scrollTo({ top: Math.ceil(scrollY + secao.getBoundingClientRect().bottom - innerHeight / 2 + d), behavior: 'instant' });
    }, deslocamento);
    await rolarFim(-24);
    await quadro(page);
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'saas');
    await rolarFim(24);
    await quadro(page);
    await expect(page.locator('.wo-fundo')).not.toHaveAttribute('data-capitulo');
    await expect(page.locator('[data-cena][data-ativa]')).toHaveCount(0);
  });

  test('com menos de 560 px de altura o palco desliga', async ({ page }) => {
    await page.goto('/');
    await quadro(page);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    expect(await pecasApagadas(page)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 550 });
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    await expect.poll(() => pecasApagadas(page)).toBe(0);
  });

  test('a preferência muda com a página aberta', async ({ page }) => {
    await page.goto('/');
    await rolarProgresso(page, 'atendimento', 0);
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await semTransicao(page);
    expect(await pecasApagadas(page)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    await expect(page.locator('.wo-fundo')).not.toHaveAttribute('data-capitulo');
    await expect.poll(() => pecasApagadas(page)).toBe(0);
  });

  test('o axe não acusa nada grave na seção com o palco ligado', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await rolarProgresso(page, 'atendimento', 1);
    await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
    await semTransicao(page);
    expect(await gravesNoPalco(page)).toEqual([]);
  });

  test.describe('com menos movimento', () => {
    test.use({ reducedMotion: 'reduce' });

    test('o axe não acusa nada grave na seção com o palco desligado', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
      expect(await gravesNoPalco(page)).toEqual([]);
    });
  });
});

/* Spec 15.4 e foco 6 do brief: o véu das seções depois do palco é translúcido, então nada do palco pode
   ficar atrás dele. Com a primeira seção subindo e o quinto capítulo ainda ativo (o alto dela a 75% e
   a 60% da janela, antes da metade), a captura da faixa abaixo do alto da seção tem de sair igual com
   e sem o painel e as cenas. O vídeo fica pausado no pôster e as transições desligadas, para as duas
   capturas verem o mesmo fundo; o texto da seção e o botão flutuante saem das duas. */
test.describe('o fim do palco não aparece através do véu', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'o tablet usa o layout do celular');
  });

  for (const fracao of [0.75, 0.6]) {
    test(`com a primeira seção depois do palco a ${Math.round(fracao * 100)}% da janela, nada do palco aparece abaixo dela`, async ({ page }, info) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Pausar animação do fundo', exact: true }).click();
      await expect(page.locator('[data-fundo-video]')).not.toHaveAttribute('data-tocando');
      await page.addStyleTag({
        content: '*, *::before, *::after { transition: none !important; animation: none !important; } [data-palco] + section * { visibility: hidden !important; } .wo-whatsapp-flutuante { visibility: hidden !important; }',
      });
      await page.locator('[data-palco] + section').evaluate((secao, f) => {
        scrollTo({ top: Math.round(scrollY + secao.getBoundingClientRect().top - innerHeight * f), behavior: 'instant' });
      }, fracao);
      await quadro(page);
      await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
      await expect(page.locator('[data-frente="saas"]')).toHaveAttribute('data-ativa');
      const recorte = await page.locator('[data-palco] + section').evaluate((secao) => {
        const alto = Math.ceil(secao.getBoundingClientRect().top);
        return { x: 0, y: alto, width: document.documentElement.clientWidth, height: innerHeight - alto };
      });
      const comPalco = await page.screenshot({ clip: recorte, scale: 'css' });
      await page.addStyleTag({ content: '[data-cena], .wo-home-painel { visibility: hidden !important; }' });
      const semPalco = await page.screenshot({ clip: recorte, scale: 'css' });
      await info.attach('com-palco.png', { body: comPalco, contentType: 'image/png' });
      await info.attach('sem-palco.png', { body: semPalco, contentType: 'image/png' });
      expect(comPalco.equals(semPalco), `a faixa abaixo de y ${recorte.y} muda quando o palco some: o painel ou a cena aparecem através do véu`).toBe(true);
    });
  }
});

/* O recorte da cena só corta no alto da primeira seção depois do palco. O halo violeta passa da caixa
   da cena dos lados, no alto e, no celular, embaixo, e precisa esmaecer sem borda reta. Com a seção
   fora da janela, a janela inteira sai igual com o recorte e com ele anulado, no primeiro e no quinto
   capítulo. Com a seção dentro da janela, mas abaixo da caixa da cena, tudo acima do alto dela sai
   igual com o recorte e com um recorte aberto dos quatro lados. O vídeo fica pausado no pôster e as
   transições desligadas, para as duas capturas verem o mesmo fundo. */
test.describe('o recorte da cena só corta no alto da seção', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'o tablet usa o layout do celular');
    await page.goto('/');
    await page.getByRole('button', { name: 'Pausar animação do fundo', exact: true }).click();
    await expect(page.locator('[data-fundo-video]')).not.toHaveAttribute('data-tocando');
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; } .wo-whatsapp-flutuante { visibility: hidden !important; }' });
  });

  for (const frente of ['atendimento', 'saas']) {
    test(`com a seção fora da janela, no capítulo ${frente}, a janela sai igual com e sem o recorte`, async ({ page }, info) => {
      await rolarProgresso(page, frente, 0.2);
      await expect(page.locator(`[data-cena="${frente}"]`)).toHaveAttribute('data-ativa');
      expect(await page.locator('[data-palco] + section').evaluate((secao) => secao.getBoundingClientRect().top > innerHeight), 'a seção depois do palco está fora da janela').toBe(true);
      const comRecorte = await page.screenshot({ scale: 'css' });
      await page.addStyleTag({ content: '[data-palco-modo="fundo"] .wo-home-cena { clip-path: none !important; }' });
      const semRecorte = await page.screenshot({ scale: 'css' });
      await info.attach('com-recorte.png', { body: comRecorte, contentType: 'image/png' });
      await info.attach('sem-recorte.png', { body: semRecorte, contentType: 'image/png' });
      expect(comRecorte.equals(semRecorte), 'o recorte muda a cena com a seção longe: o halo termina numa borda reta').toBe(true);
    });
  }

  test('com a seção dentro da janela e abaixo da cena, nada acima do alto dela muda', async ({ page }, info) => {
    // O alto da seção fica no meio do caminho entre o fim da caixa da cena e o fim da janela.
    await page.locator('[data-palco] + section').evaluate((secao) => {
      const cena = document.querySelector('[data-cena="saas"]');
      if (!cena) throw new Error('cena saas não encontrada');
      const alvo = (cena.getBoundingClientRect().bottom + innerHeight) / 2;
      scrollTo({ top: Math.round(scrollY + secao.getBoundingClientRect().top - alvo), behavior: 'instant' });
    });
    await quadro(page);
    await expect(page.locator('[data-cena="saas"]')).toHaveAttribute('data-ativa');
    const medida = await page.locator('[data-palco] + section').evaluate((secao) => ({
      alto: secao.getBoundingClientRect().top,
      fimDaCena: document.querySelector('[data-cena="saas"]')?.getBoundingClientRect().bottom ?? 0,
      largura: document.documentElement.clientWidth,
    }));
    expect(medida.alto, 'o alto da seção fica abaixo da caixa da cena').toBeGreaterThan(medida.fimDaCena);
    expect(medida.alto, 'o alto da seção fica dentro da janela').toBeLessThan(page.viewportSize()?.height ?? 0);
    // Uma linha de folga acima do alto da seção, onde o arredondamento do corte pode cair.
    const acima = { x: 0, y: 0, width: medida.largura, height: Math.floor(medida.alto) - 1 };
    const comRecorte = await page.screenshot({ clip: acima, scale: 'css' });
    await page.addStyleTag({ content: '[data-palco-modo="fundo"] .wo-home-cena { clip-path: inset(-100vmax) !important; }' });
    const aberto = await page.screenshot({ clip: acima, scale: 'css' });
    await info.attach('com-recorte.png', { body: comRecorte, contentType: 'image/png' });
    await info.attach('recorte-aberto.png', { body: aberto, contentType: 'image/png' });
    expect(comRecorte.equals(aberto), `acima de y ${acima.height} o recorte muda a cena: o halo termina numa borda reta`).toBe(true);
  });
});

/* A cena ativa cabe inteira na área útil: abaixo do topo fixo, acima do fim da janela, dentro da
   largura e fora do painel. "Corpo da cena" é a tela desenhada; título e aviso ficam no canto dela. */
const JANELAS = [
  { width: 1440, height: 900, projeto: 'desktop' },
  { width: 1280, height: 650, projeto: 'desktop' },
  { width: 390, height: 844, projeto: 'celular' },
  { width: 360, height: 640, projeto: 'celular' },
];

for (const { projeto, ...janela } of JANELAS) {
  test.describe(`em ${janela.width} x ${janela.height}`, () => {
    test.use({ viewport: janela });

    test('a cena ativa cabe na área útil', async ({ page }, info) => {
      test.skip(info.project.name !== projeto, `essa janela roda no projeto ${projeto}`);
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await rolarProgresso(page, 'atendimento', 1);
      await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
      await semTransicao(page);
      const medidas = await page.evaluate(() => {
        const caixa = (seletor: string) => {
          const elemento = document.querySelector(seletor);
          if (!elemento) throw new Error(`${seletor} não encontrado`);
          const { top, bottom, left, right } = elemento.getBoundingClientRect();
          return { top, bottom, left, right };
        };
        // O topo vira fixo na Tarefa 3; até lá, a área útil já desconta a altura dele.
        const topoFixo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wo-topo-altura'));
        return {
          corpo: caixa('[data-cena="atendimento"][data-ativa] .wo-home-cena__tela'),
          painel: caixa('[data-frente="atendimento"][data-ativa] .wo-home-painel'),
          fimDoTopo: Math.max(caixa('.wo-topo').bottom, topoFixo),
          largura: document.documentElement.clientWidth,
          altura: innerHeight,
        };
      });
      const { corpo, painel } = medidas;
      expect(corpo.top).toBeGreaterThanOrEqual(medidas.fimDoTopo);
      expect(corpo.bottom).toBeLessThanOrEqual(medidas.altura);
      expect(corpo.left).toBeGreaterThanOrEqual(0);
      expect(corpo.right).toBeLessThanOrEqual(medidas.largura);
      const cruza = corpo.left < painel.right && corpo.right > painel.left && corpo.top < painel.bottom && corpo.bottom > painel.top;
      expect(cruza, `corpo ${JSON.stringify(corpo)} e painel ${JSON.stringify(painel)}`).toBe(false);
    });
  });
}

/* Celular (spec 13.3, ajuste de 16/10): a cena fica centrada na área livre entre o topo fixo e o
   painel do capítulo da vez, o painel é compacto e só o do capítulo da vez aparece. */
for (const janela of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test.describe(`celular em ${janela.width} x ${janela.height}`, () => {
    test.use({ viewport: janela });
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== 'celular', 'o layout do celular roda no projeto celular');
    });

    test('a cena fica centrada na área livre entre o topo e o painel', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await rolarProgresso(page, 'atendimento', 1);
      await expect.poll(() => montadas(page, 'atendimento')).toBe(6);
      await semTransicao(page);
      const folgas = await page.evaluate(() => {
        const caixa = (seletor: string) => {
          const elemento = document.querySelector(seletor);
          if (!elemento) throw new Error(`${seletor} não encontrado`);
          return elemento.getBoundingClientRect();
        };
        const topoFixo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wo-topo-altura'));
        const corpo = caixa('[data-cena="atendimento"][data-ativa] .wo-home-cena__tela');
        const painel = caixa('[data-frente="atendimento"][data-ativa] .wo-home-painel');
        const inicio = Math.max(caixa('.wo-topo').bottom, topoFixo) + 16;
        return { acima: corpo.top - inicio, abaixo: painel.top - 16 - corpo.bottom };
      });
      expect(Math.abs(folgas.acima - folgas.abaixo), JSON.stringify(folgas)).toBeLessThanOrEqual(24);
    });

    test('só o painel do capítulo ativo aparece e recebe ponteiro', async ({ page }) => {
      await page.goto('/');
      await rolarProgresso(page, 'atendimento', 0.5);
      await expect(page.locator('[data-frente="atendimento"]')).toHaveAttribute('data-ativa');
      await semTransicao(page);
      const paineis = await page.locator('.wo-home-painel').evaluateAll((lista) =>
        lista.map((painel) => `${getComputedStyle(painel).opacity} ${getComputedStyle(painel).pointerEvents}`),
      );
      expect(paineis).toEqual(['1 auto', '0 none', '0 none', '0 none', '0 none']);
    });
  });
}

test.describe('celular em 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('o painel ativo ocupa no máximo 32% da altura da janela', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'o layout do celular roda no projeto celular');
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await rolarProgresso(page, 'atendimento', 0.5);
    await semTransicao(page);
    const altura = await page.locator('[data-frente="atendimento"][data-ativa] .wo-home-painel').evaluate((painel) => painel.getBoundingClientRect().height);
    expect(altura).toBeLessThanOrEqual(0.32 * 844);
  });
});

/* No instante em que o capítulo 1 liga, o texto da abertura já saiu do lugar da cena, mesmo em
   tela baixa. */
for (const janela of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
]) {
  test.describe(`celular em ${janela.width} x ${janela.height}, na entrada do capítulo 1`, () => {
    test.use({ viewport: janela });

    test('o link da abertura não cruza a cena', async ({ page }, info) => {
      test.skip(info.project.name !== 'celular', 'o layout do celular roda no projeto celular');
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await rolarProgresso(page, 'atendimento', 0);
      await expect(page.locator('[data-cena="atendimento"]')).toHaveAttribute('data-ativa');
      const caixas = await page.evaluate(() => {
        const caixa = (seletor: string) => {
          const elemento = document.querySelector(seletor);
          if (!elemento) throw new Error(`${seletor} não encontrado`);
          const { top, bottom, left, right } = elemento.getBoundingClientRect();
          return { top, bottom, left, right };
        };
        return { link: caixa('.wo-home-frentes__link'), cena: caixa('[data-cena="atendimento"]') };
      });
      const { link, cena } = caixas;
      const cruza = link.left < cena.right && link.right > cena.left && link.top < cena.bottom && link.bottom > cena.top;
      expect(cruza, JSON.stringify(caixas)).toBe(false);
    });
  });
}

test.describe('com menos movimento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('palco desligado e tudo montado', async ({ page }) => {
    await page.goto('/');
    await quadro(page);
    await expect(page.locator('[data-palco]')).not.toHaveAttribute('data-palco-modo');
    expect(await page.locator('[data-cena] [data-passo]').count()).toBeGreaterThanOrEqual(6);
    expect(await pecasApagadas(page)).toBe(0);
  });
});
