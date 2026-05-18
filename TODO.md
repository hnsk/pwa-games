# PWA Games App — TODO

Authoritative project source. Work top-down, one epic at a time.
**Hard stop after each epic**: commit → update this file + `NEXT.md` →
end the turn and wait for the user.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Epic 1: Project skeleton + Docker dev image

Vite + TypeScript project that builds and serves inside Docker Compose;
nothing runs on the host but `devctl`.

- [ ] Add Node (latest stable, verified from Docker Hub) to
      `tools/docker/Dockerfile.dev` under the runtime marker.
- [ ] Scaffold Vite + TS vanilla project: `index.html`,
      `vite.config.ts`, `src/main.ts`, `src/style.css`, `package.json`,
      `tsconfig.json`. Vite `base` from env, default `./`.
- [ ] Define `dev` service (Vite dev server) + `build`/`preview` usage
      in `tools/docker-compose.yml`; set `[compose].default_service` in
      `tools/devctl.toml`.
- [ ] `dc-up` serves the Vite starter page; `dc-run` build succeeds.

## Epic 2: Test harness + conventions (mandatory, before features)

Wire the concrete Playwright runner, the tagging scheme, parallel-safe
execution, and the provider-neutral `--ci` entrypoint per `TESTING.md`.

- [ ] Add Playwright + browsers to a `test`-profile service in
      `tools/docker-compose.yml` (long-lived browser image, no per-run
      restart of supporting services).
- [ ] `playwright.config.ts`: parallel workers, fresh context per test,
      points at the Compose-served preview/dev URL.
- [ ] Fill `[test]` in `tools/devctl.toml`: `service`, `command`
      (`--full`), `unit` (`--grep @unit`), `changed` (`{files}` →
      area-tag grep), `ci` (`--changed` fast subset), `parallel`.
- [ ] Tagging scheme enforced: every spec carries `@unit|@e2e` + an
      area tag (see `TESTING.md`).
- [ ] One smoke spec (`tests/smoke.spec.ts @e2e @shell`) green via
      `tools/scripts/test --full` and `--ci`.

## Epic 3: Host shell (framework-free)

Drop-in game host: router, registry, storage, module contract, menu UI.

- [ ] `src/games/types.ts` — `GameMeta` / `GameContext` / `GameModule`
      exactly per plan (mount may return a Promise for WASM).
- [ ] `src/lib/storage.ts` — `createGameStorage(gameId)`, JSON
      get/set/remove keyed `pwa-games:<gameId>:<key>`.
- [ ] `src/router.ts` — hash router: `#/` menu, `#/g/<id>` game;
      mount/unmount active `GameModule` into `#app`.
- [ ] `src/games/registry.ts` — array / lazy `() => import()` factories
      so games code-split.
- [ ] `src/ui/` menu + header (mobile-first), built with the
      `frontend-design` skill.
- [ ] Specs: `@e2e @router` (menu↔game nav), `@unit @storage`
      (namespace + JSON round-trip).

## Epic 4: tictactoe (first game)

- [ ] `src/games/tictactoe/logic.ts` — pure `move` / `winner` /
      `isDraw`, no DOM.
- [ ] `src/games/tictactoe/index.ts` — `GameModule`: DOM 3×3 grid,
      mobile-first large tap targets, responsive square board.
- [ ] Local X/O/draw scoreboard via `GameStorage`; reset button; back
      to menu via `ctx.onExit`. UI via `frontend-design` skill.
- [ ] Register tictactoe in `registry.ts`.
- [ ] Specs: `@unit @tictactoe` (win/draw cases on `logic.ts`),
      `@e2e @tictactoe` (play winning line → win state + scoreboard
      increment + persists across reload).

## Epic 5: PWA (installable + offline)

- [ ] Add `vite-plugin-pwa` (Workbox), `registerType: autoUpdate`,
      precache all hashed build assets.
- [ ] Manifest: name, short_name, `display: standalone`, theme/
      background color, icon set.
- [ ] Generate icons from one source via
      `@vite-pwa/assets-generator` into `public/`.
- [ ] Register SW in `src/main.ts`.
- [ ] Spec: `tests/pwa.spec.ts @e2e @pwa` — SW registered, manifest
      linked, boots offline after first load (network-offline reload).

## Epic 6: Verification pass

Run the plan's full verification checklist end-to-end and lock CI.

- [ ] `dc-run` dev: menu lists tictactoe; play to win; score
      increments; reload → persists.
- [ ] `dc-run` `build` + `preview`: app loads; offline reload still
      works (SW precache).
- [ ] `tools/scripts/test --full` green: tictactoe + pwa + logic specs.
- [ ] `tools/scripts/test --ci` green (fast changed subset).
- [ ] README/CLAUDE notes for adding a game (folder + registry entry)
      and the deferred WASM contract.

<!--
WASM games are deferred (plan §Deferred): no Rust toolchain /
vite-plugin-wasm now. The GameModule contract already supports async
mount; add that epic when the first WASM game is scheduled.
-->
