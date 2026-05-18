"""`devctl ps` — captured `docker compose ps` (stack status snapshot)."""

from __future__ import annotations

import argparse

from ..capture import run_capture
from ..paths import layout
from .compose import build_compose_argv, compose_env


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("ps", help="Captured `docker compose ps`.")
    p.add_argument("--tag", default="ps", help="Capture tag / log filename.")
    p.add_argument(
        "rest", nargs=argparse.REMAINDER,
        help="Args forwarded to `docker compose ps` (use `--` to separate).",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    lay = layout()
    rest = list(args.rest or [])
    if rest and rest[0] == "--":
        rest = rest[1:]
    argv = build_compose_argv(lay) + ["ps", "-a", *rest]
    with run_capture(tag=args.tag, command_name="ps") as cap:
        cap.run(argv, env=compose_env(lay))
    return 0
