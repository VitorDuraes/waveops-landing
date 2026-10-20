# WaveOps · Logo

Marca **Sine Nodes**: uma onda contínua que atravessa o **hub central** (anel),
com nós de entrada e saída. A onda é o fluxo; o hub é a operação; os nós são os
pontos conectados. Cor da marca **#7C3AED**. O site usa **Geist** no nome e nos títulos e **Inter** no texto desde 15/10/2026. O lockup vetorial do kit permanece preservado.

Abra `preview.html` para ver tudo renderizado.

## Arquivos

| Arquivo | Uso |
|---|---|
| `waveops-icon.svg` | App icon / favicon · squircle roxo com a marca branca. |
| `waveops-symbol.svg` | Símbolo roxo, fundo transparente. Para fundo claro. |
| `waveops-symbol-mono.svg` | Uma cor via `currentColor` (herda o `color` do CSS). |
| `waveops-lockup.svg` | Símbolo + nome "WaveOps". |
| `waveops-badge-3d.webp` | Variante 3D aposentada, preservada sem consumidor nas páginas atuais. |
| `png/waveops-icon.png` | 1000×1000, fundo transparente fora do squircle. |
| `png/waveops-icon-512.png` | 512×512 · ideal para app icon / redes. |
| `png/waveops-symbol.png` | Símbolo roxo, transparente, 1000×1000. |
| `png/waveops-symbol-white.png` | Símbolo branco, transparente · para fundo escuro. |

## Favicon no site
```html
<link rel="icon" type="image/svg+xml" href="logo/waveops-icon.svg" />
```

## Apresentação no site (D14, 15/10/2026)

Topo, rodapé e imagem de compartilhamento usam o quadrado violeta plano com o símbolo Sine Nodes canônico. No site, o nome vem em Geist, com Ops no peso 700. O símbolo mantém as duas ondas, o núcleo vazado e os dois nós sólidos, sem alteração de geometria.

Os arquivos `waveops-badge-3d.webp` e `waveops-badge-3d-128.webp` são variantes aposentadas de apresentação e permanecem neste kit. Nenhuma página atual nem o OG os carrega. Não os apague ao atualizar a apresentação plana.

O OG é editado em `dev/site/og.html` e `dev/site/og.css`, com saída em `assets/og-waveops.png` (1200 x 630). Para gerar: de `tests/site`, `PW_CHANNEL=chrome node qa/og.mjs`.

## Símbolo vetorial (exemplo inline, sem dependência de fonte)
```html
<a href="#top" style="display:inline-flex;align-items:center;gap:11px;font-family:'Geist',sans-serif;font-size:22px;letter-spacing:-.02em;text-decoration:none">
  <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
    <rect x="2" y="2" width="96" height="96" rx="24" fill="#7c3aed"/>
    <g stroke="#fff" stroke-width="5" stroke-linecap="round">
      <path d="M18,50 Q30,33 41,50"/><path d="M59,50 Q70,67 82,50"/>
    </g>
    <circle cx="50" cy="50" r="9" fill="none" stroke="#fff" stroke-width="5"/>
    <circle cx="18" cy="50" r="7.5" fill="#fff"/><circle cx="82" cy="50" r="7.5" fill="#fff"/>
  </svg>
  <span style="color:#15131c">Wave<b style="color:#7c3aed">Ops</b></span>
</a>
```

## Espaçamento mínimo
Deixe ao redor da marca uma margem livre de pelo menos o diâmetro de um nó.
Não comprima outros elementos contra o ícone.
