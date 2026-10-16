# Site: novo visual, vídeo no hero e palco das cinco frentes

> **Para quem executa com agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** as seis páginas e o 404 de waveops.com.br no novo visual (papel e tinta, títulos em Geist, botões em pílula, grade editorial), com vídeo em loop no hero da Home, um palco que monta uma cena por frente conforme a rolagem e as cinco frentes da base WaveOps.

**Arquitetura:** continua o site estático de hoje: HTML com parciais carimbados por `dev/site/build.mjs`, CSS em `tokens.css`, `base.css` e `components.css` mais uma folha por página, e JavaScript puro como melhoria progressiva. Os tokens ganham duas camadas: a paleta primitiva e nomes semânticos que trocam de valor dentro de `.wo-noite`, então a mesma peça funciona no claro e no escuro. O vídeo é gerado por código; o palco é HTML e CSS ligado por um módulo que só a Home carrega.

**Tecnologia:** HTML, CSS e JavaScript ES2022 com `// @ts-check`; Node 22 ou mais novo com `node:test`; Playwright 1.63 com axe; ffmpeg 8 só na máquina que gera o vídeo.

**Spec:** `docs/specs/2026-10-15-site-novo-visual.md`. Fica local, fora do git, como toda spec deste repo. Leia a spec junto com este plano: as tarefas citam as seções dela pelo número, e os valores estão lá.

| Campo | Valor |
|---|---|
| Data | 15/10/2026 |
| Decisões | Vitor, 15/10/2026: desenho, spec, copy da seção 8 e palco das cinco frentes (opção A) |
| Branch | `feat/site-novo-visual`, no worktree `.claude/worktrees/feat+site-novo-visual` |
| Estimativa | Cerca de 19 h de execução, mais as duas esperas de aprovação |

## Restrições globais

Valem para toda tarefa, mesmo quando ela não repete.

1. **Sigilo.** Nenhum arquivo versionado, commit, PR ou comentário cita pelo nome a referência visual. Escreva "novo visual". Só a spec local cita.
2. **Branch.** Tudo em `feat/site-novo-visual`. Nada de commit na `main`; o merge é do Vitor.
3. **Escrita.** PT-BR com acento em copy, comentário e commit. Nunca travessão nem meia-risca (o lint barra no HTML).
4. **Afirmações.** Texto de página vem das seções 8 e 13.2 da spec, ou é o de hoje. Nada de cliente, preço (`R$`), prazo ou resultado inventado. Toda `wo-maquete` leva `wo-maquete__aviso`.
5. **Melhoria progressiva.** Nada é injetado por JavaScript; sem JavaScript a página fica inteira. Sem script inline, sem evento inline e sem origem nova na CSP.
6. **Movimento.** Menos movimento e sem JavaScript mostram sempre o estado final: cenas montadas e pôster no hero.
7. **Peso por página** (gzip nível 9, `tests/site/unit/peso.test.mjs`): JavaScript até 15 KB (20 KB com formulário) e CSS até 25 KB. Vídeo, pôster e fontes ficam fora dessa conta e têm os tetos da spec 6.2.
8. **Formulários.** IDs, `data-*`, campos, mensagens, endpoints, `assets/site/config.js` e `assets/funil.js` não mudam.
9. **Âncoras preservadas:** `/projetos-sob-medida/#modelos`, `#como-trabalhamos`, `#perguntas` e `#agentes`; `/solucoes/#vender`, `#atender`, `#operar`, `#decidir`, `#crescer` e `#publicos`; `/plataforma/#lista` e `#modulos`; o mapa de `assets/site/lib/legado.js`.
10. **Plataforma** fora do menu e da Home. Módulo e assinatura nunca aparecem como disponíveis.
11. **CSS.** Valor novo entra primeiro em `tokens.css`. Peça usada por mais de uma página vai em `components.css`; peça de uma página só vai em `assets/site/paginas/<id>.css`, com classe `wo-<id>-...`. Os nomes `wo-btn--primario` e `wo-btn--secundario` continuam (o segundo vira o botão de contorno), para não mexer em toda página.
12. **Acessibilidade.** Um `h1` por página, headings sem pular nível, `<svg>` com `width` e `height` e `aria-hidden="true"` quando decorativo, contraste AA. Alvo de toque de 44 px abaixo de 768 px; no desktop, o botão de 40 px da spec 5.4 vale.
13. **Build.** Depois de editar página, parcial, CSS ou JS: `node dev/site/build.mjs`. Página carimbada é commitada.
14. **Estado intermediário.** Depois da Tarefa 1, página ainda não redesenhada fica feia e pode reprovar no axe. Cada tarefa de página deixa a própria página verde no axe; a Tarefa 13 exige tudo verde.
15. **Commits.** Um ou mais por tarefa, em PT-BR, com prefixo `feat(site):`, `test(site):`, `docs(site):` ou `docs(plano):`, terminando com a linha `Co-Authored-By` do modelo que fez o commit.
16. **Marca.** O símbolo Sine Nodes não muda. No topo, no rodapé e na imagem de compartilhamento, ele volta para o quadrado violeta plano de antes de 06/09/2026 (spec D14 e 5.4). O selo 3D sai das páginas, e os arquivos dele ficam no repo.
17. **Spec na mão.** Cada tarefa tem uma linha **Leia antes** com as seções da spec que ela implementa. Quem despacha a tarefa anexa essas seções ao pedido do implementador. Quem implementa não inventa texto nem valor que não esteja nelas ou neste plano.

## Foco da revisão

Cinco situações que a spec implica e que são fáceis de quebrar sem ninguém ver. Cada uma tem teste na tarefa indicada.

1. **Desktop de tela baixa ou zoom de 200%.** Em 1280 × 650 o palco e a última peça cabem na janela; abaixo de 1024 px de largura ou de 600 px de altura ele vira cena embaixo do texto. Tarefa 2.
2. **Recarregar ou voltar no meio da Home.** Com a rolagem restaurada, palco e topo nascem no estado certo, sem esperar a pessoa rolar. Tarefas 2 e 3.
3. **Teclado com o topo fixo.** Foco e âncora nunca param embaixo do topo (WCAG 2.4.11), e "Pular para o conteúdo" aparece por cima dele. Tarefa 3.
4. **Botão flutuante cobrindo alvo.** Em 360 px ele não cobre o envio da lista de interesse da Plataforma nem os links do fim do rodapé. Tarefa 3.
5. **Preferência de movimento mudando com a página aberta.** O palco desliga e mostra tudo montado; o vídeo pausa e o botão some. Tarefas 2 e 5.

## Ordem e portões

As tarefas rodam na ordem numérica, uma por vez, porque dividem `index.html` e `components.css`.

| Tarefa | Depende de | Espera o Portão A? |
|---|---|---|
| 1. Fundação visual | nada | não |
| 2. Palco com a cena 1 | 1 | não (é ela que abre o portão) |
| 3. Parciais, topo fixo, WhatsApp flutuante e 404 | 1 | não |
| 4. Vídeo do hero | nada | não |
| 5. Home | 1 a 4 | não |
| 6. Projetos sob medida e rodapé das frentes | 3, 5 | não |
| 7. Soluções | 6 | não |
| 8. Plataforma | 3, 5 | não |
| 9. Contato | 3, 5 | não |
| 10. Demonstrações técnicas | 5 | não |
| 11. Cenas 2 a 5 | 2, 5 | **sim** |
| 12. Textos fora das páginas, limpeza e documentação | 2 a 11 | sim |
| 13. Verificação final, revisão e PR | todas | sim |

- **Portão A**, depois da Tarefa 2: o Vitor aprova a cena 1. Só a 11 espera.
- **Portão B**, na Tarefa 13: o Vitor confere o Deploy Preview e o iPhone antes do merge.

## Comandos

```bash
# Portão local, da raiz do worktree
node dev/site/build.mjs
node dev/site/build.mjs --check
node dev/site/lint.mjs
npm --prefix tests/site run typecheck
npm --prefix tests/site run test:unit

# Navegador, de tests/site: só as specs da tarefa, nos três projetos
npx playwright test <specs>
# axe de uma página só (o filtro casa com "projeto arquivo título")
npx playwright test a11y -g "spec.ts / sem"                     # Home
MSYS_NO_PATHCONV=1 npx playwright test a11y -g "/solucoes/ sem"  # outra página
```

- No Git Bash, argumento que começa com `/` pede `MSYS_NO_PATHCONV=1` antes do comando.
- Use `SITE_PORTA=<porta>` quando outro teste estiver rodando.
- Primeira vez: `npm ci --prefix tests/site` e, se faltar o navegador, `npx --prefix tests/site playwright install chromium`.

## Mapa de arquivos

