@.claude/waveops-base.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Desvio de stack (registrado):** este projeto é uma landing page estática (HTML/CSS/JS), não a stack default Next.js/Drizzle da WaveOps. A rule `.claude/rules/nextjs-drizzle.md` e os comandos baseados em `npm run lint/build/test` são referência, não se aplicam aqui. Valem integralmente: o hook `secret-scan`, a rule de segurança/LGPD e a rule de copy PT-BR (esta é crítica para a copy da landing).

## What this is

WaveOps is a single institutional landing page (startup aesthetic, light theme by default with a dark toggle, PT-BR) for an automation/dev/AI consultancy. All copy is Brazilian Portuguese. (The repo and GitHub Pages path are still named `flowops-landing` from the old name; the live brand is WaveOps.)

There is **no build step, no package manager, no test suite, no framework bundling**. The production page is plain HTML + CSS + vanilla JS, with zero runtime dependencies. There is React in the repo (the Tweaks panel under `dev/`), but it is a development-only tool that the production page does not load. See "Tweaks panel" below.

## Running it

The entry file is `index.html` (renamed from `FlowOps Landing.html` so GitHub Pages serves it at the site root). Serve it from a static server (the project README recommends the VS Code **Live Server** extension). `file://` mostly works now that there are no CDN scripts, but a static server is still preferred since the relative `assets/` paths and the lead-form `fetch` expect an HTTP origin. Nothing to compile or install.

## Architecture

### Script load order (intentional, do not reorder)
In `<head>`, in order: the CSP `<meta>` (must come first, before any resource), then `assets/fonts.css` + `assets/styles.css`, then the async Plausible script (`plausible.io`), then `assets/analytics.js` (Plausible bootstrap), then `assets/theme-store.js`. At the end of `<body>`: `assets/main.js`.
1. `assets/theme-store.js` in `<head>` applies the theme attributes before paint (prevents a flash of the wrong theme).
2. `assets/analytics.js` holds the Plausible queue stub + `init()` (moved out of an inline `<script>` so the CSP can use `script-src 'self'` without `'unsafe-inline'`). Do not re-inline it.
3. `assets/main.js` at the end of `<body>` wires all DOM interactions.

No React, no Babel, no build step. The only remaining third-party request is the async Plausible script; everything else (fonts, CSS, JS) is self-hosted. The Tweaks panel and its React/Babel CDN scripts were removed from the page; the sources now live in `dev/`.

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
Stroke is `#fff` on a violet chip / dark / violet bg (shown above), `#7c3aed` on a light bg. The hub is `fill="none"`, so the background shows through its centre. The white variant is inlined in the nav and footer of `index.html` (inside the `.brand .mark` violet chip), and is the source for `assets/favicon.svg` (= the kit `waveops-icon.svg`), `assets/apple-touch-icon.png` (full-bleed gradient, regenerated via `assets/_appicon.html`), `assets/favicon-32.png`, the `assets/og-image.*` card, and the `assets/checklist.*` PDF. If you change the mark, update every one of those in lockstep and regenerate the PNG/PDF (Chrome headless `--screenshot` / `--print-to-pdf`). Do NOT regress to either retired mark: the earlier "onda + nó" single-hollow-ring (path `Q 31 30 34 18.6`, `viewBox 0 0 48 48`) or the green FlowOps node-graph (`#03140d`, `viewBox 0 0 24 24`, path `M7 7l9 4`).

### Theme system — single source of truth
`assets/theme-store.js` owns all theme state and exposes `window.FlowTheme`:
- `FlowTheme.get(key?)`, `FlowTheme.set(patch|key, val)`, `FlowTheme.toggleTheme()`, `FlowTheme.subscribe(fn)`.
- State shape: `{ theme, accent, font, density }`. Persisted to `localStorage` key `flowops:tweaks:v1`.
- `set()` writes four attributes on `<html>`: `data-theme`, `data-accent`, `data-font`, `data-density`, then persists and emits to subscribers.
- **All visual variation lives in CSS, not JS.** `assets/styles.css` defines design tokens (CSS custom properties like `--bg`, `--accent`, `--glow`, `--dscale`) keyed off those four attribute selectors. To add a theme/accent/font/density option you add a CSS rule for the attribute value AND register it in the relevant Tweak control. Never hardcode colors in JS or markup; reference the tokens.

The nav sun/moon button (`main.js`) toggles `theme` through this store and persists it. Since the Tweaks panel is no longer shipped, `accent`, `font`, and `density` are effectively fixed at the `DEFAULTS` (currently `light / violet / a / compact`), which must stay in sync with the `data-*` attributes hardcoded on `<html>`. Keep all theme state in this one store; do not introduce a second source.

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
Single IIFE, no modules. Scroll-driven effects (reveal-on-scroll, scrollspy) are implemented with manual `getBoundingClientRect` checks on `scroll`, **not** `IntersectionObserver` (with a `setTimeout` safety net that force-reveals everything after 1800ms). FAQ accordion, pricing tabs, and mobile menu are class-toggle driven against IDs in the HTML.

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
