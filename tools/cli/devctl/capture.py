"""Core capture API: open a log, tee a subprocess, finalize a manifest.

CLI subcommand wiring lives in `devctl.commands.capture`.

Usage from other commands:

    with run_capture(tag="compose.up", command_name="compose") as cap:
        rc = cap.run(["docker", "compose", "up", "-d"])
    # cap.manifest holds the finalized Manifest after the `with` block.

Refusal case (raises ValueError):
- an explicit --log-dir that resolves outside the repo working tree
"""

from __future__ import annotations

import datetime as dt
import subprocess
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from .manifest import SCHEMA_VERSION, Manifest
from .paths import layout

SCOPE = "project"


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_now_compact() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")


def resolve_log_dir(*, run_id: str, log_dir: Path | None) -> Path:
    """Returns the run's log dir. Raises ValueError if --log-dir escapes root."""
    lay = layout()
    if log_dir is not None:
        abs_dir = log_dir.resolve()
        try:
            abs_dir.relative_to(lay.root)
        except ValueError as e:
            raise ValueError(f"log-dir {abs_dir} is outside repo {lay.root}") from e
        return abs_dir
    return lay.logs / run_id


@dataclass
class CaptureResult:
    manifest: Manifest
    manifest_path: Path
    log_path: Path
    exit_code: int


@contextmanager
def run_capture(
    *,
    tag: str = "cmd",
    command_name: str,
    run_id: str | None = None,
    log_dir: Path | None = None,
    print_status: bool = True,
) -> Iterator["Capture"]:
    """Open a log + finalize a manifest on exit. See module docstring."""
    rid = run_id or f"{_utc_now_compact()}-{tag}"
    log_root = resolve_log_dir(run_id=rid, log_dir=log_dir)
    log_root.mkdir(parents=True, exist_ok=True)
    log_path = log_root / f"{tag}.log"
    manifest_path = log_root / "manifest.json"

    cap = Capture(
        tag=tag,
        run_id=rid,
        command_name=command_name,
        log_path=log_path,
        manifest_path=manifest_path,
    )
    cap._open()
    if print_status:
        print(f"LOG={log_path}")

    started = _utc_now_iso()
    started_epoch = dt.datetime.now(dt.timezone.utc).timestamp()

    try:
        yield cap
    finally:
        finished = _utc_now_iso()
        duration = int(dt.datetime.now(dt.timezone.utc).timestamp() - started_epoch)
        cap._finalize(started=started, finished=finished, duration=duration)
        if print_status:
            print(f"EXIT={cap.exit_code}")
            print(f"STATUS={cap.manifest.status} RUN={rid} MANIFEST={manifest_path}")


class Capture:
    """Per-run handle: open log file + collected manifest fields."""

    def __init__(
        self,
        *,
        tag: str,
        run_id: str,
        command_name: str,
        log_path: Path,
        manifest_path: Path,
    ) -> None:
        self.tag = tag
        self.run_id = run_id
        self.command_name = command_name
        self.log_path = log_path
        self.manifest_path = manifest_path
        self.exit_code: int = 0
        self.argv: list[str] = []
        self.artifacts: list[dict] = []
        self.git: dict = {}
        self.env: dict = {}
        self._fh = None
        self.manifest: Manifest | None = None

    def _open(self) -> None:
        self._fh = self.log_path.open("w", buffering=1)

    def write(self, line: str) -> None:
        """Write a free-form line to the log only (not stdout)."""
        assert self._fh is not None
        self._fh.write(line if line.endswith("\n") else line + "\n")

    def echo(self, line: str) -> None:
        """Write to log AND parent stdout."""
        self.write(line)
        sys.stdout.write(line if line.endswith("\n") else line + "\n")

    def run(self, argv: list[str], **kwargs) -> int:
        """Run a subprocess; tee combined stdout+stderr to log + parent stdout."""
        assert self._fh is not None
        self.argv = list(argv)
        self.write(f"$ {' '.join(argv)}")
        proc = subprocess.Popen(
            argv,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            **kwargs,
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            self._fh.write(line)
            sys.stdout.write(line)
        rc = proc.wait()
        self.exit_code = rc
        return rc

    def _finalize(self, *, started: str, finished: str, duration: int) -> None:
        if self._fh is not None:
            self._fh.close()
            self._fh = None
        status = "success" if self.exit_code == 0 else "failure"
        self.manifest = Manifest(
            schema_version=SCHEMA_VERSION,
            run_id=self.run_id,
            scope=SCOPE,
            command=self.command_name,
            argv=self.argv,
            args=self.argv[1:] if self.argv else [],
            tag=self.tag,
            started_at=started,
            finished_at=finished,
            duration_seconds=duration,
            exit_code=self.exit_code,
            status=status,
            log=str(self.log_path),
            logs={self.tag: str(self.log_path)},
            artifacts=self.artifacts,
            git=self.git,
            env=self.env,
        )
        self.manifest.write(self.manifest_path)
        self._append_index()

    def _append_index(self) -> None:
        assert self.manifest is not None
        idx = layout().logs / "index.jsonl"
        idx.parent.mkdir(parents=True, exist_ok=True)
        with idx.open("a") as fh:
            fh.write(self.manifest.to_index_line(self.manifest_path))
