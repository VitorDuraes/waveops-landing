# n8n do site v2: lead de contato e lista de interesse

| Campo | Valor |
|---|---|
| Dono | Vitor Duraes |
| Data | 10/10/2026 |
| Status | Rascunho. Nada foi publicado e nenhum webhook foi chamado |
| Spec | `docs/specs/2026-10-09-site-institucional-v2.md`, seções 5.6 a 5.8 |
| Gate | H2: só publicar com a aprovação do Vitor |
| Arquivos desta pasta | `n8n-waveops-lead-v2.json` e `n8n-waveops-interesse-v1.json` |
| Teste | `node --test tests/site/unit/n8n-site-v2.test.mjs` |
| Operação restrita | `docs/specs/2026-10-10-n8n-site-v2-operacao-restrita.md`, arquivo local fora do git: roteiro de homologação e parâmetros de operação |

O workflow que roda hoje (`flowops-lead`, host `cowboyhouse.app.n8n.cloud`) não está versionado. O JSON `n8n/flowops-lead-capture.json` é só um esqueleto e fica fora do git (a pasta `n8n/` é ignorada). Por isso os dois arquivos desta pasta são rascunho. Confira cada ponto da seção 17 contra o export real antes de publicar.

## 1. Resumo

- São dois workflows novos, em paths novos. O `flowops-lead` não é tocado.
- Cada um valida no servidor, deduplica, grava na planilha e só então responde 200.
- Robô recebe 200 sem gravar. Dado inválido recebe 422. Origem estranha recebe 403. Excesso de volume recebe 429. Falha de planilha recebe 503 e avisa o time.
- As colunas novas do lead entram no fim da aba atual. A lista de interesse tem aba própria, `lista_interesse`.
- Na lista, vale a linha mais recente de cada e-mail. Mudou o consentimento de marketing, entra uma linha nova.
- Os JSON estão `active: false`, sem segredo, com credencial só por nome. O que depende do dono está como `__DEFINIR__`.

Decisões do dono, em ordem de bloqueio:

1. **Planilha e abas.** Bloqueia tudo: sem documento e aba, a resposta é 503.
2. **Destinatário do aviso interno.** Bloqueia o aviso, não o registro. Entra em 4 nós Gmail.
3. **Path novo ou atualizar o atual.** Recomendação: path novo (seção 12, passo 14).
4. **Prazo de retenção e textos jurídicos.** Bloqueia a publicação do site (gate H4), não os workflows.

## 2. Fluxo

```
Navegador (waveops.com.br)
   │  POST application/json   (antes, o OPTIONS de CORS, que o próprio n8n responde)
   ▼
Webhook → Code: validar e normalizar ─ erro no código ─→ 503 + falha registrada
              ├─ Origin fora da lista ─────────────────→ 403
              ├─ robô (isca ou menos de 1200 ms) ──────→ 200, sem gravar e sem avisar
              ├─ dado inválido ────────────────────────→ 422 {campos}
              ├─ acima do limite de volume ────────────→ 429
              └─ ok
                  ▼
           Sheets: buscar a chave (idEnvio no lead, email na lista)
                  ▼
           Code: decidir pela leitura
              ├─ falha (erro ou resposta estranha) ────→ 503 + falha registrada
              ├─ repetida ─────────────────────────────→ 200, sem gravar
              └─ gravar
                  ▼
           Set: montar a linha → Sheets: gravar (RAW)
                                    ├─ falhou ──────────→ 503 + falha registrada
                                    └─ gravou
                                        ▼
                                 200 {"ok":true,"protocolo":"<idEnvio>"}
                                        ▼
                                 Gmail: aviso interno ao time

Falha registrada = Stop and Error → Error Trigger → Gmail "Falha no site"
```

Cada fluxo tem 27 nós, dois deles são notas. O nome de cada nó diz o que ele faz.

## 3. Contrato dos webhooks

### 3.1 Entrada

| Item | Lead | Lista de interesse |
|---|---|---|
| Método | `POST` | `POST` |
| Path | `waveops-lead-v2` | `waveops-interesse` |
| URL de produção | `https://cowboyhouse.app.n8n.cloud/webhook/waveops-lead-v2` | `https://cowboyhouse.app.n8n.cloud/webhook/waveops-interesse` |
| Corpo | JSON, `Content-Type: application/json` | idem |
| Origens aceitas | `https://waveops.com.br` e `https://www.waveops.com.br` | idem |
| Página | `/contato/` | `/plataforma/` |
| `versaoContrato` | 2 | 1 |
| `origem` | `contato` | `plataforma` |

O `assets/site/config.js` já aponta para os dois paths (`waveops-lead-v2` e `waveops-interesse`). Enquanto os workflows não existirem no n8n, o formulário cai no estado de falha, com os dados preservados e saída pelo WhatsApp. O site novo não posta no `flowops-lead` de propósito: aquele workflow só lê as 15 chaves antigas e perderia em silêncio o e-mail do canal E-mail, a ciência da política e o consentimento de marketing.

O `Content-Type: application/json` faz o navegador mandar antes um `OPTIONS` (preflight). O nó Webhook responde esse pedido sozinho, com a lista de origens da seção 10.

### 3.2 Chaves do lead

