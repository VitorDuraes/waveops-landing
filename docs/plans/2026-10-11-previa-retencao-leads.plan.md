# Plano: prévia de retenção dos leads

Objetivo: permitir ao administrador conferir os prazos operacionais de 180 dias para contatos e 365 dias para interesses, usando o relógio do servidor e contagens de todos os cadastros, antes de decidir o expurgo.

Autorização: Vitor aprovou os prazos para a preparação local em 11/10/2026. H4 e ativação da exclusão permanecem pendentes. A spec detalhada fica em `docs/specs/2026-10-11-previa-retencao-leads.md`, fora do git.

## Arquivos e interfaces

| Arquivo | Responsabilidade |
|---|---|
| `portal/src/lib/leads-retencao.ts` | Prazos, limites UTC, DTO agregado e validação da resposta |
| `portal/tests/unit/leads-retencao.test.ts` | Fronteiras temporais, montagem das contagens e resposta inválida |
| `portal/src/server/leads-retencao.ts` | Autorização na DAL e contagens Prisma numa transação de leitura |
| `portal/src/app/api/leads/retencao/route.ts` | GET autenticado, respostas sem cache e erros sem detalhe pessoal |
| `portal/src/components/admin/RetencaoLeads.tsx` | Consulta sob demanda e prévia independente dos filtros da lista |
| `portal/src/app/(admin)/admin/leads/page.tsx` | Montagem do painel de retenção |
| `docs/integrations/portal-site-v2.md` e `CLAUDE.md` | Prazos operacionais aprovados e alcance da prévia |

DTO: `PreviaRetencaoLeads = { calculadaEm: string; tipos: FaixaRetencaoLead[] }`. Cada faixa contém `tipo`, `dias`, `criadosAte`, `total`, `noPrazo` e `prazoAtingido`. O cliente aceita exatamente um contato e um interesse, com contagens inteiras e coerentes. Campos pessoais não compõem a resposta.

Interfaces puras:

- `limitesRetencaoLeads(agora: Date): LimitesRetencaoLeads`.
- `montarPreviaRetencaoLeads(limites: LimitesRetencaoLeads, contagens: ContagensRetencaoLeads): PreviaRetencaoLeads`.
- `lerPreviaRetencaoLeads(valor: unknown): PreviaRetencaoLeads | null`.
- `executarPreviaRetencaoLeads(deps: DependenciasPreviaRetencao): Promise<ResultadoPreviaRetencao>`. Dependências: papel da sessão, relógio e porta de contagem. Nega papel diferente de administrador antes de consultar; ausência da porta significa banco indisponível.

## Sequência

1. Escrever os testes das fronteiras com resultados literais. Rodar `npx tsx --test tests/unit/leads-retencao.test.ts` e confirmar falha pela ausência da implementação.
2. Implementar os limites por milissegundos, validar instante e contagens, montar somente os campos do DTO. Reexecutar o teste até passar.
3. Implementar a DAL com sessão de administrador, falha explícita sem banco e quatro `count`, no mesmo snapshot `RepeatableRead`. Usar os filtros produzidos pela regra pura.
4. Expor o GET com guarda de sessão, sem parâmetros para relógio/prazo, `no-store` em todas as respostas e erro genérico. Não adicionar métodos de escrita.
5. Implementar o painel sob demanda, com cancelamento, carregamento, erro e nova tentativa. Toda nova consulta invalida o resultado anterior. Mostrar o alcance da prévia antes da decisão de remoção.
6. Atualizar a documentação: prazos aprovados para planejamento, leitura de contagens implementada, expurgo e H4 pendentes.
7. Verificar: testes unitários completos do portal, typecheck, build com banco desativado no processo, lint/parciais do site, secret scan e `git diff --check`. Conferir HTTP/autorização e interface em ambiente local sem apontar para produção.
8. Fazer revisão independente da branch e corrigir bloqueios. Pedir autorização para commit, push e PR somente com o resultado concreto verificado.

## Foco da revisão

- Inclusão no limite exato, 24 horas em UTC e 365 dias atravessando ano bissexto.
- Contagem de ambos os tipos e estados, inclusive além de 500, sem PII na projeção.
- Um relógio e um snapshot para evitar subconjunto maior que o total sob concorrência.
- Autorização de administrador na rota e na DAL; ausência de configuração não vira sucesso vazio.
- Resposta inválida, cancelamento, erro e recálculo sem exibir uma prévia antiga como atual.

Conclusão desta etapa: prévia funcional e verificável. A etapa de exclusão exige decisões próprias sobre exceções, bases, auditoria, backups e ativação, descritas na spec de retenção.

## Verificação realizada em 11/10/2026

- `npm.cmd run test:unit`, em `portal/`: 224 testes passaram, incluindo 39 da retenção. Limites exatos e datas inválidas foram conferidos com falha antes da implementação e sucesso após a correção.
- `npm.cmd run typecheck` e `npm.cmd run build`, em `portal/`: passaram. O build usou banco desativado no ambiente do processo e incluiu a nova rota dinâmica.
- PostgreSQL 16 local isolado com Prisma real: 2.006 cadastros fictícios, ambos os estados e aceites de marketing; limite exato e diferença de 1 milissegundo. Contagens corretas e registros preservados.
- Servidor Next compilado, somente em localhost: sem sessão 401, cliente 403, assinatura inválida 401 e admin 200; `no-store` em sucesso e erro. Parâmetros não alteraram relógio, prazo ou alcance. POST, DELETE e PATCH receberam 405. Banco ausente recebeu 503 e conexão indisponível recebeu 500 sem detalhe técnico.
- Prévia nativa do T3 em localhost: consulta real, independência dos filtros, descarte do resultado anterior, erro e nova tentativa, rejeição de resposta inválida e cancelamento após 12 segundos. Desktop de 1.280 px e celular de 390 px conferidos; tabela com rolagem interna no celular.
- Revisão independente da implementação: nenhum defeito concreto ou bloqueio encontrado.
- `node dev/site/build.mjs --check`, `node dev/site/lint.mjs` e `git diff --check`, na raiz: passaram; sete páginas conferidas pelo lint do site.

Resultado local. Publicação da branch exige autorização específica; esta evidência não ativa exclusão nem encerra H4.
