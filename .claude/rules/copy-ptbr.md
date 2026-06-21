# Rule: Copy PT-BR (qualquer texto que o cliente ou o usuário final lê)

Vale para template de mensagem, copy de tela, e-mail, notificação e relatório.

## Hard

1. Nunca usar travessão (em dash ou en dash). Usar ponto, vírgula ou dois-pontos.
2. Acentuação correta e obrigatória. "Ativação", não "ativacao". "É" verbo, "e" conjunção.
3. Frases curtas. Sem metáfora vaga, sem enchimento motivacional, sem pitch exagerado.
4. Verbo de ação. "Reduza a taxa", não "você pode talvez considerar reduzir".
5. Dado no começo ou no fim do parágrafo, nunca no meio.
6. Sem emoji em saída profissional, salvo pedido explícito.

## Humanizar antes de entregar

Remover padrão de IA: importância inflada, hedge, floreio, linguagem promocional, frase de transição vazia. O texto deve soar como pessoa que sabe do assunto, não como gerador.

## WhatsApp e template

- Mensagem de prospecção e de operação é direta e objetiva.
- Variável de template (`{{nome}}`) tem fallback definido para não sair vazia.
- Antes de montar link `wa.me`, fazer `encodeURIComponent` no texto.
- Tom próximo, rápido, orientado a solução.

## Checagem rápida

- Tem travessão? Remover.
- Tem acento faltando? Corrigir.
- Tem frase longa que dá para cortar? Cortar.
- Tem dado no meio do parágrafo? Mover para começo ou fim.
