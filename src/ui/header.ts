// Shell header (PLAN.md §UI). Mobile-first marquee bar; the title links
// home (`#/`) so it doubles as "back to menu". Built with safe DOM
// nodes — no innerHTML — so future dynamic titles can't inject markup.

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

  header.append(mark, h, tag);
  return header;
}
