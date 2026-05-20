import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import { getUser } from "../lib/auth";
import { checkout } from "../lib/shop";
import { redirect } from "../lib/render";
import type { Env } from "../lib/env";

export const frontmatter = { title: "Checkout" };
export const prerender = false;

/**
 * Checkout route — POST only (the cart's "Place order" form).
 *
 * Snapshots the cart into an order, empties the cart, and redirects to
 * the order confirmation page. An empty cart or a non-POST request
 * just bounces back to /cart.
 */
export default async function CheckoutPage(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();

  const user = await getUser(env, request);
  if (!user) return redirect("/login");

  if (request.method !== "POST") {
    return redirect("/cart");
  }

  const orderId = await checkout(env, user.id);
  if (orderId === null) {
    // Nothing to buy — back to the (empty) cart.
    return redirect("/cart");
  }
  return redirect(`/order?id=${orderId}`);
}
