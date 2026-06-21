"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { encryptSecretToBase64 } from "@/lib/crypto/token-encryption";
import { getAccessibleAccounts } from "@/lib/metis/accounts";

export type AddConnectionResult =
  | { status: "idle" }
  | { status: "error"; message: string };

const MAX_LABEL_LENGTH = 80;
const MAX_TOKEN_LENGTH = 4000;

export async function addConnectionAction(
  _prev: AddConnectionResult,
  formData: FormData,
): Promise<AddConnectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Sign in to add a connection." };
  }

  const rawLabel = formData.get("label");
  const rawToken = formData.get("token");
  if (typeof rawLabel !== "string" || typeof rawToken !== "string") {
    return { status: "error", message: "Both fields are required." };
  }
  const label = rawLabel.trim();
  const token = rawToken.trim();
  if (!label || label.length > MAX_LABEL_LENGTH) {
    return {
      status: "error",
      message: "Give the connection a short, human label.",
    };
  }
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return { status: "error", message: "Paste a valid Meta access token." };
  }

  let accountCount = 0;
  try {
    const accounts = await getAccessibleAccounts({ accessToken: token });
    accountCount = accounts.length;
    if (accountCount === 0) {
      return {
        status: "error",
        message:
          "That token didn't return any accessible ad accounts. Use a token with ad-reading access.",
      };
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Meta rejected this token: ${error.message}`
          : "Meta rejected this token.",
    };
  }

  let parts: ReturnType<typeof encryptSecretToBase64>;
  try {
    parts = encryptSecretToBase64(token);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? `Encryption failed: ${error.message}`
          : "Encryption failed.",
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("meta_connections")
    .insert({
      user_id: user.id,
      label,
      ciphertext: parts.ciphertext,
      iv: parts.iv,
      auth_tag: parts.authTag,
      account_count: accountCount,
      last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      status: "error",
      message: `Couldn't save the connection: ${insertError?.message ?? "unknown error"}`,
    };
  }

  revalidatePath("/app/connections");
  revalidatePath("/app/reports");

  // redirect() must be OUTSIDE try/catch — it throws NEXT_REDIRECT and the
  // framework needs to handle that throw, not us. The user lands on /app/reports
  // with the new connection pre-selected and a "saved" toast.
  redirect(`/app/reports?connection=${inserted.id}&saved=1`);
}

export async function deleteConnectionAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase.from("meta_connections").delete().eq("id", id);
  if (error) {
    // RLS will block other users' rows. Log and move on.
    console.error("delete connection failed", error);
  }
  revalidatePath("/app/connections");
  revalidatePath("/app/reports");
}
