# WaveOps · site institucional

Site institucional da WaveOps em PT-BR, no contexto escuro do novo visual, com seis páginas: Início, Soluções,
Projetos sob medida, Contato, Demonstrações técnicas e Plataforma (as duas últimas fora do menu,
com acesso pelo rodapé). O mesmo
repositório guarda o WaveOps Portal, app Next em `portal/`, publicado à parte em
`portal.waveops.com.br`.

O site é HTML, CSS e JavaScript puro, sem framework e sem dependência em produção. O topo, o
rodapé, a chamada final e os formulários vivem em `dev/site/parciais/` e são carimbados no HTML
por `dev/site/build.mjs`. As páginas carimbadas são commitadas: o Netlify só copia arquivo.

## Rodar

```bash
node dev/site/serve.mjs            # http://127.0.0.1:4321/
```

O servidor local imita o Netlify (barra final, 404) e responde os formulários com endpoints
simulados, então nenhum lead vai para produção. Para ver os estados de falha:
`/contato/?simular=falha` ou `?simular=lento`.

## Verificar

```bash
node dev/site/build.mjs --check    # parciais e versões de cache em dia
node dev/site/lint.mjs             # HTML, acessibilidade básica, links, CSP, travessão
npm ci --prefix tests/site         # Playwright, axe e TypeScript, só para teste
npm --prefix tests/site run typecheck
npm --prefix tests/site run test:unit
cd tests/site && PW_CHANNEL=chrome npx playwright test
DESIGN_CAPTURAS=<pasta> PW_CHANNEL=chrome node qa/visual.mjs     # folhas lado a lado com o design em .tmp-qa/comparacao/
```

O CI roda tudo isso no job `site` de `.github/workflows/ci.yml`, com os testes de navegador sobre
o build simulado do Netlify (`node dev/site/build.mjs --dist .tmp-site`).

## Estrutura

```
index.html, solucoes/, plataforma/, projetos-sob-medida/, contato/, demonstracoes-tecnicas/, 404.html
assets/site/      tokens.css, base.css, components.css, paginas/*.css, site.js, contato.js,
                  interesse.js, config.js, lib/ (validação, contrato de envio, atribuição, envio)
assets/funil.js   medição própria de funil (SPEC-18), com atribuição por sessão
assets/brand/     marca Sine Nodes; selos 3D aposentados preservados
dev/site/         build, lint, servidor local, parciais, páginas.json e o guia de montagem
tests/site/       testes unitários, Playwright, axe e QA visual
```

Como montar ou mudar uma página: `dev/site/README.md`.

## Novo visual

Geist nos títulos, Inter no texto e Sine Nodes no quadrado violeta plano. A onda fixa fica atrás de toda página; seções alternam véu escuro de 72% e 84%, e os cartões claros guardam o contexto de papel. A Home apresenta cinco frentes: automação de atendimento, agentes de IA, painéis de gestão, CRMs sob medida e apps e sistemas. Apps são web, acessados pelo navegador. IDs e chaves internas dashboards e saas permanecem para preservar links antigos. Plataforma continua em desenvolvimento e fora do menu e da Home.

| Classe | Papel |
|---|---|
| `wo-abertura`, `wo-abertura__grade` | Hero transparente com entrada finita em `data-entrada` |
| `wo-secao`, `wo-veu`, `wo-veu-forte` | Ritmo de seção e camada de leitura sobre a onda |
| `wo-cartao-claro`, `wo-cartao-noite` | Cartão com contexto próprio |
| `wo-titulo-cartao` | Título de cartão compartilhado, Geist 18 px |
| `wo-btn--primario`, `wo-btn--secundario` | Botão violeta e botão de contorno |
| `wo-maquete__aviso` | Nota obrigatória de interface ilustrativa |
| `wo-colunas-numeradas`, `wo-lista-editorial`, `wo-tabela-modelos` | Etapas, frentes e contratação |

Quem edita página deve pôr valores novos em `tokens.css`, peças compartilhadas em `components.css` e regras exclusivas em `paginas/<id>.css`, com prefixo da página. Preserve contratos dos formulários e âncoras. Rode o build após a edição, contraste, geometria e testes pertinentes. Sem JS e com menos movimento, a página mostra tudo montado e o pôster. Fontes, imagens e vídeo ficam fora do teto por página de 15 KB JS (20 KB com formulário) e 25 KB CSS gzip.

O guia de montagem documenta `qa/video.mjs`, `qa/palco.mjs`, `qa/og.mjs` e a comparação visual. O OG é editado em `dev/site/og.html` e `og.css`, com saída de 1200 x 630 em `assets/og-waveops.png`.

## Formulários

- **Contato** envia diretamente para `POST https://portal.waveops.com.br/api/site/contato`;
  **lista de interesse**, para `/api/site/interesse` no mesmo host. Envios válidos ficam na
  tabela `leads` e são atendidos em `/admin/leads`, com ciência da política e marketing separados.
- Endpoints por ambiente em `assets/site/config.js`. Mapa de dados, limites e exclusão no
  [guia do portal](docs/integrations/portal-site-v2.md). O desenho n8n é histórico.
- Retenção: Vitor aprovou limites operacionais de 180 dias para contato e 365 dias
  para interesse desde a criação, para preparar a implementação. O admin oferece
  uma prévia de contagens sob demanda. O detalhe do lead permite exceção manual com
  justificativa e revisão em até 30 dias, regra operacional confirmada por Vitor.
  A prévia separa revisões vigentes, vencidas e ausência de exceção entre os cadastros
  com prazo atingido. H4 e o expurgo automático continuam pendentes.

## Publicação

O Netlify publica só o que o `[build] command` do `netlify.toml` copia, e só faz deploy quando o
`ignore` enxerga a mudança. Página nova entra nas duas listas no mesmo commit; o teste
`tests/site/unit/netlify.test.mjs` confere isso. O domínio é configurado no painel do Netlify mais
DNS; não existe `CNAME` neste repositório.
