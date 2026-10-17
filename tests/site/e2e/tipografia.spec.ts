import { test, expect } from '@playwright/test';

/* Tipografia da Home contra a tabela 5.2 da spec: Geist nos títulos e Inter no texto. Cada papel
   da tabela vira uma linha de PAPEIS, com família, faixa de tamanho (do celular ao desktop, porque
   vários tamanhos são clamp()), peso, entreletra em em e altura de linha como proporção do
   tamanho. Os valores saem de getComputedStyle, nos projetos desktop e celular, com a página já
   renderizada: o que a pessoa vê, não o que o CSS declara. Peça nova em components.css que a
   Home consome entra aqui junto, para a Tarefa 6 em diante herdar o valor certo. */

type Papel = {
  /** Nome da linha em 5.2. */
  nome: string;
  seletor: string;
  /** Quantos elementos o seletor precisa achar, no mínimo: seletor vazio não pode passar. */
  minimo: number;
  familia: 'Geist' | 'Inter';
  /** Faixa em px, do celular ao desktop. */
  tamanho: readonly [number, number];
  peso: number;
  /** Em em. Zero é "normal". */
  entreletra: number;
  /** Proporção do tamanho da fonte. */
  altura: number;
  caixaAlta?: true;
  cor?: string;
  bordaEsquerda?: string;
};

const PAPEIS: readonly Papel[] = [
  { nome: 'Título do hero', seletor: 'h1#home-titulo', minimo: 1, familia: 'Geist', tamanho: [44, 72], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de seção', seletor: 'main h2, .wo-home-entrada__nome', minimo: 8, familia: 'Geist', tamanho: [34, 48], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de linha (modelos)', seletor: '.wo-tabela-modelos .wo-modelo__nome h3', minimo: 3, familia: 'Geist', tamanho: [24, 30], peso: 500, entreletra: -0.02, altura: 1.2 },
  { nome: 'Título de etapa', seletor: '.wo-colunas-numeradas__item h3', minimo: 4, familia: 'Geist', tamanho: [22, 24], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Termo das definições (título de etapa)', seletor: '.wo-definicoes dt', minimo: 5, familia: 'Geist', tamanho: [22, 24], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Número de etapa', seletor: '.wo-colunas-numeradas__numero', minimo: 4, familia: 'Geist', tamanho: [24, 24], peso: 500, entreletra: 0, altura: 1.33, cor: 'rgb(109, 40, 217)' },
  { nome: 'Texto', seletor: '.wo-colunas-numeradas__item p, .wo-definicoes dd, .wo-tabela-modelos .wo-modelo__campo p', minimo: 19, familia: 'Inter', tamanho: [16, 16], peso: 400, entreletra: 0, altura: 1.625 },
  { nome: 'Texto de apoio do hero', seletor: '.wo-home-hero__frase', minimo: 1, familia: 'Inter', tamanho: [18, 20], peso: 400, entreletra: 0, altura: 1.6 },
  { nome: 'Nota', seletor: '.wo-home-hero__texto .wo-nota-mono', minimo: 1, familia: 'Inter', tamanho: [14, 14], peso: 400, entreletra: 0, altura: 1.45 },
  { nome: 'Etiqueta em caixa alta (hero, "Você recebe", modelos)', seletor: '.wo-home-hero__etiquetas li, .wo-colunas-numeradas__recebe .wo-etiqueta, .wo-tabela-modelos .wo-etiqueta', minimo: 13, familia: 'Inter', tamanho: [12, 12], peso: 500, entreletra: 0.15, altura: 1.35, caixaAlta: true },
  { nome: 'Selo do hero', seletor: '.wo-home-hero .wo-etiqueta-hero', minimo: 1, familia: 'Inter', tamanho: [11, 11], peso: 500, entreletra: 0.15, altura: 1.5, caixaAlta: true, bordaEsquerda: '2px solid' },
  { nome: 'Botão', seletor: '.wo-home-hero .wo-btn', minimo: 2, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
];

type Medida = {
  texto: string;
  familia: string;
  tamanho: string;
  peso: string;
  entreletra: string;
  altura: string;
  caixa: string;
  cor: string;
  borda: string;
};

const numero = (valor: string): number => (valor === 'normal' ? 0 : Number.parseFloat(valor));
const arredondar = (valor: number): number => Math.round(valor * 1000) / 1000;

/** Lista, em português, o que diverge de 5.2 num elemento. Vazia quando está tudo certo. */
function divergencias(papel: Papel, medida: Medida): string[] {
  const tamanho = numero(medida.tamanho);
  const familia = (medida.familia.split(',')[0] ?? '').replace(/["']/g, '').trim();
  const entreletra = arredondar(numero(medida.entreletra) / tamanho);
  const altura = medida.altura === 'normal' ? Number.NaN : arredondar(numero(medida.altura) / tamanho);
  const erros: string[] = [];
  if (familia !== papel.familia) erros.push(`família ${familia}, esperado ${papel.familia}`);
  if (tamanho < papel.tamanho[0] - 0.05 || tamanho > papel.tamanho[1] + 0.05) {
    erros.push(`tamanho ${tamanho}px, esperado ${papel.tamanho[0]} a ${papel.tamanho[1]}px`);
  }
  if (Number(medida.peso) !== papel.peso) erros.push(`peso ${medida.peso}, esperado ${papel.peso}`);
  if (Math.abs(entreletra - papel.entreletra) > 0.002) erros.push(`entreletra ${entreletra}em, esperado ${papel.entreletra}em`);
  if (!(Math.abs(altura - papel.altura) <= 0.01)) erros.push(`altura de linha ${altura}, esperado ${papel.altura}`);
  if (papel.caixaAlta && medida.caixa !== 'uppercase') erros.push(`text-transform ${medida.caixa}, esperado uppercase`);
  if (papel.cor && medida.cor !== papel.cor) erros.push(`cor ${medida.cor}, esperado ${papel.cor}`);
  if (papel.bordaEsquerda && medida.borda !== papel.bordaEsquerda) erros.push(`borda esquerda ${medida.borda}, esperado ${papel.bordaEsquerda}`);
  return erros;
}

test.describe('tipografia da Home (spec 5.2)', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
  });

  for (const papel of PAPEIS) {
    test(`${papel.nome}: ${papel.familia}, ${papel.tamanho[0]} a ${papel.tamanho[1]} px, peso ${papel.peso}`, async ({ page }) => {
      await page.goto('/');
      const medidas: Medida[] = await page.locator(papel.seletor).evaluateAll((elementos) => elementos.map((elemento) => {
        const estilo = getComputedStyle(elemento);
        return {
          texto: (elemento.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 32),
          familia: estilo.fontFamily,
          tamanho: estilo.fontSize,
          peso: estilo.fontWeight,
          entreletra: estilo.letterSpacing,
          altura: estilo.lineHeight,
          caixa: estilo.textTransform,
          cor: estilo.color,
          borda: `${estilo.borderLeftWidth} ${estilo.borderLeftStyle}`,
        };
      }));
      expect.soft(medidas.length, `elementos achados por ${papel.seletor}`).toBeGreaterThanOrEqual(papel.minimo);
      const erros = medidas.flatMap((medida) => divergencias(papel, medida).map((erro) => `"${medida.texto}": ${erro}`));
      expect(erros).toEqual([]);
    });
  }
});