| Chave | Tipo | Obrigatória | Regra no servidor | Coluna |
|---|---|---|---|---|
| `nome` | texto | sim | 2 a 120 caracteres, em uma linha | `nome` |
| `empresa` | texto | não | até 120 caracteres | `empresa` |
| `whatsapp` | texto | não | Não é lida. A coluna recebe o telefone, só no canal WhatsApp | `whatsapp` |
| `dor` | texto | não | Texto da opção. Corta em 120 | `dor` |
| `mensagem` | texto | não | até 2000 caracteres. Mantém quebras de linha | `mensagem` |
| `origem` | texto | sim | `contato` | `origem` |
| `enviadoEm` | data ISO | não | ISO 8601 com fuso. Fora disso a coluna fica vazia | `enviadoEm` |
| `preenchidoEmMs` | número | sim | Abaixo de 1200 é robô (descarte). Ausente ou não numérico é 422, para o erro de contrato aparecer na hora | `preenchidoEmMs` |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | texto | não | Corta em 200 | uma coluna com o mesmo nome |
| `referrer` | texto | não | Corta em 500 | `referrer` |
| `landingUrl` | texto | não | Corta em 500 | `landingUrl` |
| `versaoContrato` | número | sim | 2 | `versaoContrato` |
| `idEnvio` | texto | sim | 8 a 64 caracteres entre letras, números, `_` e `-`, começando por letra ou número (o apóstrofo da proteção contra fórmula não pode entrar no id) | `idEnvio` |
| `canalRetorno` | texto | sim | `whatsapp`, `email` ou `ligacao` | `canalRetorno` |
| `telefone` | texto | em WhatsApp e ligação | Só os dígitos contam: 10 a 13. Com 12 ou 13 dígitos começando por 55, o servidor tira o 55 (o site já faz isso). No canal e-mail é opcional, mas vale a mesma regra se vier | `telefone` |
| `email` | texto | no canal e-mail | Regra do site (seção 5.2), até 160. Nos outros canais é opcional, com a mesma regra se vier | `email` |
| `melhorHorario` | texto | não | Texto da opção. Corta em 120 | `melhorHorario` |
| `procura` | texto | não | Texto da opção. Corta em 120 | `procura` |
| `politicaCiente` | booleano | sim | Precisa ser `true` | `politicaCiente` |
| `politicaVersao` | texto | sim | 1 a 60 caracteres | `politicaVersao` |
| `politicaCienteEm` | data ISO | sim | ISO 8601 com fuso | `politicaCienteEm` |
| `cienciaTextoVersao` | texto | não | Versão do texto da caixa de ciência. Corta em 60. Opcional para um navegador com JavaScript antigo em cache não derrubar o lead | `cienciaTextoVersao` |
| `marketingAceito` | booleano | não | Ausente vale `false`. Outro tipo é 422 | `marketingAceito` |
| `marketingTextoVersao` | texto | se marketing | 1 a 60 caracteres quando `marketingAceito` é `true` | `marketingTextoVersao` |
| `primeiraFonte` | texto | não | Corta em 100 | `primeiraFonte` |
| `pagina` | texto | não | Corta em 100 | `pagina` |
| `website` | texto | deve vir vazio | Preenchido é robô | sem coluna: a validação consome |
| (servidor) `recebidoEm` | data ISO | gerado | Hora do servidor, fuso de São Paulo | `recebidoEm` |

### 3.3 Chaves da lista de interesse

| Chave | Tipo | Obrigatória | Regra no servidor | Coluna |
|---|---|---|---|---|
| `versaoContrato` | número | sim | 1 | `versaoContrato` |
| `idEnvio` | texto | sim | 8 a 64 caracteres entre letras, números, `_` e `-`, começando por letra ou número | `idEnvio` |
| `email` | texto | sim | Minúsculas e sem espaço nas pontas. Regra do site (seção 5.2), até 160. Espaço no meio invalida | `email` |
| `politicaCiente` | booleano | sim | Precisa ser `true` | `politicaCiente` |
| `politicaVersao` | texto | sim | 1 a 60 caracteres | `politicaVersao` |
| `politicaCienteEm` | data ISO | sim | ISO 8601 com fuso | `politicaCienteEm` |
| `cienciaTextoVersao` | texto | não | Versão do texto da caixa de ciência. Corta em 60. Opcional pelo mesmo motivo do lead | `cienciaTextoVersao` |
| `marketingAceito` | booleano | não | Ausente vale `false`. Outro tipo é 422 | `marketingAceito` |
| `marketingTextoVersao` | texto | se marketing | 1 a 60 caracteres quando `marketingAceito` é `true` | `marketingTextoVersao` |
| `finalidade` | texto | sim | `aviso_abertura_plataforma` | `finalidade` |
| `origem` | texto | sim | `plataforma` | `origem` |
| `pagina` | texto | não | Corta em 100 | `pagina` |
| `enviadoEm` | data ISO | não | ISO 8601 com fuso. Fora disso a coluna fica vazia | `enviadoEm` |
| `preenchidoEmMs` | número | sim | Abaixo de 1200 é robô (descarte). Ausente ou não numérico é 422 | `preenchidoEmMs` |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | texto | não | Corta em 200 | uma coluna com o mesmo nome |
| `referrer` | texto | não | Corta em 500 | `referrer` |
| `landingUrl` | texto | não | Corta em 500 | `landingUrl` |
| `primeiraFonte` | texto | não | Corta em 100 | `primeiraFonte` |
| `website` | texto | deve vir vazio | Preenchido é robô | sem coluna: a validação consome |
| (servidor) `recebidoEm` | data ISO | gerado | Hora do servidor, fuso de São Paulo | `recebidoEm` |

Chave fora destas listas não vira coluna. O aviso por e-mail traz a linha "Atenção: o corpo trouxe chaves que não viram coluna", para campo novo não sumir em silêncio.

### 3.4 Respostas

| Situação | Status | Corpo | Grava | O site faz |
|---|---|---|---|---|
| Gravado | 200 | `{"ok":true,"protocolo":"<idEnvio>"}` | sim | Confirmação |
| Repetição: mesmo `idEnvio` no lead; na lista, mesmo e-mail com o mesmo consentimento de marketing | 200 | igual ao de cima | não | Confirmação |
| Robô | 200 | igual. `protocolo` é o id enviado ou `descartado` | não | Confirmação |
| Dado inválido | 422 | `{"ok":false,"erro":"validacao","campos":["nome"]}` | não | Marca o campo recusado, se a tela tiver o campo. Senão, estado de falha |
| Origin fora da lista | 403 | `{"ok":false,"erro":"origem"}` | não | Estado de falha |
| Volume acima do limite | 429, com `Retry-After: 60` | `{"ok":false,"erro":"limite"}` | não | Estado de falha |
| Planilha, credencial ou nó com falha | 503 | `{"ok":false,"erro":"indisponivel"}` | não | Estado de falha, com os dados preservados |
| JSON malformado ou workflow inativo | 400 ou 404, do próprio n8n | do n8n | não | Estado de falha |

O 200 de "Gravado" só sai depois do nó de gravação. Os outros dois 200 não passam por ele, por desenho: a repetição já está na planilha e o robô não deve ser gravado.

O `assets/site/lib/enviar.js` trata 200 sem `ok:false` como sucesso, 400 e 422 como validação e o resto como falha. Na validação, a tela marca o campo recusado e põe o foco nele: no contato, `nome`, `telefone`, `email` e `politicaCiente`; na lista, `email` e `politicaCiente`. Campo recusado que a tela não tem (por exemplo `versaoContrato` ou `preenchidoEmMs`) cai no estado de falha, porque a pessoa não consegue corrigir.

## 4. Planilha

Regras para as duas abas:

