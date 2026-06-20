import { NextResponse } from "next/server";

import { getAccessibleAccounts } from "@/lib/metis/accounts";
import { createClient } from "@/lib/supabase/server";
import { decryptSecretFromBase64 } from "@/lib/crypto/token-encryption";

export async function GET() {
  try {
    const accounts = await getAccessibleAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not load accessible Meta accounts.",
      },
      { status: 500 },
    );
  }
}

type Body = {
  accessToken?: string;
  connectionId?: string;
};

export async function POST(request: Request) {
  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  let token = payload.accessToken?.trim() || "";

  // Path A: signed-in user passed a saved connectionId. Decrypt server-side.
  if (!token && payload.connectionId) {
    try {
      token = await resolveSavedConnectionToken(payload.connectionId);
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof Error ? error.message : "Could not load the saved connection.",
        },
        { status: 400 },
      );
    }
  }

  if (!token) {
    return NextResponse.json(
      { message: "A valid Meta access token is required to load ad accounts." },
      { status: 400 },
    );
  }

  try {
    const accounts = await getAccessibleAccounts({ accessToken: token });
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not load accessible Meta accounts.",
      },
      { status: 500 },
    );
  }
}

async function resolveSavedConnectionToken(connectionId: string): Promise<string> {
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
  return decryptSecretFromBase64({
    ciphertext: data.ciphertext,
    iv: data.iv,
    authTag: data.auth_tag,
  });
}
