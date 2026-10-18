import { test, expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';
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
    fundo: 'rgba(0, 0, 0, 0)',
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

/* Contraste do texto sobre o fundo vivo (spec 15.5). O axe não mede texto sobre imagem nem sobre
   vídeo (marca como incompleto), então a medida é feita na mão: o fundo é fixo e o texto sobe por
   cima dele quando a página rola, e o teste rola de 12 px em 12 px, com o texto escondido
   (visibility: hidden, que também leva o fundo próprio do elemento: o pior caso), do momento em que
   o trecho entra na janela até ele passar inteiro por baixo do topo. A cada passo, para cada texto,
   acha o pixel mais claro e o mais escuro atrás dos glifos e exige 4,5:1 da cor do texto contra os
   dois. O passo é menor que a linha de texto mais baixa (14 px), então os retângulos de passos
   vizinhos se encostam e nenhuma altura do fundo fica sem medir. Só o pôster: com menos movimento o
   vídeo nem carrega, e o pôster é o quadro de 0 s. */
const PASSO = 12;
const linear = (canal: number): number => {
  const s = canal / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancia = (r: number, g: number, b: number): number => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const razaoDeContraste = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Pixels RGBA de uma captura PNG do Chromium: 8 bits por canal, sem entrelaçamento, RGB ou RGBA. */
function lerPng(png: Buffer): { largura: number; altura: number; rgba: Uint8Array } {
  let posicao = 8;
  let largura = 0;
  let altura = 0;
  let canais = 0;
  const blocos: Buffer[] = [];
  while (posicao < png.length) {
    const tamanho = png.readUInt32BE(posicao);
    const tipo = png.toString('latin1', posicao + 4, posicao + 8);
    const corpo = png.subarray(posicao + 8, posicao + 8 + tamanho);
    if (tipo === 'IHDR') {
      largura = corpo.readUInt32BE(0);
      altura = corpo.readUInt32BE(4);
      if (corpo[8] !== 8 || corpo[12] !== 0) throw new Error('PNG fora do formato da captura do Chromium');
      canais = corpo[9] === 6 ? 4 : corpo[9] === 2 ? 3 : 0;
      if (!canais) throw new Error(`PNG com tipo de cor ${corpo[9]}`);
    } else if (tipo === 'IDAT') {
      blocos.push(corpo);
    } else if (tipo === 'IEND') {
      break;
    }
    posicao += 12 + tamanho;
  }
  const cru = zlib.inflateSync(Buffer.concat(blocos));
  const linha = largura * canais;
  const rgba = new Uint8Array(largura * altura * 4);
  let anterior = new Uint8Array(linha);
  let atual = new Uint8Array(linha);
  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[y * (linha + 1)];
    const inicio = y * (linha + 1) + 1;
    for (let i = 0; i < linha; i += 1) {
      const bruto = cru[inicio + i]!;
      const a = i >= canais ? atual[i - canais]! : 0;
      const b = anterior[i]!;
      const c = i >= canais ? anterior[i - canais]! : 0;
      let previsto = 0;
      if (filtro === 1) previsto = a;
      else if (filtro === 2) previsto = b;
      else if (filtro === 3) previsto = (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        previsto = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filtro !== 0) throw new Error(`filtro de PNG ${filtro}`);
      atual[i] = (bruto + previsto) & 255;
    }
    for (let x = 0; x < largura; x += 1) {
      const destino = (y * largura + x) * 4;
      rgba[destino] = atual[x * canais]!;
      rgba[destino + 1] = atual[x * canais + 1]!;
      rgba[destino + 2] = atual[x * canais + 2]!;
      rgba[destino + 3] = canais === 4 ? atual[x * canais + 3]! : 255;
    }
    [anterior, atual] = [atual, anterior];
  }
  return { largura, altura, rgba };
}

type Retangulo = { x: number; y: number; w: number; h: number };
type Pior = { razao: number; fundo: number[]; rolagem: number };

/** Mede o texto dos trechos indicados durante a rolagem e devolve o pior caso de cada texto. */
async function varrerContraste(page: Page, url: string, trechos: string[]) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await expect(poster(page)).toHaveJSProperty('complete', true);
  await expect(video(page)).toHaveJSProperty('currentSrc', '');
  // Com menos movimento o CSS põe transition-duration em tudo; sem transição, esconder vale na hora.
  // O botão flutuante passa por cima do texto no canto e não é fundo: sai da captura.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; } .wo-whatsapp-flutuante { visibility: hidden !important; }' });
  const { alvos, faixas, fimDoTopo, altura, largura, maximo } = await page.evaluate((seletores) => {
    const lista: { texto: string; cor: string; trecho: string }[] = [];
    const faixasDeRolagem: [number, number][] = [];
    const topo = document.querySelector('.wo-topo')!.getBoundingClientRect().bottom;
    for (const seletor of seletores) {
      const raiz = document.querySelector(seletor);
      if (!raiz) throw new Error(`trecho ${seletor} não encontrado`);
      const caixa = raiz.getBoundingClientRect();
      faixasDeRolagem.push([Math.max(0, Math.floor(caixa.top + scrollY - innerHeight)), Math.ceil(caixa.bottom + scrollY - topo)]);
      for (const elemento of [raiz, ...raiz.querySelectorAll('*')]) {
        if (!(elemento instanceof HTMLElement) || elemento.closest('.wo-oculto')) continue;
        const temTexto = [...elemento.childNodes].some((no) => no.nodeType === Node.TEXT_NODE && (no.textContent ?? '').trim());
        if (!temTexto || getComputedStyle(elemento).visibility !== 'visible' || !elemento.getClientRects().length) continue;
        elemento.dataset.medir = String(lista.length);
        lista.push({ texto: (elemento.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40), cor: getComputedStyle(elemento).color, trecho: seletor });
      }
    }
    for (const elemento of document.querySelectorAll<HTMLElement>('[data-medir]')) elemento.style.setProperty('visibility', 'hidden', 'important');
    return {
      alvos: lista,
      faixas: faixasDeRolagem,
      fimDoTopo: Math.ceil(topo),
      altura: innerHeight,
      largura: document.documentElement.clientWidth,
      maximo: document.documentElement.scrollHeight - innerHeight,
    };
  }, trechos);
  expect(alvos.length, 'textos medidos').toBeGreaterThan(0);

  /** Rola até `y` e devolve os retângulos dos glifos de cada texto, cortados entre o topo e o fim da janela. */
  const rolarPara = (y: number) => page.evaluate(async ({ y, topo, altura }) => {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise<void>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto())));
    return [...document.querySelectorAll<HTMLElement>('[data-medir]')].map((elemento) => {
      const retangulos: { x: number; y: number; w: number; h: number }[] = [];
      for (const no of elemento.childNodes) {
        if (no.nodeType !== Node.TEXT_NODE || !(no.textContent ?? '').trim()) continue;
        const faixa = document.createRange();
        faixa.selectNodeContents(no);
        for (const r of faixa.getClientRects()) {
          const cima = Math.max(r.top, topo);
          const baixo = Math.min(r.bottom, altura);
          if (r.width > 0 && baixo > cima) retangulos.push({ x: r.left, y: cima, w: r.width, h: baixo - cima });
        }
      }
      return { indice: Number(elemento.dataset.medir), retangulos };
    });
  }, { y, topo: fimDoTopo, altura });

  const piores = new Map<number, Pior>();
  const passos = new Map<number, number>();
  const corDe = alvos.map((alvo) => {
    const [r = 0, g = 0, b = 0, alfa = 1] = (alvo.cor.match(/[\d.]+/g) ?? []).map(Number);
    return { r, g, b, alfa };
  });
  // Faixas de rolagem dos trechos, juntas quando se encostam: cada altura da página é medida uma vez.
  const juntas: [number, number][] = [];
  for (const [de, ate] of [...faixas].sort((a, b) => a[0] - b[0])) {
    const ultima = juntas[juntas.length - 1];
    if (ultima && de <= ultima[1] + PASSO) ultima[1] = Math.max(ultima[1], ate);
    else juntas.push([de, ate]);
  }
  for (const [de, ate] of juntas) {
    const limite = Math.min(ate, maximo);
    for (let rolagem = de; rolagem < limite + PASSO; rolagem += PASSO) {
      const y = Math.min(rolagem, limite);
      const visiveis = (await rolarPara(y)).filter((alvo) => alvo.retangulos.length > 0);
      if (!visiveis.length) continue;
      const recorte = { x: 0, y: fimDoTopo, width: largura, height: altura - fimDoTopo };
      const { largura: lp, altura: ap, rgba } = lerPng(await page.screenshot({ clip: recorte, scale: 'css' }));
      for (const { indice, retangulos } of visiveis) {
        let claro = { luz: -1, rgb: [0, 0, 0] };
        let escuro = { luz: 2, rgb: [0, 0, 0] };
        let pixels = 0;
        for (const r of retangulos as Retangulo[]) {
          const x0 = Math.max(0, Math.floor(r.x - recorte.x));
          const y0 = Math.max(0, Math.floor(r.y - recorte.y));
          const x1 = Math.min(lp, Math.ceil(r.x - recorte.x + r.w));
          const y1 = Math.min(ap, Math.ceil(r.y - recorte.y + r.h));
          for (let py = y0; py < y1; py += 1) {
            for (let px = x0; px < x1; px += 1) {
              const i = (py * lp + px) * 4;
              const rgb = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!];
              const luz = luminancia(rgb[0]!, rgb[1]!, rgb[2]!);
              pixels += 1;
              if (luz > claro.luz) claro = { luz, rgb };
              if (luz < escuro.luz) escuro = { luz, rgb };
            }
          }
        }
        if (!pixels) continue;
        const { r, g, b, alfa } = corDe[indice]!;
        for (const fundo of [claro, escuro]) {
          const composto = [r, g, b].map((canal, k) => canal * alfa + fundo.rgb[k]! * (1 - alfa));
          const razao = razaoDeContraste(luminancia(composto[0]!, composto[1]!, composto[2]!), fundo.luz);
          if (razao < (piores.get(indice)?.razao ?? Infinity)) piores.set(indice, { razao, fundo: fundo.rgb, rolagem: y });
        }
        passos.set(indice, (passos.get(indice) ?? 0) + 1);
      }
    }
  }
  return alvos.map((alvo, indice) => ({ ...alvo, passos: passos.get(indice) ?? 0, pior: piores.get(indice) }));
}

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
    test(`${url}: todo texto do hero e da seção seguinte mantém 4,5:1 durante a rolagem`, async ({ page }) => {
      test.setTimeout(240_000);
      const medidos = await varrerContraste(page, url, trechos);
      const semPasso = medidos.filter((alvo) => alvo.passos < 3).map((alvo) => `"${alvo.texto}" (${alvo.trecho}): ${alvo.passos} passos`);
      expect(semPasso, 'textos medidos em menos de 3 passos').toEqual([]);
      const abaixo = medidos
        .filter((alvo) => alvo.pior && alvo.pior.razao < 4.5)
        .map((alvo) => `"${alvo.texto}" (${alvo.trecho}), ${alvo.cor} sobre rgb(${alvo.pior!.fundo.join(', ')}) na rolagem de ${alvo.pior!.rolagem} px: ${alvo.pior!.razao.toFixed(2)}:1`);
      expect(abaixo).toEqual([]);
    });
  }
});
