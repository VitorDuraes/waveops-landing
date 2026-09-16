# Deploy: Railway + Grafana Cloud (OTel)

Guia de producao do WaveOps Portal. Host: Railway (app Node + Postgres
gerenciado). Observabilidade: OpenTelemetry exportando para Grafana Cloud (free).

> Observacao: estes passos foram escritos a partir do codigo, mas ainda nao foram
> executados num deploy real. Os pontos marcados com (VERIFICAR) precisam de
> confirmacao no primeiro deploy.

## 0. Pre-requisitos
- Repo no GitHub.
- Conta Railway (https://railway.app).
- Conta Grafana Cloud free (https://grafana.com).

## 1. Banco (Postgres) no Railway
1. New Project -> Provision PostgreSQL. Railway cria a variavel `DATABASE_URL`.
2. Anote (ou referencie via `${{Postgres.DATABASE_URL}}` no servico do app).

## 2. Servico do app (Next.js)
1. New -> Deploy from GitHub repo -> selecione o repositorio.
2. **Root Directory = `portal`** (o app fica em `portal/`, a landing na raiz).
3. Build: Nixpacks detecta Next.js. A cadeia roda sozinha:
   - `npm install` -> `postinstall` (`prisma generate`)
   - `npm run build` -> `prebuild` (`sync-landing.mjs`) -> `next build`
   - `npm start` (`next start`, le a porta de `PORT` que o Railway injeta)
4. (VERIFICAR) O `prebuild` roda `sync-landing.mjs`, que le `../index.html` e
   `../assets` (raiz do repo). Com Root Directory = `portal`, confirme que o build
   enxerga a raiz. Se nao enxergar, alternativa: Root Directory = raiz do repo e
   comandos custom `cd portal && npm run build` / `cd portal && npm start`.

## 3. Migracoes do banco

> **DIRECT_URL e obrigatoria, e a falta dela trava TUDO.** O `schema.prisma` declara
> `directUrl = env("DIRECT_URL")`. Sem essa variavel, o Prisma nem chega a falar com o
> banco: ele falha na validacao do schema com `P1012 Environment variable not found:
> DIRECT_URL`, e isso derruba **qualquer** comando de schema, `migrate deploy` e
> `db push` igual. Sintoma tipico: tabela nova nao existe em producao e a tela que a
> consulta responde erro de servidor. Aconteceu em 16/09/2026 com a tabela `eventos`.
>
> Valor: a conexao DIRETA do Postgres (porta 5432), nao a do pooler (6543). Migration
> por pooler em modo transaction falha por causa de prepared statement e advisory lock.
> Para descobrir o host atual sem expor senha, rode no shell do Railway:
> `node -e "const u=new URL(process.env.DATABASE_URL);console.log(u.hostname,u.port)"`.

Ha migrations versionadas em `prisma/migrations/`. No Railway:
- Defina um **Deploy/Pre-Deploy Command** = `npm run db:deploy` (`prisma migrate deploy`).
- `prisma db push` so para prototipo local. Em producao ele diverge do historico de
  migrations e depois quebra o `migrate deploy`.
- Seed (opcional, so 1a vez): rode `npm run db:seed` via Railway shell.

## 4. Variaveis de ambiente do app
No servico do app, em Variables:
```
APP_URL=https://<seu-dominio>.up.railway.app   # ou dominio custom
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=<conexao direta, porta 5432>       # OBRIGATORIA: sem ela, migration nenhuma roda
SESSION_SECRET=<string aleatoria 32+ chars>
AUTH_ENFORCED=true          # producao exige login (so use false em demo)
ADMIN_EMAIL=financeiro@waveops.com.br
ADMIN_PASSWORD=<senha forte>

# Pagamento (quando for cobrar de verdade, troque para credenciais de PRODUCAO)
PAYMENT_GATEWAY=mercadopago
MERCADOPAGO_ACCESS_TOKEN=<APP_USR de producao>
MERCADOPAGO_WEBHOOK_SECRET=<assinatura secreta do webhook no painel MP>

# E-mail (login por codigo e avisos)
RESEND_API_KEY=<...>
EMAIL_FROM=WaveOps <nao-responder@waveops.com.br>

# Job de cobranca
CRON_SECRET=<string aleatoria>
```
Importante: com `APP_URL` em `https`, o checkout passa a mandar `notification_url`
para o MP (o webhook so e enviado quando publico). Em localhost isso fica
desligado de proposito.

## 5. OpenTelemetry -> Grafana Cloud
1. No Grafana Cloud: crie um stack. Va em **Connections -> Add new connection ->
   OpenTelemetry (OTLP)**.
2. Gere um token (Cloud Access Policy com escopo de escrita em traces/logs/metrics).
   A pagina mostra o endpoint e o header prontos. Os valores sao:
```
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<zona>.grafana.net/otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64(instanceId:token)>
OTEL_SERVICE_NAME=waveops-portal
```
   (`instanceId` = o numero "Instance ID/User" da pagina OTLP; `token` = o que voce
   gerou. O proprio Grafana mostra o header ja em base64.)
3. Adicione essas 4 variaveis no servico do app no Railway e faça redeploy.
4. O `instrumentation.ts` (ja no repo) registra o OTel no boot e auto-instrumenta
   `fetch` (chamadas ao Mercado Pago viram spans). Para ver: Grafana -> Explore ->
   Tempo (traces). Filtre por `service.name = waveops-portal`.

Logs: por enquanto os logs estruturados (JSON, `src/server/log.ts`) saem no stdout
e ficam visiveis no log explorer do Railway. Enviar logs tambem para o Loki do
Grafana fica para um segundo momento (precisa de exporter de logs do OTel ou um
agente). Traces ja cobrem o diagnostico do fluxo de pagamento.

## 6. Webhook do Mercado Pago
1. Painel MP -> Suas integracoes -> sua aplicacao -> Webhooks.
2. URL: `https://<seu-dominio>/api/webhooks/mercadopago`.
3. Copie a **assinatura secreta** e coloque em `MERCADOPAGO_WEBHOOK_SECRET`.
   (Com o segredo setado, `verifyWebhook` valida a assinatura HMAC do MP.)

## 7. Job de cobranca (regua / dunning)
O endpoint `/api/jobs/dunning` e protegido por `CRON_SECRET`. Agende um cron:
- Railway: crie um servico Cron (ou use Railway Cron) chamando
  `POST https://<dominio>/api/jobs/dunning` com header/secret `CRON_SECRET`.
- Frequencia sugerida: diaria.

## Checklist pos-deploy
- [ ] App sobe e `/` mostra a landing; `/cliente` e `/admin` respondem.
- [ ] `DATABASE_URL` e `DIRECT_URL` configuradas, e `npm run db:deploy` roda sem `P1012`.
- [ ] Schema aplicado: a tabela da ultima migration existe no banco.
- [ ] Login admin funciona com `AUTH_ENFORCED=true`.
- [ ] Trace aparece no Grafana Tempo apos um checkout (filtrar por service.name).
- [ ] Webhook do MP chega e baixa a fatura (testar com pagamento sandbox primeiro).
- [ ] Cron de cobranca dispara.
