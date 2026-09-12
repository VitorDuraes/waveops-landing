@.claude/waveops-base.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Desvio de stack (registrado):** este projeto é uma landing page estática (HTML/CSS/JS), não a stack default Next.js/Drizzle da WaveOps. A rule `.claude/rules/nextjs-drizzle.md` e os comandos baseados em `npm run lint/build/test` são referência, não se aplicam aqui. Valem integralmente: o hook `secret-scan`, a rule de segurança/LGPD e a rule de copy PT-BR (esta é crítica para a copy da landing).

## What this is

WaveOps is a single institutional landing page (cinematic aesthetic, dark theme by default with a light toggle, PT-BR) for an automation/dev/AI consultancy. All copy is Brazilian Portuguese. (The repo and GitHub Pages path are still named `flowops-landing` from the old name; the live brand is WaveOps.)

There is **no build step and no package manager**. The production page is plain HTML + CSS + JS.
De 09/09/2026 a 11/09/2026 a página carregou React 19 como ESM pré-compilado, vendorizado em
`assets/vendor/`, só para desenhar o campo de partículas do hero. Em **11/09/2026 o starfield foi
portado para JavaScript puro** e o React saiu do caminho crítico. **Não há React em produção.**

O único `<script type="module">` do `index.html` é `assets/starfield.mjs`, e o grafo de import dele
tem dois arquivos. Medido em 11/09/2026 com `gzip -9` sobre cada arquivo:

| Módulo | gzip | Quando carrega |
|---|---|---|
| `assets/starfield.mjs` | 8,5 KB | sempre (é o próprio `<script type="module">`) |
| `assets/scroll-signal.mjs` | 0,6 KB | sempre |
| **Total do island do hero** | **9,1 KB** | |

Somando os scripts clássicos (`analytics.js`, `meta-pixel.js`, `theme-store.js`, `motion.js`,
`main.js`, `cinema.js`, `operacao.js`), a página baixa **27,5 KB gzip de JavaScript próprio,
em 9 arquivos**, e **55,3 KB gzip de CSS em 6 arquivos**. Medido em 12/09/2026. O CSS é hoje
o dobro do JavaScript, e metade dele é `assets/cinema.css` (22,8 KB gzip), que desenha as
cinco maquetes de produto de "O que fazemos".
Antes do porte eram **84,2 KB em 13 arquivos**. A queda foi de **61,4 KB gzip**, e 61,2 KB disso
era React.

Ficaram vendorizados e **sem consumidor em produção**: `assets/vendor/react-dom-client.mjs`
(56,6 KB gzip), `assets/vendor/react.mjs` (3,8 KB), `assets/vendor/jsx-runtime.mjs` (0,8 KB),
`assets/vendor/framer-shim.mjs` (0,9 KB), `assets/vendor/framer-motion.mjs` (48,7 KB),
`assets/vendor/emotion-is-prop-valid.mjs` (2,2 KB) e o antigo `assets/starfield-mount.mjs`
(1,1 KB). Quem ainda importa esses arquivos é código fora da página: `assets/sequence-mount.mjs` e
`assets/image-sequence.mjs` (o island da sequência de "Como funciona", que o `index.html` não
carrega hoje) e `dev/smoke-react.html`. Eles ficam no repo porque regenerar depois custa mais caro
que manter parado. Não cite o peso deles como custo de página, e apagar é decisão do dono.

**A sequência de quadros em si** (`assets/sequence/`, 48 WebP) pesa **309,1 KB** em bytes brutos,
medido em 10/09/2026, abaixo do teto de 400 KB do plano da fase 2. Gzip não ajuda nesses arquivos
porque WebP já é um formato comprimido (um quadro amostrado caiu de 10864 para 10762 bytes com
`gzip -9`, menos de 1%), então o peso relevante é o tamanho em disco. Esses 309,1 KB nunca entram
no cálculo de JS acima porque não são módulo: são o `src` de `<img>` que o `ImageSequence` seta
depois de montado, carga preguiçosa de verdade, via `IntersectionObserver` com `rootMargin: '600px
0px'` observando a seção, e **nunca no mobile**: o mount confere `window.matchMedia('(min-width:
768px)')` antes de montar, então abaixo de 768px nenhum quadro é baixado, ponto.

