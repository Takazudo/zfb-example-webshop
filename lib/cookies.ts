/**
 * Cookie helpers. The Worker runtime gives us the raw `Cookie:` request
 * header and expects a raw `Set-Cookie:` response header — there is no
 * cookie object, so we parse/serialise by hand.
 */

const SESSION_COOKIE = "sid";

/** Read a named cookie from a Request's `Cookie:` header. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) return pair.slice(eq + 1).trim();
  }
  return null;
}

/** Read the session id from the request cookie jar. */
export function readSessionId(request: Request): string | null {
  return readCookie(request, SESSION_COOKIE);
}

/**
 * Build the `Set-Cookie` value that establishes a session.
 *
 * `HttpOnly` (no JS access — XSS-resistant), `Secure` (Cloudflare Workers
 * / workers.dev is always HTTPS), `SameSite=Lax` (CSRF-resistant for this demo),
 * `Max-Age=604800` (7 days — mirrored in sessions.expires_at).
 */
export function sessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;
}

/** Build the `Set-Cookie` value that clears the session cookie on logout. */
export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
