"""CLI dispatch. `devctl <subcmd> [args...]`."""

from __future__ import annotations

import argparse
import sys
from typing import Callable

from .commands import (
    capture,
    clean,
    compose,
    logs,
    peek,
    ps,
    run,
    shell,
    show_tree,
    test,
)

SubcmdFn = Callable[[argparse.Namespace], int]


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="devctl")
    sub = p.add_subparsers(dest="subcmd", required=True)

    capture.register(sub)
    show_tree.register(sub)
    peek.register(sub)
    compose.register(sub)
    run.register(sub)
    test.register(sub)
    logs.register(sub)
    ps.register(sub)
    shell.register(sub)
    clean.register(sub)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    fn: SubcmdFn = args.func
    return fn(args)


if __name__ == "__main__":
    sys.exit(main())
