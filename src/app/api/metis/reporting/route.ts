import { NextResponse } from "next/server";

import { runReportingWorkflow } from "@/lib/metis/reporting";
import type { ReportingRunRequest } from "@/lib/metis/types";
import { createClient } from "@/lib/supabase/server";
import { decryptSecretFromBase64 } from "@/lib/crypto/token-encryption";

type Body = ReportingRunRequest & { connectionId?: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const payload: ReportingRunRequest = {
    accountId: body.accountId,
    dateStart: body.dateStart,
    dateEnd: body.dateEnd,
    toneExamples: body.toneExamples,
    accessToken: body.accessToken,
    userId: null,
  };

  // Authed path: if a connectionId is passed, decrypt the saved token and
  // tag the run with the signed-in user's id so it shows up in /app/history.
  if (body.connectionId) {
    try {
      const { token, userId } = await resolveSavedConnection(body.connectionId);
      payload.accessToken = token;
      payload.userId = userId;
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof Error ? error.message : "Could not load the saved connection.",
        },
        { status: 400 },
      );
    }
  } else {
    // Even on the public demo path, attribute the run to the user if they
    // happen to be signed in (e.g. when /reporting is visited by a logged-in
    // user). Costs one extra Supabase call; nothing breaks if they aren't.
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) payload.userId = user.id;
    } catch {
      // Ignore session-read failures; the demo path doesn't require one.
    }
  }

  try {
    const result = await runReportingWorkflow(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Reporting run failed.",
      },
      { status: 500 },
    );
  }
}

async function resolveSavedConnection(connectionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Sign in to use a saved connection.");
  }
  const { data, error } = await supabase
    .from("meta_connections")
    .select("ciphertext, iv, auth_tag")
    .eq("id", connectionId)
    .single();
  if (error || !data) {
    throw new Error("Connection not found.");
  }
  const token = decryptSecretFromBase64({
    ciphertext: data.ciphertext,
    iv: data.iv,
    authTag: data.auth_tag,
  });
  return { token, userId: user.id };
}
