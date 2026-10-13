# Backup do Postgres na VPS existente

Rotina separada do portal. Exporta um banco PostgreSQL 18 em formato custom,
criptografa com GPG AES256 antes da gravação e publica a cópia somente depois
do sucesso do dump, da criptografia e da conferência de integridade.

## Escopo aprovado nesta sessão

Vitor aprovou a configuração e a primeira cópia em 11/10/2026. Railway permanece
no Hobby, a VPS mantém o plano contratado e os serviços existentes continuam
operando. Não há migração, restauração de produção ou exclusão de leads.

- Destino: `/var/backups/waveops`, proprietário root, modo `0700`.
- Segredos: novo `/etc/waveops-backup.env`, proprietário root, modo `0600`.
- Executável: `/usr/local/sbin/waveops-pg-backup`.
- Unidades: `/etc/systemd/system/waveops-pg-backup.service` e `.timer`.
- Agenda: `03:00 UTC` diariamente, equivalente a `00:00` em Brasília.
- Retenção: 7 dias. Somente arquivos regulares próprios, na raiz do destino,
  com nome validado e data do nome e mtime anteriores ou iguais ao limite.
  A retenção só acontece depois de uma nova cópia válida.

O diretório também contém o certificado público `railway-root.crt`, a trava
`.lock` e os manifestos de integridade. Certificado não é chave privada.

## Proteções

O cliente usa a imagem oficial PostgreSQL 18 fixada por digest, sem servidor,
portas publicadas ou volumes de outras aplicações. Cada contêiner tem nome
exclusivo, memória de 256 MiB, 0,5 CPU, filesystem somente leitura,
`no-new-privileges`, usuário sem privilégio e logs Docker desligados.

TLS exige `verify-ca` com a CA obtida do serviço pelo console autenticado do
Railway. O certificado do template tem CN `localhost`; o proxy público não
corresponde a esse nome. A CA específica valida a cadeia do banco. Mudança
ou renovação dessa CA exige atualização protegida, sem desabilitar TLS.

Senha entra por stdin e é exportada apenas no processo `pg_dump` dentro do
cliente. Não entra por argumento ou `Config.Env` do daemon Docker. A chave
GPG entra por descritor de pipe. Stderr dos subprocessos não é publicado:
falhas registram etapa, código de saída e status, sem registros ou segredos.
O script registra horário, duração, bytes, SHA256, formato e arquivos removidos.

Há trava contra sobreposição, prazo de 55 minutos, limite de 2 GiB por arquivo
e reserva inicial de 1 GiB livre. Falhas removem somente o parcial da própria
execução e preservam as cópias anteriores. Interrupção forçada que impeça o
bloco de limpeza pode deixar um parcial criptografado; não é cópia válida.

Cada cópia é descriptografada em pipe para `pg_restore --list`. A saída da
lista é descartada, e o restante do stream é drenado para o GPG conferir a
integridade completa. Isso confere criptografia e catálogo do arquivo.
Restauração real completa continua exigindo ensaio separado e autorizado.

## Imagem fixada e limpeza Docker

O cliente usa `--pull=never`. A imagem precisa existir antes de cada execução.
Os clientes temporários são removidos ao terminar, deixando a imagem sem
contêiner associado. `docker image prune -a` pode então removê-la, inclusive
com filtro de idade, que considera a criação da imagem.

Em 13/10/2026, Vitor autorizou repor a imagem fixada e criar o contêiner
`waveops-pg-backup-image-keep`, mantido no estado `created`, sem iniciar.
Essa referência protege a imagem da limpeza existente na VPS. Não iniciar
nem remover esse contêiner em manutenção sem revisar essa dependência.

Para provisionamento ou reparo autorizado, conferir primeiro se o nome está
livre. Se já existir, inspecionar sua configuração e parar o procedimento;
não substituir o contêiner. Usar a mesma referência do executável:

```bash
docker container ls --all --filter 'name=^/waveops-pg-backup-image-keep$' \
  --format '{{.Names}} {{.Status}}'
docker pull postgres:18-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c
docker create --name waveops-pg-backup-image-keep --pull=never \
  --network none --read-only --user 65534:65534 --cap-drop ALL \
  --security-opt no-new-privileges --log-driver none --entrypoint /bin/true \
  postgres:18-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c
docker container inspect waveops-pg-backup-image-keep \
  --format 'state={{.State.Status}} running={{.State.Running}} network={{.HostConfig.NetworkMode}} image={{.Config.Image}}'
```

