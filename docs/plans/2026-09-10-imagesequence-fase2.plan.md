# ImageSequence, fase 2 do plano de islands React

**Goal:** Entregar o segundo componente que o Vitor pediu lá no início, o `ImageSequence` do Framer, como uma sequência de quadros raspada pelo scroll numa seção fixa, mostrando o fluxo WaveOps se montando ao longo das 6 etapas de "Como funciona".

**Architecture:** Os quadros são gerados a partir do nosso próprio HTML por Chrome headless, então são leves, determinísticos e regeneráveis. O componente portado do Framer usa `useScroll`, `useTransform` e `useInView` do `framer-motion`, que já está vendorizado em `assets/vendor/` e hoje não é carregado por nenhum island. Esta fase fecha esse laço.

**Spec:** `docs/specs/2026-09-09-starfield-react-islands.md`, bloco FORA DE ESCOPO, que descreve esta fase.

## Global Constraints

- A meta CSP de `index.html` não muda em nenhuma diretiva. Sem import map, sem script inline, sem origem nova.
- Nenhum `package.json`, `node_modules`, bundler ou Babel. O projeto continua sem build step.
- **Teto de peso: 400 KB para a sequência inteira.** Esta é uma página de captação de lead. Se estourar, corta quadro ou resolução, não o teto.
- **Carga preguiçosa obrigatória.** Nenhum byte de quadro pode ser baixado antes de a seção se aproximar do viewport.
- **Desligado no mobile.** Abaixo de 768 px a seção mostra o conteúdo estático que já existe hoje, sem baixar quadro nenhum.
- `motion.js` continua dono único do movimento: com `data-motion="paused"` ou `prefers-reduced-motion`, a sequência congela num quadro e não anima.
- Acentuação PT-BR correta. Nunca travessão (em dash, en dash): ponto, vírgula ou dois-pontos.
- Cache-busting: os módulos nossos carregam `?v=` na mesma data, nos três lugares, conforme a regra já registrada no `CLAUDE.md`.
- O conteúdo textual das 6 etapas não muda. A sequência é camada visual, não substitui texto.
- Commitar na branch atual. Nunca na `main`, nunca push.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `dev/_gen-sequence.html` | Renderiza o fluxo num progresso `t` de 0 a 1, lido da query string |
| `_gen_sequence.py` | Dirige o Chrome headless, captura os N quadros, otimiza e grava |
| `assets/sequence/` | Os quadros gerados, mais um `README.md` de proveniência |
| `assets/image-sequence.mjs` | Porte cirúrgico do componente do Framer |
| `assets/sequence-mount.mjs` | Cola: monta o island, carga preguiçosa, respeita movimento e largura |
| `index.html` | Bloco fixo dentro de `#como` e o `<script type="module">` |
| `assets/styles.css` | Posicionamento da seção fixa |
| `dev/verify-starfield.cjs` | Verificações novas |
| `CLAUDE.md` | Registrar a fase 2 |

## Tarefas

### Task 1: Gerador de quadros
Produz `dev/_gen-sequence.html` e `_gen_sequence.py`. O HTML desenha o painel de fluxo (os 5 nós, os fios e as contas) num estado parametrizado por `?t=`, reaproveitando os tokens de `assets/styles.css` para não inventar cor. O Python dirige o Chrome headless, captura N quadros em 960x720, converte para WebP com Pillow e grava em `assets/sequence/`. Critério: o conjunto fica abaixo de 400 KB e o script imprime o peso total.

### Task 2: Porte do ImageSequence
Baixa o fonte de `https://framerusercontent.com/modules/E2Zqu8A8tF4ixotl4wn8/ASdZ8TQqwy8hcokUBtIQ/ImageSequence.js` e porta para `assets/image-sequence.mjs`, com o mesmo método cirúrgico do starfield: reescrever os imports para caminho relativo do `assets/vendor/`, remover `addPropertyControls` e `__FramerMetadata__`, e nada mais. O componente já traz `scrollBehavior: 'scrollSection'`, `smoothing` e o `useInView` que evita desenhar fora da tela.

### Task 3: Montagem na seção
`assets/sequence-mount.mjs` monta o island num bloco fixo dentro de `#como`, com carga preguiçosa por `IntersectionObserver` com `rootMargin` folgado, desligado abaixo de 768 px, e congelado num quadro sob `waveops:motion` pausado. Acrescenta o bloco no `index.html` e o CSS.

### Task 4: Verificação, peso e documentação
Mede o peso real baixado, prova a carga preguiçosa por rede, prova o comportamento no mobile e com movimento pausado, acrescenta verificações ao `dev/verify-starfield.cjs` e registra no `CLAUDE.md`.

## Review

Cada tarefa passa por revisor em contexto separado, com ordem de achar problema. O conjunto passa por review final. Verificação visual roda no navegador, com número, nunca com adjetivo.

## Rollback

Aditivo. Remover o bloco fixo e o `<script>` do `index.html` devolve a seção ao estado atual.
