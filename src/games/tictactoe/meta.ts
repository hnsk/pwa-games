// Split from index.ts so the registry (and thus the menu) can show the
// card from `meta` alone without pulling the game's DOM/logic chunk.
// index.ts re-exports this as GameModule.meta.

import type { GameMeta } from "../types.ts";

export const meta: GameMeta = {
  id: "tictactoe",
  title: "Tic-Tac-Toe",
  description: "Hot-seat X vs O on a 3×3 grid. Local scores, no opponent AI.",
};
