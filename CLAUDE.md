@.claude/waveops-base.md

# CLAUDE.md

Guia do Claude Code para este repositório.

> **Desvio de stack (registrado):** o site institucional é estático (HTML, CSS e JavaScript puro, sem framework), não a stack default Next.js/Drizzle da WaveOps. Decisão do Vitor em 09/10/2026 (D1 do plano `docs/plans/2026-10-09-site-institucional-v2.plan.md`): componentes compartilhados montados no build, sem injeção por JavaScript, e Astro só quando houver blog com cadência (SPEC-13). A rule `.claude/rules/nextjs-drizzle.md` e os comandos `npm run lint/build/test` valem para o `portal/`, não para o site. Valem integralmente: o hook `secret-scan`, a rule de segurança/LGPD e a rule de copy PT-BR.

## O que é

Dois produtos no mesmo repo:

| Produto | Onde | Publicação |
|---|---|---|
| Site institucional WaveOps (PT-BR, contexto escuro sobre a onda, 6 páginas) | Raiz do repo | Netlify, `https://waveops.com.br` |
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

Mensagem desde 15/10/2026 (decisão do Vitor): software house especializada na operação de quem vende, com cinco frentes: automação de atendimento, agentes de IA, painéis de gestão, CRMs sob medida e apps e sistemas. Desde 20/10/2026 os rótulos públicos são Painéis de gestão e Apps e sistemas. Apps são web, acessados pelo navegador; IDs e chaves internas dashboards e saas permanecem para preservar links antigos. Serviços gerenciados cuidam do que está no ar. Não volte a anunciar desenvolvimento web, e-commerce, engenharia de dados ou consultoria de TI como frentes, nem a Plataforma no menu ou na Home, sem nova decisão. Plano: `docs/plans/2026-10-15-site-novo-visual.plan.md`; `tests/site/unit/conteudo.test.mjs` guarda as cinco frentes, barra as frentes retiradas e confere que a Plataforma só aparece no rodapé e na própria página.

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

Orçamento de peso por página (`tests/site/unit/peso.test.mjs`): JavaScript próprio até 15 KB gzip (20 KB nas páginas com formulário) e CSS até 25 KB gzip, nível 9, mais exatamente o que a entrada do site mede (3137 B de JS e 389 B de CSS, Tarefa 13B). Fontes, imagens, pôster e vídeo ficam fora dessa conta e têm limites próprios. A comparação `qa/visual.mjs` espera as fontes e somente a entrada finita do hero, sem esperar a onda contínua; grava páginas inteiras e folhas lado a lado em `.tmp-qa/comparacao/`.

## Arquitetura do site

### Parciais carimbados no build
Topo, rodapé, chamada final, `<head>` comum, camada da entrada do site (`chegada`), fundo vivo, botão flutuante de WhatsApp e os dois formulários vivem em `dev/site/parciais/` e entram no HTML entre marcadores `<!-- parcial:nome ativo="..." -->` e `<!-- /parcial:nome -->`. `dev/site/build.mjs` carimba e grava; as páginas carimbadas são commitadas. Nada é injetado por JavaScript no navegador (decisão de SEO, leitor de tela e navegação sem JS). Guia completo: `dev/site/README.md`.

O build também põe `?v=<hash>` em todo CSS e JS de `/assets/`. O hash de um módulo cobre os módulos que ele importa. Os imports entre módulos não levam query: o Netlify serve tudo com `Cache-Control: public,max-age=0,must-revalidate` e ETag (conferido em 09/10/2026), então não sobra versão velha, e o TypeScript resolve os imports. O build normaliza CRLF para LF antes de carimbar e de calcular hash, porque `core.autocrlf=true` no Windows mudaria o resultado entre máquinas.

### Design system
- `assets/site/tokens.css`: cores, tipografia, raios, sombras e contêiner copiados do design aprovado. Valor novo entra aqui antes de ser usado.
- `assets/site/base.css`: fontes, reset, foco, contêiner, seção e títulos.
- `assets/site/components.css`: peças compartilhadas. Componente de uma página só vai em `assets/site/paginas/<id>.css`. O teste `tests/site/unit/css.test.mjs` barra seletor base repetido e página redefinindo componente. `css-morto.test.mjs` exige consumidores reais das classes, variáveis sem reserva definidas e ausência de aliases aposentados.
- Selo de situação muda de forma junto com a cor (círculo cheio, quadrado, círculo vazado), para não depender só de cor.
- Fontes variáveis auto-hospedadas: Geist nos títulos e Inter no texto, pesos 400 a 700, recorte latino em `assets/fonts/*-variavel-latin.woff2`. Para refazer: `node dev/site/fontes.mjs`. Licenças OFL ao lado das fontes. Os arquivos antigos ficam preservados, sem carregar nas páginas.
- Novo visual aprovado em 15/10/2026 e ampliado pela D20 em 16/10: contexto escuro na página inteira, onda fixa contínua, hero transparente, seções com `wo-veu` (72%) ou `wo-veu-forte` (84%). Creme só dentro de `wo-cartao-claro`. Texto comum exige 4,5:1 e grande 3:1, inclusive sobre o fundo.
- `wo-titulo-cartao` concentra Geist 18 px, peso 500, entreletra -0,02em e altura 1,55. O aviso de maquete usa Nota, Inter 14 px; o palco conserva o aviso compacto aprovado de 11 px.
- Movimento: transições curtas e cascata finita do hero (500 ms, passo 70 ms), com a exceção da onda contínua. Menos movimento mostra o estado final de todas as cenas e o pôster, sem entrada nem vídeo.

