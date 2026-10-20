# Site institucional: como montar e verificar uma página

O site é estático, sem framework e sem dependência em produção. Cada página é um `index.html` numa pasta com o nome da rota. O que se repete entre páginas vive em `dev/site/parciais/` e é **carimbado no HTML** por `dev/site/build.mjs`. Nada é injetado por JavaScript no navegador. As páginas carimbadas são commitadas: o Netlify só copia arquivo.

## Mapa

| Caminho | O que é |
|---|---|
| `dev/site/paginas.json` | Lista das páginas (id, arquivo, URL). Fonte do build, do lint e dos testes |
| `dev/site/parciais/` | `head`, `topo`, `fundo`, `whatsapp-flutuante`, `cta-final`, `rodape`, `form-contato`, `form-interesse` |
| `assets/site/tokens.css` | Cores, tipografia, raios, sombras, contêiner. Valor novo entra aqui primeiro |
| `assets/site/base.css` | Fontes, reset, foco, contêiner, seção, títulos |
| `assets/site/components.css` | Peças compartilhadas do design system |
| `assets/site/paginas/<id>.css` | O que só uma página usa |
| `assets/site/site.js` | Menu e topo fixo, flutuante, seletores, clique de WhatsApp e âncoras antigas |
| `assets/site/fundo.js` | Onda contínua e pausa no topo, com preferência durante a visita |
| `assets/site/paginas/home.js` | Cinco cenas montadas e desmontadas com a rolagem |
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
      <!-- parcial:fundo -->
      <!-- /parcial:fundo -->
      <section class="wo-abertura">... hero ...</section>
      <section class="wo-secao wo-veu">... seção ...</section>
      <!-- parcial:cta-final -->
      <!-- /parcial:cta-final -->
      <!-- parcial:whatsapp-flutuante -->
      <!-- /parcial:whatsapp-flutuante -->
    </main>
    <!-- parcial:rodape -->
    <!-- /parcial:rodape -->
  </body>
</html>
```

O miolo entre os marcadores pode ficar vazio: o build preenche. `ativo` marca item do menu com `home`, `solucoes`, `sobmedida` ou `contato`. Demonstrações e Plataforma ficam fora do menu (a Plataforma desde 14/10/2026): use `ativo="demonstracoes"` e `ativo="plataforma"`, que não marcam item. A chamada final vai dentro do `<main>` (conteúdo fora de landmark reprova no axe).

## Classes do design system

| Classe | Uso |
|---|---|
| `wo-secao`, `wo-veu`, `wo-veu-forte` | Seção com respiro de 96 px no celular e 128 px a partir de 640 px; véu de 72% ou 84% |
| `wo-conteiner` | Contêiner de até 1280 px, com margem responsiva de 20, 32 ou 48 px |
| `wo-abertura`, `wo-abertura__grade`, `wo-abertura__texto`, `wo-abertura__lead` | Hero transparente sobre a onda, título e texto de apoio |
| `wo-h1`, `wo-h2`, `wo-linha`, `wo-destaque`, `wo-lead` | Títulos Geist e texto Inter |
| `wo-titulo-cartao` | Geist 18 px, peso 500, entreletra -0,02em, altura 1,55; layout fica na classe de contexto |
| `wo-sobretitulo`, `wo-etiqueta-hero`, `wo-etiqueta`, `wo-nota-mono` | Etiquetas e notas em Inter; nomes antigos não indicam fonte mono |
| `wo-selo--disponivel`, `wo-selo--desenvolvimento`, `wo-selo--planejado` | Situação com cor e forma, sempre junto de `wo-selo` |
| `wo-btn` + `--primario`, `--secundario`, `--grande`; `wo-acoes`; `wo-link-seta` | Ações; secundário é contorno; 40 px no desktop, alvo de 44 px no celular |
| `wo-editorial`, `wo-cartao-claro`, `wo-cartao-noite` | Grade de texto e cartão; creme só dentro do cartão claro |
| `wo-maquete`, `wo-maquete__cabeca`, `wo-maquete__titulo`, `wo-maquete__aviso` | Interface ilustrativa com aviso obrigatório em Nota 14 px; palco mantém a versão compacta de 11 px |
| `wo-seletor`, `wo-seletor__opcoes`, `wo-seletor__opcao`, `wo-seletor__paineis` | Seletor de painel único |
| `wo-definicoes`, `wo-lista-editorial`, `wo-colunas-numeradas` | Definições, frentes e etapas; número decorativo usa `aria-hidden="true"` |
| `wo-tabela-modelos`, `wo-modelo`, `wo-modelos__rodape` | Modelos de contratação e notas |

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
2. **CSS da página só em `assets/site/paginas/<id>.css`**, com classes `wo-<id>-...` ou `wo-<id>__...`. Não redefina seletor base de `components.css` (o teste `css.test.mjs` barra). Peça usada por mais de uma página entra em `components.css`; todo valor novo entra antes em `tokens.css`. A limpeza exige consumidores reais das classes e definições das variáveis sem reserva, sem aliases aposentados.
3. **Acessibilidade:** um `h1`; headings sem pular nível; SVG decorativo com `aria-hidden="true" focusable="false"`; imagem decorativa com `alt=""`; SVG com `width` e `height`; alvo de toque de 44 px abaixo de 768 px e botão de 40 px no desktop; contraste AA de 4,5:1 no texto e 3:1 em texto grande, inclusive sobre a onda.
4. **Links internos** com barra final (`/solucoes/`). Âncoras do design viram `id` reais. Links que o design deixou sem destino:

| Link do design | Destino |
|---|---|
| Área do cliente | `https://portal.waveops.com.br/cliente/login` |
| Termos de Uso | `https://portal.waveops.com.br/termos` |
| Política de Privacidade | `https://portal.waveops.com.br/privacidade` |
| WhatsApp | `https://wa.me/5534991775784?text=` mais texto com `encodeURIComponent`, e `data-whatsapp="<onde>"` para o funil |

