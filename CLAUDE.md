@.claude/waveops-base.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Desvio de stack (registrado):** este projeto é uma landing page estática (HTML/CSS/JS), não a stack default Next.js/Drizzle da WaveOps. A rule `.claude/rules/nextjs-drizzle.md` e os comandos baseados em `npm run lint/build/test` são referência, não se aplicam aqui. Valem integralmente: o hook `secret-scan`, a rule de segurança/LGPD e a rule de copy PT-BR (esta é crítica para a copy da landing).

## What this is

WaveOps is a single institutional landing page (cinematic aesthetic, dark theme by default with a light toggle, PT-BR) for an automation/dev/AI consultancy. All copy is Brazilian Portuguese. (The repo and GitHub Pages path are still named `flowops-landing` from the old name; the live brand is WaveOps.)

There is **no build step and no package manager**. The production page is plain HTML + CSS + JS.
Since 09/09/2026 it also loads React 19 as pre-compiled ESM, vendored in `assets/vendor/` and
served from the same origin, to run the ported Framer Starfield component in the hero. Since
10/09/2026 a second island, the ported Framer `ImageSequence`, reuses that same vendored React to
raspar pelo scroll a sequência de quadros de "Como funciona". This is a deliberate, user-approved
deviation from the previous "zero runtime dependencies" property.

What the page actually downloads is measured over **two import graphs**, one per
`<script type="module">` in `index.html` (`assets/starfield-mount.mjs` and
`assets/sequence-mount.mjs`), followed recursively through every relative specifier and stripped
of `?v=`. The two graphs share four `assets/vendor/` modules, so the number that matters is the
**union, counted once**, not the sum of both. Measured on 10/09/2026 with `gzip -9` over each file:

| Module | gzip | Quando carrega |
|---|---|---|
| `assets/vendor/react-dom-client.mjs` | 56.6 KB | sempre (import estático de `starfield-mount.mjs`) |
| `assets/starfield.mjs` | 6.7 KB | sempre |
| `assets/vendor/react.mjs` | 3.8 KB | sempre |
| `assets/motion-lite.mjs` | 2.8 KB | sempre (import estático de `sequence-mount.mjs`) |
| `assets/image-sequence.mjs` | 2.6 KB | só quando `#como` se aproxima da viewport E a tela tem 768px ou mais |
| `assets/sequence-mount.mjs` | 2.4 KB | sempre (é o próprio `<script type="module">`) |
| `assets/starfield-mount.mjs` | 1.1 KB | sempre (é o próprio `<script type="module">`) |
| `assets/vendor/framer-shim.mjs` | 0.9 KB | sempre |
| `assets/vendor/jsx-runtime.mjs` | 0.8 KB | sempre |
| `assets/scroll-signal.mjs` | 0.6 KB | sempre |
| **Total único (pior caso: desktop que rola até "Como funciona")** | **78.4 KB** | |

Note a coluna "quando carrega": `assets/image-sequence.mjs` é o único módulo de fato condicional.
Todos os outros, incluindo o `sequence-mount.mjs` e o `motion-lite.mjs` que ele importa
estaticamente, chegam para **todo visitante, desktop ou mobile**, porque o `<script>` na raiz não
tem gate de dispositivo; o gate mora dentro do módulo, no `IntersectionObserver` e no
`matchMedia`. Quem nunca chega em `#como`, ou está abaixo de 768px, para em **75.8 KB**: os mesmos
78.4 KB menos `image-sequence.mjs`. O `react-dom-client.mjs` e o `jsx-runtime.mjs` que
`sequence-mount.mjs` importa de forma dinâmica na hora de montar já estão no cache de módulos do
navegador, carregados antes pelo starfield: o delta real de chegar em `#como` no desktop é só os
2,6 KB do `image-sequence.mjs`.

`assets/vendor/framer-motion.mjs` e `assets/vendor/emotion-is-prop-valid.mjs` (50.9 KB gzip
juntos) continuam vendorizados e **hoje não têm nenhum consumidor**, nem em produção nem na fase 2:
o `ImageSequence` portado usa `assets/motion-lite.mjs`, nosso `useScroll`/`useTransform`/
`useInView` escritos à mão, que substituiu o `framer-motion` inteiro por 2,8 KB gzip. O único
arquivo que ainda importa `framer-motion.mjs` é `dev/smoke-react.html`, que não é produção. Os dois
arquivos ficam no repo porque regenerar depois custa mais caro que manter parado; não cite o peso
deles como custo de página, e não assuma mais nenhum plano de consumi-los.

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
In `<head>`, in order: the CSP `<meta>` (must come first, before any resource), then `assets/fonts.css` + `assets/styles.css` + `assets/cinematic.css`, then the async Plausible script (`plausible.io`), then `assets/analytics.js` (Plausible bootstrap), then `assets/theme-store.js`. At the end of `<body>`: `assets/motion.js`, `assets/main.js`.
1. `assets/theme-store.js` in `<head>` applies the theme attributes before paint (prevents a flash of the wrong theme).
2. `assets/analytics.js` holds the Plausible queue stub + `init()` (moved out of an inline `<script>` so the CSP can use `script-src 'self'` without `'unsafe-inline'`). Do not re-inline it.
3. `assets/main.js` at the end of `<body>` wires all DOM interactions.

After `assets/main.js`, `assets/starfield-mount.mjs` loads as `<script type="module">`. It mounts the
`#hero-starfield` React island inside `.flow-canvas`, reads colors from the CSS tokens through
`FlowTheme` and pauses on the `waveops:motion` event. It has no import map on purpose: every
specifier is relative, so the CSP stays at `script-src 'self'`. If the module fails, the CSS
`.dots-bg` fallback stays visible.