- O n8n escreve por **nome de coluna**, lido na linha 1. A ordem na aba não importa. Nome errado vira erro 503, nunca dado perdido em silêncio.
- A gravação é `RAW`: nada vira fórmula nem data. Texto fica texto, número fica número, `politicaCiente` e `marketingAceito` ficam TRUE ou FALSE nativos.
- Texto que começa com `=`, `+`, `-` ou `@` entra com um apóstrofo na frente (seção 5.3). Isso trava fórmula quando a planilha é exportada para CSV ou Excel. Tire o apóstrofo ao usar o valor.
- Coluna extra à direita é segura. O n8n só escreve as colunas que conhece. Use para anotação da equipe.
- Não deixe linha em branco no meio da aba. A gravação usa o append do Google, que procura o fim da tabela.
- Não renomeie nem apague coluna existente.

### 4.1 Aba de leads

Colunas que já existem. A ordem é a do esqueleto `n8n/flowops-lead-capture.json` (arquivo local). Confirme na planilha real (seção 17, item 1).

| Coluna | Chave | Mudança no v2 |
|---|---|---|
| `nome` | `nome` | igual |
| `empresa` | `empresa` | igual |
| `whatsapp` | derivada de `telefone` | agora só dígitos e só no canal WhatsApp. Antes era o texto digitado |
| `dor` | `dor` | passa a ser o texto das 7 opções novas |
| `mensagem` | `mensagem` | igual |
| `origem` | `origem` | passa a ser `contato`. Antes era `landing` |
| `enviadoEm` | `enviadoEm` | igual. Hora do navegador |
| `utm_source` | `utm_source` | igual |
| `utm_medium` | `utm_medium` | igual |
| `utm_campaign` | `utm_campaign` | igual |
| `utm_content` | `utm_content` | igual |
| `utm_term` | `utm_term` | igual |
| `referrer` | `referrer` | igual |
| `landingUrl` | `landingUrl` | igual |
| `recebidoEm` | gerado no servidor | igual. Hora oficial, com fuso de São Paulo |

Colunas novas, no fim. As letras valem se a aba real tiver as 15 colunas acima (A a O).

| Letra | Coluna | Chave | Tipo gravado | Observação |
|---|---|---|---|---|
| P | `versaoContrato` | `versaoContrato` | número | 2. Vazio nas linhas antigas |
| Q | `idEnvio` | `idEnvio` | texto | Chave da deduplicação |
| R | `canalRetorno` | `canalRetorno` | texto | `whatsapp`, `email` ou `ligacao` |
| S | `telefone` | `telefone` | texto | Só dígitos |
| T | `email` | `email` | texto | Em minúsculas |
| U | `melhorHorario` | `melhorHorario` | texto | O site só preenche no canal ligação |
| V | `procura` | `procura` | texto | Texto da opção |
| W | `preenchidoEmMs` | `preenchidoEmMs` | número | Tempo até enviar. Não era gravado antes |
| X | `politicaCiente` | `politicaCiente` | TRUE ou FALSE | Ciência da política. Sempre TRUE em linha gravada |
| Y | `politicaVersao` | `politicaVersao` | texto | Versão da política exibida |
| Z | `politicaCienteEm` | `politicaCienteEm` | texto ISO | Hora do aceite no navegador |
| AA | `cienciaTextoVersao` | `cienciaTextoVersao` | texto | Versão do texto da caixa de ciência que a pessoa viu |
| AB | `marketingAceito` | `marketingAceito` | TRUE ou FALSE | Opt-in separado da ciência |
| AC | `marketingTextoVersao` | `marketingTextoVersao` | texto | Versão do texto de marketing exibido |
| AD | `primeiraFonte` | `primeiraFonte` | texto | Primeiro toque da sessão |
| AE | `pagina` | `pagina` | texto | `/contato/` |

Cabeçalho das 16 colunas novas, uma por linha. Para colocar na planilha:

1. Copie o bloco abaixo e cole numa aba temporária, a partir de A1. Cada nome fica numa linha.
2. Selecione as 16 células e copie.
3. Na aba de leads, clique na primeira célula vazia da linha 1 e use **Editar > Colar especial > Colar transposto**.
4. Apague a aba temporária.

```
versaoContrato
idEnvio
canalRetorno
telefone
email
melhorHorario
procura
preenchidoEmMs
politicaCiente
politicaVersao
politicaCienteEm
cienciaTextoVersao
marketingAceito
marketingTextoVersao
primeiraFonte
pagina
```

### 4.2 Aba `lista_interesse`

Aba nova, 23 colunas, mesma técnica de colar transposto a partir de A1 da aba nova.

Um e-mail pode ter mais de uma linha: cada mudança de consentimento de marketing entra como linha nova, e **vale a linha de `recebidoEm` mais recente** do e-mail. As anteriores ficam como histórico.

| Letra | Coluna | Chave | Tipo gravado |
|---|---|---|---|
| A | `email` | `email` | texto em minúsculas. Chave da deduplicação |
| B | `recebidoEm` | gerado no servidor | texto ISO |
| C | `finalidade` | `finalidade` | texto |
| D | `origem` | `origem` | texto |
| E | `pagina` | `pagina` | texto |
| F | `marketingAceito` | `marketingAceito` | TRUE ou FALSE |
| G | `marketingTextoVersao` | `marketingTextoVersao` | texto |
| H | `politicaCiente` | `politicaCiente` | TRUE ou FALSE |
| I | `politicaVersao` | `politicaVersao` | texto |
| J | `politicaCienteEm` | `politicaCienteEm` | texto ISO |
| K | `cienciaTextoVersao` | `cienciaTextoVersao` | texto |
| L | `enviadoEm` | `enviadoEm` | texto ISO |
| M | `preenchidoEmMs` | `preenchidoEmMs` | número |
| N | `idEnvio` | `idEnvio` | texto |
| O | `versaoContrato` | `versaoContrato` | número |
| P | `utm_source` | `utm_source` | texto |
| Q | `utm_medium` | `utm_medium` | texto |
| R | `utm_campaign` | `utm_campaign` | texto |
| S | `utm_content` | `utm_content` | texto |
| T | `utm_term` | `utm_term` | texto |
| U | `referrer` | `referrer` | texto |
| V | `landingUrl` | `landingUrl` | texto |
| W | `primeiraFonte` | `primeiraFonte` | texto |

```
email
recebidoEm
finalidade
origem
pagina
marketingAceito
marketingTextoVersao
politicaCiente
politicaVersao
politicaCienteEm
cienciaTextoVersao
enviadoEm
preenchidoEmMs
idEnvio
versaoContrato
utm_source
utm_medium
utm_campaign
utm_content
utm_term
referrer
landingUrl
primeiraFonte
```

## 5. Regras de validação e normalização

### 5.1 Ordem das verificações

