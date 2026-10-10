# Site institucional WaveOps v2: plano de implementação

> **Para agentes:** sub-skill obrigatória: `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Cada onda roda o `engineering-loop` por tarefa. Passos com checkbox (`- [ ]`).
>
> **Nível de detalhe:** este plano fixa ondas, tarefas, arquivos, interfaces, testes e comandos. Os passos com código de cada tarefa são escritos no início de cada onda, depois do gate H1, porque o código depende da decisão D1 (arquitetura). Escrever o código antes seria retrabalho se D1 mudar.

**Goal:** publicar as 6 páginas do design aprovado no mesmo Netlify, com formulário de contato e lista de interesse persistindo de verdade, sem perder nenhuma função que funciona hoje.

**Architecture (recomendada, depende de D1):** HTML, CSS e JavaScript puro, multipáginas. Parciais carimbadas por `dev/site/build.mjs`, páginas carimbadas commitadas, deploy por cópia como hoje. Formulários em ES modules com funções puras testáveis em Node. Leads e lista de interesse vão ao n8n por contrato versionado.

**Tech Stack:** HTML5, CSS com custom properties, ES modules sem bundler, Node 24 só no ferramental, Playwright, axe-core, TypeScript em modo `checkJs`, n8n Cloud, Netlify.

**Spec:** `docs/specs/2026-10-09-site-institucional-v2.md`

## Global Constraints

- Zero dependência em produção. Dependência de teste só em `tests/site/package.json`.
- CSP `<meta>` primeira no `<head>` de toda página. Sem script inline, sem `style` novo que exija mudar a CSP.
- Assets por caminho a partir da raiz: `/assets/...`. Links internos com barra final: `/solucoes/`.
- Copy literal do design. PT-BR com acento. Nunca travessão (em dash ou en dash).
- Larguras de 360 a 1440 px. Alvo de toque de 44 px. Contraste AA no texto e 3:1 em borda de campo.
- Nenhum módulo ou plano como disponível. Maquete sempre marcada como ilustração.
- Nada de produção, credencial, DNS, n8n ou painel sem aprovação explícita do Vitor.
- Branch `feat/site-institucional-v2` em worktree separado. Sem commit na `main`. O merge é do Vitor.

## Review Focus

1. **Rede lenta ou n8n fora durante o envio:** a pessoa vê falha clara, os dados continuam preenchidos, há "Tentar de novo" e saída pelo WhatsApp. Nunca confirmação falsa para humano. Teste em C3 (timeout de 12 s e resposta 503).
2. **Duplo clique e reenvio:** um lead só. Botão travado durante o envio e `idEnvio` reutilizado no "Tentar de novo". Teste em C3 (duas tentativas, mesmo `idEnvio`).
3. **Visitante sem JavaScript:** todo o conteúdo visível, painéis dos seletores em sequência, formulário com saída por WhatsApp e e-mail. Teste em B2 (Playwright com `javaScriptEnabled: false`).
4. **Link antigo com âncora** (`/#contato`, `/#pacotes`) vindo de anúncio, WhatsApp ou portal: cai no destino novo. Teste em D2.
5. **Celular de 360 px e zoom de 200%:** sem rolagem horizontal, tabela empilhada legível, menu operável por teclado. Teste em E1.

Casos de borda com teste na tarefa dona: telefone colado com `+55` e espaços (C1), e-mail com maiúscula e espaço (C1), Pixel bloqueado por extensão (C3), `sessionStorage` indisponível no Safari privado (C2).

---

## Grafo de execução

```
H1  aprovação do plano e das decisões D1 a D5            (Vitor)
 │
 A  Fundação: worktree, ferramental, fontes, CI
 │
 B  Design system em código: tokens, componentes, parciais, site.js
 │
 ├──────────────┬──────────────┬──────────────┐
 P1 Home        P2 Soluções    P3 Plataforma        (onda 3, paralela, arquivos próprios)
 P4 Sob medida  P5 Demonstr.   P6 Contato           (onda 4, paralela, arquivos próprios)
 │                                              │
 │   C  Formulários: libs puras (começa junto de B), contato.js, interesse.js, funil
 │   │
 │   F  Integrações: n8n v2 e lista de interesse (JSON + doc), PR do portal    (paralelo a B e P*)
 │   │
 D  SEO, rotas, netlify.toml, sitemap, llms.txt, 404, âncoras antigas
 │
 I  Integração: build simulado do Netlify, fumaça do conjunto
 │
 R  Review adversarial em contexto separado, depois correções
 │
 E  Verificação final: Playwright, axe, visual, peso, Lighthouse, console, links
 │
 H2 publicar n8n v2 e envio real na homologação         (Vitor)
 H3 merge do PR do portal, logo após o corte            (Vitor)
 H4 revisão jurídica e confirmações de conteúdo         (Vitor)
 H5 homologação final e merge do PR do site             (Vitor)
```

