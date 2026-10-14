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
| Plataforma (fora do menu desde 14/10/2026, acesso pelo rodapé) | `/plataforma/` | `plataforma/index.html` |
| Projetos sob medida | `/projetos-sob-medida/` | `projetos-sob-medida/index.html` |
| Contato | `/contato/` | `contato/index.html` |
| Demonstrações técnicas (fora do menu) | `/demonstracoes-tecnicas/` | `demonstracoes-tecnicas/index.html` |
| Não encontrado | qualquer outra | `404.html` (`noindex`) |

Mensagem desde 14/10/2026 (decisão do Vitor): software house especializada na operação de quem vende, com quatro frentes (automação de processos, integração de sistemas, sistemas e painéis sob medida, agentes de IA supervisionados) e serviços gerenciados para cuidar do que está no ar. Não volte a anunciar desenvolvimento web, e-commerce, engenharia de dados ou consultoria de TI como frentes, nem a Plataforma no menu ou na Home, sem nova decisão. Plano: `docs/plans/2026-10-14-foco-mensagem-site.plan.md`; `tests/site/unit/conteudo.test.mjs` guarda as quatro frentes, barra as frentes retiradas e confere que a Plataforma só aparece no rodapé e na própria página.

## Rodar e verificar

```bash
node dev/site/serve.mjs                    # http://127.0.0.1:4321/, com endpoints simulados
node dev/site/build.mjs                    # carimba parciais e atualiza ?v= (rode depois de editar)
node dev/site/build.mjs --check            # o que o CI roda
node dev/site/lint.mjs
npm ci --prefix tests/site && npm --prefix tests/site run typecheck && npm --prefix tests/site run test:unit
cd tests/site && PW_CHANNEL=chrome npx playwright test
DESIGN_CAPTURAS=<pasta> PW_CHANNEL=chrome node qa/visual.mjs   # comparação com as capturas do design
SITE_URL=<deploy preview> PW_CHANNEL=chrome node qa/preview.mjs  # conferência do Deploy Preview (recusa produção)
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
Manda evento para `POST /api/e` no portal, como `text/plain` (com JSON o navegador faria preflight, que morre no descarregamento da página). O nome do evento precisa existir na lista fechada de `portal/src/lib/funil.ts`, senão o servidor descarta em silêncio. Desde o site de várias páginas, o primeiro toque fica em `sessionStorage["waveops:origem:v1"]` e vale para todos os eventos da sessão, e `visita` sai uma vez por sessão (de novo só se chegar outra campanha). O próprio site e `*.waveops.com.br` (o portal) são internos: aba nova aberta de outra página herda a UTM da URL de origem sem contar outra visita, e voltar do portal não reescreve o primeiro toque. Os formulários leem o mesmo registro para mandar UTM com o lead. Com `sessionStorage` bloqueado, volta à fonte por carregamento. Só mede em `waveops.com.br`, no próprio portal e no dev local: no Deploy Preview, na cópia do GitHub Pages ou em qualquer outro host, nada sai (`tests/site/unit/funil.test.mjs`). `interesse_plataforma` depende do PR do portal `feat/portal-funil-interesse`, que entra no ar antes do site. O servidor também descarta `visita` com referrer do próprio domínio (`normalizarEvento` em `portal/src/lib/funil.ts`): o funil do site antigo contaria como entrada nova o clique vindo do portal.

### Meta Pixel
Desligado nas páginas novas até existir mecanismo de consentimento e revisão de privacidade (decisão do Vitor em 09/10/2026). `assets/meta-pixel.js` fica no repo sem ser carregado, e a CSP das páginas novas não libera mais as origens do Facebook.

## Formulários e integrações

| Fluxo | Destino | Estado |
|---|---|---|
| Contato | Portal da WaveOps (`portal.waveops.com.br`): `POST /api/site/contato`, tabela `leads`, tela "Leads" no admin | Em produção. Criação, consulta e exclusão individual com dados fictícios conferidas em 11/10/2026. Falha de envio preserva os dados na tela e oferece o WhatsApp |
| Lista de interesse | Portal da WaveOps (`portal.waveops.com.br`): `POST /api/site/interesse`, tabela `leads`, tela "Leads" no admin | Em produção. Criação, consulta e exclusão individual com dados fictícios conferidas em 11/10/2026. Falha de envio preserva o e-mail na tela |

Endpoints por ambiente em `assets/site/config.js`: produção só em `waveops.com.br`, onde os dois formulários enviam para o portal (`https://portal.waveops.com.br/api/site/contato` e `/api/site/interesse`), o mesmo host do funil. O `connect-src` da CSP libera só `'self'` e o portal, sem o n8n: `tests/site/unit/envio.test.mjs` falha se o host dos formulários e a CSP divergirem. `localhost` usa `/__dev/lead` e `/__dev/interesse` do servidor local. Deploy Preview do Netlify fica desligado. O site só pode ir ao ar depois do deploy das rotas no portal.

