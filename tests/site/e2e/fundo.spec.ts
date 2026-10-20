import { test, expect, type Page } from '@playwright/test';
import { varrerContraste } from './helpers/contraste';
import paginasJson from '../../../dev/site/paginas.json' with { type: 'json' };

/* Fundo vivo no site inteiro (spec 15, D20). Toda página tem o fundo fixo da Home: o pôster e o
   vídeo da onda num bloco escondido do leitor de tela, primeiro filho do <main>. O vídeo toca em
   qualquer ponto da página enquanto a aba está visível, também com um capítulo do palco da Home
   ativo. O botão do topo pausa, e a pausa vale para as outras páginas da mesma visita. Menos
   movimento, economia de dados e falta de JavaScript deixam só o pôster. O topo fica escuro do
   início ao fim, e o hero de toda página entra em cascata ao abrir. */

const PAGINAS = paginasJson.paginas;
const PAUSA = 'Pausar animação do fundo';
/** Chave em que o fundo.js guarda o estado do botão na visita (sessionStorage). */
const CHAVE_PAUSA = 'waveops:fundo-pausado';

/** Junta os erros de console e de página: nenhum teste do fundo passa com erro escondido. */
function vigiarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on('console', (mensagem) => { if (mensagem.type() === 'error') erros.push(mensagem.text()); });
  page.on('pageerror', (erro) => erros.push(erro.message));
  return erros;
}

const video = (page: Page) => page.locator('[data-fundo-video]');
const poster = (page: Page) => page.locator('.wo-fundo__poster');
const botaoDePausa = (page: Page) => page.getByRole('button', { name: PAUSA, exact: true });

/** O vídeo avança: o tempo muda entre duas leituras (o laço volta a zero, então não basta "maior"). */
async function esperarAvancar(page: Page) {
  const antes = await video(page).evaluate((elemento: HTMLVideoElement) => elemento.currentTime);
  await expect.poll(() => video(page).evaluate((elemento: HTMLVideoElement) => elemento.currentTime)).not.toBe(antes);
}

/** Só o pôster: o vídeo nunca recebeu fonte, fica transparente e o botão do topo some. */
async function soOPoster(page: Page, contexto: string) {
  await page.waitForLoadState('load');
  await expect(video(page), contexto).toHaveJSProperty('currentSrc', '');
  await expect(video(page), contexto).toHaveCSS('opacity', '0');
  await expect(poster(page), contexto).toHaveCSS('opacity', '1');
  await expect(poster(page), contexto).toHaveJSProperty('complete', true);
  await expect(page.locator('[data-fundo-pausa]'), contexto).toBeHidden();
}

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

test.describe('o bloco do fundo', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const pagina of PAGINAS) {
    test(`${pagina.url}: é o primeiro filho do main, fixo atrás de tudo, cobre a janela e mostra o pôster`, async ({ page }) => {
      await page.goto(pagina.url);
      const fundo = page.locator('main > .wo-fundo');
      await expect(fundo).toHaveCount(1);
      await expect(fundo).toHaveAttribute('aria-hidden', 'true');
      expect(await page.evaluate(() => document.querySelector('main')?.firstElementChild?.classList.contains('wo-fundo'))).toBe(true);
      await expect(poster(page)).toHaveJSProperty('complete', true);
      expect(await poster(page).evaluate((imagem: HTMLImageElement) => imagem.naturalWidth)).toBeGreaterThan(0);
      await expect(poster(page)).toHaveCSS('opacity', '1');
      const medir = () => fundo.evaluate((elemento) => {
        const estilo = getComputedStyle(elemento);
        const caixa = elemento.getBoundingClientRect();
        return {
          posicao: estilo.position,
          camada: estilo.zIndex,
          caixa: [caixa.x, caixa.y, caixa.width, caixa.height].map(Math.round),
          janela: [0, 0, document.documentElement.clientWidth, innerHeight],
        };
      });
      const noAlto = await medir();
      expect(noAlto.posicao).toBe('fixed');
      expect(noAlto.camada).toBe('-1');
      expect(noAlto.caixa).toEqual(noAlto.janela);
      // Rolada até o fim, a onda continua atrás da janela inteira (do topo ao rodapé).
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      const noFim = await medir();
      expect(noFim.caixa).toEqual(noFim.janela);
    });
  }
});

