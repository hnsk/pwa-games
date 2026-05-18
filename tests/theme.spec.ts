import { test, expect } from "@playwright/test";

// Establishes the @theme area tag. @e2e only: the theme module is
// inherently DOM/localStorage/matchMedia bound (no pure @unit surface).
// Covers the 2-state switch: OS-seeded on first load, then a persisted
// manual override that wins over the OS preference across reloads.

const themeAttr = (p: import("@playwright/test").Page) =>
  p.evaluate(() => document.documentElement.dataset.theme);

const metaColor = (p: import("@playwright/test").Page) =>
  p.evaluate(
    () =>
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content") ?? "",
  );

test("first load seeds the theme from the OS preference @e2e @theme", async ({
  browser,
}) => {
  const dark = await browser.newContext({ colorScheme: "dark" });
  const dp = await dark.newPage();
  await dp.goto("/#/");
  await expect(dp.locator(".shell-header__theme")).toBeVisible();
  expect(await themeAttr(dp)).toBe("dark");
  expect(await metaColor(dp)).toBe("#16181d");
  await dark.close();

  const light = await browser.newContext({ colorScheme: "light" });
  const lp = await light.newPage();
  await lp.goto("/#/");
  expect(await themeAttr(lp)).toBe("light");
  expect(await metaColor(lp)).toBe("#faf9f6");
  await light.close();
});

test("toggle flips theme, updates aria, persists over the OS pref @e2e @theme", async ({
  browser,
}) => {
  // OS says light; the user overrides to dark and it must stick.
  const ctx = await browser.newContext({ colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto("/#/");
  expect(await themeAttr(page)).toBe("light");

  const btn = page.locator(".shell-header__theme");
  await expect(btn).toHaveAttribute("aria-label", "Switch to dark theme");
  await btn.click();

  expect(await themeAttr(page)).toBe("dark");
  expect(await metaColor(page)).toBe("#16181d");
  await expect(btn).toHaveAttribute("aria-label", "Switch to light theme");
  await expect(btn).toHaveAttribute("aria-pressed", "false");

  // Persisted choice beats the (still light) OS preference on reload.
  await page.reload();
  expect(await themeAttr(page)).toBe("dark");
  await expect(page.locator(".shell-header__theme")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await ctx.close();
});
