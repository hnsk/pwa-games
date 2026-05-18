// Tic-tac-toe GameModule (PLAN.md §Game). Hot-seat X vs O. The shell
// hands us a cleared `#app` and a namespaced storage; we own all state
// and DOM. Everything is built with safe DOM nodes (no innerHTML), and
// every listener goes through one AbortController so unmount() is a
// single abort — no leaked handlers across navigations.

import { createHeader } from "../../ui/header.ts";
import {
  emptyBoard,
  isDraw,
  move,
  winner,
  winningLine,
  type Board,
  type Player,
} from "./logic.ts";
import { meta } from "./meta.ts";
import type { GameContext, GameModule } from "../types.ts";

interface Score {
  x: number;
  o: number;
  d: number;
}

const SCORE_KEY = "score";

function readScore(ctx: GameContext): Score {
  const s = ctx.storage.get<Partial<Score>>(SCORE_KEY);
  return {
    x: Number.isFinite(s?.x) ? (s!.x as number) : 0,
    o: Number.isFinite(s?.o) ? (s!.o as number) : 0,
    d: Number.isFinite(s?.d) ? (s!.d as number) : 0,
  };
}

// Module-scope state: only one game is mounted at a time and unmount()
// abandons it, so a fresh mount() reinitialises everything below.
let board: Board = emptyBoard();
let current: Player = "X";
let over = false;
let score: Score = { x: 0, o: 0, d: 0 };
let controller: AbortController | null = null;

let statusEl: HTMLParagraphElement;
let cellEls: HTMLButtonElement[] = [];
let scoreEls: { x: HTMLElement; o: HTMLElement; d: HTMLElement };

function render(): void {
  const line = winningLine(board);
  const w = winner(board);
  const draw = isDraw(board);

  if (w) {
    statusEl.textContent = `${w} wins`;
    statusEl.dataset.state = "win";
  } else if (draw) {
    statusEl.textContent = "Draw";
    statusEl.dataset.state = "draw";
  } else {
    statusEl.textContent = `${current} to move`;
    statusEl.dataset.state = "turn";
  }

  cellEls.forEach((btn, i) => {
    const v = board[i];
    btn.textContent = v ?? "";
    btn.dataset.mark = v ?? "";
    btn.disabled = v !== null || over;
    btn.classList.toggle("is-win", !!line && line.includes(i));
    btn.setAttribute(
      "aria-label",
      `Cell ${i + 1}, ${v ? v : "empty"}`,
    );
  });

  scoreEls.x.textContent = String(score.x);
  scoreEls.o.textContent = String(score.o);
  scoreEls.d.textContent = String(score.d);
}

function play(i: number, ctx: GameContext): void {
  if (over) return;
  const next = move(board, i, current);
  if (next === null) return; // illegal — ignore
  board = next;

  const w = winner(board);
  if (w) {
    score = { ...score, [w === "X" ? "x" : "o"]: score[w === "X" ? "x" : "o"] + 1 };
    over = true;
    ctx.storage.set<Score>(SCORE_KEY, score);
  } else if (isDraw(board)) {
    score = { ...score, d: score.d + 1 };
    over = true;
    ctx.storage.set<Score>(SCORE_KEY, score);
  } else {
    current = current === "X" ? "O" : "X";
  }
  render();
}

function newRound(): void {
  board = emptyBoard();
  current = "X";
  over = false;
  render();
}

function resetScores(ctx: GameContext): void {
  score = { x: 0, o: 0, d: 0 };
  ctx.storage.set<Score>(SCORE_KEY, score);
  newRound();
}

function tile(label: string, valueEl: HTMLElement): HTMLElement {
  const box = document.createElement("div");
  box.className = "ttt-score__tile";
  const k = document.createElement("span");
  k.className = "ttt-score__key";
  k.textContent = label;
  valueEl.className = "ttt-score__val";
  valueEl.textContent = "0";
  box.append(k, valueEl);
  return box;
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

const tictactoe: GameModule = {
  meta,

  mount(el: HTMLElement, ctx: GameContext): void {
    board = emptyBoard();
    current = "X";
    over = false;
    score = readScore(ctx);
    controller = new AbortController();
    const { signal } = controller;

    el.replaceChildren();
    el.appendChild(createHeader());

    const main = document.createElement("main");
    main.className = "shell-main ttt";

    const lead = document.createElement("div");
    lead.className = "menu__lead";
    const kicker = document.createElement("p");
    kicker.className = "menu__kicker";
    kicker.textContent = "Hot-seat";
    const head = document.createElement("h2");
    head.className = "menu__head";
    head.textContent = meta.title;
    lead.append(kicker, head);

    statusEl = document.createElement("p");
    statusEl.className = "ttt-status";
    statusEl.setAttribute("aria-live", "polite");

    const grid = document.createElement("div");
    grid.className = "ttt-grid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Tic-tac-toe board");
    cellEls = [];
    for (let i = 0; i < 9; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ttt-cell";
      b.dataset.idx = String(i);
      b.addEventListener("click", () => play(i, ctx), { signal });
      cellEls.push(b);
      grid.appendChild(b);
    }

    const scoreboard = document.createElement("div");
    scoreboard.className = "ttt-score";
    const xv = document.createElement("strong");
    const dv = document.createElement("strong");
    const ov = document.createElement("strong");
    scoreEls = { x: xv, o: ov, d: dv };
    scoreboard.append(
      tile("X", xv),
      tile("Draw", dv),
      tile("O", ov),
    );

    const controls = document.createElement("div");
    controls.className = "ttt-controls";
    controls.append(
      button("New round", "ttt-btn", newRound, signal),
      button("Reset scores", "ttt-btn", () => resetScores(ctx), signal),
      button("Back to menu", "ttt-btn ttt-btn--ghost", () => ctx.onExit(), signal),
    );

    main.append(lead, statusEl, grid, scoreboard, controls);
    el.appendChild(main);

    render();
  },

  unmount(): void {
    controller?.abort();
    controller = null;
    cellEls = [];
  },
};

export default tictactoe;
