import { test, expect, type Page } from '@playwright/test';
import { lerPng } from './helpers/contraste';

/* Vitrine do hero da Home (adendo 1 da 13A): o cartão claro "Operação conectada" passa pelas cinco
   frentes sozinho, uma mini interface por vez, com abas e barra de progresso. Para com o botão
   "Pausar animação" do rodapé, com o ponteiro sobre o cartão, com foco dentro dele e com a aba do
   navegador oculta (WCAG 2.2.2). Menos movimento: nada troca sozinho. Sem JavaScript: a primeira
   frente inteira. Os testes encurtam a barra para não esperar 4,5 s por frente. */
const FRENTES = ['Automação de atendimento', 'Agentes de IA', 'Painéis de gestão', 'CRMs sob medida', 'Apps e sistemas'];
const CURTA = 600;

const vitrine = (page: Page) => page.locator('[data-vitrine]');
const aba = (page: Page, n: number) => vitrine(page).getByRole('button', { name: new RegExp(`^0${n} `) });
/** Nome da frente na tela: o do painel visível. */
const frenteNaTela = (page: Page) => vitrine(page).locator('[data-ativo] .wo-vitrine__nome');

async function abrir(page: Page) {
  // A vitrine é medida como na página seguinte da visita: na primeira, a entrada do site (Tarefa 13B,
  // teste próprio em chegada.spec.ts) cobre a tela por 1,45 s enquanto a vitrine já troca por baixo.
  await page.addInitScript(() => sessionStorage.setItem('waveops:chegada', '1'));
  await page.goto('/');
  await page.addStyleTag({ content: `.wo-vitrine__aba i::after { animation-duration: ${CURTA}ms !important; }` });
  await expect(vitrine(page)).toHaveAttribute('data-pronto', '');
  await page.mouse.move(1, 1);
}

/** A frente da tela continua a mesma por mais de duas barras inteiras. Lê a frente a cada 100 ms,
    sem nova tentativa: uma volta inteira da vitrine (5 barras) não pode passar por parada. */
async function ficaParada(page: Page, nome: string) {
  const vistas = await page.evaluate(async (duracao) => {
    const lidas = new Set<string>();
    const fim = performance.now() + duracao;
    while (performance.now() < fim) {
      lidas.add(document.querySelector('[data-vitrine] [data-ativo] .wo-vitrine__nome')?.textContent ?? '');
      await new Promise((pronto) => setTimeout(pronto, 100));
    }
    return [...lidas];
  }, CURTA * 2.5);
  expect(vistas).toEqual([nome]);
}

/** Confirma que o cartão está no estado pedido (`:hover` ou `:focus-within`) e que a barra da aba da
    vez parou, e só então devolve a frente da tela. */
async function frenteComPausa(page: Page, estado: string) {
  await expect.poll(() => vitrine(page).evaluate((v, e) => v.matches(e), estado), `${estado} no cartão`).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const barras = document.getAnimations().filter((a) => a instanceof CSSAnimation && a.animationName === 'wo-vitrine-avanco');
    return barras.length > 0 && barras.every((a) => a.playState === 'paused');
  }), `barra parada com ${estado}`).toBe(true);
  // Dois quadros: uma troca que já estava na fila (animationend) acontece antes da leitura.
  return page.evaluate(() => new Promise<string>((pronto) => requestAnimationFrame(() => requestAnimationFrame(() =>
    pronto(document.querySelector('[data-vitrine] [data-ativo] .wo-vitrine__nome')?.textContent ?? '')))));
}