| Arquivo | Tarefa | Papel |
|---|---|---|
| `assets/site/tokens.css` | 1, 12 | Paleta primitiva da spec 5.1 e nomes semânticos para o claro (`:root`) e o escuro (`.wo-noite`) |
| `assets/site/base.css` | 1, 3 | Fontes, reset, tipografia, contêiner, grade editorial, seção, foco, `.wo-noite` e `scroll-padding` |
| `assets/fonts/geist-variavel-latin.woff2`, `inter-variavel-latin.woff2`, `OFL-geist.txt`, `OFL-inter.txt` | 1 | Fontes novas e licenças |
| `dev/site/fontes.mjs` | 1 | Baixa as duas fontes (uso único, para refazer depois) |
| `dev/site/parciais/head.html` | 1, 3 | Preload da Geist, `theme-color` e o topo no fluxo sem JavaScript |
| `tests/site/types/globais.d.ts` | 4, 5 | `window.desenhar` da cena do vídeo e `navigator.connection` |
| `assets/site/lib/palco.js` | 2 | Funções puras do palco |
| `assets/site/paginas/home.js` | 2, 5 | Módulo só da Home: liga o palco e o vídeo |
| `assets/site/paginas/home.css` | 2, 5, 11 | Hero, palco e cenas |
| `tests/site/qa/palco.mjs` | 2 | Capturas por passo e vídeo da rolagem, para aprovação |
| `dev/site/parciais/topo.html`, `rodape.html`, `cta-final.html` | 3, 6 | Topo de dois estados, rodapé escuro, chamada final com cartão |
| `dev/site/parciais/whatsapp-flutuante.html` | 3 | Botão flutuante |
| `assets/site/site.js` | 3 | `iniciarTopoFixo` |
| `assets/site/components.css` | 3, 5 a 10 | Peças compartilhadas do novo visual |
| `dev/site/video/cena.html`, `cena.js` | 4 | Cena do vídeo em canvas |
| `tests/site/qa/video.mjs` | 4 | Gravação e codificação com ffmpeg |
| `assets/site/video/` | 4 | Quatro vídeos e o pôster |
| `dev/site/serve.mjs` | 4 | MIME de vídeo e `Range` |
| `assets/site/lib/video.js` | 5 | Funções puras do vídeo |
| Páginas e `assets/site/paginas/<id>.css` | 2 a 11 | Conteúdo e peças de cada página |
| `llms.txt`, `sitemap.xml`, `dev/site/og.html`, `dev/site/og.css`, `assets/og-waveops.png` | 12 | Textos fora das páginas |
| `CLAUDE.md`, `README.md`, `dev/site/README.md` | 12 | Documentação |

---

### Tarefa 1: Fundação visual

**Estimativa:** 1 h. **Depende de:** nada. **Leia antes:** spec 5.1, 5.2 e 5.3.

**Arquivos:**
- Criar: `dev/site/fontes.mjs`; `assets/fonts/geist-variavel-latin.woff2`, `inter-variavel-latin.woff2`, `OFL-geist.txt` e `OFL-inter.txt`; `tests/site/unit/cores.test.mjs`; `tests/site/unit/fontes.test.mjs`
- Modificar: `assets/site/tokens.css`, `assets/site/base.css`, `dev/site/parciais/head.html` e as 7 páginas (só recarimbo)

**Interfaces:**
- Produz, em `tokens.css`:
  - **Primitivos** com os valores da spec 5.1: `--wo-papel`, `--wo-papel-2`, `--wo-tinta`, `--wo-tinta-2`, `--wo-tinta-3`, `--wo-linha`, `--wo-noite`, `--wo-noite-hero`, `--wo-cartao-noite`, `--wo-clara`, `--wo-clara-2`, `--wo-linha-noite`, `--wo-violeta`, `--wo-violeta-forte`. Mais `--wo-branco: #ffffff`, `--wo-whatsapp: #128c7e` (4,1:1 com o ícone branco e 3,9:1 com o papel) e `--wo-abertura-brilho: rgb(124 58 237 / 0.35)`, a cor mais clara do degradê violeta das aberturas escuras. Para a logo (spec D14): `--wo-marca-claro: #a78bfa` e `--wo-marca-escuro: #8b5cf6`, as duas pontas do degradê do quadrado.
  - **Semânticos** em `:root` (claro), redefinidos em `.wo-noite` (escuro): `--wo-fundo`, `--wo-fundo-2`, `--wo-superficie`, `--wo-texto`, `--wo-texto-2`, `--wo-texto-3`, `--wo-borda`, `--wo-borda-forte`, `--wo-acento`, `--wo-acento-hover`, `--wo-acento-texto`, `--wo-sobre-acento`, `--wo-sucesso`, `--wo-alerta`, `--wo-erro` e `--wo-info`. Dentro de `.wo-noite` ficam também os nomes que os formulários já usam (`--wo-superficie-2`, `--wo-superficie-3`, `--wo-borda-campo`, `--wo-erro-*`, `--wo-sucesso-*`, `--wo-acento-fundo*`, `--wo-acento-borda*`), com os valores escuros de hoje: o formulário continua igual sobre fundo escuro.
  - **Tipografia:** `--wo-fonte-titulo: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif`; `--wo-fonte: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`; `--wo-h1: clamp(44px, 33.6px + 2.667vw, 72px)`; `--wo-h2: clamp(34px, 28.8px + 1.333vw, 48px)`; `--wo-h3-linha: clamp(24px, 21.77px + 0.571vw, 30px)`; `--wo-h3-etapa: clamp(22px, 21.26px + 0.19vw, 24px)`; `--wo-lead-hero: clamp(18px, 17.26px + 0.19vw, 20px)`.
  - **Layout e efeitos:** `--wo-conteiner: 1280px`; `--wo-margem` de 20 px (32 px a partir de 640 px, 48 px a partir de 768 px); `--wo-secao` de 96 px (128 px a partir de 640 px); `--wo-topo-altura: 66px`; `--wo-raio: 10px`; `--wo-raio-pilula: 999px`; `--wo-sombra-cartao: 0 25px 50px -12px rgb(0 0 0 / 0.3)`; `--wo-sombra-folha: 0 -24px 60px rgb(0 0 0 / 0.35)`; `--wo-palco-trecho: 70vh`; `--wo-transicao: 160ms ease`; `--wo-alvo: 44px`.
  - **Bloco final `/* Legado */`:** todo nome antigo que o CSS de hoje ainda usa (`--wo-mono`, `--wo-raio-sm`, `--wo-h2-medio` e os outros) aponta para um valor novo; `--wo-mono` vira `var(--wo-fonte)`. Assim as páginas seguem renderizando até serem refeitas. A Tarefa 12 apaga o bloco.
  - `:root` passa de `color-scheme: dark` para `color-scheme: light`.
- Produz, em `base.css`:
  - `.wo-noite { background: var(--wo-fundo); color: var(--wo-texto); color-scheme: dark; }`, usada por toda faixa escura.
  - A grade editorial de 5.3: `.wo-editorial` com 12 colunas e vão de 48 px a partir de 1024 px, `.wo-editorial__cabeca` nas colunas 1 a 5 e `.wo-editorial__corpo` nas colunas 6 a 12; abaixo de 1024 px, uma coluna. Toda seção nova usa essa grade.

- [ ] **Passo 1: Linha de base e plano.** Rodar `npm ci --prefix tests/site` e o portão local; guardar a saída em `.tmp-qa/linha-de-base.txt`, fora do git. Commitar este plano: `git add docs/plans/2026-10-15-site-novo-visual.plan.md` e `git commit -m "docs(plano): novo visual do site"`.

- [ ] **Passo 2: Teste de contraste** em `tests/site/unit/cores.test.mjs`. O teste lê `tokens.css`, resolve `var()` em cada contexto (`.wo-noite` herda de `:root`), compõe cor com alfa sobre o fundo sem arredondar o canal (fundo com alfa é composto sobre `--wo-fundo` do contexto) e só então aplica a conta da WCAG.

```js
test('a conta de contraste bate com valores conhecidos', () => {
  assert.equal(contraste('#ffffff', '#000000').toFixed(2), '21.00');
  assert.equal(contraste('#767676', '#ffffff').toFixed(2), '4.54');
  assert.equal(contraste('rgb(0 0 0 / 0.5)', '#ffffff').toFixed(2), '3.98');
});

// [frente, fundo, mínimo]: texto 4,5:1; componente e anel de foco 3:1.
const PRIMITIVOS = [
  ['--wo-tinta', '--wo-papel', 4.5], ['--wo-tinta-2', '--wo-papel', 4.5], ['--wo-tinta-2', '--wo-papel-2', 4.5],
  ['--wo-tinta-3', '--wo-papel', 4.5], ['--wo-tinta-3', '--wo-papel-2', 4.5], ['--wo-tinta-3', '--wo-branco', 4.5],
  ['--wo-violeta', '--wo-papel', 4.5], ['--wo-violeta', '--wo-papel-2', 4.5],
  ['--wo-branco', '--wo-violeta', 4.5], ['--wo-branco', '--wo-violeta-forte', 4.5],
  ['--wo-clara', '--wo-noite', 4.5], ['--wo-clara-2', '--wo-noite', 4.5], ['--wo-clara-2', '--wo-cartao-noite', 4.5],
  ['--wo-violeta', '--wo-noite', 3], ['--wo-branco', '--wo-whatsapp', 3], ['--wo-whatsapp', '--wo-papel', 3],
];
const SEMANTICOS = [
  ['--wo-texto', '--wo-fundo', 4.5], ['--wo-texto-2', '--wo-fundo', 4.5], ['--wo-texto-3', '--wo-fundo', 4.5],
  ['--wo-texto-2', '--wo-superficie', 4.5], ['--wo-texto-3', '--wo-superficie', 4.5],
  ['--wo-acento-texto', '--wo-fundo', 4.5],
  ['--wo-sucesso', '--wo-fundo', 4.5], ['--wo-alerta', '--wo-fundo', 4.5], ['--wo-erro', '--wo-fundo', 4.5],
];
for (const [frente, fundo, minimo] of PRIMITIVOS) {
  test(`${frente} sobre ${fundo} passa ${minimo}:1`, () => {
    const razao = contraste(cor(':root', frente), cor(':root', fundo));
    assert.ok(razao >= minimo, `${razao.toFixed(2)}:1`);
  });
}
for (const contexto of [':root', '.wo-noite']) {
  for (const [frente, fundo, minimo] of SEMANTICOS) {
    test(`${contexto}: ${frente} sobre ${fundo} passa ${minimo}:1`, () => {
      const razao = contraste(cor(contexto, frente), cor(contexto, fundo));
      assert.ok(razao >= minimo, `${razao.toFixed(2)}:1`);
    });
  }
}
// Texto claro sobre o ponto mais claro do degradê das aberturas (composto sobre a noite).
for (const frente of ['--wo-clara', '--wo-clara-2']) {
  test(`.wo-noite: ${frente} sobre --wo-abertura-brilho passa 4.5:1`, () => {
    const razao = contraste(cor('.wo-noite', frente), cor('.wo-noite', '--wo-abertura-brilho'));
    assert.ok(razao >= 4.5, `${razao.toFixed(2)}:1`);
  });
}
```

