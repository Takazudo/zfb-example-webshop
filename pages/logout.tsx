import { getCloudflareContext } from "@takazudo/zfb-adapter-cloudflare";
import { destroySession } from "../lib/auth";
import { clearedSessionCookie, readSessionId } from "../lib/cookies";
import { redirect } from "../lib/render";
import type { Env } from "../lib/env";

export const frontmatter = { title: "Sign out" };
export const prerender = false;

/**
 * Logout route. The header's "Sign out" control posts here. Deletes the
 * session row and expires the cookie, then redirects to the catalogue.
 * A GET also logs out so a stray bookmark behaves sanely.
 */
export default async function LogoutPage(): Promise<Response> {
  const { env, request } = getCloudflareContext<Env>();

  const sessionId = readSessionId(request);
  if (sessionId) {
    await destroySession(env, sessionId);
  }
  return redirect("/", { "set-cookie": clearedSessionCookie() });
}
