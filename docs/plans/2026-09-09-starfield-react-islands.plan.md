# Starfield React Islands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o fundo pontilhado estático do hero por um campo de partículas em canvas que reage ao cursor e à velocidade do scroll, portando o componente Starfield Motion do Framer para um island React na landing estática.

**Architecture:** React 19 e framer-motion 11 entram como ESM já compilado, versionado em `assets/vendor/`, sem npm e sem bundler. O pacote `framer` é substituído por um shim local porque nenhuma versão publicada exporta o que os componentes usam. O componente portado monta em um único `<div>` dentro do `.flow-canvas` existente e conversa com o resto da página só por dois canais que já existem: `FlowTheme` para cor e o evento `waveops:motion` para pausa.

**Tech Stack:** HTML, CSS, JavaScript ESM, React 19.2.8, framer-motion 11.18.2, canvas 2D, Python 3 para o script de vendorização.

**Spec:** `docs/specs/2026-09-09-starfield-react-islands.md`

## Global Constraints

- Copy e comentários em PT-BR com acentuação correta. Nunca usar travessão (em dash ou en dash): usar ponto, vírgula ou dois-pontos.
- A meta CSP em `index.html` não muda em nenhuma diretiva. `script-src` continua `'self' https://plausible.io`. Nenhuma origem nova, nenhum script inline, nenhum import map.
- Nenhum `package.json`, nenhum `node_modules`, nenhum bundler, nenhum Babel. O projeto continua sem build step.
- Versões exatas e obrigatórias: React `19.2.8`, react-dom `19.2.8`, framer-motion `11.18.2`.
- As duas flags do esm.sh são obrigatórias juntas: `bundle-deps` e `deps=react@19.2.8,react-dom@19.2.8`. Sem a segunda, o framer-motion resolve o próprio React e a página carrega duas cópias, o que quebra os hooks com "Invalid hook call".
- Cor nunca hardcoded em JS. Ler os tokens CSS (`--accent`, `--border`) via `getComputedStyle`.
- `motion.js` continua sendo o dono único do estado de movimento. Não duplicar a media query `prefers-reduced-motion`.
- Não alterar `main.js`, `theme-store.js`, `analytics.js` nem `motion.js`.
- Nenhum commit na `main`. Nenhum deploy. Trabalhar na branch atual.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `_fetch_vendor.py` | Baixa, reescreve caminhos e grava `assets/vendor/`. Reproduzível |
| `assets/vendor/*.mjs` | Runtime gerado. Nunca editar à mão |
| `assets/vendor/framer-shim.mjs` | Nosso. Os 4 símbolos que o pacote `framer` não entrega |
| `assets/vendor/README.md` | Proveniência: URL, versão, data, comando de regeneração |
| `assets/scroll-signal.mjs` | Energia de scroll suavizada. Puro, sem DOM próprio, testável em node |
| `assets/starfield.mjs` | Componente portado do Framer. Física e desenho |
| `assets/starfield-mount.mjs` | Cola: monta o island, liga `FlowTheme` e `waveops:motion` |
| `dev/verify-starfield.cjs` | Verificação em node: sintaxe, specifiers, React único, shim |
| `dev/smoke-react.html` | Página de fumaça para provar React 19 + framer-motion no navegador |
| `index.html` | Modificar: `<div id="hero-starfield">` e o `<script type="module">` |
| `assets/styles.css` | Modificar: posicionamento e `z-index` do canvas |
| `CLAUDE.md` | Modificar: registrar o desvio de "no React, zero runtime dependencies" |

---

### Task 1: Pipeline de vendorização

**Files:**
- Create: `_fetch_vendor.py`
- Create: `assets/vendor/react.mjs`, `assets/vendor/jsx-runtime.mjs`, `assets/vendor/react-dom-client.mjs`, `assets/vendor/framer-motion.mjs`, `assets/vendor/emotion-is-prop-valid.mjs` (todos gerados pelo script)
- Create: `assets/vendor/README.md`

**Interfaces:**
- Consumes: nada.
- Produces: cinco módulos ESM em `assets/vendor/` sem nenhum import absoluto. Os demais arquivos importam deles por caminho relativo (`./vendor/react.mjs`, `./vendor/framer-motion.mjs`).

- [ ] **Step 1: Escrever o script de vendorização**

Criar `_fetch_vendor.py`:

