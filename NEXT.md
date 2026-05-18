# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 3 — Host shell (framework-free)
**Next unchecked item:** `src/games/types.ts` — `GameMeta` /
`GameContext` / `GameModule` exactly per plan (mount may return a
Promise for WASM).

Notes carried from Epic 2 (test harness):
- `dc-test --full` runs the whole Playwright suite; `--ci` runs the
  full suite too (it is the gate; the only spec is `@e2e` so a
  `@unit` fast subset is empty for now). `--changed`/`--unit` =
  `--grep @unit --pass-with-no-tests` (no `@unit` specs yet → exit 0).
- `test` service = `mcr.microsoft.com/playwright:v1.60.0-noble`
  (browsers baked), `test` profile, `depends_on: dev`, shares the
  `node-modules` volume. App-under-test reached at
  **`http://web:5173`** — `web` is a compose network alias on the
  `dev` service; the literal name `dev` is HSTS-preloaded in Chrome
  (`.dev`) and breaks Chromium navigation. Override via `BASE_URL`.
- Every spec MUST carry one speed tier (`@unit`|`@e2e`) + one area
  tag. Epic 3 adds `@router` / `@storage`; Epic 3 unit specs make the
  `@unit` fast subset non-empty (then `--ci`/`--changed` get real).

Resume steps:
1. Read `CLAUDE.md` (conventions), `TESTING.md` (test policy,
   authoritative), and `TODO.md` (authoritative epic list).
2. Continue from the next unchecked item in the current epic.
3. At end of epic: commit → update `TODO.md` + this file → stop.
