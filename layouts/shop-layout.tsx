import type { ComponentChildren } from "preact";
import type { User } from "../lib/types";
import "../styles/global.css";

type Props = {
  /** Document <title>. */
  title?: string;
  /** Logged-in user, or null. Drives the header auth controls. */
  user?: User | null;
  /** Item count shown on the cart link badge. */
  cartCount?: number;
  /** Highlight the active nav link. */
  activePath?: string;
  children: ComponentChildren;
};

const SITE_NAME = "Driftwood Goods";
const TAGLINE = "Everyday objects, carefully chosen.";

/**
 * The single shared chrome for every page: document shell, sticky
 * header with catalogue link + auth controls + cart badge, and footer.
 *
 * The header reflects per-request state (`user`, `cartCount`) — pages
 * that render this layout pass those props from their D1 reads.
 * Logout is a plain `<form method="post">` so it works without any
 * client-side JavaScript.
 */
export default function ShopLayout({
  title,
  user = null,
  cartCount = 0,
  activePath = "/",
  children,
}: Props) {
  const pageTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  const navLink = (href: string, label: string) => {
    const active = activePath === href;
    return (
      <a
        href={href}
        class={`rounded-sm px-hsp-xs py-vsp-2xs text-small transition-colors hover:text-brand ${
          active ? "font-semibold text-brand" : "text-ink-soft"
        }`}
        aria-current={active ? "page" : undefined}
      >
        {label}
      </a>
    );
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={TAGLINE} />
        <title>{pageTitle}</title>
        {/*
          Stable stylesheet path. zfb only auto-injects the hashed
          stylesheet <link> into SSG HTML; this shop is fully SSR, so
          the layout links it explicitly. `scripts/stable-css.mjs`
          (postbuild) copies the hashed build output to this path.
        */}
        <link rel="stylesheet" href="/assets/app.css" />
      </head>
      <body>
        <div class="flex min-h-dvh flex-col">
          <header class="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
            <div class="mx-auto flex w-full max-w-[72rem] items-center justify-between gap-hsp-md px-hsp-md py-vsp-sm">
              <a href="/" class="flex items-baseline gap-hsp-xs">
                <span class="text-heading font-bold tracking-tight text-ink">{SITE_NAME}</span>
                <span class="hidden text-micro text-ink-soft sm:inline">{TAGLINE}</span>
              </a>
              <nav class="flex items-center gap-hsp-xs">
                {navLink("/", "Shop")}
                {user ? (
                  <>
                    <span class="hidden text-micro text-ink-soft md:inline">{user.email}</span>
                    <form method="post" action="/logout" class="contents">
                      <button
                        type="submit"
                        class="cursor-pointer rounded-sm px-hsp-xs py-vsp-2xs text-small text-ink-soft transition-colors hover:text-danger"
                      >
                        Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    {navLink("/login", "Sign in")}
                    {navLink("/signup", "Sign up")}
                  </>
                )}
                <a
                  href="/cart"
                  class="relative ml-hsp-2xs inline-flex items-center gap-hsp-2xs rounded-pill bg-brand px-hsp-sm py-vsp-2xs text-small font-semibold text-white transition-colors hover:bg-brand-strong"
                >
                  Cart
                  <span class="inline-flex min-w-5 items-center justify-center rounded-pill bg-white/25 px-hsp-2xs text-micro tabular-nums">
                    {cartCount}
                  </span>
                </a>
              </nav>
            </div>
          </header>

          <main class="mx-auto w-full max-w-[72rem] flex-1 px-hsp-md py-vsp-lg">{children}</main>

          <footer class="border-t border-line bg-surface-sunken">
            <div class="mx-auto flex w-full max-w-[72rem] flex-col gap-vsp-2xs px-hsp-md py-vsp-md text-micro text-ink-soft">
              <p class="font-semibold text-ink-soft">{SITE_NAME}</p>
              <p>
                A demo storefront built with{" "}
                <a href="https://github.com/Takazudo/zudo-front-builder" class="text-brand underline">
                  zfb
                </a>{" "}
                — SSR routes on Cloudflare Workers, cart and accounts backed by Cloudflare D1.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