- [ ] **Passo 3: Teste de fontes** em `tests/site/unit/fontes.test.mjs`, com quatro casos:
  - todo `url('/assets/fonts/...')` de `base.css` existe em disco;
  - as famílias de `@font-face` em `base.css` são exatamente `['Geist', 'Inter']`;
  - os preloads de fonte de `dev/site/parciais/head.html` são exatamente `['/assets/fonts/geist-variavel-latin.woff2']`;
  - nenhuma página de `dev/site/paginas.json` cita `hanken` ou `spacemono`, sem diferenciar maiúsculas.

- [ ] **Passo 4: Ver falhar.** `node --test tests/site/unit/cores.test.mjs tests/site/unit/fontes.test.mjs`. Esperado: FALHA, com `--wo-papel` indefinido e `Hanken Grotesk` entre as famílias.

- [ ] **Passo 5: Baixar as fontes.** `dev/site/fontes.mjs` pede `https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Inter:wght@400..700&display=swap` com user agent de Chrome, salva só o bloco `/* latin */` de cada família em `assets/fonts/geist-variavel-latin.woff2` e `assets/fonts/inter-variavel-latin.woff2` e imprime o `unicode-range` de cada um. As licenças vêm de `https://raw.githubusercontent.com/vercel/geist-font/main/OFL.txt` e `https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt` para `assets/fonts/OFL-geist.txt` e `OFL-inter.txt` (as duas URLs responderam 200 em 16/10/2026). O script só baixa de `https://fonts.googleapis.com/`, `https://fonts.gstatic.com/` e `https://raw.githubusercontent.com/`, e recusa qualquer outro host que apareça no CSS. Rodar `node dev/site/fontes.mjs`.

- [ ] **Passo 6: Tokens, base e head.**
  - `tokens.css` com as interfaces acima.
  - `base.css`: os quatro `@font-face` de hoje saem; entram Geist e Inter (`font-weight: 400 700`, `font-display: swap`, `unicode-range` do passo 5). `body` em `--wo-fundo` e `--wo-texto`, `--wo-fonte` em 16 px com altura de linha 1,625. `h1`, `h2`, `.wo-h1` e `.wo-h2` em `--wo-fonte-titulo`, peso 600, entreletra -0,035em, altura 1,05. `.wo-conteiner` com `--wo-conteiner` e `--wo-margem`; `.wo-secao` com `--wo-secao`. Foco com anel de 2 px em `--wo-acento` e afastamento de 2 px. `html { scroll-padding-top: calc(var(--wo-topo-altura) + 16px) }`, sempre ligado (spec 5.5). A regra `.wo-noite`.
  - `head.html`: preload de `/assets/fonts/geist-variavel-latin.woff2` no lugar da Hanken; `theme-color` `#0a0a0a`.

- [ ] **Passo 7: Ver passar.** `node dev/site/build.mjs` e os dois testes do passo 4: PASSA. Portão local inteiro: verde. Não rode o axe nesta tarefa (restrição 14).

- [ ] **Passo 8: Commit.** Arquivos da tarefa e páginas recarimbadas, com `git commit -m "feat(site): fundação do novo visual com tokens em duas camadas, Geist e Inter"`.

---

### Tarefa 2: Palco das cinco frentes, com a cena 1 (abre o Portão A)

**Estimativa:** 3 h. **Depende de:** 1. **Leia antes:** spec 7.1 (bloco 3), 8.1, 8.2 e a seção 13 inteira.

**Arquivos:**
- Criar: `assets/site/lib/palco.js`, `assets/site/paginas/home.js`, `tests/site/unit/palco.test.mjs`, `tests/site/e2e/palco.spec.ts`, `tests/site/qa/palco.mjs`
- Modificar: `index.html`, `assets/site/paginas/home.css`, `tests/site/e2e/sem-js.spec.ts`

**Interfaces:**
- Consome da Tarefa 1: `--wo-palco-trecho`, `--wo-topo-altura`, `--wo-branco`, `--wo-linha`, `--wo-raio`, `--wo-tinta`, `--wo-tinta-3` e `--wo-violeta`.
- Produz `assets/site/lib/palco.js` (funções puras, `// @ts-check` com JSDoc):
  - `export const MIDIA_FIXO = '(min-width: 1024px) and (min-height: 600px)'`: consulta de mídia do palco fixo. Abaixo de 600 px de altura o palco não cabe e vira cena embaixo do texto (spec 13.3).
  - `export function progressoNoTrecho(inicio, fim, valor): number`: `(valor - inicio) / (fim - inicio)` limitado a 0 e 1. Com `inicio === fim`, devolve 1 se `valor >= inicio`, senão 0.
  - `export function passoPorProgresso(progresso, total): number`: `Math.min(total, Math.max(1, Math.ceil(progresso * total)))`.
  - `export function estadoFixo(blocos, alturaJanela, totais): { ativa: number, passo: number }`, com `blocos: { topo: number, altura: number }[]` medidos por `getBoundingClientRect` e `totais: number[]`. A linha fica em `alturaJanela / 2`; `ativa` é o último bloco com `topo <= linha`, ou 0; o progresso vai de `topo` até `topo + 0,75 × altura`.
  - `export function passoLocal(cena, alturaJanela, total): number`, com `cena: { topo: number }`: progresso do topo da cena entre `0,9 × alturaJanela` e `0,35 × alturaJanela`.
- Produz `assets/site/paginas/home.js` (módulo, só na Home): `export function iniciarPalco(doc = document, janela = window): void`, chamada no fim do arquivo quando `document` existe. A Tarefa 5 acrescenta `iniciarVideo` no mesmo arquivo.
- Contrato de marcação. A Tarefa 11 preenche as cenas 2 a 5 nele:

```html
<section class="wo-secao wo-home-frentes" id="frentes" aria-labelledby="frentes-titulo" data-palco>
  <div class="wo-conteiner">
    <!-- cabeça editorial: h2 "Cinco frentes.", texto e link de 8.2 -->
    <div class="wo-home-palco">
      <div class="wo-home-frente" data-frente="atendimento"><!-- 01, h3, frase curta e etiquetas de 8.1 --></div>
      <figure class="wo-maquete wo-home-cena wo-home-cena--atendimento" data-cena="atendimento">
        <figcaption class="wo-home-cena__cabeca">
          <span class="wo-home-cena__titulo">Atendimento no WhatsApp</span>
          <span class="wo-maquete__aviso">Ilustração</span>
          <span class="wo-oculto"><!-- uma frase que descreve a cena --></span>
        </figcaption>
        <div class="wo-home-cena__tela" aria-hidden="true"><!-- peças com data-passo de "1" a "6" --></div>
      </figure>
      <!-- o mesmo par para agentes, dashboards, crms e saas, nesta ordem -->
    </div>
  </div>
</section>
```

- Estado escrito só pelo JavaScript: `data-palco-modo="fixo"` ou `"local"` na seção (sem o atributo, o palco está desligado); `data-ativa` na cena e no bloco da frente da vez, só no modo fixo; `data-visivel` em cada peça já montada.

- [ ] **Passo 1: Teste das funções e do conteúdo** em `tests/site/unit/palco.test.mjs`. Ajudantes, todos sobre o trecho de `index.html` que vai de `data-palco` ao `</section>` seguinte: `frentes` e `cenas` são os valores de `data-frente` e `data-cena`, em ordem; `figura(cena)` devolve o HTML do `figure` daquela cena; `passosDe(cena)` devolve, em ordem crescente, os números distintos de `data-passo` dentro dele; `textoDe(html)` tira as tags.

```js
test('progressoNoTrecho vai de 0 a 1 e satura nas pontas', () => {
  assert.equal(progressoNoTrecho(100, 200, 150), 0.5);
  assert.equal(progressoNoTrecho(100, 200, 50), 0);
  assert.equal(progressoNoTrecho(100, 200, 250), 1);
  assert.equal(progressoNoTrecho(900, 350, 625), 0.5);
  assert.equal(progressoNoTrecho(100, 100, 100), 1);
  assert.equal(progressoNoTrecho(100, 100, 99), 0);
});

test('passoPorProgresso mostra o primeiro passo no início e o último no fim', () => {
  assert.deepEqual([0, -0.2, 0.5, 0.51, 1, 1.4].map((p) => passoPorProgresso(p, 6)), [1, 1, 3, 4, 6, 6]);
});

test('estadoFixo ativa a frente cujo topo passou da metade da janela', () => {
  const totais = [6, 6, 6, 6, 6];
  const blocos = (primeiro) => [0, 1, 2, 3, 4].map((i) => ({ topo: primeiro + i * 600, altura: 600 }));
  assert.deepEqual(estadoFixo(blocos(500), 900, totais), { ativa: 0, passo: 1 });
  assert.deepEqual(estadoFixo(blocos(-375), 900, totais), { ativa: 1, passo: 3 });
  assert.deepEqual(estadoFixo(blocos(-2800), 900, totais), { ativa: 4, passo: 6 });
});

test('passoLocal monta a cena enquanto o topo dela sobe de 90% para 35% da janela', () => {
  assert.deepEqual([1200, 900, 625, 350, -100].map((topo) => passoLocal({ topo }, 1000, 6)), [1, 1, 3, 6, 6]);
});

test('o palco fixo pede 1024 px de largura e 600 px de altura', () => {
  assert.equal(MIDIA_FIXO, '(min-width: 1024px) and (min-height: 600px)');
});

test('a Home tem as cinco cenas na ordem das frentes, com passos contínuos e aviso', () => {
  assert.deepEqual(frentes, ['atendimento', 'agentes', 'dashboards', 'crms', 'saas']);
  assert.deepEqual(cenas, frentes);
  for (const cena of cenas) {
    const passos = passosDe(cena);
    assert.deepEqual(passos, Array.from({ length: passos.length }, (_, i) => i + 1), cena);
    assert.match(figura(cena), /class="wo-maquete__aviso">Ilustração</, cena);
    assert.doesNotMatch(textoDe(figura(cena)), /R\$|\d\s?%/, cena);
  }
  assert.deepEqual(passosDe('atendimento'), [1, 2, 3, 4, 5, 6]);
});
```

