// Sudoku engine. Pure: no DOM, no storage, no mutation of caller inputs
// — every public fn returns fresh data, so the @unit tier drives the
// whole engine (generate → rate → solve) with zero browser. index.ts
// owns all state/timers/DOM; this module only answers "what puzzle",
// "is this solvable by technique T", "is it complete/legal".
//
// Difficulty is *real*, not "fewer givens": a puzzle is rated by the
// hardest logical technique its solve is forced to use (a simplified
// Sudoku-Explainer ladder), then bucketed.

export type Grid = number[]; // length 81, 0 = empty
export type Difficulty = "easy" | "normal" | "hard" | "veryhard";

export interface Puzzle {
  givens: Grid;
  solution: Grid;
  difficulty: Difficulty;
  rating: number; // ladder tier index actually forced (see TIERS)
}

export const ALL = 0x1ff; // 9-bit mask, bit d-1 set = digit d possible

export const rowOf = (i: number): number => (i / 9) | 0;
export const colOf = (i: number): number => i % 9;
export const boxOf = (i: number): number =>
  3 * ((rowOf(i) / 3) | 0) + ((colOf(i) / 3) | 0);

// 27 units (9 rows, 9 cols, 9 boxes) + 20 peers/cell, built once.
export const UNITS: number[][] = [];
export const PEERS: number[][] = [];
{
  for (let r = 0; r < 9; r++) {
    const row: number[] = [];
    for (let c = 0; c < 9; c++) row.push(r * 9 + c);
    UNITS.push(row);
  }
  for (let c = 0; c < 9; c++) {
    const col: number[] = [];
    for (let r = 0; r < 9; r++) col.push(r * 9 + c);
    UNITS.push(col);
  }
  for (let b = 0; b < 9; b++) {
    const box: number[] = [];
    const r0 = 3 * ((b / 3) | 0);
    const c0 = 3 * (b % 3);
    for (let r = r0; r < r0 + 3; r++)
      for (let c = c0; c < c0 + 3; c++) box.push(r * 9 + c);
    UNITS.push(box);
  }
  for (let i = 0; i < 81; i++) {
    const set = new Set<number>();
    for (const j of UNITS[rowOf(i)]) set.add(j);
    for (const j of UNITS[9 + colOf(i)]) set.add(j);
    for (const j of UNITS[18 + boxOf(i)]) set.add(j);
    set.delete(i);
    PEERS.push([...set]);
  }
}

const bit = (d: number): number => 1 << (d - 1);
const popcount = (m: number): number => {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
};
const onlyDigit = (m: number): number => Math.log2(m) + 1; // m has 1 bit

/** Deterministic PRNG (copied from klondike/logic.ts — engines stay
 *  self-contained per the "repo owns its copy" ethos). Same seed →
 *  same puzzle, so `?seed=` routes and @unit tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Can digit `d` legally go at `idx` given current `g` (no peer has it)? */
function legal(g: Grid, idx: number, d: number): boolean {
  for (const p of PEERS[idx]) if (g[p] === d) return false;
  return true;
}

/** A complete solution for `grid` (0=empty) via randomized backtracking,
 *  or null if unsolvable. Pure (copies input). */
export function fullSolve(grid: Grid, rng: () => number): Grid | null {
  const g = grid.slice();
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const solve = (): boolean => {
    let idx = -1;
    for (let i = 0; i < 81; i++)
      if (g[i] === 0) {
        idx = i;
        break;
      }
    if (idx === -1) return true;
    for (const d of shuffled(digits, rng)) {
      if (legal(g, idx, d)) {
        g[idx] = d;
        if (solve()) return true;
        g[idx] = 0;
      }
    }
    return false;
  };
  return solve() ? g : null;
}

/** Number of solutions, counting only up to `limit` (the abort makes a
 *  uniqueness test cheap: unique ⇔ countSolutions(g,2) === 1). */
export function countSolutions(grid: Grid, limit = 2): number {
  const g = grid.slice();
  let count = 0;
  const rec = (): void => {
    if (count >= limit) return;
    // MRV: branch on the most-constrained empty cell → far fewer nodes.
    let idx = -1;
    let best = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      let n = 0;
      for (let d = 1; d <= 9; d++) if (legal(g, i, d)) n++;
      if (n < best) {
        best = n;
        idx = i;
        if (n <= 1) break;
      }
    }
    if (idx === -1) {
      count++;
      return;
    }
    for (let d = 1; d <= 9; d++) {
      if (legal(g, idx, d)) {
        g[idx] = d;
        rec();
        g[idx] = 0;
        if (count >= limit) return;
      }
    }
  };
  rec();
  return count;
}

