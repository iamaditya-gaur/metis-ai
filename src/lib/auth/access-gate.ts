import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Invite-only gate for the no-login tool (`/reporting` + `/api/metis/*`).
 * Anonymous runs spend the operator's OpenRouter key, so they need the shared
 * access code. The code lives only in the server env (`METIS_ACCESS_CODE`,
 * never `NEXT_PUBLIC_*`), so it never reaches the browser bundle or the repo.
 *
 * After a correct code the browser gets an httpOnly signed cookie. The
 * signing key is derived from the code itself, so changing
 * `METIS_ACCESS_CODE` signs every browser out at once.
 */

export const ACCESS_COOKIE_NAME = "metis_access";

const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const MIN_CODE_LENGTH = 16;
const MAX_SUBMITTED_LENGTH = 256;

let warnedWeakCode = false;

function getAccessCode(): string | null {
  const code = process.env.METIS_ACCESS_CODE?.trim();
  if (!code) return null;

  // Fail closed on a guessable code rather than quietly accepting it.
  if (code.length < MIN_CODE_LENGTH) {
    if (!warnedWeakCode) {
      console.error(
        `[access-gate] METIS_ACCESS_CODE is shorter than ${MIN_CODE_LENGTH} characters. The tool stays locked until a longer code is set.`,
      );
      warnedWeakCode = true;
    }
    return null;
  }

  return code;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function getCookieKey(code: string): Buffer {
  return createHmac("sha256", code).update("metis-access-cookie-v1").digest();
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function isAccessGateConfigured(): boolean {
  return getAccessCode() !== null;
}

/**
 * Compares SHA-256 digests with `timingSafeEqual`, so neither the content nor
 * the length of the real code leaks through response timing.
 */
export function verifyAccessCode(submitted: string): boolean {
  const expected = getAccessCode();
  if (!expected) return false;

  const candidate = submitted.trim();
  if (!candidate || candidate.length > MAX_SUBMITTED_LENGTH) return false;

  return timingSafeEqual(sha256(candidate), sha256(expected));
}

/** Cookie format: `<expiresAtUnixSeconds>.<hmac>` — same shape as the admin gate. */
export function issueAccessCookieValue(): { value: string; maxAge: number } | null {
  const code = getAccessCode();
  if (!code) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS;
  const payload = String(expiresAt);

  return {
    value: `${payload}.${sign(payload, getCookieKey(code))}`,
    maxAge: COOKIE_TTL_SECONDS,
  };
}

export function hasValidAccessCookie(rawValue: string | null | undefined): boolean {
  const code = getAccessCode();
  if (!code || !rawValue) return false;

  const dotIndex = rawValue.indexOf(".");
  if (dotIndex < 1) return false;

  const payload = rawValue.slice(0, dotIndex);
  const signature = Buffer.from(rawValue.slice(dotIndex + 1));
  const expected = Buffer.from(sign(payload, getCookieKey(code)));
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return false;
  }

  const expiresAt = Number.parseInt(payload, 10);
  if (!Number.isFinite(expiresAt)) return false;

  return Math.floor(Date.now() / 1000) < expiresAt;
}
