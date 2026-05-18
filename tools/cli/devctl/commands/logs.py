"""`devctl logs` — captured `docker compose logs`.

Re-readable: dump the whole thing to a capture log instead of
`docker compose logs | tail` (which truncates and can't be re-read).
"""

from __future__ import annotations

import argparse

from ..capture import run_capture
from ..paths import layout
from .compose import build_compose_argv, compose_env


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("logs", help="Captured `docker compose logs`.")
    p.add_argument("--tag", default="logs", help="Capture tag / log filename.")
    p.add_argument(
        "rest", nargs=argparse.REMAINDER,
        help="Args forwarded to `docker compose logs` (use `--` to separate). "
             "Note: do not pass -f/--follow (capture waits for exit).",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    lay = layout()
    rest = list(args.rest or [])
    if rest and rest[0] == "--":
        rest = rest[1:]
    argv = build_compose_argv(lay) + ["logs", "--no-color", *rest]
    with run_capture(tag=args.tag, command_name="logs") as cap:
        cap.run(argv, env=compose_env(lay))
    return 0
