import { test, expect } from "@playwright/test";

// First spec for the host shell. Establishes the @shell area tag and
// proves the full stack is wired: compose `test` → `dev` (Vite) →
// browser. Speed tier @e2e (drives a real browser), area @shell.
// Every spec in this repo MUST carry exactly one speed tier
// (@unit | @e2e) + one area tag — an untagged test is a broken test
// (TESTING.md "Tagging taxonomy").
test("shell boots and renders the menu @e2e @shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/PWA Games/);
  await expect(page.locator(".shell-header__title a")).toHaveText(
    "PWA Games",
  );
  await expect(page.locator(".menu__head")).toBeVisible();
});