5. **Sem script inline nem `style` novo que exija mudar a CSP.** JavaScript de página, se precisar, vai em `assets/site/paginas/<id>.js` como `type="module"`.
6. **Escopo compartilhado:** coordene mudanças em tokens, componentes, parciais e scripts com quem edita as outras páginas. Não mude campos, mensagens, IDs, `data-*`, endpoints ou scripts dos formulários por razão visual.
7. **Fundo vivo:** o parcial `fundo` vem primeiro no `main`. Hero transparente; seções com véu. Não restaure folha creme nem troca de paleta do topo. Numere `data-entrada` do hero de 0 em diante, sem lacunas; sem JS e menos movimento mostram estado final. Não adicione animação contínua além da onda.
8. **Marca e oferta:** Sine Nodes no quadrado violeta plano em topo, rodapé e OG. Selos 3D e fontes aposentadas ficam no repo. Preserve as cinco frentes e as âncoras existentes; Plataforma não entra no menu nem na Home e nenhum módulo aparece disponível.

## Verificação (rode da raiz do repo)

```bash
node dev/site/build.mjs --pagina <arquivo>          # carimba só a sua página
node dev/site/lint.mjs <arquivo>                    # zero erro
node --test "tests/site/unit/**/*.test.mjs"         # inclui o guarda de colisão de CSS
cd tests/site
SITE_PORTA=<porta> PW_CHANNEL=chrome npx playwright test fumaca responsivo --grep "<rota>"
DESIGN_CAPTURAS=<pasta> PW_CHANNEL=chrome node qa/visual.mjs <id>           # folhas em .tmp-qa/comparacao/
```

Use uma `SITE_PORTA` própria quando houver mais gente rodando teste ao mesmo tempo.

## Materiais visuais

`qa/visual.mjs` espera as fontes e só as animações finitas de entrada do hero. A onda em loop não bloqueia a captura. `DESIGN_CAPTURAS` contém `computador_1440/`, `tablet_768/` e `celular_390/`; a saída guarda páginas inteiras e folhas em `.tmp-qa/`. Produção é recusada em `SITE_URL`; a comparação remota é só para preview.

De `tests/site`, com `PW_CHANNEL=chrome`:

- `node qa/og.mjs`: renderiza `dev/site/og.html` e `og.css` para `assets/og-waveops.png`, 1200 x 630.
- `node qa/video.mjs`: refaz a onda de 12 s a 30 quadros/s, a partir de `dev/site/video/cena.html`, com ffmpeg. WebM e MP4 em 1920 px (2,5 MB por arquivo) e 1280 px (1,2 MB), pôster WebP até 120 KB. Confere costura e peso antes de copiar para `assets/site/video/`.
- `node qa/palco.mjs <cena>`: PNGs dos seis passos e rolagem desktop/celular em `.tmp-qa/palco/`. Cenas: atendimento, agentes, dashboards, crms e saas.

O orçamento por página mede só CSS e JavaScript com gzip nível 9: CSS até 25 KB, JS até 15 KB ou 20 KB com formulário. Fontes, imagens, vídeo e pôster têm conta própria. Teste visual de formulário usa somente dados fictícios e rede local interceptada.
