// Tiny hash router (PLAN.md §Router). `#/` = menu, `#/g/<id>` = game.
// Hash routing so deep links + the service worker work on any static
// host with no rewrite rules. Mounts/unmounts the active GameModule
// into one `#app` container.

import { createGameStorage } from "./lib/storage.ts";
import { findGame } from "./games/registry.ts";
import type { GameModule } from "./games/types.ts";

export interface RouterOptions {
  app: HTMLElement;
  /** Renders the game menu into `app` (UI epic supplies this). */
  renderMenu: (app: HTMLElement) => void;
}

interface Route {
  kind: "menu" | "game";
  id?: string;
}

function parse(hash: string): Route {
  // Tolerate a trailing `?query` (e.g. `#/g/klondike?seed=42`): the id is
  // only the slug; games read their own params from `location.hash`.
  const m = /^#\/g\/([^/?]+)\/?(?:\?.*)?$/.exec(hash);
  if (m) return { kind: "game", id: decodeURIComponent(m[1]) };
  return { kind: "menu" };
}

export function startRouter({ app, renderMenu }: RouterOptions): void {
  let active: GameModule | null = null;
  // Bumped on every navigation; an in-flight async mount whose token is
  // stale must not attach (route changed during `await`).
  let nav = 0;

  function teardown(): void {
    if (active) {
      active.unmount();
      active = null;
    }
    app.replaceChildren();
  }

  function goMenu(): void {
    if (location.hash !== "#/") {
      location.hash = "#/"; // triggers hashchange → re-render
      return;
    }
    teardown();
    renderMenu(app);
  }

  async function render(): Promise<void> {
    const token = ++nav;
    const route = parse(location.hash);

    if (route.kind === "menu") {
      teardown();
      renderMenu(app);
      return;
    }

    const entry = findGame(route.id!);
    if (!entry) {
      goMenu(); // unknown id → menu
      return;
    }

    teardown();
    const mod = await entry.load();
    if (token !== nav) return; // navigated away during import/mount

    active = mod;
    await mod.mount(app, {
      storage: createGameStorage(mod.meta.id),
      onExit: goMenu,
    });
  }

  window.addEventListener("hashchange", () => void render());
  if (!location.hash) location.hash = "#/";
  void render();
}
