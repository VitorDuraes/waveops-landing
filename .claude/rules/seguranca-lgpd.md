# Rule: Segurança e LGPD (WaveOps)

Cada projeto vira responsabilidade recorrente na assinatura. Falha de segurança é custo nosso, não do cliente.

## Segredos

- Nada de segredo hardcoded em código, JSON, workflow ou commit. O hook `secret-scan` bloqueia Write com padrão de segredo.
- Segredo via variável de ambiente ou referência de credencial.
- `.env` sempre no `.gitignore`. `.mcp.json` contém token: tratar como secreto.
- `DATABASE_URL`, `SESSION_SECRET` e chave de API são server-only. Nunca `NEXT_PUBLIC_`.
- Bancos separados para dev e prod. Dev nunca aponta para banco de produção.

## Autorização

- Barrar autorização na DAL, no servidor. Checagem de rota é otimista, não é barreira.
- Server Action verifica usuário autenticado antes de qualquer escrita.
- Mapear visibilidade por papel (ex: member vê só o que é dele ou liberado).

## Injeção e entrada

- Query parametrizada sempre. Nunca concatenar input em SQL.
- Nunca concatenar input em shell. Usar array de argumentos.
- Validar e normalizar URL antes de fetch (SSRF).
- Validar todo input de borda com schema.

## LGPD (dado de lead e de cliente)

- Lead frio e dado de cliente são PII real. Base legal, opt-out e supressão de não-contatar são requisito.
- Não logar PII em texto cru em log de aplicação sem necessidade.
- Retenção e exclusão: prever caminho para apagar dado de titular quando exigido.
- Operação em massa (import, disparo) mostra preview antes de gravar.

## Antes do PR

- Rodar a checagem de segredo (o hook já cobre Write, mas conferir o diff).
- Revisar PII nova exposta em resposta de API ou tela.
- Confirmar que nenhuma credencial entrou no diff.
