# Cloudflare setup — from zero to deployed

An ordered walkthrough for wiring this repo up to Cloudflare Workers +
D1. The [README's Deployment section](../README.md#deployment) explains
*how the deploy works*; this document is the *do-this-in-order* list.

> **This repo is already set up and live** at
> https://zfb-example-webshop.takazudo.workers.dev/. Steps 1 and 2 are
> done, the two D1 databases exist, and their `database_id` values are
> already committed in `wrangler.toml`. Read this as the **re-setup /
> token-rotation / new-fork** path — or jump straight to
> [step 5](#5-verify-the-live-site) to confirm the live site is healthy.

What you are provisioning:

| Piece            | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| Deploy target    | Cloudflare **Workers** (Static Assets), not Pages      |
| Production Worker| `zfb-example-webshop`                                  |
| Preview Worker   | `zfb-example-webshop-preview`                          |
| Databases        | D1 `webshop` (prod) + `webshop-preview` (PRs)          |
| Custom domain    | none — deploys to `*.workers.dev`                      |
| Worker secrets   | none                                                    |

## 1. Create (or reuse) the Cloudflare API token

All nine `zfb-example-*` repos share **one account-scoped token**. If you
already minted it for a sibling repo, reuse it and skip to step 2 — see
the family-wide guide:
[cloudflare-shared-token-and-env-setup.md](https://github.com/Takazudo/zfbex-tweaker/blob/main/docs/cloudflare-shared-token-and-env-setup.md).

To create one: Cloudflare dashboard → **My Profile → API Tokens →
Create Custom Token**, with exactly these permissions:

- **Workers Scripts** — Edit
- **D1** — Edit
- **Account Settings** — Read

Set **Account Resources → Include → (your account)**. **No Zone
permissions** are needed — this repo deploys to a `*.workers.dev` host,
not a custom domain.

Why each one: *Workers Scripts* covers `wrangler deploy`,
`wrangler versions upload`, and the `.../scripts/<name>/subdomain` API
calls the workflow makes; *D1* covers `d1 create` / `d1 list` /
`d1 migrations apply`; *Account Settings* lets wrangler resolve the
account the token belongs to.

You also need your **Account ID** — Cloudflare dashboard → Workers &
Pages → the ID shown in the right-hand sidebar.

## 2. Set the two GitHub Actions secrets

The workflows read exactly two secrets. There are **no Worker secrets**
(`wrangler secret put`) in this project.

```sh
gh secret set CLOUDFLARE_API_TOKEN  --repo Takazudo/zfb-example-webshop
gh secret set CLOUDFLARE_ACCOUNT_ID --repo Takazudo/zfb-example-webshop
```

Each prompts for the value on stdin. Confirm both landed:

```sh
gh secret list --repo Takazudo/zfb-example-webshop
```

Rotating the token is just re-running the first command — no code
change, no redeploy needed until the next push.

## 3. Provision D1 and apply the migrations

**Both databases already exist and their ids are committed**, so on this
repo you can normally skip ahead. You need this step only when the
databases were deleted, or when you are standing the project up on a
fresh Cloudflare account.

`wrangler d1 create` must run against the account that owns the
`CLOUDFLARE_*` secrets, which only exist in CI — hence the dedicated
`workflow_dispatch`-only workflow:

```sh
gh workflow run d1-bootstrap.yml --repo Takazudo/zfb-example-webshop --ref main
gh run watch <run-id>
```

It creates `webshop` and `webshop-preview` (tolerating "already
exists"), then reads the canonical UUIDs back via `wrangler d1 list` and
publishes them two ways: the run's **step summary**, and a downloadable
`d1-ids` artifact.

```sh
gh run download <run-id> -n d1-ids && cat d1-ids.json
```

If the ids differ from what is in `wrangler.toml`, paste the new ones in
and commit — `database_id` appears twice, under `[[d1_databases]]`
(`webshop`) and `[[env.preview.d1_databases]]` (`webshop-preview`).

**Migrations are applied by CI, not by this bootstrap workflow.** Every
`deploy.yml` run applies `migrations/*.sql` to the remote database
before deploying, and wrangler tracks what it already ran in a
`d1_migrations` table, so re-runs only apply new files:

```sh
# what CI runs on push to main
pnpm exec wrangler d1 migrations apply webshop --remote

# what CI runs on a pull request — note --env preview
pnpm exec wrangler d1 migrations apply webshop-preview --env preview --remote
```

Running either locally works too, provided `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are exported in your shell.

## 4. Trigger a deploy

`.github/workflows/deploy.yml` is event-aware — there is nothing to
click:

- **Push to `main` → production.** Builds, applies migrations to
  `webshop`, runs `wrangler deploy`, and idempotently enables the
  `workers.dev` subdomain on `zfb-example-webshop`.
- **Pull request → isolated per-PR preview.** Builds, applies migrations
  to the **separate** `webshop-preview` database, then runs
  `wrangler versions upload --env preview --preview-alias pr-<N>` and
  posts a sticky comment with the preview URL
  (`pr-<N>-zfb-example-webshop-preview.<subdomain>.workers.dev`). A PR
  never touches the production Worker or its database.

To re-deploy without a code change, re-run the last `main` run:

```sh
gh run list --repo Takazudo/zfb-example-webshop --workflow deploy.yml --limit 5
gh run rerun <run-id>
```

## 5. Verify the live site

The catalogue is server-rendered **from D1**, so a page that contains a
real product name proves the whole chain — Worker deployed, D1 bound,
migrations seeded:

```sh
BASE=https://zfb-example-webshop.takazudo.workers.dev

curl -s -o /dev/null -w '%{http_code}\n' "$BASE/"          # 200
curl -s "$BASE/" | grep -c 'Aeropress Go'                   # 1 → D1 is bound and seeded
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/assets/app.css"  # 200 → static assets serve
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/cart"       # 303 → SSR redirect to sign-in
```

`/cart` answering **303** rather than 200 is correct: the cart requires
a session, so an anonymous request is redirected. A `500` on `/` with a
200 on `/assets/app.css` is the signature of a deployed Worker whose D1
binding is broken — see below.

For a full manual pass, sign up at `/signup`, add a product from `/`,
then check out from `/cart`; the confirmation lands on `/order?id=<n>`.

## Troubleshooting

**`Couldn't find a D1 DB named "webshop-preview"`** — the
`--env preview` flag was omitted. `d1_databases` is *not* an inheritable
wrangler key, so the preview database only exists under
`[env.preview.d1_databases]`.

**`No such module "node:async_hooks"`** — `compatibility_flags =
["nodejs_compat"]` is missing from `wrangler.toml`. The zfb Cloudflare
adapter threads `env` into SSR routes via `AsyncLocalStorage`; without
the flag the Worker will not boot.

**API error code `10056`** — "already configured". Both subdomain-enabling
steps treat it as success; it is not a failure.

**The sticky PR comment stays "pending" / no preview URL** — the preview
Worker's subdomain has `previews_enabled: false`, or
`zfb-example-webshop-preview` does not exist yet. The "Enable preview
URLs" step sets both flags and runs *before* the upload, but it 404s
harmlessly on a Worker that has never been uploaded — re-run the job
once the Worker exists.

**`/` returns 500 while `/assets/app.css` returns 200** — the Worker is
live but its D1 binding is wrong. Check that `database_id` in
`wrangler.toml` matches the current `wrangler d1 list` output; a
recreated database gets a **new** UUID.

**Deploy fails on auth / "account not found"** — the token is missing
**Account Settings — Read**, `CLOUDFLARE_ACCOUNT_ID` is wrong, or the
token was rotated in Cloudflare but not in GitHub. Re-run step 2.

**Migrations "already applied" but the table is empty** — a fresh
database with a stale `d1_migrations` table cannot happen via CI, but a
manually recreated DB can be mid-state. Inspect with
`pnpm exec wrangler d1 execute webshop --remote --command 'SELECT COUNT(*) FROM products'`.

**Local `wrangler` fails with a compatibility-date error** — you are on
an old global wrangler. This repo pins wrangler as a devDependency; use
`pnpm exec wrangler` so the pinned version (whose bundled `workerd`
supports `compatibility_date = "2026-05-01"`) is the one that runs.
