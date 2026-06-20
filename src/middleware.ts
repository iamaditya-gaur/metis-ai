import { NextResponse, type NextRequest } from "next/server";

import { checkAdminCookieFromHeader } from "@/lib/auth/admin-gate";
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
 * Public routes (`/`, `/login`, `/signup`, `/reset-password`, `/reporting`)
 * are not matched and pass through unaffected.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: ["/admin/:path*", "/app/:path*"],
  // node:crypto (HMAC, timingSafeEqual) is used in the admin gate.
  // Default middleware runtime is Edge, which excludes Node modules.
  runtime: "nodejs",
};