1. **Origin.** Fora das duas origens do site: 403. Sem cabeçalho `Origin`: 403.
2. **Corpo.** Precisa ser um objeto JSON. Senão: 422 com o campo `corpo`.
3. **Isca.** `website` preenchido: descarte. Espaços sozinhos não contam como preenchido.
4. **Tempo.** `preenchidoEmMs` numérico e abaixo de 1200: descarte. Ausente ou não numérico não descarta: é erro de contrato e cai no passo 5 como 422, para o problema aparecer na hora e nenhum lead real receber confirmação falsa.
5. **Campos.** As regras das tabelas 3.2 e 3.3. Todos os erros voltam juntos em `campos`, na ordem de verificação.
6. **Volume.** Só envio válido conta. Passou do limite por minuto ou por hora: 429 (seção 6).
7. **Metadado.** UTM, referrer, `landingUrl`, `primeiraFonte`, `pagina` e os rótulos são cortados no limite. Nunca causam 422.
8. **Montagem.** O Code devolve a linha pronta, o texto do aviso e a lista de chaves desconhecidas.

O descarte vem antes da validação de propósito: o robô não aprende as regras.

### 5.2 O servidor nunca é mais rígido que o site

O site já valida antes de enviar. Se o servidor recusar o que o site aceita, uma pessoa real vê "Não foi possível enviar agora" sem saber o motivo. Por isso as regras seguem as de `assets/site/lib/validacao.js`, e o teste automatizado compara as duas com milhares de entradas sorteadas (semente fixa).

| Regra | Formulário do site | Servidor |
|---|---|---|
| Telefone | 10 a 13 dígitos, depois de tirar máscara e `+`. Guarda sem o 55 | igual, com a mesma regra de tirar o 55 |
| E-mail | Algo antes do `@`, ponto depois do domínio, sem espaço, um só `@` | igual, mais: até 160 caracteres (o campo do site já limita) e sem caractere de controle |
| Nome | 2 ou mais caracteres, campo de 120 | 2 a 120 |
| Mensagem | Campo de 2000 | até 2000 |
| Canal e-mail | E-mail obrigatório, telefone opcional | igual |
| Canal WhatsApp ou ligação | Telefone obrigatório, e-mail opcional | igual |
| Contato opcional preenchido | Precisa valer | igual |
| Ciência da política | Obrigatória | `true` |
| `idEnvio` | `crypto.randomUUID()` ou, sem ele, `id-` mais letras e números | 8 a 64 caracteres entre `A-Z`, `a-z`, `0-9`, `_` e `-`, começando por letra ou número |

Se o site endurecer uma regra, endureça o servidor junto. Nunca o contrário.

O plano B do `idEnvio` no navegador (`id-` e base 36) não é UUID. Por isso o servidor não exige UUID.

### 5.3 Normalização

- Espaços nas pontas saem de todo texto.
- Em campo de uma linha, quebra de linha e caractere de controle viram espaço. Isso protege o assunto do e-mail.
- `mensagem` converte `CRLF` em `LF` e remove caractere de controle, mas mantém as quebras.
- `telefone` guarda só dígitos, sem o 55 do país quando o número tem 12 ou 13 dígitos e começa por 55. É a regra do `normalizarTelefone` do site, para a mesma pessoa não aparecer com dois valores na planilha.
- `email` vai para minúsculas.
- `whatsapp` nasce do `telefone` e só no canal WhatsApp.
- `marketingAceito` ausente vale `false`. Nunca se presume consentimento.
- **Proteção contra fórmula.** Todo texto que vai à planilha e começa com `=`, `+`, `-` ou `@` ganha um apóstrofo na frente (`nome`, `empresa`, `mensagem`, `dor`, `procura`, `melhorHorario`, `email`, `referrer`, `landingUrl`, `primeiraFonte`, `pagina`, as UTM e as versões). Datas, números, telefone e `idEnvio` não mudam. O aviso por e-mail mostra o texto original. A gravação `RAW` já impede fórmula dentro do Google Sheets. O apóstrofo cobre quem exporta a planilha para CSV ou Excel e quem importa em outra ferramenta.

### 5.4 Decisão depois da leitura

O nó `Code: Decidir pela leitura` recebe o que a busca devolveu e decide `falha`, `repetida` ou `gravar`.

- **Falha fechada.** O formato do item de erro do nó Google Sheets varia entre versões. Por isso a regra é positiva: só vale como resposta de busca o item vazio (nada achado) ou a linha com a coluna-chave. Qualquer outra coisa, inclusive erro em formato desconhecido, é `falha` e vira 503. O fluxo nunca grava sem ter checado a repetição.
- **Lead.** Existe linha com o mesmo `idEnvio`: `repetida`.
- **Lista.** Pega a linha de `recebidoEm` mais recente do e-mail. Mesmo `marketingAceito` que o envio atual (e, se aceito, o mesmo `marketingTextoVersao`): `repetida`. Diferente: `gravar`, e a linha nova passa a valer. Aceitar marketing de novo com outra versão do texto também grava, para o aceite do texto novo ficar registrado.
- **Idioma da planilha.** A leitura pede o valor sem formato, então `marketingAceito` chega como booleano. Se vier como texto, o nó entende `TRUE` e `VERDADEIRO` como sim e `FALSE` e `FALSO` como não, em qualquer caixa. Qualquer outro valor nunca conta como "mesmo consentimento": o resultado é `gravar`.
- O nó captura os próprios erros e nunca lança.

## 6. Anti-spam e volume

| Controle | Onde | Efeito |
|---|---|---|
| Campo isca `website` | site e servidor | 200 sem gravar e sem avisar |
| Tempo mínimo de 1200 ms (`preenchidoEmMs`) | site e servidor | 200 sem gravar e sem avisar. Tempo ausente ou não numérico é 422 |
| Header `Origin` | servidor | 403 |
| CORS do Webhook | n8n | Bloqueia outro site no navegador |
| Formato e tamanho | servidor | 422, ou corte no metadado |
| Ciência da política obrigatória | site e servidor | 422 |
| Limite de volume | servidor | 429 com `Retry-After`. Só envio válido conta. Os valores ficam nas constantes `LIMITE_POR_MINUTO` e `LIMITE_POR_HORA` do nó `Code: Validar e normalizar`; zero desliga |

- O limite protege a cota da API do Google, a caixa de e-mail do time e o tamanho da aba. Os dois valores precisam ser definidos ao importar: sem eles, o nó falha de propósito e o site recebe 503.
- Os valores, os critérios para mudá-los e as opções de proteção adicional (seção 16, item 12) ficam no documento de operação restrita, fora do repositório público.

