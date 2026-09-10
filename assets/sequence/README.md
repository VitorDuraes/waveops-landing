# Sequencia de quadros, painel de fluxo WaveOps

Quadros gerados para o componente `ImageSequence` (fase 2 do plano de islands React) que a
secao "Como funciona" da landing raspa pelo scroll, mostrando o fluxo comercial WaveOps se
montando ao longo das 6 etapas.

## Proveniencia

- Fonte visual: o proprio painel de fluxo do hero (`index.html`, `.flow-canvas`), reconstruido
  em `dev/_gen-sequence.html` e parametrizado por um progresso `t` de 0 a 1 lido da query string.
- Gerador: `_gen_sequence.py`, na raiz do repo. Sobe um servidor HTTP local, abre o Chrome
  headless em cada valor de `t`, captura um PNG em 960x720 e converte para WebP com Pillow.
- Nenhuma cor, fonte ou espacamento foi inventado: `dev/_gen-sequence.html` importa
  `assets/fonts.css`, `assets/styles.css` e `assets/cinematic.css` e le os tokens (`--bg`,
  `--accent`, `--border`, `--glow`) exatamente como a producao.

## Especificacao atual

| Item | Valor |
|---|---|
| Quadros | 48 (`frame-000.webp` a `frame-047.webp`) |
| Resolucao | 960x720 |
| Formato | WebP |
| Qualidade | 65 |
| Peso total | 309.1 KB |
| Peso medio por quadro | 6.44 KB |
| Teto do conjunto | 400 KB |

## Como regenerar

```
python _gen_sequence.py
```

Parametros opcionais:

```
python _gen_sequence.py --frames 48 --quality 65
```

O script imprime o peso do conjunto a cada tentativa de qualidade. Se o resultado passar do
teto de 400 KB, ele cai a qualidade WebP em passos de 10 (ate o minimo de 20) e tenta de novo.
Se mesmo assim nao couber, ele falha alto (exit code diferente de zero) em vez de gravar um
conjunto pesado demais: nesse caso, rode de novo com `--frames` menor. Nunca aumente o teto de
400 KB, isso e uma pagina de captacao de lead.

Pre-requisito: Chrome em `C:\Program Files\Google\Chrome\Application\chrome.exe` e Pillow
instalado (`pip install pillow`).

## O que nao mudar sem atualizar aqui

Se o painel de fluxo do hero mudar em `index.html` (nos, textos, cores, layout), atualize
`dev/_gen-sequence.html` para acompanhar e regenere a sequencia. Os dois devem continuar
parecendo a mesma marca.