- [ ] **Passo 2: Testes de navegador** em `tests/site/e2e/palco.spec.ts`, mais um caso em `sem-js.spec.ts`. Ajudantes: `quadro(page)` espera dois `requestAnimationFrame`; `rolarProgresso(page, frente, p)` rola até o topo do bloco `[data-frente=frente]` ficar em `innerHeight / 2 - p × 0,75 × altura` e espera um quadro; `montadas(page, cena)` devolve o maior `data-passo` com `data-visivel` naquela cena, ou 0 (um passo pode ter mais de uma peça).

| Projeto | Teste | Esperado |
|---|---|---|
| desktop | a cena da frente da vez fica ativa e as outras não | `rolarProgresso(atendimento, 0.2)`: seção com `data-palco-modo="fixo"`, `[data-cena="atendimento"]` com `data-ativa`, `[data-cena="agentes"]` sem |
| desktop | os passos crescem ao descer e diminuem ao subir | progresso 0 dá `montadas` 1; progresso 1 dá 6; de volta a 0,1 dá 1 |
| desktop | rolar até a segunda frente troca a cena | `rolarProgresso(agentes, 0.2)`: `agentes` ativa, `atendimento` não |
| desktop | o estado vale depois de recarregar no meio da seção | `rolarProgresso(agentes, 0.5)`, `page.reload()` e um quadro: `agentes` ativa |
| desktop | voltar do histórico mantém o estado | `rolarProgresso(agentes, 0.5)`, ir a `/solucoes/`, `page.goBack()` e um quadro: `agentes` ativa |
| desktop em 1280 × 650 | o palco e a última peça cabem na janela | cena 1 com progresso 1: caixa da cena com `y >= 0` e `y + height <= 650`, e a caixa de `[data-cena="atendimento"] [data-passo="6"]` dentro da caixa da cena |
| desktop | abaixo de 1024 px de largura vira cena embaixo do texto | depois de carregar, `setViewportSize({ width: 800, height: 900 })`: `data-palco-modo="local"` |
| desktop | abaixo de 600 px de altura também | depois de carregar, `setViewportSize({ width: 1280, height: 550 })`: `data-palco-modo="local"` |
| desktop | o axe não acusa nada grave na seção | cena 1 montada; esperar `Promise.all(document.getAnimations().map((a) => a.finished))`, para não medir no meio da transição; `new AxeBuilder({ page }).include('[data-palco]')`: nenhuma violação séria ou crítica |
| celular | cada cena fica abaixo da sua frente e se monta ao entrar | `data-palco-modo="local"`; topo da cena 1 abaixo do fim do bloco 1; topo da cena a 90% da janela dá `montadas` 1, a 35% dá 6 |
| todos, com `test.use({ reducedMotion: 'reduce' })` | palco desligado e tudo montado | seção sem `data-palco-modo`; toda peça com `opacity` 1 |
| desktop | a preferência muda com a página aberta | depois de carregar, `page.emulateMedia({ reducedMotion: 'reduce' })`: o atributo some e toda peça fica com `opacity` 1 |
| `sem-js.spec.ts`, desktop e celular | Home sem JavaScript mostra as cenas montadas | seção sem `data-palco-modo`; toda peça de `[data-cena="atendimento"]` com `opacity` 1 |

- [ ] **Passo 3: Ver falhar.** `node --test tests/site/unit/palco.test.mjs` (FALHA: o módulo não existe) e, de `tests/site`, `npx playwright test palco sem-js` (FALHA: a seção `[data-palco]` não existe).

- [ ] **Passo 4: Implementar `assets/site/lib/palco.js`** com as assinaturas acima.

- [ ] **Passo 5: Implementar `iniciarPalco`.** Modo desligado com `(prefers-reduced-motion: reduce)`; `fixo` com `MIDIA_FIXO`; senão `local`. Reavalia no `change` das duas `matchMedia`. `scroll` (passivo) e `resize` só agendam um `requestAnimationFrame`. Um `IntersectionObserver` com `rootMargin: '100% 0px'` liga e desliga o listener de rolagem, e agenda um quadro quando liga. Também agenda um quadro ao iniciar, no `load` e no `pageshow`, porque o navegador pode restaurar a rolagem depois que o módulo roda. Cada quadro lê todas as medidas antes de escrever e só escreve o que mudou. Desligar remove os três atributos de estado.

- [ ] **Passo 6: Marcação e CSS.**
  - `index.html`: a seção nova entra depois de "Duas formas de começar", com a cabeça editorial (8.2), as cinco frentes (número, nome em `h3`, frase curta e etiquetas de 8.1), a cena 1 completa (13.2) e as cenas 2 a 5 só com o `figcaption` e uma peça `data-passo="1"` vazia. A faixa "Quatro frentes" sai. `<script type="module" src="/assets/site/paginas/home.js"></script>` entra logo depois do parcial `head`.
  - `home.css`, onde os estilos `.wo-frentes*` antigos saem:
    - Uma coluna; a partir de 1024 px, `grid-template-columns: 5fr 7fr` com vão de 48 px, blocos na coluna 1 e cenas na coluna 2.
    - Com `[data-palco-modo="fixo"]`: bloco com `min-height: var(--wo-palco-trecho)`; cena em `grid-column: 2; grid-row: 1 / span 5; position: sticky; top: calc(var(--wo-topo-altura) + 32px); align-self: start; height: min(560px, calc(100vh - var(--wo-topo-altura) - 64px))`; cena sem `data-ativa` com `opacity: 0` e `pointer-events: none`.
    - `[data-palco-modo] [data-passo]:not([data-visivel])` com `opacity: 0` e `transform: translateY(8px)`. Transição de 240 ms em `opacity` e `transform`, e no `stroke-dashoffset` do fio. Nenhuma transição sob `prefers-reduced-motion: reduce`.
    - Janela da cena em `--wo-branco`, borda de 1 px em `--wo-linha`, raio `--wo-raio`, sombra `0 24px 48px -24px rgb(22 19 15 / 0.25)`. A tela, sem o cabeçalho, é desenhada para 420 px de altura: é o que sobra na menor janela do modo fixo (1280 × 600).
    - Bloco da frente em `--wo-tinta`; só no modo fixo os blocos sem `data-ativa` ficam em `--wo-tinta-3`. Número sempre em `--wo-violeta`.

- [ ] **Passo 7: Ver passar.** Testes dos passos 1 e 2 nos três projetos, e o portão local: verde.

- [ ] **Passo 8: Material do Portão A.** `tests/site/qa/palco.mjs`, no molde de `qa/og.mjs`: `PW_CHANNEL=chrome node qa/palco.mjs <cena>` sobe o servidor, captura a cena em cada passo em 1440 × 900 e em 390 × 844 (`.tmp-qa/palco/<cena>-<largura>-passo-<n>.png`) e grava a rolagem pela frente em 1440 × 900 com `recordVideo` (`.tmp-qa/palco/<cena>-rolagem.webm`). Rodar para `atendimento`.

- [ ] **Passo 9: Commit.** `git commit -m "feat(site): palco das cinco frentes com a cena de atendimento"`.

- [ ] **Portão A.** Mandar ao Vitor as 12 capturas e o vídeo. As Tarefas 3 a 10 seguem sem esperar. A 11 só começa com o OK, e ajuste pedido na cena 1 entra antes dela.

---

### Tarefa 3: Parciais, topo fixo, WhatsApp flutuante e 404

**Estimativa:** 2 h. **Depende de:** 1. **Leia antes:** spec 5.4, 5.5, 7.7, 7.8, 8.4 e 8.7.

**Arquivos:**
- Criar: `dev/site/parciais/whatsapp-flutuante.html`, `tests/site/e2e/whatsapp.spec.ts`
- Modificar: `dev/site/parciais/topo.html`, `rodape.html`, `cta-final.html` e `head.html`; `assets/site/site.js`; `assets/site/base.css`; `assets/site/components.css`; `404.html`; `assets/site/paginas/erro.css`; as 7 páginas (`data-faixa-escura` e o marcador do flutuante); `tests/site/e2e/topo.spec.ts`; `tests/site/e2e/sem-js.spec.ts`; `tests/site/unit/conteudo.test.mjs`

