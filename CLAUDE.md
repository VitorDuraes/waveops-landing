# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WaveOps is a single institutional landing page (startup aesthetic, light theme by default with a dark toggle, PT-BR) for an automation/dev/AI consultancy. All copy is Brazilian Portuguese. (The repo and GitHub Pages path are still named `flowops-landing` from the old name; the live brand is WaveOps.)

There is **no build step, no package manager, no test suite, no framework bundling**. The production page is plain HTML + CSS + vanilla JS, with zero runtime dependencies. There is React in the repo (the Tweaks panel under `dev/`), but it is a development-only tool that the production page does not load. See "Tweaks panel" below.

## Running it

The entry file is `index.html` (renamed from `FlowOps Landing.html` so GitHub Pages serves it at the site root). Serve it from a static server (the project README recommends the VS Code **Live Server** extension). `file://` mostly works now that there are no CDN scripts, but a static server is still preferred since the relative `assets/` paths and the lead-form `fetch` expect an HTTP origin. Nothing to compile or install.

## Architecture

### Script load order (intentional, do not reorder)
The production page loads exactly two scripts:
1. `assets/theme-store.js` in `<head>` so it applies the theme attributes before paint (prevents a flash of the wrong theme).
2. `assets/main.js` at the end of `<body>` wires all DOM interactions.

That is the entire production runtime. No React, no Babel, no CDN dependencies. The Tweaks panel and its React/Babel CDN scripts were removed from the page; the sources now live in `dev/`.

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
