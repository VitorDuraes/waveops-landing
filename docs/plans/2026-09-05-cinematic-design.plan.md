# WaveOps Cinematic Design Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for bounded implementation and independent review.

**Goal:** Entregar a direção cinematográfica aprovada, com 3D e motion graphics funcionais.

**Architecture:** Preservar a landing estática e suas integrações. Acrescentar uma camada visual CSS, um renderizador WebGL isolado e um controlador de movimento.

**Tech Stack:** HTML, CSS, JavaScript, WebGL nativo, fontes locais.

**Spec:** docs/specs/2026-09-05-cinematic-design.md

## Global Constraints

- Copy PT-BR com acentos e sem travessão.
- Nenhuma nova dependência de produção ou origem externa.
- Manter a marca, preços, formulários e FlowTheme.
- Mudanças locais na branch existente; sem publicação ou commit na main.

## Tasks

- [x] 1. Criar assets/scene.js: inicializar #flow-scene em .flow-stage, geometria tubular, iluminação, resize e renderização condicionada à visibilidade e preferência de movimento. Produzir .scene-ready apenas após frame válido. Ouvir evento waveops:motion com detail.paused. Validar com node --check assets/scene.js e navegador.
- [x] 2. Reformular index.html e criar assets/cinematic.css: hero, cards orbitais, faixa de integrações, diagramas de serviços, tipografia, espaçamento e componentes do restante da página. Sincronizar tema dark e densidade regular com theme-store.js. Conferir desktop e mobile no navegador.
- [x] 3. Criar assets/motion.js: controle #motion-toggle, atributo data-motion, evento waveops:motion; microinterações, progresso de scroll, entrada progressiva e atualização em tempo real de prefers-reduced-motion. Adequar main.js para pausa do carrossel. Executar node --check nos scripts.
- [x] 4. Validar links internos, recursos locais, temas, preços, FAQ, menu mobile, campos obrigatórios sem POST real, movimento reduzido, pausa e fallback. Corrigir problemas encontrados e registrar evidências.

## Review

A direção e execução foram autorizadas pelo usuário. Alterações visuais são verificadas no navegador, sem testes que apenas reproduzam o CSS. Um agente independente revisa o diff final e o comportamento de movimento.

## Verification evidence

- JavaScript syntax checks passed for main.js, motion.js, scene.js and theme-store.js.
- Browser UI checks passed at 1440x1000 (light), 1024x900 (dark), 390x844 (dark), and 390x844 with reduced motion.
- Verified WebGL draw calls: 9 during the sample while running, 0 while paused, 0 offscreen. Context loss showed the CSS fallback; context restoration successfully rebuilt the scene.
- Empty form submission highlighted 4 required fields and focused f-nome without sending a lead. The confirmation remained visible with motion paused.
- FAQ, ROI calculator, menu open/Escape, internal anchors and all 8 integration labels passed.
- Visual review covered hero, services, pricing, contact, desktop, tablet, mobile and both themes. Captures live in dev/design-*.png.
- Fixed review findings: paused confirmation animation, missing tablet login link, hidden integration labels and selector mismatches. Corrected shader uniform precision after reproducing ANGLE link failure.
- Synced generated portal/public/landing.html and assets with the canonical root files. No deployment.