**Interfaces:**
- Produz em `site.js`: `export function iniciarTopoFixo(doc = document, janela = window): void`, chamada junto com `iniciarTopo`. Escreve `data-topo="fixo"` no `<html>` e `data-estado` no `.wo-topo`: `"escuro"` enquanto o primeiro `[data-faixa-escura]` cruza a faixa do topo (`IntersectionObserver` com `rootMargin` igual a menos a altura do topo, no alto), `"claro"` depois. Página sem `[data-faixa-escura]` fica `"escuro"`.
- O parcial `topo` nasce com `data-estado="escuro"` e `position: absolute`; `html[data-topo="fixo"] .wo-topo` é `position: fixed` (spec 5.5).
- Sem JavaScript, a regra do `<noscript>` que já existe em `head.html` ganha `.wo-topo{position:relative;background:var(--wo-noite)}`: o topo entra no fluxo com fundo escuro, e o menu aberto do celular empurra o título em vez de cobri-lo.
- `base.css` ganha `html { scroll-padding-bottom: 88px }`, para foco e rolagem até um alvo não pararem embaixo do botão flutuante.
- Marcador `<!-- parcial:whatsapp-flutuante --><!-- /parcial:whatsapp-flutuante -->` no fim do `<main>` de toda página menos `contato/index.html`. O parcial é `<a class="wo-whatsapp-flutuante" href="https://wa.me/5534991775784?text=Ol%C3%A1%2C%20WaveOps.%20Vim%20pelo%20site." data-whatsapp="flutuante" aria-label="Falar no WhatsApp">` com o ícone SVG de hoje.
- `data-faixa-escura` marca a primeira faixa escura de cada página: o hero da Home, a abertura das páginas internas e do 404, e o `<main>` do Contato.
- Logo (spec D14 e 5.4): nos parciais `topo` e `rodape`, o `<img>` do selo 3D sai e `.wo-marca__selo` vira o quadrado plano de 34 px, raio `--wo-raio`, `linear-gradient(150deg, var(--wo-marca-claro), var(--wo-marca-escuro))`, sombra `0 6px 18px -6px rgb(139 92 246 / 0.7), inset 0 0 0 1px rgb(139 92 246 / 0.3)`, com o símbolo branco de 23 px. "Wave" no peso normal; `.wo-marca__ops` em peso 700 e `--wo-acento-texto`.
- Peças novas em `components.css`, usadas pelas Tarefas 5 a 10:
  - `.wo-btn--primario`: pílula em `--wo-acento`, texto `--wo-sobre-acento` 14 px peso 500, 40 px de altura (44 px abaixo de 768 px), hover em `--wo-acento-hover`.
  - `.wo-btn--secundario`: pílula de contorno, borda de 1 px em `--wo-borda-forte`; dentro de `.wo-noite`, fundo preto a 30% e borda branca a 25%.
  - `.wo-abertura`: faixa escura das páginas internas (sempre junto com `.wo-noite`), degradê violeta em CSS e respiro superior de `--wo-topo-altura`.
  - `.wo-folha`: conteúdo em `--wo-fundo` que sobe com `--wo-sombra-folha` logo depois da faixa escura.
  - `.wo-cartao-noite`: cartão escuro de 5.4 (fundo `--wo-cartao-noite`, borda `--wo-linha-noite`, raio `--wo-raio`, respiro de 36 px).
  - `.wo-whatsapp-flutuante`: círculo de 56 px em `--wo-whatsapp` com ícone branco, `position: fixed` a 16 px da direita e a `calc(16px + env(safe-area-inset-bottom))` do fim.
  - Topo nos dois estados de 5.5, com 66 px e desfoque em `backdrop-filter` e `-webkit-backdrop-filter`; "Pular para o conteúdo" acima do topo na pilha; rodapé com respiro inferior de 88 px.
- Copy: `cta-final` de 8.4 (à esquerda, os textos de hoje; à direita, `.wo-cartao-noite` com "Como prefere começar?", a opção para `/contato/` e "Falar agora no WhatsApp." com o link e o `data-whatsapp="cta-final"` de hoje). `rodape` com `.wo-noite`, descrição e linha de baixo de 8.7, mais "© 2026 WaveOps. Todos os direitos reservados."; a coluna Projetos sob medida fica com os 4 links de hoje até a Tarefa 6. `404.html` de 7.7, com `wo-abertura wo-noite`.

- [ ] **Passo 1: Testes.**
  - `conteudo.test.mjs`, caso "botão flutuante de WhatsApp em toda página menos Contato": cada página de `paginas.json` tem `<!-- parcial:whatsapp-flutuante` se, e só se, `id !== 'contato'`.
  - `conteudo.test.mjs`, caso "a logo é a plana de antes do selo 3D": nenhuma página de `paginas.json` nem os parciais `topo` e `rodape` citam `waveops-badge-3d`, e os dois parciais têm o símbolo Sine Nodes dentro de `wo-marca__selo`.
  - `topo.spec.ts`, casos novos:

| Projeto | Teste | Esperado |
|---|---|---|
| desktop e celular | o topo nasce escuro e fica claro depois da faixa | no alto, `html[data-topo="fixo"]` e `.wo-topo[data-estado="escuro"]`; depois do fim de `[data-faixa-escura]`, `"claro"`; de volta ao alto, `"escuro"` |
| desktop | recarregar no meio da página mantém o topo claro | rolar 1500 px e `page.reload()`: `"claro"` |
| desktop e celular | âncora de outro sistema não para embaixo do topo | em `/projetos-sob-medida/#modelos`, o topo de `#modelos` fica abaixo do fim do `.wo-topo` |
| desktop | o foco não fica embaixo do topo | em `/solucoes/`, `End`, depois `Shift+Tab` até o foco entrar no `<main>` (no máximo 60 vezes) e mais 10 vezes dentro dele; a cada passo dentro do `<main>`, o `top` do foco é maior ou igual ao fim do `.wo-topo` |
| todos | pular para o conteúdo aparece por cima do topo | depois do primeiro `Tab`, `elementFromPoint` no centro do link devolve o próprio link |

  - `sem-js.spec.ts`, caso "sem JavaScript, o topo não fica fixo" (desktop e celular): `<html>` sem `data-topo`, `.wo-topo` com `position` diferente de `fixed` e `data-estado="escuro"`; no celular, a caixa do `h1` não cruza a de `#menu-movel`.

  - `whatsapp.spec.ts`:

| Projeto | Teste | Esperado |
|---|---|---|
| desktop | aparece em toda página menos Contato | `a[data-whatsapp="flutuante"]`: 1 em cada página de `paginas.json` e 0 em `/contato/` |
| desktop | o clique manda `whatsapp_click` com `local: "flutuante"` | `page.exposeFunction('registrar', ...)`, `window.WaveFunil = { enviar: (n, p) => registrar(n, p) }` e `page.route('https://wa.me/**', (r) => r.fulfill({ body: '' }))`; depois do clique, chega `['whatsapp_click', { local: 'flutuante' }]` |
| desktop em 360 × 740 | não cobre o envio da lista de interesse | em `/plataforma/`, envio de `#form-interesse` rolado com `scrollIntoView({ block: 'end' })`: a caixa dele não cruza a do botão flutuante |
| desktop em 360 × 740 | não cobre o fim do rodapé | rolado até o fim, a caixa de cada link do rodapé não cruza a do botão flutuante |

- [ ] **Passo 2: Ver falhar.** `node --test tests/site/unit/conteudo.test.mjs` e `npx playwright test topo whatsapp`.

- [ ] **Passo 3: Implementar** parciais, `iniciarTopoFixo`, CSS, 404, marcadores e `data-faixa-escura`. `node dev/site/build.mjs`.

- [ ] **Passo 4: Ver passar.** Testes do passo 1, `npx playwright test topo whatsapp sem-js fumaca responsivo a11y-estados` e o axe do 404 (`npx playwright test a11y -g "404"`); portão local.

- [ ] **Passo 5: Commit.** `git commit -m "feat(site): topo fixo de dois estados, rodapé escuro, chamada final e WhatsApp flutuante"`.

---

### Tarefa 4: Vídeo do hero (cena, gravação e servidor)

**Estimativa:** 1,5 h. **Depende de:** nada. **Leia antes:** spec 6.1, 6.2 e 9.5.

**Arquivos:**
- Criar: `dev/site/video/cena.html`, `dev/site/video/cena.js`, `tests/site/qa/video.mjs`, `tests/site/unit/video.test.mjs`; em `assets/site/video/`: `onda-1920.webm`, `onda-1920.mp4`, `onda-1280.webm`, `onda-1280.mp4` e `onda-poster.webp`
- Modificar: `dev/site/serve.mjs`, `tests/site/unit/serve.test.mjs`, `tests/site/types/globais.d.ts` (declara `desenhar?: (t: number) => void` em `Window`, para o typecheck aceitar o `page.evaluate` do `qa/video.mjs`)

**Interfaces:**
- `dev/site/video/cena.js` define `window.desenhar(t)` sobre um `<canvas width="1920" height="1080">`, com o desenho de 6.1. Determinística: semente fixa num gerador próprio (mulberry32, por exemplo), frequências inteiras de `2π / 12` e posição ao longo do fio `(s0 + m × t / 12) mod 1` com `m` inteiro. Assim `desenhar(0)` e `desenhar(12)` dão o mesmo quadro, e o loop fecha.
- `tests/site/qa/video.mjs` (`PW_CHANNEL=chrome node qa/video.mjs`): sobe o servidor como o `og.mjs`, desenha os quadros 0 a 359 (`t = i / 30`) e manda cada PNG a um processo só do ffmpeg (`-f image2pipe -framerate 30 -i -`), que gera os quatro vídeos com `split` e `scale`. Parâmetros de partida: VP9 `-c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -an`; H.264 `-c:v libx264 -preset slow -crf 25 -profile:v high -pix_fmt yuv420p -movflags +faststart -an`. O pôster sai de `desenhar(0)` em WebP (`-c:v libwebp -quality 80`). Antes de gravar, o script compara `canvas.toDataURL()` depois de `desenhar(0)` e depois de `desenhar(12)`: se forem diferentes, o loop tem emenda e o script sai com código 1. Também sai com código 1, imprimindo o tamanho, quando algum arquivo passa do teto.
- Tetos da spec 6.2, em bytes: `onda-1920.*` até `2.5 * 1024 * 1024`; `onda-1280.*` até `1.2 * 1024 * 1024`; `onda-poster.webp` até `120 * 1024`.
- `serve.mjs`: `.webm` como `video/webm` e `.mp4` como `video/mp4`; `Accept-Ranges: bytes`; `Range: bytes=a-b` (um intervalo) responde 206 com `Content-Range: bytes a-b/total`; intervalo fora do arquivo responde 416 com `Content-Range: bytes */total`.

- [ ] **Passo 1: Testes.**
  - `video.test.mjs`: cada um dos 5 arquivos existe e cabe no teto; o WebM começa com os bytes `1a 45 df a3`; o MP4 tem `ftyp` a partir do byte 4; o WebP começa com `RIFF` e tem `WEBP` a partir do byte 8.
  - `serve.test.mjs`, com uma fixture `assets/v.webm` de 1000 bytes: `GET /assets/v.webm` responde `video/webm` com `Accept-Ranges: bytes`; `Range: bytes=0-99` responde 206, 100 bytes e `Content-Range: bytes 0-99/1000`; `Range: bytes=1000-` responde 416.
