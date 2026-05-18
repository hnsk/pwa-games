"""Filesystem layout helpers — single source of truth for repo paths.

Generic: no issue/branch concept. The repo root is wherever the project
that adopted this scaffold lives; `tools/` holds the helper CLI and its
captured logs.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .config import Config, load_config


def repo_root() -> Path:
    """Resolve the repo root by walking up from this file.

    tools/cli/devctl/paths.py  →  root is 4 levels up.
    """
    here = Path(__file__).resolve()
    return here.parents[3]


@dataclass(frozen=True)
class Layout:
    root: Path

    @property
    def tools(self) -> Path:
        return self.root / "tools"

    @property
    def logs(self) -> Path:
        return self.tools / "logs"

    @property
    def config_path(self) -> Path:
        return self.tools / "devctl.toml"

    def config(self) -> Config:
        return load_config(self.config_path)

    @property
    def docker_compose(self) -> Path:
        """Compose file, resolved relative to repo root from devctl.toml."""
        return (self.root / self.config().compose_file).resolve()


def layout() -> Layout:
    return Layout(repo_root())
