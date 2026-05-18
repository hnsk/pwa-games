import { test, expect } from "@playwright/test";
import {
  classify,
  computeModel,
  conflicts,
  countSolutions,
  fullSolve,
  generate,
  hiddenSingle,
  isComplete,
  lockedCandidates,
  mulberry32,
  nakedPair,
  nakedSingle,
  rate,
  xWing,
  type Difficulty,
  type Grid,
} from "../src/games/sudoku/logic.ts";

// Establishes the @sudoku area tag. Speed tier @unit: pure logic.ts
// (no page / SW / network), like storage.spec — the engine is driven
// generate → rate → solve with zero browser. The @e2e tier mounts the
// GameModule in a real browser.

const ALL_DIFFS: Difficulty[] = ["easy", "normal", "hard", "veryhard"];

const noConflicts = (g: Grid): boolean =>
  conflicts(g).length === 0 && g.every((v) => v >= 1 && v <= 9);

test("fullSolve yields a valid full grid; mulberry32 deterministic @unit @sudoku", () => {
  const a = fullSolve(new Array(81).fill(0), mulberry32(42));
  const b = fullSolve(new Array(81).fill(0), mulberry32(42));
  expect(a).not.toBeNull();
  expect(a).toHaveLength(81);
  expect(noConflicts(a!)).toBe(true); // every row/col/box is 1..9
  expect(a).toEqual(b); // same seed → identical solution

  const c = fullSolve(new Array(81).fill(0), mulberry32(43));
  expect(c).not.toEqual(a); // different seed → different grid
});

test("countSolutions: unique vs ambiguous, abort at limit @unit @sudoku", () => {
  const sol = fullSolve(new Array(81).fill(0), mulberry32(7))!;
  const oneGone = sol.slice();
  oneGone[40] = 0;
  expect(countSolutions(oneGone, 2)).toBe(1); // a single cell is forced

  const empty = new Array<number>(81).fill(0);
  expect(countSolutions(empty, 2)).toBe(2); // many solutions, aborts at 2
});

test("nakedSingle places a sole candidate @unit @sudoku", () => {
  const m = computeModel(new Array(81).fill(0));
  m.cand[40] = 1 << (7 - 1); // only digit 7 possible at cell 40
  expect(nakedSingle(m)).toBe(true);
  expect(m.grid[40]).toBe(7);
});

test("hiddenSingle places a digit unique to one cell of a unit @unit @sudoku", () => {
  const m = computeModel(new Array(81).fill(0));
  const b5 = 1 << (5 - 1);
  for (let c = 1; c < 9; c++) m.cand[c] &= ~b5; // digit 5 only in cell 0 of row 0
  expect(hiddenSingle(m)).toBe(true);
  expect(m.grid[0]).toBe(5);
});

test("nakedPair eliminates the pair from the rest of the unit @unit @sudoku", () => {
  const m = computeModel(new Array(81).fill(0));
  const pair = (1 << 0) | (1 << 1); // {1,2}
  m.cand[0] = pair;
  m.cand[1] = pair;
  m.cand[2] = pair | (1 << 3); // {1,2,4}
  expect(nakedPair(m)).toBe(true);
  expect(m.cand[2]).toBe(1 << 3); // 1 & 2 stripped, 4 remains
});

test("lockedCandidates / xWing no-op on a fresh model @unit @sudoku", () => {
  // Every digit is a candidate everywhere → nothing is locked / x-winged.
  expect(lockedCandidates(computeModel(new Array(81).fill(0)))).toBe(false);
  expect(xWing(computeModel(new Array(81).fill(0)))).toBe(false);
});

test("generate: unique, givens ⊆ solution, label = measured difficulty @unit @sudoku", () => {
  for (const d of ALL_DIFFS) {
    const p = generate(d, 123);
    expect(noConflicts(p.solution)).toBe(true);
    expect(countSolutions(p.givens, 2)).toBe(1); // exactly one solution
    for (let i = 0; i < 81; i++)
      if (p.givens[i] !== 0) expect(p.givens[i]).toBe(p.solution[i]);
    // The label is always the *measured* difficulty — never a lie.
    expect(classify(p.rating)).toBe(p.difficulty);
    expect(ALL_DIFFS).toContain(p.difficulty);
  }
});

