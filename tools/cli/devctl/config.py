"""Project-tunable config loader (`tools/devctl.toml`).

Parsed with stdlib `tomllib` (Python 3.11+), so the CLI has zero
third-party runtime dependencies. Every field has a safe default, so a
missing or partial devctl.toml still works.

Schema:

    [compose]
    file            = "tools/docker-compose.yml"   # repo-root-relative
    default_service = "dev"                          # shell / run / logs target
    profiles        = []                             # COMPOSE_PROFILES list

    [test]
    service  = "test"           # compose service `devctl test` runs in
    command  = ""               # --full; `devctl run` no-argv fallback too
    unit     = ""               # --unit  (empty → falls back to command)
    changed  = ""               # --changed (a `{files}` token → changed list)
    ci       = ""               # --ci    (CI entrypoint)
    parallel = ""               # appended when --parallel is given

    [clean]
    targets = ["tmp"]           # repo-root-relative dirs `devctl clean` may wipe
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Config:
    compose_file: str = "tools/docker-compose.yml"
    default_service: str = "dev"
    profiles: list[str] = field(default_factory=list)
    test_service: str = "test"
    test_command: str = ""
    test_unit: str = ""
    test_changed: str = ""
    test_ci: str = ""
    test_parallel: str = ""
    clean_targets: list[str] = field(default_factory=lambda: ["tmp"])


def _str_list(value, where: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        raise SystemExit(f"devctl.toml: {where} must be a list of strings")
    return list(value)


def load_config(path: Path) -> Config:
    if not path.is_file():
        return Config()
    try:
        data = tomllib.loads(path.read_text())
    except tomllib.TOMLDecodeError as e:
        raise SystemExit(f"devctl.toml: parse error: {e}") from e

    compose = data.get("compose", {}) or {}
    test = data.get("test", {}) or {}
    clean = data.get("clean", {}) or {}

    defaults = Config()
    return Config(
        compose_file=str(compose.get("file", defaults.compose_file)),
        default_service=str(compose.get("default_service", defaults.default_service)),
        profiles=_str_list(compose.get("profiles"), "compose.profiles"),
        test_service=str(test.get("service", defaults.test_service)),
        test_command=str(test.get("command", defaults.test_command)),
        test_unit=str(test.get("unit", defaults.test_unit)),
        test_changed=str(test.get("changed", defaults.test_changed)),
        test_ci=str(test.get("ci", defaults.test_ci)),
        test_parallel=str(test.get("parallel", defaults.test_parallel)),
        clean_targets=_str_list(clean.get("targets"), "clean.targets")
        or defaults.clean_targets,
    )
