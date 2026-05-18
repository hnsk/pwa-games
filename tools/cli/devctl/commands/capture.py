"""`devctl capture` — wrap any command under capture (log + manifest)."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from ..capture import run_capture


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("capture", help="Run a command under capture (log + manifest)")
    p.add_argument("--tag", default="cmd")
    p.add_argument("--run-id", default=None)
    p.add_argument("--log-dir", type=Path, default=None)
    p.add_argument(
        "--command-name",
        default=None,
        help="Logical command name written to manifest (default: argv[0]).",
    )
    p.add_argument(
        "argv",
        nargs=argparse.REMAINDER,
        help="Command to run; prefix with `--` to separate from capture flags.",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    argv = list(args.argv or [])
    if argv and argv[0] == "--":
        argv = argv[1:]
    if not argv:
        print("capture: no command (need '-- <cmd> [args...]')", file=sys.stderr)
        return 2
    cmd_name = args.command_name or os.path.basename(argv[0])
    try:
        with run_capture(
            tag=args.tag,
            command_name=cmd_name,
            run_id=args.run_id,
            log_dir=args.log_dir,
        ) as cap:
            cap.run(argv)
    except ValueError as e:
        print(f"capture: {e}", file=sys.stderr)
        return 2
    # Wrapper exits 0 even on wrapped failure — calling shell never
    # short-circuits on inner failure; inspect STATUS= / the manifest.
    return 0