test.describe('vitrine com movimento liberado', () => {
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmo cartão no desktop e no celular');
  });

  test('a troca automática avança na ordem e dá a volta', async ({ page }) => {
    await abrir(page);
    await expect(frenteNaTela(page)).toHaveText(FRENTES[0]!);
    for (const nome of [...FRENTES.slice(1), FRENTES[0]!]) {
      await expect(frenteNaTela(page)).toHaveText(nome, { timeout: CURTA * 4 });
    }
    await expect(vitrine(page).locator('[data-ativo]')).toHaveCount(1);
    await expect(vitrine(page).locator('[aria-pressed="true"]')).toHaveCount(1);
  });

  test('para com o botão "Pausar animação" do rodapé e volta quando ele solta', async ({ page }) => {
    await abrir(page);
    const pausa = page.getByRole('button', { name: 'Pausar animação', exact: true });
    await pausa.click();
    await expect(pausa).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    const nome = (await frenteNaTela(page).textContent()) ?? '';
    await ficaParada(page, nome);
    await pausa.click();
    await expect(pausa).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(1, 1);
    await expect(frenteNaTela(page)).not.toHaveText(nome, { timeout: CURTA * 4 });
  });

  /* A frente esperada só é lida depois de a pausa valer: no runner lento do CI a barra encurtada pode
     terminar entre abrir a página e o ponteiro chegar, e a frente já não é mais a primeira (falha do
     PR #111, reproduzida com a CPU 6 vezes mais lenta). Se a pausa não vale, o poll estoura. */
  test('para com o ponteiro sobre o cartão e com o foco dentro dele', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'ponteiro de mouse');
    await abrir(page);
    await vitrine(page).hover();
    const comPonteiro = await frenteComPausa(page, ':hover');
    await ficaParada(page, comPonteiro);
    await page.mouse.move(1, 1);
    await expect(frenteNaTela(page), 'a troca volta quando o ponteiro sai').not.toHaveText(comPonteiro, { timeout: CURTA * 4 });
    await aba(page, 2).focus();
    const comFoco = await frenteComPausa(page, ':focus-within');
    await ficaParada(page, comFoco);
  });

  test('para com a aba do navegador oculta', async ({ page }) => {
    await abrir(page);
    const visibilidade = (estado: string) => page.evaluate((valor) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: valor });
      document.dispatchEvent(new Event('visibilitychange'));
    }, estado);
    await visibilidade('hidden');
    await expect(vitrine(page)).toHaveAttribute('data-oculta', '');
    const nome = (await frenteNaTela(page).textContent()) ?? '';
    await ficaParada(page, nome);
    await visibilidade('visible');
    await expect(frenteNaTela(page)).not.toHaveText(nome, { timeout: CURTA * 4 });
  });

  /* Padrão de carrossel do APG (13A, M3): escolher uma aba, com o ponteiro ou o teclado, encerra a
     troca automática nesta visita da página, mesmo com ponteiro e foco fora do cartão. */
  test('escolher uma aba encerra a troca automática', async ({ page }) => {
    await abrir(page);
    const soltar = async () => {
      await page.mouse.move(1, 1);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    };
    await aba(page, 3).click();
    await soltar();
    await expect(frenteNaTela(page)).toHaveText(FRENTES[2]!);
    await ficaParada(page, FRENTES[2]!);
    await aba(page, 4).focus();
    await page.keyboard.press('Enter');
    await soltar();
    await expect(aba(page, 4)).toHaveAttribute('aria-pressed', 'true');
    await ficaParada(page, FRENTES[3]!);
  });
});

/* O botão flutuante de WhatsApp fica fixo no canto inferior direito. No celular a fileira de abas
   reserva a coluna dele: nenhuma aba passa por baixo do botão, no primeiro quadro nem com a fileira
   na altura dele, e cada aba mantém o alvo de 44 px (13A, M7). */
for (const janela of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test.describe(`abas e WhatsApp em ${janela.width} x ${janela.height}`, () => {
    test.use({ viewport: janela, reducedMotion: 'reduce' });

    test('nenhuma aba fica sob o botão flutuante de WhatsApp', async ({ page }, info) => {
      test.skip(info.project.name !== 'celular', 'layout do celular');
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.wo-whatsapp-flutuante')).toBeVisible();
      for (const quadro of ['primeiro quadro', 'abas na altura do botão']) {
        if (quadro !== 'primeiro quadro') {
          await page.evaluate(() => {
            const abas = document.querySelector('.wo-vitrine__abas')!.getBoundingClientRect();
            const botao = document.querySelector('.wo-whatsapp-flutuante')!.getBoundingClientRect();
            scrollTo({ top: scrollY + (abas.top + abas.height / 2) - (botao.top + botao.height / 2), behavior: 'instant' });
          });
        }
        const medidas = await page.evaluate(() => {
          const botao = document.querySelector('.wo-whatsapp-flutuante')!.getBoundingClientRect();
          return [...document.querySelectorAll('.wo-vitrine__aba')].map((aba) => {
            const r = aba.getBoundingClientRect();
            const naJanela = r.top >= 0 && r.bottom <= innerHeight;
            return {
              cruza: r.left < botao.right && r.right > botao.left && r.top < botao.bottom && r.bottom > botao.top,
              livre: !naJanela || aba.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
              largura: r.width,
              altura: r.height,
            };
          });
        });
        medidas.forEach((m, i) => {
          expect(m.cruza, `aba 0${i + 1}, ${quadro}`).toBe(false);
          expect(m.livre, `aba 0${i + 1}, ${quadro}`).toBe(true);
          expect(Math.min(m.largura, m.altura), `alvo da aba 0${i + 1}`).toBeGreaterThanOrEqual(44);
        });
      }
    });
  });
}