Desde 10/10/2026 (decisão do Vitor) o lead não passa mais pelo n8n. Os JSON dos dois workflows e o guia `docs/integrations/n8n-site-v2.md` (contrato, colunas da planilha, roteiros de publicação e de exclusão de dado, todos do n8n) ficam como referência histórica do contrato e da decisão anterior. O roteiro de homologação e os parâmetros de operação do n8n seguem fora do git, em `docs/specs/2026-10-10-n8n-site-v2-operacao-restrita.md`, porque o repo é público; os JSON do repo trazem `__DEFINIR__` no lugar dos valores do limite de volume. Nada no n8n de produção muda sem aprovação do Vitor.

A operação vigente, o mapa de dados, os limites de marketing e a exclusão de titular estão em [docs/integrations/portal-site-v2.md](docs/integrations/portal-site-v2.md). Vitor aprovou em 11/10/2026 limites de 180 dias para contato e 365 dias para interesse desde `createdAt`, para preparar a retenção, e confirmou exceção manual com revisão em até 30 dias. A prévia sob demanda no admin usa `GET /api/leads/retencao`: somente contagens, ambos os tipos e estados, sem teto de 500 e com relógio do servidor. O detalhe consulta e altera a exceção por `GET/POST /api/leads/[id]/retencao`. Justificativa, responsável e revisão ficam em `leads_retencao`, com versão, auditoria transacional e exclusão em cascata junto com o lead. Os dados e aceites originais permanecem. Banco ausente ou falha vira erro, não contagem vazia. H4 e expurgo continuam pendentes; a rotina de 180 dias em `jobs.ts` cobre apenas eventos de navegação. As specs ficam em `docs/specs/`, locais e fora do git; planos em `docs/plans/`. A nova migration exige `npm run db:deploy` antes de publicar o código do portal; a configuração atual do pre-deploy Railway ainda precisa ser conferida.

Privacidade: ciência da Política de Privacidade (obrigatória) separada do consentimento de marketing (opcional). O contrato grava a versão da política (`POLITICA_VERSAO`), a versão do texto de ciência (`TEXTO_CIENCIA`) e a do texto de marketing (`TEXTO_MARKETING`), todas em `assets/site/config.js`: mudou o texto, mude a versão. Os textos de aceite são rascunho até a revisão jurídica. Termos e Política vivem no portal (`/termos`, `/privacidade`).

## Segurança
- CSP `<meta>` em toda página, vinda do parcial `head`. Origem nova de script, fonte, imagem ou `fetch` entra na diretiva certa, senão o navegador bloqueia. Hoje `connect-src` libera só `'self'` e o portal (funil e formulários). `style-src` mantém `'unsafe-inline'` por causa do `<noscript><style>` e de atributos `style`.
- `[[headers]]` no `netlify.toml` (desde o commit `3f66779`): `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`. Clickjacking está fechado.
- Anti-robô nos formulários: honeypot e trava de tempo no navegador e no servidor (robô recebe 200 sem gravar). A operação atual está em [docs/integrations/portal-site-v2.md](docs/integrations/portal-site-v2.md); a regra do servidor vive em `portal/src/lib/leads.ts`.

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

Deploy Preview e branch deploy usam o comando de produção, letra por letra, mais um `_headers` com `X-Robots-Tag: noindex, nofollow` (`[context.deploy-preview]` e `[context.branch-deploy]`; o teste confere que os comandos só diferem nisso). Fora de `waveops.com.br`, os formulários ficam desligados (`config.js`) e o funil não manda evento (`funil.js`): preview nunca escreve em serviço de produção.

