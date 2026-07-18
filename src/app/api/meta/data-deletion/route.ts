import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getMetaOAuthEnv, parseSignedRequest } from "@/lib/meta/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Meta's data-deletion callback (required for App Review). When a user
 * removes the app from their Facebook settings, Meta POSTs a signed_request
 * naming the Facebook user. We delete every stored token for that identity
 * immediately and answer with a confirmation code + human-readable status
 * URL, per Meta's contract.
 */
export async function POST(request: Request) {
  let signedRequest: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get("signed_request");
    signedRequest = typeof value === "string" ? value : null;
  } catch {
    signedRequest = null;
  }
  if (!signedRequest) {
    return NextResponse.json({ message: "signed_request required." }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    const { appSecret } = getMetaOAuthEnv();
    payload = parseSignedRequest(signedRequest, appSecret);
  } catch {
    return NextResponse.json({ message: "Invalid signed_request." }, { status: 400 });
  }

  const fbUserId = String(payload.user_id ?? "").trim();
  if (fbUserId) {
    // Service role: the deletion must span every Metis user who connected
    // this FB identity, which user-scoped RLS can't reach.
    const admin = createAdminClient();
    await admin.from("meta_connections").delete().eq("fb_user_id", fbUserId);
  }

  const confirmationCode = randomUUID();
  const statusUrl = new URL(`/data-deletion?code=${confirmationCode}`, request.url);
  return NextResponse.json({
    url: statusUrl.toString(),
    confirmation_code: confirmationCode,
  });
}
