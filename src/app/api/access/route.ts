import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  isAccessGateConfigured,
  issueAccessCookieValue,
  verifyAccessCode,
} from "@/lib/auth/access-gate";

/**
 * Plain HTML form target for the `/reporting` access-code screen (works with
 * JS off). Success sets the httpOnly access cookie and returns to the tool;
 * every failure redirects back with a generic `?access=` flag.
 *
 * Brute force: the code is long and random, wrong answers are slowed down,
 * and an IP is locked out after MAX_FAILURES misses. The lockout map lives in
 * one serverless instance's memory, so it's friction, not the main defence —
 * the code's length is.
 */

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const FAILURE_DELAY_MS = 750;

const failures = new Map<string, { count: number; firstAt: number }>();

function clientKey(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function isLockedOut(key: string, now: number): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (now - entry.firstAt > LOCKOUT_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string, now: number) {
  if (failures.size > 5000) {
    for (const [k, v] of failures) {
      if (now - v.firstAt > LOCKOUT_MS) failures.delete(k);
    }
  }
  const entry = failures.get(key);
  if (entry && now - entry.firstAt <= LOCKOUT_MS) {
    entry.count += 1;
  } else {
    failures.set(key, { count: 1, firstAt: now });
  }
}

/**
 * Rejects forms posted from other sites. Browsers send `Sec-Fetch-Site`;
 * `Origin` can be the literal string "null" (privacy settings, no-referrer
 * pages), so it's only a fallback and must never be parsed blindly.
 */
function isSameSitePost(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return true;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function backToTool(request: Request, access?: string) {
  const url = new URL("/reporting", request.url);
  if (access) url.searchParams.set("access", access);
  // 303 so the browser follows with a GET instead of re-posting the form.
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!isSameSitePost(request)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  if (!isAccessGateConfigured()) {
    return backToTool(request, "off");
  }

  const key = clientKey(request);
  const now = Date.now();
  if (isLockedOut(key, now)) {
    return backToTool(request, "locked");
  }

  let submitted = "";
  try {
    const form = await request.formData();
    submitted = String(form.get("code") ?? "");
  } catch {
    return backToTool(request, "wrong");
  }

  if (!verifyAccessCode(submitted)) {
    recordFailure(key, now);
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return backToTool(request, isLockedOut(key, now) ? "locked" : "wrong");
  }

  failures.delete(key);
  const issued = issueAccessCookieValue();
  if (!issued) {
    return backToTool(request, "off");
  }

  const response = backToTool(request);
  response.cookies.set(ACCESS_COOKIE_NAME, issued.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: issued.maxAge,
    path: "/",
  });
  return response;
}