test.describe('vitrine com menos movimento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nada troca sozinho, e as abas trocam pelo teclado, com alvo de 44 px', async ({ page }, info) => {
    await abrir(page);
    await ficaParada(page, FRENTES[0]!);
    for (let n = 1; n <= 5; n += 1) {
      const botao = aba(page, n);
      await botao.focus();
      await page.keyboard.press(n % 2 ? 'Enter' : 'Space');
      await expect(botao).toHaveAttribute('aria-pressed', 'true');
      await expect(botao).toHaveAccessibleName(`0${n} ${FRENTES[n - 1]}`);
      await expect(frenteNaTela(page)).toHaveText(FRENTES[n - 1]!);
      await expect(vitrine(page).locator('.wo-vitrine__painel:not([data-ativo])').first()).toBeHidden();
      const caixa = (await botao.boundingBox())!;
      if (info.project.name !== 'desktop') expect(caixa.height).toBeGreaterThanOrEqual(44);
    }
    await expect(aba(page, 5)).toHaveCSS('outline-style', 'solid');
    await ficaParada(page, FRENTES[4]!);
  });

  /* Contraste lido nos pixels, frente por frente: cada texto escondido (visibility: hidden, que leva o
     fundo próprio dele), o cartão capturado e o pior pixel atrás dos glifos comparado com a cor. */
  test('o texto de cada frente mantém contraste AA no cartão claro', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop e celular cobrem as duas grades');
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // O botão flutuante de WhatsApp passa por cima do cartão no celular e não é fundo: sai da captura.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; } .wo-whatsapp-flutuante { visibility: hidden !important; }' });
    const abaixo: string[] = [];
    let medidos = 0;
    for (let n = 1; n <= 5; n += 1) {
      await aba(page, n).click();
      await page.mouse.move(1, 1);
      const alvos = await page.evaluate(() => {
        const cartao = document.querySelector('[data-vitrine]')!;
        const lista: { texto: string; cor: string; minimo: number; retangulos: { x: number; y: number; w: number; h: number }[] }[] = [];
        for (const el of cartao.querySelectorAll<HTMLElement>('*')) {
          if (el.closest('.wo-oculto')) continue;
          const nos = [...el.childNodes].filter((no) => no.nodeType === Node.TEXT_NODE && (no.textContent ?? '').trim());
          const estilo = getComputedStyle(el);
          if (!nos.length || estilo.visibility !== 'visible' || !el.getClientRects().length) continue;
          const retangulos = nos.flatMap((no) => { const r = document.createRange(); r.selectNodeContents(no); return [...r.getClientRects()].map((c) => ({ x: c.x, y: c.y, w: c.width, h: c.height })); });
          const tamanho = parseFloat(estilo.fontSize);
          const minimo = tamanho >= 24 || (tamanho >= 18.66 && parseFloat(estilo.fontWeight) >= 700) ? 3 : 4.5;
          lista.push({ texto: (el.textContent ?? '').trim().slice(0, 40), cor: estilo.color, minimo, retangulos });
          el.dataset.medirVitrine = '';
        }
        for (const el of cartao.querySelectorAll<HTMLElement>('[data-medir-vitrine]')) el.style.setProperty('visibility', 'hidden', 'important');
        return lista;
      });
      const caixa = (await vitrine(page).boundingBox())!;
      const { largura, rgba } = lerPng(await page.screenshot({ clip: caixa, scale: 'css' }));
      const linear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      const luz = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      for (const alvo of alvos) {
        const [r = 0, g = 0, b = 0] = (alvo.cor.match(/[\d.]+/g) ?? []).map(Number);
        const luzTexto = luz(r, g, b);
        let pior = Infinity;
        for (const q of alvo.retangulos) {
          for (let y = Math.max(0, Math.floor(q.y - caixa.y)); y < Math.min(caixa.height, Math.ceil(q.y + q.h - caixa.y)); y += 1) {
            for (let x = Math.max(0, Math.floor(q.x - caixa.x)); x < Math.min(largura, Math.ceil(q.x + q.w - caixa.x)); x += 1) {
              const i = (y * largura + x) * 4;
              const fundo = luz(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
              pior = Math.min(pior, (Math.max(fundo, luzTexto) + 0.05) / (Math.min(fundo, luzTexto) + 0.05));
            }
          }
        }
        medidos += 1;
        if (pior < alvo.minimo) abaixo.push(`frente ${n}: "${alvo.texto}" ${alvo.cor} ${pior.toFixed(2)}:1`);
      }
      await page.evaluate(() => { for (const el of document.querySelectorAll<HTMLElement>('[data-medir-vitrine]')) { el.style.removeProperty('visibility'); delete el.dataset.medirVitrine; } });
    }
    expect(medidos, 'textos medidos nas cinco frentes').toBeGreaterThan(60);
    expect(abaixo).toEqual([]);
  });
});

test.describe('vitrine sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('mostra a primeira frente inteira, sem abas', async ({ page }) => {
    await page.goto('/');
    await expect(vitrine(page).locator('.wo-maquete__aviso')).toHaveText('Fluxo ilustrativo');
    await expect(frenteNaTela(page)).toHaveText(FRENTES[0]!);
    await expect(frenteNaTela(page)).toBeVisible();
    await expect(vitrine(page).getByText('Olá! Quero um orçamento para o meu pedido.')).toBeVisible();
    await expect(vitrine(page).getByRole('button')).toHaveCount(0);
    await expect(vitrine(page).locator('.wo-vitrine__nome:visible')).toHaveCount(1);
  });
});
