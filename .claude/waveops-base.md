# CLAUDE.base.md (Padrão WaveOps)

Base compartilhada para todo projeto da WaveOps com Claude Code. Cada projeto carrega seu próprio `CLAUDE.md` em cima desta base. Importe esta base no topo do `CLAUDE.md` do projeto:

```md
@.claude/waveops-base.md
```

A base define o padrão. O `CLAUDE.md` do projeto define o que é específico dele (domínio, tabelas, telas, regras de negócio). Quando houver conflito, o arquivo do projeto vence, e o ponto de divergência deve ser documentado lá.

---

## WaveOps: quem somos

WaveOps entrega automação, integração de sistemas e IA supervisionada para a operação de quem vende. Quatro frentes:

1. Automação de processos: tarefas repetitivas (gestão de leads, follow-up, cobrança).
2. Integração de sistemas: conectar WhatsApp, CRM, pagamento e APIs em tempo real.
3. Sistemas e dashboards sob medida: substituir planilha por plataforma web.
4. Agentes de IA supervisionados: tarefas específicas com humano no controle.

Modelo: assinatura mensal que inclui hospedagem, monitoramento, correção de bug e melhoria contínua. Promessa: o cliente ganha tempo, erra menos e tira processo das costas do time.

**Consequência para a engenharia:** cada entrega vira responsabilidade recorrente. Código frágil não é dívida do cliente, é custo nosso todo mês. Confiabilidade e baixo custo de manutenção são requisitos, não luxo.

---

## Stack padrão WaveOps

Default para projeto novo, salvo decisão documentada no `CLAUDE.md` do projeto:

- **Next.js 16 (App Router) + TypeScript strict**, monólito. Backend em Server Actions e Route Handlers, sem serviço separado.
- **PostgreSQL em Docker** (dev e prod) via **Drizzle ORM**. Migrations versionadas em `src/db/migrations`.
- **Auth de sessão própria:** cookie httpOnly assinado (JWT HS256 via `jose`) + senha `bcryptjs`. Autorização barrada na DAL, não no cliente.
- **Tailwind** para UI.
- **Vitest** para testes.
- **npm** como gerenciador (lock: `package-lock.json`).
- Produção em Docker (`docker-compose.yml`, ordem `db → migrate → web`).

Desvio de stack é permitido, mas exige uma linha no `CLAUDE.md` do projeto explicando o porquê. Nunca trocar de stack no meio de um projeto sem registrar a decisão.

> Atenção Next.js 16: APIs e estrutura mudaram em relação ao que o modelo aprendeu. `middleware` virou `proxy.ts`. Antes de escrever código de framework, leia o guia em `node_modules/next/dist/docs/`. Respeite os avisos de deprecação.

---

## Workflow de entrega (RPI + portões)

Toda mudança não trivial segue a sequência. Os comandos automatizam cada passo.

```
Spec  →  Plan  →  TDD (red → green)  →  Implement  →  Review  →  Security/LGPD  →  PR
/spec            /entregar orquestra o ciclo            /revisar    secret-scan (hook)
```

1. **Spec primeiro.** Feature, integração ou mudança de schema começa em `docs/specs/AAAA-MM-DD-<tema>.md`. Status por item: `DEFINIDO`, `INDEFINIDO`, `FORA DE ESCOPO`. Nunca pular Research e ir direto para Implement.
2. **Plan.** Plano em `docs/plans/<card>_<slug>.plan.md` com To-dos numerados e comandos de validação.
3. **TDD.** Teste primeiro nos alvos naturais (funções puras de `lib/`, use cases). Red, depois green. Cobertura mínima 80% nas regras de negócio.
4. **Implement.** Menor mudança possível. YAGNI. Regra de negócio fica centralizada em `lib/` e `server/`, fora das telas.
5. **Review.** `/revisar` roda antes de abrir PR. Portão de aceite: `npm run lint`, `npm run build`, `npm run test` passando.
6. **Security/LGPD.** O hook `secret-scan` bloqueia segredo em Write. Revisar PII e base legal antes de qualquer fluxo com dado de cliente.
7. **PR.** Sem commit direto na `main`.

