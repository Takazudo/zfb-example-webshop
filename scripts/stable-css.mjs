#!/usr/bin/env node
/**
 * scripts/stable-css.mjs — postbuild step.
 *
 * zfb emits the page-wide stylesheet as `dist/assets/styles-<hash>.css`
 * and injects a `<link rel="stylesheet">` for it ONLY into statically
 * generated (SSG) HTML, as a build-time post-process. This shop is
 * 100% SSR (`prerender = false` everywhere — the catalogue reads live
 * prices from D1), so no SSG HTML exists and nothing injects the link.
 *
 * The SSR layout therefore links a STABLE path — `/assets/app.css` —
 * and this script copies the hashed build output to that fixed name so
 * the path the layout hard-codes always resolves. The original hashed
 * file is left in place (long-term-cacheable); the stable copy is just
 * the handle the SSR layout needs.
 */

import { copyFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(repoRoot, "dist", "assets");

const cssFiles = readdirSync(assetsDir).filter(
  (name) => name.startsWith("styles-") && name.endsWith(".css"),
);

if (cssFiles.length !== 1) {
  console.error(
    `[stable-css] expected exactly one dist/assets/styles-*.css, found ${cssFiles.length}: ${cssFiles.join(", ")}`,
  );
  process.exit(1);
}

const src = join(assetsDir, cssFiles[0]);
const dest = join(assetsDir, "app.css");
copyFileSync(src, dest);
console.log(`[stable-css] ${cssFiles[0]} -> assets/app.css`);
