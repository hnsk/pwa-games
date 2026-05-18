// Game module contract (PLAN.md §Architecture). One interface so the
// shell treats DOM, canvas, and future WASM games identically.

/** Namespaced JSON store handed to a game (impl: src/lib/storage.ts). */
export interface GameStorage {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export interface GameMeta {
  id: string; // url slug + storage namespace
  title: string;
  description: string;
  thumbnail?: string; // menu card asset
}

export interface GameContext {
  storage: GameStorage; // namespaced localStorage
  onExit: () => void; // game asks shell to return to menu
}

export interface GameModule {
  meta: GameMeta;
  mount(el: HTMLElement, ctx: GameContext): void | Promise<void>;
  unmount(): void; // free listeners, RAF, wasm instance
}
