# Rule: Next.js 16 + Drizzle (stack padrão WaveOps)

Aplicar em todo código da stack default. Desvio precisa de registro no `CLAUDE.md` do projeto.

## Next.js 16 (App Router)

- Esta versão tem breaking changes. Antes de mexer em API de framework, ler o guia em `node_modules/next/dist/docs/`.
- `middleware` foi renomeado para `proxy.ts`. A checagem em `proxy.ts` é otimista, não é barreira de segurança.
- Backend mora em Server Actions e Route Handlers, não em serviço separado.
- Server Component por padrão. `"use client"` só quando precisar de estado ou evento de browser.
- Segredo nunca vai para Client Component. Nada de `NEXT_PUBLIC_` em chave sensível.

## Server Actions

- Toda action que escreve chama `requireUser()` ou `requireAdmin()` antes de qualquer efeito.
- Validar input com schema (zod ou validador próprio) na entrada da action.
- Revalidar cache com `revalidatePath`/`revalidateTag` após escrita.
- Ação comercial relevante grava registro de auditoria append-only.

## Drizzle + PostgreSQL

- Schema em `src/db/schema.ts`. Migration versionada via `npm run db:generate` e `npm run db:migrate`. Nunca editar migration aplicada à mão.
- Cliente de DB carrega `import "server-only"`. `DATABASE_URL` é server-only.
- Query parametrizada sempre. Drizzle já parametriza. Nunca montar SQL por concatenação de string.
- Invariante de unicidade (ex: telefone normalizado) declarada no schema, não só na aplicação.
- Job de import, sync e geração de fila é idempotente. Reexecutar não duplica.

## Testes (Vitest)

- Alvo natural: função pura de `lib/` e use case. Testar primeiro (red), depois implementar (green).
- Cobertura mínima 80% nas regras de negócio. Happy path mais um caso de erro.
- Portão de aceite antes do PR: `npm run lint`, `npm run build`, `npm run test` verdes.

## Estrutura de pastas (referência)

```
src/
  app/             rotas e telas (App Router)
  components/      ui + componentes por domínio
  lib/             auth, validators, helpers puros (alvo de teste)
  server/actions/  *.actions.ts (Server Actions)
  types/           tipos de domínio
  db/              schema.ts, client.ts, seed.ts, migrations/
  proxy.ts         proteção otimista de rota (ex-middleware)
```

Regra de negócio fica centralizada em `lib/` e `server/`, fora das telas.
