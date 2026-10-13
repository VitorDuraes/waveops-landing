"""Exporta e restaura PostgreSQL 18 local, com duas linhas fictícias.

Rodar apenas na imagem tests/Dockerfile. Nenhuma porta é publicada.
"""

import importlib.machinery
import importlib.util
import os
from pathlib import Path
import pwd
import secrets
import subprocess
import tempfile


loader = importlib.machinery.SourceFileLoader("backup", str(Path(__file__).resolve().parents[1] / "waveops-pg-backup"))
spec = importlib.util.spec_from_loader(loader.name, loader)
backup = importlib.util.module_from_spec(spec)
loader.exec_module(backup)


def checked(args, **kwargs):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)


with tempfile.TemporaryDirectory(prefix="waveops-pg-fixture-") as temporary:
    parent = Path(temporary)
    postgres = pwd.getpwnam("postgres")
    os.chown(parent, postgres.pw_uid, postgres.pw_gid)
    data = parent / "data"
    checked(["runuser", "-u", "postgres", "--", "initdb", "-D", str(data), "--auth=trust"])
    checked(["runuser", "-u", "postgres", "--", "pg_ctl", "-D", str(data), "-l", str(parent / "postgres.log"),
             "-o", "-k " + str(parent) + " -p 55432 -c listen_addresses=''", "-w", "start"])
    try:
        env = os.environ.copy()
        env.update({"PGHOST": str(parent), "PGPORT": "55432", "PGUSER": "postgres", "PGDATABASE": "postgres"})
        checked(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE fixture_source"], env=env)
        checked(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE fixture_restore"], env=env)
        env["PGDATABASE"] = "fixture_source"
        checked(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-c",
                 "CREATE TABLE fixture (id integer PRIMARY KEY, value text NOT NULL); "
                 "INSERT INTO fixture VALUES (1, 'registro-ficticio'), (2, 'segunda-fixture');"], env=env)
        copies = parent / "copies"
        copies.mkdir(mode=0o700)
        key = secrets.token_urlsafe(32)
        result = backup.create_backup(copies, key,
            ["pg_dump", "--no-password", "--format=custom", "--compress=6", "--lock-wait-timeout=30s"],
            ["/bin/sh", "-c", 'pg_restore --list >/dev/null; result=$?; cat >/dev/null; exit "$result"'],
            process_env=env)
        env["PGDATABASE"] = "fixture_restore"
        fd = backup.secret_fd(key)
        with tempfile.TemporaryDirectory(prefix="waveops-gpg-fixture-") as home:
            decrypt = subprocess.Popen(backup.gpg_args(home, fd) + ["--decrypt", str(copies / result["file"])],
                pass_fds=(fd,), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            os.close(fd)
            restore = subprocess.Popen(["pg_restore", "--no-owner", "--no-privileges", "--exit-on-error", "-d", "fixture_restore"],
                stdin=decrypt.stdout, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            decrypt.stdout.close()
            assert restore.wait(timeout=30) == 0, "Restauração fictícia falhou"
            assert decrypt.wait(timeout=30) == 0, "Integridade GPG falhou"
        actual = checked(["psql", "-X", "-At", "-c", "SELECT id || ':' || value FROM fixture ORDER BY id"], env=env).stdout
        assert actual == b"1:registro-ficticio\n2:segunda-fixture\n", "Conteúdo fictício divergente após restauração"
        print("PG18_INTEGRATION_OK: dump criptografado, GPG válido e restauração fictícia conferida")
    finally:
        checked(["runuser", "-u", "postgres", "--", "pg_ctl", "-D", str(data), "-m", "fast", "-w", "stop"])