## 7. Deduplicação

| Fluxo | Chave | Como | Resultado |
|---|---|---|---|
| Lead | `idEnvio` | `Sheets: Buscar idEnvio` procura a chave na coluna `idEnvio` | 200 sem gravar e sem novo aviso |
| Lista | `email` normalizado | `Sheets: Buscar e-mail` devolve todas as linhas do e-mail na aba `lista_interesse`. O Code decide pela mais recente | Mesmo consentimento (e, se aceito, o mesmo texto de marketing): 200 sem gravar. Consentimento diferente: grava linha nova. A resposta é igual nos dois casos e não revela que o e-mail já estava |

- O site reaproveita o `idEnvio` no "Tentar de novo" enquanto os dados não mudam. Dado editado gera id novo e vira outra linha: é uma correção legítima.
- **Os dois nós Sheets de cada workflow precisam apontar para a mesma aba.** Se a busca olhar uma aba e a gravação outra, a busca sempre acha "nada" e a deduplicação nunca dispara, sem nenhum erro. O teste de repetição do roteiro detecta. Confira as quatro abas ao importar.
- Linha repetida que escapar da deduplicação se identifica pela chave repetida na coluna `idEnvio` ou `email`. A limpeza é manual.

## 8. Gravar antes de responder

1. Valida (Code). Nada foi gravado.
2. Busca a chave na planilha e decide (Code). Nada foi gravado.
3. Monta a linha e **grava** (append).
4. Só depois responde 200.
5. Só depois envia o aviso interno.

Consequências:

- Se a gravação falhar, o site recebe 503. Nunca há confirmação falsa para uma pessoa real.
- O aviso por e-mail não atrasa a resposta. Se ele falhar, o registro já está na planilha e o time recebe o aviso de falha.
- Nem a leitura nem a gravação repetem sozinhas. Na gravação, repetir depois de uma resposta perdida poderia duplicar a linha. Na leitura, o nó trata o erro por dentro e a repetição automática do n8n não dispara. O "Tentar de novo" do site reenvia o mesmo `idEnvio`, e a busca impede a duplicata.
- O site desiste em 12 segundos. Se a planilha demorar mais, a pessoa vê a falha e o reenvio é deduplicado.

## 9. Tratamento de erro e aviso ao time

| Falha | O que o site recebe | Mensagem da execução com erro |
|---|---|---|
| Exceção no nó Code de validação | 503 | `Falha na validação. O site recebeu 503.` e o detalhe |
| Leitura da planilha falha ou devolve resposta estranha | 503 | `Falha na leitura. O site recebeu 503.` e o detalhe |
| Gravação falha (inclui coluna ausente na aba) | 503 | `Falha na gravação. O site recebeu 503.` e o detalhe |
| Aviso por e-mail falha, depois de 3 tentativas | 200, já enviado | Erro do próprio nó Gmail |
| Workflow inativo | 404 do n8n | Nada roda |

Como o aviso funciona:

1. Um nó `Set: Etapa ...` marca a etapa e copia até 50 caracteres do erro.
2. O nó `Respond: 503 falha` responde.
3. O `Stop and Error: Registrar falha` termina a execução com erro, de propósito, com a mensagem acima. Ela tem menos de 100 caracteres de propósito: já vimos o n8n cortar mensagem longa de erro em outros projetos nossos.
4. O `Error Trigger: Falha no workflow` dispara e o `Gmail: Avisar falha ao time` envia "Falha no site: <nome do workflow>" com o erro, o link da execução e o último nó executado.
5. O aviso não leva dado pessoal. O corpo recebido fica só na execução com erro, para recuperar o registro.

O que o aviso **não** mostra: o nó que falhou. O último nó executado nas falhas conhecidas é sempre o `Stop and Error`. A etapa e o detalhe vêm na linha "Erro". Para ver o nó e o erro completo, abra o link da execução.

O n8n usa o próprio workflow como workflow de erro quando ele contém um Error Trigger e o campo "Error Workflow" está vazio. Selecionar o próprio workflow no campo é equivalente e mais explícito. Prove com os testes de falha forçada do roteiro (documento de operação restrita).

**Credencial do aviso.** O aviso de falha usa a mesma credencial Gmail do aviso normal. A conferência semanal da seção 15 cobre a falha dessa credencial, e um segundo canal (Slack ou Discord) está na lista da seção 16.

**Aviso por falha.** Cada execução com erro gera um aviso. O limite de volume da seção 6 impõe um teto a esses e-mails.

Recuperar um lead de uma execução com erro: abra a execução, copie o corpo do nó Webhook, grave a linha na planilha (ou reenvie o corpo pelo roteiro do documento de operação restrita, com o mesmo `idEnvio`) e apague a execução depois.

## 10. CORS e origem

- O campo "Allowed Origins (CORS)" do nó Webhook vale `https://waveops.com.br,https://www.waveops.com.br`. **Sem espaço depois da vírgula.**
- O n8n responde o preflight e devolve `Access-Control-Allow-Origin` com a origem que pediu, se ela estiver na lista.
- O nó Code repete a lista e responde 403 quando o `Origin` está ausente ou fora dela. O CORS protege contra outro site no navegador, e o 403 barra chamada direta sem `Origin` ou com outro.
- São duas listas em dois lugares. Para acrescentar uma origem (por exemplo, um webhook de homologação), mude as duas.

Se o teste de lead novo do roteiro mostrar a resposta do POST **sem** `Access-Control-Allow-Origin`, acrescente este cabeçalho nos sete nós `Respond` (em "Options > Response Headers") e mantenha o `Cache-Control`. Para o navegador, os três de 200 são os que importam: sem o cabeçalho neles o lead grava e a tela mostra falha.

```
Nome:  Access-Control-Allow-Origin
Valor: ={{ ['https://waveops.com.br','https://www.waveops.com.br'].includes($('Webhook: Receber lead v2').first().json.headers.origin) ? $('Webhook: Receber lead v2').first().json.headers.origin : 'https://waveops.com.br' }}

Nome:  Vary
Valor: Origin
```

Na lista de interesse, troque o nome do nó para `Webhook: Receber interesse`.

## 11. Dados pessoais no fluxo (LGPD)

