// Klondike GameModule (plan §UI). The shell hands us a cleared `#app`
// and a namespaced storage; we own all state + DOM. Pure rules live in
// logic.ts — this file is render + input + timing only. Every listener
// goes through ONE AbortController so unmount() is a single abort (no
// leaked pointer handlers across navigations); timers/intervals are
// tracked and cleared alongside it.
//
// Epic 8: board render, pointer drag-and-drop (mouse + touch),
// double-tap → foundation, stock draw/recycle, New game / Draw-mode
// toggle / Back, deterministic `?seed=` hook.
// Epic 9: play timer (M:SS), per-mode persisted best time, and an
// auto-complete loop once the deal has no face-down card.

import { createHeader } from "../../ui/header.ts";
import {
  applyMove,
  autoStep,
  canAutoComplete,
  deal,
  foundationTargetFor,
  isMovableRun,
  isWon,
  makeDeck,
  mulberry32,
  shuffle,
  SUITS,
  topOf,
  type Card,
  type GameState,
  type Move,
  type Suit,
} from "./logic.ts";
import { cardFace } from "./cards.ts";
import { meta } from "./meta.ts";
import type { GameContext, GameModule } from "../types.ts";

const SUIT_GLYPH: Record<Suit, string> = {
  S: "♠", // ♠
  H: "♥", // ♥
  D: "♦", // ♦
  C: "♣", // ♣
};

/** Optional deterministic seed from the route (`#/g/klondike?seed=42`),
 *  so E2E can reach a repeatable deal. Absent → time-seeded. */
function parseSeed(): number | null {
  const m = /[?&]seed=(-?\d+)/.exec(location.hash);
  return m ? Number(m[1]) >>> 0 : null;
}

/** Test-only hook: `#/g/klondike?solve=1` deals an already-face-up,
 *  trivially auto-completable board (4 suit columns K→A, top = Ace,
 *  empty stock/waste). A normal `deal()` always has face-down cards so
 *  it can never be `canAutoComplete` on mount — this lets E2E exercise
 *  the auto-complete → win → best-time path deterministically and fast
 *  without playing out a full game. Production deals ignore it. */
function parseSolve(): boolean {
  return /[?&]solve=1\b/.test(location.hash);
}

// Module-scope state: only one game mounts at a time and unmount()
// abandons it, so mount() reinitialises everything below.
let state: GameState;
let ctx: GameContext;
let seed: number | null = null;
let solveLayout = false;
let drawCount: 1 | 3 = 3;
let controller: AbortController | null = null;

let elapsed = 0;
let timerId: number | null = null;
let autoId: number | null = null;
let won = false;
// render() rebuilds the board on every move; the deal cascade must run
// ONLY on a fresh deal, not on each rebuild (otherwise every move looks
// like a full-screen refresh). Set on deal, consumed by the next render.
let dealAnim = false;

let boardEl: HTMLElement;
let winEl: HTMLElement;
let winSubEl: HTMLElement;
let modeEl: HTMLElement;
let timerEl: HTMLElement;
let bestEl: HTMLElement;
let statusEl: HTMLElement;
let autoBtn: HTMLButtonElement;

interface DragSource {
  pile: "waste" | "tableau";
  col: number; // tableau column (ignored for waste)
  index: number; // start index of the run within its pile
}

interface Drag {
  source: DragSource;
  run: Card[];
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  started: boolean;
  ghost: HTMLElement | null;
}

let drag: Drag | null = null;

// Touch fires no reliable `dblclick`, so a double-tap is detected here:
// two taps on the same card within this window → send to foundation.
let lastTap: { id: string; t: number } | null = null;
const DOUBLE_TAP_MS = 320;

/** A face-up, no-face-down board the auto-complete loop solves at once
 *  (same shape as the @unit autoStep fixture). Test hook only. */
function solveState(): GameState {
  const suitPile = (s: Suit): Card[] =>
    Array.from({ length: 13 }, (_, i) => ({
      id: `${s}${13 - i}`,
      suit: s,
      rank: 13 - i,
      faceUp: true,
    }));
  return {
    tableau: [
      suitPile("S"),
      suitPile("H"),
      suitPile("D"),
      suitPile("C"),
      [],
      [],
      [],
    ],
    stock: [],
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    drawCount,
  };
}

