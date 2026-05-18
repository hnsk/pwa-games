import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { startRouter } from "./router.ts";
import { renderMenu } from "./ui/menu.ts";

// Bootstrap: hash router drives the single `#app` container.
const app = document.querySelector<HTMLElement>("#app");
if (app) {
  startRouter({ app, renderMenu });
}

// PWA service worker. `registerType: 'autoUpdate'` (vite.config.ts) →
// Workbox precaches every hashed asset on first load so the app is
// fully playable offline, and a new deploy's SW activates + reloads
// clients automatically (no in-app prompt). `immediate: true` registers
// on load rather than waiting for the window `load` event. No-op in dev
// (devOptions.enabled = false → the virtual module is a stub).
registerSW({ immediate: true });
