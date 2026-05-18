import { test, expect } from "@playwright/test";

// Establishes the @router area tag. Speed tier @e2e (drives a real
// browser): the hash router mounts/unmounts views into one #app.
// Registry is empty until Epic 4, so menu↔game nav is exercised via
// the unknown-id bounce (game route → menu) + the home link.

test("empty hash resolves to the menu @e2e @router", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".menu__head")).toBeVisible();
  await expect(page.locator(".menu__empty")).toBeVisible(); // no games yet
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