test.describe('com movimento liberado', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const pagina of PAGINAS) {
    test(`${pagina.url}: o vídeo toca e continua tocando com a página rolada até a metade`, async ({ page }) => {
      const erros = vigiarErros(page);
      await page.goto(pagina.url);
      await expect(video(page)).toHaveJSProperty('paused', false);
      await expect(video(page)).toHaveAttribute('data-tocando', '');
      const { caminho, largura } = await video(page).evaluate((elemento: HTMLVideoElement) => ({ caminho: new URL(elemento.currentSrc).pathname, largura: innerWidth }));
      expect(caminho).toBe(`/assets/site/video/onda-${largura > 1280 ? 1920 : 1280}.webm`);
      await expect(botaoDePausa(page)).toBeVisible();
      await page.evaluate(() => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) / 2, behavior: 'instant' }));
      await esperarAvancar(page);
      await expect(video(page)).toHaveJSProperty('paused', false);
      await expect(video(page)).toHaveAttribute('data-tocando', '');
      await expect(botaoDePausa(page)).toBeVisible();
      expect(erros).toEqual([]);
    });
  }

  test('o botão do topo pausa e devolve o pôster, e a página seguinte da visita já nasce pausada', async ({ page }) => {
    const erros = vigiarErros(page);
    await page.goto('/');
    await expect(video(page)).toHaveAttribute('data-tocando', '');
    await botaoDePausa(page).click();
    await expect(botaoDePausa(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(video(page)).toHaveJSProperty('paused', true);
    await expect(video(page)).not.toHaveAttribute('data-tocando');
    await expect(video(page)).toHaveCSS('opacity', '0');
    await expect(poster(page)).toHaveCSS('opacity', '1');

    // Outra página da mesma visita nasce pausada: nem baixa o vídeo.
    await page.goto('/solucoes/');
    await expect(botaoDePausa(page)).toBeVisible();
    await expect(botaoDePausa(page)).toHaveAttribute('aria-pressed', 'true');
    await page.waitForLoadState('load');
    await page.evaluate(() => new Promise<void>((pronto) => setTimeout(pronto, 300)));
    await expect(video(page)).toHaveJSProperty('paused', true);
    await expect(video(page)).toHaveJSProperty('currentSrc', '');
    await expect(poster(page)).toHaveCSS('opacity', '1');

    // Retomar também vale para a visita.
    await botaoDePausa(page).click();
    await expect(botaoDePausa(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(video(page)).toHaveAttribute('data-tocando', '');
    await page.goto('/projetos-sob-medida/');
    await expect(botaoDePausa(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(video(page)).toHaveAttribute('data-tocando', '');
    expect(erros).toEqual([]);
  });

  test('a página que volta do histórico segue a escolha feita em outra página', async ({ page }) => {
    await page.goto('/contato/');
    await expect(video(page)).toHaveAttribute('data-tocando', '');
    // A volta pelo cache do histórico devolve a página como estava; a escolha feita em outra página
    // da visita chega pelo sessionStorage no pageshow (o Chromium do Playwright desliga esse cache, por
    // isso o evento é disparado aqui).
    const voltar = (pausado: boolean) => page.evaluate(({ chave, pausado }) => {
      if (pausado) sessionStorage.setItem(chave, '1');
      else sessionStorage.removeItem(chave);
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    }, { chave: CHAVE_PAUSA, pausado });
    await voltar(true);
    await expect(botaoDePausa(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(video(page)).toHaveJSProperty('paused', true);
    await voltar(false);
    await expect(botaoDePausa(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(video(page)).toHaveJSProperty('paused', false);
  });

  test('na Home, o vídeo continua tocando com um capítulo do palco ativo, com a onda escurecida', async ({ page }) => {
    const erros = vigiarErros(page);
    await page.goto('/');
    await expect(video(page)).toHaveAttribute('data-tocando', '');
    await expect(page.locator('[data-palco]')).toHaveAttribute('data-palco-modo', 'fundo');
    await rolarCapitulo(page, 'agentes', 0.5);
    await expect(page.locator('.wo-fundo')).toHaveAttribute('data-capitulo', 'agentes');
    await esperarAvancar(page);
    await expect(video(page)).toHaveJSProperty('paused', false);
    // A onda que aparece é o vídeo a 35%; o pôster sai de baixo dele.
    await expect(video(page)).toHaveCSS('opacity', '0.35');
    await expect(poster(page)).toHaveCSS('opacity', '0');
    expect(erros).toEqual([]);
  });
});

test.describe('só o pôster', () => {
  test('com menos movimento, em toda página', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const pagina of PAGINAS) {
      await page.goto(pagina.url);
      await soOPoster(page, pagina.url);
    }
  });

  test('com economia de dados, em toda página', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
    for (const pagina of PAGINAS) {
      await page.goto(pagina.url);
      await soOPoster(page, pagina.url);
    }
  });

  test.describe('sem JavaScript', () => {
    test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });

    test('em toda página', async ({ page }) => {
      for (const pagina of PAGINAS) {
        await page.goto(pagina.url);
        await expect(video(page), pagina.url).not.toHaveAttribute('src');
        await soOPoster(page, pagina.url);
      }
    });
  });
});

test.describe('o topo', () => {
  /** Leitura do topo: fundo, cor, linha de baixo e color-scheme, como o navegador calculou. */
  const lerTopo = (page: Page) => page.locator('.wo-topo').evaluate((topo) => {
    const estilo = getComputedStyle(topo);
    return {
      fundo: estilo.backgroundColor,
      cor: estilo.color,
      linha: estilo.borderBottomColor,
      esquema: estilo.colorScheme,
      menu: estilo.getPropertyValue('--wo-texto-2').trim(),
      estado: topo.getAttribute('data-estado'),
      posicao: estilo.position,
    };
  });
  const ESCURO = {
    fundo: 'rgba(10, 10, 10, 0.84)',
    cor: 'rgb(243, 243, 241)',
    linha: 'rgba(255, 255, 255, 0.15)',
    esquema: 'dark',
    menu: 'rgb(255 255 255 / 0.85)',
    estado: null,
    posicao: 'fixed',
  };

  for (const pagina of PAGINAS) {
    test(`${pagina.url}: fica no estado escuro do início ao fim da página`, async ({ page }) => {
      await page.goto(pagina.url);
      await expect(page.locator('html')).toHaveAttribute('data-topo', 'fixo');
      for (const fracao of [0, 0.5, 1]) {
        await page.evaluate((f) => scrollTo({ top: f * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }), fracao);
        await page.evaluate(() => new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto()))));
        expect(await lerTopo(page), `${pagina.url} rolada a ${fracao * 100}%`).toEqual(ESCURO);
      }
    });
  }
});

