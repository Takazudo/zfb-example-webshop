import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import ShopLayout from "../layouts/shop-layout";
import { ProductCard } from "../components/product-card";
import { getUser } from "../lib/auth";
import { getCartCount } from "../lib/shop";
import { listProducts } from "../lib/shop";
import { htmlResponse } from "../lib/render";
import type { Env } from "../lib/env";

// zfb requires a frontmatter export on every page. The visible <title>
// is composed in ShopLayout; this is the build-time page meta.
export const frontmatter = { title: "Driftwood Goods", description: "A small zfb webshop demo." };

// Catalogue prices and stock live in D1, so this route reads `env.DB`
// per request — it cannot be statically pre-rendered.
export const prerender = false;

/** Storefront homepage: hero + the full product grid grouped by nothing. */
export default async function HomePage(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();

  const user = await getUser(env, request);
  const [products, cartCount] = await Promise.all([
    listProducts(env),
    user ? getCartCount(env, user.id) : Promise.resolve(0),
  ]);

  return htmlResponse(
    <ShopLayout title="Shop" user={user} cartCount={cartCount} activePath="/">
      <section class="flex flex-col gap-vsp-md">
        <div class="flex flex-col gap-vsp-xs rounded-lg bg-brand-soft px-hsp-lg py-vsp-lg">
          <h1 class="text-display font-bold tracking-tight text-ink">
            Everyday objects, carefully chosen.
          </h1>
          <p class="max-w-[40rem] text-body text-ink-soft">
            A small, deliberate catalogue of kitchen, home and desk goods. Built as a live demo
            of zfb server-side rendering with a Cloudflare D1 cart.
          </p>
          {user ? (
            <p class="text-small text-ink-soft">
              Signed in as <strong class="text-ink">{user.email}</strong> — add anything below to
              your cart.
            </p>
          ) : (
            <p class="text-small text-ink-soft">
              <a href="/signup" class="font-semibold text-brand underline">
                Create an account
              </a>{" "}
              to start a cart and check out.
            </p>
          )}
        </div>

        <div>
          <h2 class="mb-vsp-sm text-title font-bold text-ink">All products</h2>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-hsp-md">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} signedIn={Boolean(user)} />
            ))}
          </div>
        </div>
      </section>
    </ShopLayout>,
  );
}
