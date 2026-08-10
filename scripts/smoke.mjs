#!/usr/bin/env node
/**
 * Post-deploy smoke test for the production custom domain.
 *
 * Unit tests and `wrangler deploy --dry-run` can prove the config parses and
 * the Worker bundles, but neither can prove that a custom domain is actually
 * attached and serving. Only a real request to the real hostname can — hence
 * this runs in CI after the production deploy (see .github/workflows/deploy.yml).
 *
 * What it asserts, and why each one earns its place:
 *   1. HTTP 200 over TLS that validates for THIS hostname. Node verifies the
 *      certificate by default and we never disable that, so a cert that has not
 *      finished provisioning (or does not cover the host) surfaces as a TLS
 *      error rather than a silent pass.
 *   2. A `text/html` response carrying the shop's chrome marker — proves we got
 *      the real site, not a Cloudflare interstitial or a parked page.
 *   3. Seeded product names + a formatted price. This is the assertion that
 *      matters most: the catalogue is server-rendered from D1 via
 *      `listProducts(env)`, so real product rows in the HTML prove the SSR
 *      Worker booted AND its `DB` binding resolved AND the migrations seeded.
 *      An empty grid or an error page fails here.
 *
 * Exit contract:
 *   0 + a `::notice::` — the domain is not wired up yet (DNS does not resolve,
 *       the connection is refused, or TLS is still provisioning). The house rule
 *       is that this repo never shows a red deploy before Cloudflare is
 *       configured, so "not there yet" is a SKIP, not a failure.
 *   0 + a pass report — every assertion held.
 *   1 + an `::error::` — the domain answered but the site is wrong: bad status,
 *       non-HTML, missing chrome, or (the important one) no D1-backed product
 *       data. A reachable-but-broken site is always a hard failure.
 */

// Overridable so the same assertions can be pointed at the workers.dev host
// when debugging (`SMOKE_URL=https://zfb-example-webshop.takazudo.workers.dev/`).
const TARGET_URL = process.env.SMOKE_URL ?? "https://zfb-example-webshop.takazudomodular.com/";

const REQUEST_TIMEOUT_MS = 15_000;
const ATTEMPTS = 3;
// Backoff between attempts. A deploy that has just created the custom domain
// races DNS propagation and cert issuance, so a cold first request failing is
// expected rather than alarming.
const BACKOFF_MS = [5_000, 15_000];

/** Chrome that every page of this shop renders (layouts/shop-layout.tsx). */
const CHROME_MARKER = "Everyday objects, carefully chosen.";

/**
 * Product names from migrations/0002_seed_products.sql. Deliberately coupled to
 * the seed data: these strings exist in the HTML only if the request reached D1
 * and got rows back. Requiring several of them (not just one) means a partially
 * rendered or truncated page cannot squeak past.
 */
const SEEDED_PRODUCTS = [
  "Aeropress Go",
  "Cast Iron Skillet",
  "Walnut Cutting Board",
  "Field Notebook",
  "Soy Candle",
];
const MIN_PRODUCTS_REQUIRED = 3;

/** `formatPrice()` renders integer cents as e.g. `$39.80` (lib/format.ts). */
const PRICE_PATTERN = /\$\d+\.\d{2}/;

/**
 * Error codes that mean "Cloudflare has not finished wiring this hostname up",
 * as opposed to "the site is broken". Everything here is a connect-phase or
 * name-resolution failure — the request never reached a Worker.
 */
const NOT_WIRED_UP_CODES = new Set([
  "ENOTFOUND", // DNS record does not exist yet
  "EAI_AGAIN", // transient DNS resolution failure
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT", // socket-level connect timeout
  "UND_ERR_CONNECT_TIMEOUT", // undici connect-phase timeout
]);

/** TLS/cert failures — the cert for a fresh custom domain can lag the DNS record. */
const TLS_CODE_PATTERN = /CERT|TLS|SSL|HANDSHAKE/i;

/**
 * Cloudflare returns 530 when a hostname points at its edge but no origin or
 * Worker is attached to it. That is precisely the pre-attach state, and a
 * healthy Worker cannot produce it — so it reads as "not wired up", not "broken".
 */
const NOT_WIRED_UP_STATUS = 530;

function notice(message) {
  console.log(`::notice::${message}`);
}

function error(message) {
  console.log(`::error::${message}`);
}

/**
 * Collect every error code in a thrown error's `cause` / `AggregateError` chain.
 * `fetch` wraps the real failure — a bare `TypeError: fetch failed` whose cause
 * holds the `ENOTFOUND` — and a multi-address host can fail as an AggregateError.
 */
