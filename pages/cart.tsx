import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import ShopLayout from "../layouts/shop-layout";
import { getUser } from "../lib/auth";
import { addToCart, getCart, removeFromCart } from "../lib/shop";
import { formatPrice } from "../lib/format";
import { htmlResponse, redirect } from "../lib/render";
import type { Env } from "../lib/env";
import type { CartLine, User } from "../lib/types";

export const frontmatter = { title: "Your cart" };
export const prerender = false;

/** Render the cart page for a signed-in user. */
function cartPage(user: User, lines: CartLine[]): Response {
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((sum, l) => sum + l.price_cents * l.quantity, 0);

  return htmlResponse(
    <ShopLayout title="Your cart" user={user} cartCount={itemCount} activePath="/cart">
      <section class="mx-auto flex max-w-[44rem] flex-col gap-vsp-md">
        <h1 class="text-title font-bold text-ink">Your cart</h1>

        {lines.length === 0 ? (
          <div class="flex flex-col items-center gap-vsp-sm rounded-lg border border-line bg-surface px-hsp-lg py-vsp-xl text-center">
            <p class="text-body text-ink-soft">Your cart is empty.</p>
            <a
              href="/"
              class="rounded-md bg-brand px-hsp-md py-vsp-xs text-small font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              Browse the shop
            </a>
          </div>
        ) : (
          <>
            <ul class="flex flex-col gap-vsp-xs">
              {lines.map((line) => (
                <li
                  key={line.product_id}
                  class="flex items-center gap-hsp-md rounded-lg border border-line bg-surface p-hsp-md shadow-card"
                >
                  <span
                    role="img"
                    aria-label={line.name}
                    class="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-[1.75rem]"
                  >
                    {line.emoji}
                  </span>
                  <div class="flex flex-1 flex-col gap-vsp-2xs">
                    <span class="text-body font-semibold text-ink">{line.name}</span>
                    <span class="text-small text-ink-soft tabular-nums">
                      {formatPrice(line.price_cents)} × {line.quantity}
                    </span>
                  </div>
                  <span class="text-body font-bold tabular-nums text-ink">
                    {formatPrice(line.price_cents * line.quantity)}
                  </span>
                  <form method="post" action="/cart">
                    <input type="hidden" name="op" value="remove" />
                    <input type="hidden" name="product_id" value={line.product_id} />
                    <button
                      type="submit"
                      class="cursor-pointer rounded-sm px-hsp-xs py-vsp-2xs text-small text-ink-soft transition-colors hover:text-danger"
                      aria-label={`Remove ${line.name}`}
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>

            <div class="flex flex-col gap-vsp-sm rounded-lg border border-line bg-surface p-hsp-md shadow-card">
              <div class="flex items-center justify-between text-body">
                <span class="text-ink-soft">
                  Subtotal · {itemCount} item{itemCount === 1 ? "" : "s"}
                </span>
                <span class="text-heading font-bold tabular-nums text-ink">
                  {formatPrice(total)}
                </span>
              </div>
              <form method="post" action="/checkout">
                <button
                  type="submit"
                  class="w-full cursor-pointer rounded-md bg-success px-hsp-md py-vsp-sm text-body font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Place order
                </button>
              </form>
              <p class="text-center text-micro text-ink-soft">
                Demo checkout — no payment is taken. Placing the order empties your cart and shows
                a confirmation.
              </p>
            </div>
          </>
        )}
      </section>
    </ShopLayout>,
  );
}

/**
 * Cart route.
 *
 * - GET  → render the cart.
 * - POST with `op=remove` → drop a line, redirect back to /cart.
 * - POST otherwise (the catalogue "Add to cart" form) → add a product,
 *   redirect to /cart.
 *
 * All branches require a signed-in user; an anonymous visitor is sent
 * to /login.
 */
export default async function CartPage(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();

  const user = await getUser(env, request);
  if (!user) return redirect("/login");

  if (request.method === "POST") {
    const form = await request.formData();
    const productId = Number(form.get("product_id"));
    if (Number.isInteger(productId) && productId > 0) {
      if (form.get("op") === "remove") {
        await removeFromCart(env, user.id, productId);
      } else {
        await addToCart(env, user.id, productId);
      }
    }
    return redirect("/cart");
  }

  const lines = await getCart(env, user.id);
  return cartPage(user, lines);
}
