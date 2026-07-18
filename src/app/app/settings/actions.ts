"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { deleteLlmKey, saveLlmKey } from "@/lib/llm-keys/store";
import type { AuthFormState } from "@/app/(auth)/actions";

export async function updateProfileAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = formData.get("full_name");
  if (typeof raw !== "string") {
    return { status: "error", message: "Invalid request." };
  }
  const fullName = raw.trim();
  if (fullName.length < 1 || fullName.length > 120) {
    return {
      status: "error",
      message: "Name must be between 1 and 120 characters.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Sign in to update your profile." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/app/settings");
  return { status: "success", message: "Name updated." };
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = formData.get("new_password");
  if (typeof raw !== "string") {
    return { status: "error", message: "Invalid request." };
  }
  const password = raw.trim();
  if (password.length < 8) {
    return {
      status: "error",
      message: "New password must be at least 8 characters.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "success", message: "Password updated." };
}

export type LlmKeyFormResult = { status: "idle" } | { status: "error"; message: string };

export async function saveManualKeyAction(
  _prev: LlmKeyFormResult,
  formData: FormData,
): Promise<LlmKeyFormResult> {
  const providerRaw = formData.get("provider");
  const provider =
    providerRaw === "openai" ? "openai" : providerRaw === "openrouter" ? "openrouter" : null;
  if (!provider) {
    return { status: "error", message: "Pick a provider." };
  }

  const raw = formData.get("apiKey");
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  if (!apiKey || apiKey.length > 300) {
    return {
      status: "error",
      message:
        provider === "openrouter"
          ? "Paste a valid OpenRouter API key."
          : "Paste a valid OpenAI API key.",
    };
  }

  try {
    await saveLlmKey(provider, apiKey);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Couldn't save the key.",
    };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/reports");
  redirect("/app/settings?llm_saved=1");
}

export async function deleteLlmKeyAction(): Promise<void> {
  try {
    await deleteLlmKey();
  } catch (error) {
    console.error("delete llm key failed", error);
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/reports");
}
