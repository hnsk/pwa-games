import { defineConfig } from "vite";

// `base` from env so the same build serves from a domain root or a
// subpath (e.g. project pages). Default relative `./` works anywhere;
// hash routing avoids host rewrite rules. Override with VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? "./",
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
    allowedHosts: ["web"],
  },
});
