"""`devctl shell` — interactive shell in a running service container.

Thin wrapper around `docker compose exec`. The container must already be
running (`devctl compose up`). Interactive: the TTY is wired straight
through and this is NOT captured. For re-readable output use
`devctl run` (one-shot, captured).
"""

from __future__ import annotations

import argparse
import subprocess

from ..paths import layout
from .compose import build_compose_argv, compose_env


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser(
        "shell",
        help="Interactive shell inside a running service container.",
    )
    p.add_argument(
        "--service", default=None,
        help="Compose service (default: [compose].default_service).",
    )
    p.add_argument(
        "--user", default=None,
        help="User to exec as (passed to `docker compose exec --user`).",
    )
    p.add_argument(
        "rest", nargs=argparse.REMAINDER,
        help="Command to run instead of `bash -l` (use `--` to separate).",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    lay = layout()
    service = args.service or lay.config().default_service

    rest = list(args.rest or [])
    if rest and rest[0] == "--":
        rest = rest[1:]
    inner = rest if rest else ["bash", "-l"]

    argv = build_compose_argv(lay) + ["exec"]
    if args.user:
        argv += ["--user", args.user]
    argv += [service, *inner]

    return subprocess.call(argv, env=compose_env(lay))
