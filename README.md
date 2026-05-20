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
string, not a `/order/:id` path param) because the pinned zfb release
only expands dynamic route segments for static generation.

## Sibling layout

This is a **standalone** repo that depends on the `zfb` framework repo
checked out next to it via `file:../zfb/...` dependencies:

```
~/repos/zfb-ex/
  zfb/                    <- the zfb framework repo (pinned SHA)
  zfb-example-webshop/    <- this repo
```

`framework-pins.json` records the exact zfb commit this repo builds
against.

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

`zfb dev` serves pages, but the cart needs the D1 binding, so run the
built worker under `wrangler`:

```sh
# 1. Apply migrations to a local SQLite D1 (creates .wrangler/)
wrangler d1 migrations apply webshop --local

# 2. Build, then serve the worker against the local D1
pnpm build
wrangler pages dev dist/
```

`wrangler pages dev` reads `compatibility_flags = ["nodejs_compat"]`
from `wrangler.toml` — that flag is **required**, because the zfb
Cloudflare adapter uses `node:async_hooks` to thread `env` into SSR
routes. Then exercise sign up → add to cart → checkout in the browser.

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

## Post-merge pin-bump procedure

This repo's `framework-pins.json` currently pins the zfb
`base/demo-separation` branch HEAD
(`1a01628843286354c676813d8b63a52feb01cff8`).

After the zfb epic PR **#319** merges `base/demo-separation` into `main`
in the zfb repo, `base/demo-separation` becomes a dead branch and may be
deleted — at which point demo CI's `git checkout <sha>` would still work
(the SHA is preserved by the merge) but the durable, canonical ref is
`main`. Bump the pin:

1. In the zfb repo, find the **`main` merge commit SHA** of PR #319:
   ```sh
   git -C ../zfb log --first-parent --oneline main | head
   ```
2. Edit `framework-pins.json` in this repo — set `zfb.sha` to that merge
   commit SHA.
3. Commit (`chore: bump zfb pin to the post-merge main SHA`) and push.
   CI re-clones zfb at the new SHA and re-deploys.

If the bump crosses a zfb release that changes `@takazudo/zfb-adapter-cloudflare`,
manually re-test `/catalogue` and `/cart` after deploy — those SSR-D1 routes depend
on the adapter's Worker binding thread.

S8 of the Demo Separation epic verifies and finalizes this bump.
