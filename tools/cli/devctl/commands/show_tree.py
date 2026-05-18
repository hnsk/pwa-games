"""`devctl show-tree` — dump every regular file under a directory.

Replaces ad-hoc `find <dir> -type f | xargs -I{} sh -c 'echo === {} ===;
cat {}'` patterns (filename-injection + quoting footgun). Refuses paths
outside the repo root and skips binary / oversize files.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ..paths import layout


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser(
        "show-tree",
        help="Print every regular file under a directory with === path === banners",
    )
    p.add_argument("path", help="Directory to dump (must be inside repo root)")
    p.add_argument(
        "--max-bytes", type=int, default=64 * 1024,
        help="Skip files larger than this (default: 65536). Use 0 to disable.",
    )
    p.add_argument(
        "--include-hidden", action="store_true",
        help="Include files/dirs whose name starts with a dot.",
    )
    p.set_defaults(func=run)


def _looks_binary(blob: bytes) -> bool:
    if b"\x00" in blob:
        return True
    sample = blob[:4096]
    if not sample:
        return False
    text = sample.translate(None, bytes(range(7, 14)) + bytes(range(32, 127)) + b"\x7f")
    return (len(text) / len(sample)) > 0.30


def run(args: argparse.Namespace) -> int:
    lay = layout()
    root = lay.root.resolve()
    target = Path(args.path).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        print(f"show-tree: refusing to dump path outside repo root: {target}",
              file=sys.stderr)
        return 2
    if not target.exists():
        print(f"show-tree: no such path: {target}", file=sys.stderr)
        return 2
    if target.is_file():
        files = [target]
    else:
        files = sorted(p for p in target.rglob("*") if p.is_file())
        if not args.include_hidden:
            files = [
                p for p in files
                if not any(part.startswith(".")
                           for part in p.relative_to(target).parts)
            ]

    out = sys.stdout.buffer
    rc = 0
    for f in files:
        rel = f.relative_to(root)
        out.write(f"=== {rel} ===\n".encode())
        try:
            blob = f.read_bytes()
        except OSError as exc:
            out.write(f"<read error: {exc}>\n".encode())
            rc |= 1
            continue
        if args.max_bytes and len(blob) > args.max_bytes:
            out.write(
                f"<{len(blob)} bytes; skipping, exceeds "
                f"--max-bytes={args.max_bytes}>\n".encode()
            )
            continue
        if _looks_binary(blob):
            out.write(f"<{len(blob)} bytes; binary, skipping>\n".encode())
            continue
        out.write(blob)
        if not blob.endswith(b"\n"):
            out.write(b"\n")
    return rc
