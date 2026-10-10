@.claude/waveops-base.md

# CLAUDE.md

Guia do Claude Code para este repositório.

> **Desvio de stack (registrado):** o site institucional é estático (HTML, CSS e JavaScript puro, sem framework), não a stack default Next.js/Drizzle da WaveOps. Decisão do Vitor em 09/10/2026 (D1 do plano `docs/plans/2026-10-09-site-institucional-v2.plan.md`): componentes compartilhados montados no build, sem injeção por JavaScript, e Astro só quando houver blog com cadência (SPEC-13). A rule `.claude/rules/nextjs-drizzle.md` e os comandos `npm run lint/build/test` valem para o `portal/`, não para o site. Valem integralmente: o hook `secret-scan`, a rule de segurança/LGPD e a rule de copy PT-BR.

## O que é

Dois produtos no mesmo repo:

| Produto | Onde | Publicação |
|---|---|---|
| Site institucional WaveOps (PT-BR, só tema escuro, 6 páginas) | Raiz do repo | Netlify, `https://waveops.com.br` |
| WaveOps Portal (checkout, área do cliente, admin, funil) | `portal/` (Next 16) | Railway, `https://portal.waveops.com.br` |

O repo e o caminho antigo do GitHub Pages se chamam `flowops-landing` por motivo histórico: a marca no ar é WaveOps.

Páginas do site (`dev/site/paginas.json` é a fonte):

| Página | URL | Arquivo |
|---|---|---|
| Início | `/` | `index.html` |
| Soluções | `/solucoes/` | `solucoes/index.html` |
| Plataforma | `/plataforma/` | `plataforma/index.html` |
| Projetos sob medida | `/projetos-sob-medida/` | `projetos-sob-medida/index.html` |
| Contato | `/contato/` | `contato/index.html` |
| Demonstrações técnicas (fora do menu) | `/demonstracoes-tecnicas/` | `demonstracoes-tecnicas/index.html` |
| Não encontrado | qualquer outra | `404.html` (`noindex`) |

## Rodar e verificar

```bash
node dev/site/serve.mjs                    # http://127.0.0.1:4321/, com endpoints simulados
node dev/site/build.mjs                    # carimba parciais e atualiza ?v= (rode depois de editar)
node dev/site/build.mjs --check            # o que o CI roda
node dev/site/lint.mjs
npm ci --prefix tests/site && npm --prefix tests/site run typecheck && npm --prefix tests/site run test:unit
cd tests/site && PW_CHANNEL=chrome npx playwright test
PW_CHANNEL=chrome node qa/visual.mjs       # comparação com as capturas do design
```

`PW_CHANNEL=chrome` usa o Chrome instalado. No Git Bash, argumento que começa com `/` precisa de `MSYS_NO_PATHCONV=1`. As dependências de `tests/site/` (Playwright, axe, TypeScript, `@types/node`) são só de teste e nunca vão para o ar.

O servidor local roda na raiz do repo, onde também estão `.git` e `portal/`: por isso só responde com Host local (fecha DNS rebinding), nega qualquer caminho com segmento que começa com ponto e, com `netlify.toml` na raiz, só serve o que o Netlify publica, mais `dev/site/`. `node dev/site/build.mjs --dist` só aceita uma pasta `.tmp-*` na raiz do repo, porque apaga o destino antes de copiar.

Orçamento de peso por página (`tests/site/unit/peso.test.mjs`): JavaScript próprio até 15 KB gzip (20 KB nas páginas com formulário) e CSS até 25 KB gzip.

## Arquitetura do site

### Parciais carimbados no build
Topo, rodapé, chamada final, `<head>` comum e os dois formulários vivem em `dev/site/parciais/` e entram no HTML entre marcadores `<!-- parcial:nome ativo="..." -->` e `<!-- /parcial:nome -->`. `dev/site/build.mjs` carimba e grava; as páginas carimbadas são commitadas. Nada é injetado por JavaScript no navegador (decisão de SEO, leitor de tela e navegação sem JS). Guia completo: `dev/site/README.md`.

