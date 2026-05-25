import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Single source of truth for "is this request authorized to see admin-only
 * surfaces". Today it verifies a signed cookie. Tomorrow, when Supabase Auth
 * lands, the body of `requireAdmin` swaps to checking the Supabase session
 * against an admin allowlist — the API stays the same so middleware, route
 * handlers, and server components never need to be edited.
 */

export const ADMIN_COOKIE_NAME = "metis_admin";

const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getCookieSecret(): string | null {
  return process.env.METIS_ADMIN_COOKIE_SECRET?.trim() || null;
}

function getAdminPassword(): string | null {
  return process.env.METIS_ADMIN_PASSWORD?.trim() || null;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Builds a signed cookie value. Format: `<expiresAtUnixSeconds>.<hmac>`.
 * The expiry is part of the signed payload so an attacker can't extend a
 * stolen cookie without knowing the secret.
 */
export function issueAdminCookieValue(): { value: string; maxAge: number } | null {
  const secret = getCookieSecret();
  if (!secret) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS;
  const payload = String(expiresAt);
  const signature = signPayload(payload, secret);

  return {
    value: `${payload}.${signature}`,
    maxAge: COOKIE_TTL_SECONDS,
  };
}

function verifyCookieValue(rawValue: string): boolean {
  const secret = getCookieSecret();
  if (!secret) return false;

  const dotIndex = rawValue.indexOf(".");
  if (dotIndex < 1) return false;

  const payload = rawValue.slice(0, dotIndex);
  const signature = rawValue.slice(dotIndex + 1);

  const expected = signPayload(payload, secret);
  if (!constantTimeStringEqual(signature, expected)) {
    return false;
  }

  const expiresAt = Number.parseInt(payload, 10);
  if (!Number.isFinite(expiresAt)) return false;

  return Math.floor(Date.now() / 1000) < expiresAt;
}

export function verifyAdminPassword(submittedPassword: string): boolean {
  const expected = getAdminPassword();
  if (!expected) return false;
  return constantTimeStringEqual(submittedPassword, expected);
}

/**
 * Reads the admin cookie from a Request's `cookie` header (works in both
 * middleware/edge and server components since both expose request headers).
 * Returns `{ok: true}` on a valid signed cookie, `{ok: false, reason}` otherwise.
 *
 * The `reason` is intentionally generic so we don't leak which env var is
 * missing in production logs.
 */
export function checkAdminCookieFromHeader(
  cookieHeader: string | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!cookieHeader) {
    return { ok: false, reason: "no-cookie" };
  }

  const cookies = parseCookieHeader(cookieHeader);
  const value = cookies[ADMIN_COOKIE_NAME];
  if (!value) {
    return { ok: false, reason: "cookie-missing" };
  }

  if (!verifyCookieValue(value)) {
    return { ok: false, reason: "cookie-invalid-or-expired" };
  }

  return { ok: true };
}

function parseCookieHeader(header: string): Record<string, string> {
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const trimmed = part.trim();
    if (!trimmed) return acc;
    const eq = trimmed.indexOf("=");
    if (eq < 0) return acc;
    const key = trimmed.slice(0, eq).trim();
    const value = decodeURIComponent(trimmed.slice(eq + 1));
    if (key) acc[key] = value;
    return acc;
  }, {});
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminPassword() && getCookieSecret());
}