test("rate solves an easy puzzle by the ladder @unit @sudoku", () => {
  const p = generate("easy", 5);
  const r = rate(p.givens, p.solution);
  expect(r.solvedByLadder).toBe(true);
  expect(r.rating).toBeLessThanOrEqual(0); // easy ⇒ naked singles only
});

test("isComplete / conflicts boundary cases @unit @sudoku", () => {
  const sol = fullSolve(new Array(81).fill(0), mulberry32(9))!;
  expect(isComplete(sol)).toBe(true);
  expect(conflicts(sol)).toEqual([]);

  const hole = sol.slice();
  hole[0] = 0;
  expect(isComplete(hole)).toBe(false); // not filled

  const dup = sol.slice();
  dup[1] = sol[0]; // duplicate in row 0 (also a column dup elsewhere)
  expect(isComplete(dup)).toBe(false);
  expect(conflicts(dup)).toEqual(expect.arrayContaining([0, 1]));
});

// ---- @e2e: the mounted GameModule driven in a real browser ----------

/** Index of the first non-given, still-empty cell. A bare locator that
 *  filters on emptiness re-resolves to a *different* cell the moment we
 *  fill one, so e2e cases pin the concrete data-idx up front. */
async function firstEmptyIdx(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLElement>(".sdk-cell")];
    return Number(
      cells.find((e) => e.dataset.given !== "true" && !e.textContent)!
        .dataset.idx,
    );
  });
}

test("board renders: 81 cells, 10 keys, timer, difficulty @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?seed=1&diff=easy");
  await expect(page.locator(".sdk-grid")).toBeVisible();
  await expect(page.locator(".sdk-cell")).toHaveCount(81);
  await expect(page.locator(".sdk-pad [data-digit]")).toHaveCount(9);
  await expect(page.locator(".sdk-timer")).toHaveText("0:00");
  await expect(page.locator(".sdk-diff")).toHaveText("Easy");
});

test("placing a digit reads distinctly from a given @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?seed=1&diff=easy");
  await expect(page.locator(".sdk-grid")).toBeVisible();
  const idx = await firstEmptyIdx(page);
  const empty = page.locator(`.sdk-cell[data-idx="${idx}"]`);
  await empty.click();
  await page.locator('.sdk-pad [data-digit="1"]').click();
  await expect(empty).toHaveText("1");
  await expect(empty).not.toHaveAttribute("data-given", "true");
  await expect(page.locator('.sdk-cell[data-given="true"]').first()).toBeVisible();
});

test("pressing a number highlights all its instances @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?seed=1&diff=easy");
  await expect(page.locator(".sdk-grid")).toBeVisible();
  const g = await page
    .locator('.sdk-cell[data-given="true"]')
    .first()
    .textContent();
  await page.locator(`.sdk-pad [data-digit="${g}"]`).click();
  const same = page.locator('.sdk-cell[data-same="true"]');
  expect(await same.count()).toBeGreaterThan(0);
  for (const t of await same.allTextContents()) expect(t).toBe(g);
});

test("notes mode adds a pencil mark, not a value @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?seed=1&diff=easy");
  await expect(page.locator(".sdk-grid")).toBeVisible();
  await page.getByRole("button", { name: /^Notes/ }).click();
  const empty = page.locator(`.sdk-cell[data-idx="${await firstEmptyIdx(page)}"]`);
  await empty.click();
  await page.locator('.sdk-pad [data-digit="3"]').click();
  await expect(empty.locator(".sdk-notes")).toBeVisible();
  await expect(empty.locator(".sdk-notes")).toContainText("3");
});

