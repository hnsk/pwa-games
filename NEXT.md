# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 5 — PWA (installable + offline)
**Next unchecked item:** Add `vite-plugin-pwa` (Workbox),
`registerType: autoUpdate`, precache all hashed build assets.

Notes carried from Epic 4 (tictactoe):
- Game lives in `src/games/tictactoe/`: `logic.ts` (pure, immutable
  `move`/`winner`/`winningLine`/`isDraw`), `meta.ts` (`GameMeta`, static
  import so the menu card renders without the game chunk — keep this
  split for every future game), `index.ts` (`GameModule` default
  export, hot-seat X/O, one `AbortController` → `unmount` aborts it).
- `registry.ts` pattern for a new game: static `import { meta }` +
  `load: () => import("./<game>/index.ts").then(m => m.default)`. Build
  confirms code-split (`dist/assets/<game>-*.js` is its own chunk).
- Scoreboard persisted via `ctx.storage` key `"score"`
  (`{x,o,d}`); `readScore` tolerates missing/corrupt (→ zeros).
- CSS: tictactoe styles appended to `src/style.css` under the
  `tic-tac-toe` block, reusing the neon-cabinet design tokens. No
  Tailwind, no `frontend-design` skill was needed.
- Tests: `tests/tictactoe.spec.ts` = 3×`@unit @tictactoe` (pure logic)
  + 1×`@e2e @tictactoe` (play→win→score→reload-persist). `router.spec`
  no longer asserts the empty state (registry non-empty now). Every
  spec still carries one speed tier (`@unit`|`@e2e`) + one area tag.
- Test/build commands: `tools/scripts/test --full` / `--ci` (11/11
  green); typecheck+bundle via `tools/scripts/run -- npm run build`
  (`tsc --noEmit && vite build`). Note `run`'s command goes after `--`.

Epic 5 watch-outs:
- `vite-plugin-pwa` + `@vite-pwa/assets-generator`: pin LATEST stable
  (verify from npm — latest-stable rule), capture the verify command.
- Hash routing already in place → SW must serve `index.html` for deep
  links offline; precache all hashed assets incl. the per-game chunks.
- New spec `tests/pwa.spec.ts @e2e @pwa`: SW registered, manifest
  linked, boots offline after first load (network-offline reload).
  Likely needs `preview` (built+SW) not the dev server.

Resume steps:
1. Read `CLAUDE.md` (conventions), `TESTING.md` (test policy,
   authoritative), and `TODO.md` (authoritative epic list).
2. Continue from the next unchecked item in the current epic.
3. At end of epic: commit → update `TODO.md` + this file → stop.