Pontos de convergência: I (junta páginas, formulários e rotas) e E (prova o sistema montado). Bloqueadores: H1 bloqueia tudo; H2 bloqueia só o envio real; H4 bloqueia só a publicação.

Conflito de arquivo: as páginas não editam `components.css`. Componente novo descoberto numa página volta para B, serializado.

## Estimativa

| Onda | Tarefas | Esforço (h) |
|---|---|---|
| 1 | A | 3 a 4 |
| 2 | B, C1, F1 | 8 a 12 |
| 3 | P1, P2, P3 | 7 a 8,5 |
| 4 | P4, P5, P6, C2, C3, F2 | 10,5 a 13,5 |
| 5 | D, I | 3 a 4 |
| 6 | R e correções | 3 a 5 |
| 7 | E e checklist | 4 a 6 |
| **Total** | | **38 a 53 h de esforço**. Com as ondas 2 a 4 em paralelo, cerca de 25 a 35 h de relógio, fora o tempo dos gates do Vitor |

---

## Tarefas

Cada tarefa tem os 6 campos (contexto, objetivo, requisitos, aceite, notas, estimativa), mais arquivos e interfaces.

### A. Fundação

- **Contexto:** sem ferramental, nada prova que as 6 páginas estão consistentes.
- **Objetivo:** worktree, carimbo de parciais, lint, servidor local, harness de teste, fontes e job de CI prontos e verdes numa página de prova.
- **Requisitos:** Node 24, zero dependência fora de `tests/site/`. Worktree via `superpowers:using-git-worktrees`, criado a partir de `origin/main`, para não tocar no trabalho não commitado da `main` (`.gitignore`, `dev/lab-3d-*`, `docs/marketing/`, `portal/Dockerfile`).
- **Arquivos:**
  - Criar: `dev/site/build.mjs`, `dev/site/lint.mjs`, `dev/site/serve.mjs`, `dev/site/paginas.json`, `dev/site/parciais/` (vazio nesta tarefa), `tests/site/package.json`, `tests/site/package-lock.json`, `tests/site/tsconfig.json`, `tests/site/playwright.config.ts`, `tests/site/unit/build.test.mjs`, `tests/site/unit/lint.test.mjs`
  - Modificar: `assets/fonts.css` (Hanken variável única 400 a 700, Space Mono 400, sem Space Grotesk), `.github/workflows/ci.yml` (job `site`), `.gitignore` (saídas de QA)
- **Interfaces produzidas:**
  - `node dev/site/build.mjs [--check] [--dist <pasta>]`: carimba entre `<!-- parcial:<nome> [ativo="<pagina>"] -->` e `<!-- /parcial:<nome> -->`, troca `?v=` pelo hash de 8 caracteres do arquivo, `--check` sai com 1 se algo mudaria, `--dist` copia exatamente o que o `cp` do `netlify.toml` copia.
  - `node dev/site/lint.mjs [arquivos...]`: sai com 1 e lista `arquivo:linha: regra: mensagem`.
  - `node dev/site/serve.mjs [--port 4321] [--root .]`: URLs com barra final, `404.html`, endpoints simulados `POST /__dev/lead` e `POST /__dev/interesse` (`?simular=falha` responde 503, `?simular=lento` atrasa 15 s).
- **Aceite (testes):** página carimbada de novo fica idêntica; `--check` falha quando um parcial muda; lint acusa travessão, `<img>` sem `alt`, `id` duplicado, link interno quebrado, script inline e CSP ausente ou fora do topo; servidor responde 200 em `/solucoes/` e 404 em `/nao-existe/`.
- **Validação:**
  - `node dev/site/build.mjs --check`
  - `node dev/site/lint.mjs`
  - `npm --prefix tests/site run typecheck`
  - `npm --prefix tests/site run test:unit`