| Onde o dado fica | O que guarda | Por quanto tempo | Como apagar |
|---|---|---|---|
| Planilha, aba de leads | Tudo do lead | `__DEFINIR__` (retenção, gate H4) | Seção 14 |
| Planilha, aba `lista_interesse` | E-mail, consentimentos e origem. Pode haver mais de uma linha por e-mail | `__DEFINIR__` | Seção 14 |
| Histórico de versões do Google Sheets | Cópias antigas da planilha | Prazo do Google | Seção 14, passo 6 |
| Execuções com erro no n8n | Corpo recebido | Retenção do plano do n8n | Excluir a execução |
| Execuções com sucesso no n8n | Nada (`saveDataSuccessExecution: none`) | não se aplica | não se aplica |
| E-mail de aviso do lead | Nome, contato, mensagem e consentimentos | Caixa de quem recebe e "Enviados" da conta da credencial | Excluir a mensagem |
| E-mail de falha | Sem dado do lead | não se aplica | não se aplica |
| Funil do portal | Sem dado pessoal | Política do portal | não se aplica |
| Meta Pixel | Decisão jurídica em aberto (spec, seção 12, item 6) | Política do portal | não se aplica |

Consentimento, sem misturar:

- `politicaCiente` é a ciência da Política de Privacidade. É obrigatória e não autoriza marketing.
- `marketingAceito` é o opt-in separado. Só envie conteúdo e novidade para e-mails cuja linha **mais recente** (`recebidoEm`) tem `marketingAceito` TRUE.
- **O mesmo e-mail pode estar nas duas abas.** O lead guarda o e-mail em `email` (se informado) e a lista em `email`. Para decidir, junte as linhas dos dois lados pelo e-mail em minúsculas: a de `recebidoEm` mais recente decide. Se a mais recente for FALSE, não envie. Na dúvida, não envie.
- **Não envie marketing antes de existir confirmação do e-mail.** Hoje nada prova que o dono do endereço marcou a caixa: quem digitou pode ter sido outra pessoa. O TRUE registra o que foi digitado, não confirma o titular. A confirmação por e-mail (double opt-in) depende do conserto do e-mail do domínio (spec, seção 5.8).
- **O TRUE registra o que foi enviado, não prova quem é o dono do e-mail.** Regras para quando a confirmação existir: uma linha FALSE vale na hora, sem confirmação, porque sair nunca depende de prova. Uma linha TRUE só vale depois que o dono do e-mail confirmar **aquele envio**, por um token de uso único ligado ao `idEnvio` da linha. Confirmação antiga não vale para TRUE novo. O aviso de abertura da plataforma precisa dizer em uma linha por que a pessoa recebe e como sair.
- `politicaVersao`, `cienciaTextoVersao` e `marketingTextoVersao` provam qual texto a pessoa viu. `politicaCienteEm` é a hora que o navegador informou. A hora oficial é `recebidoEm`.
- O e-mail da lista de interesse serve só para avisar a abertura da plataforma, a menos que a linha mais recente tenha `marketingAceito` TRUE.

A política precisa listar n8n Cloud e Google (Sheets e Gmail) como operadores. Hoje ela não lista (spec, seção 12, item 1).

## 12. Roteiro de publicação

Nada abaixo foi feito. Cada passo é uma ação do dono ou autorizada por ele.

**Fase A. Preparar, sem tocar em produção**

1. **Exportar o workflow atual.** No n8n, abra `flowops-lead`, menu "...", Download. Guarde fora do repositório (o export traz IDs de credencial e de planilha).
2. **Comparar com a seção 17.** Anote: nome da aba, cabeçalhos da linha 1, destinatário do e-mail atual, credenciais, nós além de Sheets e Gmail.
3. **Fazer duas cópias da planilha.** Arquivo > Fazer uma cópia: "Leads WaveOps (backup AAAA-MM-DD)" e "Leads WaveOps (HML)". Não apague nada da original.
4. **Ter as credenciais.** "WaveOps Google Sheets" (Google Sheets OAuth2) e "WaveOps Gmail" (Gmail OAuth2), com esses nomes exatos.

**Fase B. Colunas, na cópia de HML**

5. Na aba de leads, cole as 16 colunas novas a partir da primeira célula vazia da linha 1 (seção 4.1, com a aba temporária que depois se apaga).
6. Crie a aba `lista_interesse` com as 23 colunas (seção 4.2).

**Fase C. Importar e configurar**

7. No n8n: Workflows > Import from file. Importe os dois JSON. Entram inativos.
8. Em cada nó Google Sheets (2 em cada workflow): credencial, **documento e aba**, nessa ordem. O n8n guarda a aba pelo número interno (gid) e o gid muda de planilha para planilha. Lead: aba de leads. Lista: `lista_interesse`. Os dois nós Sheets de cada workflow (busca e gravação) precisam apontar para a **mesma aba**: confira os quatro.
9. Em cada nó Gmail (2 em cada workflow): credencial e destinatário. Troque o `__DEFINIR__`. No topo de cada nó `Code: Validar e normalizar`, troque o `__DEFINIR__` de `LIMITE_POR_MINUTO` e `LIMITE_POR_HORA` pelos valores do documento de operação restrita.
10. Em Settings de cada workflow: confirme o fuso `America/Sao_Paulo` e selecione o próprio workflow em "Error Workflow" (salve antes, para ele aparecer na lista). Se não aparecer, deixe vazio e valide pelo T12 do roteiro restrito.
11. Abra o nó Webhook e confira o path e as origens. Copie a "Production URL".

**Fase D. Testar na cópia**

12. Ative os dois workflows (ou publique, conforme a versão do n8n). Rode o roteiro de teste do documento de operação restrita (seção 13).

**Fase E. Apontar para a planilha real**

13. Crie as colunas novas e a aba `lista_interesse` na planilha real. Em cada um dos 4 nós Sheets, troque o documento e **reescolha a aba** (o gid da cópia não existe na planilha real e daria 503), sempre a mesma nos dois nós de cada workflow. Rode só os testes de lead novo, de repetição e da lista, com dados marcados, e apague as linhas de teste. O de repetição prova que a busca e a gravação olham a mesma aba.

**Fase F. Escolher como publicar**

14. Decisão do dono. Recomendação: **path novo**.

| Opção | A favor | Contra |
|---|---|---|
| **A. Path novo** (`waveops-lead-v2`). O `flowops-lead` segue ativo | O site no ar não sofre: ele continua postando no `flowops-lead` até o corte. Cumpre a regra de 2 semanas da spec | Dois workflows ativos por um tempo |
| B. Atualizar o `flowops-lead` com o v2 | Um workflow só | O formulário do site atual deixa de funcionar na hora: ele não manda `versaoContrato`, `idEnvio` nem `politicaCiente` e receberia 422. O `config.js` do site novo teria de voltar a apontar para o path antigo. Só serve se o corte do site for no mesmo minuto |

**Fase G. Ligar no site**