---

## Regras de engenharia (HARD)

| Regra | Por quê |
|---|---|
| **Segredo é server-only** | `DATABASE_URL`, `SESSION_SECRET` e chaves de API nunca usam `NEXT_PUBLIC`, nunca chegam ao cliente. Arquivos de DB e auth carregam `import "server-only"`. |
| **Autorização na DAL** | Server Action verifica `requireUser()`/`requireAdmin()` antes de qualquer escrita. Não confiar em checagem de rota como barreira real. |
| **Log de auditoria** | Toda ação comercial relevante (mudança de status, envio, criação, edição) grava um registro append-only. O dashboard lê isso. |
| **Jobs idempotentes** | Geração de fila, sync e import são seguros para reexecutar. Sem efeito duplicado. |
| **Nada de injeção** | Query parametrizada sempre. Nunca concatenar input em SQL ou shell. Validar URL em fetch (SSRF). |
| **`.env` no `.gitignore`** | Nenhum `.env` entra no repo. Credencial referenciada, nunca hardcoded. |
| **PR-only** | Sem commit direto na `main`. Uma branch por card (`feat/<n>-...`, `fix/...`, `chore/...`). Squash no merge. `main` sempre verde. Vitor faz o merge. |
| **Preview antes de escrever** | Import e operação em massa mostram preview (válido/duplicado/inválido) antes de gravar. |
| **Tipos explícitos** | TypeScript strict, zero `any`. |

---

## Segurança e LGPD

- Tratar dado de lead e de cliente como PII real. Base legal, opt-out e supressão de não-contatar são requisito, não detalhe.
- Antes de commit, escanear padrões de segredo: `pk_`, `sk-`, `sk-ant-`, `xoxb-`, `ghp_`, `apify_api_`, `eyJ` (JWT), `AKIA` (AWS). O hook `secret-scan` faz isso automaticamente e bloqueia o Write.
- `.mcp.json` contém token. Tratar como secreto.
- Bancos separados para dev e prod. Nunca apontar dev para o banco de produção.
- Detalhes em `.claude/rules/seguranca-lgpd.md`.

---

## Token é COGS

Na assinatura WaveOps, hora de modelo é custo direto de entrega. Eficiência protege margem.

- Edição cirúrgica em vez de reescrever arquivo inteiro.
- Delegar pesquisa e análise paralela a subagents, manter o contexto principal limpo.
- Rodar job longo em background.
- Buscar template (n8n, componente, copy) antes de construir do zero.
- Não reler arquivo recém-editado só para conferir.

---

## Escrita PT-BR (HARD, qualquer texto que o cliente lê)

Template de mensagem, copy de tela, e-mail e relatório seguem:

1. Nunca usar travessão (em dash ou en dash). Usar ponto, vírgula ou dois-pontos.
2. Acentuação correta e obrigatória.
3. Frases curtas. Sem metáfora vaga, sem enchimento motivacional.
4. Verbo de ação. Dado no começo ou no fim do parágrafo, nunca no meio.
5. Sem emoji em saída profissional, salvo pedido explícito.
6. Remover padrão de IA antes de entregar: importância inflada, hedge, floreio.

Detalhes em `.claude/rules/copy-ptbr.md`.

---

## Anti-padrões (NUNCA)

- Travessão ou acento faltando em PT-BR.
- Segredo hardcoded em código, JSON ou commit.
- Push direto na `main`. `git push --force` em branch compartilhada. `git reset --hard` sem confirmação.
- Concatenar input em SQL ou shell.
- Escrever código antes do teste existir nos alvos de regra de negócio.
- Pular Spec e ir direto para Implement.
- Trocar de stack sem registrar a decisão no `CLAUDE.md` do projeto.
- Adicionar dependência pesada para resolver problema pequeno.
- Recomendar feature ou flag de memória sem verificar que ainda existe.

---

**Palavra final.** Engenharia séria. Entrega que aguenta assinatura. Voz WaveOps. Sem atalho.