- **Notas:** os 4 arquivos de Hanken por subconjunto têm o mesmo `md5`: um `@font-face` com `font-weight: 400 700` economiza cerca de 100 KB. Netlify publica `assets/` inteiro, então caminhos antigos seguem vivos.
- **Estimativa:** 3 a 4 h.

### B. Design system em código

- **Contexto:** 6 páginas usam as mesmas peças. O design define tudo em estilo inline.
- **Objetivo:** tokens, base, componentes e parciais prontos, com uma galeria local de componentes conferida contra o design.
- **Arquivos:**
  - Criar: `assets/site/tokens.css`, `assets/site/base.css`, `assets/site/components.css`, `assets/site/site.js`, `dev/site/parciais/head.html`, `dev/site/parciais/topo.html`, `dev/site/parciais/rodape.html`, `dev/site/parciais/cta-final.html`, `dev/site/galeria.html` (não publicada), `tests/site/e2e/topo.spec.ts`, `tests/site/e2e/sem-js.spec.ts`
- **Interfaces produzidas:**
  - Classes: `.wo-btn` (`--primario`, `--secundario`, `--fantasma`), `.wo-sobretitulo`, `.wo-selo` (`--disponivel`, `--desenvolvimento`, `--planejado`), `.wo-card`, `.wo-card-link`, `.wo-chip`, `.wo-passos`, `.wo-tabela` (empilha abaixo de 640 px), `.wo-faq`, `.wo-campo`, `.wo-alerta` (`--erro`, `--sucesso`), `.wo-maquete`, `.wo-secao`, `.wo-conteiner`.
  - `site.js` (module): `iniciarTopo()`, `iniciarSeletores(raiz)` para qualquer `[data-seletor]` com botões `[data-opcao]` e painéis `[data-painel]`, `iniciarWhatsApp()` (dispara `whatsapp_click` no funil e `Contact` no Pixel, tolerando `fbq` ausente).
- **Aceite (testes):** menu abre e fecha por teclado, Esc fecha e devolve o foco, painel fechado fora da tabulação, `aria-current="page"` no item ativo; seletor troca painel com `aria-pressed`; com JavaScript desligado, todos os painéis aparecem; galeria lado a lado com o design sem diferença de token.
- **Validação:** build `--check`, lint, `npm --prefix tests/site run test:e2e -- topo sem-js`.
- **Notas:** borda de campo com 3:1 de contraste (desvio 1 da spec). Breakpoints do design: 1180, 720, 640 e 560 px.
- **Estimativa:** 4 a 6 h.

### P1 a P6. Páginas

Uma tarefa por página, cada uma dona só dos próprios arquivos: `<slug>/index.html` (ou `index.html` na Home) e, se preciso, `assets/site/paginas/<slug>.css`.

| Tarefa | Página | Fonte do design | Estimativa |
|---|---|---|---|
| P1 | Home | `Main.dc.html` | 2,5 a 3 h |
| P2 | Soluções | `Solucoes.dc.html` | 2 a 2,5 h |
| P3 | Plataforma (marcação do formulário, sem envio) | `Plataforma.dc.html` | 2,5 a 3 h |
| P4 | Projetos sob medida | `SobMedida.dc.html` | 2 a 2,5 h |
| P5 | Demonstrações técnicas | `Demonstracoes.dc.html` | 1,5 a 2 h |
| P6 | Contato (marcação do formulário, sem envio) | `Contato.dc.html`, `ContatoForm.dc.html`, `ContatoEstados.dc.html` | 2 a 2,5 h |

- **Contexto:** o inventário literal está em `04-design-...md` e `05-design-...md`.
- **Objetivo por página:** seções na ordem do design, texto literal, parciais carimbadas, `title`, `description`, `canonical`, Open Graph e JSON-LD da página.
- **Aceite (testes por página):** lint sem erro; um `h1`; âncoras do design presentes (Soluções: `vender`, `atender`, `operar`, `decidir`, `crescer`, `publicos`; Plataforma: `lista`, `modulos`; Sob medida: `modelos`); selos conferem com a spec (zero "Disponível" em módulo da Plataforma); capturas em 390, 768 e 1440 revisadas lado a lado com os PNG.
- **Validação:** build `--check`, lint, `npm --prefix tests/site run qa:visual -- <slug>`.
- **Notas:** mídia única é o selo 3D da marca (`assets/brand/waveops-badge-3d.webp`). Maquetes com `role="img"` e rótulo de ilustração. "Ver preço e ativar" e "No seu plano" da maquete da Plataforma passam pela revisão de claims em R.