15. Confira se os paths do `PRODUCAO` em `assets/site/config.js` são os mesmos dos nós Webhook: `https://cowboyhouse.app.n8n.cloud/webhook/waveops-lead-v2` e `https://cowboyhouse.app.n8n.cloud/webhook/waveops-interesse`. Hoje já são. Não precisa mexer na CSP: o `connect-src` já libera `https://cowboyhouse.app.n8n.cloud`.
16. Faça o merge do site (gates H4 e H5). Rode o teste pelo site publicado, do roteiro.
17. Registre a data do corte. Duas semanas depois, desative o `flowops-lead`.

**Rollback.** O rollback é o do site, não o do n8n: publique o deploy anterior do Netlify (spec, seção 11). O site antigo volta a postar no `flowops-lead` do jeito antigo, e esse workflow continua ativo nas duas primeiras semanas. Depois do passo 17, reative o `flowops-lead` antes de publicar o deploy anterior. Não aponte o site novo para o `flowops-lead`: ele perderia o e-mail do canal E-mail, a ciência e o consentimento em silêncio. Os workflows v2 podem ficar ativos sem tráfego. As linhas já gravadas ficam.

## 13. Roteiro de teste

O roteiro de homologação fica no documento de operação restrita, fora do repositório público. Faça tudo na cópia de HML da planilha primeiro, com dados marcados (nome começando com `TESTE`, e-mail em `example.com`), e apague as linhas e as execuções de teste no fim.

Teste automatizado, que não toca em n8n nem em planilha. Roda o código dos nós Code, simula o grafo inteiro com uma planilha em memória e confere o corpo que o código real do site monta:

```
node --test tests/site/unit/n8n-site-v2.test.mjs
```

## 14. Roteiro de exclusão de dado de titular (LGPD)

Texto a validar com o encarregado e com a revisão jurídica (gate H4).

1. **Registrar o pedido.** Data, canal e o que foi pedido, sem copiar o dado pessoal além do necessário.
2. **Confirmar quem pede.** Responda para o e-mail ou telefone que consta no registro antes de apagar.
3. **Localizar.** Na aba de leads, filtre por `email`, `telefone`, `whatsapp` e `nome`. As linhas antigas têm `whatsapp` com máscara: procure também pelos últimos 8 dígitos. Na aba `lista_interesse`, filtre por `email` e pegue **todas** as linhas do e-mail, não só a mais recente. Anote o `idEnvio` de cada linha.
4. **Decidir.** O padrão é excluir. Anonimizar (apagar `nome`, `empresa`, `whatsapp`, `telefone`, `email` e `mensagem`, mantendo origem e datas) só com a concordância do titular e do encarregado.
5. **Apagar na planilha.** Botão direito no número da linha > Excluir linha. Use Excluir, não Limpar, para não deixar linha em branco.
6. **Histórico de versões.** O Google guarda cópias antigas (Arquivo > Histórico de versões). O dado continua lá até a versão expirar. Se o pedido exigir remoção imediata: Arquivo > Fazer uma cópia (a cópia não leva o histórico), aponte os 4 nós Sheets para a cópia (documento e aba) e apague a planilha original.
7. **n8n.** O n8n não busca execução pelo conteúdo. Em Executions, filtre por erro, abra as execuções do período do titular e confira o corpo no nó Webhook. Exclua as que tiverem o dado. As execuções com sucesso não guardam dado.
8. **E-mails.** No Gmail de quem recebeu o aviso, pesquise o nome, o e-mail e o telefone do titular. Exclua as mensagens e esvazie a Lixeira. Faça o mesmo em "Enviados" da conta da credencial.
9. **Cópias.** Apague o dado das cópias da planilha (backup e HML), ou as próprias cópias que não precisam existir.
10. **Listas externas.** Se houver ferramenta de envio de e-mail ou de campanha, remova o contato dela. Hoje nenhuma está documentada.
11. **Registrar a conclusão.** Data, o que foi excluído, onde, quem executou. Responda ao titular.
12. **Prazo e base legal de retenção:** `__DEFINIR__` com o encarregado. Referência: a LGPD fixa 15 dias para a declaração de acesso (art. 19, II).

Outros pedidos:

- **Revogar marketing, sem excluir.** Na planilha de leads, mude `marketingAceito` para FALSE e anote a data numa coluna manual à direita (por exemplo, `anotacoesLgpd`). Na lista de interesse, acrescente uma linha com `marketingAceito` FALSE e `recebidoEm` atual, ou peça para a pessoa reenviar o formulário sem marcar a caixa: a linha mais recente vale. O n8n ignora colunas que não conhece.
- **Sair da lista de interesse.** Exclua todas as linhas do e-mail em `lista_interesse`. O cartão de confirmação do site diz "é só responder o e-mail", mas nenhum e-mail é enviado hoje e a caixa do domínio não recebe. Defina um canal de saída que funcione (seção 16, item 7).

## 15. Manutenção

**Acrescentar um campo ao formulário**

1. Crie a coluna no **fim** da aba (nome exato).
2. No nó `Code: Validar e normalizar`, leia o campo, valide e inclua em `linha` (e em `CHAVES_DO_CONTRATO`).
3. No nó `Set` correspondente, acrescente a atribuição com o mesmo nome da coluna.
4. Atualize as seções 3 e 4 deste documento e o contrato pinado no teste.
5. Rode `node --test tests/site/unit/n8n-site-v2.test.mjs`.

**Mudar o limite de volume.** Edite `LIMITE_POR_MINUTO` e `LIMITE_POR_HORA` no topo do nó `Code: Validar e normalizar` de cada workflow. Zero desliga. Antes de subir, siga os critérios do documento de operação restrita: os dois workflows dividem a mesma credencial Google.

**Reexportar do n8n para o repositório.** O export traz `id` das credenciais e do workflow. Deixe só `name` nas credenciais. O teste acusa credencial com `id`, e-mail real, segredo e travessão. Volte `LIMITE_POR_MINUTO` e `LIMITE_POR_HORA` para `Number('__DEFINIR__')`: o teste acusa valor de limite no arquivo público.

**Conferência semanal.** Faça as três:

1. Compare as linhas novas da aba de leads (`origem` igual a `contato`) com o evento `lead_enviado` do `/admin/funil`. Diferença que persiste indica lead perdido ou envio duplicado. Faça o mesmo para `lista_interesse` e `interesse_plataforma`.
2. Abra a lista de execuções do n8n e procure execuções com erro. É assim que se descobre falha quando o aviso por e-mail também caiu (credencial Google vencida).
3. Procure a linha "Atenção: o corpo trouxe chaves que não viram coluna" nos avisos: o site mandou campo novo que o servidor não guarda.

