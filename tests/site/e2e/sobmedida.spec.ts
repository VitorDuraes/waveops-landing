import { test, expect } from '@playwright/test';

/* Projetos sob medida: o que só esta página tem. As âncoras (as novas das cinco frentes, as de
   antes de 15/10/2026 e as que outros sistemas usam), o atalho das frentes, as perguntas sem
   JavaScript e a tabela de modelos com três campos, que sai da grade de dois campos da Home. */
const URL = '/projetos-sob-medida/';
const FRENTES = ['atendimento', 'agentes', 'dashboards', 'crms', 'saas'] as const;
const ANTIGAS = ['automacoes', 'integracoes', 'sistemas'] as const;
const DE_OUTROS_SISTEMAS = ['frentes', 'como-trabalhamos', 'modelos', 'perguntas'] as const;

test.describe('âncoras de Projetos sob medida', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
  });

  for (const id of [...FRENTES, ...ANTIGAS, ...DE_OUTROS_SISTEMAS]) {
    test(`#${id} existe e não para embaixo do topo`, async ({ page }) => {
      await page.goto(`${URL}#${id}`);
      await expect(page.locator('html')).toHaveAttribute('data-topo', 'fixo');
      await expect
        .poll(() =>
          page.evaluate((alvoId) => {
            const alvo = document.getElementById(alvoId);
            const topo = document.querySelector('.wo-topo');
            if (!alvo || !topo) throw new Error(`faltou #${alvoId} ou .wo-topo`);
            return Math.round(alvo.getBoundingClientRect().top - topo.getBoundingClientRect().bottom);
          }, id),
        )
        .toBeGreaterThanOrEqual(0);
    });
  }

  test('as âncoras antigas ficam vazias, no topo da seção das frentes', async ({ page }) => {
    await page.goto(URL);
    for (const id of ANTIGAS) {
      const alvo = page.locator(`#frentes #${id}`);
      await expect(alvo).toHaveCount(1);
      expect(await alvo.evaluate((el) => (el.textContent ?? '').trim())).toBe('');
    }
  });

  test('o atalho das frentes leva às cinco âncoras novas', async ({ page }) => {
    await page.goto(URL);
    const links = page.getByRole('navigation', { name: 'Frentes' }).getByRole('link');
    await expect(links).toHaveText(['Automação de atendimento', 'Agentes de IA', 'Painéis de gestão', 'CRMs sob medida', 'Apps e sistemas']);
    expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')))).toEqual(FRENTES.map((id) => `#${id}`));
  });
});

/* Peças compartilhadas que a página consome (spec 5.4): o que a Tarefa 7 em diante herda. */
test.describe('peças compartilhadas na página', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
  });

  // Spec 5.4 no contexto escuro (15.2): a linha forte é a cor de texto e as finas, a linha noite.
  test('a lista editorial tem a primeira linha forte e as demais em linha fina', async ({ page }) => {
    await page.goto(URL);
    const linhas = await page.locator('#frentes .wo-lista-editorial').evaluate((lista) => {
      const estilo = (el: Element) => getComputedStyle(el);
      return {
        topo: { cor: estilo(lista).borderTopColor, largura: estilo(lista).borderTopWidth },
        itens: [...lista.querySelectorAll(':scope > .wo-lista-editorial__item')].map((item) => ({
          bordaTopo: estilo(item).borderTopWidth,
          cor: estilo(item).borderBottomColor,
          largura: estilo(item).borderBottomWidth,
        })),
      };
    });
    expect(linhas.topo).toEqual({ cor: 'rgb(243, 243, 241)', largura: '2px' });
    expect(linhas.itens).toHaveLength(5);
    for (const item of linhas.itens) expect(item).toEqual({ bordaTopo: '0px', cor: 'rgba(255, 255, 255, 0.15)', largura: '1px' });
  });

  test('a maquete Proposta é um cartão claro com sombra, aviso e selo legível', async ({ page }) => {
    await page.goto(URL);
    const cartao = page.locator('.wo-sobmedida-proposta');
    await expect(cartao.locator('.wo-maquete__aviso')).toHaveText('Modelo ilustrativo');
    const estilo = await cartao.evaluate((el) => {
      const calculado = getComputedStyle(el);
      return { fundo: calculado.backgroundColor, raio: calculado.borderRadius, sombra: calculado.boxShadow, texto: calculado.color };
    });
    expect(estilo).toEqual({
      fundo: 'rgb(250, 248, 244)',
      raio: '10px',
      sombra: 'rgba(0, 0, 0, 0.3) 0px 25px 50px -12px',
      texto: 'rgb(22, 19, 15)',
    });
    // A abertura é escura e troca a cor de situação por um tom claro. Dentro do cartão claro o selo
    // volta ao tom escuro, o único que passa 4,5:1 sobre o papel.
    const selo = await cartao.locator('.wo-selo').evaluate((el) => getComputedStyle(el).color);
    expect(selo).toBe('rgb(146, 64, 14)');
  });

  test('o selo da abertura leva só a borda esquerda e diz projeto sob medida disponível', async ({ page }) => {
    await page.goto(URL);
    const selo = page.locator('.wo-abertura .wo-etiqueta-hero');
    await expect(selo).toHaveText('Projetos sob medida · Disponível');
    const bordas = await selo.evaluate((el) => {
      const estilo = getComputedStyle(el);
      return [estilo.borderTopWidth, estilo.borderRightWidth, estilo.borderBottomWidth, estilo.borderLeftWidth, estilo.borderRadius];
    });
    expect(bordas).toEqual(['0px', '0px', '0px', '2px', '0px']);
    expect(await selo.evaluate((el) => getComputedStyle(el, '::before').display)).toBe('none');
  });
});

