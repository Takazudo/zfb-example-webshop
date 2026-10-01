import type { Product } from "../lib/types";
import { formatPrice } from "../lib/format";

/**
 * One product in the catalogue grid.
 *
 * "Add to cart" is a plain `<form method="post">` that posts the
 * product id to `/cart` — no client JavaScript. When the visitor is
 * not signed in the catalogue passes `signedIn={false}` and the card
 * shows a "Sign in to buy" link instead.
 */
export function ProductCard({ product, signedIn }: { product: Product; signedIn: boolean }) {
  return (
    <article class="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card transition-shadow hover:shadow-raised">
      <div class="flex aspect-4/3 items-center justify-center bg-surface-sunken text-[4rem]">
        <span role="img" aria-label={product.name}>
          {product.emoji}
        </span>
      </div>
      <div class="flex flex-1 flex-col gap-vsp-xs p-hsp-md">
        <span class="text-micro font-semibold uppercase tracking-wide text-brand">
          {product.category}
        </span>
        <h3 class="text-heading font-semibold text-ink">{product.name}</h3>
        <p class="flex-1 text-small text-ink-soft">{product.description}</p>
        <div class="mt-vsp-xs flex items-center justify-between gap-hsp-sm">
          <span class="text-heading font-bold tabular-nums text-ink">
            {formatPrice(product.price_cents)}
          </span>
          {signedIn ? (
            <form method="post" action="/cart">
              <input type="hidden" name="product_id" value={product.id} />
              <button
                type="submit"
                class="cursor-pointer rounded-md bg-brand px-hsp-md py-vsp-xs text-small font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                Add to cart
              </button>
            </form>
          ) : (
            <a
              href="/login"
              class="rounded-md border border-line px-hsp-md py-vsp-xs text-small font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              Sign in to buy
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
