# Plano: exceções de retenção dos leads

**Objetivo:** registrar revisões manuais de necessidade de conservação no admin e separá-las na prévia de contagens.

**Arquitetura:** regra pura com portas, DAL autenticada, tabela opcional 1:1 e atualização por versão com auditoria transacional. Consulta separada no detalhe do lead, sem ampliar o DTO da listagem.

**Stack:** Next.js 16, TypeScript, Prisma 6, PostgreSQL e node:test via tsx. Sem dependências novas.

**Spec:** `docs/specs/2026-10-11-excecoes-retencao-leads.md`, local e fora do git. Execução nesta sessão, com revisão independente da branch ao final.

## Restrições

- Preparação local autorizada por "continue". Vitor confirmou a janela operacional de 1 a 30 dias na pergunta desta sessão; publicação exige autorização própria.
- Somente administrador registra, revisa e encerra. Responsável e timestamps vêm do servidor.
- Justificativa: 20 a 500 caracteres Unicode, normalizada, sem controles; nunca em log ou auditoria.
- Nenhum prazo original, status, aceite, política pública, job ou exclusão automática muda nesta etapa.
- Nova migração somente em PostgreSQL local isolado. Produção exige pre-deploy de migrations e autorização.

## Interfaces

- `lerPedidoRetencao(corpo: unknown): LeituraPedidoRetencao`, ações `registrar`/`encerrar`, versão esperada e dias de revisão.
- `prepararAlteracaoRetencao(pedido: PedidoRetencao, agora: Date): ComandoRetencao`, datas UTC e limite máximo 30.
- `montarConsultaRetencao(registro: RegistroRetencao | null, agora: Date): ConsultaRetencao`, estado `vigente`/`vencida` e versão, com exceção nula quando encerrada.
- `lerConsultaRetencao(corpo: unknown): ConsultaRetencao | null`, DTO validado e sem campos extras.
- `executarConsultaRetencao(deps: DependenciasConsultaRetencao, id: string): Promise<ResultadoConsultaRetencao>`.
- `executarAlteracaoRetencao(deps: DependenciasAlteracaoRetencao, id: string, corpo: unknown): Promise<ResultadoAlteracaoRetencao>`.
- DAL: `consultarRetencaoLead(usuario, id)` e `alterarRetencaoLead(usuario, id, corpo)`.

## Tarefas

1. [x] TDD das regras em `portal/tests/unit/leads-excecoes.test.ts`; implementar `portal/src/lib/leads-excecoes.ts`. Assertivas literais: registro de 30 dias a partir de `2026-10-11T04:17:52.123Z` vence em `2026-11-10T04:17:52.123Z`; 31 dias é inválido; revisão no limite exato é vencida; cliente nunca chama a porta.
2. [x] Criar `LeadRetencao` em `portal/prisma/schema.prisma` e migration `20261011060000_leads_retencao`. PK/FK com cascata, versão não negativa, metadados todos nulos ou todos completos, janela UTC positiva e até 30 dias, justificativa 20 a 500. Gerar o Prisma localmente.
3. [x] Implementar `portal/src/server/leads-excecoes.ts` e `portal/src/app/api/leads/[id]/retencao/route.ts`: papéis, JSON, códigos, cache, versão, transação e erro sem conteúdo sensível. Conflito não sobrescreve e erro de auditoria reverte a decisão.
4. [x] Ampliar TDD da prévia em `portal/tests/unit/leads-retencao.test.ts`; modificar regra, DAL e painel correspondentes. Faixas vigentes/vencidas só entre leads com prazo atingido; soma com sem exceção igual ao prazo atingido. Oito contagens no mesmo snapshot, sem teto de 500.
5. [x] Criar `portal/src/components/admin/ExcecaoRetencaoLead.tsx` e montar em `LeadModal.tsx`. Consulta, registro, encerramento, validação da resposta, conflito e timeout com recarga obrigatória quando o resultado da escrita é desconhecido.
6. [x] Conferir migrations e comportamento em PostgreSQL isolado e HTTP local real: fronteiras, ambos os tipos/estados, concorrência, cascata e rollback. Usar só dados fictícios.
7. [x] Atualizar `CLAUDE.md`, `README.md` e `docs/integrations/portal-site-v2.md` com alcance, janela confirmada, dados novos, auditoria e H4 pendente. Conferir desktop/celular pela prévia nativa do T3 local.
8. [x] Rodar `npm.cmd run test:unit`, `npm.cmd run typecheck`, `npm.cmd run build` em `portal/`; `node dev/site/build.mjs --check`, `node dev/site/lint.mjs`, secret scan e `git diff --check` na raiz. Revisão independente e correção dos bloqueios. Encerrar recursos locais.
9. [x] Autorização própria do Vitor recebida para commit, push da branch e abertura do PR.
10. [ ] Conferir pre-deploy e autorizar a migration de produção antes da publicação do código. Nenhum expurgo nesta etapa.

## Foco da revisão

- Dois admins usam a mesma versão: uma decisão e uma auditoria; o outro recebe 409.
- Encerrar e registrar novamente preserva a versão; pedido antigo não passa por estado vazio.
- O horário da revisão passa durante a consulta: clock único e comparação inclusiva, sem data do navegador.
- Banco, migration ou auditoria indisponível: erro explícito, sem falsa ausência de exceção.
- Timeout ou navegação durante POST: confirmar por recarga; não afirmar cancelamento de uma escrita recebida.

## Verificação local, 11/10/2026

- `npm.cmd run test:unit`: 274 passaram, zero falhas. Nova regra com 39 testes; prévia com 50.
- `npm.cmd run test:integration:leads`: 9 passaram no PostgreSQL 16 isolado, com as seis migrations aplicadas. Concorrência, preservação do lead, versões após encerramento, rollback de auditoria, restrições, cascata e prévia de 1.208 leads fictícios.
- HTTP do build real: 401/403, JSON 415/400, 404, conflito 409, `no-store`, relógio e responsável do servidor, 500 com rollback, 503 sem banco e migration ausente. Prévia indisponível não vira zero.
- Prévia nativa T3 local: desktop 1.280 px e celular 390 px; registro, atualização, encerramento, revisão vencida, 409, erro de transporte e timeout de 12 segundos depois da escrita real. Escrita bloqueada até recarga; resposta atrasada não produz sucesso. Sem overflow da página, tabelas com rolagem interna.
- Revisão independente aprovada, com 89 testes puros reexecutados. Corrigidos dois pontos menores: erro de transporte em PT-BR com resultado incerto explícito e horário da consulta junto ao estado.
- Build e typecheck finais passaram. Site: build em dia e lint das sete páginas com zero erros. Secret scan: 19 arquivos sem detecção; calibração sintética bloqueada. Diff sem erro de whitespace.
- Servidor local e container temporário encerrados. Ao concluir a preparação, nenhuma alteração em produção ou no checkout principal e nenhum commit/push/PR novo. Aviso existente de configuração legada do Prisma não foi alterado.

## Retomada

Worktree: `.claude/worktrees/feat+site-institucional-v2`, branch `feat/leads-excecoes-retencao`, base `7a1404db7d5709fe531a95c558fa097c78f97f32`. A preparação foi salva em disco antes do desligamento solicitado. Na retomada, Vitor autorizou commit, push e PR; os 274 testes unitários e o typecheck passaram novamente. A branch herdou tracking de `origin/main`; publicar explicitamente o nome da branch. O checkout principal contém alterações do Vitor, preservadas.
