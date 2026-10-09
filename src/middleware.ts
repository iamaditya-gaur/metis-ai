import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE_NAME, hasValidAccessCookie } from "@/lib/auth/access-gate";
import { checkAdminCookieFromHeader } from "@/lib/auth/admin-gate";
import { isMetisPaused } from "@/lib/site-mode";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Two coexisting auth systems gate this app:
 *
 *  - `/admin/*` — operator-only observability surface, protected by a signed
 *    HMAC cookie (single shared secret). Unchanged from the original design.
 *
 *  - `/app/*`   — end-user product, protected by Supabase Auth session
 *    cookies. Unauthenticated users get redirected to `/login`.
 *
 *  - `/api/metis/*` — the tool's APIs. Need the access-code cookie, or (when
 *    accounts are on) a Supabase session, since signed-in runs use the
 *    user's own AI key. `/reporting` itself renders the code screen.
 *
 * With `METIS_PAUSED=true` the database is offline, so every account surface
 * sends people to the no-login tool instead of a broken login form.
 */
const ACCOUNT_SURFACES = [
  "/app",
  "/admin",
  "/login",
  "/signup",
  "/reset-password",
  "/auth",
  "/api/llm-keys",
];

function isAccountSurface(pathname: string) {
  return ACCOUNT_SURFACES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const paused = isMetisPaused();

  if (paused && isAccountSurface(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Metis accounts are paused." },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/reporting", request.url));
  }

  if (pathname.startsWith("/api/metis")) {
    return handleToolApi(request, paused);
  }

  if (pathname.startsWith("/admin")) {
    return handleAdmin(request);
  }

  if (pathname.startsWith("/app")) {
    return handleApp(request);
  }

  return NextResponse.next();
}

function handleAdmin(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // `/admin/login` and `/admin/logout` must stay reachable.
  if (pathname === "/admin/login" || pathname === "/admin/logout") {
    return NextResponse.next();
  }

  const result = checkAdminCookieFromHeader(request.headers.get("cookie"));
  if (result.ok) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname + (request.nextUrl.search ?? ""));
  return NextResponse.redirect(loginUrl);
}

async function handleToolApi(request: NextRequest, paused: boolean) {
  if (hasValidAccessCookie(request.cookies.get(ACCESS_COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }

  if (!paused) {
    const { response, user } = await updateSession(request);
    if (user) {
      return response;
    }
  }

  return NextResponse.json(
    { message: "Enter the Metis access code first." },
    { status: 401 },
  );
}

async function handleApp(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (user) {
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    request.nextUrl.pathname + (request.nextUrl.search ?? ""),
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/app/:path*",
    "/api/metis/:path*",
    "/api/llm-keys/:path*",
    "/login",
    "/signup",
    "/reset-password",
    "/auth/:path*",
  ],
  // node:crypto (HMAC, timingSafeEqual) is used in the admin gate.
  // Default middleware runtime is Edge, which excludes Node modules.
  runtime: "nodejs",
};
