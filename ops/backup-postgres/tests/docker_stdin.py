"""Confere o canal stdin e a ausência de senha nos metadados do Docker local.

Credencial aleatória fictícia, cliente PG18, sem conexão ou portas publicadas.
Rodar pelo Python do host que tem Docker CLI.
"""

import json
import secrets
import subprocess
import time
import uuid


name = "waveops-stdin-fixture-" + uuid.uuid4().hex
credential = secrets.token_urlsafe(32)
image = "postgres:18-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c"
args = ["docker", "run", "--rm", "--pull=never", "--name", name, "--read-only",
        "--cap-drop=ALL", "--security-opt=no-new-privileges", "--user", "65534:65534",
        "--memory=256m", "--cpus=0.5", "--pids-limit=64", "--log-driver=none",
        "--network=none", "-i", "--entrypoint", "/bin/sh", image, "-c",
        "IFS= read -r PGPASSWORD || exit 76; export PGPASSWORD; "
        'test -n "$PGPASSWORD" || exit 77; exec pg_dump --version']
client = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
try:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        inspected = subprocess.run(["docker", "inspect", "--format", "{{json .Config.Env}}", name],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5)
        if inspected.returncode == 0:
            env = json.loads(inspected.stdout)
            assert all(not value.startswith("PGPASSWORD=") for value in env), "Senha no Config.Env"
            assert credential not in inspected.stdout.decode(), "Credencial nos metadados"
            break
        time.sleep(0.2)
    else:
        raise AssertionError("Cliente Docker fictício não iniciou")
    stdout, _ = client.communicate(input=(credential + "\n").encode(), timeout=20)
    assert client.returncode == 0, "Falha no recebimento pelo stdin"
    assert stdout.startswith(b"pg_dump (PostgreSQL) 18."), "Cliente incompatível"
    assert credential not in stdout.decode(), "Credencial na saída"
    print("DOCKER_STDIN_OK: credencial fictícia por stdin, ausente do Config.Env e da saída")
finally:
    if client.poll() is None:
        client.terminate()
        client.wait(timeout=5)
    subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
