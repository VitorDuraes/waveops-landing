---
description: Cria ou atualiza um spec WaveOps em docs/specs antes de planejar ou codar
argument-hint: <tema ou feature>
---

Produza o spec de: **$ARGUMENTS**

Antes de qualquer código. Não pule Research.

1. Leia o que já existe: `CLAUDE.md` do projeto, specs anteriores em `docs/specs/`, código relacionado. Para integração externa (WhatsApp, CRM, pagamento, API), antes de definir contrato, pesquise a doc oficial ou delegue ao agent `integration-researcher`.
2. Escreva `docs/specs/AAAA-MM-DD-<tema>.md` com:
   - **Contexto:** o problema e por que agora.
   - **Objetivo:** resultado esperado, mensurável quando possível.
   - **Escopo:** itens marcados `DEFINIDO`, `INDEFINIDO`, `FORA DE ESCOPO`.
   - **Requisitos técnicos:** stack, dados, integrações, restrições.
   - **Critérios de aceite:** lista verificável.
   - **Riscos e decisões em aberto.**
3. Tudo que estiver `INDEFINIDO` vira pergunta objetiva ao usuário. Não preencha com suposição.

Entregue o caminho do arquivo e a lista de pontos `INDEFINIDO` que precisam de decisão.