/* Spec 5.4, tabela de modelos: nome com subtítulo, descrição, três pontos e seta. A seta é só
   desenho. Link para /contato/ com nome acessível inventado não está na spec nem no plano, e
   somaria três paradas de Tab para o mesmo destino que a linha de baixo já oferece. */
test.describe('setas da tabela de modelos', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
  });

  test('são svg decorativos, fora de link, sem nome acessível', async ({ page }) => {
    await page.goto('/');
    const setas = page.locator('.wo-tabela-modelos__seta');
    await expect(setas).toHaveCount(3);
    const lidas = await setas.evaluateAll((elementos) => elementos.map((elemento) => ({
      tag: elemento.tagName.toLowerCase(),
      ariaHidden: elemento.getAttribute('aria-hidden'),
      largura: elemento.getAttribute('width'),
      altura: elemento.getAttribute('height'),
      nome: elemento.getAttribute('aria-label') ?? elemento.getAttribute('aria-labelledby'),
      dentroDeInterativo: elemento.closest('a, button, [role="link"], [role="button"]') !== null,
      focalizavel: elemento.hasAttribute('tabindex') || elemento.getAttribute('focusable') !== 'false',
    })));
    expect(lidas).toEqual(Array.from({ length: 3 }, () => ({
      tag: 'svg', ariaHidden: 'true', largura: expect.stringMatching(/^\d+$/), altura: expect.stringMatching(/^\d+$/),
      nome: null, dentroDeInterativo: false, focalizavel: false,
    })));
    await expect(page.locator('.wo-tabela-modelos a')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Conversar sobre/ })).toHaveCount(0);
  });

  test('não têm cursor nem hover que sugiram clique', async ({ page }, info) => {
    await page.goto('/');
    const seta = page.locator('.wo-tabela-modelos__seta').first();
    await seta.evaluate((elemento) => elemento.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const ler = () => seta.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return { cursor: estilo.cursor, cor: estilo.color, transformacao: estilo.transform, ponteiro: estilo.pointerEvents };
    });
    const antes = await ler();
    if (info.project.name === 'desktop') await seta.hover({ force: true });
    expect(await ler()).toEqual(antes);
    expect(antes.cursor).toBe('auto');
  });

  test('os dois links da linha de baixo continuam', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.wo-modelos__rodape a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', '/contato/');
    await expect(links.nth(1)).toHaveAttribute('href', '/demonstracoes-tecnicas/');
  });
});