Four rules that the island depends on and that are easy to break:
1. **Cache-busting reaches the sub-imports.** The `<script>` tag carries `?v=20260910` like its
   neighbours, but a query string on the tag does not reach relative sub-imports. So the version
   also travels in the specifiers of our own mutable modules: `./starfield.mjs?v=` in
   `starfield-mount.mjs` and `./scroll-signal.mjs?v=` in `starfield.mjs`. The `assets/vendor/`
   modules are version pinned and immutable in practice, so they carry no query. Bump all three
   together.
2. **Paused must still paint.** `buildGrid()` sets `canvas.width`, which wipes the canvas. The
   debounced `ResizeObserver` callback therefore repaints whenever no animation loop is running
   (`isStaticRenderer || paused || !visivel`). Without that, a visitor with
   `prefers-reduced-motion: reduce`, or anyone pressing `#motion-toggle`, gets an empty hero: the
   `:has()` rule in `styles.css` keeps `.dots-bg` at `opacity: 0` as long as the canvas element
   exists, so the CSS fallback does not come back.
3. **Cursor events are listened for on `window`, not on the island.** `#hero-starfield` keeps
   `pointer-events: none` so it never steals clicks from the nodes and the wires, and
   `svg.flow-wires` covers it anyway. `pointerToLocal()` converts page coordinates to container
   coordinates through `container.getBoundingClientRect()`.
4. **The loop stops off screen.** An `IntersectionObserver` flips `visivel`; `animate()` returns
   early when it is false and the observer restarts the loop when the hero comes back. Every
   listener and both observers are removed in the `useEffect` cleanup.

No Babel, no build step. Production React usage is limited to the vendored starfield island described above. The only remaining third-party network request is the async Plausible script, everything else (fonts, CSS, JS, and the vendored React ESM) is self-hosted. The Tweaks panel and its React/Babel CDN scripts were removed from the page; the sources now live in `dev/`.

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

### Theme system — single source of truth
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

### Cinematic visual layer

`assets/cinematic.css` loads after the base stylesheet and owns the visual tokens, responsive layouts and CSS motion diagrams. Display typography uses the local Hanken Grotesk font.

The hero panel is the flat `.flow-canvas` from `assets/styles.css`: five `.fnode` cards positioned in percentages over a dotted grid, with `IA qualifica` as the hub card and SVG wires carrying animated beads. `assets/workflow.css` and `assets/scene.js` implement an alternative 3D panel with floating cards and a rendered badge at the centre. They are kept in the repo but the page does not load them. To bring that panel back you restore the `.hero-visual` block from the `workflow.css` era and re-add both files to `index.html`.

The integrations strip (`section.logos`) scrolls as a continuous marquee. Four identical `.marquee-group` copies sit in one `.marquee-track`; the animation translates the track by 25%, which is exactly one group width, so the end frame matches the start and the loop closes with no jump. Two groups are not enough because one group is narrower than the visible window. It pauses on hover, freezes in place (not back to the start) under the global `data-motion="paused"`, and stops under reduced motion.

At the end of the body, scripts load in this order: `motion.js`, `main.js`. `motion.js` owns the `data-motion` attribute and emits `waveops:motion` with `{ paused }`; it respects live reduced-motion preferences, and the nav pause button toggles it. No canvas and no WebGL renderer anywhere. Theme defaults and HTML attributes are `dark / violet / a / regular`; saved theme preferences still take precedence.

`dev/verify-workflow.cjs` checks the `scene.js` motion controller with a mocked DOM built from the `data-edge` paths in `index.html`; since the 3D panel is not in the page it exits early with a SKIP line, and starts asserting again if that panel returns. `dev/verify-design.js` provides UI checks to run in a local browser. Neither file is loaded in production.

## Backend integration points

The page is frontend-only today. Three places connect to a backend:
1. **Lead form (primary).** `assets/main.js` → function `submitLead(data)`, marked with the comment `PONTO DE INTEGRAÇÃO COM O BACK-END`. It currently fakes success after 600ms. Replace its body with the real `fetch` (suggested `POST /api/leads`). The `data` object is already assembled: `{ nome, empresa, whatsapp, dor, mensagem, origem: 'landing', enviadoEm }`. The UI (sending state, disabled button, success/error screens) is already handled — only make the request work.
2. **WhatsApp buttons** point at `https://wa.me/5534991775784` with a prefilled message (hero button, contact section `#wa-btn`, and footer link), opening in a new tab. To change the number, search the HTML for `wa.me/5534991775784`.
3. Pricing/plan text is hardcoded in the HTML (`#pacotes`); optional future CMS.

## Known pending items (from README)

- The brand is **WaveOps**, domain **waveops.com.br** (decided after FlowOps / Nodo / Operon / Trama were all taken). Two internal identifiers were intentionally NOT renamed: the `localStorage` key `flowops:tweaks:v1` (renaming resets visitors' saved theme) and the n8n webhook path `flowops-lead` (renaming breaks the live lead integration).
- The footer email is `mailto:contato@waveops.com.br` (set up this mailbox; it is the intended address).
- Custom domain is pending: the `CNAME` file and the canonical/OG/sitemap URLs still point at `vitorduraes.github.io/flowops-landing/`. Switch them to `https://waveops.com.br` only AFTER the domain's DNS points at GitHub Pages, otherwise the live site goes down.

## Writing rules for this repo

All user-facing copy is PT-BR with correct accentuation. In any text you produce (copy, comments, this file), do not use em dashes or en dashes; use periods, commas, or colons.
