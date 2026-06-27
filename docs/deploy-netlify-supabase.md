# Deploy do WaveOps Portal: Netlify + Supabase (custo fixo R$0)

Runbook para subir o portal de cobrança em produção sem mensalidade de infra. Verificado em 2026-06-25. O domínio do app é **waveops.com.br**.

## O stack

| Camada | Serviço | Custo |
|---|---|---|
| App (Next 15) | Netlify free | R$0 |
| Banco | Supabase free (500 MB) | R$0 |
| Cron (cobrança + reconciliação) | Supabase pg_cron + cron-job.org | R$0 |
| E-mail | Resend free | R$0 |
| Observabilidade (opcional) | Grafana Cloud free | R$0 |
| CRM | Twenty desligado no lançamento | R$0 |
| Pagamento | Mercado Pago | só taxa por venda |
| Domínio | waveops.com.br | renovação ~R$40/ano |

"100% grátis" aqui é zero mensalidade de infra. A renovação do domínio e a taxa do Mercado Pago por venda são reais.

Decisões eliminatórias: a Vercel free (Hobby) está fora porque proíbe uso comercial. A Koyeb perdeu o tier grátis após a compra pela Mistral em fevereiro de 2026. Netlify libera uso comercial no free por escrito.

## Pré-requisitos

Contas grátis: GitHub (repo já existe), Netlify, Supabase, Resend, Mercado Pago. Domínio waveops.com.br já registrado.

## Passo 1: banco no Supabase

1. Crie um projeto no Supabase. Guarde a senha do banco.
2. Em Project Settings, Database, Connection string, pegue duas URLs:
   - **Pooler (Transaction, porta 6543)** vira o `DATABASE_URL`. Acrescente `?pgbouncer=true` no fim.
   - **Direct connection (porta 5432)** vira o `DIRECT_URL`.
3. Rode as migrations apontando para o Supabase. No `portal/`, com PowerShell:
   ```powershell
   $env:DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-<reg>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   $env:DIRECT_URL="postgresql://postgres.<ref>:<senha>@aws-0-<reg>.pooler.supabase.com:5432/postgres"
   npx prisma migrate deploy
   ```
   As duas migrations cobrem todas as tabelas. Não use `db push` (a frase no docs antigo está desatualizada).

## Passo 2: gerar segredos

Gere valores fortes e novos. Nunca reaproveite o `portal/.env` de dev (tem um JWT real do Twenty apontando para localhost e defaults que o boot rejeita).

```powershell
# SESSION_SECRET e CRON_SECRET (32+ chars cada)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Defina também um `ADMIN_PASSWORD` forte, diferente do default.

## Passo 3: app no Netlify

1. New site from Git, conecte o repositório. O `netlify.toml` na raiz já define `base = "portal"`, o comando de build e o plugin oficial do Next.
2. Em Site settings, Environment variables, configure (Production):

   Obrigatórias (o boot aborta sem elas):
   - `DATABASE_URL` = pooler 6543 com `?pgbouncer=true`
   - `DIRECT_URL` = direta 5432
   - `APP_URL` = `https://waveops.com.br` (sem https o Mercado Pago não recebe o webhook)
   - `SESSION_SECRET` = gerado no passo 2
   - `ADMIN_PASSWORD` = forte
   - `CRON_SECRET` = gerado no passo 2
   - `PAYMENT_GATEWAY` = `mercadopago`
   - `MERCADOPAGO_ACCESS_TOKEN` = token de produção (`APP_USR-...`)
   - `MERCADOPAGO_WEBHOOK_SECRET` = do painel do MP

   Recomendadas:
   - `ADMIN_EMAIL` = `financeiro@waveops.com.br`
   - `RESEND_API_KEY`, `EMAIL_FROM` (passo 6)
   - `DISCORD_WEBHOOK_URL`, `TEAM_NOTIFY_EMAIL` (alertas)

   NÃO defina: `AUTH_ENFORCED` (deixe ausente, prod força true), `TWENTY_API_TOKEN` (vazio = CRM desligado), `TWENTY_API_URL`.

