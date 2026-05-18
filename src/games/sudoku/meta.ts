// Split from index.ts so the registry (and thus the menu) can show the
// card from `meta` alone without pulling the game's DOM/logic chunk.
// index.ts re-exports this as GameModule.meta.

import type { GameMeta } from "../types.ts";

export const meta: GameMeta = {
  id: "sudoku",
  title: "Sudoku",
  description:
    "Easy → very hard, rated by real solving technique. Notes, optional mistake check, per-box hints. Timed, auto-saved.",
};
