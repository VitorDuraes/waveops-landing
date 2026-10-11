# Formulários do site no portal: mapa de dados e operação

| Campo | Valor |
|---|---|
| Atualizado em | 11/10/2026 |
| Escopo | Contato do site e lista de interesse da Plataforma |
| Responsável pela operação | Vitor Duraes, WaveOps |
| Estado | Fluxo em produção. Mapa conferido no código. Retenção proposta, ainda sem aprovação e sem expurgo de leads |
| Revisão de privacidade | Gate H4: bases legais, prazos, operadores, transferências e atendimento ao titular |

Este é o guia atual dos dois formulários. O [guia de n8n](n8n-site-v2.md) e os workflows JSON são históricos: planilha, execuções do n8n e avisos pelo Gmail não fazem parte deste fluxo. Dados que já existam nesses sistemas continuam exigindo inventário e atendimento separados.

## 1. Fluxo atual

| Etapa | Comportamento | Fonte |
|---|---|---|
| Site no Netlify | Contato em `/contato/` e interesse em `/plataforma/` enviam diretamente ao portal, por HTTPS | [Configuração](../../assets/site/config.js) |
| Entrada no portal | `POST /api/site/contato` e `POST /api/site/interesse`, com validação, CORS e defesas de volume | [Recepção](../../portal/src/lib/receber-formulario.ts), [validação](../../portal/src/lib/leads.ts) |
| Persistência no Railway | Uma linha na tabela Postgres `leads` para cada novo `idEnvio` válido | [Gravação](../../portal/src/server/leads.ts), [schema](../../portal/prisma/schema.prisma) |
| Operação | Administrador autenticado consulta os dados, marca atendimento, reabre ou apaga em `/admin/leads` | [Admin](../../portal/src/app/(admin)/admin/leads/page.tsx), [serviço](../../portal/src/server/leads-admin.ts) |
| Aviso ao time | Se o webhook estiver configurado, Discord recebe tipo do formulário, canal de retorno e link genérico do admin. Não recebe nome, e-mail, telefone nem mensagem do lead | [Avisos](../../portal/src/server/leads.ts), [integração](../../portal/src/server/integrations.ts) |

Envio válido recebe HTTP 200 depois da gravação ou do reconhecimento de um `idEnvio` já gravado. A primeira gravação desse identificador vence. Um novo identificador com o mesmo e-mail gera outra linha: não há deduplicação por e-mail nem atualização automática de consentimento de registros anteriores.

A resposta de robô é HTTP 200 sem gravar. Portanto, HTTP 200 isolado não comprova persistência; a verificação de um envio válido inclui localizar a linha no admin. Falha de banco em produção retorna 503; falha no aviso não desfaz a gravação. O protocolo apresentado ao site é o `idEnvio`.

`localhost` usa simulação local. Deploy Preview do Netlify fica desligado para envios. Os novos formulários não chamam n8n, Google Sheets, Gmail, Resend nem Twenty para armazenar, confirmar ou sincronizar o lead. Resend e Twenty têm outros usos no portal, fora desta operação.

## 2. Dados persistidos em `leads`

Os nomes abaixo são os campos Prisma; o schema define os nomes das colunas Postgres.

