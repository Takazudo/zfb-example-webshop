# zfb-example-webshop

A small, polished **webshop demo** built with
[zfb (zudo-front-builder)](https://github.com/Takazudo/zudo-front-builder)
— Tailwind v4 styling, server-side rendered routes, and a shopping cart
+ accounts backed by **Cloudflare D1**.

**Live:** https://zfb-example-webshop.pages.dev/

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
| Deploy         | Cloudflare Pages via `.github/workflows/deploy.yml`            |

Note: all routes are `prerender = false` (the catalogue reads live
prices from D1), so the build produces no static HTML pages — only the
SSR worker (`dist/_worker.js` + `dist/_zfb_inner.mjs`) and the compiled
CSS asset. The order confirmation page is `/order?id=<n>` (a query
string, not a `/order/:id` path param) because zfb dynamic route
segments require a build-time `paths()` enumeration, and order ids are
created at runtime.

## Sibling layout

This is a **standalone** repo. The zfb packages (`@takazudo/zfb`,
`@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) are normal
npm registry dependencies — no `file:` links. A sibling checkout of the
`zfb` framework repo is only used to build the `zfb` CLI from source at
a pinned SHA (the same thing CI does):

```
~/repos/zfb-ex/
  zfb/                    <- the zfb framework repo (pinned SHA, CLI source)
  zfb-example-webshop/    <- this repo
```

`framework-pins.json` records the exact zfb commit the CLI source build
uses. Day-to-day builds run the npm-shipped `zfb` binary from
`node_modules/.bin`.

## Local development

### Fresh checkout

```sh
git clone https://github.com/Takazudo/zfb-example-webshop.git
cd zfb-example-webshop
pnpm setup:upstream      # clones + builds the zfb sibling at the pinned SHA
```

`pnpm setup:upstream` clones the `zfb` sibling at the pinned SHA, builds
the `zfb` CLI, installs dependencies, and runs `pnpm build` to verify.

### Day-to-day

```sh
pnpm build               # zfb build → dist/_worker.js + dist/_zfb_inner.mjs
pnpm typecheck           # zfb check (tsc --noEmit)
```

### Running the cart locally against a local D1

The cart and accounts read `env.DB`, so they need a real Worker
binding. `zfb dev` does **not** provide one — use the
`wrangler pages dev`-based loop below for any work that touches D1.

#### One-time setup

```sh
pnpm install                                   # picks up concurrently + chokidar-cli devDeps
wrangler d1 migrations apply webshop --local   # creates .wrangler/ if needed
```

#### Day-to-day edit-refresh loop

```sh
pnpm dev:cf
```

That single command applies migrations, runs an initial `pnpm build`,
then starts two processes side-by-side via `concurrently`:

- `wrangler pages dev dist/ --port 8788` — serves the built worker
  against the local D1, auto-reloads when `dist/` changes.
- `chokidar` — watches `pages/`, `components/`, `layouts/`, `lib/`,
  `styles/`; re-runs `pnpm build` on save (200ms debounce).

Edit-to-browser latency is roughly 1–2 seconds. Ctrl-C kills both
processes cleanly.

> **Do NOT run `pnpm dev` and `pnpm dev:cf` at the same time.**
> `pnpm dev`'s `predev` step (`rm -rf dist .zfb .zfb-build`) wipes the
> `dist/` directory that `wrangler pages dev` is actively serving,
> putting wrangler into a degraded state where rebuilds stop
> triggering reloads. Pick one loop at a time. If you accidentally
> ran both, stop everything, run `pnpm build`, and restart
> `pnpm dev:cf`.

#### Requirements

`wrangler pages dev` reads `compatibility_flags = ["nodejs_compat"]`
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
  CI). CI never re-creates — `deploy.yml` only runs
  `wrangler d1 migrations apply webshop --remote`.
- **Preview vs production** get separate databases (`webshop` and
  `webshop-preview`) so a preview branch never mutates production data.
- Schema changes are new numbered files under `migrations/`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which:

1. clones the `zfb` sibling inline at the pinned SHA and builds the CLI,
2. runs `pnpm build`,
3. applies D1 migrations to the remote database
   (`wrangler d1 migrations apply webshop --remote`),
4. deploys `dist/` to the `zfb-example-webshop` Cloudflare Pages
   project.

## zfb upgrade procedure

Two things move together when bumping zfb:

1. Bump the npm deps — set `@takazudo/zfb`, `@takazudo/zfb-runtime`,
   and `@takazudo/zfb-adapter-cloudflare` in `package.json` to the new
   version and run `pnpm install`.
2. Edit `framework-pins.json` — set `zfb.sha` to the matching zfb
   `main` commit SHA (find it with
   `git -C ../zfb log --first-parent --oneline main | head`).
3. Verify: `pnpm build && pnpm typecheck`, then commit and push.
   CI re-clones zfb at the new SHA and re-deploys.

If the bump crosses a zfb release that changes `@takazudo/zfb-adapter-cloudflare`,
manually re-test the catalogue (`/`) and `/cart` after deploy — those SSR-D1
routes depend on the adapter's Worker binding thread.
