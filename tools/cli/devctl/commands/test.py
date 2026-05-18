"""`devctl test` — run the test suite in the test-profile service, captured.

Stack-agnostic thin runner. The *what to run* lives entirely in
`[test]` of `tools/devctl.toml`; this command only resolves a mode to a
command string, optionally substitutes the changed-file list, and wraps
`docker compose run --rm <test-service> <cmd>` in a capture log.

Modes (mutually exclusive, default `--full`):
  --full      `[test].command`               (whole suite)
  --unit      `[test].unit`     → fast tier   (falls back to command)
  --changed   `[test].changed`  → impacted    (falls back to command)
  --ci        `[test].ci`       → CI entry    (falls back to command)

`--changed`: if the resolved command contains a literal `{files}`
token, it is replaced by the list of changed files (working tree +
staged, plus vs the branch merge-base). Self-tracking tools (e.g.
`pytest --testmon`) need no token — they get the command as-is.

`--parallel` appends `[test].parallel` to the resolved command.

See `TESTING.md` for the tagging / parallel-safety / DB-reset policy
this runner exists to serve.
"""

from __future__ import annotations

import argparse
import shlex
import subprocess
import sys

from ..capture import run_capture
from ..paths import layout
from .compose import build_compose_argv, compose_env

_MODES = ("full", "unit", "changed", "ci")


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser(
        "test",
        help="Run tests in the test-profile service, captured.",
    )
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--full", dest="mode", action="store_const",
                      const="full", help="Whole suite ([test].command). Default.")
    mode.add_argument("--unit", dest="mode", action="store_const",
                      const="unit", help="Fast tier ([test].unit).")
    mode.add_argument("--changed", dest="mode", action="store_const",
                      const="changed", help="Impacted only ([test].changed).")
    mode.add_argument("--ci", dest="mode", action="store_const",
                      const="ci", help="CI entrypoint ([test].ci).")
    p.set_defaults(mode="full")
    p.add_argument(
        "--service", default=None,
        help="Compose service (default: [test].service, else 'test').",
    )
    p.add_argument(
        "--parallel", action="store_true",
        help="Append [test].parallel args to the resolved command.",
    )
    p.add_argument("--tag", default=None, help="Capture tag / log filename.")
    p.add_argument(
        "rest", nargs=argparse.REMAINDER,
        help="Extra args appended to the command (use `--` to separate).",
    )
    p.set_defaults(func=run)


def _changed_files(lay) -> list[str]:
    """Changed files: working tree + staged, plus vs branch merge-base."""
    files: list[str] = []
    root = str(lay.root)

    def _git(*argv: str) -> list[str]:
        try:
            out = subprocess.run(
                ["git", "-C", root, *argv],
                capture_output=True, text=True, check=False,
            )
        except OSError:
            return []
        if out.returncode != 0:
            return []
        return [ln for ln in out.stdout.splitlines() if ln.strip()]

    files += _git("diff", "--name-only")            # unstaged
    files += _git("diff", "--name-only", "--cached")  # staged

    head = _git("rev-parse", "--abbrev-ref", "HEAD")
    if head and head[0] not in ("", "HEAD"):
        for base in ("origin/HEAD", "main", "master"):
            mb = _git("merge-base", base, "HEAD")
            if mb:
                files += _git("diff", "--name-only", f"{mb[0]}...HEAD")
                break

    seen: set[str] = set()
    uniq: list[str] = []
    for f in files:
        if f not in seen:
            seen.add(f)
            uniq.append(f)
    return uniq


def run(args: argparse.Namespace) -> int:
    lay = layout()
    cfg = lay.config()
    service = args.service or cfg.test_service or "test"

    resolved = {
        "full": cfg.test_command,
        "unit": cfg.test_unit or cfg.test_command,
        "changed": cfg.test_changed or cfg.test_command,
        "ci": cfg.test_ci or cfg.test_command,
    }[args.mode]

    if not resolved.strip():
        print(
            f"test: mode --{args.mode} has no command "
            f"([test].{args.mode} and [test].command both empty in "
            f"tools/devctl.toml)",
            file=sys.stderr,
        )
        return 2

    cmd = shlex.split(resolved)

    if args.mode == "changed":
        if "{files}" in cmd:
            files = _changed_files(lay)
            expanded: list[str] = []
            for tok in cmd:
                if tok == "{files}":
                    expanded += files
                else:
                    expanded.append(tok)
            cmd = expanded
        # else: self-tracking tool — run command as-is.

    if args.parallel and cfg.test_parallel.strip():
        cmd += shlex.split(cfg.test_parallel)

    rest = list(args.rest or [])
    if rest and rest[0] == "--":
        rest = rest[1:]
    cmd += rest

    tag = args.tag or {
        "full": "test",
        "unit": "test-unit",
        "changed": "test-changed",
        "ci": "test-ci",
    }[args.mode]

    argv = build_compose_argv(lay) + ["run", "--rm", service, *cmd]
    with run_capture(tag=tag, command_name="test") as cap:
        cap.run(argv, env=compose_env(lay))
    return 0
