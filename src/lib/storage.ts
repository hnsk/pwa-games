// Per-game namespaced localStorage (PLAN.md §Storage). Keys are
// `pwa-games:<gameId>:<key>`; values are JSON. No global leaderboard.

import type { GameStorage } from "../games/types.ts";

const PREFIX = "pwa-games";

export function createGameStorage(gameId: string): GameStorage {
  const ns = (key: string) => `${PREFIX}:${gameId}:${key}`;

  return {
    get<T>(key: string): T | null {
      const raw = localStorage.getItem(ns(key));
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null; // corrupt entry → treat as absent
      }
    },

    set<T>(key: string, value: T): void {
      localStorage.setItem(ns(key), JSON.stringify(value));
    },

    remove(key: string): void {
      localStorage.removeItem(ns(key));
    },
  };
}
