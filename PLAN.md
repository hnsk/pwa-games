# PWA Games App

An installable PWA that hosts multiple small games, fully playable
offline after first load, with no backend. Mobile-first. Local-only
scores. Architected so future games can be written in WASM (Rust) for
maximum control without changing the host shell.

## Goals

- Installable PWA, fully offline after first visit.
- Multiple games, easy to add (one folder + one registry entry).
- Mobile-first UI; all UI work uses the `frontend-design` skill.
- No backend. Per-game scores/state in `localStorage` only — no global
  leaderboard.
- First game: tictactoe.
- Host shell stays framework-free so DOM, canvas, and future WASM games
  are all drop-in.

## Stack

- **Build/dev**: Vite + TypeScript, vanilla (no UI framework).
- **Shell styling**: Tailwind CSS v4 via `@tailwindcss/vite` (shell UI
  only; games render their own surface).
- **PWA**: `vite-plugin-pwa` (Workbox), `registerType: autoUpdate`,
  precache all build assets → fully offline after first load.
- **Tests**: Playwright e2e.
- **Future WASM games**: Rust + `wasm-bindgen` / `wasm-pack`, consumed
  via `vite-plugin-wasm` + `vite-plugin-top-level-await`. Wired only
  when the first WASM game is added; contract below already supports it.
- **Hosting**: generic static build. Vite `base` from env, default
  relative (`./`) so it works on root or subpath. Hash routing avoids
  host rewrite rules.

## Architecture

### Game module contract

Every game implements one interface so the shell treats DOM, canvas, and
WASM games identically:

```ts
// src/games/types.ts
export interface GameMeta {
  id: string;          // url slug + storage namespace
  title: string;
  description: string;
  thumbnail?: string;  // menu card asset
}

export interface GameContext {
  storage: GameStorage;   // namespaced localStorage
  onExit: () => void;     // game asks shell to return to menu
}

export interface GameModule {
  meta: GameMeta;
  mount(el: HTMLElement, ctx: GameContext): void | Promise<void>;
  unmount(): void;        // free listeners, RAF, wasm instance
}
```

`mount` may return a Promise → covers async WASM init (a WASM game does
`await init()` then renders to a `<canvas>` in `el`; shell unchanged).

### Registry

`src/games/registry.ts` — array of `GameModule`, or lazy
`() => import()` factories so each game code-splits (heavy WASM game not
in menu bundle). Add a game = add its folder + one entry.

### Router

Tiny hash router: `#/` = menu, `#/g/<id>` = game. Hash routing chosen so
deep links and the service worker work on any static host with no server
config. Router mounts/unmounts the active `GameModule` into one `#app`
container.

### Storage

`src/lib/storage.ts` — `createGameStorage(gameId)` returns JSON
get/set/remove keyed `pwa-games:<gameId>:<key>`. Per-game scoreboard
(W/L/D) and resumable state. No global leaderboard.

### Project layout

```
index.html
vite.config.ts            # vite-plugin-pwa, tailwind, base from env
src/
  main.ts                 # bootstrap: router + registry + SW register
  style.css               # tailwind entry + design tokens
  router.ts
  lib/storage.ts
  games/
    types.ts
    registry.ts
    tictactoe/
      index.ts            # GameModule impl (DOM grid, mobile-first)
      logic.ts            # pure win/draw detection (testable)
  ui/                     # shared shell (menu, header)
public/                   # generated PWA icons
tests/
  tictactoe.spec.ts
  pwa.spec.ts
playwright.config.ts
```

### tictactoe (first game)

- DOM 3×3 grid, mobile-first: large tap targets, responsive square
  board, no hover-only affordances.
- `logic.ts`: pure `move` / `winner` / `isDraw`, no DOM.
- Local X/O/draw scoreboard via `GameStorage`; reset button; back to
  menu via `ctx.onExit`.
- Built with the `frontend-design` skill.

### PWA specifics

- Manifest: name, short_name, `display: standalone`, theme/background
  color, icon set.
- Icons generated from one source via
  `@vite-pwa/assets-generator` into `public/`.
- Workbox precaches all hashed assets → offline after first load;
  `autoUpdate` refreshes on new deploys.

## Verification

1. `npm run dev` → menu lists tictactoe; play to a win; score
   increments; reload → score persists.
2. `npm run build && npm run preview` → app loads.
3. Offline: load preview once, set network offline, reload → app + game
   still work (SW precache).
4. `npx playwright test`:
   - `tictactoe.spec.ts`: menu → game, play winning line, assert win
     state + scoreboard increment + persistence across reload.
   - `pwa.spec.ts`: SW registered, manifest linked, boots offline after
     first load.
5. `logic.ts` win/draw cases covered (pure functions, no DOM).

## Deferred

- Hosting target unspecified → relative `base`; set `base` env if a
  subpath host (e.g. GitHub Pages) is chosen later.
- No WASM game built now; Rust toolchain + `vite-plugin-wasm` added with
  the first WASM game. Contract already supports it.