```python
#!/usr/bin/env python3
"""WaveOps: baixa e vendoriza os módulos ESM usados pelos islands React.

Regenera assets/vendor/. Rodar com: python _fetch_vendor.py

Por que as duas flags do esm.sh são obrigatórias juntas:
  bundle-deps  inlina motion-dom, motion-utils e scheduler.
  deps=        força react e react-dom para UMA versão. Sem isso o framer-motion
               resolve react@^19.2.0 por conta própria, a página carrega dois
               Reacts e os hooks quebram com "Invalid hook call".
"""
import re
import sys
import urllib.request
from pathlib import Path

REACT = "19.2.8"
FRAMER_MOTION = "11.18.2"
QUERY = f"bundle-deps&deps=react@{REACT},react-dom@{REACT}&target=es2022"
OUT = Path(__file__).parent / "assets" / "vendor"

MODULES = {
    "react.mjs": f"react@{REACT}",
    "jsx-runtime.mjs": f"react@{REACT}/jsx-runtime",
    "react-dom-client.mjs": f"react-dom@{REACT}/client",
    "framer-motion.mjs": f"framer-motion@{FRAMER_MOTION}",
    "emotion-is-prop-valid.mjs": "@emotion/is-prop-valid",
}

# Caminho absoluto do esm.sh para arquivo local. A ordem importa: jsx-runtime
# antes de react, senão o padrão mais curto casa primeiro.
REWRITES = [
    (re.compile(r'"/react@[^"]*?/jsx-runtime\.mjs"'), '"./jsx-runtime.mjs"'),
    (re.compile(r'"/react@[^"]*?/react\.mjs"'), '"./react.mjs"'),
    (re.compile(r'"/@emotion/is-prop-valid[^"]*"'), '"./emotion-is-prop-valid.mjs"'),
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "waveops-vendor"})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read().decode("utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in MODULES.items():
        stub = fetch(f"https://esm.sh/{spec}?{QUERY}")
        paths = re.findall(r'"(/[^"]+\.m?js)"', stub)
        if not paths:
            sys.exit(f"esm.sh não devolveu caminho de bundle para {spec}")
        code = fetch("https://esm.sh" + paths[-1])
        for pattern, replacement in REWRITES:
            code = pattern.sub(replacement, code)
        leftover = sorted(set(re.findall(r'from\s*"(/[^"]+)"', code)))
        if leftover:
            sys.exit(f"{name} ainda tem import absoluto: {leftover}")
        (OUT / name).write_text(code, encoding="utf-8")
        print(f"{name:28} {len(code.encode('utf-8')):>8} B")
    print("OK: assets/vendor regenerado")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Rodar o script e conferir que ele falha ou passa de forma explícita**

Run: `python _fetch_vendor.py`

Expected: cinco linhas com nome e tamanho, terminando em `OK: assets/vendor regenerado`. Se sair `ainda tem import absoluto`, acrescentar o padrão que faltou em `REWRITES` e rodar de novo. O script foi feito para falhar alto: import absoluto que escapa quebra a página offline.

- [ ] **Step 3: Provar que existe um React só**

Run:
```bash
grep -c 'react\.mjs' assets/vendor/react-dom-client.mjs assets/vendor/framer-motion.mjs
grep -rnE 'from\s*"(/|https?:)' assets/vendor/*.mjs
```

Expected: o primeiro comando mostra pelo menos 1 ocorrência em cada arquivo. O segundo não retorna nada. Qualquer saída no segundo comando significa que sobrou import apontando para fora.

O segundo comando casa só com declaração de import de verdade. Um `grep` mais amplo por `esm.sh` dá falso positivo: o esm.sh grava um comentário de proveniência (`/* esm.sh - react@19.2.8 */`) na primeira linha de cada bundle, que é texto inerte e não busca nada pela rede.

- [ ] **Step 4: Escrever o README de proveniência**

Criar `assets/vendor/README.md`:

```markdown
# assets/vendor

Runtime de terceiros usado pelos islands React da landing. **Não editar estes arquivos à mão.**
Para regenerar: `python _fetch_vendor.py` na raiz do repo.

| Arquivo | Pacote | Versão | Origem |
|---|---|---|---|
| `react.mjs` | react | 19.2.8 | esm.sh |
| `jsx-runtime.mjs` | react/jsx-runtime | 19.2.8 | esm.sh |
| `react-dom-client.mjs` | react-dom/client | 19.2.8 | esm.sh |
| `framer-motion.mjs` | framer-motion | 11.18.2 | esm.sh |
| `emotion-is-prop-valid.mjs` | @emotion/is-prop-valid | peer do framer-motion | esm.sh |
| `framer-shim.mjs` | nosso | 1.0 | escrito à mão |

Baixado em 09/09/2026 com `?bundle-deps&deps=react@19.2.8,react-dom@19.2.8&target=es2022`.

As duas flags são obrigatórias juntas. Sem `deps=`, o framer-motion resolve `react@^19.2.0`
sozinho e a página passa a carregar duas cópias do React, o que quebra os hooks.

Todos os caminhos absolutos do esm.sh foram reescritos para caminho relativo, então a pasta
funciona offline e a CSP continua `script-src 'self'`.

