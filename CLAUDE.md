# PWA Games App — codebase guide

An installable PWA hosting multiple small games, fully playable offline
after first load, with no backend. Mobile-first, local-only scores.
Framework-free host shell so DOM, canvas, and future WASM (Rust) games
are all drop-in. First game: tictactoe.

This project was seeded from the `claude-docker-compose-scaffolding`
scaffold. The scaffold is a starting point, not a dependency: this repo
owns and may freely mutate its copy.

## Golden rules

- **Everything runs in Docker Compose.** Nothing builds/tests/runs on
  the host. The *only* host process is `devctl` itself (needs
  Python ≥ 3.11 on PATH).
- **Latest-stable rule.** When choosing a base image or language runtime
  for anything NEW, use the latest **stable** release. Verify the current
  latest from the official source / Docker Hub tags and pin it — do NOT
  default to a training-memory version (e.g. `python:3.11`, `node:18`).
  Capture the verification command (`tools/scripts/capture --tag verify-… -- …`).
- **Capture everything re-readable.** Every build/test/diagnostic goes
  through `tools/scripts/capture` (or `run`/`logs`/`ps`, which capture
  internally). Read the `LOG=` path it prints; never `| tail` / `| head`
  a command whose output you may need again.
- **Scratch → repo-root `./tmp/`** (gitignored). Delete when done.
  Prefer `capture` whenever it fits; `tmp/` is only for what capture
  doesn't cover.
- **Absolute paths; never `cd` for a single command** (use `-C`, `-f`).
  The Bash tool's PWD drifts between calls when `cd` is used.
- **Don't dump trees with `find | xargs cat`** — use
  `tools/scripts/show-tree <path>` (refuses paths outside the repo,
  skips binaries).
- **All code has tests; tagged from day one** (speed tier + area) for
  selective + parallel runs. Test DB is a long-lived service reset by
  TRUNCATE/rollback, never a per-run container restart. See `TESTING.md`.

## Setup (once per clone)

```
./setup.sh                # creates .venv, installs the devctl package
```

Every shim under `tools/scripts/` self-bootstraps `.venv/` if missing.

## CLI / skills

Single console script `devctl` (in `.venv/bin/`); each shim under
`tools/scripts/` execs it. Thin Claude skills wrap the common ones:

| Skill      | Shim / subcommand            | Purpose |
|------------|------------------------------|---------|
| `dc-up`    | `compose up`                 | Build + start the stack (detached) |
| `dc-down`  | `compose down`               | Stop/remove the stack |
| `dc-shell` | `shell`                      | Interactive shell in a running service (not captured) |
| `dc-run`   | `run`                        | One-shot command in a service, **captured** |
| `dc-logs`  | `logs`                       | Captured `docker compose logs` |
| `dc-ps`    | `ps`                         | Captured `docker compose ps -a` |
| `dc-clean` | `clean`                      | Wipe `[clean].targets` dirs safely, captured |
| `dc-diag`  | `capture -- <cmd>`           | Any ad-hoc diagnostic, captured |
| `dc-test`  | `test`                       | Run tests in the test service, **captured** (`--unit/--changed/--ci/--parallel`) |

Direct invocation also works: `.venv/bin/devctl <subcmd> [args...]`.
Project-tunable config (service names, test command, clean targets):
`tools/devctl.toml`.

## Testing

`TESTING.md` is the authoritative testing policy: all code has tests;
two-axis tagging (speed tier + area) from day one; scoped change runs a
small subset, pre-commit/merge runs full; parallel-safe (no shared
DB/files); test DB is a long-lived `test`-profile service reset by
TRUNCATE/rollback. Runner: `tools/scripts/test` / skill `dc-test`
(`--full|--unit|--changed|--ci|--parallel`), config in `[test]` of
`tools/devctl.toml`. Read `TESTING.md` before writing or wiring tests.

## Logs and run manifests

Every command that performs work writes:
- `tools/logs/<run-id>/<tag>.log`
- `tools/logs/<run-id>/manifest.json` (schema_version=1, see
  `tools/cli/devctl/manifest.py`)
- one line appended to `tools/logs/index.jsonl`

`tools/logs/` is gitignored.

## TODO.md / NEXT.md workflow (authoritative)

- **`TODO.md` is the authoritative project source**: epics, each with a
  checklist.
- **Hard stop after each epic.** When an epic's items are all done:
  1. Commit the work.
  2. Update `TODO.md` (check items / refine later epics).
  3. Update `NEXT.md` to point at the next epic + first unchecked item.
  4. **End the turn and wait for the user.** Do not roll into the next
     epic unprompted.
- **`NEXT.md`** is the fresh-session resume hint: which epic, which
  unchecked item. Read it first when resuming.
