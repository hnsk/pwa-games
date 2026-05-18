"""Run manifest schema (v1).

Every command that performs work writes a manifest.json + appends a
one-line entry to tools/logs/index.jsonl. The schema is meant to be
consumed by tooling/agents, so changes here are breaking — bump
SCHEMA_VERSION.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

SCHEMA_VERSION = 1


@dataclass
class Manifest:
    schema_version: int
    run_id: str
    scope: str                    # always "project" in the generic scaffold
    command: str                  # command name (e.g. "compose")
    argv: list[str]               # full argv as run
    args: list[str] = field(default_factory=list)
    tag: str = "cmd"
    started_at: str = ""          # ISO-8601 UTC, e.g. 2026-05-18T14:22:33Z
    finished_at: str = ""
    duration_seconds: int = 0
    exit_code: int = 0
    status: str = "pending"       # "success" | "failure" | "pending"
    log: str = ""                 # absolute path to combined log
    logs: dict[str, str] = field(default_factory=dict)
    artifacts: list[dict] = field(default_factory=list)
    git: dict = field(default_factory=dict)
    env: dict = field(default_factory=dict)

    def to_json(self, indent: int | None = 2) -> str:
        return json.dumps(asdict(self), indent=indent, sort_keys=False)

    def write(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.to_json() + "\n")

    def to_index_line(self, manifest_path: Path) -> str:
        """Compact one-line summary for tools/logs/index.jsonl."""
        line = {
            "run_id":           self.run_id,
            "scope":            self.scope,
            "command":          self.command,
            "tag":              self.tag,
            "started_at":       self.started_at,
            "finished_at":      self.finished_at,
            "duration_seconds": self.duration_seconds,
            "exit_code":        self.exit_code,
            "status":           self.status,
            "log":              self.log,
            "manifest":         str(manifest_path),
        }
        return json.dumps(line) + "\n"
