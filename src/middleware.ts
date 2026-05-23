import { NextResponse, type NextRequest } from "next/server";

import { checkAdminCookieFromHeader } from "@/lib/auth/admin-gate";

/**
 * Gates all `/admin/*` routes except `/admin/login` itself (the login form
 * must be reachable while unauthenticated). On a missing or invalid admin
 * cookie, redirects to `/admin/login` with a `next` query param so the user
 * lands back where they tried to go after authenticating.
 *
 * When Supabase Auth ships, the body of `checkAdminCookieFromHeader` changes
 * — this file does not.
 */
export function middleware(request: NextRequest) {
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

export const config = {
  matcher: ["/admin/:path*"],
};