### C. Formulários

**C1. Funções puras (onda 2, junto de B)**

- **Arquivos:** criar `assets/site/lib/validacao.js`, `assets/site/lib/payload.js`, `assets/site/lib/atribuicao.js`, `assets/site/lib/enviar.js`, `assets/site/config.js`, `tests/site/unit/validacao.test.mjs`, `tests/site/unit/payload.test.mjs`, `tests/site/unit/enviar.test.mjs`, `tests/site/unit/config.test.mjs`
- **Interfaces produzidas:**
  - `soDigitos(valor: string): string`
  - `validarTelefone(valor: string): boolean` (10 a 13 dígitos depois de tirar `+55`, espaço, parêntese e hífen)
  - `validarEmail(valor: string): boolean` (com `trim` e minúscula)
  - `validarContato(dados: DadosContato): { valido: boolean, erros: Partial<Record<CampoContato, string>> }` com as mensagens literais da spec 5.6
  - `validarInteresse(dados: { email: string }): { valido: boolean, erros: { email?: string } }`
  - `montarLead(dados: DadosContato, ctx: ContextoEnvio): LeadV2` (15 chaves atuais mais as novas da spec 5.7)
  - `montarInteresse(dados: { email: string }, ctx: ContextoEnvio): InteresseV1`
  - `lerAtribuicao(loc: Location, referrer: string, armazenamento?: Storage): Atribuicao`
  - `enviarJson(url: string, corpo: object, opcoes?: { timeoutMs?: number, fetchImpl?: typeof fetch }): Promise<ResultadoEnvio>`, com `ResultadoEnvio = { ok: boolean, status: number, motivo?: "timeout" | "rede" | "servidor" | "validacao", campos?: string[] }`
  - `endpoints(host: string): { lead: string | null, interesse: string | null, ambiente: "producao" | "local" | "homologacao" | "desligado" }`
- **Aceite (testes):** telefone `+55 (34) 99177-5784` vale; 9 dígitos não vale; e-mail ` Ana@Empresa.com ` normaliza; canal E-mail exige e-mail e dispensa telefone; canal Ligação aceita melhor horário; `montarLead` mantém as 15 chaves antigas; `whatsapp` só preenchido no canal WhatsApp; `enviarJson` devolve `timeout` após 12 s (relógio simulado), `servidor` em 503 e `validacao` com campos em 422; `endpoints("waveops.com.br")` devolve produção, `localhost` devolve `/__dev/...`, `*.netlify.app` sem homologação devolve `desligado`.
- **Validação:** `npm --prefix tests/site run test:unit`, `npm --prefix tests/site run typecheck`.
- **Estimativa:** 2 a 3 h.

**C2. Atribuição no funil**

- **Arquivos:** modificar `assets/funil.js`; criar `tests/site/unit/funil.test.mjs`.
- **Contrato de armazenamento:** `sessionStorage["waveops:origem:v1"] = { fonte, landingUrl, referrerHost, utm: { source, medium, campaign, term, content }, em }`, escrito só por `funil.js`, lido por `atribuicao.js`. `sessionStorage["waveops:visita:v1"]` marca a `visita` já enviada.
- **Aceite (testes):** 2ª página com referrer do próprio site manda a fonte da 1ª; `visita` uma vez por sessão; `sessionStorage` que lança exceção cai no comportamento atual sem quebrar a página.
- **Estimativa:** 1 a 1,5 h.

**C3. Contato e lista de interesse no navegador**

- **Arquivos:** criar `assets/site/contato.js`, `assets/site/interesse.js`, `tests/site/e2e/contato.spec.ts`, `tests/site/e2e/interesse.spec.ts`.
- **Interfaces consumidas:** todas de C1; `window.WaveFunil.enviar(nome, props)`; `window.fbq` opcional.
- **Aceite (testes Playwright com rede interceptada):** envio feliz mostra "Recebido, {nome}." e o foco vai ao título; envio vazio mostra o resumo "Faltam N campos para enviar." com foco nele; troca de canal mostra e esconde telefone, e-mail e melhor horário; 503 mostra falha com dados preservados; 15 s sem resposta mostra falha; "Tentar de novo" reenvia o mesmo `idEnvio`; duplo clique gera um POST; honeypot preenchido não faz POST real e mostra confirmação; Pixel bloqueado não quebra o envio; `lead_enviado` e `Lead` só disparam no 200; lista de interesse com e-mail inválido mostra "Informe um e-mail válido." e com 200 mostra "Você está na lista.".
- **Validação:** `npm --prefix tests/site run test:e2e -- contato interesse`.
- **Estimativa:** 3 a 4 h.

