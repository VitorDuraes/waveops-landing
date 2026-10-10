# Plano: leads do site no banco do portal

Spec: `docs/specs/2026-10-10-leads-no-portal.md` (local, fora do repo público).
Branch do portal: `feat/portal-leads`, aberta de `origin/main` (`2eb35bd`). Branch do site: `feat/site-leads-portal`, depois.

Decisão do Vitor em 10/10/2026: os formulários do site novo gravam no Postgres do portal, não em planilha e Gmail via n8n. A WaveOps não tem caixa de e-mail no domínio e não quer manter planilha; o portal já tem banco, admin, funil e aviso no Discord.

## Decisões

| Tema | Decisão |
|---|---|
| Rotas públicas | `POST /api/site/contato` e `POST /api/site/interesse`, com `OPTIONS`. Separadas das rotas do admin (`/api/leads`) para não misturar público e autenticado no mesmo arquivo |
| Contrato | O que o site já manda e lê, sem mudança (`docs/integrations/n8n-site-v2.md`, seção 3; `assets/site/lib/payload.js` e `enviar.js` são a fonte). Resposta `{ok, protocolo}` ou `{ok:false, erro, campos}`, nunca o `{error}` do `server/http.ts` |
| CORS | Origem obrigatória e só `https://waveops.com.br` e `https://www.waveops.com.br` (sem `origemDoEvento`, que aceita origem ausente). Cabeçalho CORS em toda resposta de origem permitida, inclusive 422, 429 e 503 |
| Validação | Função pura em `portal/src/lib/leads.ts`, testada com `tsx`. Predicados iguais aos de `assets/site/lib/validacao.js`, presos por teste de paridade que importa o arquivo do site por caminho calculado (import literal quebraria o `next build` do Railway, que não tem a raiz do repo) |
| Idempotência | `id_envio` único e `createMany({ skipDuplicates: true })`: repetição devolve o mesmo 200 sem linha nova nem aviso |
| Robô | Isca `website` preenchida ou `preenchidoEmMs` abaixo de 1200: 200 sem gravar, antes da validação. Sem filtro por user-agent: navegador de app embutido poderia ser descartado |
| Volume | Por IP, em memória: 5 por minuto e 20 por hora em cada rota. Sem teto global, que viraria alavanca para bloquear lead legítimo |
| Dados | Tabela `leads` única, com `tipo` (`contato` ou `interesse`) e `status` (`novo` ou `atendido`). IP não é gravado. `visitor_id` é o hash diário do funil |
| Auditoria | Tabela `auditoria`, append-only e sem dado pessoal: `lead.atendido`, `lead.reaberto`, `lead.apagado` |
| Discord | Sem dado pessoal, com o link do admin, no máximo 10 por hora |
| Retenção | INDEFINIDA, decisão do Vitor com a revisão jurídica (gate H4) |

## Grafo de tarefas

```
A descoberta (feita) ──> B spec e plano (este arquivo)
                           │
                           C schema e migration
                           │
              ┌────────────┴────────────┐
              D validação pura e testes  F admin (API, tela, menu)   paralelo, arquivos separados
              │                          │
              E rotas públicas e aviso   │
              └────────────┬────────────┘
                           G integração
                           H revisão adversarial (contexto separado)
                           I verificação com Postgres local e PR do portal
                           J PR do site (depois do deploy do portal)
```

## To-dos

1. **C. Schema e migration.** `Lead`, `Auditoria` e os enums `LeadTipo` e `LeadStatus` em `portal/prisma/schema.prisma`. SQL gerado com `prisma migrate diff` entre o schema anterior e o novo, na pasta `prisma/migrations/20261010200000_leads/`.
   Validação: `npx prisma validate`, `npm run db:generate` e `npm run typecheck`.

2. **D. Validação pura.** `portal/src/lib/leads.ts`: `ehRoboDeFormulario`, `validarContato`, `validarInteresse`, `validarEmail` e `normalizarTelefone` portados do site, corte e limpeza dos textos.
   Validação: `portal/tests/unit/leads.test.ts` vermelho antes, verde depois; paridade com o site em milhares de casos de semente fixa; corpos montados pelo `payload.js` do site passam.

3. **E. Rotas públicas.** `portal/src/app/api/site/contato/route.ts`, `.../interesse/route.ts` e `portal/src/server/leads.ts` (gravação idempotente, regra de repetição da lista, aviso no Discord).
   Validação: chamadas reais contra o portal local com Postgres, cobrindo os critérios 1 a 7 da spec.

4. **F. Admin.** `GET /api/leads`, `POST /api/leads/[id]/status`, `DELETE /api/leads/[id]` com `guard(["admin"])` e linha em `auditoria`; tela `/admin/leads` no padrão de Clientes; item "Leads" no menu; selos `novo` e `atendido`.
   Validação: typecheck, build e chamadas reais (lista, atendido, reabrir, apagar; 401 sem sessão com `AUTH_ENFORCED=true`).

5. **G a I. Integração, revisão e verificação.** Juntar F, revisão em contexto separado, `npm run typecheck`, `npm run test:unit`, `npm run build`, migration aplicada num Postgres local vazio.

6. **J. Site.** `assets/site/config.js` aponta para `https://portal.waveops.com.br/api/site/contato` e `.../interesse`; CSP `connect-src` fica só com `'self'` e o portal; `tests/site/unit/envio.test.mjs` atualizado; `CLAUDE.md` e o guia do n8n registram a troca.
   Validação: typecheck, testes unitários, lint, `build.mjs --check` e Playwright do site.

## Ordem de publicação

1. Merge do PR do portal. O Railway aplica a migration no pre-deploy (`npm run db:deploy`) antes de subir o container.
2. Conferir em produção, só com leitura: `OPTIONS` das duas rotas com `Origin: https://waveops.com.br` responde 204 com CORS, e a tela `/admin/leads` abre vazia.
3. Merge do PR do site. Ele só envia lead quando o site novo for publicado (gates H4 e H5); até lá, o site antigo segue no `flowops-lead`.

Rollback: as rotas novas podem ficar no ar sem tráfego. Se a migration falhar no pre-deploy, o Railway mantém o container anterior.
