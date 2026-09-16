# E-mail do domínio: verificar no Resend e consertar o DNS

Estado medido em **16/09/2026** por `npm run check:email`: **6 problemas**. O e-mail de ativação
não sai, e o `contato@waveops.com.br` da landing não recebe.

```
SPF     nenhum registro em waveops.com.br nem em send.waveops.com.br
DKIM    resend._domainkey.waveops.com.br não existe
MX      send.waveops.com.br sem MX
DMARC   p=quarantine sem SPF/DKIM: todo e-mail do domínio cai em spam
MX raiz waveops.com.br sem MX: contato@waveops.com.br devolve toda mensagem
Resend  HTTP 403, "The waveops.com.br domain is not verified"
```

## Por que isso importa mais do que parece

O e-mail de ativação é o **único caminho automático** de um cliente que pagou entrar no portal
(`src/server/onboarding.ts`). Com ele fora, o cliente paga, não recebe nada, e só entra se alguém
do time perceber o alerta no Discord e acionar na mão.

E tem um agravante que não estava no radar: o domínio publica `_dmarc` com `p=quarantine`, herdado
do padrão da GoDaddy, **sem SPF e sem DKIM**. Política restritiva sem autenticação é o pior dos dois
mundos: mesmo que o Resend passasse a enviar, a mensagem cairia em spam. Os dois têm que subir
juntos.

## O que fazer, na ordem

### 1. Adicionar o domínio no Resend

Em `resend.com/domains`, adicionar `waveops.com.br`, região `sa-east-1` (São Paulo). O painel devolve
**três registros**: um TXT de DKIM, um TXT de SPF e um MX, os dois últimos no subdomínio `send`.
Copiar os valores de lá: a chave de DKIM é gerada por conta e não dá para adivinhar.

### 2. Publicar os registros na GoDaddy

Os nameservers do domínio são da GoDaddy (`ns71.domaincontrol.com`), então é lá que os registros
entram, em **Domínios, DNS, Gerenciar zonas**.

| Tipo | Nome | Valor | Observação |
|---|---|---|---|
| TXT | `resend._domainkey` | a chave que o Resend mostrar | é o DKIM, o mais importante |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | confirmar o valor exato no painel |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com`, prioridade 10 | região tem que bater com a escolhida |

Cuidado com a GoDaddy: o campo Nome é **relativo**. Escreva `send`, não `send.waveops.com.br`. Se
escrever o domínio inteiro, a GoDaddy cria `send.waveops.com.br.waveops.com.br` e a verificação
nunca passa.

### 3. Verificar

Esperar a propagação (a zona tem TTL de 600 segundos, então costuma ser rápido) e clicar em Verify
no Resend. Depois, na máquina:

```
cd portal
npm run check:email          # só DNS
npm run check:email -- --enviar   # DNS + envio de teste no Resend
```

O teste de envio usa `delivered@resend.dev`, o endereço-sumidouro oficial do provedor. Ele não
entrega a nenhuma caixa real, então pode rodar à vontade.

Alvo: `Resultado: caminho de e-mail de pé.` e código de saída 0.

### 4. Resolver o recebimento (é outro problema)

`waveops.com.br` não tem MX nenhum na raiz. A landing publica `contato@waveops.com.br` no rodapé e
no `llms.txt`, então **hoje toda mensagem enviada para lá volta com erro para quem escreveu**. Isso é
independente do Resend, que só cuida do envio.

Duas saídas:

1. Contratar uma caixa (Google Workspace, Zoho Mail, ou o e-mail profissional da própria GoDaddy) e
   publicar o MX dela.
2. Encaminhamento de e-mail, se a GoDaddy oferecer no plano atual. Mais barato, e resolve o caso de
   receber resposta de lead.

Enquanto nenhuma das duas estiver de pé, o endereço no rodapé promete um canal que não existe.

## Quando o DMARC pode apertar

Só depois de SPF e DKIM verificados e com envio real acontecendo. Aí sim vale subir de
`p=quarantine` para `p=reject`, e trocar o `rua` da GoDaddy por uma caixa nossa, para os relatórios
chegarem em alguém que os leia. Antes disso, apertar a política só aumenta o estrago.