- [ ] **Passo 2: Ver falhar.** `node --test tests/site/unit/video.test.mjs tests/site/unit/serve.test.mjs`.
- [ ] **Passo 3: Servidor.** MIME e `Range` em `serve.mjs`.
- [ ] **Passo 4: Cena e gravação.** Rodar `PW_CHANNEL=chrome node qa/video.mjs` de `tests/site` e ajustar o CRF até os cinco arquivos caberem nos tetos. Olhar os quadros de 0, 6 e 11,9 s e conferir a costura do loop.
- [ ] **Passo 5: Ver passar.** Testes do passo 1 e portão local.
- [ ] **Passo 6: Commit.** `git commit -m "feat(site): vídeo do hero gerado por código, com servidor local servindo Range"`.

---

### Tarefa 5: Home

**Estimativa:** 2 h. **Depende de:** 1 a 4. **Leia antes:** spec 5.4, 6.3, 6.4, 7.1 e 8.2.

**Arquivos:**
- Criar: `assets/site/lib/video.js`, `tests/site/e2e/video.spec.ts`
- Modificar: `index.html`, `assets/site/paginas/home.js`, `assets/site/paginas/home.css`, `assets/site/components.css`, `tests/site/unit/video.test.mjs`, `tests/site/e2e/topo.spec.ts`, `tests/site/e2e/sem-js.spec.ts`, `tests/site/types/globais.d.ts`

**Interfaces:**
- Produz `assets/site/lib/video.js`:
  - `export const VIDEOS`: objeto congelado `{ webm: { 1280, 1920 }, mp4: { 1280, 1920 } }` com os caminhos de `/assets/site/video/`.
  - `export function escolherVideo(larguraCss, podeTocar): { src: string, tipo: 'video/webm' | 'video/mp4' } | null`, com `podeTocar` igual a `video.canPlayType`. 1920 quando `larguraCss > 1280`, senão 1280. WebM quando `podeTocar('video/webm; codecs="vp9"')` não é vazio; senão MP4 quando `podeTocar('video/mp4; codecs="avc1.640028"')` não é vazio; senão `null`.
  - `export function deveTocar(estado): boolean`, com `estado: { movimentoReduzido, economiaDeDados, carregada, naTela, abaVisivel, pausadoPeloUsuario }`, todos booleanos: verdadeiro só com `carregada`, `naTela` e `abaVisivel` verdadeiros e os outros três falsos.
- Produz em `home.js`: `export function iniciarVideo(doc = document, janela = window): void`.
- `globais.d.ts` declara `Navigator.connection?: { saveData?: boolean }`.
- Marcação do hero:

```html
<section class="wo-home-hero wo-noite" aria-labelledby="home-titulo" data-faixa-escura data-hero>
  <div class="wo-home-hero__fundo" aria-hidden="true">
    <img class="wo-home-hero__poster" src="/assets/site/video/onda-poster.webp" alt="" width="1920" height="1080" fetchpriority="high" />
    <video class="wo-home-hero__video" muted playsinline loop preload="none" disablepictureinpicture tabindex="-1" data-hero-video></video>
  </div>
  <!-- conteúdo de 7.1 linha 1, com a copy de 8.2 -->
  <button class="wo-home-hero__pausa" type="button" aria-pressed="false" aria-label="Pausar vídeo" hidden data-video-pausa><!-- ícones de pausar e tocar --></button>
</section>
```

- O fundo é `position: fixed` em `inset: 0` com `z-index: -1`, atrás da página; o degradê de 55% a 70% e a vinheta ficam no CSS do fundo. O conteúdo depois do hero é `.wo-folha`.
- Duas armadilhas desse fundo: `.wo-home-hero` troca o fundo da `.wo-noite` por `transparent`, senão cobre o vídeo; e o `<html>` não pode ter fundo próprio, para o fundo do `body` ir para o canvas e não pintar por cima do `z-index: -1`.
- O hero da Home usa classes `wo-home-hero...` em `home.css`. O `.wo-hero` de `components.css` continua servindo Soluções, Plataforma e Projetos sob medida até as tarefas delas, e sai na Tarefa 12 se ficar sem uso.
- Peças compartilhadas novas em `components.css`, que Projetos sob medida, Soluções, Contato e Demonstrações usam: colunas numeradas, linhas de definição, tabela de modelos, cartão claro sobre o escuro, selo de situação (forma e cor de 5.4) e etiqueta em caixa alta (5.2).
- Conteúdo: linhas 1, 2, 4, 5 e 6 de 7.1, com a copy de 8.2 (title, description, Open Graph, Twitter, JSON-LD, etiquetas, frase, selo, título e texto do bloco 4). O seletor e os painéis de resultado saem da Home; o conteúdo deles continua em Soluções. O bloco 5 mantém `id="solucoes"` e o 6, `id="como-contratar"`.

- [ ] **Passo 1: Testes.**
  - `video.test.mjs`, casos novos:

```js
test('escolherVideo prefere WebM e escolhe o tamanho pela largura', () => {
  const soWebm = (t) => (t.startsWith('video/webm') ? 'probably' : '');
  const soMp4 = (t) => (t.startsWith('video/mp4') ? 'maybe' : '');
  assert.deepEqual(escolherVideo(1440, soWebm), { src: '/assets/site/video/onda-1920.webm', tipo: 'video/webm' });
  assert.deepEqual(escolherVideo(1280, soWebm), { src: '/assets/site/video/onda-1280.webm', tipo: 'video/webm' });
  assert.deepEqual(escolherVideo(390, soMp4), { src: '/assets/site/video/onda-1280.mp4', tipo: 'video/mp4' });
  assert.equal(escolherVideo(1920, () => ''), null);
});

test('deveTocar exige página carregada, hero na tela, aba visível e nenhum bloqueio', () => {
  const livre = { movimentoReduzido: false, economiaDeDados: false, carregada: true, naTela: true, abaVisivel: true, pausadoPeloUsuario: false };
  assert.equal(deveTocar(livre), true);
  for (const [chave, valor] of [['movimentoReduzido', true], ['economiaDeDados', true], ['carregada', false], ['naTela', false], ['abaVisivel', false], ['pausadoPeloUsuario', true]]) {
    assert.equal(deveTocar({ ...livre, [chave]: valor }), false, chave);
  }
});
```

  Mais um caso: todo caminho de `VIDEOS` e o `src` do `.wo-home-hero__poster` de `index.html` existem em disco.
  - `video.spec.ts`, nos projetos desktop e celular:

| Teste | Esperado |
|---|---|
| toca depois do `load` com movimento liberado | `video.paused` falso; `currentSrc` termina em `onda-1920.webm` no desktop e em `onda-1280.webm` no celular |
| com menos movimento, não toca e o pôster fica | com `reducedMotion: 'reduce'`: `currentSrc` vazio, pôster visível, botão de pausa escondido |
| o botão pausa e retoma | um clique: `aria-pressed="true"` e vídeo pausado; outro: `"false"` e tocando; o nome continua "Pausar vídeo" |
| pausa fora da tela e retoma na volta | rolar até o fim: pausado; voltar ao alto: tocando |
| pausa quando a preferência muda com a página aberta | `page.emulateMedia({ reducedMotion: 'reduce' })`: pausado e botão escondido |
| se `play()` falhar, fica o pôster | `page.addInitScript` troca `HTMLMediaElement.prototype.play` por uma promessa rejeitada: pôster visível, vídeo sem `data-tocando`, console sem erro |
| com economia de dados, não toca | `page.addInitScript` define `navigator.connection` como `{ saveData: true }`: `currentSrc` vazio e botão escondido |
| nada de vídeo antes do `load` | `page.addInitScript` embrulha o setter de `HTMLMediaElement.prototype.src` e anota se ele rodou antes do evento `load`: nunca rodou antes |
| o fundo do hero aparece atrás do texto (só desktop) | com `reducedMotion: 'reduce'`: `background-color` de `html` e de `.wo-home-hero` é `rgba(0, 0, 0, 0)`; uma captura de 40 × 40 px colada na borda esquerda, a 40% da altura do hero (margem sem texto), decodificada num canvas de uma aba em branco, tem luminância média abaixo de 0,3 (o creme passa de 0,9) |
| nenhum erro no console | `console` do tipo erro e `pageerror` vazios em todos os casos acima |

  - `topo.spec.ts`: "seletor da Home troca o painel" vira "seletor da Plataforma troca o painel por teclado", em `/plataforma/`, com os botões de nome `/^Automações/` e `/^Visão geral/` e os painéis `#tela-automacoes` e `#tela-visao-geral`.
  - `sem-js.spec.ts`: o caso dos cinco resultados da Home vira "Home sem JavaScript mostra o pôster, o vídeo sem fonte e o botão de pausa escondido", e confere os cinco links de resultado visíveis.
- [ ] **Passo 2: Ver falhar.** `node --test tests/site/unit/video.test.mjs` e `npx playwright test video topo sem-js`.
- [ ] **Passo 3: Implementar `lib/video.js` e `iniciarVideo`.** Com menos movimento, economia de dados ou `escolherVideo` nulo, nada acontece e o botão continua `hidden`. Nos outros casos, o botão aparece e o módulo acompanha `load` (ou `readyState === 'complete'`), um `IntersectionObserver` no `[data-hero]`, `visibilitychange`, o `change` da preferência de movimento e o clique no botão. A cada mudança aplica `deveTocar`: põe o `src` na primeira vez e chama `play().catch(() => {})`, ou chama `pause()`. No evento `playing`, marca `data-tocando` no vídeo, que então aparece por cima do pôster. Se a preferência por menos movimento liga com a página aberta, pausa e esconde o botão; se desliga, mostra o botão e reaplica.
- [ ] **Passo 4: Marcação e CSS da Home** (7.1 e 8.2).
- [ ] **Passo 5: Ver passar.** `node --test tests/site/unit/video.test.mjs`; `npx playwright test video topo sem-js palco fumaca responsivo resiliencia legado`; axe da Home (`npx playwright test a11y -g "spec.ts / sem"`); portão local.
- [ ] **Passo 6: Commit.** `git commit -m "feat(site): Home no novo visual, com vídeo no hero"`.