/* Anel de foco (WCAG 1.4.11): sobre a onda e os véus ele é o --wo-foco do escuro, branco, com a
   largura e o afastamento de sempre. O contraste do token fica em cores.test.mjs; aqui, que a página
   desenha esse token. O link da primeira seção depois do palco fica sobre o véu. */
test.describe('o anel de foco', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesma regra no desktop e no celular');
  });

  test('é branco sobre o escuro, com 2 px e 2 px de afastamento', async ({ page }) => {
    await page.goto('/');
    const lerAnel = (seletor: string) => page.locator(seletor).first().evaluate((el) => {
      const estilo = getComputedStyle(el);
      return { visivel: el.matches(':focus-visible'), estilo: estilo.outlineStyle, largura: estilo.outlineWidth, afastamento: estilo.outlineOffset, cor: estilo.outlineColor };
    });
    const ANEL = { visivel: true, estilo: 'solid', largura: '2px', afastamento: '2px', cor: 'rgb(255, 255, 255)' };
    // O primeiro Tab da página leva ao "Pular para o conteúdo".
    await page.keyboard.press('Tab');
    expect(await lerAnel('.wo-pular')).toEqual(ANEL);
    await page.locator('[data-palco] + section a').first().focus();
    expect(await lerAnel('[data-palco] + section a')).toEqual(ANEL);
  });
});

/* Entrada em cascata (spec 15.3): ao abrir a página, cada bloco do hero sai de transparente e 16 px
   abaixo para o lugar, em 500 ms, com 70 ms entre um bloco e o seguinte, e tudo acaba antes de 1 s.
   Só no hero, só CSS: acontece igual sem JavaScript e não acontece com menos movimento. */
type Bloco = { n: number; nome: string; atraso: number; duracao: number; preenchimento: string; opacidade: string; noHero: boolean };

function lerBlocos(page: Page): Promise<Bloco[]> {
  return page.locator('[data-entrada]').evaluateAll((elementos) => {
    const hero = document.querySelector('main > section');
    const ms = (valor: string) => Number.parseFloat(valor) * (valor.endsWith('ms') ? 1 : 1000);
    return elementos
      .map((elemento) => {
        const estilo = getComputedStyle(elemento);
        return {
          n: Number((elemento as HTMLElement).dataset.entrada),
          nome: estilo.animationName,
          atraso: Math.round(ms(estilo.animationDelay)),
          duracao: Math.round(ms(estilo.animationDuration)),
          preenchimento: estilo.animationFillMode,
          opacidade: estilo.opacity,
          noHero: Boolean(hero && hero.contains(elemento)),
        };
      })
      .sort((a, b) => a.n - b.n);
  });
}

