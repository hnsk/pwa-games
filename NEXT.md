# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 6 — Verification pass
**Next unchecked item:** `dc-run` dev: menu lists tictactoe; play to
win; score increments; reload → persists.

Notes carried from Epic 5 (PWA):
- PWA via `vite-plugin-pwa` 1.3.0 (generateSW, `registerType:
  autoUpdate`). `vite.config.ts` precaches all hashed assets +
  `navigateFallback: index.html`; SW registered in `src/main.ts` via
  `registerSW({ immediate: true })` (`virtual:pwa-register`;
  `vite-plugin-pwa/client` type ref in `src/vite-env.d.ts`).
- Icons: one source `public/favicon.svg` →
  `@vite-pwa/assets-generator` 1.0.2 (`pwa-assets.config.ts`,
  `minimal2023Preset`), `npm run generate-pwa-assets`, committed under
  `public/`. Regenerate if the source SVG changes.
- **A SW needs a secure context + a real build**, so the dev server
  CANNOT host it. New long-lived `preview` compose service serves the
  production build over HTTPS (`@vitejs/plugin-basic-ssl` 2.3.0, only
  when `PWA_HTTPS=1` — set on the `preview` service; dev stays plain
  HTTP). Alias `web-preview`, host port `PWA_PREVIEW_PORT` (4181).
  Both `dev` and `preview` now have healthchecks; `test`
  `depends_on: service_healthy` for both (no per-run race).
- `tests/pwa.spec.ts @e2e @pwa` targets `https://web-preview:4173`.
  Self-signed cert → `playwright.config.ts` uses `ignoreHTTPSErrors`
  AND a `--ignore-certificate-errors` launch arg (the SW's own
  precache fetches bypass `ignoreHTTPSErrors`; without the flag the SW
  install never completes). The SW-ready wait MUST be `page.evaluate`
  (awaits the promise), NOT a `waitForFunction` async predicate (its
  Promise is always truthy → resolves before the SW controls).
- Test/build commands unchanged: `tools/scripts/test --full` / `--ci`
  (now 12/12 green); build via `tools/scripts/run -- npm run build`.

Epic 6 watch-outs:
- It's a verification pass over the PLAN.md checklist — mostly running
  the existing flows + the last item is README/CLAUDE docs for "adding
  a game" (folder + registry entry) and the deferred WASM contract.
- `dc-run preview` for a manual offline check is HTTPS now and on the
  `web-preview` host port; a browser will warn on the self-signed cert.

Resume steps:
1. Read `CLAUDE.md` (conventions), `TESTING.md` (test policy,
   authoritative), and `TODO.md` (authoritative epic list).
2. Continue from the next unchecked item in the current epic.
3. At end of epic: commit → update `TODO.md` + this file → stop.
