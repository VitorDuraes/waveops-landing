---
description: Orquestra o ciclo de entrega WaveOps (spec, plan, TDD, implement, review, PR) para uma tarefa
argument-hint: <descrição da tarefa ou número do card>
---

Você vai conduzir a entrega de: **$ARGUMENTS**

Siga o workflow padrão WaveOps. Não pule etapa. Pare e peça decisão quando algo estiver `INDEFINIDO`.

## 1. Spec
- Se a tarefa for trivial (correção pontual, ajuste de copy), pule para o passo 3.
- Caso contrário, leia o spec existente do projeto. Se faltar definição, crie ou atualize `docs/specs/AAAA-MM-DD-<tema>.md` com itens marcados `DEFINIDO`, `INDEFINIDO`, `FORA DE ESCOPO`.
- Não invente requisito. O que estiver `INDEFINIDO` vira pergunta ao usuário.

## 2. Plan
- Escreva `docs/plans/<card>_<slug>.plan.md` com To-dos numerados e comandos de validação por etapa.
- Liste os arquivos que serão tocados e o risco de cada um.

## 3. TDD
- Escreva o teste primeiro nos alvos de regra de negócio (funções puras de `lib/`, use cases). Veja o teste falhar (red).
- Implemente o mínimo para passar (green). Sem código a mais.

## 4. Implement
- Menor mudança possível. Regra de negócio em `lib/` e `server/`, fora das telas.
- Respeite as rules: `.claude/rules/nextjs-drizzle.md`, `.claude/rules/seguranca-lgpd.md`, `.claude/rules/copy-ptbr.md`.
- Segredo nunca entra no código. O hook `secret-scan` vai bloquear se entrar.

## 5. Review
- Rode `/revisar`. Portão de aceite: `npm run lint`, `npm run build`, `npm run test` verdes.
- Confirme: autorização na DAL, log de auditoria em ação comercial, sem PII vazada, sem segredo no diff.

## 6. PR
- Crie a branch do card (`feat/<n>-...`, `fix/...`, `chore/...`). Sem commit direto na `main`.
- Abra o PR com resumo, o que foi testado e link do spec/plan. O merge é do Vitor.

Ao final, entregue um resumo curto: o que foi feito, o que foi testado, o que ficou pendente.