O build também põe `?v=<hash>` em todo CSS e JS de `/assets/`. O hash de um módulo cobre os módulos que ele importa. Os imports entre módulos não levam query: o Netlify serve tudo com `Cache-Control: public,max-age=0,must-revalidate` e ETag (conferido em 09/10/2026), então não sobra versão velha, e o TypeScript resolve os imports. O build normaliza CRLF para LF antes de carimbar e de calcular hash, porque `core.autocrlf=true` no Windows mudaria o resultado entre máquinas.

### Design system
- `assets/site/tokens.css`: cores, tipografia, raios, sombras e contêiner copiados do design aprovado. Valor novo entra aqui antes de ser usado.
- `assets/site/base.css`: fontes, reset, foco, contêiner, seção e títulos.
- `assets/site/components.css`: peças compartilhadas. Componente de uma página só vai em `assets/site/paginas/<id>.css`. O teste `tests/site/unit/css.test.mjs` barra seletor base repetido e página redefinindo componente (já houve colisão de `.wo-entrada` entre cartão e campo).
- Selo de situação muda de forma junto com a cor (círculo cheio, quadrado, círculo vazado), para não depender só de cor.
- Fontes auto-hospedadas: `assets/fonts/hanken-variavel-*.woff2` é Hanken Grotesk VARIÁVEL (um arquivo cobre 400 a 700; os `hankengrotesk-500/600/700-*` antigos são cópias idênticas do 400) e Space Mono 400. Não volte ao Google Fonts.
- Só tema escuro. Sem animação contínua: só transição curta de estado, desligada por `prefers-reduced-motion`.

### Ordem do `<head>` (parcial `head`)
CSP `<meta>` logo depois de charset e viewport, antes de qualquer recurso; ícones; preload da Hanken; `tokens.css`, `base.css`, `components.css`; `funil.js` com `defer`; `site.js` como módulo; `<noscript>` que mostra o menu e todos os painéis e esconde o que depende de JS. Depois do parcial, cada página põe o próprio CSS, scripts de página (`contato.js`, `interesse.js`, `paginas/demonstracoes.js`), title, description, canonical, Open Graph e JSON-LD.

### JavaScript
- `assets/site/site.js`: menu do topo (Esc fecha e devolve o foco), seletores `[data-seletor]` com `aria-pressed`, clique de WhatsApp (`data-whatsapp`) como evento de funil e, só na Home, o redirecionamento das âncoras da página única antiga (`assets/site/lib/legado.js`).
- `assets/site/contato.js` e `assets/site/interesse.js`: estados do design, foco no primeiro erro e no título da confirmação, tempo limite de 12 s, reenvio com o mesmo `idEnvio` enquanto os dados não mudam, honeypot e trava de 1,2 s (robô vê confirmação sem envio), recusa 422 marcada no campo. O botão de envio nasce `disabled` e só o módulo libera; com `method="post"` e a CSP em `form-action 'none'`, nenhum envio nativo acontece se o JavaScript falhar (nada de dado pessoal na URL). A mensagem de erro entra no `aria-describedby` só enquanto está visível.
- `assets/site/lib/`: funções puras testadas em Node (`validacao.js`, `payload.js`, `atribuicao.js`, `enviar.js`, `formulario.js`).
- Tudo é melhoria progressiva: sem JS, o conteúdo aparece inteiro e os formulários dão lugar a um aviso com saída pelo WhatsApp (nenhum dado vai para a URL).

### Medição de funil (`assets/funil.js`)
Manda evento para `POST /api/e` no portal, como `text/plain` (com JSON o navegador faria preflight, que morre no descarregamento da página). O nome do evento precisa existir na lista fechada de `portal/src/lib/funil.ts`, senão o servidor descarta em silêncio. Desde o site de várias páginas, o primeiro toque fica em `sessionStorage["waveops:origem:v1"]` e vale para todos os eventos da sessão, e `visita` sai uma vez por sessão (de novo só se chegar outra campanha). O próprio site e `*.waveops.com.br` (o portal) são internos: aba nova aberta de outra página herda a UTM da URL de origem sem contar outra visita, e voltar do portal não reescreve o primeiro toque. Os formulários leem o mesmo registro para mandar UTM com o lead. Com `sessionStorage` bloqueado, volta à fonte por carregamento. `interesse_plataforma` depende do PR do portal `feat/funil-interesse-e-links-do-site`.

