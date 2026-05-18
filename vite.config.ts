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
  },
  preview: {
    host: true,
    port: 4173,
  },
});
