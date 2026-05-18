// Game registry (PLAN.md §Registry). Each entry carries `meta` (so the
// menu renders without loading any game) plus a lazy `load()` that
// dynamically imports the module — each game code-splits into its own
// chunk. Add a game = add its folder + one entry here.

import type { GameMeta, GameModule } from "./types.ts";

export interface GameEntry {
  meta: GameMeta;
  load: () => Promise<GameModule>;
}

// tictactoe lands in Epic 4:
//   { meta: tictactoeMeta,
//     load: () => import("./tictactoe/index.ts").then((m) => m.default) }
export const registry: GameEntry[] = [];

export function findGame(id: string): GameEntry | undefined {
  return registry.find((e) => e.meta.id === id);
}