**Vendorizado é invisível para o Dependabot.** Revisar estas versões à mão a cada trimestre.
```

- [ ] **Step 5: Commit**

```bash
git add _fetch_vendor.py assets/vendor/
git commit -m "chore(landing): vendoriza React 19 e framer-motion 11 em assets/vendor"
```

---

### Task 2: Shim do pacote `framer`

**Files:**
- Create: `assets/vendor/framer-shim.mjs`
- Test: `dev/verify-starfield.cjs`

**Interfaces:**
- Consumes: nada.
- Produces: exporta `addPropertyControls(component, controls)` (no-op), `ControlType` (objeto congelado de constantes string), `RenderTarget` (objeto congelado com `canvas`, `export`, `thumbnail`, `preview` e o método `current()`), e `useIsStaticRenderer()` que retorna `false`. `assets/starfield.mjs` importa os quatro.

- [ ] **Step 1: Escrever o teste que falha**

Criar `dev/verify-starfield.cjs`:

```javascript
/* WaveOps: verificação dos islands React do hero. Roda com node, sem navegador.
   Uso: node dev/verify-starfield.cjs */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
const check = (nome, fn) => {
  try { fn(); passed += 1; console.log('  ok   ' + nome); }
  catch (e) { console.error('  FAIL ' + nome + ': ' + e.message); process.exitCode = 1; }
};

