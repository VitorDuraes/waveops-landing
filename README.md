# WaveOps · site institucional

Site institucional da WaveOps em PT-BR, só tema escuro, com seis páginas: Início, Soluções,
Plataforma, Projetos sob medida, Contato e Demonstrações técnicas (fora do menu). O mesmo
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
simulados, então nada vai para o n8n de produção. Para ver os estados de falha:
`/contato/?simular=falha` ou `?simular=lento`.

## Verificar

```bash
node dev/site/build.mjs --check    # parciais e versões de cache em dia
node dev/site/lint.mjs             # HTML, acessibilidade básica, links, CSP, travessão
npm ci --prefix tests/site         # Playwright, axe e TypeScript, só para teste
npm --prefix tests/site run typecheck
npm --prefix tests/site run test:unit
cd tests/site && PW_CHANNEL=chrome npx playwright test
PW_CHANNEL=chrome node qa/visual.mjs     # folhas lado a lado com o design em .tmp-qa/comparacao/
```

O CI roda tudo isso no job `site` de `.github/workflows/ci.yml`, com os testes de navegador sobre
o build simulado do Netlify (`node dev/site/build.mjs --dist .tmp-site`).

## Estrutura

```
index.html, solucoes/, plataforma/, projetos-sob-medida/, contato/, demonstracoes-tecnicas/, 404.html
assets/site/      tokens.css, base.css, components.css, paginas/*.css, site.js, contato.js,
                  interesse.js, config.js, lib/ (validação, contrato de envio, atribuição, envio)
assets/funil.js   medição própria de funil (SPEC-18), com atribuição por sessão
assets/brand/     marca Sine Nodes e o selo 3D do topo e do rodapé
dev/site/         build, lint, servidor local, parciais, páginas.json e o guia de montagem
tests/site/       testes unitários, Playwright, axe e QA visual
```

Como montar ou mudar uma página: `dev/site/README.md`.

## Formulários

- **Contato** envia para o n8n o contrato v2: as 15 chaves que o site antigo mandava, com os
  mesmos nomes, mais canal de retorno, e-mail, telefone, ciência da Política de Privacidade com
  versão e hora, consentimento de marketing separado e o primeiro toque da sessão.
- **Lista de interesse** da Plataforma só confirma depois que o servidor responde que gravou.
- Endpoints por ambiente em `assets/site/config.js`. Workflows e roteiro de publicação em
  `docs/integrations/n8n-site-v2.md`.

## Publicação

O Netlify publica só o que o `[build] command` do `netlify.toml` copia, e só faz deploy quando o
`ignore` enxerga a mudança. Página nova entra nas duas listas no mesmo commit; o teste
`tests/site/unit/netlify.test.mjs` confere isso. O domínio é configurado no painel do Netlify mais
DNS; não existe `CNAME` neste repositório.
