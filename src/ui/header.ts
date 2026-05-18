// Shell header (PLAN.md §UI). Mobile-first marquee bar; the title links
// home (`#/`) so it doubles as "back to menu". Built with safe DOM
// nodes — no innerHTML — so future dynamic titles can't inject markup.

import { currentTheme, toggleTheme } from "../lib/theme.ts";

/** Sun/moon glyph for the *action* (what clicking switches TO), so the
 *  control reads as "switch to light/dark". System-font glyphs only —
 *  no icon asset, keeps the offline-no-fetch rule. */
function paintToggle(btn: HTMLButtonElement): void {
  const t = currentTheme();
  const toDark = t === "light";
  btn.textContent = toDark ? "☾" : "☀";
  btn.setAttribute(
    "aria-label",
    toDark ? "Switch to dark theme" : "Switch to light theme",
  );
  btn.setAttribute("aria-pressed", String(t === "light"));
  btn.dataset.theme = t;
}

export function createHeader(): HTMLElement {
  const header = document.createElement("header");
  header.className = "shell-header";

  const mark = document.createElement("span");
  mark.className = "shell-header__mark";
  mark.setAttribute("aria-hidden", "true");

  const h = document.createElement("p");
  h.className = "shell-header__title";
  const home = document.createElement("a");
  home.href = "#/";
  home.textContent = "PWA Games";
  home.setAttribute("aria-label", "PWA Games — back to menu");
  h.appendChild(home);

  const tag = document.createElement("span");
  tag.className = "shell-header__tag";
  tag.textContent = "offline ready";

  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "shell-header__theme";
  paintToggle(themeBtn);
  themeBtn.addEventListener("click", () => {
    toggleTheme();
    paintToggle(themeBtn);
  });

  header.append(mark, h, tag, themeBtn);
  return header;
}
