# Plano: medição própria de funil (SPEC-18)

Spec: `docs/specs/18-funil-medicao-propria.md` (local, fora do repo público).
Branch: `feat/funil-medicao`, aberta de `origin/main` (4f72702).

## Restrições desta máquina

- Docker não está rodando, e o `DATABASE_URL` do `.env` aponta para `127.0.0.1:55432` (Postgres
  local do compose). Então **não dá para rodar `prisma migrate dev`** aqui.
- Contorno: gerar o SQL da migration com `prisma migrate diff` entre dois arquivos de schema,
  que não toca em banco nenhum, e escrever a pasta da migration à mão. O `prisma migrate deploy`
  do Railway aplica no deploy, como já faz hoje.
- O portal não tem runner de teste unitário, só Playwright. As funções puras novas ganham teste
  com `node:test` rodado por `tsx`, que já está nas dependências. Nenhuma dependência nova.

## To-dos

1. **Schema e migration.** `Evento` e `Customer.visitorId` em `portal/prisma/schema.prisma`.
   Gerar `prisma/migrations/<ts>_eventos/migration.sql` via `migrate diff`. Rodar `prisma generate`.
   Validação: `npx prisma validate` e `npm run db:generate` passam.

2. **Id do visitante.** `portal/src/server/visitante.ts`, com `idDoVisitante(headers, agora)`.
   Hash `sha256(dia + SESSION_SECRET + ip + user-agent)`, truncado em 32 hex.
   Validação: teste `node:test` cobrindo id igual no mesmo dia, id diferente no dia seguinte,
   id diferente para user-agent diferente.

3. **Sanitização do evento.** `portal/src/server/evento.ts`, função pura `normalizarEvento(bruto)`:
   lista fechada de nomes, no máximo 5 props, corte em 64, `u` em 128, `r` só host em 64.
   Validação: teste `node:test` com nome fora da lista, prop a mais, string longa, tipo errado.

4. **Endpoint.** `portal/src/app/api/e/route.ts`. Corpo acima de 2 KB descartado, `Origin`
   conferido, rate limit `evento:ip:<ip>` 60/min, grava e responde 204 sempre. `OPTIONS` também.
   Validação: `curl` local depois do build, e os critérios de aceite da spec.

5. **Beacon da landing.** `assets/funil.js` com `window.WaveFunil.enviar()`. `sendBeacon` com
   fallback `fetch keepalive`, tudo em `try/catch`.
   Validação: `gzip -9` abaixo de 1 KB.

6. **Landing: trocar o Plausible pelo beacon.** Tag em `index.html`, CSP (tira `plausible.io`,
   põe `portal.waveops.com.br` em `connect-src`), apagar `assets/analytics.js`, apontar o
   `track()` do `main.js` para o beacon, somar `visita` e `seccao_precos`.
   Validação: `grep -c plausible index.html` igual a 0.

7. **Instrumentação do portal.** `checkout_aberto` na página de checkout, `checkout_enviado` e
   gravação de `visitorId` na rota de checkout, `pagamento_confirmado` no `onboarding.ts`,
   `ativacao` na rota que define a senha.

8. **Página do funil.** `portal/src/server/funil.ts` com a consulta agregada e
   `portal/src/app/(admin)/admin/funil/page.tsx` com a tabela. Link no menu do admin.

9. **Retenção e privacidade.** Expurgo de evento com mais de 180 dias no `jobs.ts`. Parágrafo
   novo em `/privacidade`.

10. **Documentação.** `CLAUDE.md` da raiz: a seção de ordem de scripts e o inventário de peso
    do JavaScript mudam (sai `analytics.js`, entra `funil.js`).

## Portão de aceite antes do PR

```
cd portal && npm run lint && npm run typecheck && npm run build && npm run test:unit
```

Mais os critérios de aceite da SPEC-18 que não dependem de banco em pé. O que depender de
Postgres real fica declarado como não verificado nesta máquina.
