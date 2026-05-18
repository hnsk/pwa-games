// Sudoku GameModule (plan §index.ts). The shell hands us a cleared
// `#app` and a namespaced storage; we own all state + DOM. Pure rules
// live in logic.ts — this file is render + input + timing + persistence
// only. Every listener goes through ONE AbortController so unmount() is
// a single abort (no leaked handlers across navigations); the timer is
// tracked and cleared alongside it. Mirrors klondike/index.ts.

import { createHeader } from "../../ui/header.ts";
import {
  boxOf,
  conflicts,
  firstForcedCell,
  fullSolve,
  generate,
  isComplete,
  mulberry32,
  UNITS,
  type Difficulty,
  type Grid,
  type Puzzle,
} from "./logic.ts";
import { meta } from "./meta.ts";
import type { GameContext, GameModule } from "../types.ts";

const DIFFS: Difficulty[] = ["easy", "normal", "hard", "veryhard"];
const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
  veryhard: "Very hard",
};

/** Optional deterministic seed (`#/g/sudoku?seed=42`) so E2E reaches a
 *  repeatable puzzle; absent → time-seeded. */
function parseSeed(): number | null {
  const m = /[?&]seed=(-?\d+)/.exec(location.hash);
  return m ? Number(m[1]) >>> 0 : null;
}

function parseDiff(): Difficulty | null {
  const m = /[?&]diff=(easy|normal|hard|veryhard)/.exec(location.hash);
  return m ? (m[1] as Difficulty) : null;
}

/** Test-only hook: `#/g/sudoku?solve=1` deals a board with exactly one
 *  empty cell (givens = solution minus one) so an E2E can type the final
 *  digit → win deterministically and fast, without solving a full grid
 *  (mirror of klondike's `?solve=1`). The missing digit is exposed on
 *  `boardEl.dataset.answer` for the spec only — production never deals
 *  this layout. */
function parseSolve(): boolean {
  return /[?&]solve=1\b/.test(location.hash);
}

// Module-scope state: only one game mounts at a time and unmount()
// abandons it, so mount() reinitialises everything below.
let ctx: GameContext;
let seed: number | null = null;
let diffParam: Difficulty | null = null;
let solveLayout = false;
let controller: AbortController | null = null;

let puzzle: Puzzle;
let cells: Grid; // player values, starts = givens
let notes: Set<number>[]; // pencil marks per cell
let selected: number | null = null;
let notesMode = false;
let checkMistakes = false; // optional correctness feedback, off by default
let hintedBoxes: Set<number>;
let difficulty: Difficulty;
let elapsed = 0;
let won = false;
let timerId: number | null = null;

let boardEl: HTMLElement;
let gridEl: HTMLElement;
let padEl: HTMLElement;
let winEl: HTMLElement;
let winSubEl: HTMLElement;
let diffEl: HTMLElement;
let timerEl: HTMLElement;
let hintsEl: HTMLElement;
let statusEl: HTMLElement;
let notesBtn: HTMLButtonElement;
let checkBtn: HTMLButtonElement;
let hintBtn: HTMLButtonElement;

// ---- new puzzle -----------------------------------------------------

