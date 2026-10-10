# Site institucional: como montar e verificar uma página

O site é estático, sem framework e sem dependência em produção. Cada página é um `index.html` numa pasta com o nome da rota. O que se repete entre páginas vive em `dev/site/parciais/` e é **carimbado no HTML** por `dev/site/build.mjs`. Nada é injetado por JavaScript no navegador. As páginas carimbadas são commitadas: o Netlify só copia arquivo.

## Mapa

| Caminho | O que é |
|---|---|
| `dev/site/paginas.json` | Lista das páginas (id, arquivo, URL). Fonte do build, do lint e dos testes |
| `dev/site/parciais/` | `head`, `topo`, `cta-final`, `rodape`, `form-contato`, `form-interesse` |
| `assets/site/tokens.css` | Cores, tipografia, raios, sombras, contêiner. Valor novo entra aqui primeiro |
| `assets/site/base.css` | Fontes, reset, foco, contêiner, seção, títulos |
| `assets/site/components.css` | Peças compartilhadas do design system |
| `assets/site/paginas/<id>.css` | O que só uma página usa |
| `assets/site/site.js` | Menu do topo, seletores, clique de WhatsApp, âncoras antigas na Home |
| `assets/funil.js` | Medição de funil (SPEC-18) |

## Esqueleto de uma página

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <!-- parcial:head -->
    <!-- /parcial:head -->
    <link rel="stylesheet" href="/assets/site/paginas/<id>.css" />
    <title>Título até 60 caracteres · WaveOps</title>
    <meta name="description" content="Até 155 caracteres, só com o que a página afirma." />
    <link rel="canonical" href="https://waveops.com.br/<rota>/" />
    <meta name="robots" content="index, follow" />
    <!-- og:type, og:site_name, og:locale, og:url, og:title, og:description, og:image (1200x630), og:image:alt, twitter:* -->
    <script type="application/ld+json">{ BreadcrumbList da página }</script>
  </head>
  <body data-pagina="<id>">
    <a class="wo-pular" href="#conteudo">Pular para o conteúdo</a>
    <!-- parcial:topo ativo="<id>" -->
    <!-- /parcial:topo -->
    <main id="conteudo" tabindex="-1">
      ... seções ...
      <!-- parcial:cta-final -->
      <!-- /parcial:cta-final -->
    </main>
    <!-- parcial:rodape -->
    <!-- /parcial:rodape -->
  </body>
</html>
```

O miolo entre os marcadores pode ficar vazio: o build preenche. `ativo` aceita `home`, `solucoes`, `plataforma`, `sobmedida`, `contato`. Demonstrações fica fora do menu: use `ativo="demonstracoes"`. A chamada final vai dentro do `<main>` (conteúdo fora de landmark reprova no axe).

## Classes do design system

| Classe | Uso |
|---|---|
| `wo-secao`, `wo-secao--menor`, `wo-secao--faixa` | Seção com o ritmo vertical do design; `--faixa` é o fundo `#101115` com fios |
| `wo-conteiner` | Largura máxima de 1328 px com a margem lateral do design |
| `wo-hero`, `wo-hero__brilho`, `wo-hero__grade`, `wo-hero__texto`, `wo-hero__visual`, `wo-hero__lead` | Hero de duas colunas |
| `wo-h1`, `wo-h2`, `wo-h2--medio`, `wo-h2--menor`, `wo-linha`, `wo-destaque`, `wo-lead`, `wo-lead--curto` | Títulos e parágrafo de abertura |
| `wo-sobretitulo`, `wo-etiqueta-hero`, `wo-rotulo-mono`, `wo-rotulo-mono--acento`, `wo-nota-mono`, `wo-nota-mono--ponto`, `wo-cabeca-selo` | Rótulos em Space Mono |
| `wo-selo--disponivel`, `wo-selo--desenvolvimento`, `wo-selo--planejado` | Selo de situação (sempre com a classe base `wo-selo`) |
| `wo-chip`, `wo-chip--desenvolvimento`, `wo-chip--planejado`, `wo-chips` | Link em pílula com marcador de situação |
| `wo-btn` + `--primario`, `--secundario`, `--grande`; `wo-acoes`; `wo-link-seta` | Ações |
| `wo-duas-colunas`, `wo-duas-colunas--topo`, `wo-coluna` | Texto e painel lado a lado, que empilham sozinhos |
| `wo-maquete`, `wo-maquete--sombra`, `wo-maquete__cabeca`, `wo-maquete__titulo`, `wo-maquete__aviso` | Painel que imita interface. Sempre com o aviso de ilustração do design |
| `wo-entradas`, `wo-entrada` e filhos | Cartões-link separados por fio |
| `wo-seletor`, `wo-seletor__opcoes`, `wo-seletor__opcao`, `wo-seletor__paineis` | Seletor de painel único (ver abaixo) |
| `wo-resultado` e filhos, `wo-sinais`, `wo-lista-check`, `wo-lista-check--espacada` | Resultado de negócio: sinais, o que constrói, como contratar |
| `wo-definicoes` | `<dl>` em grade |
| `wo-passos`, `wo-passo` e filhos | Passos numerados verticais |
| `wo-modelos`, `wo-modelo` e filhos, `wo-modelos__rodape` | Modelos de contratação |

