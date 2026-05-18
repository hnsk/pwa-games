# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 8 — Klondike UI, drag, draw modes, registry ✅ DONE
**Next epic:** Epic 9 — Timer, best time, auto-complete + E2E + verification
**Next unchecked item:** Timer (`M:SS`, starts on first move, stops on
win/unmount); per-mode best time persisted (`best-1`/`best-3` via
`ctx.storage`), shown + updated on win.

State at completion (Epic 8):
- `src/games/klondike/index.ts` — `GameModule`: DOM glyph board,
  pointer drag-and-drop (mouse+touch), double-click/tap → foundation,
  stock draw/recycle, New game / Draw 3↔1 toggle / Back, `?seed=` hook.
  Delegated listeners + one `AbortController`; ghost on `<body>`.
- `src/router.ts` — `parse()` now tolerates a trailing `?query` so the
  seeded route resolves (was folded into the id before).
- `src/games/registry.ts` — klondike entry (own `klondike-*.js` chunk).
- `src/style.css` — `.sol-*` section; card metrics on `:root` so the
  body-level drag ghost matches.
- `tests/router.spec.ts` — game-card count 1→2.
- Build green (klondike-Cazmy8_S.js 8.45 kB, precache 21→22); full+unit
  24/24 green (run 20260518-110733-test).

Context:
- Second game = Klondike Solitaire. Plan:
  `~/.claude/plans/implement-the-classic-windows-polished-dijkstra.md`.
- Epic 9 wires the deferred pieces against the existing UV/state:
  - Timer + per-mode persisted best time (`ctx.storage` keys
    `best-1`/`best-3` → `{ seconds, date }`), shown in `.sol-bar`,
    updated on `isWon`.
  - Auto-complete: when `canAutoComplete(state)` and not won, auto-run
    an `autoStep` loop (~120 ms `setInterval`) + a manual button
    fallback; interval cleared on unmount / new game.
  - `tests/klondike.spec.ts` `@e2e @klondike`: board renders; stock
    click → waste grows by draw count; draw-mode toggle changes count;
    double-tap an Ace → foundation; timer increments; seeded deal →
    auto-complete → win → best time persists across `page.reload()`;
    New game resets.
  - `dc-test --full` + `--ci` green.
- Hooks already present in `index.ts` for Epic 9: `commit()` is the
  single choke point after every move (add win/auto-complete checks
  there); `.sol-bar`/`modeEl` is where timer + best-time spans go;
  `unmount()` already aborts + clears the ghost (add timer/interval
  clears alongside).

When starting / resuming work:
1. Read `CLAUDE.md`, `TESTING.md`, `TODO.md`, this file, the plan.
2. All code tagged + tested from day one (`TESTING.md`):
   `@unit|@e2e` + `@klondike`.
3. Hard stop after each epic: commit → update `TODO.md` + this file
   → end the turn, wait for the user.
