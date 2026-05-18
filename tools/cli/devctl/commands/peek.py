"""`devctl peek` — read-only partial view of a single file.

Replaces ad-hoc `sed -n '1,40p'`, `head -n`, `tail -n`, and
`grep -nC<n>` patterns. Those raw commands either trip the Bash
permission classifier (anything `sed`-shaped is flagged write/exec) or
tempt redirecting to a `tmp/` scratch file; this prints to stdout only,
refuses paths outside the repo root, and skips binary files. No writes,
ever.

Selectors are mutually exclusive; with none, prints the whole file
(subject to --max-bytes). For dumping a *directory* tree use
`devctl show-tree`.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from ..paths import layout


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser(
        "peek",
        help="Read-only partial view of one file (line range / head / "
             "tail / regex match); stdout only, repo-root-confined",
    )
    p.add_argument("path", help="File to inspect (must be inside repo root)")
    sel = p.add_mutually_exclusive_group()
    sel.add_argument(
        "--lines", metavar="A:B",
        help="Print 1-based inclusive line range A:B (open-ended ':B' or "
             "'A:' allowed). Replaces sed -n 'A,Bp'.",
    )
    sel.add_argument(
        "--head", type=int, metavar="N", help="Print first N lines.",
    )
    sel.add_argument(
        "--tail", type=int, metavar="N", help="Print last N lines.",
    )
    sel.add_argument(
        "--match", metavar="REGEX",
        help="Print lines matching REGEX (Python re). Pair with "
             "--context for surrounding lines.",
    )
    p.add_argument(
        "--context", type=int, default=0, metavar="N",
        help="With --match: also print N lines around each hit.",
    )
    p.add_argument(
        "-n", "--number", action="store_true",
        help="Prefix each printed line with its 1-based line number.",
    )
    p.add_argument(
        "--max-bytes", type=int, default=512 * 1024,
        help="Refuse files larger than this (default: 524288). "
             "Use 0 to disable.",
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


def _parse_range(spec: str, total: int) -> tuple[int, int] | None:
    """Return (start, end) 0-based half-open from 1-based inclusive A:B."""
    if ":" not in spec:
        return None
    a_s, b_s = spec.split(":", 1)
    try:
        a = int(a_s) if a_s.strip() else 1
        b = int(b_s) if b_s.strip() else total
    except ValueError:
        return None
    if a < 1 or b < a:
        return None
    return a - 1, min(b, total)


def _emit(lines: list[str], idxs: range | list[int], number: bool) -> None:
    out = sys.stdout
    for i in idxs:
        if number:
            out.write(f"{i + 1:>6}\t{lines[i]}")
        else:
            out.write(lines[i])
        if not lines[i].endswith("\n"):
            out.write("\n")


def run(args: argparse.Namespace) -> int:
    lay = layout()
    root = lay.root.resolve()
    target = Path(args.path).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        print(f"peek: refusing to read path outside repo root: {target}",
              file=sys.stderr)
        return 2
    if not target.exists() or not target.is_file():
        print(f"peek: no such file: {target}", file=sys.stderr)
        return 2

    try:
        blob = target.read_bytes()
    except OSError as exc:
        print(f"peek: read error: {exc}", file=sys.stderr)
        return 2
    if args.max_bytes and len(blob) > args.max_bytes:
        print(f"peek: {len(blob)} bytes exceeds --max-bytes={args.max_bytes}; "
              f"narrow with --lines/--head/--tail or raise --max-bytes",
              file=sys.stderr)
        return 2
    if _looks_binary(blob):
        print(f"peek: {len(blob)} bytes; binary file, refusing", file=sys.stderr)
        return 2

    lines = blob.decode("utf-8", errors="replace").splitlines(keepends=True)
    total = len(lines)

    if args.lines is not None:
        rng = _parse_range(args.lines, total)
        if rng is None:
            print(f"peek: bad --lines spec {args.lines!r} (want A:B, 1-based)",
                  file=sys.stderr)
            return 2
        _emit(lines, range(rng[0], rng[1]), args.number)
    elif args.head is not None:
        _emit(lines, range(0, max(0, min(args.head, total))), args.number)
    elif args.tail is not None:
        _emit(lines, range(max(0, total - max(0, args.tail)), total), args.number)
    elif args.match is not None:
        try:
            rx = re.compile(args.match)
        except re.error as exc:
            print(f"peek: bad --match regex: {exc}", file=sys.stderr)
            return 2
        ctx = max(0, args.context)
        keep: set[int] = set()
        for i, ln in enumerate(lines):
            if rx.search(ln):
                keep.update(range(max(0, i - ctx), min(total, i + ctx + 1)))
        if not keep:
            return 1
        _emit(lines, sorted(keep), args.number)
    else:
        _emit(lines, range(0, total), args.number)
    return 0
