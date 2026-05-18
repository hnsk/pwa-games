# PWA Games App — TODO

Authoritative project source. Work top-down, one epic at a time.
**Hard stop after each epic**: commit → update this file + `NEXT.md` →
end the turn and wait for the user.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Epic 1: Project skeleton + Docker dev image

Vite + TypeScript project that builds and serves inside Docker Compose;
nothing runs on the host but `devctl`.

- [x] Add Node (latest stable, verified from Docker Hub) to
      `tools/docker/Dockerfile.dev` under the runtime marker.
      (Node v24.15.0 LTS, verified from nodejs.org/dist.)
- [x] Scaffold Vite + TS vanilla project: `index.html`,
      `vite.config.ts`, `src/main.ts`, `src/style.css`, `package.json`,
      `tsconfig.json`. Vite `base` from env, default `./`.
      (vite 8.0.13, typescript 6.0.3, @types/node 25.8.0, +vite-env.d.ts.)
- [x] Define `dev` service (Vite dev server) + `build`/`preview` usage
      in `tools/docker-compose.yml`; set `[compose].default_service` in
      `tools/devctl.toml`. (default_service already `dev`; node_modules
      named volume; host ports 5180/4180 via DEV_PORT/PREVIEW_PORT.)
- [x] `dc-up` serves the Vite starter page; `dc-run` build succeeds.

## Epic 2: Test harness + conventions (mandatory, before features)

Wire the concrete Playwright runner, the tagging scheme, parallel-safe
execution, and the provider-neutral `--ci` entrypoint per `TESTING.md`.

- [x] Add Playwright + browsers to a `test`-profile service in
      `tools/docker-compose.yml` (long-lived browser image, no per-run
      restart of supporting services).
      (Image `mcr.microsoft.com/playwright:v1.60.0-noble`, pinned to
      `@playwright/test@1.60.0`; both verified 2026-05-18 from npm +
      MCR tags. `depends_on: dev`, shares `node-modules` volume.)
- [x] `playwright.config.ts`: parallel workers, fresh context per test,
      points at the Compose-served preview/dev URL.
      (`fullyParallel`, default fresh context, no `webServer`; baseURL
      `http://web:5173` — `web` alias on `dev` because `.dev` is HSTS-
      preloaded in Chrome. Workers from CLI `--workers=50%`.)
- [x] Fill `[test]` in `tools/devctl.toml`: `service`, `command`
      (`--full`), `unit` (`--grep @unit`), `changed` (`{files}` →
      area-tag grep), `ci` (`--changed` fast subset), `parallel`.
      (No native impact tool / `{files}` token unusable with non-spec
      changed files → `changed` = `@unit --pass-with-no-tests`; `ci` =
      full suite — it is the gate and the only spec is `@e2e`; see the
      `tools/devctl.toml` comments + `TESTING.md`.)
- [x] Tagging scheme enforced: every spec carries `@unit|@e2e` + an
      area tag (see `TESTING.md`).
- [x] One smoke spec (`tests/smoke.spec.ts @e2e @shell`) green via
      `tools/scripts/test --full` and `--ci`.

## Epic 3: Host shell (framework-free)

Drop-in game host: router, registry, storage, module contract, menu UI.

- [x] `src/games/types.ts` — `GameMeta` / `GameContext` / `GameModule`
      exactly per plan (mount may return a Promise for WASM).
      (+`GameStorage` contract interface, impl in `lib/storage.ts`.)
- [x] `src/lib/storage.ts` — `createGameStorage(gameId)`, JSON
      get/set/remove keyed `pwa-games:<gameId>:<key>`. (Corrupt/missing
      → `null`, no throw.)
- [x] `src/router.ts` — hash router: `#/` menu, `#/g/<id>` game;
      mount/unmount active `GameModule` into `#app`. (Nav-token guard
      for async mount; unknown id → menu; `onExit`/title link → `#/`.)