### Meta Pixel
Desligado nas páginas novas até existir mecanismo de consentimento e revisão de privacidade (decisão do Vitor em 09/10/2026). `assets/meta-pixel.js` fica no repo sem ser carregado, e a CSP das páginas novas não libera mais as origens do Facebook.

## Formulários e integrações

| Fluxo | Destino | Estado |
|---|---|---|
| Contato | n8n Cloud, `waveops-lead-v2` | O webhook ainda não existe. O site NÃO aponta para o `flowops-lead` que roda hoje (não versionado; o JSON de `n8n/` é esqueleto) porque ele só lê as 15 chaves antigas: um lead pelo canal E-mail chegaria sem o e-mail. Até o v2 existir, o envio falha de forma visível, com os dados preservados e saída pelo WhatsApp |
| Lista de interesse | n8n Cloud, `waveops-interesse` | O webhook ainda não existe. Até ser criado, o envio cai no estado de falha sem perder o e-mail |

Endpoints por ambiente em `assets/site/config.js`: produção só em `waveops.com.br`; `localhost` usa `/__dev/lead` e `/__dev/interesse` do servidor local; Deploy Preview do Netlify fica desligado. Rascunho dos workflows, colunas da planilha, roteiro de publicação, teste e exclusão de dado: `docs/integrations/n8n-site-v2.md`. Nada no n8n de produção muda sem aprovação do Vitor.

Privacidade: ciência da Política de Privacidade (obrigatória) separada do consentimento de marketing (opcional). O contrato grava a versão da política (`POLITICA_VERSAO`), a versão do texto de ciência (`TEXTO_CIENCIA`) e a do texto de marketing (`TEXTO_MARKETING`), todas em `assets/site/config.js`: mudou o texto, mude a versão. Os textos de aceite são rascunho até a revisão jurídica. Termos e Política vivem no portal (`/termos`, `/privacidade`).

## Segurança
- CSP `<meta>` em toda página, vinda do parcial `head`. Origem nova de script, fonte, imagem ou `fetch` entra na diretiva certa, senão o navegador bloqueia. Hoje `connect-src` libera o portal (funil) e o n8n (formulários). `style-src` mantém `'unsafe-inline'` por causa do `<noscript><style>` e de atributos `style`.
- `[[headers]]` no `netlify.toml` (desde o commit `3f66779`): `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`. Clickjacking está fechado.
- Anti-robô nos formulários: honeypot e trava de tempo no navegador. Validação, deduplicação e bloqueio no servidor dependem do workflow n8n (`docs/specs/SECURITY-n8n-hardening.md`, local).

## Marca (Sine Nodes)
Onda senoidal simétrica cruzando um núcleo vazado, com dois nós sólidos nas pontas. Kit completo em `assets/brand/` (`waveops-icon.svg`, `waveops-symbol.svg`, `waveops-symbol-mono.svg`, `waveops-lockup.svg`, `png/`, `README.md`). Geometria canônica, `viewBox="0 0 100 100"`, `stroke-width="5"`:
```
<g stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 50 Q 30 33 41 50"/><path d="M59 50 Q 70 67 82 50"/>
</g>
<circle cx="50" cy="50" r="9" fill="none" stroke="#fff" stroke-width="5"/>
<circle cx="18" cy="50" r="7.5" fill="#fff"/><circle cx="82" cy="50" r="7.5" fill="#fff"/>
```
O topo e o rodapé usam o selo 3D em 128 px (`assets/brand/waveops-badge-3d-128.webp`, 6 KB, gerado do `waveops-badge-3d.webp` de 512 px) com o símbolo SVG por cima. Mudou a geometria, atualize no mesmo passo o kit, `assets/favicon.svg`, `assets/apple-touch-icon.png`, `assets/favicon-32.png` e a imagem de compartilhamento (`assets/og-waveops.png`, gerada de `dev/site/og.html` com `tests/site/qa/og.mjs`). Não volte às marcas aposentadas (anel único `Q 31 30 34 18.6` de `viewBox 0 0 48 48`, ou o grafo verde da FlowOps).