### F. Integrações

**F1. Contrato e workflows n8n (onda 2, arquivos próprios)**

- **Contexto:** o workflow que roda hoje não está versionado. A pasta `n8n/` é ignorada pelo git.
- **Objetivo:** workflow `waveops-lead-v2` e workflow da lista de interesse (se D2 = n8n) em JSON sanitizado, validados, com roteiro de publicação e de teste. Nada publicado sem H2.
- **Arquivos:** criar `docs/integrations/n8n-site-v2.md` (contrato, colunas da planilha, CORS, validação, deduplicação, respostas, roteiro de publicação, roteiro de exclusão de dado de titular), `docs/integrations/n8n-waveops-lead-v2.json`, `docs/integrations/n8n-waveops-interesse-v1.json`. O roteiro de homologação fica no documento local `docs/specs/2026-10-10-n8n-site-v2-operacao-restrita.md`, porque o repo é público.
- **Aceite:** JSON passa na skill `n8n-validate`; todo campo do contrato chega a uma coluna; ramo de erro responde 5xx; resposta 200 só depois do nó da planilha; credencial só por nome de referência; revisão do agente `workflow-reviewer` sem bloqueio.
- **Dependência de entrada:** JSON exportado do `flowops-lead` atual ou um envio real conferido pelo Vitor.
- **Estimativa:** 2 a 3 h.

**F2. PR do portal (branch própria; em 10/10/2026 separado em `feat/portal-funil-interesse`, que entra antes do site, e `feat/portal-links-site-novo`, que entra depois)**

- **Arquivos:** modificar `portal/src/lib/funil.ts` (`EVENTOS`, `ROTULO_ETAPA`, `EVENTOS_DA_LANDING`), `portal/tests/unit/` (teste do evento novo), `portal/src/components/PublicNav.tsx:18`, `portal/src/app/checkout/page.tsx:81,112`, `portal/src/app/cliente/login/page.tsx:178,206`.
- **Aceite:** `interesse_plataforma` aceito pela rota `/api/e`; links absolutos para `https://waveops.com.br/contato/` e `https://waveops.com.br/projetos-sob-medida/#modelos`.
- **Validação:** `cd portal && npm run typecheck && npm run test:unit && npm run build`.
- **Notas:** merge logo depois do corte do site (H3), para os links não apontarem para página que ainda não existe.
- **Estimativa:** 1 h.

### D. SEO, rotas e publicação

- **Arquivos:** modificar `netlify.toml` (`cp` e `ignore` com as 5 pastas e `404.html`, redirect `/index.html`), `sitemap.xml`, `llms.txt`, `CLAUDE.md` (arquitetura multipáginas, ferramental, correções da seção 6 do diagnóstico); criar `404.html`, `tests/site/unit/netlify.test.mjs`, `tests/site/e2e/legado.spec.ts`; regenerar `assets/og-image.png` com o título novo via Chrome headless a partir de `assets/og-image.html`.
- **Âncoras antigas (em `site.js`, só na Home):** `#contato` para `/contato/`, `#pacotes` para `/projetos-sob-medida/#modelos`, `#servicos` para `/solucoes/`, `#casos` para `/demonstracoes-tecnicas/`, `#como` para `/projetos-sob-medida/#como-trabalhamos`, `#faq` para `/projetos-sob-medida/#perguntas`, `#publicos` para `/solucoes/#publicos`.
- **Aceite (testes):** toda página de `dev/site/paginas.json` está no `cp` e no `ignore` do `netlify.toml`; nenhum slug proibido; cada URL do sitemap responde 200 no build simulado; `llms.txt` só com links que existem; cada âncora antiga cai no destino.
- **Validação:** `npm --prefix tests/site run test:unit -- netlify`, `npm --prefix tests/site run test:e2e -- legado`, `node dev/site/build.mjs --dist .tmp-site`.
- **Estimativa:** 2 a 3 h.