There is still no npm, no `node_modules`, no bundler and no Babel. Regenerate the vendored modules
with `python _fetch_vendor.py`; see `assets/vendor/README.md`.

## Running it

The entry file is `index.html` (renamed from `FlowOps Landing.html` so GitHub Pages serves it at the site root). Serve it from a static server (the project README recommends the VS Code **Live Server** extension). `file://` mostly works now that there are no CDN scripts, but a static server is still preferred since the relative `assets/` paths and the lead-form `fetch` expect an HTTP origin. Nothing to compile or install.

## Architecture

### Script load order (intentional, do not reorder)
In `<head>`, in order: the CSP `<meta>` (must come first, before any resource), then
`assets/fonts.css` + `assets/styles.css` + `assets/cinematic.css` + `assets/cinema.css` +
`assets/motion-system.css` + `assets/operacao.css`, then the async Plausible script
(`plausible.io`), then `assets/analytics.js` (Plausible bootstrap), then `assets/theme-store.js`.
At the end of `<body>`: `assets/motion.js`, `assets/main.js`, `assets/operacao.js`,
`assets/cinema.js` (defer), `assets/starfield.mjs` (module).

**A ordem das duas folhas novas importa.** `motion-system.css` declara o vocabulário de
movimento em `:root` (quatro curvas, quatro durações, o passo do escalonamento e os
deslocamentos). `assets/styles.css` consome esse vocabulário nas regras de `.reveal` e
`.stagger`, mas as custom properties são resolvidas no valor computado, então a ordem de
carga não quebra: o que não pode acontecer é `motion-system.css` sair da página, porque aí
os `var(--t-calmo, 550ms)` caem nos fallbacks e a página perde o ritmo comum.
`operacao.css` carrega por último de propósito: ele sobrescreve `styles.css`, `cinematic.css`
e `cinema.css` sem precisar de `!important`.
1. `assets/theme-store.js` in `<head>` applies the theme attributes before paint (prevents a flash of the wrong theme).
2. `assets/analytics.js` holds the Plausible queue stub + `init()` (moved out of an inline `<script>` so the CSP can use `script-src 'self'` without `'unsafe-inline'`). Do not re-inline it.
3. `assets/main.js` at the end of `<body>` wires all DOM interactions.
4. `assets/operacao.js` carrega depois do `main.js` e antes do `cinema.js`. Ele depende de
   `data-motion` já estar escrito no `<html>` (quem escreve é o `motion.js`) e escuta
   `waveops:motion`. Ele não depende do `main.js`, mas convive com ele: quem liga
   `.is-visible` continua sendo o observador do `main.js`.

After `assets/main.js`, `assets/starfield.mjs` loads as `<script type="module">`. It is plain
JavaScript, no React and no framework: it creates the `<canvas>` inside `#hero-starfield`, runs the
particle loop, reads colors from the CSS tokens through `FlowTheme` and pauses on the
`waveops:motion` event. The module exports `criarStarfield(container, opcoes)`, which returns
`{ definirPausa, definirCores, destruir }`, and mounts itself at the bottom of the same file. It
has no import map on purpose: every specifier is relative, so the CSP stays at `script-src 'self'`.
If the module fails, the CSS `.dots-bg` fallback stays visible.

Four rules that the island depends on and that are easy to break:
1. **Cache-busting reaches the sub-imports.** The `<script>` tag carries `?v=20260911a` like its
   neighbours, but a query string on the tag does not reach relative sub-imports. The only
   sub-import left is `./scroll-signal.mjs?v=`, which carries the version in the specifier itself.
   Bump both together. The `assets/vendor/` modules are no longer in the graph.
