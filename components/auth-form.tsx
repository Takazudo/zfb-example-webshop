/**
 * Shared markup for the sign-in and sign-up pages — a centred card with
 * an email + password form. `mode` switches the labels, the POST
 * target, and the cross-link. `error` renders a validation message
 * returned by the server after a failed submit.
 */
export function AuthForm({
  mode,
  error,
  email,
}: {
  mode: "login" | "signup";
  error?: string;
  email?: string;
}) {
  const isSignup = mode === "signup";
  const heading = isSignup ? "Create your account" : "Welcome back";
  const blurb = isSignup
    ? "Sign up to start a cart and check out."
    : "Sign in to pick up where you left off.";
  const action = isSignup ? "/signup" : "/login";
  const submitLabel = isSignup ? "Create account" : "Sign in";

  return (
    <div class="mx-auto flex max-w-[26rem] flex-col gap-vsp-md">
      <header class="flex flex-col gap-vsp-2xs text-center">
        <h1 class="text-title font-bold text-ink">{heading}</h1>
        <p class="text-small text-ink-soft">{blurb}</p>
      </header>

      <form
        method="post"
        action={action}
        class="flex flex-col gap-vsp-sm rounded-lg border border-line bg-surface p-hsp-lg shadow-card"
      >
        {error ? (
          <p
            role="alert"
            class="rounded-md border border-danger/30 bg-danger-soft px-hsp-sm py-vsp-xs text-small text-danger"
          >
            {error}
          </p>
        ) : null}

        <label class="flex flex-col gap-vsp-2xs">
          <span class="text-small font-semibold text-ink">Email</span>
          <input
            type="email"
            name="email"
            required
            autocomplete="email"
            value={email ?? ""}
            placeholder="you@example.com"
            class="rounded-md border border-line bg-surface px-hsp-sm py-vsp-xs text-body outline-none transition-colors focus:border-brand"
          />
        </label>

        <label class="flex flex-col gap-vsp-2xs">
          <span class="text-small font-semibold text-ink">Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autocomplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            class="rounded-md border border-line bg-surface px-hsp-sm py-vsp-xs text-body outline-none transition-colors focus:border-brand"
          />
        </label>

        <button
          type="submit"
          class="mt-vsp-2xs cursor-pointer rounded-md bg-brand px-hsp-md py-vsp-xs text-body font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          {submitLabel}
        </button>
      </form>

      <p class="text-center text-small text-ink-soft">
        {isSignup ? "Already have an account? " : "New here? "}
        <a href={isSignup ? "/login" : "/signup"} class="font-semibold text-brand underline">
          {isSignup ? "Sign in" : "Create an account"}
        </a>
      </p>
    </div>
  );
}