**Alertas.** Todo e-mail "Falha no site" pede ação no mesmo dia. Falha de planilha significa lead que o site mostrou como erro: a pessoa continua com os dados na tela e pode tentar de novo.

## 16. O que ficou `__DEFINIR__`

| # | Item | Onde está | Quem decide | Efeito enquanto estiver vazio |
|---|---|---|---|---|
| 1 | Destinatário do aviso interno | `sendTo` dos 4 nós Gmail | Vitor | Nenhum aviso sai. A gravação não é afetada |
| 2 | Documento da planilha | `documentId` dos 4 nós Sheets | Vitor | Resposta 503 em tudo |
| 3 | Aba de leads (a atual) e aba `lista_interesse` | `sheetName` dos 4 nós Sheets | Vitor | Resposta 503 em tudo |
| 4 | Prazo de retenção de lead e de lista | Política de Privacidade (gate H4) | Vitor e encarregado | Sem prazo escrito |
| 5 | Texto e versão da política, da ciência e do marketing | `POLITICA_VERSAO`, `TEXTO_CIENCIA` e `TEXTO_MARKETING` em `assets/site/config.js` | Vitor e jurídico | O servidor aceita qualquer texto de 1 a 60 caracteres |
| 6 | Webhook de homologação com planilha separada | `HOMOLOGACAO` em `assets/site/config.js` | Vitor | O Deploy Preview do Netlify fica com o envio desligado |
| 7 | Canal de saída da lista de interesse | Texto do cartão de confirmação do site | Vitor | O texto promete um e-mail que não existe |
| 8 | Decisão D2: lista no n8n | Spec, seção 5.8 | Vitor | O JSON da lista só vale se a resposta for n8n |
| 9 | Host do webhook | `cowboyhouse.app.n8n.cloud` | Vitor | Mantido igual ao atual. Trocar exige mudar a CSP em todas as páginas e o `config.js`. Confirme de quem é essa conta do n8n antes de guardar lead da WaveOps nela |
| 10 | Segundo canal do aviso de falha (Slack ou Discord) | Ramo do Error Trigger | Vitor | O aviso de falha depende só da credencial Gmail |
| 11 | Confirmação do e-mail na lista (double opt-in) | Fora destes workflows | Vitor | Marketing da lista não deve sair |
| 12 | Proteção adicional antes do webhook | Fora destes workflows | Vitor | Opções no documento de operação restrita |
| 13 | Valores do limite de volume | `LIMITE_POR_MINUTO` e `LIMITE_POR_HORA` no topo dos 2 nós `Code: Validar e normalizar` | Vitor | O nó falha de propósito e o site recebe 503 em todo envio |

## 17. O que conferir contra o workflow real antes de publicar

Os testes citados (T1 a T20) estão no roteiro do documento de operação restrita.

| # | Item | Por que importa | Como conferir |
|---|---|---|---|
| 1 | Cabeçalhos da linha 1 da aba de leads | O append escreve por nome. Diferença vira 503 | Compare com a seção 4.1. Se diferirem, ajuste o **nome da atribuição** no nó `Set: Montar linha do lead`. Nunca renomeie a coluna |
| 2 | Nome da aba de leads | Está como `__DEFINIR__` | Veja no export |
| 3 | Nós além de Sheets e Gmail no workflow real (Discord, Slack, WhatsApp, CRM, resposta ao lead) | O esqueleto só tem Sheets e Gmail. O v2 não replica o que não conhece | Liste os nós do export. O v2 precisa ganhar o que o time usa antes do corte |
| 4 | Destinatário e formato do e-mail atual | O time pode ter filtro no Gmail pelo assunto antigo | O assunto novo é "Novo contato pelo site: <nome> (<empresa>)" |
| 5 | Credenciais: nomes e conta Google dona | O JSON espera "WaveOps Google Sheets" e "WaveOps Gmail" | Veja Credentials no n8n |
| 6 | CORS no POST | A forma como o n8n devolve `Access-Control-Allow-Origin` com duas origens não foi provada | Testes T1, T2 e T3. Se faltar, use o cabeçalho da seção 10 |
| 7 | Versões dos nós e parâmetros | Escrevi sem acesso ao n8n: Webhook 2, Code 2, IF 2.2, Set 3.4, Google Sheets 4.5, Gmail 2.1, Respond to Webhook 1.1, Stop and Error 1, Error Trigger 1 | Ao importar, abra cada nó. Confirme `useAppend`, `handlingExtraData`, `cellFormat`, `returnFirstMatch`, `readRowsUntil`, `outputFormatting`, `appendAttribution` e `responseHeaders`. No T3, `marketingAceito` FALSE precisa aparecer como FALSE e não como célula vazia |
| 8 | Item que o nó Google Sheets devolve quando falha | O formato varia. O Code de decisão aceita erro em `json.error`, eco do item de entrada e resposta estranha, sempre como falha | Teste T12b: 503 e nenhuma linha |
| 9 | Error Workflow | Depende de o n8n usar o próprio workflow quando há Error Trigger | Teste T12 |
| 10 | Dados estáticos do workflow (contador do limite de volume) | O contador depende deles | Teste T18 do roteiro restrito |
| 11 | `$now` no nó Code | Se não existir na versão, o código usa a hora UTC do servidor | Veja `recebidoEm` no T3. Deve ter fuso -03:00 |
| 12 | Fuso do `recebidoEm` | O workflow atual pode gravar em outro fuso. Linhas antigas ficam como estão | Compare uma linha antiga com uma nova |
| 13 | Aba escolhida em `mode: id` | O n8n guarda o gid da aba, não o nome | Reescolha a aba em cada nó ao trocar de documento |
| 14 | Fórmulas, filtros, gráficos, Apps Script ou painéis sobre a planilha | Colunas novas no fim não quebram intervalo fixo, mas confira | Abra os arquivos que usam a planilha |
| 15 | Retenção de execuções do plano do n8n | Define quanto tempo um corpo com erro fica guardado | Painel do n8n |
| 16 | `validate_workflow` do n8n-mcp | Não foi executado: o escopo proibiu chamar qualquer instância n8n | Rode antes de publicar, se quiser |

## 18. Limites conhecidos

- Sem linha em branco no meio da aba (append do Google).
- Marketing da lista não tem confirmação do dono do e-mail (seção 11).
- Sem e-mail de confirmação ao lead e sem confirmação do e-mail na lista. Depende do conserto do e-mail do domínio (spec, seção 5.8).
- Demais limites operacionais: documento de operação restrita.
