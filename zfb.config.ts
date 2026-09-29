import { defineConfig } from "@takazudo/zfb/config";

/**
 * zfb-example-webshop — a zudo-wind webshop demo backed by Cloudflare D1.
 *
 * - Pages are zudo-react components (zfb's owned JSX runtime); SSR routes
 *   render them to HTML with `renderToString` (see `lib/render.ts`).
 * - `base: "/"` — deployed at the root of its own Cloudflare Worker
 *   (`zfb-example-webshop`, deployed via `wrangler deploy`).
 * - `wind` — zudo-wind utility generation. The shop's semantic token set
 *   (colours, the hsp/vsp spacing axes, type scale, radii, shadows) is
 *   declared here explicitly: wind ships no implicit palette or scale.
 *   Colours point at authored custom properties in `styles/global.css`.
 * - `adapter: "@takazudo/zfb-adapter-cloudflare"` — emits `dist/_worker.js`
 *   so `prerender = false` routes (catalogue, cart, auth, checkout) run
 *   as the Cloudflare Worker (Workers Static Assets, driven by
 *   `wrangler.toml`) with the D1 binding (`env.DB`).
 *
 * No `collections` entry: the shop catalogue lives in D1, not in zfb
 * content collections.
 */
export default defineConfig({
  base: "/",
  wind: {
    spec: 1,
    reset: "owned-v1",
    tokens: {
      // Numeric sizing (`min-w-5`, `h-14`) — the 0.25rem unit the markup was written against.
      spacingUnit: "0.25rem",
      colors: {
        ink: "var(--color-ink)",
        "ink-soft": "var(--color-ink-soft)",
        paper: "var(--color-paper)",
        surface: "var(--color-surface)",
        "surface-sunken": "var(--color-surface-sunken)",
        line: "var(--color-line)",
        brand: "var(--color-brand)",
        "brand-strong": "var(--color-brand-strong)",
        "brand-soft": "var(--color-brand-soft)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        "success-soft": "var(--color-success-soft)",
        danger: "var(--color-danger)",
        "danger-soft": "var(--color-danger-soft)",
        white: "#fff",
      },
      // Two semantic spacing axes: hsp (horizontal) and vsp (vertical).
      spacing: {
        "hsp-2xs": "0.25rem",
        "hsp-xs": "0.5rem",
        "hsp-sm": "0.75rem",
        "hsp-md": "1.25rem",
        "hsp-lg": "2rem",
        "hsp-xl": "3.5rem",
        "vsp-2xs": "0.25rem",
        "vsp-xs": "0.5rem",
        "vsp-sm": "0.875rem",
        "vsp-md": "1.5rem",
        "vsp-lg": "2.5rem",
        "vsp-xl": "4rem",
      },
      fontSizes: {
        display: { size: "2.5rem", lineHeight: "1.1" },
        title: { size: "1.75rem", lineHeight: "1.2" },
        heading: { size: "1.25rem", lineHeight: "1.3" },
        body: { size: "1rem", lineHeight: "1.6" },
        small: { size: "0.875rem", lineHeight: "1.5" },
        micro: { size: "0.75rem", lineHeight: "1.4" },
      },
      fontWeights: {
        semibold: "600",
        bold: "700",
      },
      letterSpacings: {
        tight: "-0.025em",
        wide: "0.025em",
      },
      radii: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "1rem",
        pill: "999px",
      },
      // Layered, colour-matched elevation shadows.
      shadows: {
        card: "0 0.5px 1px oklch(0.21 0.03 264 / 0.05), 0 2px 4px oklch(0.21 0.03 264 / 0.05), 0 5px 10px oklch(0.21 0.03 264 / 0.05)",
        raised:
          "0 1px 2px oklch(0.21 0.03 264 / 0.06), 0 4px 8px oklch(0.21 0.03 264 / 0.06), 0 12px 24px oklch(0.21 0.03 264 / 0.07)",
      },
    },
    breakpoints: {
      sm: { minWidthPx: 640 },
      md: { minWidthPx: 768 },
    },
  },
  adapter: "@takazudo/zfb-adapter-cloudflare",
});