2. **Paused must still paint.** `construirGrade()` sets `canvas.width`, which wipes the canvas. So
   `definirPausa(true)` repaints through `desenharQuadroEstatico()`, and the debounced
   `ResizeObserver` callback repaints whenever no animation loop is running (`pausado || !visivel`).
   Without that, a visitor with `prefers-reduced-motion: reduce`, or anyone pressing
   `#motion-toggle`, gets an empty hero: the `:has()` rule in `styles.css` keeps `.dots-bg` at
   `opacity: 0` as long as the canvas element exists, so the CSS fallback does not come back.
3. **Cursor events are listened for on `window`, not on the island.** `#hero-starfield` keeps
   `pointer-events: none` so it never steals clicks from the nodes and the wires, and
   `svg.flow-wires` covers it anyway. `pointerToLocal()` converts page coordinates to container
   coordinates through `container.getBoundingClientRect()`.
4. **The loop stops off screen.** An `IntersectionObserver` flips `visivel`; `animate()` returns
   early when it is false and the observer restarts the loop when the hero comes back. Every
   listener and both observers are removed in `destruir()`.

Uma diferença de comportamento em relação à versão React, medida e aceita: no React, mudar a prop
`paused` derrubava o efeito inteiro e reconstruía a grade, o que ressorteava as estrelas e zerava a
rotação delas. Agora pausar só congela o quadro. A diferença de tinta no canvas foi de 0,19%.

No Babel, no build step, **no React in production**. The only remaining third-party network requests
are the async Plausible script and the Meta Pixel; everything else (fonts, CSS, JS) is self-hosted.
The Tweaks panel and its React/Babel CDN scripts were removed from the page; the sources now live in
`dev/`.

### Security hardening (HTTP/CSP, fonts, anti-bot)
- **CSP** is a `<meta http-equiv="Content-Security-Policy">` at the very top of `<head>`. If you add a third-party origin (script, font, image, or a `fetch`/`connect` target), you must add it to the matching directive or the browser blocks it. `connect-src` currently allows the n8n webhook host and `plausible.io`; `script-src` allows `plausible.io`. `style-src` keeps `'unsafe-inline'` because the HTML uses inline `style=` attributes (low risk; not worth a full refactor). `frame-ancestors`/`X-Frame-Options` only work as HTTP headers, which GitHub Pages can't set, so clickjacking protection is pending a host that allows headers.
- **Fonts are self-hosted** in `assets/fonts/` (woff2) with `@font-face` in `assets/fonts.css`. Regenerate with `python _fetch_fonts.py` (downloads only the weights used; Sora was dropped as unused). Do not re-add the Google Fonts `<link>`.
- **Anti-bot** on both lead forms: a hidden honeypot field (`website`/`#f-website`/`#cl-website`) plus a minimum fill-time gate (`MIN_FILL_MS` in `main.js`). Both only stop bots that render the page; bots posting straight to the webhook need server-side defense. See `docs/specs/SECURITY-n8n-hardening.md`.

