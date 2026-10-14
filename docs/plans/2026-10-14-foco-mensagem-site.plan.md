# Site: foco na operação de quem vende

| Campo | Valor |
|---|---|
| Data | 14/10/2026 |
| Decisão | Vitor, 14/10/2026: aprovou os três itens da análise de posicionamento ("faça o melhor sugerido") |
| Branch | `feat/site-foco-operacao` |
| Plano de origem | [Site institucional v2](2026-10-09-site-institucional-v2.plan.md) |

## Decisão

1. **Foco da mensagem:** a WaveOps se apresenta como software house especializada na operação de quem vende. Quatro frentes: automação de processos, integração de sistemas, sistemas e painéis sob medida e agentes de IA supervisionados. A promessa inclui cuidar do que está no ar (serviços gerenciados).
2. **Plataforma fora do menu e das entradas da Home.** A página `/plataforma/` e a lista de interesse continuam no ar, com acesso pelo rodapé e pelo sitemap.
3. **Projetos sob medida passa de oito para quatro frentes.** Desenvolvimento web, e-commerce, engenharia de dados e consultoria de TI deixam de ser frentes; painéis entram em sistemas sob medida, e o diagnóstico continua nas etapas do trabalho.

Motivo: a mensagem de "capacidade ampla" do v2 (spec de 09/10, seção 1) não tem caso real publicado para sustentá-la e dividia a atenção com um produto que ainda não está à venda.

## Fora de escopo

Layout novo, páginas novas ou removidas, contrato dos formulários (o valor `plataforma` em "O que você procura" continua aceito pelo portal), Termos, Política, textos de aceite, funil e portal.

## Mudanças por arquivo

| Arquivo | Mudança |
|---|---|
| `dev/site/parciais/topo.html` | Tira a Plataforma do menu da barra e do menu do celular |
| `dev/site/parciais/rodape.html` | Nova descrição; colunas na ordem Soluções, Projetos sob medida, Plataforma e Empresa; quatro frentes |
| `index.html` | Title, description, Open Graph, JSON-LD, hero, duas entradas, quatro frentes, seletor com Serviços gerenciados no lugar da Plataforma, sem a seção da Plataforma, contratos sem a assinatura e faixas alternadas |
| `projetos-sob-medida/index.html` | Title, description, quatro frentes nas âncoras que já existiam (`#automacoes`, `#integracoes`, `#sistemas`, `#agentes`), modelos sem a assinatura e caixa das perguntas sem a Plataforma |
| `solucoes/index.html` | Como contratar com as frentes novas e Serviços gerenciados no lugar da Plataforma; Vender mais, Decidir com dados e Crescer com segurança alinhados às frentes e aos serviços gerenciados |
| `demonstracoes-tecnicas/index.html` e `tests/site/e2e/demonstracoes.spec.ts` | Filtro com as quatro frentes; o fluxo de pedido e pagamento passa para Integração; o fluxo de consultoria sai; cinco fluxos |
| `404.html`, `contato/index.html` e `plataforma/index.html` | Recarimbo do topo e do rodapé e texto alternativo da imagem de compartilhamento |
| `assets/site/paginas/home.css` | Remove os estilos da seção da Plataforma na Home |
| `assets/site/components.css` | Rodapé de Projetos sob medida em uma coluna; remove chips e definições que ficaram sem uso |
| `sitemap.xml` | `lastmod` em 14/10/2026 |
| `README.md` e `dev/site/README.md` | Menu sem a Plataforma |
| `llms.txt` | Resumo e páginas com o foco novo |
| `dev/site/og.html` e `assets/og-waveops.png` | Imagem de compartilhamento com a promessa nova |
| `tests/site/unit/conteudo.test.mjs` | Guardas: Plataforma fora do menu, âncoras internas apontam para `id` existente, assinatura nunca disponível |
| `CLAUDE.md` | Registra a Plataforma fora do menu |

## Preservado

- Âncoras usadas por outros sistemas: `/projetos-sob-medida/#modelos` (portal), `#como-trabalhamos` e `#perguntas` (âncoras antigas), `/solucoes/#publicos`.
- Mapa das âncoras antigas em `assets/site/lib/legado.js`, inclusive `#operacao` para `/plataforma/`.
- Promessas confirmadas pelo Vitor: "Primeira conversa sem custo e sem compromisso" e "Resposta em até 1 dia útil".
- Nenhum módulo da Plataforma nem a assinatura aparecem como disponíveis.

## Verificação

```bash
node dev/site/build.mjs
node dev/site/build.mjs --check
node dev/site/lint.mjs
npm --prefix tests/site run typecheck
npm --prefix tests/site run test:unit
cd tests/site && PW_CHANNEL=chrome npx playwright test
npm --prefix portal run test:unit
```

Critérios de aceite:

1. Nenhum menu tem link para `/plataforma/`; o rodapé mantém Visão geral, Núcleo e módulos e Lista de interesse.
2. A Home não tem cartão, seção ou contrato da Plataforma; as entradas são Soluções e Projetos sob medida.
3. Projetos sob medida e Demonstrações técnicas mostram as quatro frentes; nenhuma página nem o `llms.txt` anunciam frente retirada; todo link interno com âncora aponta para um `id` existente (lint).
4. Title até 60 caracteres e description até 155 nas páginas alteradas (lint).
5. Suítes unitárias e Playwright sem falha nova; teste de links do portal verde.
6. Copy sem travessão, com acento, sem promessa nova. Cuidar do que está no ar aparece sempre ligado a serviços gerenciados, que são contratados à parte.

## Medição

A régua da spec de 09/10 fecha em 08/11/2026: quatro semanas depois da publicação do v2, em 11/10, contra as quatro anteriores (ainda com o site antigo). Para esta mudança, conferir em 11/11/2026, quatro semanas depois de 14/10 se o merge sair nesse dia, separando contato e lista de interesse: a lista pode cair com a Plataforma fora do menu, e isso não indica piora do contato.

## Rollback

Reverter o merge. Nenhuma mudança de dado, contrato ou infraestrutura.