Seletor de painel único (o `site.js` liga sozinho):

```html
<div class="wo-seletor" data-seletor>
  <div class="wo-seletor__opcoes" role="group" aria-label="..." data-opcoes>
    <button class="wo-seletor__opcao" type="button" data-opcao="0" aria-pressed="true" aria-controls="painel-a">A</button>
    <button class="wo-seletor__opcao" type="button" data-opcao="1" aria-pressed="false" aria-controls="painel-b">B</button>
  </div>
  <div class="wo-seletor__paineis">
    <div id="painel-a" data-painel="0">...</div>
    <div id="painel-b" data-painel="1">...</div>
  </div>
</div>
```

Todos os painéis saem no HTML. Sem JavaScript, o `<noscript>` do `head` mostra todos e esconde os botões.

## Regras

1. **Texto literal do design.** PT-BR com acento. Nunca travessão nem meia-risca (o lint barra). Não invente cliente, número, prazo, preço nem situação de módulo. Maquete de interface leva o aviso de ilustração que o design traz.
2. **CSS da página só em `assets/site/paginas/<id>.css`**, com classes `wo-<id>-...` ou `wo-<id>__...`. Não redefina seletor base de `components.css` (o teste `css.test.mjs` barra). Precisou de peça nova que outra página também usa? Avise: ela entra em `components.css` numa tarefa separada.
3. **Acessibilidade:** um `h1`; headings sem pular nível; SVG decorativo com `aria-hidden="true" focusable="false"`; imagem decorativa com `alt=""`; alvo de toque de 44 px; contraste AA.
4. **Links internos** com barra final (`/solucoes/`). Âncoras do design viram `id` reais. Links que o design deixou sem destino:

| Link do design | Destino |
|---|---|
| Área do cliente | `https://portal.waveops.com.br/cliente/login` |
| Termos de Uso | `https://portal.waveops.com.br/termos` |
| Política de Privacidade | `https://portal.waveops.com.br/privacidade` |
| WhatsApp | `https://wa.me/5534991775784?text=` mais texto com `encodeURIComponent`, e `data-whatsapp="<onde>"` para o funil |

5. **Sem script inline nem `style` novo que exija mudar a CSP.** JavaScript de página, se precisar, vai em `assets/site/paginas/<id>.js` como `type="module"`.
6. **Não mexa** em `components.css`, `base.css`, `tokens.css`, `site.js`, `parciais/`, `paginas.json` nem em página de outra pessoa.

## Verificação (rode da raiz do repo)

```bash
node dev/site/build.mjs --pagina <arquivo>          # carimba só a sua página
node dev/site/lint.mjs <arquivo>                    # zero erro
node --test "tests/site/unit/**/*.test.mjs"         # inclui o guarda de colisão de CSS
cd tests/site
SITE_PORTA=<porta> PW_CHANNEL=chrome npx playwright test fumaca responsivo --grep "<rota>"
PW_CHANNEL=chrome node qa/visual.mjs <id>           # folhas em .tmp-qa/comparacao/
```

Use uma `SITE_PORTA` própria quando houver mais gente rodando teste ao mesmo tempo.
