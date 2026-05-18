import { defineConfig, devices } from "@playwright/test";

// The app under test is served by the long-lived `dev` compose service
// (Vite, container port 5173). There is deliberately NO `webServer`
// here: TESTING.md requires supporting services to be long-lived and
// never per-run-restarted, and the compose `test` service `depends_on`
// `dev`. From the `test` container the app is reachable on the compose
// network at http://web:5173 — `web` is a network alias on the `dev`
// service; the literal name `dev` is unusable because `.dev` is in
// Chrome's preloaded HSTS list (Chromium force-upgrades it to HTTPS).
// Override with BASE_URL (e.g. a host port) when running elsewhere.
//
// Parallel-safe by construction: `fullyParallel` + Playwright's default
// fresh browser context per test → empty localStorage per test, no
// shared mutable state (TESTING.md "Database / service strategy": this
// project has no DB; per-test isolation is the fresh context).
// Worker count comes from the CLI (`devctl test --parallel` →
// `--workers=50%`), not pinned here.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://web:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
