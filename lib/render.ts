/**
 * SSR render helpers.
 *
 * D1-touching pages return a `Response` directly (so a single route can
 * branch on `request.method`, set `Set-Cookie` headers, and issue 303
 * redirects). When such a route wants to render an HTML page it renders
 * its zudo-react tree to a string itself — the framework's automatic
 * JSX→HTML path only applies to routes that *return JSX*, not a
 * `Response`.
 */

import type { Child } from "@takazudo/zfb/zudo-react";
import { renderToString } from "@takazudo/zfb/zudo-react/server";

/**
 * Render a zudo-react tree to a full HTML-document `Response`. The
 * renderer emits no doctype, so it is prefixed here.
 */
export function htmlResponse(node: Child, status = 200): Response {
  const body = `<!DOCTYPE html>${renderToString(node)}`;
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Build a 303 "See Other" redirect. 303 (not 302) makes the browser
 * issue a GET for the target — the correct POST-then-redirect pattern
 * so a refresh does not re-submit the form.
 */
export function redirect(location: string, extraHeaders?: Record<string, string>): Response {
  return new Response(null, {
    status: 303,
    headers: { location, ...extraHeaders },
  });
}