A imagem declara um volume em `/var/lib/postgresql`; o Docker cria um volume
anônimo ao criar esse contêiner. Não foi passado mount de banco existente,
credencial ou variável de conexão ao contêiner de proteção, e ele nunca foi
iniciado. Esse volume automático não é uma cópia do banco nem faz parte da
verificação do backup. Não afirmar que o contêiner tem zero mounts.

## Provisionamento protegido

Antes de instalar, confirmar ausência dos caminhos nominais e autorização
para a infraestrutura. Não substituir arquivos de outra rotina ou `.env`.
O executável oferece um assistente que aceita somente a criação inicial:

```bash
/usr/local/sbin/waveops-pg-backup --configure \
  --expected-host HOST_DO_PROXY --expected-port PORTA_DO_PROXY
```

No terminal autenticado, inserir `DATABASE_PUBLIC_URL` do serviço Postgres e
uma chave aleatória com pelo menos 32 caracteres, confirmada duas vezes.
Guardar a chave em gerenciador de senhas ou cofre independente da VPS antes
de prosseguir. As entradas ficam ocultas e não passam pelo chat. Não usar
`echo`, argumentos de comando, clipboard automatizado ou logs para segredos.

O arquivo protegido contém seis variáveis, com valores serializados como
strings JSON: `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` e
`BACKUP_PASSPHRASE`. Não é executado como código de shell e não é carregado
como `EnvironmentFile` pelo systemd. Não imprimir seu conteúdo.

Após provisionar, executar a primeira cópia pelo serviço, confirmar resultado
e manifesto, conferir SHA256, e só então ativar o timer. `Persistent=true`
recupera um disparo perdido quando a VPS volta a operar.

```bash
systemd-analyze verify /etc/systemd/system/waveops-pg-backup.service \
  /etc/systemd/system/waveops-pg-backup.timer
systemctl daemon-reload
systemctl start waveops-pg-backup.service
systemctl show waveops-pg-backup.service -p Result -p ExecMainStatus
systemctl enable --now waveops-pg-backup.timer
systemctl list-timers waveops-pg-backup.timer
```

Em falha, consultar somente o status redigido da rotina no journal. Não
reexecutar com `set -x`, não expor o ambiente e não ativar o timer antes de
validar a configuração. A execução retorna `75` se outra cópia detém a trava.

## Verificação local com dados fictícios

Docker local, sem acesso ao banco de produção:

```bash
docker build -t waveops-backup-tests:local -f tests/Dockerfile .
docker run --rm --network none \
  --mount "type=bind,source=$PWD,target=/work,readonly" waveops-backup-tests:local
docker run --rm --network none --memory 512m --cpus 1 \
  --mount "type=bind,source=$PWD,target=/work,readonly" \
  waveops-backup-tests:local python3 tests/integration.py
python3 tests/docker_stdin.py
```

Os testes cobrem falha de dump/criptografia/validação, arquivo parcial,
concorrência, prazo, limite de tamanho, permissões e retenção. A integração
inicia PostgreSQL 18 isolado com socket local, exporta duas linhas fictícias,
criptografa e restaura em outro banco isolado, conferindo os valores. O teste
de fronteira Docker roda no host e verifica o recebimento de credencial
fictícia por stdin, sua ausência de `Config.Env` e a versão principal do cliente.

## Recuperação e limites

Em 13/10/2026, o ensaio lógico real autorizado restaurou a cópia mais nova
em PostgreSQL 18 descartável na própria VPS, sem rede nem portas, usando
somente tmpfs. GPG e restauração concluíram com código 0; contagens técnicas
foram conferidas, o laboratório foi removido e as três cópias criptografadas
mantiveram SHA256 e manifestos válidos. O timer diário permaneceu ativo.
Esse ensaio usou `--no-owner` e `--no-privileges`, sem reproduzir os papéis
e permissões originais. Um próximo ensaio exige autorização própria.

Para recuperação, usar a chave guardada fora da VPS e um PostgreSQL 18 isolado,
descriptografando diretamente para `pg_restore`. Não enviar dados de produção
ao modelo. A cópia lógica cobre este banco; não cobre papéis globais, outros
bancos, arquivos de aplicação ou recuperação ponto a ponto.

As cópias ficam na VPS existente. O backup semanal nativo da VPS tem sua própria
política e pode preservar versões além dos 7 dias da rotina. Registrar esse
escopo na revisão H4. Perda da VPS e do acesso ao provedor ainda afeta a
recuperação. Não há novo plano; CPU, disco e tráfego continuam sujeitos ao
consumo contratado. Esta rotina não encerra a revisão jurídica H4.