/** O primeiro quadro de @keyframes wo-entrada: de onde cada bloco parte, com os tokens resolvidos. */
function lerPartida(page: Page) {
  return page.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement);
    const resolver = (valor: string) => valor.replace(/var\((--[\w-]+)\)/g, (_, nome: string) => raiz.getPropertyValue(nome).trim());
    for (const folha of [...document.styleSheets]) {
      for (const regra of [...folha.cssRules]) {
        if (regra instanceof CSSKeyframesRule && regra.name === 'wo-entrada') {
          const primeiro = regra.cssRules[0] as CSSKeyframeRule;
          return { quadro: primeiro.keyText, opacidade: resolver(primeiro.style.opacity), transformacao: resolver(primeiro.style.transform) };
        }
      }
    }
    return null;
  });
}

function conferirCascata(blocos: Bloco[]) {
  expect(blocos.length, 'blocos do hero com data-entrada').toBeGreaterThanOrEqual(3);
  expect(blocos.every((bloco) => bloco.noHero), 'todo bloco da cascata fica no hero').toBe(true);
  expect(blocos.map((bloco) => bloco.nome)).toEqual(blocos.map(() => 'wo-entrada'));
  expect(blocos.map((bloco) => bloco.atraso)).toEqual(blocos.map((_, i) => i * 70));
  expect(blocos.map((bloco) => bloco.duracao)).toEqual(blocos.map(() => 500));
  expect(blocos.map((bloco) => bloco.preenchimento)).toEqual(blocos.map(() => 'backwards'));
  expect(Math.max(...blocos.map((bloco) => bloco.atraso + bloco.duracao)), 'fim da cascata em ms').toBeLessThan(1000);
}

test.describe('entrada em cascata do hero', () => {
  test.describe('com movimento liberado', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('parte de transparente e 16 px abaixo', async ({ page }) => {
      await page.goto('/');
      expect(await lerPartida(page)).toEqual({ quadro: '0%', opacidade: '0', transformacao: 'translateY(16px)' });
    });

    for (const pagina of PAGINAS) {
      test(`${pagina.url}: cada bloco entra 70 ms depois do anterior e tudo acaba antes de 1 s`, async ({ page }) => {
        await page.goto(pagina.url);
        conferirCascata(await lerBlocos(page));
      });
    }
  });

  test.describe('com menos movimento', () => {
    test.use({ reducedMotion: 'reduce' });

    for (const pagina of PAGINAS) {
      test(`${pagina.url}: nenhum bloco anima e todos nascem no lugar`, async ({ page }) => {
        await page.goto(pagina.url, { waitUntil: 'domcontentloaded' });
        const blocos = await lerBlocos(page);
        expect(blocos.length).toBeGreaterThanOrEqual(3);
        expect(blocos.map((bloco) => [bloco.nome, bloco.opacidade])).toEqual(blocos.map(() => ['none', '1']));
        expect(await page.evaluate(() => document.getAnimations().filter((animacao) => (animacao as CSSAnimation).animationName === 'wo-entrada').length)).toBe(0);
      });
    }
  });

  test.describe('sem JavaScript', () => {
    test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });

    for (const pagina of PAGINAS) {
      test(`${pagina.url}: a cascata acontece igual`, async ({ page }) => {
        await page.goto(pagina.url);
        conferirCascata(await lerBlocos(page));
      });
    }
  });
});

/* A Home tem o palco entre o hero e as seções com véu: o trecho medido depois do hero é o palco
   inteiro (com menos movimento, cada capítulo vira uma faixa com o painel e a cena montada) e a
   primeira seção depois dele, onde o véu começa. Em Projetos sob medida, a seção das frentes. */
const VARREDURAS: { url: string; trechos: string[] }[] = [
  { url: '/', trechos: ['[data-hero]', '[data-palco]', '[data-palco] + section'] },
  { url: '/projetos-sob-medida/', trechos: ['main > section:first-of-type', 'main > section:first-of-type + section'] },
];

test.describe('contraste do texto sobre o fundo vivo', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop e celular cobrem as duas grades');
  });

  for (const { url, trechos } of VARREDURAS) {
    test(`${url}: todo texto do hero e da seção seguinte mantém o contraste AA durante a rolagem`, async ({ page }) => {
      test.setTimeout(240_000);
      const medidos = await varrerContraste(page, url, trechos);
      const semPasso = medidos.filter((alvo) => alvo.passos < 3).map((alvo) => `"${alvo.texto}" (${alvo.trecho}): ${alvo.passos} passos`);
      expect(semPasso, 'textos medidos em menos de 3 passos').toEqual([]);
      const abaixo = medidos
        .filter((alvo) => alvo.pior && alvo.pior.razao < alvo.minimo)
        .map((alvo) => `"${alvo.texto}" (${alvo.trecho}), ${alvo.cor} sobre rgb(${alvo.pior!.fundo.join(', ')}) na rolagem de ${alvo.pior!.rolagem} px: ${alvo.pior!.razao.toFixed(2)}:1`);
      expect(abaixo).toEqual([]);
    });
  }
});