### Brand / logo (single canonical mark)
The official WaveOps mark is "Sine Nodes": a symmetric sine wave (two humps) crossing a central hollow hub (a stroked ring), with two solid round nodes at the ends. The wave is the flow, the hub is the operation, the end nodes are the connected points. The full kit lives in `assets/brand/`: `waveops-icon.svg` (squircle app icon/favicon, gradient `#8b5cf6`→`#6d28d9`), `waveops-symbol.svg` (violet on transparent), `waveops-symbol-mono.svg` (`currentColor`), `waveops-lockup.svg` (mark + "WaveOps"), plus `png/` exports (icon-512, icon, symbol, symbol-white) and its own `README.md`. Canonical geometry, `viewBox="0 0 100 100"`, `stroke-width="5"`, round caps:
```
<g stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 50 Q 30 33 41 50"/><path d="M59 50 Q 70 67 82 50"/>   <!-- the two wave humps -->
</g>
<circle cx="50" cy="50" r="9" fill="none" stroke="#fff" stroke-width="5"/>  <!-- central hollow hub -->
<circle cx="18" cy="50" r="7.5" fill="#fff"/><circle cx="82" cy="50" r="7.5" fill="#fff"/>  <!-- solid end nodes -->
```
Stroke is `#fff` on a violet chip / dark / violet bg (shown above), `#7c3aed` on a light bg. The hub is `fill="none"`, so the background shows through its centre. The white variant is inlined in the nav and footer of `index.html` (inside `.brand .mark`, over the 3D badge), and is the source for `assets/favicon.svg` (= the kit `waveops-icon.svg`), `assets/apple-touch-icon.png` (full-bleed gradient, regenerated via `assets/_appicon.html`), `assets/favicon-32.png`, the `assets/og-image.*` card, and the `assets/checklist.*` PDF. If you change the canonical mark geometry, update every one of those in lockstep and regenerate the PNG/PDF (Chrome headless `--screenshot` / `--print-to-pdf`). Do NOT regress to either retired mark: the earlier "onda + nó" single-hollow-ring (path `Q 31 30 34 18.6`, `viewBox 0 0 48 48`) or the green FlowOps node-graph (`#03140d`, `viewBox 0 0 24 24`, path `M7 7l9 4`).

The header and footer marks use `assets/brand/waveops-badge-3d.webp`: a transparent rendered purple badge, shot straight on, with smooth edges and no metallic side pins or sockets. It is 512 x 512, lossless WebP, centred with an even margin, so the canonical Sine Nodes SVG overlays it at `left: 50%; top: 50%` with no rotation (see `.brand .mark` in `assets/cinematic.css`). `dev/workflow-core-v1.prompt.md` records the generation prompt and the post-processing (pin removal by row interpolation, frontal view by homography). This is a rendered presentation variant; it does not change the mark geometry or replace the canonical vector brand kit. It is the only 3D element in the page.

### Theme system : single source of truth
`assets/theme-store.js` owns all theme state and exposes `window.FlowTheme`:
- `FlowTheme.get(key?)`, `FlowTheme.set(patch|key, val)`, `FlowTheme.toggleTheme()`, `FlowTheme.subscribe(fn)`.
- State shape: `{ theme, accent, font, density }`. Persisted to `localStorage` key `flowops:tweaks:v1`.
- `set()` writes four attributes on `<html>`: `data-theme`, `data-accent`, `data-font`, `data-density`, then persists and emits to subscribers.
- **All visual variation lives in CSS, not JS.** `assets/styles.css` defines design tokens (CSS custom properties like `--bg`, `--accent`, `--glow`, `--dscale`) keyed off those four attribute selectors. To add a theme/accent/font/density option you add a CSS rule for the attribute value AND register it in the relevant Tweak control. Never hardcode colors in JS or markup; reference the tokens.

The nav sun/moon button (`main.js`) toggles `theme` through this store and persists it. Since the Tweaks panel is no longer shipped, `accent`, `font`, and `density` are effectively fixed at the `DEFAULTS` (currently `dark / violet / a / regular`), which must stay in sync with the `data-*` attributes hardcoded on `<html>`. Keep all theme state in this one store; do not introduce a second source.

To actually change a default appearance you must edit it in lockstep in three places: `DEFAULTS` in `theme-store.js`, the `<html data-theme/data-accent/data-font/data-density>` attributes, and (if you re-enable it) `TWEAK_DEFAULTS` in the panel. A persisted value in `localStorage` (`flowops:tweaks:v1`) overrides all of them, so clear that key (or use a private window) when testing a default change.

