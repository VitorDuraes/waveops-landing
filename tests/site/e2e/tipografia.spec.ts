import { test, expect } from '@playwright/test';

/* Tipografia das páginas contra a tabela 5.2 da spec: Geist nos títulos e Inter no texto. Cada
   papel da tabela vira uma linha de PAPEIS_*, com família, faixa de tamanho (do celular ao
   desktop, porque vários tamanhos são clamp()), peso, entreletra em em e altura de linha como
   proporção do tamanho. Os valores saem de getComputedStyle, nos projetos desktop e celular, com a
   página já renderizada: o que a pessoa vê, não o que o CSS declara. Peça nova em components.css
   que uma página consome entra aqui junto, para a página seguinte herdar o valor certo.

   O número de etapa é "em violeta": desde a D20 (spec 15.2) a página inteira fica no contexto escuro,
   onde o violeta de texto é o lilás de --wo-acento-texto (o violeta da marca não passa 4,5:1 sobre
   a noite).

   Peça sem linha em 5.2 vale a linha mais próxima pela função (decisão de 16/10/2026):
   .wo-sobretitulo e .wo-maquete__titulo são "Etiqueta em caixa alta"; .wo-lead e o parágrafo de
   abertura de uma seção são "Texto", e só o de dentro de uma abertura é "Texto de apoio do hero";
   .wo-link-seta é "Botão e menu" em peso 500; a nota de rodapé de uma tabela é "Nota". */

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