// ---- candidate model + technique ladder -----------------------------
// Techniques operate on a model; each returns whether it made progress
// (placed a digit OR eliminated a candidate). rate() runs the ladder
// cheapest-first, tracking the hardest tier the solve was forced to use.

export interface Model {
  grid: Grid;
  cand: number[]; // bitmask of possible digits per empty cell; 0 if filled
}

export function computeModel(grid: Grid): Model {
  const cand = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    let used = 0;
    for (const p of PEERS[i]) if (grid[p]) used |= bit(grid[p]);
    cand[i] = ALL & ~used;
  }
  return { grid: grid.slice(), cand };
}

function place(m: Model, idx: number, d: number): void {
  m.grid[idx] = d;
  m.cand[idx] = 0;
  const b = bit(d);
  for (const p of PEERS[idx]) m.cand[p] &= ~b;
}

/** Clear digit `d` from `idx`'s candidates; true if it was there. */
function eliminate(m: Model, idx: number, d: number): boolean {
  const b = bit(d);
  if (!(m.cand[idx] & b)) return false;
  m.cand[idx] &= ~b;
  return true;
}

export function nakedSingle(m: Model): boolean {
  let any = false;
  for (let i = 0; i < 81; i++) {
    if (m.grid[i] === 0 && popcount(m.cand[i]) === 1) {
      place(m, i, onlyDigit(m.cand[i]));
      any = true;
    }
  }
  return any;
}

export function hiddenSingle(m: Model): boolean {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      let where = -1;
      let n = 0;
      for (const i of unit) {
        if (m.grid[i] === 0 && m.cand[i] & b) {
          where = i;
          n++;
        }
      }
      if (n === 1) {
        place(m, where, d);
        return true;
      }
    }
  }
  return false;
}

/** Pointing + claiming: a digit confined to one row/col within a box
 *  (or to one box within a line) is eliminated elsewhere on that line
 *  / in that box. */
export function lockedCandidates(m: Model): boolean {
  let any = false;
  for (let b = 0; b < 9; b++) {
    const box = UNITS[18 + b];
    for (let d = 1; d <= 9; d++) {
      const cells = box.filter((i) => m.grid[i] === 0 && m.cand[i] & bit(d));
      if (cells.length < 2) continue;
      const rows = new Set(cells.map(rowOf));
      const cols = new Set(cells.map(colOf));
      if (rows.size === 1) {
        for (const i of UNITS[rowOf(cells[0])])
          if (boxOf(i) !== b && eliminate(m, i, d)) any = true;
      }
      if (cols.size === 1) {
        for (const i of UNITS[9 + colOf(cells[0])])
          if (boxOf(i) !== b && eliminate(m, i, d)) any = true;
      }
    }
  }
  for (let u = 0; u < 18; u++) {
    const line = UNITS[u];
    for (let d = 1; d <= 9; d++) {
      const cells = line.filter((i) => m.grid[i] === 0 && m.cand[i] & bit(d));
      if (cells.length < 2) continue;
      const boxes = new Set(cells.map(boxOf));
      if (boxes.size === 1) {
        for (const i of UNITS[18 + boxes.values().next().value!])
          if (!line.includes(i) && eliminate(m, i, d)) any = true;
      }
    }
  }
  return any;
}

export function nakedPair(m: Model): boolean {
  let any = false;
  for (const unit of UNITS) {
    const cells = unit.filter((i) => m.grid[i] === 0);
    for (let a = 0; a < cells.length; a++) {
      const ma = m.cand[cells[a]];
      if (popcount(ma) !== 2) continue;
      for (let b = a + 1; b < cells.length; b++) {
        if (m.cand[cells[b]] !== ma) continue;
        for (const i of unit) {
          if (i === cells[a] || i === cells[b] || m.grid[i] !== 0) continue;
          for (let d = 1; d <= 9; d++)
            if (ma & bit(d) && eliminate(m, i, d)) any = true;
        }
      }
    }
  }
  return any;
}

export function hiddenPair(m: Model): boolean {
  let any = false;
  for (const unit of UNITS) {
    for (let x = 1; x <= 9; x++) {
      for (let y = x + 1; y <= 9; y++) {
        const bx = bit(x);
        const by = bit(y);
        const cx = unit.filter((i) => m.grid[i] === 0 && m.cand[i] & bx);
        const cy = unit.filter((i) => m.grid[i] === 0 && m.cand[i] & by);
        if (cx.length !== 2 || cy.length !== 2) continue;
        if (cx[0] !== cy[0] || cx[1] !== cy[1]) continue;
        const keep = bx | by;
        for (const i of cx)
          for (let d = 1; d <= 9; d++)
            if (!(keep & bit(d)) && eliminate(m, i, d)) any = true;
      }
    }
  }
  return any;
}

