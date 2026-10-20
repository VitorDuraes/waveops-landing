import { expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';

/* Contraste do texto sobre o fundo vivo (spec 15.5). O axe não mede texto sobre imagem nem sobre
   vídeo (marca como incompleto), então a medida é feita na mão: o fundo é fixo e o texto sobe por
   cima dele quando a página rola, e o teste rola de 12 px em 12 px, com o texto escondido
   (visibility: hidden, que também leva o fundo próprio do elemento: o pior caso), do momento em que
   o trecho entra na janela até ele passar inteiro por baixo do topo. A cada passo, para cada texto,
   acha o pixel mais claro e o mais escuro atrás dos glifos e exige 4,5:1 (3:1 no texto grande) da cor contra os
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
export function lerPng(png: Buffer): { largura: number; altura: number; rgba: Uint8Array } {
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
export async function varrerContraste(page: Page, url: string, trechos: string[]) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.wo-fundo__poster')).toHaveJSProperty('complete', true);
  await expect(page.locator('[data-fundo-video]')).toHaveJSProperty('currentSrc', '');
  // Com menos movimento o CSS põe transition-duration em tudo; sem transição, esconder vale na hora.
  // O botão flutuante passa por cima do texto no canto e não é fundo: sai da captura.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; } .wo-whatsapp-flutuante { visibility: hidden !important; }' });
  const { alvos, faixas, fimDoTopo, altura, largura, maximo } = await page.evaluate((seletores) => {
    const lista: { texto: string; cor: string; trecho: string; tamanho: number; peso: number; minimo: number }[] = [];
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
        const estilo = getComputedStyle(elemento);
        const tamanho = Number.parseFloat(estilo.fontSize);
        const peso = Number.parseFloat(estilo.fontWeight);
        // WCAG AA: 24 px, ou 18,66 px em negrito (700). Peso 600 não é negrito.
        const minimo = tamanho >= 24 || (tamanho >= 18.66 && peso >= 700) ? 3 : 4.5;
        lista.push({ texto: (elemento.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40), cor: estilo.color, trecho: seletor, tamanho, peso, minimo });
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

