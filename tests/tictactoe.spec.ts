import { test, expect } from "@playwright/test";
import {
  emptyBoard,
  isDraw,
  move,
  winner,
  type Board,
} from "../src/games/tictactoe/logic.ts";

// Establishes the @tictactoe area tag. Two speed tiers live here:
//  - @unit: pure logic.ts (no page / SW / network), like storage.spec.
//  - @e2e: the mounted GameModule driven in a real browser, proving
//    play → win → scoreboard increment → persists across reload.
// Every test carries exactly one speed tier + the @tictactoe area tag.

const B = (s: string): Board =>
  [...s].map((c) => (c === "." ? null : (c as "X" | "O")));

test("detects a row / column / diagonal win @unit @tictactoe", () => {
  expect(winner(B("XXX" + "OO." + "..."))).toBe("X");
  expect(winner(B("O.." + "O.X" + "O.X"))).toBe("O");
  expect(winner(B("X.O" + ".X." + "O.X"))).toBe("X");
  expect(winner(emptyBoard())).toBeNull();
});

test("reports a full board with no line as a draw @unit @tictactoe", () => {
  expect(isDraw(B("XOX" + "XXO" + "OXO"))).toBe(true);
  expect(isDraw(B("XOX" + "XXO" + "OX."))).toBe(false); // not full
  expect(isDraw(B("XXX" + "OO." + "..."))).toBe(false); // X already won
});

test("move is pure and rejects illegal moves @unit @tictactoe", () => {
  const start = emptyBoard();
  const next = move(start, 4, "X");
  expect(next?.[4]).toBe("X");
  expect(start[4]).toBeNull(); // input untouched

  expect(move(B("X........"), 0, "O")).toBeNull(); // occupied
  expect(move(start, 9, "X")).toBeNull(); // out of range
  expect(move(B("XXX......"), 5, "O")).toBeNull(); // game already won
});

test("play a winning line → win + scoreboard + persists @e2e @tictactoe", async ({
  page,
}) => {
  await page.goto("/#/g/tictactoe");
  await expect(page.locator(".ttt-grid")).toBeVisible();

  const cell = (i: number) => page.locator(`.ttt-cell[data-idx="${i}"]`);
  const xScore = page.locator(".ttt-score__tile").first().locator(".ttt-score__val");
  await expect(xScore).toHaveText("0");

  // X: 0,1,2 ; O: 3,4 → X takes the top row.
  await cell(0).click(); // X
  await cell(3).click(); // O
  await cell(1).click(); // X
  await cell(4).click(); // O
  await cell(2).click(); // X wins

  await expect(page.locator(".ttt-status")).toHaveText("X wins");
  await expect(xScore).toHaveText("1");

  await page.reload();
  await expect(page.locator(".ttt-grid")).toBeVisible();
  await expect(
    page.locator(".ttt-score__tile").first().locator(".ttt-score__val"),
  ).toHaveText("1"); // score survived reload via GameStorage
});

// Regression: the plasma haze + scanlines are tuned for the near-black
// cabinet; at full strength over the light "paper" palette they smeared
// into a garish rainbow band and washed the board out. The light scheme
// must dial body::before / body::after back (dark mode stays at 0.9).
test("light scheme tones down the atmosphere haze @e2e @tictactoe", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto("/#/g/tictactoe");
  await expect(page.locator(".ttt-grid")).toBeVisible();
  const haze = await page.evaluate(() => {
    const cs = getComputedStyle(document.body, "::before");
    return parseFloat(cs.opacity);
  });
  expect(haze).toBeLessThanOrEqual(0.55); // light override active (was 0.9)
  await ctx.close();
});

// Regression: rows were implicit `auto`, so a placed glyph inflated its
// row and cells resized/jumped on click. All 9 cells must keep the same
// box across an empty board → mixed fills.
test("cells keep a constant size as marks are placed @e2e @tictactoe", async ({
  page,
}) => {
  await page.goto("/#/g/tictactoe");
  await expect(page.locator(".ttt-grid")).toBeVisible();

  const boxes = async () =>
    Promise.all(
      [...Array(9)].map((_, i) =>
        page.locator(`.ttt-cell[data-idx="${i}"]`).boundingBox(),
      ),
    );

  const before = await boxes();
  // X:0  O:4  X:8 — corners + center filled, rest empty
  await page.locator('.ttt-cell[data-idx="0"]').click();
  await page.locator('.ttt-cell[data-idx="4"]').click();
  await page.locator('.ttt-cell[data-idx="8"]').click();
  const after = await boxes();

  const w = before[0]!.width;
  const h = before[0]!.height;
  for (let i = 0; i < 9; i++) {
    expect(Math.abs(after[i]!.width - w)).toBeLessThan(0.5);
    expect(Math.abs(after[i]!.height - h)).toBeLessThan(0.5);
    expect(Math.abs(after[i]!.width - before[i]!.width)).toBeLessThan(0.5);
    expect(Math.abs(after[i]!.height - before[i]!.height)).toBeLessThan(0.5);
  }
});