### I. Integração

- **Objetivo:** montar o build simulado do Netlify, servir a pasta montada e rodar a fumaça de todas as jornadas sobre ela.
- **Validação:** `node dev/site/build.mjs --dist .tmp-site && node dev/site/serve.mjs --root .tmp-site --port 4322` com `npm --prefix tests/site run test:e2e -- --grep @fumaca`.
- **Estimativa:** 1 h.

### R. Review adversarial

- **Objetivo:** contexto novo, com ordem de achar problema: regressão, acessibilidade, CSP, LGPD, claims, copy (travessão e acento), escopo que ninguém pediu. Depois, correções com novo ciclo de verificação.
- **Quem:** agente `reviewer` para código, agente `claims-compliance-auditor` adaptado às regras WaveOps para copy, skill `humanizer` só para texto novo que não veio do design.
- **Estimativa:** 3 a 5 h com correções.

### E. Verificação final e homologação

- **Matriz de verificação:**

| Pedido do Vitor | Comando ou artefato |
|---|---|
| TypeScript, lint e build | `npm --prefix tests/site run typecheck`, `node dev/site/lint.mjs`, `node dev/site/build.mjs --check` |
| Formulários e integrações | `test:unit` e `test:e2e -- contato interesse`, envio real após H2 |
| Jornadas críticas | `test:e2e` (Home para Soluções para Contato; menu no celular; seletores; lista de interesse; âncoras antigas; 404) |
| Comparação visual | `qa:visual` gera folhas lado a lado em `.tmp-qa/` para 390, 768 e 1440 |
| Desktop, tablet e celular | Projetos Playwright em 1440, 768, 390 e 360 |
| SEO, sitemap e redirects | `test:unit -- netlify seo`, Lighthouse SEO |
| Performance e acessibilidade | orçamento de peso, Lighthouse, `test:e2e -- a11y` com axe |
| Console | listener de `console` e `pageerror` em todas as páginas |
| Links e CTAs | `test:e2e -- links` (internos e âncoras); externos por HEAD num job manual |

- **Entrega:** checklist de homologação preenchido com evidência e lista de pendências de publicação.
- **Estimativa:** 4 a 6 h.

---

## Matriz de alterações

| Arquivo | Ação | Tarefa | Risco | Observação |
|---|---|---|---|---|
| `index.html` | Reescrever (Home nova) | P1 | Alto | Fica na branch até H5 |
| `solucoes/`, `plataforma/`, `projetos-sob-medida/`, `contato/`, `demonstracoes-tecnicas/` (`index.html`) | Criar | P2 a P6 | Médio | Precisam estar no `cp` e no `ignore` |
| `404.html` | Criar | D | Baixo | `noindex` |
| `assets/site/tokens.css`, `base.css`, `components.css`, `paginas/*.css` | Criar | B, P* | Baixo | Substituem as 6 folhas atuais nas páginas novas |
| `assets/site/site.js`, `contato.js`, `interesse.js`, `config.js`, `lib/*.js` | Criar | B, C | Médio | ES modules, CSP `'self'` |
| `assets/fonts.css` | Modificar | A | Baixo | Hanken variável única, sem Space Grotesk |
| `assets/funil.js` | Modificar | C2 | Médio | Muda a série de `visita` para uma por sessão |
| `assets/meta-pixel.js` | Manter | | | Eventos disparados pelos módulos novos |
| `assets/brand/*`, favicons, `apple-touch-icon.png` | Manter | | | Marca canônica intacta |
| `assets/og-image.png` | Regenerar | D | Baixo | Título novo |
| `assets/styles.css`, `cinematic.css`, `cinema.css`, `operacao.css`, `motion-system.css`, `main.js`, `operacao.js`, `cinema.js`, `starfield.mjs`, `scroll-signal.mjs`, `motion.js`, `theme-store.js` | Sair da página | P1 | Baixo | Continuam no repo. Apagar só com ok do Vitor depois de H5 |
| `assets/checklist.html`, `assets/waveops-checklist.pdf` | Manter publicados | | | Links antigos seguem vivos |
| `netlify.toml` | Modificar | D | Alto | Coberto por teste e simulação do `cp` |
| `sitemap.xml`, `llms.txt` | Reescrever | D | Baixo | |
| `robots.txt` | Manter | | | |
| `CLAUDE.md` | Atualizar | D | Baixo | Arquitetura nova e as 4 correções do diagnóstico |
| `.github/workflows/ci.yml` | Modificar | A | Baixo | Job `site` novo, portal intacto |
| `.gitignore` | Modificar | A | Baixo | Saídas de QA (`.tmp-site/`, `.tmp-qa/`) |
| `dev/site/*` | Criar | A, B | Baixo | Não publicado |
| `tests/site/*` | Criar | A a E | Baixo | Dependências só de teste |
| `docs/specs/2026-10-09-site-institucional-v2.md`, este plano, `docs/research/2026-10-09-site-institucional/*` | Criar | A | Nenhum | Commitados no início da branch |
| `docs/integrations/n8n-site-v2.md` e 2 JSON | Criar | F1 | Baixo | Sem credencial |
| `portal/src/lib/funil.ts`, teste, 3 telas com links | Modificar em PR próprio | F2 | Baixo | Gate H3 |
| Workflows n8n ao vivo | Não tocar sem H2 | F1 | Alto | Path antigo ativo por 2 semanas |
| DNS, credenciais, painéis Netlify e Railway | Não tocar | | | Fora do escopo |