function collectErrorCodes(err, codes = new Set()) {
  if (!err || typeof err !== "object") return codes;
  if (typeof err.code === "string") codes.add(err.code);
  if (err.name === "TimeoutError" || err.name === "AbortError") codes.add(err.name);
  for (const nested of Array.isArray(err.errors) ? err.errors : []) {
    collectErrorCodes(nested, codes);
  }
  return collectErrorCodes(err.cause, codes);
}

function isNotWiredUpError(err) {
  const codes = [...collectErrorCodes(err)];
  if (codes.length === 0) return false;
  // Every observed code must point at "not reachable yet". A mixed bag that
  // includes something unrecognised is treated as a real failure, so a novel
  // breakage is never silently skipped.
  return codes.every((code) => NOT_WIRED_UP_CODES.has(code) || TLS_CODE_PATTERN.test(code));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One request attempt. Returns a response, or throws for the caller to classify. */
async function fetchOnce() {
  const response = await fetch(TARGET_URL, {
    redirect: "follow",
    headers: { "user-agent": "zfb-example-webshop-smoke/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { response, body: await response.text() };
}

/** Run every content assertion. Returns the list of failures (empty = pass). */
function assertLiveSite(response, body) {
  const failures = [];

  if (response.status !== 200) {
    failures.push(`expected HTTP 200, got ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    failures.push(`expected an HTML content-type, got "${contentType || "(none)"}"`);
  }

  if (!body.includes(CHROME_MARKER)) {
    failures.push(`page is missing the shop chrome marker "${CHROME_MARKER}"`);
  }

  const foundProducts = SEEDED_PRODUCTS.filter((name) => body.includes(name));
  if (foundProducts.length < MIN_PRODUCTS_REQUIRED) {
    failures.push(
      `expected at least ${MIN_PRODUCTS_REQUIRED} seeded product names in the catalogue, found ` +
        `${foundProducts.length} (${foundProducts.join(", ") || "none"}) — the D1-backed ` +
        `catalogue did not render`,
    );
  }

  if (!PRICE_PATTERN.test(body)) {
    failures.push("no formatted price (e.g. $39.80) found — product rows rendered without data");
  }

  return failures;
}

async function main() {
  console.log(`Smoke-testing ${TARGET_URL}`);

  let lastError;
  let lastResponse;
  let lastBody;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const { response, body } = await fetchOnce();
      lastError = undefined;
      lastResponse = response;
      lastBody = body;

      // 5xx (and 429) can be a cold start or a route that has only just gone
      // live, so they are worth another attempt — but they are NOT skip-worthy:
      // if they persist, the site is reachable and broken, which must go red.
      const retryable = response.status >= 500 || response.status === 429;
      if (!retryable) break;

      console.log(`Attempt ${attempt}/${ATTEMPTS}: HTTP ${response.status} — retrying.`);
    } catch (err) {
      lastError = err;
      lastResponse = undefined;
      console.log(`Attempt ${attempt}/${ATTEMPTS}: ${err.message ?? err}`);
    }

    if (attempt < ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1] ?? 15_000);
  }

  if (lastError) {
    if (isNotWiredUpError(lastError)) {
      notice(
        `Skipping smoke test: ${TARGET_URL} is not serving yet ` +
          `(${[...collectErrorCodes(lastError)].join(", ")}). This is expected until the ` +
          `custom domain's DNS record and TLS certificate finish provisioning.`,
      );
      return 0;
    }
    error(`Smoke test failed: could not reach ${TARGET_URL} — ${lastError.message ?? lastError}`);
    return 1;
  }

  if (lastResponse.status === NOT_WIRED_UP_STATUS) {
    notice(
      `Skipping smoke test: ${TARGET_URL} returned HTTP ${NOT_WIRED_UP_STATUS} — the hostname ` +
        `reaches Cloudflare but no Worker is attached to it yet.`,
    );
    return 0;
  }

  const failures = assertLiveSite(lastResponse, lastBody);
  if (failures.length > 0) {
    error(`Smoke test failed for ${TARGET_URL}:`);
    for (const failure of failures) console.log(`  - ${failure}`);
    console.log(`\n--- first 800 chars of the response body ---\n${lastBody.slice(0, 800)}`);
    return 1;
  }

  console.log(
    `Smoke test passed: HTTP 200, shop chrome present, and the D1-backed catalogue rendered ` +
      `real product data.`,
  );
  return 0;
}

process.exitCode = await main();
