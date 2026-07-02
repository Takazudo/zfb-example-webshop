# zfb-example-webshop

A small, polished **webshop demo** built with
[zfb (zudo-front-builder)](https://github.com/Takazudo/zudo-front-builder)
— Tailwind v4 styling, server-side rendered routes, and a shopping cart
+ accounts backed by **Cloudflare D1**.

**Live:** https://zfb-example-webshop.takazudo.workers.dev/ — the
production Cloudflare Worker. (The old `https://zfb-example-webshop.pages.dev/`
Pages URL is being retired — see [Deployment](#deployment).)

It demonstrates the parts of zfb a content-only demo cannot: SSR routes
(`prerender = false`) that read a Cloudflare Worker binding, email +
password auth with server-side sessions, and durable cart / order state
in a real SQL database.

## What the demo does

- **Catalogue** — a grid of ~12 demo products served from D1.
- **Accounts** — email + password sign up / sign in / sign out.
  Passwords are hashed with PBKDF2 (Web Crypto); sessions are an opaque
  server-side cookie.
- **Cart** — add / remove products; quantity collapses per product.
- **Checkout** — placing an order snapshots the cart into an `orders`
  record, empties the cart, and shows a confirmation page. No payment,
  no shipping — exactly the locked scope.

Every form is a plain `<form method="post">`: the demo ships **zero
client-side JavaScript**. All interactivity is server round-trips.

## Architecture

| Concern        | How                                                            |
| -------------- | -------------------------------------------------------------- |
| Framework      | zfb + Preact, Tailwind v4                                      |
| SSR routes     | `export const prerender = false` — run as a Cloudflare Worker  |
| Worker binding | `env.DB` (D1) read via `getCloudflareContext<Env>()`           |
| Adapter        | `@takazudo/zfb-adapter-cloudflare` → emits `dist/_worker.js`   |
| Data           | Cloudflare D1 (`migrations/0001_init.sql`, `0002_seed_*.sql`)  |
| Deploy         | Cloudflare Workers (Static Assets) via `.github/workflows/deploy.yml` |

Note: all routes are `prerender = false` (the catalogue reads live
prices from D1), so the build produces no static HTML pages — only the
SSR worker (`dist/_worker.js` + `dist/_zfb_inner.mjs`) and the compiled
CSS asset. The order confirmation page is `/order?id=<n>` (a query
string, not a `/order/:id` path param) because zfb dynamic route
segments require a build-time `paths()` enumeration, and order ids are
created at runtime.

## Dependencies

This is a **standalone** repo. The zfb packages (`@takazudo/zfb`,
`@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) are normal
npm registry dependencies — no `file:` links. The `zfb` CLI itself ships
as prebuilt platform binaries via `@takazudo/zfb`'s optionalDependencies,
so `pnpm install` is the whole setup — no source build, no sibling
checkout.

## Local development

### Fresh checkout

```sh
git clone https://github.com/Takazudo/zfb-example-webshop.git
cd zfb-example-webshop
pnpm install
pnpm build               # verify the setup end-to-end
```

### Day-to-day

```sh
pnpm build               # zfb build → dist/_worker.js + dist/_zfb_inner.mjs
pnpm typecheck           # zfb check (tsc --noEmit)
```

### Running the cart locally against a local D1

The cart and accounts read `env.DB`, so they need a real Worker
binding. `zfb dev` does **not** provide one — use the
`wrangler dev`-based loop below for any work that touches D1.

#### One-time setup

```sh
pnpm install                                            # picks up wrangler + concurrently + chokidar-cli devDeps
pnpm exec wrangler d1 migrations apply webshop --local  # creates .wrangler/ if needed
```

`wrangler` is a project devDependency, so `pnpm dev:cf` and
`pnpm exec wrangler` both resolve the pinned version from
`node_modules/.bin` — no global install needed. The pin matters: the
bundled `workerd` must support `compatibility_date` in `wrangler.toml`
(currently `2026-05-01`), and older global wranglers fail to start the
worker with a `compatibility date` error.

#### Day-to-day edit-refresh loop

```sh
pnpm dev:cf
```

That single command applies migrations, runs an initial `pnpm build`,
then starts two processes side-by-side via `concurrently`:

- `wrangler dev --port 8788` — reads `wrangler.toml` (`main` +
  `[assets]`), serves the built worker against the local D1, and
  auto-reloads when `dist/` changes.
- `chokidar` — watches `pages/`, `components/`, `layouts/`, `lib/`,
  `styles/`; re-runs `pnpm build` on save (200ms debounce).

Edit-to-browser latency is roughly 1–2 seconds. Ctrl-C kills both
processes cleanly.

> **Do NOT run `pnpm dev` and `pnpm dev:cf` at the same time.**
> `pnpm dev`'s `predev` step (`rm -rf dist .zfb .zfb-build`) wipes the
> `dist/` directory that `wrangler dev` is actively serving,
> putting wrangler into a degraded state where rebuilds stop
> triggering reloads. Pick one loop at a time. If you accidentally
> ran both, stop everything, run `pnpm build`, and restart
> `pnpm dev:cf`.

#### Requirements

`wrangler dev` reads `compatibility_flags = ["nodejs_compat"]`
from `wrangler.toml` — that flag is **required**, because the zfb
Cloudflare adapter uses `node:async_hooks` to thread `env` into SSR
routes.

#### D1 data lifecycle

The local SQLite DB lives under `.wrangler/state/v3/d1/...` and
persists across rebuilds and restarts of `pnpm dev:cf`. It resets
only if you delete `.wrangler/`, switch directories, or change
`database_name` in `wrangler.toml`. See the
[Cloudflare D1 lifecycle](#cloudflare-d1-lifecycle) section below
for the deploy-side picture.

## Cloudflare D1 lifecycle

`database_id` values in `wrangler.toml` are **not invented** — they are
produced by `wrangler d1 create` against the Cloudflare account that
owns this repo's `CLOUDFLARE_*` secrets.

- **Create once, migrate forever.** `wrangler d1 create` runs exactly
  once per database (done via the one-time `d1-bootstrap.yml` workflow,
  since `d1 create` needs the account credentials that only exist in
  CI). CI never re-creates — `deploy.yml` only runs migrations
  (`webshop` on push to main, `webshop-preview` on pull_request).
- **Preview vs production** get separate databases (`webshop` and
  `webshop-preview`) so a preview branch never mutates production data.
- Schema changes are new numbered files under `migrations/`.

## Deployment

This repo deploys to **Cloudflare Workers Static Assets** (migrated from
Cloudflare Pages advanced mode — see issue #23). `wrangler.toml` sets
`main = "./dist/_worker.js"` (the SSR Worker the zfb adapter emits) and an
`[assets]` block that serves the static build output (the compiled CSS)
alongside it. The adapter emits `dist/.assetsignore` so the Worker source
files are never exposed as public assets.

`.github/workflows/deploy.yml` is **event-aware**:

- **Push to `main` → production.** Installs deps, `pnpm build`, applies D1
  migrations to `webshop` (`wrangler d1 migrations apply webshop --remote`),
  then `wrangler deploy` — the production Worker `zfb-example-webshop`,
  reachable at `https://zfb-example-webshop.takazudo.workers.dev/`.
- **Pull request → isolated preview.** Same build, but migrates the
  **separate** `webshop-preview` D1 database
  (`wrangler d1 migrations apply webshop-preview --env preview --remote`)
  and deploys with `wrangler deploy --env preview` — a **separate** Worker
  `zfb-example-webshop-preview` bound to `webshop-preview`. Because a
  Workers named environment is its own Worker (unlike Pages' implicit
  per-branch previews), **a PR never touches the production Worker or its
  database**. A sticky PR comment links the preview URL.

Both deploys enable the Worker's `workers.dev` subdomain idempotently, so
the site is reachable without a custom domain.

> **Retiring the old Pages project.** The previous
> `https://zfb-example-webshop.pages.dev/` URL and its Cloudflare Pages
> project are no longer deployed to, but deleting the Pages project (and
> its preview branches) must be done manually in the Cloudflare dashboard
> — CI intentionally does not delete it.

## zfb upgrade procedure

In a Claude Code session, use the `l-handle-zfb-update` project skill
(`.claude/skills/l-handle-zfb-update/SKILL.md`) — it resolves the latest
`next` dist-tag, reviews every intermediate upstream release note BEFORE
bumping, bumps all three zfb packages in lockstep with exact pins, and
verifies with a clean build.

Manual fallback summary:

1. Bump the npm deps — set `@takazudo/zfb`, `@takazudo/zfb-runtime`,
   and `@takazudo/zfb-adapter-cloudflare` in `package.json` to the new
   version (all three on the SAME version) and run `pnpm install`.
2. Verify: `pnpm build && pnpm typecheck`, then commit and push.
   CI re-installs and re-deploys.

If the bump crosses a zfb release that changes `@takazudo/zfb-adapter-cloudflare`,
manually re-test the catalogue (`/`) and `/cart` after deploy — those SSR-D1
routes depend on the adapter's Worker binding thread.
