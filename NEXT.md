# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 6 — Verification pass ✅ DONE
**Next unchecked item:** none — all 6 epics in `TODO.md` complete.

State at completion:
- Build green: 21 SW precache entries, code-split `tictactoe-*.js`.
- `tools/scripts/test --full` 12/12 green (run 20260518-103340-test).
- `tools/scripts/test --ci` 12/12 green (run 20260518-103349-test-ci).
- `README.md` added: adding-a-game guide (folder + registry entry),
  GameModule contract, deferred-WASM section.

No further epics queued. Next work is user-directed — likely a second
game, or the deferred WASM epic (Rust toolchain + `vite-plugin-wasm`;
contract already supports async `mount`, no shell change needed).

When starting new work:
1. Read `CLAUDE.md`, `TESTING.md`, `TODO.md` (add a new epic there
   first — it stays the authoritative source).
2. All code tagged + tested from day one (`TESTING.md`).
3. Hard stop after each epic: commit → update `TODO.md` + this file.
