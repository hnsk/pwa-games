"""`devctl compose` — single entry point for `docker compose`.

Thin wrapper around one compose file (path from `tools/devctl.toml`).
No overlay merging: a project that needs extra service stacks edits its
own compose file or adds a second one and points devctl.toml at it.

Not captured: this is the interactive/passthrough path (`up`, `down`,
`exec`). For re-readable output use `devctl run` / `logs` / `ps`, which
wrap their docker-compose call in capture.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

from ..paths import Layout, layout


def build_compose_argv(lay: Layout) -> list[str]:
    cf = lay.docker_compose
    if not cf.is_file():
        print(f"compose: no compose file at {cf} "
              f"(check tools/devctl.toml [compose].file)", file=sys.stderr)
        raise SystemExit(2)
    return ["docker", "compose", "-f", str(cf)]


def compose_env(lay: Layout) -> dict[str, str]:
    """Env for every compose invocation.

    DEVCTL_ROOT is the host repo root, referenced by the compose file's
    bind mount so the project source lands at the container working dir.
    """
    env = os.environ.copy()
    env["DEVCTL_ROOT"] = str(lay.root)
    profiles = lay.config().profiles
    if profiles:
        env["COMPOSE_PROFILES"] = ",".join(profiles)
    return env


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser(
        "compose",
        help="docker compose wrapper (single compose file from devctl.toml)",
    )
    p.add_argument("compose_cmd", help="up | down | exec | build | ...")
    p.add_argument(
        "rest", nargs=argparse.REMAINDER,
        help="Extra args forwarded to docker compose (use `--` to separate).",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    lay = layout()
    rest = list(args.rest or [])
    if rest and rest[0] == "--":
        rest = rest[1:]

    base = build_compose_argv(lay)
    if args.compose_cmd == "up":
        argv = base + ["up", "-d", *rest]
    else:
        argv = base + [args.compose_cmd, *rest]

    return subprocess.call(argv, env=compose_env(lay))
