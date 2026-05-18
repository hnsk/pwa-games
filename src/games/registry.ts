// Game registry (PLAN.md §Registry). Each entry carries `meta` (so the
// menu renders without loading any game) plus a lazy `load()` that
// dynamically imports the module — each game code-splits into its own
// chunk. Add a game = add its folder + one entry here.

import type { GameMeta, GameModule } from "./types.ts";
import { meta as tictactoeMeta } from "./tictactoe/meta.ts";
import { meta as klondikeMeta } from "./klondike/meta.ts";
import { meta as sudokuMeta } from "./sudoku/meta.ts";

export interface GameEntry {
  meta: GameMeta;
  load: () => Promise<GameModule>;
}

// `meta` is imported statically (tiny, no DOM/logic) so the menu renders
// without the game chunk; `load()` is the dynamic import that code-splits
// the actual module. Add a game = its folder + one entry here.
export const registry: GameEntry[] = [
  {
    meta: tictactoeMeta,
    load: () => import("./tictactoe/index.ts").then((m) => m.default),
  },
  {
    meta: klondikeMeta,
    load: () => import("./klondike/index.ts").then((m) => m.default),
  },
  {
    meta: sudokuMeta,
    load: () => import("./sudoku/index.ts").then((m) => m.default),
  },
];

export function findGame(id: string): GameEntry | undefined {
  return registry.find((e) => e.meta.id === id);
}