3. Faça o primeiro deploy. O `NODE_ENV=production` é automático no Netlify (importante: sem ele, um banco fora faria o webhook responder 200 em modo mock e o MP pararia de reenviar).

## Passo 4: domínio waveops.com.br

1. No Netlify, Domain management, Add a domain, `waveops.com.br`.
2. No DNS do domínio, aponte conforme o Netlify indicar:
   - Apex `waveops.com.br`: registro A para o IP do Netlify, ou use os name servers do Netlify (mais simples, ele gerencia tudo).
   - `www`: CNAME para o site do Netlify.
3. O Netlify provisiona o SSL (Let's Encrypt) automático em alguns minutos.
4. Confirme que `APP_URL` está como `https://waveops.com.br`.

Atenção: hoje o `CNAME` da raiz do repo e as URLs canônicas da landing apontam para o GitHub Pages. Só troque o apontamento de DNS da landing para o Netlify quando decidir servir tudo do portal, para o site no ar não cair no meio.

## Passo 5: Mercado Pago

1. Use credenciais de PRODUÇÃO (`APP_USR-...`), não de teste.
2. No painel do MP, em Webhooks, cadastre a URL: `https://waveops.com.br/api/webhooks/mercadopago`. Pegue o `MERCADOPAGO_WEBHOOK_SECRET` e coloque no Netlify.
3. O webhook é idempotente e à prova de retry: o MP reenvia por cerca de 8 a 9 dias se receber não-2xx, e o job de reconciliação (passo 7) recupera o que faltar.

## Passo 6: e-mail no Resend

Sem isto, o cliente paga e não recebe o código de ativação: o e-mail é o que destrava o acesso à conta. É bloqueio, não item opcional.

1. Crie a conta no Resend e a API key. Coloque em `RESEND_API_KEY` no Netlify.
2. Em Domains, adicione `waveops.com.br`. O Resend mostra os registros DNS a criar (DKIM `resend._domainkey`, SPF e o MX de bounce). Eles ficam em subdomínio (`send.waveops.com.br`) e na chave DKIM, então NÃO conflitam com o e-mail que já usa o domínio (o MX principal continua intacto). Adicione esses registros no DNS da Hostinger e aguarde o Resend marcar "Verified".
3. `EMAIL_FROM` = `WaveOps <nao-responder@waveops.com.br>`. O remetente tem que ser do domínio verificado, senão o Resend recusa o envio (403/422). Limite free: 3.000/mês, 100/dia. Sobra para códigos de login e ativação.
4. Se um envio falhar, o motivo agora aparece no log do Netlify (`[email] Resend recusou (...)`). Antes era engolido em silêncio.

## Passo 7: cron (cobrança e reconciliação)

Dois caminhos redundantes, para o banco nunca pausar e nenhum pagamento se perder.

**A) Supabase pg_cron + pg_net** (também mantém o banco acordado, porque a execução do próprio cron dentro do Postgres já conta como atividade de banco: nenhum keep-alive separado é preciso). No SQL Editor do Supabase:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Se estiver reexecutando, remova os jobs antigos antes (evita duplicar). Não dá
-- erro se ainda não existirem: o SELECT só não retorna linhas.
select cron.unschedule(jobid) from cron.job where jobname in ('waveops-dunning', 'waveops-reconcile');

-- Régua de cobrança, todo dia 09:00 BRT (12:00 UTC).
-- timeout_milliseconds alto tolera o cold start do app (1 a 3s) sem perder a chamada.
select cron.schedule('waveops-dunning', '0 12 * * *', $$
  select net.http_post(
    url := 'https://waveops.com.br/api/jobs/dunning',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer SEU_CRON_SECRET'),
    timeout_milliseconds := 15000
  );
$$);

