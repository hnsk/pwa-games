# Next — PWA Games App

Resume pointer for a fresh session. Updated at every epic hard-stop.

**Current epic:** Epic 2 — Test harness + conventions (mandatory)
**Next unchecked item:** Add Playwright + browsers to a `test`-profile
service in `tools/docker-compose.yml` (long-lived browser image, no
per-run restart of supporting services).

Notes carried from Epic 1:
- Dev stack: `dc-up` → Vite at host **:5180** (container 5173);
  preview host **:4180** (container 4173). Override DEV_PORT /
  PREVIEW_PORT if those collide.
- `node_modules` lives in the `node-modules` named volume (repo
  bind-mount shadows `/work/node_modules`); `dc-run`/`test` share it.
  Run `npm install` in the service before first use.
- Verify latest-stable versions from official sources and pin
  (Playwright npm + browser image).

Resume steps:
1. Read `CLAUDE.md` (conventions), `TESTING.md` (test policy,
   authoritative), and `TODO.md` (authoritative epic list).
2. Continue from the next unchecked item in the current epic.
3. At end of epic: commit → update `TODO.md` + this file → stop.
