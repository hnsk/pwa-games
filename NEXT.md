# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 7 — Klondike model + pure logic ✅ DONE
**Next epic:** Epic 8 — Klondike UI, drag, draw modes, registry, styling
**Next unchecked item:** `src/games/klondike/index.ts` `GameModule`
(DOM glyph board, pointer drag-and-drop, double-tap → foundation,
stock draw/recycle, New game / Draw-mode toggle / Back, `?seed=` hook).

State at completion (Epic 7):
- `src/games/klondike/{meta,logic}.ts` — pure immutable engine.
- `tests/klondike.spec.ts` — 9 `@unit @klondike` cases.
- `dc-test --unit` 16/16 green (run 20260518-110124-test-unit).

Context:
- Second game = Klondike Solitaire. Plan:
  `~/.claude/plans/implement-the-classic-windows-polished-dijkstra.md`.
- Decisions: CSS/DOM glyph cards; pointer drag-and-drop +
  double-tap → foundation; draw-3 default with draw-1 toggle;
  per-mode persisted best time; auto-complete when no face-down
  card remains.

When starting / resuming work:
1. Read `CLAUDE.md`, `TESTING.md`, `TODO.md`, this file, the plan.
2. All code tagged + tested from day one (`TESTING.md`):
   `@unit|@e2e` + `@klondike`.
3. Hard stop after each epic: commit → update `TODO.md` + this file
   → end the turn, wait for the user.
