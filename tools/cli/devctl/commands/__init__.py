"""CLI subcommand modules. Each exposes a `register(subparsers)` callable."""

from . import (
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

__all__ = [
    "capture",
    "clean",
    "compose",
    "logs",
    "peek",
    "ps",
    "run",
    "shell",
    "show_tree",
    "test",
]
