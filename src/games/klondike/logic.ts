// Klondike solitaire rules. Pure: no DOM, no storage, no mutation of
// inputs — every function returns fresh state, so the @unit tier drives
// the whole engine (deal → moves → auto-solve → win) with zero browser.
// index.ts owns all state/timers/DOM; this module only answers
// "is this move legal" and "what state does it yield".

export type Suit = "S" | "H" | "D" | "C";
export type Color = "red" | "black";

/** Stable id e.g. "S1" (Ace♠), "H13" (King♥) — used as a Playwright
 *  selector and for run identity. rank: 1=Ace … 13=King. */
export interface Card {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
}

export interface GameState {
  /** 7 piles; only the last card of each is face-up after a deal. */
  tableau: Card[][];
  /** Face-down draw pile; the end is the "top" we draw from. */
  stock: Card[];
  /** Face-up; the end is the visible/top card. */
  waste: Card[];
  /** Per-suit A→K piles. */
  foundations: Record<Suit, Card[]>;
  drawCount: 1 | 3;
}

export type Move =
  | { type: "draw" }
  | { type: "recycle" }
  | { type: "wasteToTableau"; to: number }
  | { type: "wasteToFoundation"; suit: Suit }
  | { type: "tableauToTableau"; from: number; index: number; to: number }
  | { type: "tableauToFoundation"; from: number; suit: Suit };

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];

export const colorOf = (suit: Suit): Color =>
  suit === "H" || suit === "D" ? "red" : "black";

export const topOf = (pile: Card[]): Card | null =>
  pile.length ? pile[pile.length - 1] : null;