test("mistake check off by default, flags when enabled @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?seed=1&diff=easy");
  await expect(page.locator(".sdk-grid")).toBeVisible();

  // Find an empty cell and a given in its row → that given's digit is
  // guaranteed wrong for the empty cell (a solution has no row dup).
  const target = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLElement>(".sdk-cell")];
    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      if (c.dataset.given === "true" || c.textContent) continue;
      const r = Math.floor(i / 9);
      for (let cc = 0; cc < 9; cc++) {
        const j = r * 9 + cc;
        if (cells[j].dataset.given === "true")
          return { idx: i, digit: cells[j].textContent };
      }
    }
    return null;
  });
  expect(target).not.toBeNull();
  const cell = page.locator(`.sdk-cell[data-idx="${target!.idx}"]`);
  await cell.click();
  await page.locator(`.sdk-pad [data-digit="${target!.digit}"]`).click();

  await expect(cell).not.toHaveAttribute("data-wrong", "true"); // off
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(cell).toHaveAttribute("data-wrong", "true"); // on → flagged
});

test("hint fills one cell in the selected box, max one per box @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?seed=2&diff=easy");
  await expect(page.locator(".sdk-grid")).toBeVisible();
  await expect(page.locator(".sdk-hints")).toHaveText("Hints 0/9");

  const empty = page
    .locator('.sdk-cell:not([data-given="true"])')
    .filter({ hasText: /^$/ })
    .first();
  await empty.click();
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(page.locator(".sdk-hints")).toHaveText("Hints 1/9");
  await expect(page.locator('.sdk-cell[data-hint="true"]')).toHaveCount(1);

  // Selecting the same box again: Hint is refused (button disabled).
  await page.locator('.sdk-cell[data-hint="true"]').click();
  await expect(page.getByRole("button", { name: "Hint" })).toBeDisabled();
  await expect(page.locator(".sdk-hints")).toHaveText("Hints 1/9");
});

test("?solve=1: final digit wins, greys its key, stops timer @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?solve=1");
  await expect(page.locator(".sdk-grid")).toBeVisible();
  const answer = await page
    .locator(".sdk-board")
    .getAttribute("data-answer");
  expect(answer).not.toBeNull();

  await page.locator('.sdk-cell[data-idx="80"]').click();
  await page.locator(`.sdk-pad [data-digit="${answer}"]`).click();

  await expect(page.locator('.sdk-board[data-won="true"]')).toBeVisible();
  await expect(page.locator(".sdk-win")).toBeVisible();
  await expect(page.locator(".sdk-status")).toContainText("Solved!");
  await expect(
    page.locator(`.sdk-pad [data-digit="${answer}"]`),
  ).toBeDisabled(); // last instance placed → key greyed
  const t = await page.locator(".sdk-timer").textContent();
  await page.waitForTimeout(1200);
  expect(await page.locator(".sdk-timer").textContent()).toBe(t); // stopped
});

test("save/resume across reload; New game clears it @e2e @sudoku", async ({
  page,
}) => {
  await page.goto("/#/g/sudoku?diff=easy"); // no seed → persisted
  await expect(page.locator(".sdk-grid")).toBeVisible();

  const idx = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLElement>(".sdk-cell")];
    const c = cells.find(
      (e) => e.dataset.given !== "true" && !e.textContent,
    )!;
    return Number(c.dataset.idx);
  });
  await page.locator(`.sdk-cell[data-idx="${idx}"]`).click();
  await page.locator('.sdk-pad [data-digit="1"]').click();
  await expect(page.locator(".sdk-timer")).not.toHaveText("0:00", {
    timeout: 3000,
  });

  await page.reload();
  await expect(page.locator(`.sdk-cell[data-idx="${idx}"]`)).toHaveText("1");
  await expect(page.locator(".sdk-timer")).not.toHaveText("0:00");

  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.locator(".sdk-timer")).toHaveText("0:00");
  await expect(page.locator(".sdk-status")).toHaveText("");
});