- [x] `src/games/registry.ts` — array / lazy `() => import()` factories
      so games code-split. (`GameEntry{meta, load()}` so the menu
      renders from `meta` without loading a game; `findGame(id)`.
      Currently empty — tictactoe entry lands in Epic 4.)
- [x] `src/ui/` menu + header (mobile-first), built with the
      `frontend-design` skill. (Plain CSS design system — Tailwind not
      wired; safe DOM nodes; empty-state while registry empty;
      `main.ts` bootstraps `startRouter`.)
- [x] Specs: `@e2e @router` (menu↔game nav), `@unit @storage`
      (namespace + JSON round-trip). (`tests/router.spec.ts` 3 cases;
      `tests/storage.spec.ts` 3 cases via Node `localStorage` polyfill
      — real `@unit` tier, no nav. Smoke spec updated to new shell.)

## Epic 4: tictactoe (first game)

- [x] `src/games/tictactoe/logic.ts` — pure `move` / `winner` /
      `isDraw`, no DOM. (+`winningLine` for UI highlight; immutable —
      `move` returns a new board, rejects out-of-range/taken/decided.)
- [x] `src/games/tictactoe/index.ts` — `GameModule`: DOM 3×3 grid,
      mobile-first large tap targets, responsive square board.
      (`aspect-ratio:1/1`; one `AbortController` → unmount = single
      abort; `meta.ts` split so the menu card loads without the game
      chunk — verified: separate `tictactoe-*.js`.)
- [x] Local X/O/draw scoreboard via `GameStorage`; reset button; back
      to menu via `ctx.onExit`. (Hot-seat X vs O; New-round +
      Reset-scores + Back controls; plain-CSS, no frontend-design skill
      needed — extended the existing neon design system.)
- [x] Register tictactoe in `registry.ts`. (Static `meta` import +
      lazy `import("./tictactoe/index.ts")` so it code-splits.)
- [x] Specs: `@unit @tictactoe` (win/draw cases on `logic.ts`),
      `@e2e @tictactoe` (play winning line → win state + scoreboard
      increment + persists across reload). (`tests/tictactoe.spec.ts`,
      4 cases. `router.spec` updated: menu now renders a game card, not
      the empty state. Full + CI 11/11 green.)

## Epic 5: PWA (installable + offline)

- [x] Add `vite-plugin-pwa` (Workbox), `registerType: autoUpdate`,
      precache all hashed build assets. (vite-plugin-pwa 1.3.0,
      verified-latest from npm; generateSW, `globPatterns`
      `**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}` → 21
      precache entries incl. the code-split `tictactoe-*.js` chunk;
      `navigateFallback: index.html` for offline hash-route deep links.)
- [x] Manifest: name, short_name, `display: standalone`, theme/
      background color, icon set. (theme/bg `#07080d`, portrait,
      relative `start_url`/`scope` for subpath deploys.)
- [x] Generate icons from one source via
      `@vite-pwa/assets-generator` into `public/`.
      (`@vite-pwa/assets-generator` 1.0.2, `minimal2023Preset`,
      `pwa-assets.config.ts`, source `public/favicon.svg` →
      pwa-64/192/512, maskable-512, apple-touch-180, favicon.ico;
      `npm run generate-pwa-assets`.)
- [x] Register SW in `src/main.ts`. (`registerSW({ immediate: true })`
      from `virtual:pwa-register`; no-op in dev — `devOptions` off.)
- [x] Spec: `tests/pwa.spec.ts @e2e @pwa` — SW registered, manifest
      linked, boots offline after first load (network-offline reload).
      (Targets a new long-lived HTTPS `preview` compose service —
      `@vitejs/plugin-basic-ssl` 2.3.0, gated by `PWA_HTTPS`; a SW
      needs a secure context + a real build. Runner uses
      `ignoreHTTPSErrors` + `--ignore-certificate-errors` for the
      self-signed cert. Full + CI 12/12 green.)

## Epic 6: Verification pass

Run the plan's full verification checklist end-to-end and lock CI.