test.describe('perguntas sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
  });

  test('as sete perguntas abrem e fecham pelo próprio navegador', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#perguntas summary')).toHaveCount(7);
    const segunda = page.locator('#perguntas details').nth(1);
    await expect(segunda).not.toHaveAttribute('open');
    await segunda.locator('summary').click();
    await expect(segunda).toHaveAttribute('open', '');
    await expect(segunda.locator('p')).toBeVisible();
    await segunda.locator('summary').click();
    await expect(segunda).not.toHaveAttribute('open');
  });

  test('a pergunta do freelancer é a última e abre pelo teclado', async ({ page }) => {
    await page.goto(URL);
    const ultima = page.locator('#perguntas details').last();
    await expect(ultima.locator('summary')).toHaveText('Qual a diferença para contratar um freelancer?');
    await ultima.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(ultima).toHaveAttribute('open', '');
  });
});

test.describe('tabela de modelos com três campos', () => {
  test.use({ reducedMotion: 'reduce' });

  test('é uma linha por modelo no desktop e empilha no celular', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
    await page.goto(URL);
    const modelos = page.locator('#modelos .wo-modelo');
    await expect(modelos).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      const caixas = await modelos.nth(i).evaluate((linha) =>
        [...linha.querySelectorAll(':scope > .wo-modelo__nome, :scope > .wo-modelo__campo')].map((filho) => {
          const caixa = filho.getBoundingClientRect();
          return { x: Math.round(caixa.x), y: Math.round(caixa.y) };
        }),
      );
      expect(caixas, `nome e três campos do modelo ${i + 1}`).toHaveLength(4);
      if (info.project.name === 'desktop') {
        expect(new Set(caixas.map((c) => c.y)).size, `modelo ${i + 1}: tudo na mesma linha`).toBe(1);
        expect(caixas.map((c) => c.x)).toEqual([...caixas.map((c) => c.x)].sort((a, b) => a - b));
        expect(new Set(caixas.map((c) => c.x)).size, `modelo ${i + 1}: uma coluna para cada`).toBe(4);
      } else {
        expect(new Set(caixas.map((c) => c.x)).size, `modelo ${i + 1}: tudo na mesma coluna`).toBe(1);
        expect(caixas.map((c) => c.y)).toEqual([...caixas.map((c) => c.y)].sort((a, b) => a - b));
      }
    }
  });

  test('em 1024 px o nome do modelo não passa para a coluna do lado', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a spec controla a largura sozinha');
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(URL);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('#modelos .wo-modelo')).toHaveCount(3);
    // O h3 é item de um flex em coluna com align-items: flex-start: toma a largura do próprio texto e
    // nunca estoura a si mesmo, então scrollWidth contra clientWidth dele não acusa nada. Quem estoura é
    // a coluna do nome (.wo-modelo__nome), que o minmax(0, 1.2fr) deixa ficar mais estreita que a
    // palavra. O que vale é a borda direita do h3 contra a borda direita da coluna.
    const passamDaColuna = await page.locator('#modelos .wo-modelo').evaluateAll((linhas) =>
      linhas.flatMap((linha) => {
        const nome = linha.querySelector(':scope > .wo-modelo__nome');
        const titulo = nome?.querySelector('h3');
        if (!nome || !titulo) throw new Error('faltou o nome ou o h3 do modelo');
        const sobra = titulo.getBoundingClientRect().right - nome.getBoundingClientRect().right;
        return sobra > 0.5 ? [`${titulo.textContent} passa ${Math.round(sobra)} px da coluna do nome`] : [];
      }),
    );
    expect(passamDaColuna).toEqual([]);
  });
});
