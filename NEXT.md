# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 10 — Sudoku (third game) ✅ DONE
**Next epic:** none — all TODO.md epics complete. WASM games are
deferred (TODO.md trailer / plan §Deferred): no Rust toolchain /
`vite-plugin-wasm` now. Add that epic when the first WASM game is
scheduled; the `GameModule` contract already supports async `mount`.
**Next unchecked item:** none.

State at completion (Epic 10):
- `src/games/sudoku/logic.ts` — pure engine. `Grid`/`Difficulty`/
  `Puzzle`/`Model`; precomputed `UNITS` (27) + `PEERS` (20/cell);
  copied `mulberry32`; `fullSolve` (randomized backtracking),
  `countSolutions` (MRV, aborts at `limit` → cheap uniqueness);
  candidate `computeModel`; technique ladder (tiers 0–6:
  nakedSingle, hiddenSingle, lockedCandidates, nakedPair, hiddenPair,
  tripleStep, xWing); `rate` (hardest forced tier, `UNSOLVED`=99 if it
  stalls), `classify` (0 easy / ≤2 normal / ≤4 hard / else veryhard);
  `generate` (seeded `dig` to a clue floor keeping uniqueness, retry
  seeds until `classify` matches, attempt+wall-clock budget, fallback
  returns the closest valid puzzle labelled with its *measured*
  difficulty — never lies); `conflicts`/`isComplete`/
  `firstForcedCell`.
- `src/games/sudoku/index.ts` — `GameModule`. Module-scope state
  reinit per `mount`; `freshPuzzle` (or `?solve=1` = solution minus
  cell 80, answer on `boardEl.dataset.answer` for the spec); `render`
  rebuilds the 81-cell grid with `data-given/hint/same/sel/conflict/
  wrong` + pencil-mark mini-grid + pad `data-full` greying; timer
  copied from klondike (M:SS, 1 s interval, persisted); `Saved`
  localStorage (skipped for `?seed`/`?solve`), `pref` key keeps the
  mistake-check default sticky; per-box hint (`hintedBoxes`, forced
  cell if any), `cycleDifficulty`/`newGame` → `resetRound`; one
  `AbortController`; full keyboard (1–9/0/Backspace/arrows/N).
- `src/games/registry.ts` — 3rd entry (code-splits `sudoku-*.js`).
- `src/style.css` — appended `.sdk-*` block; component-local
  `--sdk-wrong`/`--sdk-box` only, shell tokens otherwise; no edits to
  shell/`.ttt-*`/`.sol-*`. Added a `.ttt-btn[data-on="true"]` armed
  state for the Notes/Check toggles (additive, no existing rule
  changed).
- `tests/sudoku.spec.ts` — 9 `@unit` + 9 `@e2e @sudoku`; helper
  `firstEmptyIdx` pins a concrete `data-idx` (an emptiness-filtered
  locator re-resolves once a cell is filled). `router.spec`
  game-card count 2→3.
- Verified: `dc-test --full` 49/49 (run 20260518-155746-test),
  `--ci` (run 20260518-155801-test-ci), production build green
  (`sudoku-ByVR50YI.js` 13.03 kB, precache 22→23), two-theme +
  320px-phone screenshot sweep (given/user/hint/same/conflict/
  selected all distinguishable, 9-wide grid fits the smallest phone).

Context:
- Third game = Sudoku. Plan:
  `~/.claude/plans/abstract-watching-avalanche.md`.
- All TODO.md epics complete. The repo is at a clean epic boundary;
  the only remaining backlog is the deferred WASM-game epic.

When starting / resuming work:
1. Read `CLAUDE.md`, `TESTING.md`, `TODO.md`, this file, the plan.
2. All code tagged + tested from day one (`TESTING.md`):
   `@unit|@e2e` + an area tag.
3. Hard stop after each epic: commit → update `TODO.md` + this file
   → end the turn, wait for the user.
