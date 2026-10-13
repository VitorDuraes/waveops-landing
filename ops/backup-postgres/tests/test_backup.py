"""Testes de falha, sigilo, publicação e retenção. Somente dados fictícios."""

import contextlib
import datetime as dt
import fcntl
import importlib.machinery
import importlib.util
import io
import json
import os
from pathlib import Path
import secrets
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "waveops-pg-backup"
loader = importlib.machinery.SourceFileLoader("backup", str(SCRIPT))
spec = importlib.util.spec_from_loader(loader.name, loader)
backup = importlib.util.module_from_spec(spec)
loader.exec_module(backup)


def python_command(code):
    return [sys.executable, "-c", code]


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="waveops-backup-test-")
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name) / "copies"
        self.directory.mkdir(mode=0o700)
        self.key = secrets.token_urlsafe(32)
        self.dump = python_command("import sys; sys.stdout.buffer.write(b'PGDMPfixture-ficticia')")
        self.verify = python_command(
            "import sys; data=sys.stdin.buffer.read(); sys.exit(0 if data == b'PGDMPfixture-ficticia' else 44)"
        )

    def run_copy(self, **kwargs):
        return backup.create_backup(
            self.directory, self.key, kwargs.pop("dump_args", self.dump),
            kwargs.pop("verify_args", self.verify), process_env=os.environ.copy(), **kwargs
        )

    def old_copy(self):
        path = self.directory / "waveops-pg-20260101T030000Z-12345678.dump.gpg"
        path.write_bytes(b"copia-anterior-ficticia")
        os.utime(path, (1, 1))
        return path

    def assert_no_published_or_partial(self, old):
        self.assertEqual(list(self.directory.glob("*.dump.gpg")), [old])
        self.assertEqual(list(self.directory.glob("*.partial")), [])
        self.assertEqual(list(self.directory.glob("*.json")), [])

    def test_success_publishes_only_encrypted_bytes_and_integrity_metadata(self):
        result = self.run_copy()
        archive = self.directory / result["file"]
        self.assertNotIn(b"fixture-ficticia", archive.read_bytes())
        secret_read, secret_write = os.pipe()
        os.write(secret_write, (self.key + "\n").encode())
        os.close(secret_write)
        try:
            decrypted = subprocess.run(
                ["gpg", "--batch", "--pinentry-mode", "loopback", "--passphrase-fd",
                 str(secret_read), "--decrypt", str(archive)], pass_fds=(secret_read,),
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=True
            ).stdout
        finally:
            os.close(secret_read)
        self.assertEqual(decrypted, b"PGDMPfixture-ficticia")
        manifest = json.loads(archive.with_suffix(archive.suffix + ".json").read_text())
        self.assertEqual(manifest["sha256"], result["sha256"])
        self.assertEqual(manifest["status"], "ok")
        self.assertEqual(len(manifest["sha256"]), 64)
        for path in (archive, archive.with_suffix(archive.suffix + ".json")):
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertEqual(list(self.directory.glob("*.partial")), [])

    def test_failed_dump_preserves_prior_copy_and_never_logs_source_error(self):
        old = self.old_copy()
        output = io.StringIO()
        failing = python_command(
            "import sys; sys.stdout.buffer.write(b'PGDMPfixture-ficticia'); "
            "sys.stderr.write('conteudo-ficticio-restrito'); sys.exit(42)"
        )
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            with self.assertRaises(backup.BackupError) as caught:
                self.run_copy(dump_args=failing)
        self.assertEqual(caught.exception.stage, "dump")
        self.assertEqual(caught.exception.returncode, 42)
        self.assertNotIn("conteudo-ficticio-restrito", output.getvalue())
        self.assertNotIn(self.key, output.getvalue())
        self.assert_no_published_or_partial(old)

    def test_failed_encryption_never_publishes_partial_or_prunes_prior_copy(self):
        old = self.old_copy()
        with self.assertRaises(backup.BackupError) as caught:
            self.run_copy(encrypt_args=python_command("import sys; sys.exit(43)"))
        self.assertEqual(caught.exception.stage, "encrypt")
        self.assert_no_published_or_partial(old)

    def test_invalid_archive_is_rejected_before_publish_and_retention(self):
        old = self.old_copy()
        with self.assertRaises(backup.BackupError) as caught:
            self.run_copy(verify_args=python_command("import sys; sys.stdin.buffer.read(); sys.exit(44)"))
        self.assertEqual(caught.exception.stage, "verify")
        self.assert_no_published_or_partial(old)

    def test_lock_prevents_overlapping_jobs(self):
        with (self.directory / ".lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaises(backup.BackupError) as caught:
                self.run_copy()
        self.assertEqual(caught.exception.stage, "busy")
        self.assertEqual(list(self.directory.glob("*.dump.gpg")), [])

    def test_timeout_cleans_partial_and_preserves_prior_copy(self):
        old = self.old_copy()
        with self.assertRaises(backup.BackupError) as caught:
            self.run_copy(dump_args=python_command("import time; time.sleep(10)"), timeout=0.3)
        self.assertEqual(caught.exception.stage, "timeout")
        self.assert_no_published_or_partial(old)

    def test_size_limit_cleans_partial_before_consuming_all_disk(self):
        old = self.old_copy()
        with self.assertRaises(backup.BackupError) as caught:
            self.run_copy(max_bytes=1)
        self.assertEqual(caught.exception.stage, "capacity")
        self.assert_no_published_or_partial(old)

    def test_symlink_destination_is_rejected_without_writing_target(self):
        link = Path(self.tmp.name) / "link"
        link.symlink_to(self.directory, target_is_directory=True)
        with self.assertRaises(backup.BackupError) as caught:
            backup.create_backup(link, self.key, self.dump, self.verify, process_env=os.environ.copy())
        self.assertEqual(caught.exception.stage, "directory")
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_retention_removes_only_own_regular_files_at_seven_day_boundary(self):
        now = dt.datetime(2026, 10, 11, 3, tzinfo=dt.timezone.utc)
        cutoff = dt.datetime(2026, 10, 4, 3, tzinfo=dt.timezone.utc).timestamp()
        edge = self.directory / "waveops-pg-20261004T030000Z-12345678.dump.gpg"
        fresh = self.directory / "waveops-pg-20261004T030001Z-12345678.dump.gpg"
        alien = self.directory / "outro-backup.dump.gpg"
        touched = self.directory / "waveops-pg-20261001T030000Z-12345678.dump.gpg"
        outside = Path(self.tmp.name) / "fora.dump.gpg"
        link = self.directory / "waveops-pg-20261001T030000Z-87654321.dump.gpg"
        nested = self.directory / "nested"
        nested.mkdir()
        deep = nested / "waveops-pg-20261001T030000Z-12345678.dump.gpg"
        for path in (edge, fresh, alien, touched, outside, deep):
            path.write_bytes(b"fixture")
            os.utime(path, (cutoff, cutoff))
        os.utime(touched, (now.timestamp(), now.timestamp()))
        edge_manifest = edge.with_suffix(edge.suffix + ".json")
        edge_manifest.write_text("{}")
        os.utime(edge_manifest, (cutoff, cutoff))
        link.symlink_to(outside)
        self.assertEqual(backup.retain_backups(self.directory, now), 1)
        self.assertFalse(edge.exists())
        self.assertFalse(edge_manifest.exists())
        for path in (fresh, alien, touched, outside, link, deep):
            self.assertTrue(path.exists())

    def test_invalid_database_input_never_creates_secret_config(self):
        config = Path(self.tmp.name) / "backup.env"
        url = "postgresql://postgres:" + secrets.token_urlsafe(16) + "@fixture.proxy.rlwy.net:58157/railway%20dbname%3Dother"
        with patch.object(backup, "CONFIG", config), patch.object(backup.os, "isatty", return_value=True), patch.object(
                backup.getpass, "getpass", side_effect=[url, self.key, self.key]):
            with self.assertRaises(backup.BackupError) as caught:
                backup.configure(config, "fixture.proxy.rlwy.net", 58157)
        self.assertEqual(caught.exception.stage, "config")
        self.assertFalse(config.exists())

    def test_readable_secret_config_is_rejected_before_using_credentials(self):
        config = Path(self.tmp.name) / "backup.env"
        config.write_text("# fictício\n")
        config.chmod(0o644)
        with self.assertRaises(backup.BackupError) as caught:
            backup.read_config(config)
        self.assertEqual(caught.exception.stage, "config")

    def test_credential_input_refuses_non_tty_before_prompt_or_config_write(self):
        config = Path(self.tmp.name) / "backup.env"
        with patch.object(backup, "CONFIG", config), patch.object(backup.os, "isatty", return_value=False):
            with self.assertRaises(backup.BackupError) as caught:
                backup.configure(config, "fixture.proxy.rlwy.net", 58157)
        self.assertEqual(caught.exception.stage, "tty")
        self.assertFalse(config.exists())

    def test_dump_receives_credential_via_stdin_without_environment_or_argument(self):
        env = os.environ.copy()
        env.pop("PGPASSWORD", None)
        dump = python_command(
            "import os,sys; credential=sys.stdin.buffer.readline(); "
            "sys.exit(48) if 'PGPASSWORD' in os.environ or not credential.startswith(b'fixture-') else None; "
            "sys.stdout.buffer.write(b'PGDMPfixture-ficticia')"
        )
        result = backup.create_backup(self.directory, self.key, dump, self.verify, process_env=env,
                                      dump_input=("fixture-" + secrets.token_urlsafe(32) + "\n").encode())
        self.assertEqual(result["status"], "ok")

    def test_cleanup_attempts_second_owned_container_when_first_query_times_out(self):
        calls = []
        def runner(args, **kwargs):
            calls.append(args)
            if "waveops-dump-first" in " ".join(args):
                raise subprocess.TimeoutExpired(args, 15)
            if "ls" in args:
                return subprocess.CompletedProcess(args, 0, b"fixture-id\n")
            return subprocess.CompletedProcess(args, 0, b"")
        with self.assertRaises(backup.BackupError) as caught:
            backup.cleanup_containers(["waveops-dump-first", "waveops-verify-second"], runner=runner)
        self.assertEqual(caught.exception.stage, "cleanup")
        self.assertIn(["docker", "rm", "-f", "waveops-verify-second"], calls)


if __name__ == "__main__":
    unittest.main()
