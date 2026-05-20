import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import ShopLayout from "../layouts/shop-layout";
import { AuthForm } from "../components/auth-form";
import { createSession, getUser, hashPassword, randomHex } from "../lib/auth";
import { sessionCookie } from "../lib/cookies";
import { htmlResponse, redirect } from "../lib/render";
import type { Env } from "../lib/env";

export const frontmatter = { title: "Sign up" };
export const prerender = false;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function page(error?: string, email?: string, status = 200): Response {
  return htmlResponse(
    <ShopLayout title="Sign up" activePath="/signup">
      <AuthForm mode="signup" error={error} email={email} />
    </ShopLayout>,
    status,
  );
}

/**
 * Sign-up route. GET renders the form; POST creates the user (PBKDF2
 * password hash + per-user salt), starts a session, and redirects to
 * the catalogue with the session cookie set.
 */
export default async function SignupPage(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();

  if (request.method !== "POST") {
    // Already signed in — no reason to see the signup form.
    const user = await getUser(env, request);
    if (user) return redirect("/");
    return page();
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!EMAIL_RE.test(email)) {
    return page("Enter a valid email address.", email, 400);
  }
  if (password.length < 8) {
    return page("Password must be at least 8 characters.", email, 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: number }>();
  if (existing) {
    return page("An account with that email already exists.", email, 409);
  }

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const insert = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)",
  )
    .bind(email, hash, salt)
    .run();

  const userId = Number(insert.meta.last_row_id);
  const sessionId = await createSession(env, userId);
  return redirect("/", { "set-cookie": sessionCookie(sessionId) });
}
