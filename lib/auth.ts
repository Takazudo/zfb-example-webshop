/**
 * Minimal email+password auth for the webshop demo.
 *
 * Locked scope (issue #316): signup, login, logout, server-side session
 * cookie. Explicitly NOT included: email verification, password reset,
 * OAuth, "remember me", 2FA. This proves SSR + D1 + auth mechanics, not
 * a production identity system.
 */

import type { Env } from "./env";
import type { User } from "./types";
import { readSessionId } from "./cookies";

/** 7 days in milliseconds — session lifetime, mirrors the cookie Max-Age. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Hex-encode a byte array. */
function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Decode a hex string into a fresh ArrayBuffer-backed byte array. */
function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const matched = hex.match(/../g) ?? [];
  const bytes = new Uint8Array(new ArrayBuffer(matched.length));
  for (let i = 0; i < matched.length; i++) {
    bytes[i] = parseInt(matched[i], 16);
  }
  return bytes;
}

/** Generate `n` random bytes as a hex string (salt / session id). */
export function randomHex(n: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(n)));
}

/**
 * Derive a password hash with PBKDF2 via Web Crypto.
 *
 * workerd exposes the standard `crypto.subtle`. PBKDF2 is the right
 * choice here — scrypt/argon2 are not in `crypto.subtle`, and a raw
 * hash is not acceptable for passwords. SHA-256, 100k iterations,
 * 256-bit digest; the digest is stored hex.
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/**
 * Constant-time comparison of two equal-length hex strings.
 *
 * Password digests are fixed-length so a plain `===` would be
 * acceptable for a demo; constant-time is the stricter choice and
 * costs nothing here.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Create a new server-side session for a user and return its id (the
 * opaque cookie value: 32 random bytes, hex).
 */
export async function createSession(env: Env, userId: number): Promise<string> {
  const id = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, userId, expiresAt)
    .run();
  return id;
}

/** Delete a session row — logout. */
export async function destroySession(env: Env, sessionId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/**
 * Resolve the logged-in user for a request, or null. Expired sessions
 * are rejected by the `expires_at > datetime('now')` guard and swept
 * lazily so stale rows never accumulate unboundedly.
 */
export async function getUser(env: Env, request: Request): Promise<User | null> {
  const sessionId = readSessionId(request);
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT users.id AS id, users.email AS email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ? AND sessions.expires_at > datetime('now')`,
  )
    .bind(sessionId)
    .first<User>();

  if (!row) {
    // Either no such session or it has expired — sweep it lazily.
    await env.DB.prepare("DELETE FROM sessions WHERE id = ? AND expires_at <= datetime('now')")
      .bind(sessionId)
      .run();
    return null;
  }
  return row;
}
