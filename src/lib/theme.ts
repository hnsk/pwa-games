// Light/dark theme: a 2-state switch persisted in localStorage.
//
// The initial `data-theme` is set by a tiny pre-paint inline script in
// index.html (seeded from localStorage, else the OS preference) so the
// first frame never flashes the wrong palette — that script is the
// single source of the bootstrap rule. This module only handles the
// runtime toggle (header button) and keeps <meta name="theme-color">
// (the mobile browser chrome) in sync.

export type Theme = "light" | "dark";

const STORAGE_KEY = "pwa-games:theme";
// Match the slate/paper page colours in style.css so the address-bar
// chrome blends with the app.
const META: Record<Theme, string> = {
  dark: "#16181d",
  light: "#faf9f6",
};

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light"
    ? "light"
    : "dark";
}

/** Apply a theme to <html> and the theme-color meta. Idempotent. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META[theme]);
}

/** Flip the theme, persist the choice, return the new value. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private-mode / storage-disabled: the toggle still works for this
    // session, it just won't persist. Non-fatal.
  }
  return next;
}

/** Sync the theme-color meta to whatever the bootstrap already chose
 *  (the inline script sets data-theme but not the meta). Call once at
 *  startup. */
export function initTheme(): void {
  applyTheme(currentTheme());
}