function freshPuzzle(): void {
  if (solveLayout) {
    const sol = fullSolve(
      new Array<number>(81).fill(0),
      mulberry32(seed ?? 1),
    )!;
    const givens = sol.slice();
    givens[80] = 0;
    puzzle = { givens, solution: sol, difficulty: "easy", rating: 0 };
  } else {
    const s = seed ?? ((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    puzzle = generate(difficulty, s);
    // generate() may fall back to a different *measured* difficulty; the
    // HUD must report the truth, so adopt what it actually produced.
    difficulty = puzzle.difficulty;
  }
  cells = puzzle.givens.slice();
  notes = Array.from({ length: 81 }, () => new Set<number>());
  hintedBoxes = new Set<number>();
  selected = null;
}

// ---- render ---------------------------------------------------------

const isGiven = (i: number): boolean => puzzle.givens[i] !== 0;

function digitCounts(): number[] {
  const n = new Array<number>(10).fill(0);
  for (const v of cells) if (v) n[v]++;
  return n;
}

function render(): void {
  const conflict = new Set(conflicts(cells));
  const sameDigit =
    selected !== null && cells[selected] ? cells[selected] : 0;

  gridEl.replaceChildren();
  for (let i = 0; i < 81; i++) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "sdk-cell";
    c.dataset.idx = String(i);
    if (isGiven(i)) c.dataset.given = "true";
    if (i === selected) c.dataset.sel = "true";
    if (conflict.has(i)) c.dataset.conflict = "true";

    const v = cells[i];
    if (v) {
      c.textContent = String(v);
      if (!isGiven(i) && hintedBoxes.has(boxOf(i)) && puzzle.solution[i] === v)
        c.dataset.hint = "true";
      if (sameDigit && v === sameDigit) c.dataset.same = "true";
      if (
        checkMistakes &&
        !isGiven(i) &&
        c.dataset.hint !== "true" &&
        v !== puzzle.solution[i]
      )
        c.dataset.wrong = "true";
    } else if (notes[i].size) {
      const n = document.createElement("span");
      n.className = "sdk-notes";
      for (let d = 1; d <= 9; d++) {
        const p = document.createElement("span");
        if (notes[i].has(d)) p.textContent = String(d);
        n.appendChild(p);
      }
      c.appendChild(n);
    }
    gridEl.appendChild(c);
  }

  const counts = digitCounts();
  for (const b of padEl.querySelectorAll<HTMLButtonElement>(
    "[data-digit]",
  )) {
    const d = Number(b.dataset.digit);
    const full = counts[d] >= 9;
    b.disabled = full;
    if (full) b.dataset.full = "true";
    else delete b.dataset.full;
  }

  boardEl.appendChild(winEl); // survive the rebuild
  updateChrome();
}

// ---- timer ----------------------------------------------------------

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function renderTimer(): void {
  timerEl.textContent = formatTime(elapsed);
}

/** First placement starts it; guarded so repeated calls are a no-op.
 *  Stopped on win/unmount. */
function startTimer(): void {
  if (timerId !== null || won) return;
  timerId = window.setInterval(() => {
    elapsed += 1;
    renderTimer();
    saveGame(); // persist elapsed so a reopen resumes the clock
  }, 1000);
}

function stopTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

// ---- persistence ----------------------------------------------------

const SAVE_KEY = "save";
const PREF_KEY = "pref"; // checkMistakes default sticks across games

interface Saved {
  puzzle: Puzzle;
  cells: Grid;
  notes: number[][];
  selected: number | null;
  notesMode: boolean;
  checkMistakes: boolean;
  hintedBoxes: number[];
  difficulty: Difficulty;
  elapsed: number;
}

/** Persist the in-progress game. Skipped for the deterministic
 *  `?seed=`/`?solve=1` demos (they stay reproducible, not bled into the
 *  next visit). A finished game is cleared so a reopen starts fresh. */
function saveGame(): void {
  if (seed !== null || solveLayout) return;
  if (won) {
    ctx.storage.remove(SAVE_KEY);
    return;
  }
  ctx.storage.set<Saved>(SAVE_KEY, {
    puzzle,
    cells,
    notes: notes.map((s) => [...s]),
    selected,
    notesMode,
    checkMistakes,
    hintedBoxes: [...hintedBoxes],
    difficulty,
    elapsed,
  });
}

const is81 = (a: unknown): a is number[] =>
  Array.isArray(a) && a.length === 81;

/** A previously saved game, validated enough to trust the shape. */
function loadGame(): Saved | null {
  const s = ctx.storage.get<Saved>(SAVE_KEY);
  if (
    !s ||
    !s.puzzle ||
    !is81(s.puzzle.givens) ||
    !is81(s.puzzle.solution) ||
    !is81(s.cells) ||
    !Array.isArray(s.notes) ||
    s.notes.length !== 81 ||
    !DIFFS.includes(s.difficulty)
  )
    return null;
  return s;
}

// ---- win / chrome ---------------------------------------------------

function updateChrome(): void {
  diffEl.textContent = DIFF_LABEL[difficulty];
  hintsEl.textContent = `Hints ${hintedBoxes.size}/9`;
  boardEl.dataset.won = won ? "true" : "false";
  statusEl.textContent = won ? `Solved!  ${formatTime(elapsed)}` : "";
  if (won) winSubEl.textContent = `Time ${formatTime(elapsed)}`;

  const box = selected === null ? null : boxOf(selected);
  const boxFull =
    box !== null &&
    UNITS[18 + box].every((i) => cells[i] !== 0);
  hintBtn.disabled =
    won || box === null || hintedBoxes.has(box) || boxFull;
  notesBtn.textContent = `Notes ${notesMode ? "On" : "Off"}`;
  notesBtn.dataset.on = String(notesMode);
  checkBtn.textContent = `Check ${checkMistakes ? "On" : "Off"}`;
  checkBtn.dataset.on = String(checkMistakes);
}

function finishWin(): void {
  won = true;
  stopTimer();
  ctx.storage.remove(SAVE_KEY); // game over → next open starts fresh
  render();
}

/** Post-change hook: start the clock on the first placement, detect a
 *  win. Called after every mutating action. */
function afterChange(): void {
  if (won) return;
  startTimer();
  if (isComplete(cells)) {
    finishWin();
    return;
  }
  render();
  saveGame();
}

// ---- input ----------------------------------------------------------

function selectCell(i: number): void {
  selected = i;
  render();
}

function placeDigit(d: number): void {
  // A number press ALWAYS sets the digit-highlight (req); if an editable
  // cell is selected it also places (or toggles a pencil mark).
  if (selected !== null && !isGiven(selected) && !won) {
    const i = selected;
    if (notesMode) {
      if (cells[i] === 0) {
        if (notes[i].has(d)) notes[i].delete(d);
        else notes[i].add(d);
      }
    } else {
      cells[i] = d;
      notes[i].clear();
      // standard QoL: placing a digit clears it from peers' pencil marks
      for (const u of [
        UNITS[Math.floor(i / 9)],
        UNITS[9 + (i % 9)],
        UNITS[18 + boxOf(i)],
      ])
        for (const p of u) notes[p].delete(d);
    }
  }
  // highlight even when nothing editable is selected: select any cell
  // already holding that digit so render()'s data-same filter lights up.
  if (selected === null || cells[selected] !== d) {
    const hit = cells.findIndex((v) => v === d);
    if (hit !== -1 && (selected === null || isGiven(selected)))
      selected = hit;
  }
  afterChange();
}

function eraseSelected(): void {
  if (selected === null || isGiven(selected) || won) return;
  cells[selected] = 0;
  notes[selected].clear();
  afterChange();
}

function moveSelection(dr: number, dc: number): void {
  const base = selected ?? 0;
  const r = Math.min(8, Math.max(0, ((base / 9) | 0) + dr));
  const c = Math.min(8, Math.max(0, (base % 9) + dc));
  selectCell(r * 9 + c);
}

function onGridClick(e: Event): void {
  const cell = (e.target as HTMLElement).closest<HTMLElement>(".sdk-cell");
  if (cell) selectCell(Number(cell.dataset.idx));
}

function onPadClick(e: Event): void {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!b) return;
  if (b.dataset.digit) placeDigit(Number(b.dataset.digit));
  else if (b.dataset.erase) eraseSelected();
}

