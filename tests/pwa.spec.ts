import { test, expect } from "@playwright/test";

// PWA contract (PLAN.md §PWA, TODO Epic 5). Establishes the @pwa area
// tag. Speed tier @e2e (drives a real browser + a real service worker),
// area @pwa. Every spec in this repo MUST carry exactly one speed tier
// (@unit | @e2e) + one area tag (TESTING.md "Tagging taxonomy").
//
// This spec targets the `preview` compose service (the production build
// served by `vite preview` over HTTPS), NOT `dev`: a SW needs both a
// secure context AND the hashed assets that only `vite build` emits.
// `web-preview` is the compose alias on that service; the cert is
// self-signed (no real cert for an internal hostname) so the runner
// uses ignoreHTTPSErrors + --ignore-certificate-errors. Parallel-safe:
// Playwright's default fresh context per test → its own SW
// registration + empty caches, no shared mutable state (TESTING.md).
test.use({
  baseURL: process.env.PWA_BASE_URL ?? "https://web-preview:4173",
});

test("manifest linked, SW registered, boots offline @e2e @pwa", async ({
  page,
  context,
}) => {
  await page.goto("/");

  // Manifest is linked and resolvable with the expected identity.
  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(async (href) => {
    const res = await fetch(href!);
    return res.json();
  }, manifestHref);
  expect(manifest.name).toBe("PWA Games");
  expect(manifest.display).toBe("standalone");
  expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy();

  // The service worker registers, activates, and takes control of the
  // page (vite-plugin-pwa generateSW + registerType:'autoUpdate' →
  // skipWaiting + clientsClaim, so control is taken on first load).
  // `page.evaluate` awaits the returned promise (unlike a `waitFor
  // Function` async predicate, whose Promise is always truthy and would
  // resolve before the SW is actually controlling — the page would then
  // reload offline uncontrolled → ERR_INTERNET_DISCONNECTED).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready; // an active worker exists
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) =>
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => resolve(),
        { once: true },
      ),
    );
  });

  // Go offline and hard-reload: with no network, the page + its hashed
  // assets must be served entirely from the Workbox precache.
  await context.setOffline(true);
  await page.reload();

  await expect(page).toHaveTitle(/PWA Games/);
  await expect(page.locator(".shell-header__title a")).toHaveText(
    "PWA Games",
  );
  await expect(page.locator(".menu__head")).toBeVisible();
  // A code-split game chunk also resolves offline (precache covered the
  // per-game chunk, not just the entry) — deep-link into the game.
  await page.goto("/#/g/tictactoe");
  await expect(page.locator(".ttt-grid")).toBeVisible();

  await context.setOffline(false);
});