## Estratégia de branch e PR

1. Worktree `feat/site-institucional-v2` a partir de `origin/main`. Primeiro commit: spec, plano e pesquisa.
2. Um commit por tarefa fechada, com a validação verde. PR do site aberto como rascunho depois da onda 3, para acompanhamento.
3. PR do portal em branch própria (F2), merge em H3.
4. Nada vai para a `main` antes de H4 e H5. O Netlify publica a `main` sozinho.

## Rollback

Netlify: publicar o deploy anterior no painel e `git revert` do merge. n8n: path antigo ativo por 2 semanas. Portal: `git revert` do PR.

## Checklist de homologação (preenchido em 10/10/2026)

`[x]` verificado, com a evidência ao lado. `[ ]` falta, com o gate e de quem depende.

**Páginas e navegação**

- [x] 6 páginas e 404 no build simulado do Netlify: Playwright sobre `.tmp-site`, 160 passaram, 77 pulados por projeto, 0 falhas
- [x] 6 páginas e 404 no Deploy Preview (PR #76, 10/10/2026): `qa/preview.mjs` nas 18 combinações de página e largura, 0 falhas; status 200, sem rolagem horizontal, sem erro de console do site
- [x] Deploy Preview não escreve em produção: os dois formulários mostram o envio desligado, nenhum pedido sai da origem do preview (o verificador bloqueia e registra) e toda resposta leva `X-Robots-Tag: noindex, nofollow`
- [x] Topo, rodapé e chamada final idênticos nas páginas, item ativo correto: parciais carimbadas, `build --check` e `topo.spec`
- [x] Âncoras antigas: `legado.spec`, as 8 levam à página nova
- [x] 301 do portal: `netlify.test` e, no Deploy Preview, os 6 respondem 301 para o portal; `/solucoes` responde 301 para `/solucoes/`
- [x] `/index.html` sem redirect, por decisão registrada abaixo (o canonical resolve a duplicidade)
- [x] Links externos respondem: portal (login, termos, privacidade) 200, WhatsApp 302 para o número certo nas 8 mensagens, LinkedIn 200
- [ ] LinkedIn: confirmar que `linkedin.com/company/waveops` é a página da WaveOps, e não de outra empresa com o mesmo nome (Vitor)

**Formulários, integrações e medição**

- [x] Formulário: 5 estados, canal condicional, tempo limite, reenvio com o mesmo `idEnvio`, recusa 422 marcada no campo: `contato.spec`, `interesse.spec` e `envio.test`
- [ ] Envio real grava todas as colunas na planilha e dispara o aviso interno: H2. Os workflows ainda não existem no n8n; roteiro T1 a T20 no documento local `docs/specs/2026-10-10-n8n-site-v2-operacao-restrita.md`
- [ ] Lista de interesse grava, deduplica e confirma de verdade: H2. No simulado, `n8n-site-v2.test` cobre gravação, repetição e consentimento
- [ ] Funil em `/admin/funil` (`visita`, `lead_enviado`, `interesse_plataforma`, `whatsapp_click`): H3. `interesse_plataforma` só passa a contar com o PR do portal `feat/portal-funil-interesse`, que precisa estar no ar antes do site. O lado do site está em `funil.test`
- [x] Meta Pixel fora da página até existir consentimento (pedido do Vitor): nenhum script do Meta carrega e a CSP não libera o domínio

**Acessibilidade, layout e desempenho**

- [x] axe sem violação séria ou crítica, inclusive nos estados de erro e confirmação: `a11y.spec` e `a11y-estados.spec`
- [x] Teclado: menu com Esc e retorno de foco, seletor com `aria-pressed`, pular para o conteúdo: `topo.spec`
- [ ] Leitor de tela no formulário (NVDA ou VoiceOver): não verificado, exige teste manual
- [x] 360 a 1440 sem rolagem horizontal: `responsivo.spec`, 7 páginas
- [ ] Aparelhos reais (iPhone e Android): não verificado, exige aparelho
- [x] Lighthouse celular no build simulado: desempenho 97 a 99; acessibilidade, boas práticas e SEO 100; CLS 0; TBT 0 ms
- [x] Lighthouse celular no Deploy Preview: desempenho e acessibilidade 100 nas 6 páginas; boas práticas 93 só pela barra do Netlify bloqueada pela CSP, e SEO 69 só pelo `noindex` do preview, os dois inexistentes em produção
- [x] Comparação visual no Deploy Preview contra as capturas do design: altura de -0,4% a +2,4%, 9 das 18 combinações em 0,0%
- [x] Orçamento de peso: `peso.test` (JS 15 KB, 20 KB com formulário; CSS 25 KB; gzip)
- [x] Zero erro de console: `fumaca.spec`, 7 páginas nos 3 tamanhos

**Conteúdo e publicação**

- [x] Copy sem travessão: `lint.mjs`, no HTML e nos textos publicados
- [x] Acentuação: nenhuma das 95 formas sem acento mais comuns no texto visível nem nas mensagens dos módulos (heurística de lista fechada, não substitui leitura humana)
- [x] Nenhum módulo da Plataforma como disponível e toda maquete com aviso de ilustração: `conteudo.test`
- [ ] Pendências de publicação da spec, seção 12: H4 (política, termos, textos de aceite, e-mail do domínio, claims do design)

---

## Registro de execução (10/10/2026)

Ondas A, B, C, D, F1, F2, I, R e E executadas no worktree `feat/site-institucional-v2`. Desvios em relação ao plano, todos registrados aqui e no `CLAUDE.md`:

| Plano | Execução | Motivo |
|---|---|---|
| `dev/site/galeria.html` | Não criada | A Home exercita quase todo o design system e o `qa/visual.mjs` compara cada página com o PNG do design |
| Formulários escritos nas páginas P3 e P6 | Parciais `form-contato` e `form-interesse` | O envio (C3) e a marcação ficam com um dono só, sem conflito com os agentes de página |
| Lead em produção para `flowops-lead` até o H2 | `waveops-lead-v2` desde já | O workflow antigo só lê as 15 chaves antigas e perderia o e-mail do canal E-mail; falha visível é melhor que perda silenciosa (revisão adversarial) |
| Redirect `/index.html` para `/` | Não incluído | Com o arquivo existindo, só funciona com `force`, e o canonical já resolve a duplicidade; risco sem ganho |
| JSON-LD `ProfessionalService` | `Organization` com `contactPoint` | `ProfessionalService` herda de `LocalBusiness`, que pede endereço público, e não aceita `serviceType` |
| JS até 15 KB por página | 20 KB nas páginas com formulário | Dez módulos pequenos de validação, contrato, atribuição e envio; Contato em 15,9 KB |
| Meta Pixel mantido | Desligado | Pedido do Vitor até existir consentimento |
| `cienciaTextoVersao` | Acrescentado ao contrato | Registrar a versão do texto de ciência, separada da de marketing |
| Página funciona sem os módulos | Só com JavaScript desligado | O `<noscript>` não entra quando o JavaScript está ligado e um módulo falha (rede ou bloqueador). Nesse caso o menu do celular não abre, o seletor da Home fica no primeiro painel e o botão do formulário segue desabilitado. Os links do rodapé e o WhatsApp no topo do Contato continuam funcionando. Limitação aceita na revisão adversarial |