function onKey(e: KeyboardEvent): void {
  if (e.key >= "1" && e.key <= "9") placeDigit(Number(e.key));
  else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete")
    eraseSelected();
  else if (e.key === "ArrowUp") moveSelection(-1, 0);
  else if (e.key === "ArrowDown") moveSelection(1, 0);
  else if (e.key === "ArrowLeft") moveSelection(0, -1);
  else if (e.key === "ArrowRight") moveSelection(0, 1);
  else if (e.key === "n" || e.key === "N") toggleNotes();
  else return;
  e.preventDefault();
}

// ---- hint / toggles / new game --------------------------------------

/** Scoped to the selected cell's 3×3 box: one hint per box, max 9 per
 *  puzzle. Reveals a logically-forced empty cell in the box if one
 *  exists, else any empty cell; marks it with the third (hint) style. */
function useHint(): void {
  if (selected === null || won) return;
  const box = boxOf(selected);
  if (hintedBoxes.has(box)) return;
  const boxCells = UNITS[18 + box];
  const forced = firstForcedCell(cells);
  const target =
    forced !== -1 && boxCells.includes(forced)
      ? forced
      : boxCells.find((i) => cells[i] === 0);
  if (target === undefined || target === -1) return;
  cells[target] = puzzle.solution[target];
  notes[target].clear();
  hintedBoxes.add(box);
  afterChange();
}

function toggleNotes(): void {
  notesMode = !notesMode;
  saveGame();
  updateChrome();
}

function toggleCheck(): void {
  checkMistakes = !checkMistakes;
  ctx.storage.set<{ checkMistakes: boolean }>(PREF_KEY, { checkMistakes });
  saveGame();
  render();
}

function resetRound(): void {
  solveLayout = false; // ?solve=1 is a one-shot mount demo
  stopTimer();
  elapsed = 0;
  won = false;
  freshPuzzle();
  render();
  renderTimer();
  saveGame();
}

function newGame(): void {
  resetRound();
}

function cycleDifficulty(): void {
  difficulty = DIFFS[(DIFFS.indexOf(difficulty) + 1) % DIFFS.length];
  resetRound(); // a puzzle's difficulty is fixed at generation → redeal
}

