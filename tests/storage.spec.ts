import { test, expect } from "@playwright/test";
import { createGameStorage } from "../src/lib/storage.ts";

// Establishes the @storage area tag. Speed tier @unit: pure module
// logic, no browser nav / SW / network. The module reads the global
// `localStorage` at call time, so a Node Map-backed polyfill exercises
// the real key namespacing + JSON codec without a page.

function installLocalStorage(): Map<string, string> {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
  return m;
}

test("namespaces keys and round-trips JSON @unit @storage", () => {
  const raw = installLocalStorage();
  const s = createGameStorage("tictactoe");

  s.set("score", { w: 2, l: 1, d: 0 });
  expect([...raw.keys()]).toEqual(["pwa-games:tictactoe:score"]);
  expect(s.get<{ w: number; l: number; d: number }>("score")).toEqual({
    w: 2,
    l: 1,
    d: 0,
  });

  s.remove("score");
  expect(s.get("score")).toBeNull();
});

test("isolates namespaces per game id @unit @storage", () => {
  installLocalStorage();
  const a = createGameStorage("alpha");
  const b = createGameStorage("beta");

  a.set("k", 1);
  expect(a.get("k")).toBe(1);
  expect(b.get("k")).toBeNull(); // disjoint namespace
});

test("missing or corrupt entries read as null @unit @storage", () => {
  const raw = installLocalStorage();
  const s = createGameStorage("g");

  expect(s.get("never-set")).toBeNull();
  raw.set("pwa-games:g:bad", "{not json");
  expect(s.get("bad")).toBeNull(); // corrupt → absent, no throw
});