---

### Tarefa 6: Projetos sob medida, com o rodapé das cinco frentes

**Estimativa:** 1,5 h. **Depende de:** 3 e 5. **Leia antes:** spec 7.3, 8.1, 8.3 e 8.7.

**Arquivos:**
- Modificar: `projetos-sob-medida/index.html`, `assets/site/paginas/sobmedida.css`, `assets/site/components.css`, `dev/site/parciais/rodape.html`, `tests/site/unit/conteudo.test.mjs`

**Interfaces:**
- Produz âncoras em `/projetos-sob-medida/`: `#frentes` na seção; `#atendimento`, `#agentes`, `#dashboards`, `#crms` e `#saas`, uma por frente; `#automacoes`, `#integracoes` e `#sistemas` como alvos vazios no topo da seção. A Tarefa 7 linka para as novas.
- O `h3` de cada frente mantém a classe `wo-sobmedida-frente__nome`.
- Produz em `components.css` a lista editorial de 5.4 (`.wo-lista-editorial` e filhos), que Soluções também usa.

- [ ] **Passo 1: Testes** em `conteudo.test.mjs`. O caso das quatro frentes sai; entram:

```js
test('Projetos sob medida apresenta as cinco frentes da base WaveOps', () => {
  const html = ler('projetos-sob-medida/index.html');
  const nomes = [...html.matchAll(/<h3 class="wo-sobmedida-frente__nome">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(nomes, ['Automação de atendimento', 'Agentes de IA', 'Dashboards', 'CRMs sob medida', 'SaaS']);
});

test('as âncoras das frentes existem, as novas e as de antes de 15/10/2026', () => {
  const html = ler('projetos-sob-medida/index.html');
  const secao = html.slice(html.indexOf('id="frentes"'));
  for (const id of ['atendimento', 'agentes', 'dashboards', 'crms', 'saas', 'automacoes', 'integracoes', 'sistemas']) {
    assert.ok(secao.includes(`id="${id}"`), `#${id} fora da seção #frentes`);
  }
  for (const antiga of ['automacoes', 'integracoes', 'sistemas']) {
    assert.ok(secao.indexOf(`id="${antiga}"`) < secao.indexOf('id="atendimento"'), `#${antiga} tem de cair no topo da seção`);
  }
});