### Tweaks panel (React, development only, in `dev/`)
The Tweaks panel is a prototyping aid for experimenting with theme/accent/font/density. It is **not part of the production page** and lives in `dev/`. To re-enable it temporarily, add the CDN scripts plus the two sources back before `</body>`, pointing the sources at `dev/`:
```html
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
<script type="text/babel" src="dev/tweaks-panel.jsx"></script>
<script type="text/babel" src="dev/tweaks-app.jsx"></script>
```
- `dev/tweaks-panel.jsx` is a reusable control library scaffold (`useTweaks`, `TweaksPanel`, `TweakRadio`, `TweakColor`, etc.) exported onto `window`, plus a host edit-mode `postMessage` protocol (`@ds-adherence-ignore`). Vendored infrastructure: avoid editing.
- `dev/tweaks-app.jsx` is the FlowOps panel. It mirrors `FlowTheme` in via `subscribe` and writes back through `FlowTheme.set`; the one-way wiring avoids an update loop. Its `TWEAK_DEFAULTS` is wrapped in `/*EDITMODE-BEGIN*/ ... /*EDITMODE-END*/` markers (a host rewrites that block on disk, so keep them). Editing `TWEAK_DEFAULTS` does NOT change the live default. See the lockstep rule above.

### main.js conventions
Single IIFE, no modules. Reveals and carousel visibility use `IntersectionObserver`, with content visible if the API is unavailable or motion is paused. Scrollspy uses manual `getBoundingClientRect` checks. FAQ accordion, pricing tabs, and mobile menu are class-toggle driven against IDs in the HTML.

### Uma operação viva (`assets/motion-system.css` + `assets/operacao.css` + `assets/operacao.js`)

A linguagem visual da página é **interface**: nó, fio, evento, registro. Nunca circuito,
cérebro brilhando, holograma ou esfera 3D. Software é o visual.

`assets/motion-system.css` é o único lugar onde curva, duração e passo são escolhidos.
Quatro curvas (`--ease-entrada`, `--ease-saida`, `--ease-padrao`, `--ease-firme`), quatro
durações (`--t-toque` 160ms, `--t-base` 320ms, `--t-calmo` 560ms, `--t-cena` 900ms), o passo
do escalonamento (`--passo` 70ms) e os deslocamentos. Mais a primitiva `.mv-revela`, que é a
revelação por máscara das nove manchetes de seção, e o bloco que desliga tudo sob
`prefers-reduced-motion` e sob `[data-motion="paused"]`. **A regra desse bloco é mostrar
sempre o ESTADO FINAL**, nunca o inicial: esconder conteúdo de quem pediu menos movimento já
aconteceu neste projeto e é o pior desfecho possível.

`assets/operacao.js` é uma IIFE com quatro responsabilidades e três travas:

- **Laço de eventos do hero.** Sete eventos em rodízio lento. Cada um acende UM nó
  (`[data-no]`), dispara no máximo UM pulso de fio (`[data-fio]`) e escreve UMA linha no
  registro. Nunca dois ao mesmo tempo: com dois acesos o olho perde a ordem da leitura.
  O registro é um anel de quatro linhas movidas por `transform`, e a linha mais velha volta
  ao topo sem transição, invisível, antes de receber o texto novo.
- **Entrega do hero.** Um `--saida` e um `--saida2` escritos por quadro de scroll. O segundo
  existe porque a copy carrega o CTA e não pode desbotar junto com a janela.
- **Percurso de "Como funciona".** Um `--percurso` entre 0 e 1, ancorado na fileira de
  etapas e não na seção, e a classe `.ativo` em cada etapa que a linha já alcançou.
- **Rede de integrações.** Um sinal por vez, com a ferramenta da vez acesa e o anel do
  centro confirmando a chegada.

As travas: **um `requestAnimationFrame` para a página inteira**, com o listener de scroll só
agendando; **movimento é melhoria, nunca requisito** (sem este arquivo a página continua
completa); e **pausar é de verdade**, tanto pela preferência do sistema quanto pelo botão.

Dois detalhes que são fáceis de quebrar:

1. **Os dois conjuntos de fios do hero.** Existe um SVG de tela larga e um de celular, com as
   mesmas chaves `data-fio`. O JavaScript guarda uma LISTA por chave e pulsa as duas: a que
   está com `display: none` não anima, então não custa nada. Trocar a lista por um elemento
   só faz o pulso sumir num dos dois layouts.
