# WaveOps — Landing Page

Landing page institucional em PT-BR, com tema escuro inicial, opção de tema claro,
painel de workflow em HTML e SVG, diagramas animados e formulário de lead. A seção comercial
apresenta entregas sob medida; os valores são conversados pelo WhatsApp.

Não tem build step. A página de produção é HTML + CSS + JS puro, sem nenhuma
dependência em runtime. O painel de Tweaks (React via CDN) é uma ferramenta só de
desenvolvimento e fica em `dev/`, fora da página. Para rodar: abra o
`index.html` em um servidor estático ou na extensão **Live Server** do VS Code.

---

## Estrutura dos arquivos

```
index.html                → a página (markup de todas as seções)
assets/
  styles.css              → estilos base e componentes existentes
  cinematic.css           → direção visual, tokens, diagramas e responsividade
  brand/waveops-badge-3d.webp
                          → base 3D frontal, transparente, sem pinos laterais.
                            Usada na logo do topo e do rodapé. Único 3D da página
  workflow.css            → painel 3D alternativo. Está no repo, mas a página NÃO carrega
  scene.js                → controlador do painel 3D. Também não carregado
  workflow-core-v1.webp   → núcleo do painel 3D. Só serve com workflow.css ativo
  motion.js               → pausa global, movimento reduzido e progresso de leitura
  main.js                 → interações: nav, menu mobile, FAQ, abas de preço,
                            reveal no scroll, scrollspy e o FORMULÁRIO DE LEAD
  theme-store.js          → fonte única de verdade do tema (claro/escuro, cor,
                            fonte, densidade). Persiste em localStorage.
dev/                      → só desenvolvimento, NÃO carregado em produção
  tweaks-app.jsx          → painel de Tweaks (liga-se ao theme-store)
  tweaks-panel.jsx        → componentes do painel (não precisa editar)
  verify-design.js        → verificações de UI para executar no navegador local
  verify-workflow.cjs     → controlador de movimento, com DOM simulado
uploads/                  → PDFs do briefing (referência local, fora do git)
```

O hero apresenta um painel compacto com quatro cards e um núcleo 3D sobre uma grade
pontilhada. O núcleo central, "IA qualifica", conecta as entradas de WhatsApp e site
às saídas de CRM e follow-up por trajetos SVG violetas animados. O painel permanece
frontal, com perspectiva CSS e faces laterais nos cards e na moldura. A profundidade
e o movimento ficam nos elementos, que flutuam em ciclos independentes de 19 a 31 segundos, e nos pulsos das
conexões SVG.

Os scripts finais carregam na ordem `motion.js`, `main.js` e `scene.js`.
As animações respeitam `prefers-reduced-motion` e a pausa global, e param quando
o painel sai da tela ou a aba fica oculta. O HTML e o SVG permanecem legíveis sem
JavaScript. A preferência de tema continua no `FlowTheme`.

`portal/public/landing.html` e `portal/public/assets/` são cópias geradas.
Depois de editar a raiz, execute `node portal/scripts/sync-landing.mjs` para
atualizá-las. O portal também executa essa sincronização em `predev/prebuild`.

---

## Onde o BACK-END entra

### 1. Formulário de lead  ← principal
Arquivo: `assets/main.js` — procure por **`PONTO DE INTEGRAÇÃO COM O BACK-END`**.

Há uma função isolada `submitLead(data)`. Hoje ela só simula sucesso.
Troque o corpo dela pela chamada à sua API. O objeto `data` já vem montado:

```js
{
  nome:      "...",
  empresa:   "...",
  whatsapp:  "...",
  dor:       "...",      // valor do <select>
  mensagem:  "...",      // opcional
  origem:    "landing",
  enviadoEm: "2026-06-13T..."  // ISO
}
```

A UI já trata: estado "Enviando...", botão desabilitado, tela de sucesso e erro.
Você só precisa fazer o `fetch` funcionar.

**Sugestão de endpoint:** `POST /api/leads` → grava no banco + dispara
notificação (e-mail/WhatsApp para o time). Retorne `200` em caso de sucesso.

### 2. Botões de WhatsApp
Os botões de WhatsApp apontam para `https://wa.me/5534991775784` com mensagem
pré-preenchida (hero, seção de contato e rodapé), abrindo em nova aba.
Para trocar o número, procure por `wa.me/5534991775784` no `index.html`.

### 3. (Opcional) Conteúdo dinâmico
Preços, planos e textos estão fixos no HTML. Se quiser administrá-los por um
painel/CMS no futuro, dá para trocar por um fetch que popula as seções
`#pacotes` e os cards. Não é necessário para o MVP.

---

## Sugestão de stack para o back-end
Qualquer uma serve — o front é agnóstico:
- **Node + Express/Fastify** com um endpoint `/api/leads`
- **Next.js** (API routes) se quiser SSR depois
- **Supabase / Firebase** se quiser banco + auth prontos
- Banco: Postgres ou similar, uma tabela `leads` com os campos acima

---

## Tema e Tweaks
`theme-store.js` expõe `window.FlowTheme` (get/set/toggleTheme/subscribe) e
guarda a preferência em `localStorage` na chave `waveops:tweaks:v1`.
O botão de sol/lua no topo e o painel de Tweaks usam a mesma fonte de verdade.

---

## Pendências de marca
- Marca definida: **WaveOps**, domínio **waveops.com.br**.
- E-mail do rodapé: `contato@waveops.com.br` (configurar essa caixa de entrada).
- Domínio próprio pendente: o `CNAME` e as URLs canônicas só mudam para `waveops.com.br` depois que o DNS apontar para o GitHub Pages.
