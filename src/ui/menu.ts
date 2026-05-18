// Game menu (PLAN.md §UI). Renders cards straight from the registry's
// `meta` (no game module loaded until the card is followed), with a
// graceful empty state while no games are registered. Safe DOM nodes
// only — meta strings are untrusted-by-contract.

import { createHeader } from "./header.ts";
import { registry } from "../games/registry.ts";
import type { GameEntry } from "../games/registry.ts";

function monogram(title: string): string {
  const m = title.trim().match(/\p{Letter}/u);
  return (m ? m[0] : "?").toUpperCase();
}

function card(entry: GameEntry): HTMLAnchorElement {
  const { meta } = entry;
  const a = document.createElement("a");
  a.className = "game-card";
  a.href = `#/g/${encodeURIComponent(meta.id)}`;

  const thumb = document.createElement("div");
  thumb.className = "game-card__thumb";
  thumb.setAttribute("aria-hidden", "true");
  if (meta.thumbnail) {
    const img = document.createElement("img");
    img.src = meta.thumbnail;
    img.alt = "";
    img.loading = "lazy";
    thumb.appendChild(img);
  } else {
    thumb.textContent = monogram(meta.title);
  }

  const title = document.createElement("h3");
  title.className = "game-card__title";
  title.textContent = meta.title;

  const desc = document.createElement("p");
  desc.className = "game-card__desc";
  desc.textContent = meta.description;

  const cue = document.createElement("span");
  cue.className = "game-card__cue";
  cue.textContent = "Play ▸";

  a.append(thumb, title, desc, cue);
  return a;
}

function emptyState(): HTMLElement {
  const box = document.createElement("div");
  box.className = "menu__empty";

  const glyph = document.createElement("div");
  glyph.className = "menu__empty-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = "▮";

  const title = document.createElement("p");
  title.className = "menu__empty-title";
  title.textContent = "No games loaded";

  const sub = document.createElement("p");
  sub.className = "menu__empty-sub";
  sub.textContent =
    "The cabinet is warming up. Games drop in as they ship — check back soon.";

  box.append(glyph, title, sub);
  return box;
}

/** Clears `app` and renders the shell header + game menu into it. */
export function renderMenu(app: HTMLElement): void {
  app.replaceChildren();
  app.appendChild(createHeader());

  const main = document.createElement("main");
  main.className = "shell-main menu";

  const lead = document.createElement("div");
  lead.className = "menu__lead";
  const kicker = document.createElement("p");
  kicker.className = "menu__kicker";
  kicker.textContent = "Offline arcade";
  const head = document.createElement("h2");
  head.className = "menu__head";
  head.innerHTML = "Pick a <em>game</em>"; // static literal, no user data
  lead.append(kicker, head);
  main.appendChild(lead);

  if (registry.length === 0) {
    main.appendChild(emptyState());
  } else {
    const grid = document.createElement("div");
    grid.className = "menu__grid";
    for (const entry of registry) grid.appendChild(card(entry));
    main.appendChild(grid);
  }

  app.appendChild(main);
}