function tripleStep(m: Model): boolean {
  // Naked triple: 3 cells whose candidate-union has size 3.
  let any = false;
  for (const unit of UNITS) {
    const cells = unit.filter(
      (i) => m.grid[i] === 0 && popcount(m.cand[i]) >= 2,
    );
    for (let a = 0; a < cells.length; a++)
      for (let b = a + 1; b < cells.length; b++)
        for (let c = b + 1; c < cells.length; c++) {
          const u = m.cand[cells[a]] | m.cand[cells[b]] | m.cand[cells[c]];
          if (popcount(u) !== 3) continue;
          const triple = [cells[a], cells[b], cells[c]];
          for (const i of unit) {
            if (triple.includes(i) || m.grid[i] !== 0) continue;
            for (let d = 1; d <= 9; d++)
              if (u & bit(d) && eliminate(m, i, d)) any = true;
          }
        }
  }
  if (any) return true;
  // Hidden triple: 3 digits confined to the same 3 cells of a unit.
  for (const unit of UNITS) {
    for (let x = 1; x <= 9; x++)
      for (let y = x + 1; y <= 9; y++)
        for (let z = y + 1; z <= 9; z++) {
          const mask = bit(x) | bit(y) | bit(z);
          const cells = unit.filter(
            (i) => m.grid[i] === 0 && m.cand[i] & mask,
          );
          if (cells.length !== 3) continue;
          const cover = cells.reduce((s, i) => s | m.cand[i], 0);
          if (popcount(cover & ~mask) === 0) continue; // nothing to trim
          // each digit must actually appear among these cells
          if ((cover & mask) !== mask) continue;
          for (const i of cells)
            for (let d = 1; d <= 9; d++)
              if (!(mask & bit(d)) && eliminate(m, i, d)) any = true;
        }
  }
  return any;
}

export function xWing(m: Model): boolean {
  let any = false;
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    // row-based: two rows with d in the same exactly-two columns →
    // eliminate d from those columns in every other row.
    const rowCols: number[][] = [];
    for (let r = 0; r < 9; r++) {
      const cs: number[] = [];
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        if (m.grid[i] === 0 && m.cand[i] & b) cs.push(c);
      }
      rowCols[r] = cs;
    }
    for (let r1 = 0; r1 < 9; r1++) {
      if (rowCols[r1].length !== 2) continue;
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (
          rowCols[r2].length !== 2 ||
          rowCols[r1][0] !== rowCols[r2][0] ||
          rowCols[r1][1] !== rowCols[r2][1]
        )
          continue;
        for (const c of rowCols[r1])
          for (let r = 0; r < 9; r++) {
            if (r === r1 || r === r2) continue;
            if (eliminate(m, r * 9 + c, d)) any = true;
          }
      }
    }
    // column-based mirror
    const colRows: number[][] = [];
    for (let c = 0; c < 9; c++) {
      const rs: number[] = [];
      for (let r = 0; r < 9; r++) {
        const i = r * 9 + c;
        if (m.grid[i] === 0 && m.cand[i] & b) rs.push(r);
      }
      colRows[c] = rs;
    }
    for (let c1 = 0; c1 < 9; c1++) {
      if (colRows[c1].length !== 2) continue;
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        if (
          colRows[c2].length !== 2 ||
          colRows[c1][0] !== colRows[c2][0] ||
          colRows[c1][1] !== colRows[c2][1]
        )
          continue;
        for (const r of colRows[c1])
          for (let c = 0; c < 9; c++) {
            if (c === c1 || c === c2) continue;
            if (eliminate(m, r * 9 + c, d)) any = true;
          }
      }
    }
  }
  return any;
}

/** The graded ladder, cheap → expensive. Index = tier (the `rating`). */
const LADDER: ((m: Model) => boolean)[] = [
  nakedSingle, // 0  → easy
  hiddenSingle, // 1  → normal
  lockedCandidates, // 2  → normal
  nakedPair, // 3  → hard
  hiddenPair, // 4  → hard
  tripleStep, // 5  → very hard
  xWing, // 6  → very hard
];
const UNSOLVED = 99; // ladder stuck → beyond our techniques

const isFilled = (g: Grid): boolean => g.every((v) => v !== 0);

/** Run the ladder; `rating` = hardest tier the solve was forced to use
 *  (UNSOLVED if it stalls — i.e. harder than anything we model). */
