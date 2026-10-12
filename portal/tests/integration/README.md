# Integração local do site com o portal

`npm.cmd run test:integration:site`, executado em `portal/`, verifica a ligação HTTP dos módulos reais de payload e envio do site com o Next e o PostgreSQL. Não altera a aplicação para testar e não aceita URL de banco ou portal fornecida pelo ambiente.

O comando reúne oito cenários de integração e quatorze verificações dos próprios mecanismos de CORS, contagens, isolamento e limpeza.

As quatorze verificações sem banco também rodam em `npm.cmd run test:unit`, junto dos testes unitários do portal, inclusive na esteira existente. O runner completo com Docker continua sendo um comando explícito de homologação.

## Requisitos

- Node 24 ou superior e as dependências do portal instaladas.
- Docker local funcionando, com a imagem `postgres:16` já disponível no cache.
- Permissão para criar processos locais e um contêiner temporário de testes.

O runner recusa contextos Docker com endpoint remoto. No Windows usa o engine local por named pipe; em Linux usa socket Unix. Não baixa uma imagem automaticamente.

O client Prisma instalado deve estar gerado sem referências a arquivos `.env`. O runner verifica o artefato antes de criar recursos e recusa caminhos de ambiente do checkout original.

## O que é verificado

1. CORS nas duas rotas: origem, métodos e cabeçalho no preflight; origem, `Vary` e `no-store` no POST, inclusive em 422. Acesso ao admin: 401 sem sessão e 403 para cliente.
2. Contato montado e enviado pelos módulos do site, persistência de campos, versões e atribuição, aviso recebido depois da gravação e reenvio sem duplicação.
3. Lista de interesse: idempotência pelo mesmo `idEnvio`; novo identificador com o mesmo e-mail cria outra inscrição.
4. Recusa 422 compreendida pelo módulo de envio, sem registro ou aviso.
5. Honeypot sem registro ou aviso.
6. Consulta autenticada dos leads, com campos comparados ao banco, `no-store` e ausência de `visitorId` ou `idEnvio`.
7. Os quatro eventos da landing gravados pelo HTTP real e relacionados ao visitante do lead.
8. Renderização autenticada de `/admin/funil`, conferindo as contagens visíveis de cada sinal.

A leitura do HTML usa [parse5](https://parse5.js.org/functions/parse5.parse.html), somente como dependência de desenvolvimento. Confere os elementos e textos do HTML SSR, resolve entidades e ignora scripts, estilos, templates, noscript e subárvores com `hidden`. Não reescreve HTML nem executa scripts; não calcula visibilidade por CSS. A renderização no navegador tem sua verificação separada.

## Isolamento e evidência

O banco se chama `waveops_site_test`, usa porta aleatória vinculada a `127.0.0.1` e começa vazio. O app roda em pasta nova de `.tmp-qa/h5-integracao/`, recebe uma cópia explícita de código e arquivos públicos e reutiliza as dependências por link. Nenhum `.env` é copiado ou reescrito.

A espera pelo banco verifica TCP e uma consulta real pela porta publicada antes das migrations. O servidor temporário de inicialização da imagem pode responder no socket antes de abrir TCP; ele não satisfaz essa espera. [Entrypoint oficial do PostgreSQL](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh).

O ambiente do app contém apenas variáveis operacionais do sistema e valores do teste. As chaves de sessão, senha e cron são geradas em memória. Resend, gateways e CRM não recebem credenciais. O aviso destinado ao Discord é recebido por um servidor HTTP local, com verificação de que o envio específico já foi gravado e de que os dados fictícios de contato não entram no texto.

Ao terminar, inclusive em falha, o runner encerra seu processo do Next, receptor HTTP, conexão Prisma e contêiner identificado por nome exclusivo e etiquetas da suíte e da execução. A tentativa de criação é registrada antes de chamar o Docker: uma falha ou timeout não impede procurar e encerrar o recurso próprio. No POSIX, a terminação tem prazo e escalonamento. Não encerra outros processos ou contêineres. A pasta de evidência permanece em `.tmp-qa/`, ignorada pelo git, com o log do app após remoção dos valores efêmeros de autenticação.

## Limites

Este comando verifica os módulos de contrato e envio do site, o HTTP do portal e a persistência real. Os estados visuais dos formulários têm os testes Playwright próprios em `tests/site/`. Não equivale a um navegador acessando os domínios de produção, entrega de mensagem ao Discord real, confirmação de titularidade do e-mail, aparelho físico ou teste com leitor de tela.

A homologação privada do projeto registra separadamente esses resultados e limites. O teste de VoiceOver foi interrompido por pedido de Vitor; não é declarado aprovado por este runner.
