import { defineConfig } from "@takazudo/zfb/config";

/**
 * zfb-example-webshop — a Tailwind v4 webshop demo backed by Cloudflare
 * D1.
 *
 * - `framework: "preact"` — pages are Preact components.
 * - `base: "/"` — deployed at the root of its own Cloudflare Worker
 *   (`zfb-example-webshop`, deployed via `wrangler deploy`).
 * - `tailwind: { enabled: true }` — wires @tailwindcss/vite into the
 *   build so `@import "tailwindcss"` + `@theme` blocks are processed.
 * - `adapter: "@takazudo/zfb-adapter-cloudflare"` — emits `dist/_worker.js`
 *   so `prerender = false` routes (catalogue, cart, auth, checkout) run
 *   as the Cloudflare Worker (Workers Static Assets, driven by
 *   `wrangler.toml`) with the D1 binding (`env.DB`).
 *
 * No `collections` entry: the shop catalogue lives in D1, not in zfb
 * content collections.
 */
export default defineConfig({
  framework: "preact",
  base: "/",
  tailwind: { enabled: true },
  adapter: "@takazudo/zfb-adapter-cloudflare",
});