function freshDeal(): void {
  dealAnim = true; // next render animates the deal cascade once
  if (solveLayout) {
    state = solveState();
    return;
  }
  const s = seed ?? ((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  state = deal(shuffle(makeDeck(), mulberry32(s)), drawCount);
}

// ---- DOM builders ---------------------------------------------------

function buildCard(card: Card): HTMLElement {
  const el = document.createElement("div");
  el.className = "sol-card";
  el.dataset.id = card.id;
  el.dataset.suit = card.suit;
  el.dataset.rank = String(card.rank);
  el.dataset.faceup = String(card.faceUp);
  if (!card.faceUp) {
    el.classList.add("sol-card--back");
    return el;
  }
  if (card.suit === "H" || card.suit === "D") {
    el.classList.add("sol-card--red");
  }
  // Real card art: a single inline SVG with everything at fixed
  // coordinates (cards.ts). No CSS-positioned glyphs → nothing overlaps.
  el.appendChild(cardFace(card));
  return el;
}

function buildSlot(cls: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "sol-slot " + cls;
  return el;
}

function render(): void {
  boardEl.replaceChildren();

  // top row, conventional Klondike order: stock · waste · gap · 4
  // foundations (the deck/draw is left, suits build at the right).
  const top = document.createElement("div");
  top.className = "sol-top";

  const stock = buildSlot("sol-stock");
  stock.dataset.pile = "stock";
  stock.dataset.action = "stock";
  if (state.stock.length) {
    const back = buildCard({
      id: "stock",
      suit: "S",
      rank: 0,
      faceUp: false,
    });
    stock.appendChild(back);
  } else {
    const recycle = document.createElement("span");
    recycle.className = "sol-stock__recycle";
    recycle.textContent = "↻"; // ↻
    stock.appendChild(recycle);
  }
  top.appendChild(stock);

  const waste = buildSlot("sol-waste");
  waste.dataset.pile = "waste";
  // Fan the last up-to-3 so draw-3 reads correctly; only the last is
  // interactive (it is the logical top).
  const shown = state.waste.slice(-3);
  shown.forEach((card, i) => {
    const c = buildCard(card);
    c.style.setProperty("--fan", String(i));
    if (i === shown.length - 1) c.dataset.top = "true";
    waste.appendChild(c);
  });
  top.appendChild(waste);

  const spacer = document.createElement("div");
  spacer.className = "sol-spacer";
  top.appendChild(spacer);

  for (const suit of SUITS) {
    const f = buildSlot("sol-foundation");
    f.dataset.pile = "foundation";
    f.dataset.suit = suit;
    const pile = state.foundations[suit];
    const t = topOf(pile);
    if (t) {
      f.appendChild(buildCard(t));
    } else {
      const ghost = document.createElement("span");
      ghost.className = "sol-foundation__hint";
      ghost.textContent = SUIT_GLYPH[suit];
      f.appendChild(ghost);
    }
    top.appendChild(f);
  }

  boardEl.appendChild(top);

  // tableau: 7 columns
  const tab = document.createElement("div");
  tab.className = dealAnim ? "sol-tableau sol-tableau--deal" : "sol-tableau";
  dealAnim = false; // one-shot: subsequent move re-renders don't animate
  state.tableau.forEach((pile, col) => {
    const c = document.createElement("div");
    c.className = "sol-col";
    c.dataset.pile = "tableau";
    c.dataset.col = String(col);
    if (pile.length === 0) {
      const empty = document.createElement("span");
      empty.className = "sol-col__empty";
      c.appendChild(empty);
    } else {
      pile.forEach((card, idx) => {
        const node = buildCard(card);
        node.dataset.idx = String(idx);
        c.appendChild(node);
      });
    }
    tab.appendChild(c);
  });
  boardEl.appendChild(tab);

  // Re-attach the win overlay last so it survives the full rebuild and
  // the `.sol-board[data-won] .sol-win` selector still resolves.
  boardEl.appendChild(winEl);
}

// ---- timer + best time ---------------------------------------------

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function renderTimer(): void {
  timerEl.textContent = formatTime(elapsed);
}

/** First successful move (incl. an auto-complete step) starts it;
 *  guarded so repeated calls are a no-op. Stopped on win/unmount. */
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

interface Best {
  seconds: number;
  date: number;
}

/** Per-mode key so draw-1 and draw-3 keep separate records. */
function bestKey(): string {
  return `best-${drawCount}`;
}

function renderBest(): void {
  const b = ctx.storage.get<Best>(bestKey());
  bestEl.textContent = b ? `Best ${formatTime(b.seconds)}` : "Best —";
}

function recordBest(): void {
  const prev = ctx.storage.get<Best>(bestKey());
  if (!prev || elapsed < prev.seconds) {
    ctx.storage.set<Best>(bestKey(), { seconds: elapsed, date: Date.now() });
  }
  renderBest();
}

// ---- saved game (resume across navigation / PWA reopen) -------------

const SAVE_KEY = "save";

interface Saved {
  state: GameState;
  elapsed: number;
  drawCount: 1 | 3;
}

/** Persist the in-progress game. Skipped for deterministic `?seed=` /
 *  `?solve=1` demos (they must stay reproducible and not bleed a resume
 *  into the next visit). A finished game is cleared, not saved, so a
 *  reopen starts fresh. */
function saveGame(): void {
  if (seed !== null || solveLayout) return;
  if (won) {
    ctx.storage.remove(SAVE_KEY);
    return;
  }
  ctx.storage.set<Saved>(SAVE_KEY, { state, elapsed, drawCount });
}

function clearGame(): void {
  ctx.storage.remove(SAVE_KEY);
}

/** A previously saved game, validated just enough to trust the shape
 *  (a 7-pile tableau with the four foundations). */
function loadGame(): Saved | null {
  const s = ctx.storage.get<Saved>(SAVE_KEY);
  if (
    !s ||
    !s.state ||
    !Array.isArray(s.state.tableau) ||
    s.state.tableau.length !== 7 ||
    !s.state.foundations ||
    (s.drawCount !== 1 && s.drawCount !== 3)
  ) {
    return null;
  }
  return s;
}

// ---- auto-complete --------------------------------------------------

function stopAuto(): void {
  if (autoId !== null) {
    clearInterval(autoId);
    autoId = null;
  }
}

/** One autoStep per tick (~120 ms) so cards visibly fly home, then
 *  finishWin() once isWon. Drives state directly (not via commit) to
 *  avoid re-entering the auto-complete check. */
function autoTick(): void {
  const step = autoStep(state);
  if (!step) {
    stopAuto();
    return;
  }
  state = step.state;
  render();
  if (isWon(state)) finishWin();
  else saveGame();
}

function maybeAutoComplete(): void {
  if (won || autoId !== null || !canAutoComplete(state)) return;
  startTimer(); // auto moves are play time
  autoId = window.setInterval(autoTick, 120);
  updateChrome();
}

function finishWin(): void {
  won = true;
  stopAuto();
  stopTimer();
  recordBest();
  clearGame(); // game over → next open starts fresh
  updateChrome();
}

/** Status text + auto-complete button visibility, recomputed after
 *  every move / state reset. */
function updateChrome(): void {
  statusEl.textContent = won ? `You win!  ${formatTime(elapsed)}` : "";
  boardEl.dataset.won = won ? "true" : "false";
  if (won) {
    const b = ctx.storage.get<Best>(bestKey());
    const best = b ? formatTime(b.seconds) : formatTime(elapsed);
    winSubEl.textContent = `Time ${formatTime(elapsed)} · Best ${best}`;
  }
  autoBtn.hidden = won || autoId !== null || !canAutoComplete(state);
}

// ---- moves ----------------------------------------------------------

/** Post-move hook for player moves: start the clock on the first one,
 *  detect a win, kick off auto-complete once nothing is face-down. */
function afterMove(): void {
  if (won) return;
  startTimer();
  if (isWon(state)) {
    finishWin();
    return;
  }
  maybeAutoComplete();
  updateChrome();
}

function commit(move: Move): boolean {
  const next = applyMove(state, move);
  if (!next) return false;
  state = next;
  render();
  afterMove();
  saveGame();
  return true;
}

/** Locate a face-up card in waste/tableau and the run it heads. */
function locateCard(cardEl: HTMLElement): {
  source: DragSource;
  run: Card[];
} | null {
  if (cardEl.dataset.faceup !== "true") return null;
  const id = cardEl.dataset.id!;

  const wIdx = state.waste.findIndex((c) => c.id === id);
  if (wIdx !== -1) {
    if (wIdx !== state.waste.length - 1) return null; // only waste top
    return {
      source: { pile: "waste", col: -1, index: wIdx },
      run: [state.waste[wIdx]],
    };
  }

  for (let col = 0; col < state.tableau.length; col++) {
    const pile = state.tableau[col];
    const idx = pile.findIndex((c) => c.id === id);
    if (idx === -1) continue;
    const run = pile.slice(idx);
    if (!isMovableRun(run)) return null;
    return { source: { pile: "tableau", col, index: idx }, run };
  }
  return null;
}

function moveFromTo(source: DragSource, run: Card[], target: HTMLElement): void {
  const pile = target.dataset.pile;
  if (pile === "foundation") {
    if (run.length !== 1) return; // foundations take a single card
    const suit = target.dataset.suit as Suit;
    commit(
      source.pile === "waste"
        ? { type: "wasteToFoundation", suit }
        : { type: "tableauToFoundation", from: source.col, suit },
    );
    return;
  }
  if (pile === "tableau") {
    const to = Number(target.dataset.col);
    commit(
      source.pile === "waste"
        ? { type: "wasteToTableau", to }
        : {
            type: "tableauToTableau",
            from: source.col,
            index: source.index,
            to,
          },
    );
  }
}

/** Double-tap/click a face-up waste/tableau-top card → its foundation. */
function sendToFoundation(cardEl: HTMLElement): void {
  const loc = locateCard(cardEl);
  if (!loc || loc.run.length !== 1) return;
  const card = loc.run[0];
  const suit = foundationTargetFor(state, card);
  if (!suit) return;
  commit(
    loc.source.pile === "waste"
      ? { type: "wasteToFoundation", suit }
      : { type: "tableauToFoundation", from: loc.source.col, suit },
  );
}

// ---- drag (pointer: mouse + touch) ----------------------------------

function onPointerDown(e: PointerEvent): void {
  const t = e.target as HTMLElement;
  const cardEl = t.closest<HTMLElement>(".sol-card");
  if (!cardEl || cardEl.classList.contains("sol-card--back")) return;
  const loc = locateCard(cardEl);
  if (!loc) return;

  const rect = cardEl.getBoundingClientRect();
  drag = {
    source: loc.source,
    run: loc.run,
    startX: e.clientX,
    startY: e.clientY,
    offX: e.clientX - rect.left,
    offY: e.clientY - rect.top,
    started: false,
    ghost: null,
  };
}

function startGhost(): void {
  if (!drag) return;
  const ghost = document.createElement("div");
  ghost.className = "sol-ghost";
  drag.run.forEach((card) => ghost.appendChild(buildCard(card)));
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  drag.started = true;

  // Dim the lifted run in place so the ghost reads as picked up.
  for (const card of drag.run) {
    boardEl
      .querySelector<HTMLElement>(`.sol-card[data-id="${card.id}"]`)
      ?.classList.add("sol-card--dragging");
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!drag) return;
  if (!drag.started) {
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (dist < 6) return;
    startGhost();
  }
  if (drag.ghost) {
    drag.ghost.style.left = `${e.clientX - drag.offX}px`;
    drag.ghost.style.top = `${e.clientY - drag.offY}px`;
  }
}

function onPointerUp(e: PointerEvent): void {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.started) {
    // A tap (no drag). Detect a double-tap on the same card → its
    // foundation; `dblclick` doesn't fire on touch.
    const cardEl = (e.target as HTMLElement).closest<HTMLElement>(
      ".sol-card",
    );
    if (!cardEl || cardEl.dataset.faceup !== "true") {
      lastTap = null;
      return;
    }
    const id = cardEl.dataset.id!;
    const now = e.timeStamp;
    if (lastTap && lastTap.id === id && now - lastTap.t < DOUBLE_TAP_MS) {
      lastTap = null;
      sendToFoundation(cardEl);
    } else {
      lastTap = { id, t: now };
    }
    return;
  }

  d.ghost?.remove();
  const under = document.elementFromPoint(e.clientX, e.clientY) as
    | HTMLElement
    | null;
  const target = under?.closest<HTMLElement>(
    ".sol-foundation, .sol-col, .sol-waste",
  );
  if (target && target.dataset.pile !== "waste") {
    moveFromTo(d.source, d.run, target);
  }
  render(); // also restores the dimmed run if the move was illegal
}

// ---- clicks ---------------------------------------------------------

function onClick(e: PointerEvent | MouseEvent): void {
  const t = e.target as HTMLElement;
  if (t.closest('[data-action="stock"]')) {
    commit(state.stock.length ? { type: "draw" } : { type: "recycle" });
  }
}

function onDblClick(e: MouseEvent): void {
  const cardEl = (e.target as HTMLElement).closest<HTMLElement>(".sol-card");
  if (cardEl && cardEl.dataset.faceup === "true") sendToFoundation(cardEl);
}

// ---- chrome ---------------------------------------------------------

function setMode(): void {
  modeEl.textContent = `Draw ${drawCount}`;
}

/** Shared reset for New game / Draw-mode toggle: stop the round's
 *  timer + auto loop, redeal, then re-show the (mode-specific) best
 *  and re-arm auto-complete (for the ?solve=1 layout). */
function resetRound(): void {
  // ?solve=1 is a one-shot mount demo; any user-initiated reset
  // (New game / Draw toggle) deals a real game, not the solved board.
  solveLayout = false;
  stopAuto();
  stopTimer();
  elapsed = 0;
  won = false;
  freshDeal();
  render();
  renderTimer();
  renderBest();
  updateChrome();
  saveGame(); // persist the new deal so a reopen resumes it
  maybeAutoComplete();
}

function newGame(): void {
  resetRound();
}

function toggleDraw(): void {
  drawCount = drawCount === 3 ? 1 : 3;
  setMode();
  resetRound(); // renderBest() inside now reads the new mode's key
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

const klondike: GameModule = {
  meta,

  mount(el: HTMLElement, context: GameContext): void {
    ctx = context;
    seed = parseSeed();
    solveLayout = parseSolve();
    won = false;
    timerId = null;
    autoId = null;
    // Resume a saved game (unless this is a deterministic seed/solve
    // demo). Otherwise deal fresh.
    const saved = seed === null && !solveLayout ? loadGame() : null;
    if (saved) {
      state = saved.state;
      elapsed = saved.elapsed;
      drawCount = saved.drawCount;
    } else {
      drawCount = 3;
      elapsed = 0;
      freshDeal();
    }
    controller = new AbortController();
    const { signal } = controller;

    el.replaceChildren();
    el.appendChild(createHeader());

    const main = document.createElement("main");
    main.className = "shell-main sol";

    const lead = document.createElement("h2");
    lead.className = "sol-title";
    lead.textContent = meta.title;

    const bar = document.createElement("div");
    bar.className = "sol-bar";
    modeEl = document.createElement("span");
    modeEl.className = "sol-mode";
    timerEl = document.createElement("span");
    timerEl.className = "sol-timer";
    bestEl = document.createElement("span");
    bestEl.className = "sol-best";
    statusEl = document.createElement("span");
    statusEl.className = "sol-status";
    bar.append(modeEl, timerEl, bestEl, statusEl);
    setMode();
    renderTimer();
    renderBest();

    boardEl = document.createElement("div");
    boardEl.className = "sol-board";

    winEl = document.createElement("div");
    winEl.className = "sol-win";
    const winTitle = document.createElement("p");
    winTitle.className = "sol-win__title";
    winTitle.textContent = "You win";
    winSubEl = document.createElement("p");
    winSubEl.className = "sol-win__sub";
    winEl.append(winTitle, winSubEl);

    const controls = document.createElement("div");
    controls.className = "ttt-controls";
    autoBtn = button("Auto-complete", "ttt-btn", maybeAutoComplete, signal);
    autoBtn.hidden = true;
    controls.append(
      button("New game", "ttt-btn", newGame, signal),
      button("Draw 3 / 1", "ttt-btn", toggleDraw, signal),
      autoBtn,
      button(
        "Back to menu",
        "ttt-btn ttt-btn--ghost",
        () => ctx.onExit(),
        signal,
      ),
    );

    // Title, then the full-bleed table, then the HUD bar (mode/timer/
    // best) below it, then controls.
    main.append(lead, boardEl, bar, controls);
    el.appendChild(main);

    // Delegated input — one set of listeners for the whole board, all
    // bound to the single AbortSignal.
    boardEl.addEventListener("pointerdown", onPointerDown, { signal });
    window.addEventListener("pointermove", onPointerMove, { signal });
    window.addEventListener("pointerup", onPointerUp, { signal });
    boardEl.addEventListener("click", onClick, { signal });
    boardEl.addEventListener("dblclick", onDblClick, { signal });
    // Closing/backgrounding the PWA or tab fires no unmount(); capture
    // the latest state (incl. elapsed) on pagehide too.
    window.addEventListener("pagehide", saveGame, { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") saveGame();
      },
      { signal },
    );

    render();
    updateChrome();
    // Resumed mid-game (clock already ran) → keep it going; a saved but
    // un-played deal still waits for the first move like a fresh one.
    if (saved && !won && elapsed > 0) startTimer();
    maybeAutoComplete(); // ?solve=1 layout auto-runs immediately
  },

  unmount(): void {
    saveGame(); // in-app navigation away → keep the game resumable
    controller?.abort();
    controller = null;
    stopTimer();
    stopAuto();
    drag?.ghost?.remove();
    drag = null;
  },
};

export default klondike;
