"""`devctl clean` — wipe contents of the project's declared scratch dirs.

Allowed targets come from `[clean].targets` in tools/devctl.toml
(repo-root-relative). Defense in depth: every resolved target must stay
strictly inside the repo root and must not BE the repo root, so a
mis-edited devctl.toml can't turn this into `rm -rf /` or `rm -rf <repo>`.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from ..capture import run_capture
from ..paths import layout


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser(
        "clean",
        help="Wipe contents of [clean].targets dirs from tools/devctl.toml.",
    )
    p.add_argument(
        "-n", "--dry-run", action="store_true",
        help="Print what would be removed; delete nothing.",
    )
    p.set_defaults(func=run)


def _resolve_targets(root: Path, names: list[str]) -> list[Path]:
    resolved: list[Path] = []
    for name in names:
        t = (root / name).resolve()
        if t == root:
            raise SystemExit(f"clean: refusing target that is the repo root: {name}")
        try:
            t.relative_to(root)
        except ValueError:
            raise SystemExit(
                f"clean: refusing target outside repo root: {name} -> {t}"
            )
        resolved.append(t)
    return resolved


def _wipe(target: Path, dry_run: bool, cap) -> None:
    if not target.exists():
        cap.echo(f"clean: {target} does not exist; skipping")
        return
    if not target.is_dir():
        raise SystemExit(f"clean: {target} is not a directory")
    children = sorted(target.iterdir())
    if not children:
        cap.echo(f"clean: {target} already empty")
        return
    cap.echo(f"clean: wiping {len(children)} entries from {target}")
    for child in children:
        cap.echo(f"  - {child.name}")
        if dry_run:
            continue
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()


def run(args: argparse.Namespace) -> int:
    lay = layout()
    names = lay.config().clean_targets
    if not names:
        print("clean: [clean].targets is empty in tools/devctl.toml; nothing to do",
              file=sys.stderr)
        return 0
    targets = _resolve_targets(lay.root.resolve(), names)
    with run_capture(tag="clean", command_name="clean") as cap:
        cap.write(f"clean: dry_run={args.dry_run} targets={names}")
        for t in targets:
            _wipe(t, args.dry_run, cap)
    return 0
