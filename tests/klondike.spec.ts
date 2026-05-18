import { test, expect } from "@playwright/test";
import {
  applyMove,
  autoStep,
  canAutoComplete,
  canStackFoundation,
  canStackTableau,
  deal,
  isMovableRun,
  isWon,
  makeDeck,
  mulberry32,
  shuffle,
  type Card,
  type GameState,
  type Suit,
} from "../src/games/klondike/logic.ts";

// Establishes the @klondike area tag. Speed tier @unit: pure logic.ts
// (no page / SW / network), like storage.spec — the engine is driven
// deal → moves → auto-solve → win with zero browser. The @e2e tier
// (mounted GameModule) lands in Epic 9.

const card = (id: string, faceUp = true): Card => ({
  id,
  suit: id[0] as Suit,
  rank: Number(id.slice(1)),
  faceUp,
});

test("makeDeck yields 52 unique cards @unit @klondike", () => {
  const deck = makeDeck();
  expect(deck).toHaveLength(52);
  expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  expect(deck.every((c) => !c.faceUp)).toBe(true);
});

test("mulberry32 + shuffle are deterministic permutations @unit @klondike", () => {
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);

  const deck = makeDeck();
  const a = shuffle(deck, mulberry32(7));
  const b = shuffle(deck, mulberry32(7));
  expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id)); // same seed
  expect([...a.map((c) => c.id)].sort()).toEqual(
    [...deck.map((c) => c.id)].sort(),
  ); // same multiset
  expect(a.map((c) => c.id)).not.toEqual(deck.map((c) => c.id)); // reordered
  expect(deck[0].id).toBe("S1"); // input untouched
});

test("deal lays out 1..7 tableau + 24 stock @unit @klondike", () => {
  const g = deal(makeDeck(), 3);
  expect(g.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  for (const pile of g.tableau) {
    expect(pile[pile.length - 1].faceUp).toBe(true);
    expect(pile.slice(0, -1).every((c) => !c.faceUp)).toBe(true);
  }
  expect(g.stock).toHaveLength(24);
  expect(g.stock.every((c) => !c.faceUp)).toBe(true);
  expect(g.waste).toEqual([]);
  expect(Object.values(g.foundations).every((f) => f.length === 0)).toBe(true);
  expect(g.drawCount).toBe(3);
});

test("tableau stacking: King-to-empty, opposite colour, descending @unit @klondike", () => {
  expect(canStackTableau(card("S13"), null)).toBe(true); // K → empty
  expect(canStackTableau(card("S12"), null)).toBe(false); // non-K → empty
  expect(canStackTableau(card("H6"), card("S7"))).toBe(true); // red on black
  expect(canStackTableau(card("S6"), card("C7"))).toBe(false); // same colour
  expect(canStackTableau(card("H5"), card("S7"))).toBe(false); // wrong rank
});

test("foundation stacking: Ace first, same suit ascending @unit @klondike", () => {
  expect(canStackFoundation(card("S1"), [])).toBe(true); // A → empty
  expect(canStackFoundation(card("S2"), [])).toBe(false); // non-A → empty
  expect(canStackFoundation(card("S2"), [card("S1")])).toBe(true);
  expect(canStackFoundation(card("H2"), [card("S1")])).toBe(false); // suit
  expect(canStackFoundation(card("S3"), [card("S1")])).toBe(false); // rank
});

test("isMovableRun requires face-up alternating descending @unit @klondike", () => {
  expect(isMovableRun([card("S7"), card("H6"), card("C5")])).toBe(true);
  expect(isMovableRun([card("S7"), card("C6")])).toBe(false); // same colour
  expect(isMovableRun([card("S7", false)])).toBe(false); // face-down
  expect(isMovableRun([])).toBe(false);
});

test("applyMove waste→foundation is legal-only & pure @unit @klondike", () => {
  const base: GameState = {
    tableau: [[], [], [], [], [], [], []],
    stock: [],
    waste: [card("H3"), card("S1")], // top = S1 (Ace♠)
    foundations: { S: [], H: [], D: [], C: [] },
    drawCount: 3,
  };
  const ok = applyMove(base, { type: "wasteToFoundation", suit: "S" });
  expect(ok!.foundations.S.map((c) => c.id)).toEqual(["S1"]);
  expect(ok!.waste.map((c) => c.id)).toEqual(["H3"]);
  expect(base.waste).toHaveLength(2); // input untouched

  // H3 cannot found onto empty hearts.
  const bad = applyMove(
    { ...base, waste: [card("H3")] },
    { type: "wasteToFoundation", suit: "H" },
  );
  expect(bad).toBeNull();
});

test("tableau→tableau moves a run and flips the exposed card @unit @klondike", () => {
  const state: GameState = {
    tableau: [
      [card("D5", false), card("S6"), card("H5")], // run S6,H5 at idx 1
      [card("H7")], // accepts S6 (red 7 ← black 6)
      [],
      [],
      [],
      [],
      [],
    ],
    stock: [],
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    drawCount: 3,
  };
  const next = applyMove(state, {
    type: "tableauToTableau",
    from: 0,
    index: 1,
    to: 1,
  });
  expect(next!.tableau[1].map((c) => c.id)).toEqual(["H7", "S6", "H5"]);
  expect(next!.tableau[0].map((c) => c.id)).toEqual(["D5"]);
  expect(next!.tableau[0][0].faceUp).toBe(true); // exposed → flipped
  expect(state.tableau[0][0].faceUp).toBe(false); // input untouched
});

test("autoStep drives a face-up board to a win @unit @klondike", () => {
  // 4 piles, each one suit K→A face-up (top = Ace), stock/waste empty.
  const pile = (s: Suit): Card[] =>
    Array.from({ length: 13 }, (_, i) => card(`${s}${13 - i}`));
  let state: GameState = {
    tableau: [pile("S"), pile("H"), pile("D"), pile("C"), [], [], []],
    stock: [],
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    drawCount: 3,
  };
  expect(canAutoComplete(state)).toBe(true);

  for (let i = 0; i < 200 && !isWon(state); i++) {
    const step = autoStep(state);
    expect(step).not.toBeNull();
    state = step!.state;
  }
  expect(isWon(state)).toBe(true);
  expect(autoStep(state)).toBeNull(); // nothing left once won
});

test("canAutoComplete only when no card is face-down @unit @klondike", () => {
  expect(canAutoComplete(deal(makeDeck(), 3))).toBe(false); // has face-down
  const won: GameState = {
    tableau: [[], [], [], [], [], [], []],
    stock: [],
    waste: [],
    foundations: {
      S: Array.from({ length: 13 }, (_, i) => card(`S${i + 1}`)),
      H: Array.from({ length: 13 }, (_, i) => card(`H${i + 1}`)),
      D: Array.from({ length: 13 }, (_, i) => card(`D${i + 1}`)),
      C: Array.from({ length: 13 }, (_, i) => card(`C${i + 1}`)),
    },
    drawCount: 3,
  };
  expect(isWon(won)).toBe(true);
  expect(canAutoComplete(won)).toBe(false); // already won
});
