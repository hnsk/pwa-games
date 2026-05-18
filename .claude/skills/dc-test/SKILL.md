---
name: dc-test
description: Run the test suite in the test-profile service, captured to a re-readable log + manifest. Scoped change → --changed/--unit fast subset; pre-commit/merge → --full; CI → --ci. Policy (tagging, parallel-safety, DB reset) lives in TESTING.md.
---

# dc-test

```
tools/scripts/test                       # --full: whole suite ([test].command)
tools/scripts/test --unit                # fast tier ([test].unit)
tools/scripts/test --changed             # impacted only ([test].changed)
tools/scripts/test --ci                  # CI entrypoint ([test].ci)
tools/scripts/test --unit --parallel     # + [test].parallel args
tools/scripts/test --changed -- -k foo   # extra args after `--`
```

`docker compose run --rm <[test].service> <cmd>`, wrapped in capture.
Prints `LOG=<path>` first, `EXIT=<rc>` last; the shim exits 0 regardless.
**Read the `LOG=` path** — never `| tail`.

Modes are mutually exclusive (default `--full`). `--unit/--changed/--ci`
fall back to `[test].command` when their own key is empty; if both are
empty the command exits 2 with a clear message — nothing is configured
yet, see `TESTING.md`.

`--changed` substitutes the changed-file list (git working tree + staged
+ vs branch merge-base) for a literal `{files}` token in
`[test].changed`. Self-tracking tools (e.g. `pytest --testmon`) omit the
token and run as-is.

**When to use which:** scoped code change → `--changed` (or `--unit`);
pre-commit / merge / nightly → `--full`; CI calls only `--ci`. The
tagging taxonomy and parallel-safe long-lived test-DB strategy this
runner depends on are defined in `TESTING.md` — read it before wiring
`[test]` in `tools/devctl.toml`.
