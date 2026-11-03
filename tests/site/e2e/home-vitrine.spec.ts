import { test, expect, type Page } from '@playwright/test';
import { lerPng } from './helpers/contraste';

/* Cartão do hero da Home ("Operação conectada", revisão de 02/11/2026): um fluxo só, do lead à
   cobrança, parado. As cinco frentes ficam no palco logo abaixo, então o cartão não tem abas, não
   troca sozinho e não repete nenhuma cena do palco. Com e sem JavaScript, o mesmo quadro. */
const ETAPAS = ['WhatsApp', 'CRM', 'Cobrança'];

const cartao = (page: Page) => page.locator('.wo-vitrine');

async function abrir(page: Page) {
  // Medido como na página seguinte da visita: na primeira, a entrada do site cobre a tela por 1,45 s.
  await page.addInitScript(() => sessionStorage.setItem('waveops:chegada', '1'));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
}

/** Nomes das etapas na ordem em que aparecem no cartão. */
const etapasNaTela = (page: Page) => cartao(page).locator('.wo-home-cena__nome').allInnerTexts();

test.describe('cartão do hero com movimento liberado', () => {
  test.use({ reducedMotion: 'no-preference' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmo cartão no desktop e no celular');
  });

  test('mostra do lead à cobrança num quadro só, sem abas', async ({ page }) => {
    await abrir(page);
    await expect(cartao(page)).toBeVisible();
    expect(await etapasNaTela(page)).toEqual(ETAPAS);
    await expect(cartao(page).getByRole('button')).toHaveCount(0);
    await expect(cartao(page).locator('.wo-maquete__aviso')).toHaveText('Fluxo ilustrativo');
  });
});

test.describe('cartão do hero com menos movimento', () => {
  test.use({ reducedMotion: 'reduce' });

  /* Contraste lido nos pixels: cada texto escondido (visibility: hidden, que leva o fundo próprio
     dele), o cartão capturado e o pior pixel atrás dos glifos comparado com a cor. */
  test('o texto mantém contraste AA no cartão claro', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop e celular cobrem as duas grades');
    await abrir(page);
    // O botão flutuante de WhatsApp passa por cima do cartão no celular e não é fundo: sai da captura.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; } .wo-whatsapp-flutuante { visibility: hidden !important; }' });
    await page.mouse.move(1, 1);
    const alvos = await page.evaluate(() => {
      const raiz = document.querySelector('.wo-vitrine')!;
      const lista: { texto: string; cor: string; minimo: number; retangulos: { x: number; y: number; w: number; h: number }[] }[] = [];
      for (const el of raiz.querySelectorAll<HTMLElement>('*')) {
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
      for (const el of raiz.querySelectorAll<HTMLElement>('[data-medir-vitrine]')) el.style.setProperty('visibility', 'hidden', 'important');
      return lista;
    });
    const caixa = (await cartao(page).boundingBox())!;
    const { largura, rgba } = lerPng(await page.screenshot({ clip: caixa, scale: 'css' }));
    const linear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const luz = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    const abaixo: string[] = [];
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
      if (pior < alvo.minimo) abaixo.push(`"${alvo.texto}" ${alvo.cor} ${pior.toFixed(2)}:1`);
    }
    expect(alvos.length, 'textos medidos no cartão').toBeGreaterThanOrEqual(8);
    expect(abaixo).toEqual([]);
  });
});

test.describe('cartão do hero sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('mostra o mesmo fluxo inteiro', async ({ page }) => {
    await page.goto('/');
    await expect(cartao(page).locator('.wo-maquete__aviso')).toHaveText('Fluxo ilustrativo');
    expect(await etapasNaTela(page)).toEqual(ETAPAS);
    for (const etapa of ETAPAS) await expect(cartao(page).getByText(etapa, { exact: true })).toBeVisible();
  });
});
