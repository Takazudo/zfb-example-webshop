---
name: l-handle-zfb-update
description: >-
  Update the zfb upstream dependencies (@takazudo/zfb +
  @takazudo/zfb-adapter-cloudflare + @takazudo/zfb-runtime) to the latest
  "next" dist-tag release, review the upstream changes between versions, and
  adapt this project's code if needed. Use when: (1) User says 'update zfb',
  'bump zfb', 'zfb update', or 'handle zfb update', (2) A new zfb next release
  is out and this example webshop should track it.
user-invocable: true
argument-hint: "[target-version, e.g. 0.1.0-next.42 — omit to use latest next]"
---

# Handle zfb Update

Update `@takazudo/zfb`, `@takazudo/zfb-adapter-cloudflare`, and
`@takazudo/zfb-runtime` to the latest `next` prerelease, check what changed
upstream, and adapt this project's code when an upstream change touches a
feature this webshop actually uses.

Upstream repo: `Takazudo/zudo-front-builder` (monorepo; the npm packages live
under `packages/`). Every release has a `v<version>` tag and a GitHub release
with detailed notes.

## Step 0: Preconditions

`package.json` and `pnpm-lock.yaml` must be clean (`git status --short` shows
neither). If either has uncommitted changes, stop and ask the user before
touching them.

## Step 1: Resolve current and target versions

```bash
CURRENT=$(node -p "require('./package.json').dependencies['@takazudo/zfb']")
TARGET=$(npm view @takazudo/zfb dist-tags.next)
```

- First assert the three zfb deps in `package.json` are **lockstep and
  exact-pinned** — `@takazudo/zfb`, `@takazudo/zfb-adapter-cloudflare`, and
  `@takazudo/zfb-runtime` must all read the same bare version (no `^`/`~`).
  If they disagree, something earlier went wrong — stop and ask the user.
- **Always resolve the target from the `next` dist-tag, never `latest`** —
  this project tracks the zfb prerelease line. The two tags may be equal
  today, but when they diverge, `next` is the one to follow.
- If the user passed a version argument, use it as `TARGET` instead.
- Verify `TARGET` exists for **all three** packages:
  `npm view "@takazudo/zfb@$TARGET" version`,
  `npm view "@takazudo/zfb-adapter-cloudflare@$TARGET" version`, and
  `npm view "@takazudo/zfb-runtime@$TARGET" version`. **If the adapter or
  runtime lacks `TARGET`, STOP and ask the user — never bump zfb ahead of
  its adapter.** A zfb/adapter version skew breaks the `dist/_worker.js`
  emission contract that every SSR route here depends on.
- **If `CURRENT` equals `TARGET`: report "already at the latest next
  (<version>)" and STOP.**
- **If `TARGET` is older than `CURRENT`** (possible with an explicit version
  argument): that is a downgrade — stop and ask the user to confirm before
  proceeding. The enumeration step below detects this case.

## Step 2: Review upstream changes BEFORE bumping

Enumerate every version between `CURRENT` (exclusive) and `TARGET` (inclusive)
from npm's publish-ordered version list — do NOT sort version strings
lexically; prerelease numbers like `next.9` vs `next.10` sort wrong as text:

```bash
node -e '
const vs = JSON.parse(process.argv[1]);
const cur = vs.indexOf(process.argv[2]), tgt = vs.indexOf(process.argv[3]);
if (tgt < 0) { console.error("target not found"); process.exit(1); }
if (cur >= 0 && tgt <= cur) { console.error("target is not newer than current — downgrade or same"); process.exit(1); }
console.log(vs.slice(cur + 1, tgt + 1).join("\n"));
' "$(npm view @takazudo/zfb versions --json)" "$CURRENT" "$TARGET"
```

Read the release notes for EVERY enumerated version, not just the target's:

```bash
gh release view "v<version>" --repo Takazudo/zudo-front-builder --json body -q '.body'
```

If a release has no notes, fall back to the commit list:

```bash
gh api "repos/Takazudo/zudo-front-builder/compare/v<prev>...v<version>" \
  --jq '.commits[].commit.message' | head -40
```

(Both commands target the upstream repo explicitly — never drop the
`--repo` / full-path argument or gh falls back to this demo repo.)

**Fail closed:** if the upstream changes cannot be reviewed at all (gh
unauthenticated/rate-limited AND no readable release notes), stop and ask the
user — never bump blind.

Flag anything that touches a surface this project uses:

