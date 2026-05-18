"""`devctl run` — one-shot command in a compose service, captured.

The captured counterpart to `devctl shell`: use this for anything whose
output you may want to re-read (builds, test suites, scripts). Wraps
`docker compose run --rm <service> <cmd>` in a capture log + manifest.

With no command, falls back to `[test].command` from devctl.toml.
"""

from __future__ import annotations

import argparse
import shlex
import sys

from ..capture import run_capture
from ..paths import layout
from .compose import build_compose_argv, compose_env


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser(
        "run",
        help="Run a one-shot command in a compose service, captured.",
    )
    p.add_argument(
        "--service", default=None,
        help="Compose service (default: [compose].default_service).",
    )
    p.add_argument("--tag", default="run", help="Capture tag / log filename.")
    p.add_argument(
        "rest", nargs=argparse.REMAINDER,
        help="Command + args (use `--` to separate). Empty → [test].command.",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    lay = layout()
    cfg = lay.config()
    service = args.service or cfg.default_service

    rest = list(args.rest or [])
    if rest and rest[0] == "--":
        rest = rest[1:]
    if not rest:
        if not cfg.test_command.strip():
            print("run: no command given and [test].command is empty in "
                  "tools/devctl.toml", file=sys.stderr)
            return 2
        rest = shlex.split(cfg.test_command)

    argv = build_compose_argv(lay) + ["run", "--rm", service, *rest]
    with run_capture(tag=args.tag, command_name="run") as cap:
        cap.run(argv, env=compose_env(lay))
    return 0