const PAPEIS_HOME: readonly Papel[] = [
  { nome: 'Título do hero', seletor: 'h1#home-titulo', minimo: 1, familia: 'Geist', tamanho: [44, 84], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de seção', seletor: 'main h2, .wo-home-entrada__nome', minimo: 8, familia: 'Geist', tamanho: [36, 52], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de linha (modelos)', seletor: '.wo-tabela-modelos .wo-modelo__nome h3', minimo: 3, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.2 },
  { nome: 'Título de etapa', seletor: '.wo-colunas-numeradas__item h3', minimo: 4, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Termo das definições (título de etapa)', seletor: '.wo-definicoes dt', minimo: 5, familia: 'Geist', tamanho: [22, 24], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Texto', seletor: '.wo-colunas-numeradas__item p, .wo-definicoes dd, .wo-tabela-modelos .wo-modelo__campo p', minimo: 19, familia: 'Inter', tamanho: [16, 16], peso: 400, entreletra: 0, altura: 1.625 },
  { nome: 'Texto de apoio do hero', seletor: '.wo-home-hero__frase', minimo: 1, familia: 'Inter', tamanho: [18, 21], peso: 400, entreletra: 0, altura: 1.5 },
  { nome: 'Nota', seletor: '.wo-modelos__rodape p', minimo: 1, familia: 'Inter', tamanho: [14, 14], peso: 400, entreletra: 0, altura: 1.45 },
  { nome: 'Etiqueta ("Você recebe", campos dos modelos, título da maquete)', seletor: '.wo-colunas-numeradas__recebe .wo-etiqueta, .wo-tabela-modelos .wo-etiqueta, .wo-maquete__titulo', minimo: 10, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.35 },
  { nome: 'Botão', seletor: '.wo-home-hero .wo-btn', minimo: 2, familia: 'Inter', tamanho: [15, 15], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Link com seta (botão e menu, peso 500)', seletor: '.wo-link-seta', minimo: 2, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
];

/* Projetos sob medida (Tarefa 6): a abertura é o hero da página, então o título e o parágrafo dela
   seguem as linhas "do hero". A lista editorial das frentes, as colunas numeradas, a tabela de
   modelos e as perguntas são as peças de 5.4. A pergunta é o título de uma linha que abre, e o
   título do cartão "Proposta" é "Título de cartão". */
const PAPEIS_SOBMEDIDA: readonly Papel[] = [
  { nome: 'Título do hero', seletor: 'h1#sobmedida-titulo', minimo: 1, familia: 'Geist', tamanho: [44, 84], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de seção', seletor: 'main h2', minimo: 5, familia: 'Geist', tamanho: [36, 52], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de linha (frentes e modelos)', seletor: '.wo-lista-editorial__item h3, .wo-tabela-modelos .wo-modelo__nome h3', minimo: 8, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.2 },
  { nome: 'Título de etapa', seletor: '.wo-colunas-numeradas__item h3', minimo: 4, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Título de cartão (Proposta e perguntas)', seletor: '.wo-sobmedida-proposta__texto, .wo-sobmedida-faq__pergunta', minimo: 8, familia: 'Geist', tamanho: [18, 18], peso: 500, entreletra: -0.02, altura: 1.55 },
  { nome: 'Texto', seletor: '.wo-lista-editorial__item p, .wo-colunas-numeradas__item p, .wo-tabela-modelos .wo-modelo__campo p, .wo-sobmedida-faq__resposta, .wo-sobmedida-faq__ajuda p, .wo-sobmedida-proposta__itens dt', minimo: 36, familia: 'Inter', tamanho: [16, 16], peso: 400, entreletra: 0, altura: 1.625 },
  { nome: 'Texto de apoio do hero', seletor: '.wo-abertura__lead', minimo: 1, familia: 'Inter', tamanho: [18, 21], peso: 400, entreletra: 0, altura: 1.5 },
  { nome: 'Nota e etiqueta de tecnologia', seletor: '.wo-lista-editorial__etiquetas, .wo-modelos__rodape p, .wo-sobmedida-proposta__itens dd', minimo: 13, familia: 'Inter', tamanho: [14, 14], peso: 400, entreletra: 0, altura: 1.45 },
  { nome: 'Etiqueta ("Frente 0N", "Você recebe", campos dos modelos)', seletor: '.wo-etiqueta, .wo-maquete__titulo', minimo: 19, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.35 },
  { nome: 'Botão', seletor: '.wo-abertura .wo-btn, .wo-sobmedida-atalhos .wo-btn', minimo: 7, familia: 'Inter', tamanho: [15, 15], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Link com seta (botão e menu, peso 500)', seletor: '.wo-link-seta', minimo: 1, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
];

const PAPEIS_SOLUCOES: readonly Papel[] = [
  { nome: 'Título do hero', seletor: '#solucoes-titulo', minimo: 1, familia: 'Geist', tamanho: [44, 84], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de seção', seletor: 'main h2', minimo: 7, familia: 'Geist', tamanho: [36, 52], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de linha (públicos)', seletor: '.wo-lista-editorial__item h3', minimo: 3, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.2 },
  { nome: 'Termo das definições (título de etapa)', seletor: '.wo-definicoes dt', minimo: 15, familia: 'Geist', tamanho: [22, 24], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Título de cartão (índice)', seletor: '.wo-solucoes-indice__titulo', minimo: 5, familia: 'Geist', tamanho: [18, 18], peso: 500, entreletra: -0.02, altura: 1.55 },
  { nome: 'Texto', seletor: '.wo-solucoes-resultado__muda, .wo-solucoes-itens li, .wo-solucoes-publicos__garantias li', minimo: 34, familia: 'Inter', tamanho: [16, 16], peso: 400, entreletra: 0, altura: 1.625 },
  { nome: 'Texto de apoio do hero', seletor: '.wo-abertura__lead', minimo: 1, familia: 'Inter', tamanho: [18, 21], peso: 400, entreletra: 0, altura: 1.5 },
  { nome: 'Nota e etiqueta de tecnologia', seletor: '.wo-solucoes-contratar__modulo, .wo-lista-editorial__etiquetas, .wo-solucoes-indice__numero', minimo: 13, familia: 'Inter', tamanho: [14, 14], peso: 400, entreletra: 0, altura: 1.45 },
  { nome: 'Botão', seletor: '.wo-abertura .wo-btn, .wo-solucoes-resultado__acoes .wo-btn', minimo: 1, familia: 'Inter', tamanho: [15, 15], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Link de contratação e chip de frente (14 px, peso 500, como o link com seta)', seletor: '.wo-solucoes-frentes a, .wo-solucoes-contratar__link', minimo: 5, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Link com seta', seletor: '.wo-link-seta', minimo: 5, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
];

/* Plataforma (Tarefa 8): as duas maquetes (workspace e telas) seguem os papéis de 5.2 como o resto da
   página. Nome de tela, de camada, de módulo, de execução e de coluna da tabela são "Título de cartão";
   o número dos indicadores é "Título de linha"; rótulo, estado, pílula e detalhe são "Nota". A ação
   desenhada na tela ("Ativar modelo") tem a forma de botão, então segue "Botão". O formulário mantém os
   estilos de campo de hoje (5.4) e fica fora daqui, menos a nota do pé dele. A primeira célula de cada
   linha da tabela muda de papel no celular (vira o título do bloco) e também fica de fora. */
const PAPEIS_PLATAFORMA: readonly Papel[] = [
  { nome: 'Título do hero', seletor: '#plataforma-titulo', minimo: 1, familia: 'Geist', tamanho: [44, 84], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de seção', seletor: 'main h2', minimo: 7, familia: 'Geist', tamanho: [36, 52], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de linha (números das maquetes)', seletor: '.wo-plataforma-kpis strong', minimo: 7, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.2 },
  { nome: 'Termo das definições (título de etapa)', seletor: '.wo-definicoes dt', minimo: 5, familia: 'Geist', tamanho: [22, 24], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Título de etapa', seletor: '.wo-colunas-numeradas__item h3', minimo: 4, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Título de cartão (telas, camadas, módulos e colunas da tabela)', seletor: '.wo-plataforma-titulo-cartao, .wo-plataforma-cmp thead th:not(:first-child)', minimo: 39, familia: 'Geist', tamanho: [18, 18], peso: 500, entreletra: -0.02, altura: 1.55 },
  { nome: 'Texto', seletor: '.wo-definicoes dd, .wo-plataforma-checks li, .wo-plataforma-modulo__texto, .wo-colunas-numeradas__item p, .wo-plataforma-vazio__texto, .wo-plataforma-aviso__lead, .wo-plataforma-cmp td', minimo: 35, familia: 'Inter', tamanho: [16, 16], peso: 400, entreletra: 0, altura: 1.625 },
  { nome: 'Texto de apoio do hero', seletor: '.wo-abertura__lead', minimo: 1, familia: 'Inter', tamanho: [18, 21], peso: 400, entreletra: 0, altura: 1.5 },
  { nome: 'Nota e etiqueta de tecnologia', seletor: '.wo-maquete__aviso, .wo-form-interesse__nota, .wo-plataforma-diagrama__descricao, .wo-plataforma-diagrama__conector span, .wo-plataforma-diagrama__sistemas-nota, .wo-plataforma-pilulas li, .wo-plataforma-governanca__texto, .wo-plataforma-tela__descricao, .wo-plataforma-kpis span, .wo-plataforma-execucoes__nome, .wo-plataforma-estado, .wo-plataforma-linha__detalhe, .wo-plataforma-cartao__texto, .wo-plataforma-etiqueta, .wo-plataforma-situacao__legenda, .wo-plataforma-modulo__area', minimo: 75, familia: 'Inter', tamanho: [14, 14], peso: 400, entreletra: 0, altura: 1.45 },
  { nome: 'Etiqueta', seletor: '.wo-etiqueta, .wo-maquete__titulo, .wo-plataforma-workspace__grupo, .wo-plataforma-cmp thead th:first-child', minimo: 7, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.35 },
  { nome: 'Botão (envio da lista e aviso final)', seletor: '.wo-abertura .wo-btn, .wo-plataforma-aviso .wo-btn', minimo: 3, familia: 'Inter', tamanho: [15, 15], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Ação desenhada na tela (14 px, peso 500, contorno em pílula)', seletor: '.wo-plataforma-acao', minimo: 2, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Link com seta', seletor: '.wo-link-seta', minimo: 1, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
];

/* Contato (Tarefa 9): campo, rótulo, validação e confirmação preservam os controles de 5.4.
   Os títulos do formulário e da confirmação são títulos de cartão. Os dois canais são links
   com seta (botão e menu), com uma nota embaixo. Garantias e próximas etapas são texto. */
const PAPEIS_CONTATO: readonly Papel[] = [
  { nome: 'Título do hero', seletor: '#contato-titulo', minimo: 1, familia: 'Geist', tamanho: [44, 84], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de seção', seletor: '#depois-titulo', minimo: 1, familia: 'Geist', tamanho: [36, 52], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de etapa', seletor: '.wo-colunas-numeradas__item h3', minimo: 3, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Título de cartão (formulário e confirmação)', seletor: '.wo-form__titulo, .wo-confirmacao__titulo', minimo: 2, familia: 'Geist', tamanho: [18, 18], peso: 500, entreletra: -0.02, altura: 1.55 },
  { nome: 'Texto', seletor: '.wo-contato-garantias li, .wo-colunas-numeradas__item p, .wo-confirmacao__texto', minimo: 7, familia: 'Inter', tamanho: [16, 16], peso: 400, entreletra: 0, altura: 1.625 },
  { nome: 'Texto de apoio do hero', seletor: '.wo-abertura__lead', minimo: 1, familia: 'Inter', tamanho: [18, 21], peso: 400, entreletra: 0, altura: 1.5 },
  { nome: 'Nota', seletor: '.wo-contato-canal__detalhe, .wo-form__intro', minimo: 3, familia: 'Inter', tamanho: [14, 14], peso: 400, entreletra: 0, altura: 1.45 },
  { nome: 'Botão (envio e WhatsApp do formulário)', seletor: '.wo-form .wo-btn', minimo: 2, familia: 'Inter', tamanho: [15, 15], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Canal com seta', seletor: '.wo-contato-canal__titulo, .wo-confirmacao .wo-link-seta', minimo: 3, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
];

/* Demonstrações (Tarefa 10): a ficha D19 reutiliza definições, os fluxos usam títulos
   de seção e as etapas Entrada, Regra e Saída reutilizam colunas numeradas. */
const PAPEIS_DEMONSTRACOES: readonly Papel[] = [
  { nome: 'Título do hero', seletor: '#demonstracoes-titulo', minimo: 1, familia: 'Geist', tamanho: [44, 84], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Título de seção', seletor: '.wo-demonstracoes-titulo', minimo: 5, familia: 'Geist', tamanho: [36, 52], peso: 600, entreletra: -0.035, altura: 1.05 },
  { nome: 'Termo da ficha (título de etapa)', seletor: '.wo-demonstracoes-ficha dt', minimo: 15, familia: 'Geist', tamanho: [22, 24], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Título de etapa', seletor: '.wo-colunas-numeradas__item h3', minimo: 15, familia: 'Geist', tamanho: [20, 25], peso: 500, entreletra: -0.02, altura: 1.33 },
  { nome: 'Texto', seletor: '.wo-demonstracoes-ficha dd, .wo-colunas-numeradas__item p, .wo-demonstracoes-fecho p', minimo: 31, familia: 'Inter', tamanho: [16, 16], peso: 400, entreletra: 0, altura: 1.625 },
  { nome: 'Texto de apoio do hero', seletor: '.wo-abertura__lead', minimo: 1, familia: 'Inter', tamanho: [18, 21], peso: 400, entreletra: 0, altura: 1.5 },
  { nome: 'Nota do aviso de cenário simulado', seletor: '.wo-demonstracoes-aviso', minimo: 1, familia: 'Inter', tamanho: [14, 14], peso: 400, entreletra: 0, altura: 1.45 },
  { nome: 'Botão e filtro', seletor: '.wo-abertura .wo-btn', minimo: 7, familia: 'Inter', tamanho: [15, 15], peso: 500, entreletra: 0, altura: 1.43 },
  { nome: 'Link com seta', seletor: '.wo-demonstracoes-fecho .wo-link-seta', minimo: 1, familia: 'Inter', tamanho: [14, 14], peso: 500, entreletra: 0, altura: 1.43 },
];

medirPapeis('tipografia de Demonstrações (spec 5.2)', '/demonstracoes-tecnicas/', PAPEIS_DEMONSTRACOES);

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

function medirPapeis(titulo: string, url: string, papeis: readonly Papel[]): void {
  test.describe(titulo, () => {
    test.use({ reducedMotion: 'reduce' });
    test.beforeEach(async ({}, info) => {
      test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
    });

    for (const papel of papeis) {
      test(`${papel.nome}: ${papel.familia}, ${papel.tamanho[0]} a ${papel.tamanho[1]} px, peso ${papel.peso}`, async ({ page }) => {
        await page.goto(url);
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
}

medirPapeis('tipografia da Home (spec 5.2)', '/', PAPEIS_HOME);
medirPapeis('tipografia de Projetos sob medida (spec 5.2)', '/projetos-sob-medida/', PAPEIS_SOBMEDIDA);
medirPapeis('tipografia de Soluções (spec 5.2)', '/solucoes/', PAPEIS_SOLUCOES);
medirPapeis('tipografia da Plataforma (spec 5.2)', '/plataforma/', PAPEIS_PLATAFORMA);
medirPapeis('tipografia de Contato (spec 5.2)', '/contato/', PAPEIS_CONTATO);

test.describe('destaque dos títulos sobre a onda', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const url of ['/solucoes/', '/projetos-sob-medida/', '/404.html', '/plataforma/', '/contato/']) {
    test(`${url}: o destaque do título herda a cor do título e não há sobretítulo`, async ({ page }) => {
      await page.goto(url);
      const destaque = page.locator('.wo-abertura h1 .wo-destaque');
      await expect(destaque).toHaveCount(1);
      const medida = await destaque.evaluate((el) => {
        const estilo = getComputedStyle(el);
        return { cor: estilo.color, tamanho: Number.parseFloat(estilo.fontSize) };
      });
      // design.md: título é uma cor só. O destaque herda a cor do h1, sem lilás próprio.
      const corTitulo = await page.locator('.wo-abertura h1').evaluate((el) => getComputedStyle(el).color);
      expect(medida.cor).toBe(corTitulo);
      expect(medida.cor).toBe('rgb(243, 243, 241)');
      expect(medida.tamanho).toBeGreaterThanOrEqual(24);
      // Nenhum selo nem sobretítulo acima do título.
      await expect(page.locator('.wo-abertura .wo-etiqueta-hero, .wo-abertura .wo-sobretitulo')).toHaveCount(0);
    });
  }
});

/* Spec 5.4, tabela de modelos: nome, quando faz sentido e o que define a proposta. A linha não é
   link (os três "Conversar sobre" levariam ao mesmo destino da linha de baixo), então nada nela
   sugere clique: sem seta e sem selo repetido de "Disponível" (revisão de 02/11/2026). */
test.describe('tabela de modelos', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name === 'tablet', 'mesmas regras no desktop e no celular');
  });

  for (const url of ['/', '/projetos-sob-medida/']) {
    test(`em ${url} a linha não tem seta, selo nem link`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('.wo-tabela-modelos .wo-modelo')).toHaveCount(3);
      await expect(page.locator('.wo-tabela-modelos svg')).toHaveCount(0);
      await expect(page.locator('.wo-tabela-modelos .wo-selo')).toHaveCount(0);
      await expect(page.locator('.wo-tabela-modelos a')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Conversar sobre/ })).toHaveCount(0);
    });
  }

  test('os dois links da linha de baixo continuam', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.wo-modelos__rodape a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', '/contato/');
    await expect(links.nth(1)).toHaveAttribute('href', '/demonstracoes-tecnicas/');
  });
});