2. **`preserveAspectRatio="none"` nos SVGs de fio.** É isso que faz as coordenadas do viewBox
   virarem percentagem da caixa, e é por isso que os nós, posicionados em `%` pelo CSS, ficam
   colados nas pontas dos fios em qualquer proporção. As posições dos nós vivem no CSS e não
   num atributo `style`, porque estilo inline vence media query e o celular não conseguiria
   reposicionar.

### Cinematic visual layer

`assets/cinematic.css` loads after the base stylesheet and owns the visual tokens, responsive layouts and CSS motion diagrams. Display typography uses the local Hanken Grotesk font.

The hero panel is the flat `.flow-canvas` from `assets/styles.css`: five `.fnode` cards positioned in percentages over a dotted grid, with `IA qualifica` as the hub card and SVG wires carrying animated beads. `assets/workflow.css` and `assets/scene.js` implement an alternative 3D panel with floating cards and a rendered badge at the centre. They are kept in the repo but the page does not load them. To bring that panel back you restore the `.hero-visual` block from the `workflow.css` era and re-add both files to `index.html`.

The integrations strip (`section.logos`) scrolls as a continuous marquee. Four identical `.marquee-group` copies sit in one `.marquee-track`; the animation translates the track by 25%, which is exactly one group width, so the end frame matches the start and the loop closes with no jump. Two groups are not enough because one group is narrower than the visible window. It pauses on hover, freezes in place (not back to the start) under the global `data-motion="paused"`, and stops under reduced motion.

At the end of the body, scripts load in this order: `motion.js`, `main.js`. `motion.js` owns the `data-motion` attribute and emits `waveops:motion` with `{ paused }`; it respects live reduced-motion preferences, and the nav pause button toggles it. No canvas and no WebGL renderer anywhere. Theme defaults and HTML attributes are `dark / violet / a / regular`; saved theme preferences still take precedence.

`dev/verify-workflow.cjs` checks the `scene.js` motion controller with a mocked DOM built from the `data-edge` paths in `index.html`; since the 3D panel is not in the page it exits early with a SKIP line, and starts asserting again if that panel returns. `dev/verify-design.js` provides UI checks to run in a local browser. Neither file is loaded in production.

## Backend integration points

The page is frontend-only today. Three places connect to a backend:
1. **Lead form (primary).** `assets/main.js` → function `submitLead(data)`, marked with the comment `PONTO DE INTEGRAÇÃO COM O BACK-END`. It currently fakes success after 600ms. Replace its body with the real `fetch` (suggested `POST /api/leads`). The `data` object is already assembled: `{ nome, empresa, whatsapp, dor, mensagem, origem: 'landing', enviadoEm }`. The UI (sending state, disabled button, success/error screens) is already handled : only make the request work.
2. **WhatsApp buttons** point at `https://wa.me/5534991775784` with a prefilled message (hero button, contact section `#wa-btn`, and footer link), opening in a new tab. To change the number, search the HTML for `wa.me/5534991775784`.
3. Pricing/plan text is hardcoded in the HTML (`#pacotes`); optional future CMS.

## Known pending items (from README)

- The brand is **WaveOps**, domain **waveops.com.br** (decided after FlowOps / Nodo / Operon / Trama were all taken). Two internal identifiers were intentionally NOT renamed: the `localStorage` key `flowops:tweaks:v1` (renaming resets visitors' saved theme) and the n8n webhook path `flowops-lead` (renaming breaks the live lead integration).
- The footer email is `mailto:contato@waveops.com.br` (set up this mailbox; it is the intended address).
- Custom domain is pending: the `CNAME` file and the canonical/OG/sitemap URLs still point at `vitorduraes.github.io/flowops-landing/`. Switch them to `https://waveops.com.br` only AFTER the domain's DNS points at GitHub Pages, otherwise the live site goes down.

## Writing rules for this repo

All user-facing copy is PT-BR with correct accentuation. In any text you produce (copy, comments, this file), do not use em dashes or en dashes; use periods, commas, or colons.