-- Reconciliação de pagamentos, todo dia 09:30 BRT (12:30 UTC)
select cron.schedule('waveops-reconcile', '30 12 * * *', $$
  select net.http_post(
    url := 'https://waveops.com.br/api/jobs/reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer SEU_CRON_SECRET'),
    timeout_milliseconds := 15000
  );
$$);
```

**B) cron-job.org** (plano B, não desliga por inatividade como o GitHub Actions): dois jobs diários, método POST, nos mesmos endpoints, com header `Authorization: Bearer SEU_CRON_SECRET`.

Não use GitHub Actions sozinho para isso: o schedule é desabilitado após 60 dias sem commit, e o dunning morreria em silêncio.

## Passo 8: validação

- [ ] `https://waveops.com.br/` abre a landing com os planos novos.
- [ ] `/termos` e `/privacidade` abrem, e os links do checkbox do checkout e do rodapé da landing levam até elas.
- [ ] `/checkout?plano=pro` gera um link de pagamento real do Mercado Pago.
- [ ] Pagar (valor baixo real) baixa a fatura e dispara o e-mail de ativação. Confirme no log do Netlify (`webhook.fatura_baixada`) e que o código de ativação chega na caixa de entrada.
- [ ] Reembolso: no detalhe do cliente, "Reembolsar" estorna no MP, marca a fatura como reembolsada e cancela a assinatura (e o webhook de estorno faz o mesmo se você reembolsar pelo painel do MP).
- [ ] `/admin` exige login (não está em modo demo).
- [ ] Os dois crons aparecem rodando (Supabase: `select * from cron.job;`).
- [ ] Forçar o reconcile manual: `POST https://waveops.com.br/api/jobs/reconcile?secret=SEU_CRON_SECRET` retorna `{ applied, checked }`.

## Caveats que você precisa monitorar

1. **Pausa do Supabase:** o projeto free pausa após 7 dias sem atividade de banco, e um projeto pausado NÃO volta sozinho ao receber uma query (precisa do botão Restore). O pg_cron diário evita isso, mas se o cron falhar e o banco pausar durante uma venda, o webhook falha por toda a janela de retry do MP. Ative o alerta de inatividade do Supabase por e-mail e roteie para o Discord. Se quiser eliminar a pausa, troque para Neon free (scale-to-zero leve em vez de pausa dura).
2. **Cold start:** o app dorme após inatividade. O cold start (1 a 3s) cabe nos 22s de timeout do webhook do MP, e o cron diário serve de keep-alive. Não use host com cold start de 30 a 60s (Render free) para este caso.
3. **Reconciliação é a rede de segurança:** mesmo que o webhook perca um evento, o `/api/jobs/reconcile` busca os pagamentos aprovados dos últimos 7 dias no MP e aplica os que faltam. Mantenha o cron dele vivo.
4. **Limite do Resend:** 100/dia. Folgado agora, mas é o teto a observar quando o volume subir.

## CRM Twenty (fase 2)

Twenty fica desligado no lançamento (`TWENTY_API_TOKEN` vazio, adapter em modo log, não bloqueia nada). Para ligar o CRM próprio depois sem custo, self-host o Twenty numa VM Oracle Cloud Always Free (precisa de Postgres e Redis na VM) e preencha `TWENTY_API_URL` e `TWENTY_API_TOKEN` no Netlify.

## Observabilidade (opcional)

Para ligar logs e traces, crie um stack grátis no Grafana Cloud e preencha `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_EXPORTER_OTLP_HEADERS` no Netlify. Sem essas variáveis, o portal roda igual, sem exportar nada.

## Gatilhos para sair do grátis

Banco acima de 500 MB, e-mail acima de 100/dia, volume que torne o cold start um problema para o cliente pagante, ou necessidade de recorrência automática do MP (preapproval) em vez de fatura por link.
