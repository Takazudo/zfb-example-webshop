import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import ShopLayout from "../layouts/shop-layout";
import { AuthForm } from "../components/auth-form";
import { createSession, getUser, hashPassword, timingSafeEqual } from "../lib/auth";
import { sessionCookie } from "../lib/cookies";
import { htmlResponse, redirect } from "../lib/render";
import type { Env } from "../lib/env";

export const frontmatter = { title: "Sign in" };
export const prerender = false;

function page(error?: string, email?: string, status = 200): Response {
  return htmlResponse(
    <ShopLayout title="Sign in" activePath="/login">
      <AuthForm mode="login" error={error} email={email} />
    </ShopLayout>,
    status,
  );
}

/**
 * Sign-in route. GET renders the form; POST re-derives the PBKDF2 hash
 * with the stored salt, compares it constant-time, and on success
 * starts a session and redirects to the catalogue.
 */
export default async function LoginPage(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();

  if (request.method !== "POST") {
    const user = await getUser(env, request);
    if (user) return redirect("/");
    return page();
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  const row = await env.DB.prepare(
    "SELECT id, password_hash, password_salt FROM users WHERE email = ?",
  )
    .bind(email)
    .first<{ id: number; password_hash: string; password_salt: string }>();

  // Same generic message whether the email is unknown or the password
  // is wrong — do not leak which accounts exist.
  const invalid = "Incorrect email or password.";
  if (!row) {
    return page(invalid, email, 401);
  }

  const candidate = await hashPassword(password, row.password_salt);
  if (!timingSafeEqual(candidate, row.password_hash)) {
    return page(invalid, email, 401);
  }

  const sessionId = await createSession(env, row.id);
  return redirect("/", { "set-cookie": sessionCookie(sessionId) });
}
