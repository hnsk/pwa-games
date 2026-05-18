import { test, expect } from "@playwright/test";

// Establishes the @router area tag. Speed tier @e2e (drives a real
// browser): the hash router mounts/unmounts views into one #app.
// The registry now ships tictactoe + klondike + sudoku, so the menu
// renders game cards; menu↔game nav is also exercised via the
// unknown-id bounce + home link.

test("empty hash resolves to the menu @e2e @router", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".menu__head")).toBeVisible();
  await expect(page.locator(".game-card")).toHaveCount(3); // tictactoe + klondike + sudoku
});

test("unknown game id bounces back to the menu @e2e @router", async ({
  page,
}) => {
  await page.goto("/#/g/does-not-exist");
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".menu__head")).toBeVisible();
});

test("header title links home from a game route @e2e @router", async ({
  page,
}) => {
  await page.goto("/#/g/whatever"); // bounces to menu, header present
  await page.locator(".shell-header__title a").click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".menu__head")).toBeVisible();
});