| Grupo | Campos | Finalidade operacional |
|---|---|---|
| Identificação do envio | `id`, `idEnvio`, `tipo` | Distinguir contato de interesse e impedir repetição do mesmo envio |
| Contato solicitado | `nome`, `empresa`, `email`, `telefone`, `canalRetorno`, `melhorHorario` | Responder pelo canal escolhido. Telefone só com dígitos, sem o prefixo brasileiro 55; e-mail em minúsculas |
| Pedido | `procura`, `dor`, `mensagem`, `finalidade` | Entender o pedido. Interesse usa `finalidade = aviso_abertura_plataforma` e não guarda os campos livres do contato |
| Ciência e marketing | `politicaVersao`, `cienciaTextoVersao`, `marketingAceito`, `marketingTextoVersao` | Registrar as versões recebidas e a escolha enviada. Não comprova identidade nem confirmação do e-mail |
| Atribuição | `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `referrer`, `landingUrl`, `primeiraFonte`, `pagina` | Identificar página e origem do envio |
| Identificador de navegação | `visitorId` | Vincular o envio à medição de funil do dia. É pseudônimo, tratado como dado pessoal neste mapa |
| Tempos | `createdAt`, `enviadoEm`, `preenchidoEmMs`, `atendidoEm` | `createdAt` é a hora oficial do servidor. `enviadoEm` e duração vêm do navegador; `atendidoEm` registra a marcação no admin |
| Atendimento | `status` | Apenas `novo` ou `atendido`. Não representa encerramento de negociação nem revogação de marketing |

`politicaCiente` e `politicaCienteEm` são validados na entrada, mas não são colunas da tabela. Não há data própria de confirmação do e-mail, revogação, último contato, aviso de abertura, expiração ou exceção de retenção. A versão enviada pelo navegador não substitui a preservação do texto correspondente nem uma confirmação de identidade.

As versões atuais em [config.js](../../assets/site/config.js) são `rascunho-2026-10-10`, `contato-ciencia-v1`, `interesse-ciencia-v1`, `contato-marketing-v1` e `interesse-marketing-v1`. Esta documentação não muda esses valores nem publica uma nova política.

O servidor remove query string e fragmento de `landingUrl` e `referrer` antes de gravar. UTMs, caminhos e texto livre ainda exigem cuidado: não incluir identificadores pessoais em campanhas ou URLs e não solicitar dados sensíveis na mensagem.

## 3. Onde os dados ficam e por quanto tempo

| Local | Dados e acesso | Retenção atual | Exclusão e limite |
|---|---|---|---|
| Navegador, `sessionStorage` | Primeiro toque em `waveops:origem:v1`: fonte, UTMs, URL de entrada e referrer. A URL local ainda inclui parâmetros | Sessão do navegador; o aplicativo não define prazo em dias | Limpar o armazenamento do site no navegador. Apagar o lead no portal não limpa este registro local |
| Railway, tabela `leads` | Dados da seção 2; admin autenticado e acesso técnico ao banco | Sem prazo automático implementado | Exclusão individual ou por titular no admin. Proposta: contato 180 dias, interesse 365 dias; ver seção 7 |
| Railway, tabela `auditoria` | Ação, ID do alvo, data, e-mail do administrador em `por`; detalhes com tipo/data ou quantidade/tipos | Sem expurgo implementado; prazo a definir na revisão | A exclusão do lead preserva a auditoria. Não há nome, contato nem mensagem do lead no detalhe, mas o registro não é anônimo |
| Railway, tabela `eventos` | Eventos de navegação com `visitorId`, caminho e origem; pseudônimos relacionáveis a leads ou clientes | Código de expurgo de eventos com mais de 180 dias | `jobs.ts` contém a rotina. Execução e agendamento em produção não foram conferidos nesta revisão. Apagar um lead não apaga eventos |
| Memória do processo do portal | IP nas chaves do limitador e horários de tentativas; IP e user-agent também entram no cálculo do pseudônimo diário | Chaves expurgadas conforme a própria janela, durante chamadas ao limitador; reinício limpa a memória | Sem tabela de IP ou user-agent criada pelo fluxo de leads. Isso não descreve logs de infraestrutura |
| Logs da aplicação e da infraestrutura | Aplicação registra resultado, IDs, e-mail do admin em `por` e erros. Proxies e provedores têm registros próprios | Configuração dos provedores não verificada; prazo a definir | Inventariar Railway e qualquer exportador ativo. Não afirmar ausência total de dado pessoal ou remoção junto com o lead |
| Discord | Aviso genérico com tipo, canal escolhido e link do admin, quando configurado | Histórico e política do canal não verificados | Sem corpo do formulário no aviso. Não há cópia do lead para apagar neste aviso genérico |
| Backups, réplicas, exportações e cópias de operação | Extensão e configuração não verificadas | Prazo e processo de restauração a definir | Exclusão na tabela ativa não comprova exclusão dessas cópias. Conferir os ambientes e impedir reintrodução após restauração |

Fontes: [atribuição](../../assets/site/lib/atribuicao.js), [limitador](../../portal/src/lib/limitador.ts), [pseudônimo](../../portal/src/server/evento.ts), [expurgo de eventos](../../portal/src/server/jobs.ts), [logs](../../portal/src/server/log.ts).

As bases legais são matéria da revisão H4. A [política publicada em rascunho](../../portal/src/app/(public)/privacidade/page.tsx) menciona atendimento e aviso de abertura como procedimentos preliminares a contrato, marketing por consentimento e proteção contra abuso por legítimo interesse. Validar cada finalidade separadamente, incluindo atribuição, auditoria e lista de interesse. A lista de fornecedores de todo o portal não equivale à lista de destinatários destes formulários.

## 4. Ciência, marketing e saída da lista

- Ciência da política é obrigatória para o formulário, separada do aceite opcional de marketing.
- `marketingAceito = true` registra a escolha declarada no envio. Não existe double opt-in implementado para esses leads. Não iniciar campanha com base apenas nesse campo.
- Não há envio automático do aviso de abertura nem campanha de marketing a partir desses formulários. O aviso pedido sobre abertura e o marketing opcional são finalidades distintas.
- Não existe endpoint ou controle no admin para revogar só marketing, nem registro de supressão de não contatar. Reenviar o formulário desmarcado gera outra linha e não é um procedimento de revogação consolidado.
- A saída apenas da lista exige localizar e apagar registros de tipo `interesse`. O botão de exclusão por e-mail ou telefone apaga contatos e interesses que correspondam ao identificador, sem respeitar os filtros da listagem.
- O canal atual da política para pedidos de titular é o WhatsApp definido em `EMPRESA.whatsapp`. A promessa de saída respondendo a um e-mail depende de existir um remetente funcional e um processo de atendimento.

A revisão deve exigir confirmação do endereço, revogação, supressão e reconciliação das escolhas antes de habilitar marketing. O roteiro histórico de planilhas não implementa essas funções no portal.

## 5. Consulta e exclusão na operação atual

| Ação | Rota autenticada | Escopo |
|---|---|---|
| Consultar | `POST /api/leads/consulta`, JSON com `busca`, `tipo`, `status` | E-mail completo e telefone normalizado usam igualdade; texto comum busca nome/empresa. Retorna até 500 linhas e contagens de todo o filtro; resposta `no-store` |
| Atender ou reabrir | `POST /api/leads/[id]/status`, JSON com `status` | Atualiza `novo` ou `atendido` e registra auditoria quando há mudança |
| Apagar um envio | `DELETE /api/leads/[id]` | Remove somente o lead daquele ID e registra auditoria na mesma transação |
| Apagar por titular | `POST /api/leads/apagar-titular`, JSON com `email` ou `telefone` | Remove todas as linhas que correspondam, de ambos os tipos e estados, inclusive além das 500 exibidas |

Com e-mail e telefone juntos, a exclusão usa **união**: apaga o que corresponder a qualquer um dos dois, não apenas às duas condições ao mesmo tempo. Conferir cada identificador e o escopo do pedido. Cadastros que chegarem depois da seleção da transação não entram naquela exclusão.

Roteiro de atendimento para revisão H4:

1. Registrar o pedido em ambiente restrito: data, canal, finalidade e escopo. Não copiar os dados para issue pública, documentação do repo, log ou LLM.
2. Confirmar o titular ou representante por procedimento proporcional, usando o contato já registrado. Não exigir documentos adicionais por padrão. E-mail ou telefone compartilhado exige conferir os registros antes de uma exclusão em massa.
3. No admin, buscar o e-mail completo ou o telefone normalizado. Para exclusão de todos os leads, usar os dois tipos e todos os estados. Conferir o total do filtro, não apenas as linhas visíveis.
4. Avaliar finalidade e necessidade de conservação. Qualquer exceção precisa de justificativa específica, escopo mínimo, responsável e data de revisão; não presumir que lead comercial tem retenção financeira de cinco anos.
5. Executar a ação autorizada. Exclusão de um cadastro usa seu ID. Exclusão de todos os leads do identificador usa o botão por titular. Saída apenas da lista usa IDs de interesse; repetir a consulta se houver mais registros que o limite da tela. Revogação apenas de marketing exige atendimento restrito e encaminhamento para implementar a supressão, sem apagar automaticamente o pedido de contato.
6. Repetir a consulta exata após a exclusão, com os filtros do escopo, e conferir a quantidade removida. Falha da transação não comprova exclusão; encaminhar o erro sem copiar o corpo recebido.
7. Conferir os demais locais do mapa: eventos relacionáveis, logs, backups e cópias externas. A API de leads não remove eventos, auditoria, clientes, faturas, antigos registros do n8n ou conversas de WhatsApp. Esses tratamentos exigem avaliação própria e operação autorizada.
8. Registrar conclusão e pendências no ambiente restrito e responder ao titular com o alcance efetivo da ação. Não afirmar eliminação de backups ou de todos os sistemas com base só na resposta da API de leads.

Excluir o lead não cria uma supressão: um novo envio com outro `idEnvio` volta a gravar. Antes de qualquer envio futuro, respeitar pedidos de não contatar em todos os canais aplicáveis. O app atual não garante isso sozinho.

## 6. Evidência e pendências

Em 11/10/2026, os dois formulários foram enviados pela interface pública com dados fictícios. Cada um retornou 200, apareceu na consulta autenticada e no detalhe do admin com versões de ciência, marketing desmarcado e origem de campanha. Os dois registros de teste foram apagados individualmente pelo admin; a consulta exata retornou zero para cada identificador de teste.

Esse teste comprova o caminho de criação, consulta e exclusão individual. Não comprova recebimento de alerta no Discord, exclusão em massa, expurgo de eventos, remoção de backups, confirmação de e-mail ou envio de campanhas.

Divergência para H4: o rascunho da política afirma que o código de navegação não permite identificar a pessoa. `visitorId` fica associado aos dados do lead e também existe no modelo de clientes, permitindo relacionar eventos a esses registros. Tratar esse identificador como pseudônimo relacionável e revisar a afirmação pública; não confundir hash não reversível com anonimização.

Para concluir H4: aprovar a proposta da seção 7, validar bases legais e operadores, conferir backups/logs e transferências internacionais, definir o responsável pelo atendimento e implementar revogação e supressão antes de marketing. A política continua em rascunho e não passa a prometer expiração automática com a publicação deste guia.

## 7. Proposta de retenção

| Tipo | Limite ordinário proposto | Motivo |
|---|---|---|
| Contato | 180 dias desde `createdAt` | Janela de seis meses para responder e acompanhar o pedido |
| Interesse | 365 dias desde `createdAt` | Um ciclo anual de lançamento, sem lista permanente sem previsão de abertura |

Encerrar antes quando a finalidade terminar ou houver pedido aplicável do titular. Contar dias como 24 horas em UTC, usando a hora oficial do servidor. Reenvio, mudança de status e aceite de marketing não renovam registros anteriores. Um futuro job diário terá defasagem de até 24 horas; o atendimento ao titular não depende dele.

Esses números são uma proposta operacional, não prazos obrigatórios da LGPD. A retenção depende da finalidade e da circunstância. [ANPD, pergunta 5.5](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes). Exceções precisam de fundamento específico, escopo mínimo, responsável e data de revisão. O término e a conservação excepcional seguem avaliação dos arts. 15 e 16. [LGPD, texto oficial](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).

Auditoria, logs, backups e eventual evidência de supressão exigem prazos próprios ainda não definidos. Não reutilizar o prazo financeiro da conta para o formulário. Antes de um expurgo: aprovar a regra, representar encerramento e exceções, revisar uma prévia restrita, implementar e testar o job, tratar restauração de backups e obter autorização específica para produção. Merge deste guia não autoriza exclusão em produção.

A spec detalhada de implementação é interna e permanece fora do git, conforme a regra de `docs/specs/` no repositório.
