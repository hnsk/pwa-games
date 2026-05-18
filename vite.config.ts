import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Service workers need a secure context. The `preview` compose service
// (the PWA offline test target) sets PWA_HTTPS=1 so `vite preview` is
// served over HTTPS (self-signed; Playwright runs with
// ignoreHTTPSErrors). The `dev` server stays plain HTTP — the other
// specs hit it and never touch a SW. basic-ssl patches both serve and
// preview, so it is included ONLY when that env flag is set.
const httpsPreview = !!process.env.PWA_HTTPS;

// `base` from env so the same build serves from a domain root or a
// subpath (e.g. project pages). Default relative `./` works anywhere;
// hash routing avoids host rewrite rules. Override with VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? "./",
  plugins: [
    ...(httpsPreview ? [basicSsl()] : []),
    VitePWA({
      // New SW activates as soon as it is ready (no in-app update
      // prompt). main.ts registers via the `virtual:pwa-register`
      // helper, so `autoUpdate` also reloads clients on new deploys.
      registerType: "autoUpdate",
      // Generated icon set lives in public/ (see pwa-assets.config.ts);
      // these non-hashed assets must be precached explicitly so the
      // app is fully usable offline including its icons/favicon.
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon-180x180.png",
        "pwa-64x64.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "maskable-icon-512x512.png",
      ],
      manifest: {
        name: "PWA Games",
        short_name: "PWA Games",
        description:
          "An installable, fully-offline collection of small games. " +
          "Local scores, no backend.",
        // Hash routing → the app boots from index.html at the base; a
        // relative start_url keeps a subpath deploy working too.
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#07080d",
        background_color: "#07080d",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache EVERY hashed build asset incl. the per-game
        // code-split chunks (PLAN.md §PWA: offline after first load).
        globPatterns: [
          "**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}",
        ],
        // Hash-routing deep links (#/g/<id>) resolve to index.html;
        // serve it from the precache for any navigation while offline.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
      // The offline contract is verified against the production build
      // served by `vite preview` (tests/pwa.spec.ts). The dev-server SW
      // would precache nothing meaningful (no hashed assets in dev), so
      // it stays disabled to avoid stale-cache surprises during HMR.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // Bound for the Docker dev service; reachable from the host.
    host: true,
    port: 5173,
    // The Playwright `test` compose service hits the app over the
    // compose network as Host `web` (a compose network alias on the
    // `dev` service — the literal name `dev` triggers Chrome's HSTS
    // preload for `.dev`). Vite's host-check blocks unknown hosts.
    allowedHosts: ["web"],
  },
  preview: {
    host: true,
    port: 4173,
    // `web-preview` = the compose alias on the `preview` service the
    // PWA spec targets (built app + real SW). `web` kept so a manual
    // `dc-run preview` is reachable the same way the dev server is.
    allowedHosts: ["web", "web-preview"],
  },
});