## Publicação (`netlify.toml`)
O base directory do Netlify está travado em `portal/` no painel, então o build roda um nível abaixo e copia de `../`. O `[build] command` copia uma lista explícita: `index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, `assets/` e as cinco pastas de página. **Arquivo ou pasta fora dessa lista não vai ao ar.** O mesmo base directory decide se há build: o `ignore` é um `git diff --quiet` sobre os caminhos publicados (contrato invertido: exit 0 pula o build). Página nova entra no `cp` e no `ignore` no mesmo commit; `tests/site/unit/netlify.test.mjs` confere as duas listas contra `dev/site/paginas.json`. Pastas proibidas, por causa dos 301 com `force` para o portal: `api`, `admin`, `cliente`, `checkout`, `termos`, `privacidade`. Não existe `CNAME`: o domínio é configurado no painel do Netlify mais DNS.

## SEO e arquivos de crawler
- Por página: title até 60 caracteres, description até 155, canonical, Open Graph com `og:image:alt`, Twitter Card e JSON-LD (`ProfessionalService` e `WebSite` na Home, `BreadcrumbList` nas internas, `FAQPage` em Projetos sob medida). O lint confere title, description, canonical e JSON-LD.
- `sitemap.xml`: as 6 URLs indexáveis. `robots.txt`: `Allow: /` e a linha do sitemap. `llms.txt`: resumo para LLM com links das páginas, só com o que as páginas afirmam (o teste barra "3 a 7 dias úteis", "preço fechado" e "sem fidelidade", que o refino retirou).
- Âncoras da página única antiga (`/#contato`, `/#pacotes`, `/#servicos`, `/#casos`, `/#como`, `/#faq`, `/#publicos`, `/#operacao`) são redirecionadas no navegador pela Home: servidor não vê o `#`. Renomear um `id` de destino quebra esse mapa (`assets/site/lib/legado.js`) e o `llms.txt`.

## Legado (no repo, fora das páginas novas)
Ficam no repo, sem carregar em nenhuma página nova, até o Vitor decidir apagar depois da homologação (alguns podem ter link externo): `assets/styles.css`, `cinematic.css`, `cinema.css`, `operacao.css`, `motion-system.css`, `fonts.css`, `workflow.css`, `main.js`, `operacao.js`, `cinema.js`, `starfield.mjs`, `scroll-signal.mjs`, `motion.js`, `theme-store.js`, `scene.js`, `meta-pixel.js`, `assets/vendor/`, `assets/sequence/`, `image-sequence.mjs`, `sequence-mount.mjs`, `starfield-mount.mjs`, `motion-lite.mjs`, `og-image.png` e `og-image.html`, e o painel de Tweaks em `dev/`. `assets/checklist.html` e `assets/waveops-checklist.pdf` seguem publicados para não quebrar links antigos. A documentação detalhada da página única (starfield, cinema, "uma operação viva", Tweaks) está no histórico do git deste arquivo, antes de 10/2026. A chave `flowops:tweaks:v1` do localStorage passa a ser ignorada.

## Pendências conhecidas
- Workflow n8n de leads ao vivo não verificado; webhook da lista de interesse a criar (gate H2).
- `contato@waveops.com.br` sem MX nem SPF (conferido em 09/10/2026): não recebe e-mail, e o site o publica no rodapé e na página de contato.
- Política de Privacidade e Termos em rascunho; textos de aceite e compromissos ("sem custo e sem compromisso", "Resposta em até 1 dia útil") dependem de revisão (gate H4).
- O webhook n8n `flowops-lead` e a chave `flowops:tweaks:v1` mantêm o nome antigo de propósito: renomear quebra a integração e o tema salvo.

## Regras de escrita deste repo
Toda copy de usuário em PT-BR com acento. Em qualquer texto produzido (copy, comentário, este arquivo), nunca travessão nem meia-risca: use ponto, vírgula ou dois-pontos. O lint do site barra os dois caracteres no HTML.
