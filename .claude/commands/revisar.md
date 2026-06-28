---
description: Roda o portão de review WaveOps no diff atual antes do PR
argument-hint: (opcional) foco específico da revisão
---

Revise a mudança atual antes do PR. Foco: $ARGUMENTS

## Portão automático
Rode e relate o resultado:
- `npm run lint`
- `npm run build`
- `npm run test`

Se qualquer um falhar, pare e mostre a saída. Não aprove.

## Revisão manual (sobre o diff)
Cheque, citando `arquivo:linha`:

1. **Segurança:** segredo no diff? Autorização barrada na DAL antes de escrever? `DATABASE_URL`/`SESSION_SECRET` server-only? Query parametrizada?
2. **LGPD:** alguma PII nova exposta em API ou tela? Operação em massa com preview antes de gravar?
3. **Auditoria:** ação comercial relevante grava registro append-only?
4. **Correção:** regra de negócio centralizada em `lib`/`server`, não na tela? Job idempotente?
5. **Testes:** alvo de regra de negócio coberto? Happy path mais um caso de erro?
6. **Copy PT-BR:** texto ao usuário sem travessão, com acento, frase curta?
7. **Simplicidade:** dá para fazer menor? Dependência nova é justificada?

Entregue um veredito: aprovado, ou lista de bloqueios com `arquivo:linha` e correção sugerida.