export function rate(
  givens: Grid,
  _solution?: Grid,
): { rating: number; solvedByLadder: boolean } {
  const m = computeModel(givens);
  let maxTier = 0;
  for (;;) {
    if (isFilled(m.grid)) break;
    let advanced = false;
    for (let t = 0; t < LADDER.length; t++) {
      if (LADDER[t](m)) {
        if (t > maxTier) maxTier = t;
        advanced = true;
        break;
      }
    }
    if (!advanced) return { rating: UNSOLVED, solvedByLadder: false };
  }
  return { rating: maxTier, solvedByLadder: true };
}

export function classify(rating: number): Difficulty {
  if (rating <= 0) return "easy";
  if (rating <= 2) return "normal";
  if (rating <= 4) return "hard";
  return "veryhard";
}

const ORDER: Difficulty[] = ["easy", "normal", "hard", "veryhard"];
const CLUE_FLOOR: Record<Difficulty, number> = {
  easy: 44,
  normal: 36,
  hard: 30,
  veryhard: 25,
};
const BUDGET_MS: Record<Difficulty, number> = {
  easy: 300,
  normal: 300,
  hard: 700,
  veryhard: 1400,
};

/** Carve a unique-solution puzzle out of `solution`: remove cells in a
 *  seeded order, keeping a removal only while the grid stays uniquely
 *  solvable, stopping at the difficulty's clue floor. */
function dig(solution: Grid, rng: () => number, diff: Difficulty): Grid {
  const g = solution.slice();
  let clues = 81;
  const floor = CLUE_FLOOR[diff];
  for (const idx of shuffled(
    Array.from({ length: 81 }, (_, i) => i),
    rng,
  )) {
    if (clues <= floor) break;
    const saved = g[idx];
    g[idx] = 0;
    if (countSolutions(g, 2) !== 1) g[idx] = saved;
    else clues--;
  }
  return g;
}

/** Runtime generate + technique-rate (chosen over a bundled pool: tiny
 *  bundle, infinite variety, deterministic `?seed=` for E2E). Re-digs
 *  with successive seeds until `classify(rating)` matches; on budget
 *  exhaustion returns the closest valid unique puzzle, labelled with its
 *  *measured* difficulty — the HUD never reports a difficulty the
 *  generator did not actually achieve. */
export function generate(difficulty: Difficulty, seed: number): Puzzle {
  const start = Date.now();
  const budget = BUDGET_MS[difficulty];
  let best: Puzzle | null = null;
  let bestDist = Infinity;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (attempt > 0 && Date.now() - start > budget) break;
    const rng = mulberry32((seed + attempt * 0x9e3779b1) >>> 0);
    const solution = fullSolve(new Array<number>(81).fill(0), rng);
    if (!solution) continue;
    const givens = dig(solution, rng, difficulty);
    const { rating } = rate(givens, solution);
    const cls = classify(rating);
    const puzzle: Puzzle = { givens, solution, difficulty: cls, rating };
    if (cls === difficulty) return puzzle;
    const dist = Math.abs(ORDER.indexOf(cls) - ORDER.indexOf(difficulty));
    if (dist < bestDist) {
      bestDist = dist;
      best = puzzle;
    }
  }
  if (best) return best;
  // Degenerate fallback (should never hit within budget): a solved grid
  // minus one cell — trivially easy, still unique.
  const rng = mulberry32(seed >>> 0);
  const solution = fullSolve(new Array<number>(81).fill(0), rng)!;
  const givens = solution.slice();
  givens[80] = 0;
  return { givens, solution, difficulty: "easy", rating: 0 };
}

// ---- board predicates (UI uses these) -------------------------------

/** Indices whose digit duplicates another in its row/col/box. Always-on
 *  rule enforcement, independent of the optional mistake check. */
export function conflicts(grid: Grid): number[] {
  const bad = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const v = grid[i];
      if (v === 0) continue;
      if (seen.has(v)) {
        bad.add(i);
        bad.add(seen.get(v)!);
      } else seen.set(v, i);
    }
  }
  return [...bad];
}

export const isComplete = (grid: Grid): boolean =>
  grid.every((v) => v !== 0) && conflicts(grid).length === 0;

/** A cell the current grid logically *forces* (a naked or hidden
 *  single), or -1. Used to make a hint reveal a deduced cell when one
 *  exists rather than an arbitrary one. */
export function firstForcedCell(grid: Grid): number {
  const m = computeModel(grid);
  for (let i = 0; i < 81; i++)
    if (m.grid[i] === 0 && popcount(m.cand[i]) === 1) return i;
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      let where = -1;
      let n = 0;
      for (const i of unit)
        if (m.grid[i] === 0 && m.cand[i] & b) {
          where = i;
          n++;
        }
      if (n === 1) return where;
    }
  }
  return -1;
}
