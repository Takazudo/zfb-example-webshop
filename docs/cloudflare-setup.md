# Cloudflare setup — from zero to deployed

An ordered walkthrough for wiring this repo up to Cloudflare Workers +
D1. The [README's Deployment section](../README.md#deployment) explains
*how the deploy works*; this document is the *do-this-in-order* list.

> **This repo is already set up and live** at
> https://zfb-example-webshop.takazudomodular.com/. Steps 1 and 2 are
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
| Custom domain    | `zfb-example-webshop.takazudomodular.com` (production) |
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
- **Workers Routes** — Edit _(Zone-level)_

Set **Account Resources → Include → (your account)**, and for the
Zone-level permission **Zone Resources → Include →
takazudomodular.com**.

Why each one: *Workers Scripts* covers `wrangler deploy`,
`wrangler versions upload`, and the `.../scripts/<name>/subdomain` API
calls the workflow makes; *D1* covers `d1 create` / `d1 list` /
`d1 migrations apply`; *Account Settings* lets wrangler resolve the
account the token belongs to; *Workers Routes* is what lets
`wrangler deploy` create the `[[routes]]` custom domain
`zfb-example-webshop.takazudomodular.com`.

> **A token without Workers Routes fails late, not early.** The Worker
> bundle uploads fine and only the route step errors, so the deploy goes
> red with the site apparently working on `*.workers.dev`. If you see
> that, the token is missing the Zone permission — it is not a config
> problem.

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
  `webshop`, runs `wrangler deploy` (which also attaches the
  `zfb-example-webshop.takazudomodular.com` custom domain), idempotently
  enables the `workers.dev` subdomain on `zfb-example-webshop`, and then
  runs `scripts/smoke.mjs` against the custom domain. The smoke test
  exits 0 with a `::notice::` while the domain is still provisioning, so
  a not-yet-live domain never reddens the deploy — but a domain that
  answers with the wrong content does.
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
migrations seeded.

CI already checks exactly that on every push to `main`; the assertions
live in `scripts/smoke.mjs`, which you can also run by hand:

```sh
node scripts/smoke.mjs
# or against the workers.dev host while the custom domain provisions:
SMOKE_URL=https://zfb-example-webshop.takazudo.workers.dev/ node scripts/smoke.mjs
```

To poke at it manually instead:

```sh
BASE=https://zfb-example-webshop.takazudomodular.com

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

**Deploy uploads the Worker, then fails creating the route** — the token
lacks **Workers Routes — Edit** on the `takazudomodular.com` zone. Add
it in step 1 and re-run the deploy; no code change is needed, the
`[[routes]]` block in `wrangler.toml` is already correct.

**The smoke step says "not serving yet" and passes anyway** — that is by
design. `scripts/smoke.mjs` treats DNS / connection / TLS failures as
"Cloudflare has not finished wiring the hostname up" and exits 0 with a
`::notice::`, because a not-yet-provisioned domain is not a code defect.
Once the route exists and the certificate is issued the same run turns
into a real assertion; a domain that answers with the wrong content (or
a catalogue missing its D1 rows) fails the step.

**A PR preview took over the custom domain** — `routes` is an
inheritable wrangler key, so `[env.preview]` must keep its explicit
`routes = []`. Delete that line and wrangler warns "deploying this
environment will reassign these custom domains away from the top-level
Worker" — which is exactly what it then does.

**Migrations "already applied" but the table is empty** — a fresh
database with a stale `d1_migrations` table cannot happen via CI, but a
manually recreated DB can be mid-state. Inspect with
`pnpm exec wrangler d1 execute webshop --remote --command 'SELECT COUNT(*) FROM products'`.

**Local `wrangler` fails with a compatibility-date error** — you are on
an old global wrangler. This repo pins wrangler as a devDependency; use
`pnpm exec wrangler` so the pinned version (whose bundled `workerd`
supports `compatibility_date = "2026-05-01"`) is the one that runs.