- [x] `dc-run` dev: menu lists tictactoe; play to win; score
      increments; reload → persists. (Covered by `@e2e @tictactoe`
      "play a winning line → win + scoreboard + persists".)
- [x] `dc-run` `build` + `preview`: app loads; offline reload still
      works (SW precache). (Build OK — 21 precache entries, code-split
      `tictactoe-*.js`; offline reload covered by `@e2e @pwa`.)
- [x] `tools/scripts/test --full` green: tictactoe + pwa + logic specs.
      (12/12 green, run 20260518-103340-test.)
- [x] `tools/scripts/test --ci` green (fast changed subset).
      (12/12 green, run 20260518-103349-test-ci.)
- [x] README/CLAUDE notes for adding a game (folder + registry entry)
      and the deferred WASM contract. (New `README.md` — adding-a-game
      guide, GameModule contract, deferred-WASM section.)

## Epic 7: Klondike model + pure logic

Second game. Pure, immutable rules module (no DOM/storage) so the
`@unit` tier exercises the whole engine with zero browser.

- [x] `src/games/klondike/meta.ts` + `logic.ts`: types
      (`Suit`/`Card`/`GameState`), `makeDeck`, `mulberry32` +
      seeded `shuffle`, `deal` (tableau 1..7, last face-up, stock 24),
      `canStackTableau`/`canStackFoundation`, `isMovableRun`,
      `applyMove` (draw / recycle / waste→tab / waste→found /
      tab→tab run / tab→found, auto-flip newly exposed top),
      `foundationTargetFor`, `isWon`, `canAutoComplete`, `autoStep`.
      (Pure/immutable; `id` = `${suit}${rank}` for stable selectors.)
- [x] `tests/klondike.spec.ts` `@unit @klondike`: 52-unique deck;
      seeded `shuffle` deterministic + permutation; `deal` shape;
      stacking truth-tables; `applyMove` waste→foundation + tableau
      run move + auto-flip; `autoStep` solves a no-face-down state to
      `isWon`; `canAutoComplete` boundary. (9 cases.)
- [x] `dc-test --unit` green; commit; update `TODO.md`+`NEXT.md`.
      (16/16 green, run 20260518-110124-test-unit.)

## Epic 8: Klondike UI, drag, draw modes, registry, styling

- [x] `src/games/klondike/index.ts` `GameModule`: DOM board (CSS
      glyph cards, stable `data-*` selectors), pointer drag-and-drop
      (mouse+touch) for tableau/waste/foundation, double-tap →
      foundation, stock draw/recycle, New game / Draw-mode toggle
      (default 3) / Back. One `AbortController`; deterministic
      `#/g/klondike?seed=<n>` hook. (Delegated listeners on the board;
      6px drag threshold so a tap still reaches `dblclick`; ghost on
      `<body>`. `router.ts` `parse()` widened to tolerate a trailing
      `?query` — the regex previously folded it into the id so the
      documented seeded route never resolved.)
- [x] Register klondike in `src/games/registry.ts` (code-splits).
      (Static `meta` + lazy `import("./klondike/index.ts")` →
      separate `klondike-*.js`.)
- [x] `src/style.css`: `.sol-*` neon-system styling, mobile-first,
      responsive 7 columns, drag ghost. (Card metrics live on `:root`
      so the body-level ghost keeps the same size.)
- [x] `dc-up` / `dc-run` build green (separate `klondike-*.js`
      chunk, menu lists the game); commit; update `TODO.md`+`NEXT.md`.
      (Build OK — `klondike-Cazmy8_S.js` 8.45 kB, precache 21→22;
      full+unit 24/24 green, run 20260518-110733-test. `router.spec`
      game-card count 1→2.)

## Epic 9: Timer, best time, auto-complete + E2E + verification

- [x] Timer (`M:SS`, starts on first move, stops on win/unmount);
      per-mode best time persisted (`best-1`/`best-3` via
      `ctx.storage`), shown + updated on win. (`.sol-bar` now holds
      mode/timer/best/status spans; `startTimer` guarded so the first
      move — incl. an auto step — starts the 1 s interval; `recordBest`
      writes `{seconds,date}` only if faster/none.)
