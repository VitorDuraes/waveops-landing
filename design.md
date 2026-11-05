# Design: WaveOps (site institucional)

O sistema travado. Toda rodada da Hallmark lê este arquivo primeiro, e as 7 páginas o compartilham. Mude de propósito: o arquivo é a regra. Travado no redesign de 05/11/2026.

## Sistema
- Gênero: modern-minimal
- Forma da primeira página: Workbench (o produto em uso é o conteúdo: as cinco cenas do palco)
- Tema: brand (marca mantida: violeta da WaveOps, Geist e Inter, Sine Nodes, contexto escuro sobre a onda)
- Eixos: dark/grotesk-sans/chromatic-violet · postura: Restrained (o violeta é sinal, não preenchimento)
- Hero: Poster na Home (a onda é a imagem, texto embaixo e à esquerda); Stage nas internas (`.wo-abertura`)

## Tokens
`assets/site/tokens.css` é a fonte. Os papéis, com os nomes do projeto:
```css
:root {
  --wo-fundo: #0a0a0a;  --wo-fundo-2: #171717;  --wo-superficie: #171717;
  --wo-texto: #f3f3f1;  --wo-texto-2: rgb(255 255 255 / 0.75);  --wo-texto-3: #a3a3af;  --wo-borda: rgb(255 255 255 / 0.15);
  --wo-acento: #7c3aed;  --wo-acento-texto: #c2b2ff;  --wo-foco: #ffffff;
  --wo-fonte-titulo: 'Geist', system-ui, sans-serif;  --wo-fonte: 'Inter', system-ui, sans-serif;
  --wo-raio: 10px;  --wo-raio-pilula: 999px;  --wo-linha-fina: 1px;
}
```
Escala de tipo: hero `--wo-h1` 84 px em 1440, seção `--wo-h2` 52 px, item `--wo-h3-linha` 25 px, linha de apoio `--wo-lead-hero` 21 px, texto 16 px, rótulo 14 px. Contêiner 1440 px com margem de 64 px (1312 px de conteúdo). Respiro de seção `--wo-secao` 144 px a partir de 1024 px. O cartão claro (`.wo-cartao-claro`) é o único contexto claro.

## Regras que não voltam
- Nenhum sobretítulo nem selo acima de título. A seção abre pelo próprio título.
- Rótulo é Inter um passo menor, em caixa normal, sem entreletra.
- Título é uma cor só: `.wo-destaque` dentro de título herda a cor.
- Número de etapa vem do contador do `<ol>`, nunca de um "01" escrito.
- Meta em linha separada por quebra ou vírgula, nunca por ponto médio.
- Hero: título, uma frase e as ações. Cerca de 80 palavras por tela.

## Controles
- Principal: violeta cheio · pílula · 48 px
- Secundário: contorno na borda forte · mesma pílula e altura

## Movimento
- Caráter: calmo. A onda é o único laço ambiente (com pausa no rodapé); a entrada do hero é uma cascata finita; sob menos movimento tudo aparece no estado final.

## Exportações
`assets/site/tokens.css` neste projeto. Blocos de Tailwind, DTCG ou shadcn entram aqui se pedidos.
