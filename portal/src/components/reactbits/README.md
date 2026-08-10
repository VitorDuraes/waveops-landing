# Componentes React Bits

Fonte: [React Bits](https://reactbits.dev) (repositório `DavidHDev/react-bits`), licença MIT.

React Bits não é uma dependência instalada: o modelo da biblioteca é copiar o código do
componente para o projeto e adaptar. É o que está aqui. Isso evita arrastar Chakra, gsap,
three.js e matter-js, que o pacote de terceiros `@appletosolutions/reactbits` traz como
peer dependency para entregar a mesma coisa.

| Componente | Origem | Onde é usado | O que mudou |
|---|---|---|---|
| `CountUp` | `TextAnimations/CountUp` | Cards de métrica do admin e do cliente | Import de `framer-motion` (o projeto já usa a v12), formatação pt-BR com prefixo e sufixo, `prefers-reduced-motion` respeitado, valor final no `aria-label` |
| `SpotlightCard` | `Components/SpotlightCard` | Cards de métrica | CSS próprio trocado pelos tokens do design system (`.spotlight` em `globals.css`), cor do brilho vinda do accent do tema |

Regra ao trazer um componente novo: só entra o que depende de `framer-motion` ou de CSS
puro. Componente que exige gsap, three.js ou ogl fica de fora.