| Upstream surface | Where this project uses it |
| --- | --- |
| `defineConfig` schema (`@takazudo/zfb/config`) | `zfb.config.ts` — `framework: "preact"`, `base`, `tailwind.enabled`, `adapter`. No `collections`: the catalogue lives in D1 |
| Cloudflare adapter (`@takazudo/zfb-adapter-cloudflare`) | `getCloudflareContext<Env>()` imported by every page under `pages/`; emits `dist/_worker.js` + `dist/_zfb_inner.mjs`; `wrangler.toml` contract (`nodejs_compat`, `pages_build_output_dir`, `DB` binding → `env.DB`) |
| SSR page contract (`prerender = false`, required `frontmatter` export, pages returning `Response`) | every file under `pages/` (all routes are SSR); `lib/render.ts` (`htmlResponse`) |
| Islands runtime (`@takazudo/zfb-runtime`) | not used — no islands in this project. Keep the package version-locked with zfb anyway |
| Tailwind / CSS pipeline | `styles/global.css` (Tailwind v4 `@theme`); emitted `dist/assets/styles-<hash>.css`; `scripts/stable-css.mjs` asserts exactly ONE `styles-*.css` and copies it to `assets/app.css`; `layouts/shop-layout.tsx` hard-codes `/assets/app.css` as the consumer |
| CLI commands (`zfb dev/build/preview/check`) | `package.json` scripts (`dev`, `build`, `preview`, `typecheck`, `dev:cf`) |
| Documented behavior (commands, build output shape) | `README.md` hard-codes the command table, the "no static HTML, only a worker" architecture description, and the upgrade procedure |

Content collections, pagination, dynamic routes (`paths()` /
`getStaticProps()`), and the Markdown/MDX pipeline are **not used** in this
project — upstream changes there need no action.

**Rule: adapt only if this project actually uses the changed feature.**
Internal zfb changes (Rust internals, docs, frameworks other than preact) need
no action — note them in the report and move on.

## Step 3: Bump all three packages

```bash
pnpm add -E "@takazudo/zfb@$TARGET" "@takazudo/zfb-adapter-cloudflare@$TARGET" "@takazudo/zfb-runtime@$TARGET"
```

- `-E` keeps the repo's **exact pin, no caret** convention — this repo
  deliberately moved off `^` pins so the example tracks one known-good zfb
  version; keep it that way.
- All three packages must land on the **same** version.
- Commit `package.json` AND `pnpm-lock.yaml` together — CI installs with
  `pnpm install --frozen-lockfile` and fails on a stale lockfile.
- pnpm is the package manager here — npm is only for reading registry
  metadata in Steps 1-2.

## Step 4: Adapt project code (if Step 2 flagged anything)

Apply whatever the flagged release notes require — config schema migrations,
renamed/changed APIs, adapter context changes, changed CSS emission, etc.
Update `README.md` if commands or the build output shape changed. If nothing
was flagged, skip this step.

If the bump crosses a release that changes
`@takazudo/zfb-adapter-cloudflare`, plan to manually re-test the catalogue
(`/`) and `/cart` after deploy — those SSR-D1 routes depend on the adapter's
Worker binding thread (this caveat is also in `README.md`).

## Step 5: Verify

Clean generated output first so a stale `dist/` cannot mask failures, then
build:

```bash
rm -rf ./dist ./.zfb ./.zfb-build
pnpm build       # zfb build && node scripts/stable-css.mjs
pnpm typecheck   # zfb check (tsc --noEmit) passes
```

`pnpm build` is two steps: `zfb build`, then `scripts/stable-css.mjs`, which
exits 1 unless `dist/assets/` contains exactly one `styles-*.css`. An
upstream CSS-emission change (renamed prefix, code-split CSS, zfb starting to
inject the stylesheet link into SSR output) therefore surfaces as a
**stable-css error, not a zfb error** — map that failure back upstream
instead of debugging the script.

Then inspect `dist/`:

- `dist/_worker.js` and `dist/_zfb_inner.mjs` emitted (this shop is 100% SSR
  — the build must produce NO static HTML pages)
- exactly one `dist/assets/styles-*.css`, copied to `dist/assets/app.css`
  (the path `layouts/shop-layout.tsx` links)
- No stranded `zfb-tailwind-entry-*.css` temp files

Optional but recommended — D1-backed smoke test. Use `pnpm dev:cf` (NOT
`pnpm dev`): every route here reads `env.DB`, and only the wrangler loop
provides the binding. It applies local D1 migrations, builds, and serves the
worker on port 8788:

```bash
pnpm dev:cf   # then: / and /login return 200; unauthenticated /cart returns 303 → /login
```

Never run `pnpm dev` and `pnpm dev:cf` at the same time — `pnpm dev`'s
`predev` step wipes the `dist/` that `wrangler pages dev` is actively
serving (see `README.md`).

If verification fails, map the failure back to the release notes from Step 2 —
it usually points at an upstream change that needs a project-side adaptation
(return to Step 4).

## Step 6: Report

Summarize for the user:

- Versions traversed (e.g. `next.31 → next.35`)
- Notable upstream changes per release (one line each)
- Adaptations made to project code (or "none needed")
- Verification results (build output inspection, typecheck, smoke test)