### Ordem do `<head>` (parcial `head`)
CSP `<meta>` logo depois de charset e viewport, antes de qualquer recurso; ícones; `chegada.js`, script clássico que decide a entrada do site antes da primeira pintura; preload da Geist; `tokens.css`, `base.css`, `components.css`; `funil.js` com `defer`; `site.js` e `fundo.js` como módulos; `<noscript>` que põe o topo no fluxo, mostra o menu e todos os painéis e esconde seletores e formulários dependentes de JS. O pôster e as cenas completas aparecem por CSS, sem injeção. Depois do parcial, cada página põe o próprio CSS, scripts de página (`contato.js`, `interesse.js`, `paginas/demonstracoes.js`), title, description, canonical, Open Graph e JSON-LD.

### JavaScript
- `assets/site/chegada.js` e `chegada-cena.js`: entrada do site na primeira página da visita (o hub do Sine Nodes fecha, a onda passa, fios saem do anel e o anel abre como portal, 1,45 s). Menos movimento, economia de dados e falta de JavaScript não veem nada; clique, toque, rolagem ou tecla pulam; trava de 2 s em CSS. Detalhes em `dev/site/README.md`, "Entrada do site". Teste ou captura que não seja da entrada abre a página como a seguinte da visita (`sessionStorage["waveops:chegada"] = "1"`).
- `assets/site/site.js`: topo fixo sempre escuro, sem troca de paleta ao rolar, botão flutuante que evita cobrir o painel ativo do palco e o menu do topo (Esc fecha e devolve o foco), seletores `[data-seletor]` com `aria-pressed`, clique de WhatsApp (`data-whatsapp`) como evento de funil e, só na Home, o redirecionamento das âncoras da página única antiga (`assets/site/lib/legado.js`).
- `assets/site/contato.js` e `assets/site/interesse.js`: estados do design, foco no primeiro erro e no título da confirmação, tempo limite de 12 s, reenvio com o mesmo `idEnvio` enquanto os dados não mudam, honeypot e trava de 1,2 s (robô vê confirmação sem envio), recusa 422 marcada no campo. O botão de envio nasce `disabled` e só o módulo libera; com `method="post"` e a CSP em `form-action 'none'`, nenhum envio nativo acontece se o JavaScript falhar (nada de dado pessoal na URL). A mensagem de erro entra no `aria-describedby` só enquanto está visível.
- `assets/site/lib/`: funções puras testadas em Node (`validacao.js`, `payload.js`, `atribuicao.js`, `enviar.js`, `formulario.js`).
- Tudo é melhoria progressiva: sem JS, o conteúdo aparece inteiro e os formulários dão lugar a um aviso com saída pelo WhatsApp (nenhum dado vai para a URL).

### Fundo vivo e palco da Home
`dev/site/parciais/fundo.html` é o primeiro filho do `main` em toda página. `assets/site/fundo.js` escolhe WebM ou MP4 e só atribui a fonte depois do `load`. A onda continua durante a rolagem e nos cinco capítulos; aba oculta pausa. Menos movimento, economia de dados, falta de codec ou falha de `play()` mantêm o pôster. A pausa fica no rodapé, com nome fixo, `aria-pressed` e preferência da visita em `sessionStorage`.

Para refazer a onda: de `tests/site`, `PW_CHANNEL=chrome node qa/video.mjs`, com ffmpeg no PATH. A fonte é `dev/site/video/cena.html`: 12 s, 30 quadros/s, loop contínuo. Saídas em `assets/site/video/`: WebM e MP4 de 1920 px (até 2,5 MB cada), de 1280 px (até 1,2 MB cada), pôster WebP (até 120 KB). A ferramenta confere costura e peso antes de substituir os arquivos. Os testes em `unit/video.test.mjs` guardam os mesmos tetos.

`assets/site/paginas/home.js` controla os cinco capítulos e seus seis passos com a rolagem, ativa uma cena por vez e desfaz passos ao voltar. Sem JS, menos movimento ou altura abaixo de 560 px, todas as cenas ficam montadas no fluxo. Para material de aprovação: de `tests/site`, `PW_CHANNEL=chrome node qa/palco.mjs <cena>`, com `atendimento`, `agentes`, `dashboards`, `crms` ou `saas`. PNGs dos passos e vídeos de rolagem ficam em `.tmp-qa/palco/`.

O topo tem 66 px, permanece escuro e fixo com JS, e o foco e as âncoras respeitam essa área. O parcial `whatsapp-flutuante.html` aparece em toda página menos Contato. No celular, ele sai enquanto o painel do palco ocupa seu espaço e retorna depois; o rodapé reserva espaço para o botão.

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
- CSP `<meta>` em toda página, vinda do parcial `head`. Origem nova de script, fonte, imagem ou `fetch` entra na diretiva certa, senão o navegador bloqueia. Hoje `connect-src` libera só `'self'` e o portal (funil e formulários). Vídeo e pôster são locais e ficam cobertos por `default-src 'self'`, sem origem nova na CSP. `style-src` mantém `'unsafe-inline'` por causa do `<noscript><style>` e de atributos `style`.
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
Desde a D14 de 15/10/2026, topo, rodapé e imagem de compartilhamento usam o quadrado violeta plano com o Sine Nodes canônico. O nome usa Geist, com Ops no peso 700. Os selos 3D de 128 e 512 px ficam preservados no kit, fora das páginas e do OG. Mudou a geometria, atualize no mesmo passo o kit, `assets/favicon.svg`, `assets/apple-touch-icon.png`, `assets/favicon-32.png` e a imagem de compartilhamento (`assets/og-waveops.png`, gerada de `dev/site/og.html` com `tests/site/qa/og.mjs`). Não volte às marcas aposentadas (anel único `Q 31 30 34 18.6` de `viewBox 0 0 48 48`, ou o grafo verde da FlowOps).

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
