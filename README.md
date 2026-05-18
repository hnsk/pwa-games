# PWA Games

Installable PWA hosting small games, fully playable offline after first
load. No backend; scores are local-only. Framework-free host shell so
DOM, canvas, and future WASM (Rust) games are all drop-in.

First game: tictactoe.

## Quick start

Everything runs in Docker Compose. The only host requirement is Python
≥ 3.11 (for `devctl`).

```
./setup.sh                       # once per clone — creates .venv
.venv/bin/devctl compose up      # build + start the stack (skill: dc-up)
```

| Action            | Command                                  | Skill     |
|-------------------|------------------------------------------|-----------|
| Dev server        | `devctl compose up`                      | `dc-up`   |
| Production build  | `devctl run -- npm run build`            | `dc-run`  |
| HTTPS preview     | `preview` service, host port 4181        | —         |
| Full test suite   | `devctl test --full`                     | `dc-test` |
| CI gate           | `devctl test --ci`                       | `dc-test` |

A service worker needs a secure context + a real build, so the dev
server cannot host it. The long-lived `preview` Compose service serves
the production build over HTTPS (self-signed cert — browsers warn).

## Adding a game

A game is a folder under `src/games/<id>/` plus one registry entry. No
shell changes.

1. **Create `src/games/<id>/`** mirroring `tictactoe/`:
   - `meta.ts` — exports `meta: GameMeta` (`id`, `title`,
     `description`, optional `thumbnail`). `id` is both the URL slug
     (`#/g/<id>`) and the storage namespace. Keep this file tiny and
     DOM/logic-free: the menu imports it statically so cards render
     without loading any game chunk.
   - `logic.ts` — pure game logic, no DOM (unit-testable).
   - `index.ts` — `export default` a `GameModule` (see contract below).

2. **Register it** in `src/games/registry.ts`:
   ```ts
   import { meta as myGameMeta } from "./mygame/meta.ts";
   // ...
   {
     meta: myGameMeta,
     load: () => import("./mygame/index.ts").then((m) => m.default),
   }
   ```
   `load()` is a dynamic import so each game code-splits into its own
   chunk; the menu never pulls a game's code until it is opened.

3. **Tests** (mandatory, tagged from day one — see `TESTING.md`):
   - `@unit @<id>` on `logic.ts` (win/draw/illegal-move cases).
   - `@e2e @<id>` driving the mounted UI through a full round +
     score persistence across reload.

### GameModule contract (`src/games/types.ts`)

```ts
interface GameModule {
  meta: GameMeta;
  mount(el: HTMLElement, ctx: GameContext): void | Promise<void>;
  unmount(): void;            // free listeners, RAF, wasm instance
}

interface GameContext {
  storage: GameStorage;       // namespaced localStorage (per game id)
  onExit: () => void;         // ask the shell to return to the menu
}
```

- `mount` may return a `Promise` — the router awaits it behind a
  nav-token guard, so async setup (e.g. WASM instantiation) is safe.
- `unmount` must release everything: listeners, `requestAnimationFrame`
  loops, and any WASM instance. A single `AbortController` per mount
  (tictactoe's pattern) makes teardown one `abort()`.
- `storage` is namespaced `pwa-games:<gameId>:<key>`; corrupt/missing
  reads return `null` instead of throwing.

## Deferred: WASM (Rust) games

WASM games are deferred — no Rust toolchain or `vite-plugin-wasm` is
wired yet. The contract already supports them: `mount` is allowed to be
async, so a game can `await` WASM instantiation in `mount` and tear the
instance down in `unmount`. When the first WASM game is scheduled, add a
Rust/`wasm-pack` build step and `vite-plugin-wasm` as a new epic; no
shell or contract change is needed.

## Project conventions

See `CLAUDE.md` (golden rules: all-in-Docker-Compose, latest-stable
pinning, capture everything re-readable), `TESTING.md` (authoritative
test policy), and `TODO.md` / `NEXT.md` (epic workflow).