/** Ordered 52-card deck, all face-down. */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}${rank}`, suit, rank, faceUp: false });
    }
  }
  return deck;
}

/** Deterministic PRNG so seeded deals/tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates; pure (copies input), driven by `rng`. */
export function shuffle(deck: Card[], rng: () => number): Card[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deal a fresh game: tableau pile i gets i+1 cards (last face-up),
 *  remaining 24 → stock face-down, empty waste/foundations. */
export function deal(deck: Card[], drawCount: 1 | 3): GameState {
  const tableau: Card[][] = [];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    const pile: Card[] = [];
    for (let n = 0; n <= col; n++) {
      pile.push({ ...deck[idx++], faceUp: n === col });
    }
    tableau.push(pile);
  }
  const stock = deck.slice(idx).map((c) => ({ ...c, faceUp: false }));
  return {
    tableau,
    stock,
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    drawCount,
  };
}

/** Can `moving` go onto a tableau pile whose current top is `onto`?
 *  Empty pile (onto null) accepts only a King; else opposite colour
 *  and exactly one rank lower. */
export function canStackTableau(moving: Card, onto: Card | null): boolean {
  if (onto === null) return moving.rank === 13;
  return (
    colorOf(onto.suit) !== colorOf(moving.suit) &&
    onto.rank === moving.rank + 1
  );
}

/** Can `card` go on `foundationPile` (a single suit, A→K)? */
export function canStackFoundation(
  card: Card,
  foundationPile: Card[],
): boolean {
  const top = topOf(foundationPile);
  if (top === null) return card.rank === 1;
  return card.suit === top.suit && card.rank === top.rank + 1;
}

/** A contiguous face-up alternating-colour descending run (≥1 card). */
export function isMovableRun(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  for (const c of cards) if (!c.faceUp) return false;
  for (let i = 1; i < cards.length; i++) {
    if (!canStackTableau(cards[i], cards[i - 1])) return false;
  }
  return true;
}

function cloneState(s: GameState): GameState {
  return {
    tableau: s.tableau.map((p) => p.slice()),
    stock: s.stock.slice(),
    waste: s.waste.slice(),
    foundations: {
      S: s.foundations.S.slice(),
      H: s.foundations.H.slice(),
      D: s.foundations.D.slice(),
      C: s.foundations.C.slice(),
    },
    drawCount: s.drawCount,
  };
}

/** Flip the now-exposed top of a tableau pile face-up (after a pop). */
function flipExposed(pile: Card[]): void {
  const top = topOf(pile);
  if (top && !top.faceUp) pile[pile.length - 1] = { ...top, faceUp: true };
}

/** Apply a move immutably. Returns a NEW state, or null if illegal. */
export function applyMove(state: GameState, move: Move): GameState | null {
  const s = cloneState(state);

  switch (move.type) {
    case "draw": {
      if (s.stock.length === 0) return null;
      const n = Math.min(s.drawCount, s.stock.length);
      const taken = s.stock.splice(s.stock.length - n, n);
      for (const c of taken) s.waste.push({ ...c, faceUp: true });
      return s;
    }
    case "recycle": {
      if (s.stock.length !== 0 || s.waste.length === 0) return null;
      s.stock = s.waste
        .slice()
        .reverse()
        .map((c) => ({ ...c, faceUp: false }));
      s.waste = [];
      return s;
    }
    case "wasteToTableau": {
      const card = topOf(s.waste);
      if (!card) return null;
      if (!canStackTableau(card, topOf(s.tableau[move.to]))) return null;
      s.waste.pop();
      s.tableau[move.to].push({ ...card, faceUp: true });
      return s;
    }
    case "wasteToFoundation": {
      const card = topOf(s.waste);
      if (!card || card.suit !== move.suit) return null;
      if (!canStackFoundation(card, s.foundations[move.suit])) return null;
      s.waste.pop();
      s.foundations[move.suit].push({ ...card, faceUp: true });
      return s;
    }
    case "tableauToTableau": {
      const src = s.tableau[move.from];
      if (move.index < 0 || move.index >= src.length) return null;
      const run = src.slice(move.index);
      if (!isMovableRun(run)) return null;
      if (!canStackTableau(run[0], topOf(s.tableau[move.to]))) return null;
      s.tableau[move.from] = src.slice(0, move.index);
      s.tableau[move.to] = [...s.tableau[move.to], ...run];
      flipExposed(s.tableau[move.from]);
      return s;
    }
    case "tableauToFoundation": {
      const src = s.tableau[move.from];
      const card = topOf(src);
      if (!card || card.suit !== move.suit) return null;
      if (!canStackFoundation(card, s.foundations[move.suit])) return null;
      src.pop();
      s.foundations[move.suit].push({ ...card, faceUp: true });
      flipExposed(src);
      return s;
    }
  }
}

/** The foundation suit `card` can move to right now, or null. Caller
 *  must pass a card that is currently a top (waste / tableau pile). */
export function foundationTargetFor(
  state: GameState,
  card: Card,
): Suit | null {
  return canStackFoundation(card, state.foundations[card.suit])
    ? card.suit
    : null;
}

export const isWon = (s: GameState): boolean =>
  SUITS.every((suit) => s.foundations[suit].length === 13);

/** Once no tableau card is face-down, the deal is always solvable by
 *  repeatedly sending the lowest needed card up (stock cycles freely),
 *  so we can finish it without the player clicking each card. */
export function canAutoComplete(s: GameState): boolean {
  if (isWon(s)) return false;
  return s.tableau.every((pile) => pile.every((c) => c.faceUp));
}

/** One move toward an auto-completed win, or null when done/stuck.
 *  Prefers a foundation move (tableau tops, then waste); otherwise
 *  cycles the stock so the next pass exposes more cards. */
export function autoStep(
  state: GameState,
): { state: GameState; move: Move } | null {
  if (isWon(state)) return null;

  for (let from = 0; from < state.tableau.length; from++) {
    const c = topOf(state.tableau[from]);
    if (c && canStackFoundation(c, state.foundations[c.suit])) {
      const move: Move = { type: "tableauToFoundation", from, suit: c.suit };
      const next = applyMove(state, move);
      if (next) return { state: next, move };
    }
  }

  const w = topOf(state.waste);
  if (w && canStackFoundation(w, state.foundations[w.suit])) {
    const move: Move = { type: "wasteToFoundation", suit: w.suit };
    const next = applyMove(state, move);
    if (next) return { state: next, move };
  }

  if (state.stock.length > 0) {
    const move: Move = { type: "draw" };
    const next = applyMove(state, move);
    if (next) return { state: next, move };
  }
  if (state.waste.length > 0) {
    const move: Move = { type: "recycle" };
    const next = applyMove(state, move);
    if (next) return { state: next, move };
  }
  return null;
}