function button(
  text: string,
  cls: string,
  onClick: () => void,
  signal: AbortSignal,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", onClick, { signal });
  return b;
}

const sudoku: GameModule = {
  meta,

  mount(el: HTMLElement, context: GameContext): void {
    ctx = context;
    seed = parseSeed();
    diffParam = parseDiff();
    solveLayout = parseSolve();
    won = false;
    timerId = null;
    notesMode = false;
    checkMistakes =
      ctx.storage.get<{ checkMistakes: boolean }>(PREF_KEY)?.checkMistakes ??
      false;

    const saved =
      seed === null && !solveLayout ? loadGame() : null;
    if (saved) {
      puzzle = saved.puzzle;
      cells = saved.cells;
      notes = saved.notes.map((a) => new Set(a));
      selected = saved.selected;
      notesMode = saved.notesMode;
      checkMistakes = saved.checkMistakes;
      hintedBoxes = new Set(saved.hintedBoxes);
      difficulty = saved.difficulty;
      elapsed = saved.elapsed;
      won = isComplete(cells);
    } else {
      difficulty = diffParam ?? "easy";
      elapsed = 0;
      freshPuzzle();
    }

    controller = new AbortController();
    const { signal } = controller;

    el.replaceChildren();
    el.appendChild(createHeader());

    const main = document.createElement("main");
    main.className = "shell-main sdk";

    const lead = document.createElement("h2");
    lead.className = "sdk-title";
    lead.textContent = meta.title;

    const bar = document.createElement("div");
    bar.className = "sdk-bar";
    diffEl = document.createElement("span");
    diffEl.className = "sdk-diff";
    timerEl = document.createElement("span");
    timerEl.className = "sdk-timer";
    hintsEl = document.createElement("span");
    hintsEl.className = "sdk-hints";
    statusEl = document.createElement("span");
    statusEl.className = "sdk-status";
    bar.append(diffEl, timerEl, hintsEl, statusEl);

    boardEl = document.createElement("div");
    boardEl.className = "sdk-board";
    gridEl = document.createElement("div");
    gridEl.className = "sdk-grid";
    boardEl.appendChild(gridEl);

    winEl = document.createElement("div");
    winEl.className = "sdk-win";
    const winTitle = document.createElement("p");
    winTitle.className = "sdk-win__title";
    winTitle.textContent = "Solved";
    winSubEl = document.createElement("p");
    winSubEl.className = "sdk-win__sub";
    winEl.append(winTitle, winSubEl);

    padEl = document.createElement("div");
    padEl.className = "sdk-pad";
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sdk-key";
      b.dataset.digit = String(d);
      b.textContent = String(d);
      padEl.appendChild(b);
    }
    const erase = document.createElement("button");
    erase.type = "button";
    erase.className = "sdk-key sdk-key--erase";
    erase.dataset.erase = "true";
    erase.textContent = "⌫";
    erase.setAttribute("aria-label", "Erase");
    padEl.appendChild(erase);

    const controls = document.createElement("div");
    controls.className = "ttt-controls";
    notesBtn = button("Notes Off", "ttt-btn", toggleNotes, signal);
    checkBtn = button("Check Off", "ttt-btn", toggleCheck, signal);
    hintBtn = button("Hint", "ttt-btn", useHint, signal);
    controls.append(
      button("New game", "ttt-btn", newGame, signal),
      button("Difficulty", "ttt-btn", cycleDifficulty, signal),
      notesBtn,
      checkBtn,
      hintBtn,
      button(
        "Back to menu",
        "ttt-btn ttt-btn--ghost",
        () => ctx.onExit(),
        signal,
      ),
    );

    main.append(lead, bar, boardEl, padEl, controls);
    el.appendChild(main);

    gridEl.addEventListener("click", onGridClick, { signal });
    padEl.addEventListener("click", onPadClick, { signal });
    window.addEventListener("keydown", onKey, { signal });
    window.addEventListener("pagehide", saveGame, { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") saveGame();
      },
      { signal },
    );

    if (solveLayout) {
      // expose the single missing digit for the E2E only
      boardEl.dataset.answer = String(puzzle.solution[80]);
    }

    renderTimer();
    render();
    // Resumed mid-game (clock already ran) → keep it going; a fresh or
    // un-played puzzle waits for the first placement like a new one.
    if (saved && !won && elapsed > 0) startTimer();
  },

  unmount(): void {
    saveGame(); // in-app navigation away → keep the game resumable
    controller?.abort();
    controller = null;
    stopTimer();
  },
};

export default sudoku;
