import { NextResponse } from "next/server";

import { getSetupReadiness } from "@/lib/metis/env";
import { checkAdminCookieFromHeader } from "@/lib/auth/admin-gate";

export async function GET(request: Request) {
  const admin = checkAdminCookieFromHeader(request.headers.get("cookie"));
  if (!admin.ok) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  const readiness = await getSetupReadiness();
  return NextResponse.json(readiness);
}
