# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 9 — Timer, best time, auto-complete + E2E ✅ DONE
**Next epic:** none — all TODO.md epics complete. WASM games are
deferred (TODO.md trailer / plan §Deferred): no Rust toolchain /
`vite-plugin-wasm` now. Add that epic when the first WASM game is
scheduled; the `GameModule` contract already supports async `mount`.
**Next unchecked item:** none.

State at completion (Epic 9):
- `src/games/klondike/index.ts` — added play timer, per-mode best
  time, auto-complete loop:
  - `.sol-bar` now has `modeEl` / `timerEl` / `bestEl` / `statusEl`
    spans. `formatTime` → `M:SS`.
  - `startTimer()` guarded (no-op if running or won) → 1 s interval;
    first successful move (incl. an auto step) starts it; `stopTimer`
    on win + unmount.
  - Best per mode: `ctx` stored on mount; keys `best-1`/`best-3` →
    `{ seconds, date }` via `ctx.storage`; `recordBest` writes only if
    faster/none; `renderBest` on mount, after redeal, and on win.
  - `maybeAutoComplete()` → 120 ms `setInterval` of `autoStep` once
    `canAutoComplete && !won`; `finishWin()` stops timer + loop and
    records best; `updateChrome()` drives `.sol-status` text +
    `boardEl[data-won]` + the hidden "Auto-complete" fallback button.
  - `commit()` → `afterMove()` choke point. `resetRound()` shared by
    New game / Draw toggle (stops timer+loop, redeals, re-shows the
    mode's best, re-arms auto-complete).
  - `?solve=1` test hook: deals an already-face-up, trivially
    auto-completable board (4 suit columns K→A) so E2E can hit
    auto-complete → win → best deterministically; a normal `deal()`
    always has face-down cards so can never auto-complete on mount.
    Production deals ignore it.
- `src/style.css` — `.sol-mode/.sol-timer/.sol-best/.sol-status`
  shared rule; `.sol-best` dim, `.sol-status` magenta + `margin-left:
  auto`, hidden when `:empty`.
- `tests/klondike.spec.ts` — 7 `@e2e @klondike` cases (board renders;
  stock draws drawCount + toggle; double-tap Ace → foundation; timer
  ticks; `?solve=1` auto-complete → win → best persists across
  reload; New game resets). `aceTopSeed()` finds a deterministic
  Ace-on-top seed via the imported pure logic — no magic number.
- Verified: `dc-test --full` 30/30 (run 20260518-112946-test),
  `--ci` 30/30 (run 20260518-113004-test-ci), production build green
  (`klondike-Co5zMur8.js` 10.63 kB, precache 22).

Context:
- Second game = Klondike Solitaire. Plan:
  `~/.claude/plans/implement-the-classic-windows-polished-dijkstra.md`.
- All four TODO.md epics for Klondike (7–9 + the shell/PWA epics
  before it) are complete. The repo is at a clean epic boundary; the
  only remaining backlog is the deferred WASM-game epic.

When starting / resuming work:
1. Read `CLAUDE.md`, `TESTING.md`, `TODO.md`, this file, the plan.
2. All code tagged + tested from day one (`TESTING.md`):
   `@unit|@e2e` + an area tag.
3. Hard stop after each epic: commit → update `TODO.md` + this file
   → end the turn, wait for the user.