console.log('shim do pacote framer');
check('exporta os 4 símbolos usados pelos componentes', () => {
  // Validação por texto: check() é síncrono, então um callback async faria o
  // try/catch dele nunca ver a falha.
  const src = read('assets/vendor/framer-shim.mjs');
  for (const s of ['addPropertyControls', 'ControlType', 'RenderTarget', 'useIsStaticRenderer']) {
    assert.ok(new RegExp('export[^\\n]*\\b' + s + '\\b').test(src), 'falta export de ' + s);
  }
});
check('RenderTarget.current não devolve o valor de canvas', () => {
  const src = read('assets/vendor/framer-shim.mjs');
  assert.ok(/current\s*\(\s*\)/.test(src), 'RenderTarget precisa do metodo current()');
  assert.ok(!/current\s*\(\s*\)\s*\{\s*return\s*['"]CANVAS/.test(src),
    'current() não pode devolver CANVAS, senão o componente renderiza o placeholder estático');
});

console.log('\n' + passed + ' verificações passaram');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node dev/verify-starfield.cjs`

Expected: FAIL, porque `assets/vendor/framer-shim.mjs` ainda não existe. A mensagem será `ENOENT`.

- [ ] **Step 3: Escrever o shim**

Criar `assets/vendor/framer-shim.mjs`:

```javascript
/* WaveOps: substituto local do pacote "framer".

   Verificado em 09/09/2026: framer@2.4.1 é a única versão que o esm.sh resolve e
   NÃO exporta useIsStaticRenderer. O framer@3.0.4 resolve para "export default null",
   deixou de ser biblioteca. O pacote real é inutilizável fora do canvas do Framer,
   então os quatro símbolos que os componentes importam são reimplementados aqui.

   Fora do editor do Framer, os controles de propriedade não têm função: o componente
   recebe as props direto do nosso código de montagem. */

/** Registro de controles do editor. Sem editor, não faz nada. */
export function addPropertyControls() {}

/** Constantes que os componentes referenciam ao declarar controles. */
export const ControlType = Object.freeze({
  Boolean: 'boolean',
  Number: 'number',
  String: 'string',
  Color: 'color',
  Enum: 'enum',
  SegmentedEnum: 'segmentedenum',
  Array: 'array',
  Object: 'object',
  Image: 'image',
  ResponsiveImage: 'responsiveimage',
  File: 'file',
  Link: 'link',
  ComponentInstance: 'componentinstance',
  Transition: 'transition',
  EventHandler: 'eventhandler',
  Date: 'date',
  Padding: 'padding',
  BorderRadius: 'borderradius',
  Border: 'border',
  BoxShadow: 'boxshadow',
  FusedNumber: 'fusednumber',
});

/** Alvo de renderização. Sempre "preview": é o modo animado, não o placeholder. */
export const RenderTarget = Object.freeze({
  canvas: 'CANVAS',
  export: 'EXPORT',
  thumbnail: 'THUMBNAIL',
  preview: 'PREVIEW',
  current() {
    return 'PREVIEW';
  },
});

/** Renderizador estático é coisa de export do Framer. Aqui é sempre ao vivo. */
export function useIsStaticRenderer() {
  return false;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node dev/verify-starfield.cjs && node --check assets/vendor/framer-shim.mjs`

Expected: `2 verificações passaram` e nenhuma saída do `node --check`.

- [ ] **Step 5: Commit**

```bash
git add assets/vendor/framer-shim.mjs dev/verify-starfield.cjs
git commit -m "feat(landing): shim local do pacote framer com os 4 símbolos usados"
```

---

### Task 3: Prova de fumaça React 19 mais framer-motion 11

Esta task existe para resolver o `INDEFINIDO` da spec antes de qualquer trabalho de porte. Se ela falhar, a abordagem inteira muda e nada do que vem depois é escrito.

**Files:**
- Create: `dev/smoke-react.html`

**Interfaces:**
- Consumes: `assets/vendor/react.mjs`, `assets/vendor/jsx-runtime.mjs`, `assets/vendor/react-dom-client.mjs`, `assets/vendor/framer-motion.mjs` da Task 1.
- Produces: nada em runtime. É um artefato de verificação que fica em `dev/`, fora da página de produção.

- [ ] **Step 1: Escrever a página de fumaça**

Criar `dev/smoke-react.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Smoke: React 19 + framer-motion 11</title>
<body style="background:#111;color:#eee;font:14px system-ui;padding:24px">
<h1>Smoke test</h1>
<div id="root"></div>
<pre id="log"></pre>
<script type="module">
  const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
  window.addEventListener('error', (e) => log('ERRO: ' + e.message));
  try {
    const React = await import('../assets/vendor/react.mjs');
    const { createRoot } = await import('../assets/vendor/react-dom-client.mjs');
    const { jsx } = await import('../assets/vendor/jsx-runtime.mjs');
    const fm = await import('../assets/vendor/framer-motion.mjs');

    log('react ' + (React.version || '?'));
    log('hooks presentes: ' + ['useState', 'useEffect', 'useRef'].every((h) => typeof React[h] === 'function'));
    log('framer-motion useScroll: ' + typeof fm.useScroll);
    log('framer-motion useTransform: ' + typeof fm.useTransform);
    log('framer-motion useInView: ' + typeof fm.useInView);

    function Probe() {
      const [n, setN] = React.useState(0);
      const ref = React.useRef(null);
      const inView = fm.useInView(ref);
      React.useEffect(() => { setN(1); }, []);
      return jsx('div', { ref, children: 'hook state=' + n + ' inView=' + String(inView) });
    }
    createRoot(document.getElementById('root')).render(jsx(Probe, {}));
    log('RESULTADO: OK, um React so, hooks funcionando');
  } catch (e) {
    log('RESULTADO: FALHOU -> ' + e.message);
  }
</script>
</body>
```

- [ ] **Step 2: Servir e abrir no navegador**

Run: `python -m http.server 8080` na raiz do repo, depois abrir `http://localhost:8080/dev/smoke-react.html`.

Usar o Playwright MCP: `browser_navigate` para a URL, depois `browser_console_messages` e `browser_snapshot`.

Expected: o `<pre>` mostra `react 19.2.8`, `hooks presentes: true`, os três hooks do framer-motion como `function`, `hook state=1` e `RESULTADO: OK`. O console não pode ter nenhuma mensagem contendo `Invalid hook call`.

- [ ] **Step 3: Decidir com base no resultado**

Se passou: seguir para a Task 4.

Se apareceu `Invalid hook call`: existem duas cópias do React. Conferir `grep -n 'react@' assets/vendor/framer-motion.mjs` e corrigir os `REWRITES` do `_fetch_vendor.py`, depois refazer a Task 1.

Se o framer-motion não exportar algum dos três hooks: trocar `FRAMER_MOTION` para `12.23.12` em `_fetch_vendor.py`, refazer a Task 1 e repetir esta prova. **Parar e reportar ao usuário antes de rebaixar o React para 18**, porque isso muda a spec.

- [ ] **Step 4: Commit**

```bash
git add dev/smoke-react.html
git commit -m "test(landing): prova de fumaca React 19 + framer-motion 11"
```

---

### Task 4: Sinal de scroll

Unidade pura e isolada: recebe posições de scroll e devolve energia suavizada. Sem DOM próprio, então roda em node.

**Files:**
- Create: `assets/scroll-signal.mjs`
- Test: `dev/verify-starfield.cjs` (acrescentar bloco)

**Interfaces:**
- Consumes: nada.
- Produces: `createScrollSignal({ getY, decay = 0.88, scale = 0.045 })` retorna um objeto com `sample()` que lê a posição atual e atualiza o estado interno, e as propriedades `energy` (número de 0 a 1, magnitude do movimento) e `direction` (número de -1 a 1, sinal do movimento). `assets/starfield.mjs` consome as duas.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `dev/verify-starfield.cjs`, antes da linha do total:

```javascript
console.log('\nsinal de scroll');
(async () => {
  const { createScrollSignal } = await import('../assets/scroll-signal.mjs');

  check('em repouso a energia e zero', () => {
    const s = createScrollSignal({ getY: () => 0 });
    s.sample(); s.sample();
    assert.strictEqual(s.energy, 0);
  });

  check('scroll para baixo gera energia positiva e direcao 1', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 400; s.sample();
    assert.ok(s.energy > 0.5, 'energia ficou ' + s.energy);
    assert.strictEqual(s.direction, 1);
  });

  check('scroll para cima gera direcao -1', () => {
    let y = 400;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 0; s.sample();
    assert.ok(s.energy > 0.5);
    assert.strictEqual(s.direction, -1);
  });

  check('energia satura em 1', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 999999; s.sample();
    assert.ok(s.energy <= 1, 'energia passou de 1: ' + s.energy);
  });

  check('energia decai ate zerar quando o scroll para', () => {
    let y = 0;
    const s = createScrollSignal({ getY: () => y });
    s.sample();
    y = 400; s.sample();
    for (let i = 0; i < 200; i++) s.sample();
    assert.ok(s.energy < 0.01, 'energia não decaiu: ' + s.energy);
  });

  console.log('\n' + passed + ' verificações passaram');
})();
```

Remover a linha `console.log('\n' + passed + ' verificações passaram');` que existia no fim da Task 2, para o total sair uma vez só.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node dev/verify-starfield.cjs`

Expected: erro de módulo não encontrado para `../assets/scroll-signal.mjs`.

- [ ] **Step 3: Implementar**

Criar `assets/scroll-signal.mjs`:

```javascript
/* WaveOps: energia de scroll suavizada, para alimentar o campo de partículas do hero.

   Puro de propósito: recebe o leitor de posição por injeção, então roda em node
   sem DOM e é verificável sem navegador. */

/**
 * @param {object} opts
 * @param {() => number} opts.getY leitor da posição de scroll em pixels.
 * @param {number} [opts.decay] fator de decaimento por frame, entre 0 e 1.
 * @param {number} [opts.scale] pixels de deslocamento que saturam a energia.
 */
export function createScrollSignal({ getY, decay = 0.88, scale = 0.045 }) {
  let last = getY();
  let energy = 0;
  let direction = 0;

  return {
    get energy() {
      return energy;
    },
    get direction() {
      return direction;
    },
    sample() {
      const now = getY();
      const delta = now - last;
      last = now;

      if (delta !== 0) direction = delta > 0 ? 1 : -1;

      // Magnitude normalizada, saturada em 1.
      const impulse = Math.min(1, Math.abs(delta) * scale);
      // Sobe rápido no impulso, desce devagar no decaimento.
      energy = Math.max(impulse, energy * decay);
      if (energy < 1e-4) {
        energy = 0;
        direction = 0;
      }
      return energy;
    },
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node dev/verify-starfield.cjs && node --check assets/scroll-signal.mjs`

Expected: `7 verificações passaram`, sem nenhuma linha `FAIL`.

- [ ] **Step 5: Commit**

```bash
git add assets/scroll-signal.mjs dev/verify-starfield.cjs
git commit -m "feat(landing): sinal de energia de scroll suavizado e testado"
```

---

### Task 5: Portar o componente Starfield

**Files:**
- Create: `assets/starfield.mjs`
- Test: `dev/verify-starfield.cjs` (acrescentar bloco)

**Interfaces:**
- Consumes: `./vendor/jsx-runtime.mjs`, `./vendor/react.mjs`, `./vendor/framer-shim.mjs`, `./scroll-signal.mjs`.
- Produces: `export default function HeroStarfield(props)`, componente React. Props relevantes para a montagem: `dotColor` (string CSS), `theme` (`"dark"` ou `"light"`), `gap`, `baseRadius`, `influenceRadius`, `pushStrength`, `glowBoost`, `shootingStarsEnabled`, `breatheEnabled`, `twinkleEnabled`, `paused` (booleano, novo) e `scrollPush` (número, novo).

- [ ] **Step 1: Baixar o fonte original**

Run:
```bash
curl -sL "https://framerusercontent.com/modules/KReO4yv4q4ZMhbtn0d3k/pt0JNuUTMVTRmF7Htoul/Starfield_Motion.js" -o assets/starfield.mjs
node --check assets/starfield.mjs
```

Expected: arquivo de aproximadamente 24.566 bytes, sem erro de sintaxe.

- [ ] **Step 2: Aplicar as seis transformações do porte**

Editar `assets/starfield.mjs`. Todas as trocas são literais e verificáveis:

1. `import{jsx as _jsx}from"react/jsx-runtime"` vira `import{jsx as _jsx}from"./vendor/jsx-runtime.mjs"`
2. `from"react"` vira `from"./vendor/react.mjs"`
3. `from"framer"` vira `from"./vendor/framer-shim.mjs"`
4. Acrescentar no topo: `import{createScrollSignal}from"./scroll-signal.mjs"`
5. As duas ocorrências de `ctx.fillStyle=bg;ctx.fillRect(0,0,s.W,s.H)` (uma em `drawStaticFrame`, outra em `animate`) viram `ctx.clearRect(0,0,s.W,s.H)`. O componente original pinta fundo opaco, o que apagaria o gradiente e o glow que já existem no hero.
6. Nos dois `return` finais, trocar `background:bg` por `background:"transparent"`.

Remover também o bloco `addPropertyControls(HeroStarfield, {...})` inteiro e o `export const __FramerMetadata__`: sem editor do Framer eles são peso morto. Manter o import do shim, porque `RenderTarget` e `useIsStaticRenderer` continuam sendo usados no corpo do componente.

- [ ] **Step 3: Acoplar o scroll à física**

Ainda em `assets/starfield.mjs`, dentro do `useEffect` que roda a animação:

Antes da função `animate`, criar o sinal:

```javascript
const scroll = createScrollSignal({ getY: () => window.scrollY });
```

Dentro de `animate()`, logo depois da linha `const t=performance.now()*.001;`, acrescentar:

```javascript
// Energia de scroll: empurra as partículas no eixo Y e acende o brilho.
scroll.sample();
const scrollE = scroll.energy;
const scrollDir = scroll.direction;
```

No laço `for(let i=0;i<s.count;i++)`, logo antes de `s.velX[i]+=(targetX-s.posX[i])*.15;`, acrescentar:

```javascript
if (scrollE > 0) {
  // Deslocamento contrário ao movimento, como inércia.
  targetY -= scrollDir * scrollPush * scrollE * (0.4 + (i % 7) * 0.1);
  alpha = Math.min(1, alpha + scrollE * 0.25);
}
```

Na desestruturação de props no topo do componente, acrescentar `paused=false` e `scrollPush=18`.

Logo no início de `animate()`, antes de agendar o próximo frame, acrescentar o respeito à pausa:

```javascript
if (paused) { drawStaticFrame(); return; }
```

E incluir `paused` e `scrollPush` no array de dependências do `useEffect`.

- [ ] **Step 4: Escrever a verificação do porte**

Acrescentar em `dev/verify-starfield.cjs`, dentro do bloco async, antes do total:

```javascript
console.log('\nporte do starfield');
check('nenhum specifier bare sobrou', () => {
  const src = read('assets/starfield.mjs');
  const bare = [...src.matchAll(/from\s*"([^".][^"]*)"/g)]
    .map((m) => m[1])
    .filter((s) => !s.startsWith('.') && !s.startsWith('/'));
  assert.deepStrictEqual(bare, [], 'sobrou specifier bare: ' + bare.join(', '));
});
check('canvas é transparente, não pinta fundo opaco', () => {
  const src = read('assets/starfield.mjs');
  assert.ok(!/fillRect\(0,0,s\.W,s\.H\)/.test(src), 'ainda pinta fundo opaco com fillRect');
  assert.ok(/clearRect\(0,0,s\.W,s\.H\)/.test(src), 'falta o clearRect');
});
check('respeita a pausa de movimento', () => {
  assert.ok(/if\s*\(\s*paused\s*\)/.test(read('assets/starfield.mjs')), 'falta o guard de paused');
});
check('consome o sinal de scroll', () => {
  const src = read('assets/starfield.mjs');
  assert.ok(/createScrollSignal/.test(src), 'não importa createScrollSignal');
  assert.ok(/scroll\.sample\(\)/.test(src), 'não amostra o scroll no loop');
});
check('mantem o perfil de performance por device', () => {
  const src = read('assets/starfield.mjs');
  assert.ok(/getDeviceProfile/.test(src), 'o porte removeu o getDeviceProfile');
  assert.ok(/1500/.test(src), 'perdeu o teto de 1500 pontos do mobile');
  assert.ok(/quantAlpha/.test(src), 'perdeu a quantizacao de alpha, que segura o custo por frame');
  assert.ok(/spatialGrid/.test(src), 'perdeu o hash espacial da interação de mouse');
});
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `node dev/verify-starfield.cjs && node --check assets/starfield.mjs`

Expected: `12 verificações passaram`, sem `FAIL`.

- [ ] **Step 6: Commit**

```bash
git add assets/starfield.mjs dev/verify-starfield.cjs
git commit -m "feat(landing): porta Starfield Motion para ESM local com acoplamento de scroll"
```

---

### Task 6: Montar o island no hero

**Files:**
- Create: `assets/starfield-mount.mjs`
- Modify: `index.html` (dentro de `.flow-canvas`, por volta da linha 313, e antes de `</body>`)
- Modify: `assets/styles.css:299-310` (bloco `.flow-canvas` e `.flow-canvas .dots-bg`)

**Interfaces:**
- Consumes: `HeroStarfield` de `./starfield.mjs`, `createRoot` de `./vendor/react-dom-client.mjs`, `jsx` de `./vendor/jsx-runtime.mjs`, o global `window.FlowTheme` e o evento `waveops:motion`.
- Produces: nada. É o ponto de entrada, ninguém importa dele.

- [ ] **Step 1: Acrescentar o alvo no HTML**

Em `index.html`, dentro de `.flow-canvas` e como primeiro filho, antes dos `.fnode`:

```html
<div id="hero-starfield" aria-hidden="true"></div>
```

E imediatamente antes de `</body>`, depois do `<script src="assets/main.js"></script>` que já existe:

```html
<script type="module" src="assets/starfield-mount.mjs"></script>
```

`type="module"` é adiado por padrão, então não bloqueia o render nem o LCP do texto do hero.

- [ ] **Step 2: Posicionar o canvas no CSS**

Em `assets/styles.css`, depois do bloco `.flow-canvas .dots-bg`, acrescentar:

```css
/* Island React do campo de partículas. Fica atrás dos nós e dos fios.
   O .dots-bg continua no DOM como fallback caso o módulo não carregue. */
#hero-starfield {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: inherit;
  overflow: hidden;
}
#hero-starfield canvas { display: block; width: 100%; height: 100%; }
.flow-canvas:has(#hero-starfield canvas) .dots-bg { opacity: 0; }
```

O seletor `:has()` só apaga o fundo estático depois que o canvas existe de verdade. Se o módulo falhar, o `.dots-bg` continua visível e a página nunca fica sem fundo.

Conferir que `.flow-canvas` já tem `position: relative`. Se não tiver, acrescentar.

- [ ] **Step 3: Escrever a cola de montagem**

Criar `assets/starfield-mount.mjs`:

```javascript
/* WaveOps: monta o campo de partículas do hero como island React.

   Cola fina de propósito. A física mora em starfield.mjs, o estado de tema mora
   no FlowTheme e o estado de movimento mora no motion.js. Aqui só se conectam. */

import { createRoot } from './vendor/react-dom-client.mjs';
import { jsx } from './vendor/jsx-runtime.mjs';
import HeroStarfield from './starfield.mjs';

const alvo = document.getElementById('hero-starfield');
if (alvo) {
  const raiz = createRoot(alvo);

  /** Lê as cores dos tokens CSS. Nunca hardcoded em JS. */
  function lerTokens() {
    const estilo = getComputedStyle(document.documentElement);
    const accent = estilo.getPropertyValue('--accent').trim();
    const border = estilo.getPropertyValue('--border').trim();
    return {
      dotColor: accent || '#7c3aed',
      dotColorLight: border || '#18181b',
      theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    };
  }

  let pausado = document.documentElement.dataset.motion === 'paused';

  function pintar() {
    raiz.render(
      jsx(HeroStarfield, {
        ...lerTokens(),
        paused: pausado,
        gap: 12,
        baseRadius: 1.1,
        influenceRadius: 110,
        pushStrength: 16,
        glowBoost: 0.5,
        scrollPush: 18,
        borderRadius: 0,
        shootingStarsEnabled: true,
        breatheEnabled: true,
        twinkleEnabled: true,
      })
    );
  }

  pintar();

  // Tema: o FlowTheme continua sendo a fonte única. Aqui só assinamos.
  if (window.FlowTheme && typeof window.FlowTheme.subscribe === 'function') {
    window.FlowTheme.subscribe(pintar);
  }

  // Movimento: o motion.js continua sendo o dono único do estado.
  window.addEventListener('waveops:motion', (evento) => {
    pausado = Boolean(evento.detail && evento.detail.paused);
    pintar();
  });
}
```

- [ ] **Step 4: Verificar no navegador**

Run: `python -m http.server 8080` na raiz, depois abrir `http://localhost:8080/index.html`.

Com o Playwright MCP, nesta ordem:
1. `browser_navigate` para a URL.
2. `browser_console_messages`. Expected: nenhuma mensagem de erro, e em especial nenhuma contendo `Invalid hook call` nem `Content Security Policy`.
3. `browser_take_screenshot` do hero. Expected: partículas visíveis atrás dos cinco cards, com o gradiente e o glow do hero preservados por baixo.
4. `browser_hover` sobre o centro do `.flow-canvas`, depois novo screenshot. Expected: partículas afastadas do cursor.
5. `browser_evaluate` com `window.scrollTo(0, 600)` e novo screenshot. Expected: deslocamento vertical visível nas partículas.
6. Clicar em `#motion-toggle` e rodar `browser_evaluate` contando frames por 1 segundo. Expected: 0 frames novos com o movimento pausado.
7. Clicar no botão de tema e novo screenshot. Expected: cor das partículas muda junto com o tema.
8. `browser_resize` para 390x844 e novo screenshot. Expected: hero legível, sem estouro horizontal.

- [ ] **Step 5: Commit**

```bash
git add assets/starfield-mount.mjs assets/styles.css index.html
git commit -m "feat(landing): monta o campo de particulas do hero como island React"
```

---

### Task 7: Registrar o desvio e fechar a verificação

**Files:**
- Modify: `CLAUDE.md` (seções "What this is" e "Architecture")
- Modify: `docs/specs/2026-09-09-starfield-react-islands.md` (bloco de evidências)

**Interfaces:**
- Consumes: os resultados de todas as tasks anteriores.
- Produces: documentação correta. Nada de runtime.

- [ ] **Step 1: Corrigir o CLAUDE.md**

O `CLAUDE.md` hoje afirma "no build step, no package manager, no test suite, no framework bundling", "zero runtime dependencies" e "No React, no Babel, no build step". Depois desta entrega, parte disso está errado.

Na seção "What this is", substituir a frase sobre dependências por:

```markdown
There is **no build step and no package manager**. The production page is plain HTML + CSS + JS.
Since 09/09/2026 it also loads React 19 and framer-motion 11 as pre-compiled ESM, vendored in
`assets/vendor/` and served from the same origin, to run the ported Framer Starfield component in
the hero. This is a deliberate, user-approved deviation from the previous "zero runtime
dependencies" property: it costs about 113 KB gzip. There is still no npm, no `node_modules`,
no bundler and no Babel. Regenerate the vendored modules with `python _fetch_vendor.py`;
see `assets/vendor/README.md`.
```

Na seção "Script load order", acrescentar ao fim:

```markdown
After `assets/main.js`, `assets/starfield-mount.mjs` loads as `<script type="module">`. It mounts the
`#hero-starfield` React island inside `.flow-canvas`, reads colors from the CSS tokens through
`FlowTheme` and pauses on the `waveops:motion` event. It has no import map on purpose: every
specifier is relative, so the CSP stays at `script-src 'self'`. If the module fails, the CSS
`.dots-bg` fallback stays visible.
```

- [ ] **Step 2: Rodar a verificação completa**

Run:
```bash
node dev/verify-starfield.cjs
for f in assets/*.mjs assets/vendor/framer-shim.mjs; do node --check "$f" || echo "FALHOU: $f"; done
grep -rn 'esm\.sh' assets/vendor/*.mjs | grep -v README
grep -n 'Content-Security-Policy' index.html
cat assets/vendor/*.mjs assets/starfield.mjs assets/starfield-mount.mjs assets/scroll-signal.mjs | gzip -c | wc -c
```

Expected: todas as verificações passam; nenhum `FALHOU`; o `grep` do esm.sh não retorna nada; a linha da CSP é idêntica à de antes da branch (conferir com `git diff index.html`); o peso em gzip fica perto de 116.000 bytes.

- [ ] **Step 3: Conferir que a CSP não mudou**

Run: `git diff main -- index.html | grep -i 'security-policy'`

Expected: **nenhuma saída.** Qualquer linha aqui é falha de aceite e precisa ser revertida.

- [ ] **Step 4: Registrar as evidências na spec**

Acrescentar ao fim de `docs/specs/2026-09-09-starfield-react-islands.md` uma seção `## Evidências de verificação` com os resultados reais: saída do `verify-starfield.cjs`, peso final medido em gzip, confirmação de console limpo no navegador, contagem de frames com movimento pausado, e os tamanhos de viewport testados. Escrever só o que foi realmente observado. Se algo não deu para verificar, escrever a linha `Não verificado: <o quê> porque <motivo>`.

- [ ] **Step 5: Commit**

`docs/specs/` está no `.gitignore` deste repo desde antes desta branch, com o comentário
"Internal roadmap/specs (local only, importados no Notion)". Zero specs são rastreadas. O repo é publicado
no GitHub Pages, então a spec fica local de propósito. **Não usar `git add -f`.** Commitar só o `CLAUDE.md`:

```bash
git add CLAUDE.md
git commit -m "docs(landing): registra o desvio de zero-dependencias no CLAUDE.md"
```

A seção de evidências continua sendo escrita no arquivo local da spec, que é o registro de trabalho.

---

## Review

Implementador não é revisor. Depois da Task 7, um agente em contexto separado revisa o diff completo com ordem de achar problema, com foco em: React duplicado, vazamento de `requestAnimationFrame` na desmontagem, cor hardcoded em JS, regressão de CSP, e perda do fallback `.dots-bg`. As mudanças visuais são verificadas no navegador, não por teste que apenas reproduz o CSS.

## Rollback

O island é aditivo. Para reverter: remover as duas linhas acrescentadas em `index.html`. O `.dots-bg` volta a aparecer sozinho, porque o seletor `:has()` deixa de casar. Nenhum outro arquivo precisa mudar.
