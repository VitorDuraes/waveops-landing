# WaveOps — Logo (SVG)

Direção **Onda + nó**: a onda é o fluxo, o nó com anel é a operação entregue.
Cor da marca: **#8B5CF6** (mesma do site). Tipografia: **Space Grotesk**.

Abra `preview.html` para ver todos os arquivos renderizados.

## Arquivos

| Arquivo | Quando usar |
|---|---|
| `waveops-symbol.svg` | Símbolo violeta. Uso geral em fundo claro. O nó é vazado, então funciona sobre qualquer fundo. |
| `waveops-symbol-white.svg` | Símbolo branco. Para fundo escuro ou violeta. |
| `waveops-symbol-mono.svg` | Uma cor só, via `currentColor` — herda a cor do texto (CSS `color`). Bom para fundos coloridos/impressão. |
| `waveops-favicon.svg` | Ícone quadrado (squircle violeta + onda branca). Favicon e ícone de app. |
| `waveops-lockup.svg` | Símbolo + nome "WaveOps". Uso principal (header, e-mail, documentos) em fundo claro. |
| `waveops-lockup-white.svg` | Lockup para fundo escuro. |

## Favicon (no site)
```html
<link rel="icon" type="image/svg+xml" href="logo/waveops-favicon.svg" />
```
Para navegadores antigos, gere também um `favicon.ico` 32×32 a partir do SVG
(qualquer conversor online serve) e adicione:
```html
<link rel="icon" href="favicon.ico" sizes="any" />
```

## Recolorir o monocromático
```html
<span style="color:#7c3aed">
  <img src="logo/waveops-symbol-mono.svg" width="40" alt="WaveOps">
</span>
<!-- ou inline o SVG e controle por CSS: a cor vem de `color` -->
```

## Observação sobre os lockups (texto)
Os `*-lockup.svg` trazem a fonte **Space Grotesk embutida** (em base64), então
renderizam certo quando você **inserir o SVG inline no HTML** ou **abrir o arquivo
direto no navegador**. ⚠️ Quando um SVG com texto é usado dentro de uma tag
`<img>`, o navegador ignora a fonte e cai num serifado — é limitação do próprio
navegador, não do arquivo.

**Regra prática:**
- **No site (header):** use o lockup **inline** (cole o conteúdo do .svg direto no
  HTML) — veja o snippet abaixo. Ou, melhor ainda, use o **símbolo** + o nome em
  texto HTML real (é assim que a landing já faz).
- **Para `<img>`, e-mail, impressão ou vídeo:** use o **símbolo** (`waveops-symbol*.svg`,
  vetor puro, sem dependência de fonte) ou exporte o lockup como **PNG** (abra o
  .svg no navegador e tire um print, ou peça que eu gere).

### Snippet pronto para o header (lockup inline)
```html
<a href="#top" style="display:inline-flex;align-items:center;gap:10px;font-family:'Space Grotesk',sans-serif;font-size:24px;letter-spacing:-.02em;text-decoration:none">
  <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
    <path d="M7 30 Q 15 15 24 23 Q 31 30 34 18.6" stroke="#8b5cf6" stroke-width="3.6" stroke-linecap="round"/>
    <circle cx="7" cy="30" r="3.5" fill="#8b5cf6"/>
    <path fill-rule="evenodd" fill="#8b5cf6" d="M34 18 a6 6 0 1 1 12 0 a6 6 0 1 1 -12 0 Z M37.6 18 a2.4 2.4 0 1 0 4.8 0 a2.4 2.4 0 1 0 -4.8 0 Z"/>
  </svg>
  <span style="color:#15131c">Wave<b style="color:#7c3aed">Ops</b></span>
</a>
```

## Espaçamento mínimo
Deixe ao redor da marca uma margem livre de pelo menos a **altura do nó** (o
círculo maior). Não aperte texto ou outros elementos contra a logo.
