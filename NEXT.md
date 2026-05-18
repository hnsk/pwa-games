# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 4 — tictactoe (first game)
**Next unchecked item:** `src/games/tictactoe/logic.ts` — pure `move` /
`winner` / `isDraw`, no DOM.

Notes carried from Epic 3 (host shell):
- Contract: `src/games/types.ts` — `GameMeta` / `GameContext` /
  `GameModule` (`mount` may return a Promise; `unmount` frees
  listeners/RAF/wasm). `GameStorage` interface also lives there.
- `src/lib/storage.ts` `createGameStorage(id)`: keys
  `pwa-games:<id>:<key>`, JSON; corrupt/missing → `null` (no throw).
- `src/games/registry.ts`: `registry: GameEntry[]` where
  `GameEntry = { meta, load: () => Promise<GameModule> }` so games
  code-split. **It is currently empty** — register tictactoe here
  (Epic 4 item: `{ meta, load: () => import("./tictactoe/index.ts")
  .then(m => m.default) }`). Menu renders from `meta` alone.
- `src/router.ts` `startRouter({ app, renderMenu })`: `#/`→menu,
  `#/g/<id>`→game; nav-token guard for async `mount`; unknown id and
  `ctx.onExit` → `#/`. Wired in `src/main.ts`.
- UI: `src/ui/header.ts` + `src/ui/menu.ts`, plain-CSS design system in
  `src/style.css` (Tailwind NOT wired — PLAN mentions it but no TODO
  item adds it; revisit only if a game needs it). Safe DOM nodes only.
- Tests: `@unit` fast tier is now NON-EMPTY (`tests/storage.spec.ts`
  via a Node `localStorage` polyfill — true pure-logic, no browser
  nav). So `--ci`/`--changed` `@unit` subset is real. `tests/
  router.spec.ts` = `@e2e @router`. Epic 4 adds `@unit @tictactoe`
  (logic.ts) + `@e2e @tictactoe` (play→win→persist).
- Every spec MUST carry one speed tier (`@unit`|`@e2e`) + one area tag.

Resume steps:
1. Read `CLAUDE.md` (conventions), `TESTING.md` (test policy,
   authoritative), and `TODO.md` (authoritative epic list).
2. Continue from the next unchecked item in the current epic.
3. At end of epic: commit → update `TODO.md` + this file → stop.