## SEO e arquivos de crawler
- Por página: title até 60 caracteres, description até 155, canonical, Open Graph com `og:image:alt`, Twitter Card e JSON-LD (`Organization` com `contactPoint` e `WebSite` na Home, sem `ProfessionalService`, que pede endereço público; `BreadcrumbList` nas internas, `FAQPage` em Projetos sob medida). O lint confere title, description, canonical e JSON-LD.
- `sitemap.xml`: as 6 URLs indexáveis. `robots.txt`: `Allow: /` e a linha do sitemap. `llms.txt`: resumo para LLM com links das páginas, só com o que as páginas afirmam (o teste barra "3 a 7 dias úteis", "preço fechado" e "sem fidelidade", que o refino retirou).
- Âncoras da página única antiga (`/#contato`, `/#pacotes`, `/#servicos`, `/#casos`, `/#como`, `/#faq`, `/#publicos`, `/#operacao`) são redirecionadas no navegador pela Home: servidor não vê o `#`. Renomear um `id` de destino quebra esse mapa (`assets/site/lib/legado.js`) e o `llms.txt`.

## Legado (no repo, fora das páginas novas)
Ficam no repo, sem carregar em nenhuma página nova, até o Vitor decidir apagar depois da homologação (alguns podem ter link externo): `assets/styles.css`, `cinematic.css`, `cinema.css`, `operacao.css`, `motion-system.css`, `fonts.css`, `workflow.css`, `main.js`, `operacao.js`, `cinema.js`, `starfield.mjs`, `scroll-signal.mjs`, `motion.js`, `theme-store.js`, `scene.js`, `meta-pixel.js`, `assets/vendor/`, `assets/sequence/`, `image-sequence.mjs`, `sequence-mount.mjs`, `starfield-mount.mjs`, `motion-lite.mjs`, `og-image.png` e `og-image.html`, e o painel de Tweaks em `dev/`. `assets/checklist.html` e `assets/waveops-checklist.pdf` seguem publicados para não quebrar links antigos. A documentação detalhada da página única (starfield, cinema, "uma operação viva", Tweaks) está no histórico do git deste arquivo, antes de 10/2026. A chave `flowops:tweaks:v1` do localStorage passa a ser ignorada.

## Pendências conhecidas
- Links do portal para o site usam URLs diretas: `/contato/` para diagnóstico e `/projetos-sob-medida/#modelos` para contratação, sempre com o domínio absoluto. `portal/tests/unit/links-site.test.ts` confere os destinos contra `dev/site/paginas.json` e os IDs das seções no HTML. As âncoras antigas continuam disponíveis para anúncios e favoritos, via `assets/site/lib/legado.js`.
- Os dois formulários passaram pela criação, consulta e exclusão individual em produção com dados fictícios em 11/10/2026, incluindo versões de ciência, marketing desmarcado e UTMs. Os dois registros de teste foram apagados; escopo e limites da evidência em [docs/integrations/portal-site-v2.md](docs/integrations/portal-site-v2.md).
- LGPD dos leads no portal: prazos operacionais de 180/365 dias aprovados para preparação, com prévia de contagens no admin. Validar bases, exceções, operadores, transferências, logs e backups e implementar revogação e supressão antes de marketing (gate H4). A revisão factual de 11/10/2026 descreve `visitorId` como dado pessoal relacionável a leads e clientes, com `POLITICA_VERSAO = rascunho-2026-10-11`; a de 14/10/2026 inclui a Hostinger como operadora das cópias de segurança criptografadas, apagadas depois de 7 dias, com `POLITICA_VERSAO = rascunho-2026-10-14`. Nenhuma das duas encerra H4. Não declarar expiração automática de leads sem implementação e verificação.
- `contato@waveops.com.br` sem MX nem SPF (conferido em 09/10/2026): não recebe e-mail. Desde 10/10/2026 ele saiu do rodapé, da página de contato e do JSON-LD da Home, e a Política e os Termos do portal usam o WhatsApp (`EMPRESA.whatsapp` em `portal/src/lib/empresa.ts`). Quando a caixa existir, volte o e-mail nesses lugares e mude `POLITICA_VERSAO`.
- Política de Privacidade e Termos em rascunho; textos de aceite e compromissos ("sem custo e sem compromisso", "Resposta em até 1 dia útil") dependem de revisão (gate H4).
- O webhook n8n `flowops-lead` e a chave `flowops:tweaks:v1` mantêm o nome antigo de propósito: renomear quebra a integração e o tema salvo.

## Regras de escrita deste repo
Toda copy de usuário em PT-BR com acento. Em qualquer texto produzido (copy, comentário, este arquivo), nunca travessão nem meia-risca: use ponto, vírgula ou dois-pontos. O lint do site barra os dois caracteres no HTML.