test('o rodapé leva às cinco frentes', () => {
  const rodape = ler('dev/site/parciais/rodape.html');
  const destinos = [...rodape.matchAll(/href="\/projetos-sob-medida\/#([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(destinos, ['atendimento', 'agentes', 'dashboards', 'crms', 'saas']);
});
```

- [ ] **Passo 2: Ver falhar.** `node --test tests/site/unit/conteudo.test.mjs`.
- [ ] **Passo 3: Implementar** a página (7.3, com a copy de 8.3), a coluna do rodapé (os 5 nomes de 8.1 com as âncoras novas) e o CSS. `node dev/site/build.mjs`.
- [ ] **Passo 4: Ver passar.** Teste do passo 1; `MSYS_NO_PATHCONV=1 npx playwright test a11y fumaca responsivo -g "/projetos-sob-medida/"`; `npx playwright test legado`; portão local. O teste de links do portal roda na Tarefa 13.
- [ ] **Passo 5: Commit.** `git commit -m "feat(site): Projetos sob medida com as cinco frentes no novo visual"`.

---

### Tarefa 7: Soluções

**Estimativa:** 1 h. **Depende de:** 6. **Leia antes:** spec 7.2 e 8.5.

**Arquivos:**
- Modificar: `solucoes/index.html`, `assets/site/paginas/solucoes.css`, `tests/site/unit/conteudo.test.mjs`

**Interfaces:**
- Consome da Tarefa 6: âncoras `/projetos-sob-medida/#atendimento`, `#agentes`, `#dashboards`, `#crms` e `#saas`.
- Em cada resultado, "Como contratar" é o `<dd id="<resultado>-contratar">` das linhas de definição (7.2), e cada frente dentro dele é um link para a âncora dela.

- [ ] **Passo 1: Teste** em `conteudo.test.mjs`:

```js
test('Soluções indica as cinco frentes em Como contratar (spec 8.5)', () => {
  const html = ler('solucoes/index.html');
  const esperado = {
    vender: ['Automação de atendimento', 'CRMs sob medida', 'Dashboards'],
    atender: ['Automação de atendimento', 'Agentes de IA'],
    operar: ['CRMs sob medida', 'SaaS', 'Agentes de IA'],
    decidir: ['Dashboards', 'CRMs sob medida'],
    crescer: ['SaaS', 'Dashboards'],
  };
  for (const [id, frentes] of Object.entries(esperado)) {
    const inicio = html.indexOf(`id="${id}-contratar"`);
    assert.ok(inicio > 0, `#${id}-contratar não encontrado`);
    const bloco = html.slice(inicio, html.indexOf('</dd>', inicio));
    const nomes = [...bloco.matchAll(/href="\/projetos-sob-medida\/#(?:atendimento|agentes|dashboards|crms|saas)"[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual(nomes, frentes, id);
  }
});
```

- [ ] **Passo 2: Ver falhar.** `node --test tests/site/unit/conteudo.test.mjs`.
- [ ] **Passo 3: Implementar** a página (7.2, com 8.5). Os itens de "O que a WaveOps constrói" continuam.
- [ ] **Passo 4: Ver passar.** Teste do passo 1; `MSYS_NO_PATHCONV=1 npx playwright test a11y fumaca responsivo -g "/solucoes/"`; `npx playwright test topo legado`; portão local.
- [ ] **Passo 5: Commit.** `git commit -m "feat(site): Soluções no novo visual, com as cinco frentes"`.

---

### Tarefa 8: Plataforma (só o visual)

**Estimativa:** 1 h. **Depende de:** 3 e 5. **Leia antes:** spec 5.4 e 7.4.

**Arquivos:**
- Modificar: `plataforma/index.html` (só classes e estrutura visual), `assets/site/paginas/plataforma.css`, `assets/site/components.css` se surgir peça compartilhada

**Interfaces:**
- Consome: `.wo-abertura`, `.wo-noite`, `.wo-cartao-noite`, `.wo-folha`, selo e colunas da Tarefa 5. Textos, IDs, `#lista`, `#modulos`, o seletor de telas e os ganchos do formulário não mudam.

- [ ] **Passo 1: Ver o vermelho.** `MSYS_NO_PATHCONV=1 npx playwright test a11y -g "/plataforma/"` (esperado: falha, a página ainda está no visual antigo sobre os tokens novos). Confirmar verdes `node --test tests/site/unit/conteudo.test.mjs` e `npx playwright test interesse whatsapp topo`.
- [ ] **Passo 2: Implementar** a 7.4: abertura em noite com o formulário de interesse num `.wo-cartao-noite` e a maquete do workspace; seções seguintes alternando papel e papel 2, com seletor de telas, colunas de módulos com selos, tabela de comparação e princípios da assinatura nas peças novas.
- [ ] **Passo 3: Ver passar.** Os comandos do passo 1, mais `MSYS_NO_PATHCONV=1 npx playwright test fumaca responsivo resiliencia -g "/plataforma/"` e `npx playwright test a11y-estados` (o caso da lista de interesse não casa com o filtro por URL); portão local.
- [ ] **Passo 4: Commit.** `git commit -m "feat(site): Plataforma no novo visual"`.

---

### Tarefa 9: Contato

**Estimativa:** 1 h. **Depende de:** 3 e 5. **Leia antes:** spec 5.4 e 7.5.

**Arquivos:**
- Modificar: `contato/index.html`, `assets/site/paginas/contato.css`

**Interfaces:**
- A página inteira em noite: `<main id="conteudo" tabindex="-1" class="wo-noite" data-faixa-escura>`. Campos, estados, mensagens, IDs, `data-*` e envio não mudam. Sem o marcador do flutuante.

- [ ] **Passo 1: Ver o vermelho.** `MSYS_NO_PATHCONV=1 npx playwright test a11y -g "/contato/"` (esperado: falha). Confirmar verdes `npx playwright test contato sem-js whatsapp`.
- [ ] **Passo 2: Implementar** a 7.5: à esquerda, selo, título, texto, as 3 garantias e os 2 canais em linhas; à direita, o formulário num `.wo-cartao-noite`; embaixo, "O que acontece a seguir." em colunas numeradas no escuro.
- [ ] **Passo 3: Ver passar.** Os comandos do passo 1, mais `node --test tests/site/unit/peso.test.mjs` (Contato até 20 KB de JavaScript); portão local.
- [ ] **Passo 4: Commit.** `git commit -m "feat(site): Contato no novo visual"`.

---

### Tarefa 10: Demonstrações técnicas

**Estimativa:** 0,5 h. **Depende de:** 5. **Leia antes:** spec 7.6 e 8.6.

**Arquivos:**
- Modificar: `demonstracoes-tecnicas/index.html`, `assets/site/paginas/demonstracoes.css`, `tests/site/e2e/demonstracoes.spec.ts`

**Interfaces:**
- Botões do filtro com `data-categoria` `todas`, `atendimento`, `agentes`, `dashboards`, `crms` e `saas`, com os rótulos de 8.6. `data-categorias` de cada fluxo pela tabela de 8.6; a triagem com IA leva `atendimento agentes`. `assets/site/paginas/demonstracoes.js` não muda: ele já aceita mais de uma categoria por fluxo.

- [ ] **Passo 1: Teste.** Em `demonstracoes.spec.ts`, a fixture passa a ser:

```ts
/* As cinco frentes da base WaveOps (decisão de 15/10/2026). A triagem com IA conta em duas frentes. */
const FRENTES = [
  { botao: 'Atendimento', titulos: ['Triagem com IA e revisão humana.'] },
  { botao: 'Agentes de IA', titulos: ['Triagem com IA e revisão humana.'] },
  { botao: 'Dashboards', titulos: ['Da planilha ao painel com acesso por perfil.'] },
  { botao: 'CRMs', titulos: ['Cobrança e relatório recorrentes, sem clique manual.', 'Um cadastro, vários sistemas atualizados.'] },
  { botao: 'SaaS', titulos: ['Pedido, pagamento e estoque no mesmo fluxo.'] },
] as const;
const TOTAL = 5;
```

  Os outros casos do arquivo que citam frente antiga mudam junto: em "trocar de frente sem acumular", "Integração" vira "CRMs"; em "anunciar a contagem", "Automação" vira "Atendimento" e o texto esperado vira "Mostrando 1 de 5 demonstrações. Frente: Atendimento."; em "filtrar pelo teclado", "Sistemas e painéis" vira "Dashboards".

- [ ] **Passo 2: Ver falhar.** `npx playwright test demonstracoes`.
- [ ] **Passo 3: Implementar** a 7.6 e o texto de abertura de 8.6.
- [ ] **Passo 4: Ver passar.** `npx playwright test demonstracoes` nos três projetos; `MSYS_NO_PATHCONV=1 npx playwright test a11y fumaca responsivo -g "/demonstracoes-tecnicas/"`; portão local.
- [ ] **Passo 5: Commit.** `git commit -m "feat(site): Demonstrações técnicas com as cinco frentes no novo visual"`.

---

### Tarefa 11: Cenas 2 a 5 (depois do Portão A)

**Estimativa:** 2,5 h. **Depende de:** 2, 5 e o OK do Vitor na cena 1. **Leia antes:** spec 13.2 a 13.5 e os ajustes que o Vitor pediu no Portão A.

**Arquivos:**
- Modificar: `index.html`, `assets/site/paginas/home.css`, `tests/site/unit/palco.test.mjs`, `tests/site/e2e/palco.spec.ts`

**Interfaces:**
- Consome o contrato de marcação e as peças da cena 1 (Tarefa 2). Peças que as cenas repetem (janela, cartão, fio, etiqueta, barra) ficam num bloco comum de `home.css`, não uma vez por cena.

- [ ] **Passo 1: Testes.** Em `palco.test.mjs`, toda cena passa a exigir `assert.deepEqual(passosDe(cena), [1, 2, 3, 4, 5, 6], cena)`. Em `palco.spec.ts`, caso "desktop: as cinco cenas se sucedem na ordem": para cada frente, `rolarProgresso(frente, 1)` deixa aquela cena com `data-ativa` e 6 peças montadas.
- [ ] **Passo 2: Ver falhar.** `node --test tests/site/unit/palco.test.mjs` e `npx playwright test palco`.
- [ ] **Passo 3: Implementar** as cenas 2 a 5 da tabela 13.2, com os ajustes que o Vitor pedir no Portão A.
- [ ] **Passo 4: Ver passar.** `npx playwright test palco sem-js fumaca responsivo resiliencia`; axe da Home (`npx playwright test a11y -g "spec.ts / sem"`); `node --test tests/site/unit/peso.test.mjs` (CSS da Home até 25 KB); `PW_CHANNEL=chrome node qa/palco.mjs <cena>` para as quatro cenas, com as capturas conferidas a olho; portão local. Em `palco.spec.ts`, mais um caso: com `reducedMotion: 'reduce'` as cinco cenas ficam visíveis ao mesmo tempo, e `new AxeBuilder({ page }).include('[data-palco]')`, depois de `document.fonts.ready`, não acusa nada sério ou crítico. É o único jeito de o axe medir as cinco: cena com opacidade zero conta como oculta.
- [ ] **Passo 5: Commit.** `git commit -m "feat(site): cenas de agentes, dashboards, CRMs e SaaS no palco"`.

---

### Tarefa 12: Textos fora das páginas, limpeza e documentação

**Estimativa:** 1 h. **Depende de:** 2 a 11. **Leia antes:** spec 8.8 e 10.

**Arquivos:**
- Criar: `tests/site/unit/css-morto.test.mjs`
- Modificar: `llms.txt`, `sitemap.xml`, `dev/site/og.html`, `dev/site/og.css`, `assets/og-waveops.png`, `assets/site/tokens.css`, CSS com regra sem uso, `CLAUDE.md`, `README.md`, `dev/site/README.md`, `tests/site/unit/conteudo.test.mjs`

- [ ] **Passo 1: Testes.**
  - Em `conteudo.test.mjs`:

```js
test('nenhuma página nem o llms.txt falam em quatro frentes', () => {
  for (const p of paginas) assert.doesNotMatch(ler(p.arquivo), /quatro frentes/i, p.arquivo);
  const llms = ler('llms.txt');
  assert.doesNotMatch(llms, /quatro frentes/i);
  assert.match(llms, /automação de atendimento, agentes de IA, dashboards, CRMs sob medida e SaaS/i);
});
```

  - `css-morto.test.mjs`, três casos:
    - toda classe `wo-...` que aparece num seletor de `components.css` ou de `assets/site/paginas/*.css` aparece numa página, num parcial, em `dev/site/og.html` ou num arquivo de `assets/site/**/*.js`;
    - todo `var(--wo-...)` sem valor de reserva em `assets/site/**/*.css` tem definição em `tokens.css` ou na própria folha (hoje existem `--wo-plataforma-tracejado` e `--wo-sobmedida-acento-escuro`), porque variável apagada vira valor inválido em silêncio;
    - `tokens.css` não tem mais o bloco `Legado` nem `--wo-mono`.
- [ ] **Passo 2: Ver falhar.** `node --test tests/site/unit/conteudo.test.mjs tests/site/unit/css-morto.test.mjs`.
- [ ] **Passo 3: Implementar.**
  - `llms.txt` com 8.8.
  - `sitemap.xml` com `lastmod` do dia.
  - `og.html` e `og.css` no novo visual, com a logo plana de D14 no lugar do selo 3D; regerar com `cd tests/site && PW_CHANNEL=chrome node qa/og.mjs`.
  - Apagar o bloco `Legado` de `tokens.css` e as regras que o teste acusar.
  - `CLAUDE.md` com a lista da spec 10, mais: como refazer o vídeo (`qa/video.mjs`), o material de aprovação de cena (`qa/palco.mjs`), o topo fixo, o parcial do flutuante, o módulo `paginas/home.js` e a seção "Marca" (logo plana de D14; selo 3D fora das páginas). `assets/brand/README.md` ganha a mesma nota.
  - `README.md` e `dev/site/README.md`: visual, tabela de classes e regras para quem edita página.
- [ ] **Passo 4: Ver passar.** Testes do passo 1 e portão local.
- [ ] **Passo 5: Commit.** `git commit -m "docs(site): llms.txt, imagem de compartilhamento e documentação do novo visual"`.

---

### Tarefa 13: Verificação final, revisão e PR (Portão B)

**Estimativa:** 1 h, mais a espera da revisão. **Depende de:** todas. **Leia antes:** spec 2, 9.3 e 9.4.

- [ ] **Passo 1: Portão completo** da spec 9.3, com as duas rodadas do Playwright (o Chromium dele, como o CI, e `PW_CHANNEL=chrome`), mais `npm ci --prefix portal` (precisa de rede: o `postinstall` roda o `prisma generate`) e `npm --prefix portal run test:unit`, que guarda os links do portal para o site. Tudo verde.
- [ ] **Passo 2: Capturas.** `DESIGN_CAPTURAS=<pasta vazia> PW_CHANNEL=chrome node qa/visual.mjs` grava `.tmp-qa/capturas/`. Comparar a olho, em 1440 e 390 px, com as capturas locais da referência (caminho no cabeçalho da spec): paleta, tipografia, ritmo das seções e componentes. Anotar as diferenças.
- [ ] **Passo 3: Peso.** `node tests/site/qa/peso.mjs` e guardar a tabela para o PR.
- [ ] **Passo 4: Sigilo e escrita.** O nome da referência (cabeçalho da spec) não aparece em `git diff main...HEAD` nem em `git log main..HEAD`. O lint só varre HTML, `llms.txt`, `robots.txt` e `assets/site`, então conferir travessão e meia-risca no resto: `git diff main...HEAD | LC_ALL=C grep -caP '\xe2\x80[\x93\x94]'` e o mesmo sobre `git log main..HEAD` (o padrão casa com os bytes dos dois caracteres em UTF-8). Esperado: zero nas quatro buscas.
- [ ] **Passo 5: Revisão independente.** Um agente que não implementou revisa o branch inteiro contra a spec e este plano. Achado bloqueante volta para a tarefa dona, e o passo 1 roda de novo.
- [ ] **Passo 6: PR.** `git push -u origin feat/site-novo-visual`; `gh pr create --base main --title "feat(site): novo visual, vídeo no hero e palco das cinco frentes"`, com resumo, testes, a tabela de peso e o que o Vitor precisa conferir. Registrar o PR na thread do T3 Code.
- [ ] **Passo 7: Deploy Preview.** `SITE_URL=<url do preview> PW_CHANNEL=chrome node qa/preview.mjs`: verde.
- [ ] **Portão B.** O Vitor confere o Deploy Preview e o iPhone: vídeo tocando, botão de pausa, topo fixo, menu e palco. O merge é dele.

## Rollback

Reverter o merge. Nenhuma mudança de dado, contrato ou infraestrutura: o portal, os formulários e o funil continuam iguais.
