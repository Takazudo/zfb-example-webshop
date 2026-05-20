/**
 * Cloudflare Worker binding shape for this shop.
 *
 * `DB` is the D1 binding declared in `wrangler.toml` (`binding = "DB"`).
 * SSR routes read it via `getCloudflareContext<Env>()`.
 */
export interface Env {
  DB: D1Database;
}
