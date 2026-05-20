import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import ShopLayout from "../layouts/shop-layout";
import { getUser } from "../lib/auth";
import { getCartCount, getOrder } from "../lib/shop";
import { formatPrice } from "../lib/format";
import { htmlResponse, redirect } from "../lib/render";
import type { Env } from "../lib/env";

export const frontmatter = { title: "Order confirmation" };
export const prerender = false;

/**
 * Order confirmation page — `/order?id=<n>`.
 *
 * A query-string id (not a `/order/:id` path param) is deliberate: at
 * the pinned zfb SHA, dynamic route segments (`[id].tsx`) are only
 * expanded for SSG via `paths()` and never reach the SSR worker, so a
 * `prerender = false` route must be a static path.
 *
 * Reached via the post-checkout redirect, but also durable as a
 * receipt — it loads the order fresh from D1 and is scoped to the
 * owning user (a foreign or unknown id 404s).
 */
export default async function OrderPage(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();

  const user = await getUser(env, request);
  if (!user) return redirect("/login");

  const orderId = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return notFound();
  }

  const [order, cartCount] = await Promise.all([
    getOrder(env, user.id, orderId),
    getCartCount(env, user.id),
  ]);
  if (!order) return notFound();

  const itemCount = order.items.reduce((n, l) => n + l.quantity, 0);

  return htmlResponse(
    <ShopLayout title={`Order #${order.id}`} user={user} cartCount={cartCount}>
      <section class="mx-auto flex max-w-[40rem] flex-col gap-vsp-md">
        <div class="flex flex-col items-center gap-vsp-xs rounded-lg border border-success/30 bg-success-soft px-hsp-lg py-vsp-lg text-center">
          <span class="text-[2.5rem]" role="img" aria-label="Order confirmed">
            ✅
          </span>
          <h1 class="text-title font-bold text-ink">Thank you — your order is confirmed</h1>
          <p class="text-small text-ink-soft">
            Order <strong class="text-ink">#{order.id}</strong> · {itemCount} item
            {itemCount === 1 ? "" : "s"} · placed{" "}
            {new Date(`${order.created_at}Z`).toUTCString()}
          </p>
        </div>

        <div class="flex flex-col gap-vsp-2xs rounded-lg border border-line bg-surface p-hsp-md shadow-card">
          <h2 class="mb-vsp-2xs text-heading font-semibold text-ink">Order summary</h2>
          <ul class="flex flex-col">
            {order.items.map((item, i) => (
              <li
                key={i}
                class="flex items-center justify-between gap-hsp-sm border-b border-line py-vsp-xs text-small last:border-b-0"
              >
                <span class="text-ink">
                  {item.name}
                  <span class="text-ink-soft"> × {item.quantity}</span>
                </span>
                <span class="font-semibold tabular-nums text-ink">
                  {formatPrice(item.price_cents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div class="mt-vsp-xs flex items-center justify-between text-body">
            <span class="font-semibold text-ink">Total</span>
            <span class="text-heading font-bold tabular-nums text-ink">
              {formatPrice(order.total_cents)}
            </span>
          </div>
        </div>

        <p class="text-center text-small text-ink-soft">
          Your cart has been emptied.{" "}
          <a href="/" class="font-semibold text-brand underline">
            Continue shopping
          </a>
        </p>
      </section>
    </ShopLayout>,
  );
}

/** 404 page for an unknown / non-owned order id. */
function notFound(): Response {
  return htmlResponse(
    <ShopLayout title="Order not found">
      <section class="mx-auto flex max-w-[34rem] flex-col items-center gap-vsp-sm py-vsp-xl text-center">
        <h1 class="text-title font-bold text-ink">Order not found</h1>
        <p class="text-small text-ink-soft">We could not find that order on your account.</p>
        <a
          href="/"
          class="rounded-md bg-brand px-hsp-md py-vsp-xs text-small font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          Back to the shop
        </a>
      </section>
    </ShopLayout>,
    404,
  );
}
