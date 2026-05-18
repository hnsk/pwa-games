// @vite-pwa/assets-generator config. One source SVG → the full PWA icon
// set written next to the source (public/), so the static build ships
// real files (TODO Epic 5: "generate icons from one source … into
// public/"). Run: `npm run generate-pwa-assets` (devctl run / dc-run).
// The minimal-2023 preset emits: pwa-64x64.png, pwa-192x192.png,
// pwa-512x512.png (any-purpose), maskable-icon-512x512.png,
// apple-touch-icon-180x180.png, and references favicon.svg (the source).
import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

export default defineConfig({
  preset: minimal2023Preset,
  images: ["public/favicon.svg"],
});
