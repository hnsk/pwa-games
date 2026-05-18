// Split from index.ts so the registry (and thus the menu) can show the
// card from `meta` alone without pulling the game's DOM/logic chunk.
// index.ts re-exports this as GameModule.meta.

import type { GameMeta } from "../types.ts";

export const meta: GameMeta = {
  id: "klondike",
  title: "Klondike Solitaire",
  description:
    "Classic draw-3 Windows-style solitaire. Drag to build, double-tap to send home. Timed, local best-time.",
};