- [x] Auto-complete: auto-run `autoStep` loop when `canAutoComplete`
      (no per-card clicking) + manual button fallback; interval
      cleared on unmount/new game. (`maybeAutoComplete` → 120 ms
      `setInterval` of `autoStep`; `finishWin` stops timer+loop,
      records best; hidden "Auto-complete" button shown only when
      `canAutoComplete && !won`. `?solve=1` test hook deals an
      already-face-up auto-completable board — a normal deal always
      has face-down cards so can never auto-complete on mount.)
- [x] `tests/klondike.spec.ts` `@e2e @klondike`: board renders;
      stock click → waste grows by draw count; draw-mode toggle
      changes count; double-tap an Ace → foundation; timer
      increments; seeded deal → auto-complete finishes → win → best
      time persists across reload; New game resets. (7 `@e2e` cases;
      Ace-top seed found via the imported pure logic, no magic number.)
- [x] `dc-test --full` + `--ci` green; commit; update
      `TODO.md`+`NEXT.md`. (full 30/30 run 20260518-112946-test; ci
      30/30 run 20260518-113004-test-ci; build green —
      klondike-Co5zMur8.js 10.63 kB, precache 22.)

## Epic 10: Sudoku (third game)

Plan: `~/.claude/plans/abstract-watching-avalanche.md`. Mirrors the
Klondike split (pure engine + GameModule), real technique-rated
difficulty, no shell/visual-regression regression.

- [x] `src/games/sudoku/logic.ts` — pure engine: PEERS/UNITS, copied
      `mulberry32`, `fullSolve`, `countSolutions` (MRV, abort at
      limit), candidate `Model`, graded technique ladder
      (naked/hidden single, locked candidates, naked/hidden pair,
      naked/hidden triple, X-Wing), `rate`/`classify`, runtime
      `generate` (seeded dig + technique-rate, attempt/wall-clock
      budget, fallback labelled with the *measured* difficulty),
      `conflicts`/`isComplete`/`firstForcedCell`.
- [x] `src/games/sudoku/meta.ts` + registry 3rd entry (static meta +
      lazy `import("./sudoku/index.ts")` → separate `sudoku-*.js`).
- [x] `src/games/sudoku/index.ts` `GameModule`: 9×9 render + number
      pad, tap + full keyboard input, notes mode, optional mistake
      check (off by default, persisted via `pref`), always-on conflict
      outline, per-3×3-box hint (max 9, forced cell when possible),
      digit-complete key greying, digit highlight, play timer (M:SS),
      win banner, `Saved` localStorage resume, difficulty-cycle redeal,
      `?seed=`/`?diff=`/`?solve=1` test hooks. One `AbortController`.
- [x] `src/style.css`: appended `.sdk-*` block (shell tokens only +
      component-local `--sdk-*`; no edits to shell/`.ttt-*`/`.sol-*`).
- [x] `tests/sudoku.spec.ts` — `@unit @sudoku` (engine: solve,
      determinism, technique truth-tables, generate invariants,
      boundary) + `@e2e @sudoku` (render, place vs given, highlight,
      notes, mistake-check toggle, box-scoped hint, `?solve=1` win +
      key grey + timer stop, save/resume + New game). `router.spec`
      game-card count 2→3.
- [x] `dc-test --unit/--full/--ci` green; build green (separate
      `sudoku-ByVR50YI.js` 13.03 kB, precache 22→23); two-theme +
      320px screenshot sweep verified given/user/hint/same/conflict/
      selected all distinguishable. (full 49/49 run
      20260518-155746-test; ci run 20260518-155801-test-ci.) Commit;
      update `TODO.md`+`NEXT.md`.

<!--
WASM games are deferred (plan §Deferred): no Rust toolchain /
vite-plugin-wasm now. The GameModule contract already supports async
mount; add that epic when the first WASM game is scheduled.
-->
